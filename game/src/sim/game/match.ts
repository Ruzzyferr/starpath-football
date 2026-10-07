/**
 * Hero match flow: build the MatchSetup from world lineups (hero inserted by
 * squad role / selection roll), persist an in-progress match for resume, and
 * apply the finished match to world + career + life.
 *
 * Persistence: the prepared match (and, once started, the serialized MatchSim)
 * lives in `life.flags['g:match']` as JSON; `state.activeMatchId` holds the
 * fixture id while a match is prepared or in progress.
 */
import type { MatchBonuses } from '../career/matchPay'
import type { Club, Competition, Fixture, GameState, Lang, LText, MatchResultSummary, NpcPlayer, Position } from '../../core/types'
import { clamp, Rng } from '../../core/rng'
import { MatchSim } from '../match'
import type { EngineState, MatchSimOptions, MatchPlayer, MatchSetup, MatchTeam, Side, Weather } from '../match'
import { fmtMoney, fill, lt } from '../career/common'
import { applyMatchToHero, type HeroMatchInput } from '../career/matchOutcome'
import { heroOvr } from '../career/progression'
import { rollSelection } from '../career/squadRole'
import { heroMatchAttributes } from '../career/matchPerks'
import { LAST_MATCH_FLAG, heroGoalKinds, updateRecordsAfterMatch, type MatchFeats } from './records'
import { mentalMatchModifier } from '../life/wellbeing'
import { teammateId } from '../life/relationships'
import { deriveAttributes } from '../world/attributes'
import { addGoalCandidate, describeGoal } from '../world/awards'
import { aggregateBefore, finalRound, isDecisiveFixture, isFinalFixture, isKnockoutFixture, isNeutralFixture } from '../world/competitions'
import { positionFamiliarity, selectLineupFromPlayers } from '../world/formations'
import { teamName } from '../world/national'
import { penaltyShootout, QUICKSIM_TUNING } from '../world/quickSim'
import { playerDisplayName, rateLineup, squadPlayers } from '../world/queries'
import { recordFixtureResult } from '../world/season'
import { addNpcBan, refereeFor, serveClubBans } from '../world/referees'
import { copyBook, fadeBook } from '../match/referee'
import type { GoalCandidate } from '../world/worldTypes'
import { rollEvents } from './eventsAdapter'
import {
  GFLAG, heroAvailableFor, heroClub, log, readJson, unplayedHeroFixtureToday, weekCounters, withRng, writeJson,
} from './internal'
import {
  applyNationalMatchToHero, callupFor, nationalKits, nationalTeamSource, teamReputation, type MatchTeamSource,
} from './national'

/** Id of the hero inside MatchSetup / scorers. */
export const HERO_ID = 'hero'

/** Difficulty → highlight difficulty multiplier. */
export const DIFFICULTY_FACTOR = { easy: 0.85, normal: 1, hard: 1.15, legend: 1.3 } as const

interface ActiveMatchBlob {
  fixtureId: string
  compId: string
  setup: MatchSetup
  opts: MatchSimOptions
  starts: boolean
  /** MatchSim.serialize() once started. */
  sim?: string
  /** International: the hero's national team id. */
  national?: string
}

/** What the UI needs to start the hero's match. */
export interface HeroMatchPrep {
  setup: MatchSetup
  opts: MatchSimOptions
  fixture: Fixture
  competition: Competition
  /** Hero starts (false = on the bench). */
  starts: boolean
  isHome: boolean
}

// ───────────────────────── Weather ─────────────────────────

type Climate = 'north' | 'med' | 'tropic'
const CLIMATE: Readonly<Record<string, Climate>> = {
  EN: 'north', DE: 'north', NL: 'north', FR: 'north', TR: 'med', ES: 'med', IT: 'med', PT: 'med', BR: 'tropic', AR: 'tropic', US: 'tropic', JP: 'north',
}

/** Weather by venue country climate and season week (week 0 ≈ August, winter ≈ weeks 15–30). */
/** Seed of a match's private RNG: `fork('match:'+id)` semantics without consuming the career stream. */
export function matchSeed(careerSeed: number, fixtureId: string): number {
  return new Rng(careerSeed).fork(`match:${fixtureId}`).nextUint()
}

export function rollWeather(rng: Rng, countryId: string, week: number): Weather {
  const c = CLIMATE[countryId] ?? 'med'
  const winter = week >= 15 && week <= 30
  const summer = week <= 5 || week >= 36
  const table: [Weather, number][] =
    c === 'north'
      ? winter ? [['snow', 0.12], ['rain', 0.35], ['wind', 0.15]] : [['rain', 0.28], ['wind', 0.1], ['hot', summer ? 0.05 : 0]]
      : c === 'med'
        ? winter ? [['rain', 0.25], ['wind', 0.1], ['snow', 0.03]] : [['hot', summer ? 0.35 : 0.08], ['rain', 0.1], ['wind', 0.06]]
        : [['hot', 0.3], ['rain', 0.25], ['wind', 0.05]]
  let r = rng.next()
  for (const [w, p] of table) {
    if (r < p) return w
    r -= p
  }
  return 'clear'
}

// ───────────────────────── Setup ─────────────────────────

function npcToMatchPlayer(p: NpcPlayer, slot: Position, number: number, relation: number): MatchPlayer {
  return {
    id: p.id, name: playerDisplayName(p, 'short'), number, position: slot, ovr: p.ovr,
    attrs: deriveAttributes(p), isHero: false, relationToHero: relation,
  }
}

function teamMorale(avgMorale: number): number {
  return clamp(0.85 + (avgMorale / 100) * 0.3, 0.8, 1.2)
}

/** A club as a match side. */
function clubSource(state: GameState, club: Club): MatchTeamSource {
  return {
    id: club.id, name: club.name, shortName: club.shortName, colors: club.colors, awayColors: club.awayColors, formation: club.formation,
    style: club.style, players: squadPlayers(state.world, club.id), countryId: club.countryId, reputation: club.reputation, city: club.city,
  }
}

/** Build a MatchTeam; for the hero's club the hero takes the best-fitting slot (or a bench seat). Exported for testimonial matches (sim/game/retirement). */
export function buildTeam(state: GameState, club: Club, heroSide: boolean, starts: boolean, importance = 0): MatchTeam {
  return buildTeamFrom(state, clubSource(state, club), heroSide, starts, importance)
}

/** Build a MatchTeam from any side (club or national team, see national.ts). */
function buildTeamFrom(state: GameState, club: MatchTeamSource, heroSide: boolean, starts: boolean, importance = 0): MatchTeam {
  const w = state.world
  const lineup = selectLineupFromPlayers(club.players, club.formation)
  const ids = [...lineup.playerIds]
  const slots = [...lineup.slots]
  const bench = [...lineup.bench]
  const hero = state.hero
  const rel = (id: string): number => (heroSide ? state.life.relationships[teammateId(id)]?.value ?? 0 : 0)
  if (heroSide && starts) {
    let best = -1
    let bestScore = -Infinity
    slots.forEach((slot, i) => {
      if (i === 0 && hero.position !== 'GK') return
      const score = positionFamiliarity(hero.position, slot) * 100 - (lineup.ratings[i] ?? 0) * 0.5
      if (score > bestScore) { bestScore = score; best = i }
    })
    if (best >= 0) {
      bench.unshift(ids[best])
      ids[best] = HERO_ID
    }
  }
  const mental = mentalMatchModifier(state.life)
  // Perk hook (career/matchPerks): match_* perks become attribute boosts read by the sim and the Phaser runtime.
  const heroAttrs = heroMatchAttributes(hero, { ...hero.attrs, composure: clamp(Math.round(hero.attrs.composure * mental), 1, 99) }, { importance })
  const heroPlayer = (slot: Position): MatchPlayer => ({
    id: HERO_ID, name: hero.nickname || hero.lastName, number: hero.shirtNumber, position: slot, ovr: heroOvr(hero),
    attrs: heroAttrs, isHero: true, relationToHero: 100,
  })
  const used = new Set<number>(heroSide ? [hero.shirtNumber] : [])
  let n = 1
  const nextNumber = (): number => {
    while (used.has(n)) n++
    used.add(n)
    return n
  }
  const byId = new Map(club.players.map((p) => [p.id, p]))
  const npc = (id: string): NpcPlayer => w.players[id] ?? (byId.get(id) as NpcPlayer)
  const xi: MatchPlayer[] = ids.map((id, i) => (id === HERO_ID ? heroPlayer(slots[i]) : npcToMatchPlayer(npc(id), slots[i], nextNumber(), rel(id))))
  let benchPlayers: MatchPlayer[] = bench.slice(0, 7).map((id) => npcToMatchPlayer(npc(id), npc(id).position, nextNumber(), rel(id)))
  if (heroSide && !starts) benchPlayers = [heroPlayer(hero.position), ...benchPlayers.slice(0, 6)]
  return {
    id: club.id, name: club.name, shortName: club.shortName, colors: club.colors, formation: club.formation, style: club.style,
    lineup: xi, bench: benchPlayers, morale: teamMorale(rateLineup(w, lineup).morale),
  }
}

function importanceOf(comp: Competition, fixture: Fixture, home: Pick<Club, 'city'>, away: Pick<Club, 'city'>): number {
  if (isFinalFixture(comp, fixture)) return 1
  if (comp.type === 'international') {
    const f = comp.meta?.format
    return f === 'nt_youth' ? 0.45 : f === 'nt_friendly' ? 0.5 : f === 'nt_qual' ? 0.7 : isKnockoutFixture(comp, fixture) ? 0.95 : 0.85
  }
  if (comp.meta?.format === 'playoff') return 0.9
  let imp = comp.type === 'league' ? 0.4 : comp.type === 'cup' ? 0.4 + 0.5 * (fixture.round / Math.max(1, finalRound(comp))) : 0.7
  if (home.city === away.city) imp += 0.3 // derby
  return clamp(imp, 0, 1)
}

/**
 * Prepare (or return the already prepared) hero match for today. Rolls the
 * selection once (bench streak bookkeeping) and stores the setup so repeated
 * calls and resumes see the same teams. Null when there is no unplayed hero
 * fixture today or the hero is unavailable (injured/suspended/no club).
 */
export function prepareHeroMatch(state: GameState): HeroMatchPrep | null {
  const ref = unplayedHeroFixtureToday(state)
  if (!ref || !heroAvailableFor(state, ref)) return null
  const national = ref.national ? state.world.national?.hero.teamId ?? null : null
  const club = heroClub(state)
  if (!national && !club) return null
  const ownId = national ?? (club as Club).id
  const { competition, fixture } = ref
  const isHome = fixture.homeId === ownId
  const existing = readJson<ActiveMatchBlob | null>(state.life, GFLAG.match, null)
  if (existing && existing.fixtureId === fixture.id) {
    state.activeMatchId = fixture.id
    return { setup: existing.setup, opts: existing.opts, fixture, competition, starts: existing.starts, isHome }
  }
  return withRng(state, (rng) => {
    let starts: boolean
    if (national) {
      // National coach: the higher the call-up meter, the likelier a start.
      const m = callupFor(state, state.world.national?.hero.level ?? 'A').meter
      starts = m >= 72 || rng.chance(0.5 + (m - 55) / 50)
      log(state, [], starts ? lt('Milli takımda ilk 11\'desin.', 'You start for your country.') : lt('Milli maçta yedek kulübesindesin.', 'You are on the bench for your country.'), 'career', '🎽')
    } else {
      const roll = rollSelection(rng, state.hero, state.life)
      for (const l of roll.lines) log(state, [], l, 'career', '🪑')
      starts = roll.starts
    }
    const sel = { starts }
    const home = national ? nationalTeamSource(state, fixture.homeId) : clubSource(state, state.world.clubs[fixture.homeId])
    const away = national ? nationalTeamSource(state, fixture.awayId) : clubSource(state, state.world.clubs[fixture.awayId])
    if (national) away.colors = nationalKits(home, away).away
    const mental = mentalMatchModifier(state.life)
    const base = DIFFICULTY_FACTOR[state.meta.difficulty] ?? 1
    const importance = importanceOf(competition, fixture, home, away)
    const setup: MatchSetup = {
      home: buildTeamFrom(state, home, isHome, sel.starts, importance),
      away: buildTeamFrom(state, away, !isHome, sel.starts, importance),
      // Per-match stream: depends only on the career seed and the fixture, never on unrelated RNG consumption.
      seed: matchSeed(state.meta.seed, fixture.id),
      competitionName: competition.name.en,
      weather: rollWeather(new Rng(state.meta.seed).fork(`weather:${fixture.id}`), home.countryId, fixture.week),
      heroSide: isHome ? 'home' : 'away',
      heroOnBench: !sel.starts,
      // Two-legged ties are settled on aggregate after the second leg (see finishHeroMatch).
      knockout: isDecisiveFixture(competition, fixture),
      neutralVenue: isNeutralFixture(competition, fixture),
      importance,
      difficulty: clamp(base * (1 + (1 - mental) * 0.5), 0.8, 1.4),
      ...(state.world.gender === 'female' ? { gender: 'female' as const } : {}),
      // WP-14: the referee (stable per-country pool, picked by fixture) and the keepers' book on the hero.
      referee: refereeFor(state.meta.seed, home.countryId, fixture.id),
      ...(state.hero.keeperBook ? { keeperBook: copyBook(state.hero.keeperBook) } : {}),
      // The armband: the hero organises the wall at free kicks against (club matches).
      ...(!national && state.hero.contract?.role === 'captain' ? { heroCaptain: true } : {}),
    }
    const opts: MatchSimOptions = { heroForm: state.hero.form, managerTrust: state.hero.managerTrust }
    writeJson(state.life, GFLAG.match, { fixtureId: fixture.id, compId: competition.id, setup, opts, starts: sel.starts, ...(national ? { national } : {}) } satisfies ActiveMatchBlob)
    state.activeMatchId = fixture.id
    return { setup, opts, fixture, competition, starts: sel.starts, isHome }
  })
}

/** Prepare + construct the MatchSim (resuming a saved one if present). */
export function startHeroMatch(state: GameState, lang: Lang = 'en'): MatchSim | null {
  const resumed = resumeHeroMatch(state)
  if (resumed) return resumed
  const prep = prepareHeroMatch(state)
  if (!prep) return null
  const sim = new MatchSim(prep.setup, lang, prep.opts)
  saveMatchProgress(state, sim)
  return sim
}

/** Persist the live match (call on pause / app background / before saving). */
export function saveMatchProgress(state: GameState, sim: MatchSim): void {
  const blob = readJson<ActiveMatchBlob | null>(state.life, GFLAG.match, null)
  if (!blob) return
  blob.sim = sim.serialize()
  writeJson(state.life, GFLAG.match, blob)
}

/** Restore an in-progress match after loading a save (null if none). */
export function resumeHeroMatch(state: GameState): MatchSim | null {
  const blob = readJson<ActiveMatchBlob | null>(state.life, GFLAG.match, null)
  if (!blob?.sim || blob.fixtureId !== state.activeMatchId) return null
  try {
    return MatchSim.restore(blob.sim)
  } catch {
    return null
  }
}

/** Discard a prepared/in-progress match (e.g. corrupted). */
export function clearActiveMatch(state: GameState): void {
  writeJson(state.life, GFLAG.match, null)
  state.activeMatchId = null
}

// ───────────────────────── Finish ─────────────────────────

export interface HeroMatchReport {
  result: MatchResultSummary
  won: boolean
  drew: boolean
  goalsFor: number
  goalsAgainst: number
  rating: number
  minutes: number
  lines: LText[]
  /** Pending events fired by the match. */
  newEvents: number
  /** Contract bonuses paid for this match (club matches only). */
  bonuses?: MatchBonuses
}

/**
 * Apply a finished (or not yet finished: it is simulated to the end with
 * auto-resolved highlights) hero match: fixture result + NPC appearances,
 * hero career/life update, weekly counters, `last_match_goals` flag, events.
 */
export function finishHeroMatch(state: GameState, sim: MatchSim): HeroMatchReport {
  const blob = readJson<ActiveMatchBlob | null>(state.life, GFLAG.match, null)
  if (!blob) throw new Error('finishHeroMatch: no prepared match')
  if (!sim.finished) sim.simulateToEnd(true)
  const snap = sim.snapshot()
  const result = sim.result()
  const side: Side = blob.setup.heroSide ?? 'home'
  const gf = side === 'home' ? result.home : result.away
  const ga = side === 'home' ? result.away : result.home
  let won = gf > ga
  let drew = gf === ga
  if (drew && result.penalties) {
    const pf = side === 'home' ? result.penalties.home : result.penalties.away
    const pa = side === 'home' ? result.penalties.away : result.penalties.home
    won = pf > pa
    drew = false
  }
  const st = snap.heroStats
  const lines: LText[] = []

  return withRng(state, (rng) => {
    // ── World: fixture result + NPC appearances ──
    const engine = JSON.parse(sim.serialize()) as EngineState
    const ratings: Record<string, number> = {}
    for (const p of Object.values(engine.players)) {
      if (p.id === HERO_ID || !p.played || !state.world.players[p.id]) continue
      ratings[p.id] = clamp(6.3 + p.goals * 0.7 + p.assists * 0.4 - (p.red ? 1.5 : 0), 3, 10)
    }
    const compX = state.world.competitions[blob.compId]
    const fixtureX = compX?.fixtures.find((f) => f.id === blob.fixtureId)
    // Assists (Player of the Month / awards) from the goal events, in scorer order.
    const goalEvs = snap.events.filter((e) => e.type === 'goal')
    if (goalEvs.length === result.scorers.length && goalEvs.some((e) => e.assistId)) result.assists = goalEvs.map((e) => e.assistId ?? null)
    // Second leg level on aggregate: extra time and penalties are settled after the live 90'.
    if (compX && fixtureX?.leg === 2 && settleSecondLeg(rng, compX, fixtureX, result, blob.setup)) {
      const pf = side === 'home' ? result.penalties?.home ?? 0 : result.penalties?.away ?? 0
      const pa = side === 'home' ? result.penalties?.away ?? 0 : result.penalties?.home ?? 0
      const f2 = side === 'home' ? result.home : result.away
      const a2 = side === 'home' ? result.away : result.home
      won = f2 > a2 || (f2 === a2 && pf > pa)
      drew = false
    }
    recordFixtureResult(state.world, rng, blob.compId, blob.fixtureId, result, ratings)
    // ── Discipline (WP-14): club bans are served, then this match's reds ban NPCs for 1..3 matches ──
    if (!blob.national) {
      serveClubBans(state.world, blob.setup.home.id)
      serveClubBans(state.world, blob.setup.away.id)
      for (const p of Object.values(engine.players)) {
        const npc = p.id === HERO_ID ? undefined : state.world.players[p.id]
        if (!npc) continue
        if (p.yellow > 0 && !p.red) npc.stats.yellow++
        if (p.red) npc.stats.red++
        addNpcBan(npc, { red: p.red, ban: p.ban, yellowAdded: p.yellow > 0 && !p.red }, `${p.id}:${blob.fixtureId}`)
      }
    }
    // Keepers' book on the hero: this match's attempts, older habits fading.
    if (engine.hero.book) state.hero.keeperBook = fadeBook(engine.hero.book)
    if (compX && fixtureX) nominateHeroGoals(state, compX, fixtureX, snap.events, st.rating)

    // ── Hero ──
    const goalEvents = snap.events.filter((e) => e.type === 'goal')
    const assistedBy = goalEvents.filter((e) => e.playerId === HERO_ID && e.assistId && e.assistId !== HERO_ID).map((e) => e.assistId as string)
    const assistedTo = goalEvents.filter((e) => e.assistId === HERO_ID && e.playerId && e.playerId !== HERO_ID).map((e) => e.playerId as string)
    const injured = snap.events.some((e) => e.type === 'injury' && e.playerId === HERO_ID)
    const opp = side === 'home' ? blob.setup.away : blob.setup.home
    const oppClub = state.world.clubs[opp.id]
    if (blob.national && compX) {
      // ── International: caps, goals, national relations (club stats untouched) ──
      const natLines = applyNationalMatchToHero(state, rng, {
        teamId: blob.national, oppId: opp.id, comp: compX, rating: st.minutes > 0 ? st.rating : 0, minutes: st.minutes, goals: st.goals,
        assists: st.assists, won, drew, gf, ga, motm: result.motmId === HERO_ID, injured, importance: blob.setup.importance,
      })
      for (const l of natLines) log(state, lines, l, 'match', '🎽')
      const wkN = weekCounters(state.life)
      wkN.matches++
      wkN.minutes += st.minutes
      if (st.minutes > 0) { wkN.ratingSum += st.rating; wkN.rated++ }
      wkN.contributions += st.goals + st.assists
      writeJson(state.life, GFLAG.week, wkN)
      state.life.flags.last_match_goals = st.goals
      clearActiveMatch(state)
      state.calendar.slot = Math.max(state.calendar.slot, 2)
      const beforeN = state.pendingEvents.length
      const tagsN = ['post_match', won ? 'match_win' : drew ? 'match_draw' : 'match_loss', 'national_match']
      if (st.goals > 0) tagsN.push('scored')
      rollEvents(state, rng, tagsN, 1)
      if (state.hero.injury && injured) rollEvents(state, rng, ['injury'], 1)
      return { result, won, drew, goalsFor: gf, goalsAgainst: ga, rating: st.rating, minutes: st.minutes, lines, newEvents: state.pendingEvents.length - beforeN }
    }
    const input: HeroMatchInput = {
      rating: st.minutes > 0 ? st.rating : 0,
      goals: st.goals, assists: st.assists, minutes: st.minutes, started: blob.starts, won, drew,
      importance: blob.setup.importance, shots: st.shots, shotsOnTarget: st.shotsOnTarget, passes: st.passes,
      passesCompleted: st.passesCompleted, tackles: st.tackles, dribbles: st.dribbles, saves: st.saves,
      cleanSheet: ga === 0, yellow: st.yellow, red: st.red > 0, ...(st.ban ? { ban: st.ban } : {}), motm: result.motmId === HERO_ID, injured,
      isAway: side === 'away', opponentName: opp.name, opponentReputation: oppClub?.reputation ?? teamReputation(state, opp.id),
      assistedBy, assistedTo,
    }
    const applied = applyMatchToHero(state, input, rng)
    lines.push(...applied.lines)

    // ── Feats & records (sim/game/records; the achievement checker reads c:lastMatch) ──
    const kinds = heroGoalKinds(snap.events, side, HERO_ID)
    const comp = state.world.competitions[blob.compId]
    const feats: MatchFeats = {
      fixtureId: blob.fixtureId, season: state.calendar.season, week: state.calendar.week, compType: comp?.type ?? 'league',
      final: blob.setup.neutralVenue, opponent: opp.name, opponentReputation: oppClub?.reputation ?? 50, minutes: st.minutes,
      started: blob.starts, goals: st.goals, assists: st.assists, freeKickGoals: kinds.freeKick,
      penaltyGoals: result.scorers.filter((x) => x.playerId === HERO_ID && x.penalty).length, headerGoals: kinds.header,
      rating: st.minutes > 0 ? st.rating : 0, motm: !!input.motm, won, drew, goalsFor: gf, goalsAgainst: ga, cleanSheet: ga === 0,
      saves: st.saves, isKeeper: state.hero.position === 'GK', red: !!input.red, injured,
    }
    writeJson(state.life, LAST_MATCH_FLAG, feats)
    updateRecordsAfterMatch(state, feats)

    // ── Counters & flags ──
    const wk = weekCounters(state.life)
    wk.matches++
    wk.minutes += st.minutes
    if (st.minutes > 0) { wk.ratingSum += st.rating; wk.rated++ }
    wk.contributions += st.goals + st.assists
    writeJson(state.life, GFLAG.week, wk)
    state.life.flags.last_match_goals = st.goals
    clearActiveMatch(state)
    // The match took the afternoon: only the evening slot is left.
    state.calendar.slot = Math.max(state.calendar.slot, 2)

    // ── Events ──
    const before = state.pendingEvents.length
    const tags = ['post_match', won ? 'match_win' : drew ? 'match_draw' : 'match_loss']
    if (st.goals > 0) tags.push('scored')
    if (!blob.starts) tags.push('benched')
    rollEvents(state, rng, tags, 1)
    if (state.hero.injury && injured) rollEvents(state, rng, ['injury'], 1)
    const wage = state.hero.contract?.wage ?? 0
    if (applied.bonusPaid > 0 && applied.bonusPaid >= wage * 2) {
      log(state, lines, fill(lt('Büyük prim: {m}', 'Big payday: {m}'), { m: fmtMoney(applied.bonusPaid) }), 'money', '💰')
      rollEvents(state, rng, ['big_money'], 1)
    }
    return {
      result, won, drew, goalsFor: gf, goalsAgainst: ga, rating: st.rating, minutes: st.minutes, lines,
      newEvents: state.pendingEvents.length - before, bonuses: applied.bonuses,
    }
  })
}

/**
 * Second leg of a two-legged tie that ended level on aggregate after 90':
 * extra time (a third of the 90-minute goal rate, from both lineups' OVR) and
 * a penalty shootout. Mutates `result`; returns true when it went beyond 90'.
 */
function settleSecondLeg(rng: Rng, comp: Competition, fixture: Fixture, result: MatchResultSummary, setup: MatchSetup): boolean {
  const agg = aggregateBefore(comp, fixture)
  if (!agg || result.home + agg.home !== result.away + agg.away || result.penalties) return false
  const avg = (t: MatchTeam) => t.lineup.reduce((s, p) => s + p.ovr, 0) / Math.max(1, t.lineup.length)
  const ho = avg(setup.home)
  const ao = avg(setup.away)
  const rate = QUICKSIM_TUNING.baseGoals * QUICKSIM_TUNING.extraTimeFraction
  const eh = rng.poisson(rate * Math.exp(QUICKSIM_TUNING.strengthK * (ho - ao)) * 1.05)
  const ea = rng.poisson(rate * Math.exp(QUICKSIM_TUNING.strengthK * (ao - ho)) * 0.95)
  const pick = (t: MatchTeam): string => {
    const outfield = t.lineup.filter((p) => p.position !== 'GK')
    return rng.weighted(outfield.length ? outfield : t.lineup, (p) => (['ST', 'LW', 'RW', 'AM'].includes(p.position) ? 3 : 1)).id
  }
  for (let i = 0; i < eh; i++) result.scorers.push({ minute: rng.int(91, 120), playerId: pick(setup.home), team: 'home' })
  for (let i = 0; i < ea; i++) result.scorers.push({ minute: rng.int(91, 120), playerId: pick(setup.away), team: 'away' })
  if (result.assists) result.assists = [...result.assists, ...Array.from({ length: eh + ea }, () => null)]
  result.home += eh
  result.away += ea
  result.extraTime = true
  if (result.home + agg.home === result.away + agg.away) result.penalties = penaltyShootout(rng, ho, ao)
  return true
}

/** Nominate the hero's goals for Goal of the Season (descriptor from the goal's build-up events). */
function nominateHeroGoals(state: GameState, comp: Competition, fixture: Fixture, events: readonly { type: string; minute: number; playerId?: string }[], rating: number): void {
  const h = state.hero
  const ownId = state.world.national?.hero.teamId && (fixture.homeId === state.world.national.hero.teamId || fixture.awayId === state.world.national.hero.teamId)
    ? state.world.national.hero.teamId : h.contract?.clubId ?? ''
  events.forEach((e, i) => {
    if (e.type !== 'goal' || e.playerId !== HERO_ID) return
    const before = events.slice(Math.max(0, i - 3), i).filter((x) => x.minute === e.minute).map((x) => x.type)
    if (before.includes('penalty')) return
    const kind: GoalCandidate['kind'] | undefined = before.includes('freekick') ? 'free_kick' : before.includes('corner') ? 'header' : undefined
    const d = describeGoal(fixture.id, e.minute, HERO_ID, { kind, quality: clamp((rating - 6.5) * 0.3, -0.5, 1) + (comp.type === 'league' ? 0 : 0.25) })
    if (!d) return
    const teamId = fixture.homeId === ownId ? fixture.homeId : fixture.awayId
    addGoalCandidate(state.world, {
      playerId: HERO_ID, name: `${h.firstName} ${h.lastName}`, teamId, oppId: teamId === fixture.homeId ? fixture.awayId : fixture.homeId,
      compName: { ...comp.name }, season: comp.season, week: fixture.week, minute: e.minute, ...d, isHero: true,
    })
  })
}

/** Display name of any match side (club or national team). */
export function sideName(state: GameState, id: string): string {
  return state.world.clubs[id]?.name ?? teamName(id).en
}

/** Play today's hero match entirely in the sim (auto-resolved highlights). Null if none. */
export function autoPlayHeroMatch(state: GameState, lang: Lang = 'en'): HeroMatchReport | null {
  const sim = startHeroMatch(state, lang)
  if (!sim) return null
  sim.simulateToEnd(true)
  return finishHeroMatch(state, sim)
}
