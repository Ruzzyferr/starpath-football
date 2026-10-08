/**
 * Balance simulator: auto-plays whole careers through the real game façade
 * (autopilot planning, auto-simmed matches, event cards, offers, shopping,
 * casino) and records what a player would experience. Used by
 * `balance.test.ts` (BALANCE=1) to produce the tables in docs/BALANCE.md.
 *
 * Not used by production code. Deterministic per seed.
 */
import { Rng } from '../../core/rng'
import type { Archetype, Background, GameState, Gender, Position } from '../../core/types'
import { ASSETS } from '../../data/assets'
import { PERKS } from '../../data/perks'
import { ACTIVITY_BY_ID } from '../../data/activities'
import { heroAge } from '../career/common'
import { heroOvr } from '../career/progression'
import { activityBlock, autoPlanDay } from '../life/activities'
import { maxStakeFor } from '../life/casino'
import { assetUpkeep, netWorth, purchaseBlock } from '../life/economy'
import { squadPlayers } from '../world/queries'
import { advanceDay, isHeroMatchday } from './calendar'
import {
  acceptOffer, acceptSponsor, blackjackAct, blackjackDeal, buyAsset, declineOffer, doActivity, hireAgent, hireTrainer,
  playHorses, playRoulette, playSlots, resolveEventChoice, unlockPerk, AGENT_TIERS, horseRaceCard,
} from './actions'
import { describeEvent } from './eventsAdapter'
import { GFLAG, activityContext, heroClub, readJson } from './internal'
import { newGame, type NewGameInput } from './newGame'
import { getOffers, getSponsorOffers } from './season'

/** How the simulated player spends evenings and money. */
export type Persona = 'pro' | 'spender' | 'gambler' | 'party'

export interface CareerConfig {
  seed: number
  nationality: string
  archetype: Archetype
  background: Background
  gender: Gender
  persona: Persona
  seasons: number
  /** Start age (default 17). */
  startAge?: number
}

/** One row per completed season (sampled at the season rollover). */
export interface SeasonSample {
  season: number
  age: number
  ovr: number
  potential: number
  reputation: number
  tier: number | null
  clubRep: number | null
  wage: number
  money: number
  netWorth: number
  trophies: number
  apps: number
  goals: number
  /** Hero position at season end. */
  position: Position
  /** Highest goal tally of any NPC in the hero's league this season (all competitions). */
  leagueTopScorer: number
  /** After-tax income this season (wage, sponsors, passive). */
  income: number
  /** Spending this season by sink. */
  spend: { assets: number; upkeep: number; trainer: number; casino: number; other: number }
  injuries: number
  weeksInjured: number
  events: number
  weeks: number
  /** Mornings with energy too low for a normal training session. */
  lowEnergyMornings: number
  days: number
  /** Hero fixtures this season vs. those missed while fit (not selected). */
  clubFixtures: number
  /** Reputation gained this season by source. */
  repFrom: { match: number; weekly: number; other: number; cards: number; shopping: number; transfer: number }
  /** Club changes this season (transfers, loans, free-agent signings). */
  moves: number
  /** Weeks that ended with negative cash (before the bank's forced sales). */
  negativeWeeks: number
}

export interface CareerTrace {
  cfg: CareerConfig
  samples: SeasonSample[]
  bankrupt: boolean
  /** Diagnostics at the first bankruptcy flag (null = never). */
  bankruptAt: { age: number; season: number; week: number; money: number; savings: number; assets: number; businesses: number; loan: number; sponsors: number; wage: number } | null
  /** Age when first playing in a tier-1 league (null = never). */
  firstTopTierAge: number | null
  /** Age when first at a club with reputation ≥ 80 (elite). */
  firstEliteAge: number | null
  /** Age when OVR first reached 80 (null = never). */
  ovr80Age: number | null
  boughtIsland: { age: number; reputation: number } | null
  casinoNet: number
  clubs: string[]
}

const POS: Record<Archetype, Position> = { poacher: 'ST', playmaker: 'AM', winger: 'LW', wall: 'CB', boxToBox: 'CM', keeper: 'GK' }

export function careerInput(cfg: CareerConfig): NewGameInput {
  const female = cfg.gender === 'female'
  return {
    firstName: female ? 'Elif' : 'Arda', lastName: 'Yıldız', nickname: female ? 'Elif' : 'Arda', nationality: cfg.nationality,
    birthYear: 2026 - (cfg.startAge ?? 17), position: POS[cfg.archetype], foot: 'R', archetype: cfg.archetype, background: cfg.background,
    appearance: { skin: 1, hairStyle: 2, hairColor: 0, beard: 0, eyeColor: 1, face: 0, accessory: 0 },
    gender: cfg.gender, difficulty: 'normal',
  }
}

const tierOf = (s: GameState): number | null => {
  const c = heroClub(s)
  return c ? s.world.leagues[c.leagueId]?.tier ?? null : null
}

/** Reasonable card choice: random among enabled options (seeded), so every branch gets exercised. */
/** Reputation moved by event cards (balance diagnostics). */
export const cardRep = { total: 0 }

function resolveCards(s: GameState, rng: Rng): number {
  let n = 0
  const rep0 = s.hero.reputation
  for (let guard = 0; guard < 10 && s.pendingEvents.length > 0; guard++) {
    const v = describeEvent(s, s.pendingEvents[0], 'en')
    const enabled = v ? v.choices.map((c, i) => (c.enabled ? i : -1)).filter((i) => i >= 0) : [0]
    const pick = enabled.length ? rng.pick(enabled) : 0
    const r = resolveEventChoice(s, 0, pick)
    if (!r.ok && s.pendingEvents.length > 0) s.pendingEvents.splice(0, 1)
    n++
  }
  cardRep.total += s.hero.reputation - rep0
  return n
}

/**
 * Offers: free agent → best club; renewal → sign if the wage holds; transfer →
 * move up (club reputation +6) or for a clearly better wage at a similar club.
 * Loans only when stuck on the bench.
 */
function handleOffers(s: GameState): void {
  const offers = getOffers(s)
  if (!offers.length) return
  const h = s.hero
  const cur = heroClub(s)
  const curRep = cur?.reputation ?? 0
  const curWage = h.contract?.wage ?? 0
  const repOf = (id: string) => s.world.clubs[id]?.reputation ?? 0
  const expiring = !h.contract || h.contract.untilSeason < s.calendar.season + (s.calendar.week >= 40 ? 1 : 0)
  const benched = h.contract?.role === 'youth' || h.contract?.role === 'reserve'
  const scored = offers
    .map((o) => ({ o, score: repOf(o.clubId) * 1000 + o.contract.terms.wage / Math.max(1, curWage) }))
    .sort((a, b) => b.score - a.score)
  for (const { o } of scored) {
    const rep = repOf(o.clubId)
    const wage = o.contract.terms.wage
    let take = false
    if (o.contract.kind === 'freeAgent') take = true
    else if (o.contract.kind === 'renewal') take = wage >= curWage * 0.95 && !scored.some((x) => x.o.contract.kind !== 'renewal' && repOf(x.o.clubId) > curRep + 6)
    else if (o.isLoan) take = benched && rep >= curRep - 10 && heroAge(h, s.calendar.season) <= 21
    else take = rep >= curRep + 6 || (rep >= curRep - 3 && wage >= curWage * 1.5) || (expiring && rep >= curRep - 10)
    if (take && acceptOffer(s, o.id).ok) return
  }
  // Keep the desk tidy: drop what we don't want (renewals stay until signed).
  for (const o of getOffers(s)) if (o.contract.kind !== 'renewal' && o.contract.kind !== 'freeAgent') declineOffer(s, o.id)
}

function weeklyManagement(s: GameState, cfg: CareerConfig, rng: Rng, spent: { assets: number }, onIsland: () => void): void {
  const h = s.hero
  const life = s.life
  // Sponsors: best weekly deal per category.
  for (const o of getSponsorOffers(s).sort((a, b) => b.deal.weekly - a.deal.weekly)) acceptSponsor(s, o.deal.id)
  // Perks: spend points on anything unlockable.
  if (h.perkPoints > 0) for (const p of PERKS) if (h.perkPoints > 0) unlockPerk(s, p.id)
  // Agent: the best tier the hero qualifies for, once it is affordable many times over.
  const want = [5, 4, 3, 2, 1].find((q) => h.reputation >= AGENT_TIERS[q].minReputation && life.money > AGENT_TIERS[q].fee * 4)
  if (want && (life.agent?.quality ?? 0) < want) hireAgent(s, want)
  // Trainer (pro/gambler): a basic one when the fee is pocket money.
  if (!life.trainer && cfg.persona !== 'party' && life.money > 60_000 && s.calendar.slot === 0) {
    const grp = h.position === 'GK' ? 'goalkeeping' : h.position === 'ST' ? 'shooting' : 'physical'
    hireTrainer(s, grp as never, life.money > 400_000 ? 2 : 1)
  }
  // Shopping, monthly.
  if (s.calendar.week % 4 !== 0) return
  const wage = h.contract?.wage ?? 0
  const reserve = wage * 20 + 5_000
  const budgetShare = cfg.persona === 'spender' ? 0.45 : cfg.persona === 'party' ? 0.25 : 0.12
  const budget = (life.money - reserve) * budgetShare
  if (budget <= 1_000) return
  const owned = new Set(life.assets.map((a) => a.defId))
  // Upkeep must stay below a share of the wage (spenders ignore it more).
  const upkeepCap = wage * (cfg.persona === 'spender' ? 0.6 : 0.25)
  const cands = ASSETS.filter((a) => !owned.has(a.id) && a.price <= budget && purchaseBlock(life, h, a.id) === null && assetUpkeep(life) + a.upkeep <= upkeepCap)
    .sort((a, b) => b.price - a.price)
  if (!cands.length) return
  // Spenders buy the priciest toy; others prefer useful things (facilities, houses) near the top of the budget.
  const pick = cfg.persona === 'spender' ? cands[0] : (cands.find((a) => a.category === 'facility' || a.category === 'house' || a.category === 'business') ?? cands[rng.int(0, Math.min(3, cands.length - 1))])
  const before = life.money
  if (buyAsset(s, pick.id).ok) {
    spent.assets += before - life.money
    if (pick.category === 'island') onIsland()
  }
}

/** Gambler evening: a few bets sized to the bankroll. */
function gamble(s: GameState, rng: Rng): void {
  // Same table limit as the UI (casino maxBet ≤ 250K).
  // A heavy gambler sits at the table limit (which grows with the VIP tier, life/casino maxStakeFor).
  const stake = Math.min(250_000, maxStakeFor(s.life), Math.max(50, Math.round((s.life.money * rng.range(0.01, 0.05)) / 50) * 50))
  for (let i = 0; i < rng.int(2, 6); i++) {
    if (s.life.money < stake) break
    const g = rng.int(0, 3)
    if (g === 0) playSlots(s, stake)
    else if (g === 1) playRoulette(s, [{ type: rng.chance(0.5) ? 'red' : 'black', stake }])
    else if (g === 2) {
      const card = horseRaceCard(s).value
      if (card) playHorses(s, rng.int(0, card.horses.length - 1), stake)
    } else {
      const r = blackjackDeal(s, stake)
      let round = r.value
      for (let k = 0; k < 8 && round && !round.finished; k++) round = blackjackAct(s, 'stand').value
    }
  }
}

const NORMAL_TRAINING = ACTIVITY_BY_ID.train_physical ?? ACTIVITY_BY_ID.train_shooting

/** Play one day with the autopilot plan, persona evenings and card answers. Returns cards answered. */
function playDay(s: GameState, cfg: CareerConfig, rng: Rng): number {
  let cards = resolveCards(s, rng)
  const day0 = s.calendar.day
  const week0 = s.calendar.week
  for (let step = 0; step < 4; step++) {
    if (s.calendar.day !== day0 || s.calendar.week !== week0) break
    cards += resolveCards(s, rng)
    const ctx = activityContext(s)
    const plan = autoPlanDay(s.hero, s.life, ctx)[0]
    let id = plan?.activityId ?? 'rest'
    let opts = plan?.options ?? {}
    if (ctx.calendar.slot === 2 && !ctx.matchToday && !ctx.matchTomorrow) {
      const evening = cfg.persona === 'gambler' && rng.chance(0.3) ? 'casino'
        : cfg.persona === 'party' && rng.chance(0.3) ? 'party'
          : cfg.persona === 'spender' && rng.chance(0.08) ? 'party' : null
      if (evening && !activityBlock(s.hero, s.life, ACTIVITY_BY_ID[evening], ctx)) {
        id = evening
        opts = {}
      }
    }
    const r = doActivity(s, id, opts)
    if (id === 'casino' && r.ok) {
      cards += resolveCards(s, rng)
      gamble(s, rng)
      advanceDay(s)
      break
    }
    if (!r.ok) {
      const rest = doActivity(s, 'rest')
      if (!rest.ok) {
        if (s.calendar.slot < 2) s.calendar.slot++
        else advanceDay(s)
      }
    }
  }
  return cards + resolveCards(s, rng)
}

/** Run one career for `cfg.seasons` seasons. */
export function runCareer(cfg: CareerConfig): CareerTrace {
  const s = newGame(careerInput(cfg), cfg.seed)
  const rng = new Rng(cfg.seed ^ 0x5eed)
  const trace: CareerTrace = {
    cfg, samples: [], bankrupt: false, bankruptAt: null, firstTopTierAge: null, firstEliteAge: null, ovr80Age: null, boughtIsland: null, casinoNet: 0, clubs: [],
  }
  const startSeason = s.calendar.season
  const spent = { assets: 0 }
  let acc = freshAcc()
  let topScorer = 0
  let lastCasino = 0
  let lastMoney = s.life.money
  let lastEarned = 0
  let wasInjured = false
  let guard = 0
  const note = () => {
    const age = heroAge(s.hero, s.calendar.season)
    const tier = tierOf(s)
    const club = heroClub(s)
    if (tier === 1 && trace.firstTopTierAge === null) trace.firstTopTierAge = age
    if (club && club.reputation >= 80 && trace.firstEliteAge === null) trace.firstEliteAge = age
    if (heroOvr(s.hero) >= 80 && trace.ovr80Age === null) trace.ovr80Age = age
    if (club && trace.clubs[trace.clubs.length - 1] !== club.name) trace.clubs.push(club.name)
  }
  note()
  while (s.calendar.season < startSeason + cfg.seasons && guard++ < 6000) {
    const week = s.calendar.week
    const season = s.calendar.season
    // Morning bookkeeping.
    if (s.calendar.slot === 0) {
      acc.days++
      {
        const c = heroClub(s)
        for (const pl of c ? squadPlayersOfLeague(s, c.leagueId) : []) if (pl.stats.goals > topScorer) topScorer = pl.stats.goals
      }
      const ctx = activityContext(s)
      if (!s.hero.injury && !ctx.matchToday && NORMAL_TRAINING) {
        const why = activityBlock(s.hero, s.life, NORMAL_TRAINING, ctx, { intensity: 'normal' })
        if (why && /energy/i.test(why.en)) acc.lowEnergyMornings++
      }
      if (isHeroMatchday(s) || ctx.matchToday) acc.clubFixtures++
    }
    const rep0 = s.hero.reputation
    const apps0 = s.hero.careerStats.apps
    const card0 = cardRep.total
    acc.events += playDay(s, cfg, rng)
    const fromCards = cardRep.total - card0
    acc.repCards += fromCards
    const dRep = s.hero.reputation - rep0 - fromCards
    if (s.hero.careerStats.apps > apps0) acc.repMatch += dRep
    else if (s.calendar.week !== week) acc.repWeekly += dRep
    else acc.repOther += dRep
    const repT = s.hero.reputation
    const club0 = s.hero.contract?.clubId
    handleOffers(s)
    acc.repTransfer += s.hero.reputation - repT
    if (s.hero.contract?.clubId !== club0) acc.moves++
    // New week?
    if (s.calendar.week !== week || s.calendar.season !== season) {
      acc.weeks++
      const inj = !!s.hero.injury
      if (inj) acc.weeksInjured++
      if (inj && !wasInjured) acc.injuries++
      wasInjured = inj
      const casinoTotal = s.life.casino.lost - s.life.casino.won
      acc.casino += casinoTotal - lastCasino
      lastCasino = casinoTotal
      acc.upkeep += assetUpkeep(s.life)
      acc.trainer += s.life.trainer?.weeklyFee ?? 0
      const earned = readJson<{ season: number; total: number }>(s.life, GFLAG.earned, { season: s.calendar.season, total: 0 })
      const eNow = earned.total
      const income = eNow >= lastEarned ? eNow - lastEarned : eNow
      lastEarned = eNow
      acc.income += income
      if (s.life.flags.bankrupt === true) {
        trace.bankrupt = true
        trace.bankruptAt ??= {
          age: heroAge(s.hero, s.calendar.season), season: s.calendar.season, week: s.calendar.week, money: Math.round(s.life.money), savings: Math.round(s.life.bank.savings),
          assets: s.life.assets.length, businesses: s.life.businesses?.length ?? 0, loan: Math.round(s.life.bank.loan?.remaining ?? 0), sponsors: s.life.sponsors.length, wage: s.hero.contract?.wage ?? 0,
        }
      }
      if (s.life.money < 0) acc.negativeWeeks++
      const repShop = s.hero.reputation
      weeklyManagement(s, cfg, rng, spent, () => {
        if (!trace.boughtIsland) trace.boughtIsland = { age: heroAge(s.hero, s.calendar.season), reputation: s.hero.reputation }
      })
      acc.repShopping += s.hero.reputation - repShop
      acc.assets += spent.assets
      spent.assets = 0
      // Residual = activities, events, bonuses, transfer money (positive = net spending).
      const delta = s.life.money - lastMoney
      acc.otherNet += delta
      lastMoney = s.life.money
      note()
    }
    if (s.calendar.season !== season) {
      // Sample the finished season.
      const last = s.hero.history[s.hero.history.length - 1]
      const known = acc.income - acc.upkeep - acc.trainer - acc.casino - acc.assets
      trace.samples.push({
        season, age: season - s.hero.birthYear, ovr: heroOvr(s.hero), potential: s.hero.potential, reputation: Math.round(s.hero.reputation),
        tier: tierOf(s), clubRep: heroClub(s)?.reputation ?? null, wage: s.hero.contract?.wage ?? 0, money: Math.round(s.life.money),
        netWorth: Math.round(netWorth(s.life, s.calendar)), trophies: s.hero.trophies.length, apps: last?.stats.apps ?? 0, goals: last?.stats.goals ?? 0, position: s.hero.position, leagueTopScorer: topScorer,
        income: Math.round(acc.income),
        spend: { assets: Math.round(acc.assets), upkeep: Math.round(acc.upkeep), trainer: Math.round(acc.trainer), casino: Math.round(acc.casino), other: Math.round(known - acc.otherNet) },
        injuries: acc.injuries, weeksInjured: acc.weeksInjured, events: acc.events, weeks: acc.weeks, lowEnergyMornings: acc.lowEnergyMornings, days: acc.days,
        clubFixtures: acc.clubFixtures,
        repFrom: { match: acc.repMatch, weekly: acc.repWeekly, other: acc.repOther, cards: acc.repCards, shopping: acc.repShopping, transfer: acc.repTransfer },
        moves: acc.moves, negativeWeeks: acc.negativeWeeks,
      })
      acc = freshAcc()
      topScorer = 0
    }
  }
  trace.casinoNet = Math.round(s.life.casino.lost - s.life.casino.won)
  return trace
}

function squadPlayersOfLeague(s: GameState, leagueId: string) {
  const l = s.world.leagues[leagueId]
  return l ? l.clubIds.flatMap((id) => squadPlayers(s.world, id)) : []
}

function freshAcc() {
  return { days: 0, weeks: 0, events: 0, injuries: 0, weeksInjured: 0, lowEnergyMornings: 0, clubFixtures: 0, income: 0, upkeep: 0, trainer: 0, casino: 0, assets: 0, otherNet: 0, repMatch: 0, repWeekly: 0, repOther: 0, repCards: 0, repShopping: 0, repTransfer: 0, moves: 0, negativeWeeks: 0 }
}

/** The standard 30-career mix used by the report. */
export function standardMix(n = 30, seasons = 10, base = 1000): CareerConfig[] {
  const arch: Archetype[] = ['poacher', 'playmaker', 'winger', 'wall', 'boxToBox', 'keeper']
  const bg: Background[] = ['academy', 'street', 'footballFamily', 'lateBloomer']
  const nat = ['TR', 'EN', 'ES', 'BR', 'DE', 'JP', 'NL', 'US', 'AR', 'FR']
  const personas: Persona[] = ['pro', 'pro', 'spender', 'pro', 'gambler', 'party', 'pro', 'spender', 'gambler', 'pro']
  return Array.from({ length: n }, (_, i) => ({
    seed: base + i * 7919,
    nationality: nat[i % nat.length],
    archetype: arch[i % arch.length],
    background: bg[(i * 3) % bg.length],
    gender: i % 4 === 3 ? 'female' : 'male',
    persona: personas[i % personas.length],
    seasons,
  }))
}
