/**
 * Butterfly-effect chain tests (owner principle: "even the smallest matter
 * must have an effect somewhere"). Each scenario clones ONE career (same seed),
 * changes ONE small action, plays both copies forward with identical inputs and
 * asserts the downstream effect weeks later against the control copy.
 */
import { describe, expect, it } from 'vitest'
import type { GameState } from '../../core/types'
import { Rng } from '../../core/rng'
import { absWeek } from '../career/common'
import { applyMatchToHero } from '../career/matchOutcome'
import { startProbability, weeklyTrustTick } from '../career/squadRole'
import { trainingInjuryChance } from '../career/training'
import { weeklySharpnessDecay } from '../career/condition'
import { weeklyAging } from '../career/progression'
import { outcomeProbabilities } from '../match/autoResolve'
import { MatchSim } from '../match'
import { performActivity } from '../life/activities'
import { visitCasino, weeklyCasinoTick } from '../life/casino'
import { weeklyBusinessTick, openBusiness } from '../life/business'
import { changeRelation, teammateAverage, teammateId } from '../life/relationships'
import { sponsorOfferChance, sponsorImage } from '../life/sponsors'
import { makePost } from '../life/social'
import { buildAcademyStage, academyLevel, weeklyProjectsTick } from '../life/projects'
import { dressingRoomChemistry, luxuryReaction, negotiationLeverage, preMatchCondition, recentLuxury, weeklyClimate } from '../life/butterfly'
import { mentalMatchModifier, weeklyWellbeing } from '../life/wellbeing'
import { ASSETS } from '../../data/assets'
import { advanceDay } from './calendar'
import { callupFor } from './national'
import { legacyStartFrom } from './legacy'
import { activityContext, absDayOf } from './internal'
import { buyAsset, doActivity, firstEnabledChoice, resolveEventChoice, startNegotiation } from './actions'
import { prepareHeroMatch, clearActiveMatch, preMatchCauses } from './match'
import { whyPlaying } from './whyPlaying'
import { getOffers } from './season'
import { makeGame } from './testHelpers'

const clone = <T>(x: T): T => structuredClone(x)
const ADULT = { birthYear: 2004 } as const

/** Resolve pending cards with their first choice (same for both copies). */
function settle(s: GameState): void {
  for (let g = 0; g < 20 && s.pendingEvents.length; g++) resolveEventChoice(s, 0, firstEnabledChoice(s, 0))
}

/** Advance (autoplaying matches) until tomorrow is a hero matchday; evening slot. */
function toMatchEve(s: GameState): void {
  for (let i = 0; i < 80; i++) {
    settle(s)
    const ctx = activityContext(s)
    if (ctx.matchTomorrow && !ctx.matchToday && !s.hero.injury && s.hero.suspendedMatches === 0) break
    advanceDay(s)
  }
  settle(s)
  s.calendar.slot = 2
}

/** Pair of identical careers at the eve of a match. */
function evePair(seed: number): [GameState, GameState] {
  const a = makeGame(seed, ADULT)
  toMatchEve(a)
  return [a, clone(a)]
}

describe('butterfly chains (one small action vs control, same seed)', () => {
  it('(a) a casino night before a match → tired start, lower start chance, worse match', () => {
    const [ctrl, bet] = evePair(31)
    expect(doActivity(ctrl, 'rest').ok).toBe(true)
    expect(doActivity(bet, 'casino').ok).toBe(true)
    if (bet.calendar.slot >= 2) advanceDay(bet)
    while (ctrl.calendar.day !== bet.calendar.day || ctrl.calendar.week !== bet.calendar.week) advanceDay(ctrl)
    // Match morning: the manager's "why" panel names the night out.
    expect(startProbability(bet.hero, bet.life, absDayOf(bet))).toBeLessThan(startProbability(ctrl.hero, ctrl.life, absDayOf(ctrl)))
    expect(whyPlaying(bet)!.factors.some((f) => f.key === 'night')).toBe(true)
    const cb = preMatchCondition(bet.hero, bet.life, absDayOf(bet))
    const cc = preMatchCondition(ctrl.hero, ctrl.life, absDayOf(ctrl))
    expect(cb.startFatigue).toBeGreaterThan(cc.startFatigue)
    expect(cb.causes.some((c) => c.key === 'night' && /kumarhane/.test(c.label.tr))).toBe(true)
    // The prepared match carries the tired legs, and the post-match screen gets the cause.
    const prep = prepareHeroMatch(bet)
    expect(prep).not.toBeNull()
    expect(prep!.opts.heroStartFatigue ?? 0).toBeGreaterThan(0)
    expect(preMatchCauses(bet, prep!.fixture.id).some((c) => c.key === 'night')).toBe(true)
    // Same match, same seeds: tired legs cost rating over a run of matches.
    const setup = { ...prep!.setup, heroOnBench: false }
    let fresh = 0
    let tired = 0
    for (let i = 0; i < 24; i++) {
      const s = { ...setup, seed: 5000 + i }
      fresh += new MatchSim(s, 'en', { ...prep!.opts, heroStartFatigue: 0 }).simulateToEnd().heroStats.rating
      tired += new MatchSim(s, 'en', { ...prep!.opts, heroStartFatigue: 0.3 }).simulateToEnd().heroStats.rating
    }
    expect(tired).toBeLessThan(fresh)
    clearActiveMatch(bet)
  })

  it('(b) skipping the family on mum’s birthday → family ↓ → happiness ↓ → composure ↓ → penalties ↓', () => {
    const a = makeGame(41, ADULT)
    const skip = clone(a)
    a.calendar.slot = 2
    skip.calendar.slot = 2
    expect(performActivity(new Rng(1), a.hero, a.life, 'family_visit', activityContext(a)).ok).toBe(true)
    // The birthday objective's penalty when the visit never happens (objectives: rel −8, happiness −3).
    changeRelation(skip.life, 'mother', -8, { cause: 'other' })
    skip.life.happiness -= 3
    for (let w = 0; w < 4; w++) for (const s of [a, skip]) weeklyWellbeing(s.life, s.hero, {})
    expect(skip.life.relationships.mother!.value).toBeLessThan(a.life.relationships.mother!.value)
    expect(skip.life.happiness).toBeLessThan(a.life.happiness)
    expect(mentalMatchModifier(skip.life)).toBeLessThan(mentalMatchModifier(a.life))
    // Penalty conversion as the match sees it: composure × mental modifier, difficulty raised by a shaky mind (game/match).
    const pens = (s: GameState): number => {
      const m = mentalMatchModifier(s.life)
      const attrs = { ...s.hero.attrs, composure: Math.round(s.hero.attrs.composure * m) }
      return outcomeProbabilities('penalty', attrs, 1 + (1 - m) * 0.5).goal ?? 0
    }
    expect(pens(skip)).toBeLessThan(pens(a))
  })

  it('(c) a supercar for a youngster → headline, followers, jealous teammates, discipline', () => {
    const a = makeGame(51)
    a.life.money = 5_000_000
    a.calendar.week = 12
    const buy = clone(a)
    const car = ASSETS.filter((d) => d.category === 'car').sort((p, q) => q.price - p.price)[0]!
    const news0 = buy.life.news.length
    const lines = luxuryReaction(new Rng(3), buy.hero, buy.life, car, buy.calendar, true)
    expect(lines.length).toBeGreaterThan(0)
    expect(buy.life.news.length).toBe(news0 + 1)
    expect(buy.life.followers).toBeGreaterThan(a.life.followers)
    expect(teammateAverage(buy.life)).toBeLessThan(teammateAverage(a.life))
    expect(buy.life.discipline).toBeLessThan(a.life.discipline)
    // The ledger explains the drop to the player.
    const mate = Object.values(buy.life.relationships).find((r) => r.kind === 'teammate')!
    expect(mate.log?.[0]?.why.tr).toMatch(/kıskançlığı/)
  })

  it('(d) arguing with a teammate → he feeds the hero less (passes and assists)', () => {
    let ctrl: GameState | null = null
    let row: GameState | null = null
    let prepC: ReturnType<typeof prepareHeroMatch> = null
    for (let seed = 61; seed < 100 && !prepC; seed++) {
      const [c, r] = evePair(seed)
      advanceDay(c)
      advanceDay(r)
      const p = prepareHeroMatch(c)
      if (p?.starts) { ctrl = c; row = r; prepC = p }
    }
    expect(prepC).not.toBeNull()
    const side = prepC!.setup.heroSide!
    const mate = prepC!.setup[side].lineup.find((p) => !p.isHero && p.position !== 'GK')!
    // The row: one heated argument in training (relationship −90 with that teammate).
    changeRelation(row!.life, teammateId(mate.id), -90, { cause: 'event' })
    const prepR = prepareHeroMatch(row!)!
    expect(prepR.starts).toBe(true)
    const mateR = prepR.setup[side].lineup.find((p) => p.id === mate.id)!
    expect(mateR.relationToHero).toBeLessThan(mate.relationToHero)
    let fromC = 0
    let fromR = 0
    for (let i = 0; i < 12; i++) {
      fromC += new MatchSim({ ...prepC!.setup, seed: 7000 + i }, 'en', prepC!.opts).simulateToEnd().passNet?.[mate.id]?.from ?? 0
      fromR += new MatchSim({ ...prepR.setup, seed: 7000 + i }, 'en', prepR.opts).simulateToEnd().passNet?.[mate.id]?.from ?? 0
    }
    expect(fromC).toBeGreaterThan(0)
    expect(fromR).toBeLessThan(fromC)
    void ctrl
  })

  it('(e) playing through an injury (aggravated) → longer lay-off, health ↓ → national call-up meter ↓', () => {
    const a = makeGame(71, ADULT)
    a.hero.injury = { name: { tr: 'Darbe', en: 'Knock' }, severity: 1, weeksLeft: 2 }
    const jab = clone(a)
    // Painkiller injection gone wrong (health.painkiller_injection, failed roll): +5 weeks, health −10.
    jab.hero.injury = { name: { tr: 'Tekrarlayan sakatlık', en: 'Aggravated injury' }, severity: 2, weeksLeft: 5 }
    jab.life.health -= 10
    for (let w = 0; w < 3; w++) {
      for (const s of [a, jab]) {
        weeklyWellbeing(s.life, s.hero, {})
        if (s.hero.injury) { s.hero.injury.weeksLeft -= 1; if (s.hero.injury.weeksLeft <= 0) s.hero.injury = null }
      }
    }
    expect(jab.hero.injury).not.toBeNull()
    expect(a.hero.injury).toBeNull()
    expect(callupFor(jab, 'A').meter).toBeLessThanOrEqual(callupFor(a, 'A').meter)
    expect(preMatchCondition(jab.hero, jab.life, absDayOf(jab)).proneness).toBeGreaterThan(preMatchCondition(a.hero, a.life, absDayOf(a)).proneness)
  })

  it('(f) extra hard training instead of rest → fatigue → injury risk ↑ and a tired match start', () => {
    const [rest, grind] = evePair(81)
    rest.calendar.slot = 1
    grind.calendar.slot = 1
    const ctx = (s: GameState) => ({ ...activityContext(s), matchTomorrow: false })
    performActivity(new Rng(5), rest.hero, rest.life, 'rest', ctx(rest))
    performActivity(new Rng(5), grind.hero, grind.life, 'train_physical', ctx(grind), { trainingType: 'physical', intensity: 'hard', performance: 0.6 })
    expect(grind.hero.fatigue).toBeGreaterThan(rest.hero.fatigue)
    expect(trainingInjuryChance(grind.hero, grind.life, 'physical', 'hard')).toBeGreaterThan(trainingInjuryChance(rest.hero, rest.life, 'physical', 'hard'))
    grind.hero.fatigue = Math.max(grind.hero.fatigue, 70)
    expect(preMatchCondition(grind.hero, grind.life, absDayOf(grind)).startFatigue).toBeGreaterThan(preMatchCondition(rest.hero, rest.life, absDayOf(rest)).startFatigue)
  })

  it('(g) accepting the armband → leadership grows faster, the team bonds', () => {
    const a = makeGame(91, ADULT)
    a.hero.attrs.leadership = 72
    const cap = clone(a)
    cap.hero.contract!.role = 'captain'
    a.hero.contract!.role = 'starter'
    const xp0 = a.hero.attrXp.leadership ?? 0
    const m = { minutes: 90, rating: 7, goals: 0, assists: 0, won: true, drew: false, started: true, importance: 0.4, isAway: false }
    for (let i = 0; i < 6; i++) {
      applyMatchToHero(a, m as never, new Rng(10 + i))
      applyMatchToHero(cap, m as never, new Rng(10 + i))
    }
    const lead = (s: GameState) => s.hero.attrs.leadership + (s.hero.attrXp.leadership ?? 0) / 100
    expect(lead(cap)).toBeGreaterThan(lead(a))
    expect(lead(a)).toBeGreaterThanOrEqual(72 + xp0 / 100)
    expect(dressingRoomChemistry(cap.hero, cap.life).mult).toBeGreaterThan(dressingRoomChemistry(a.hero, a.life).mult)
  })

  it('(h) a provocative post that backfires → press, fans, discipline, sponsor image ↓', () => {
    let ctrl: GameState | null = null
    let spat: GameState | null = null
    const base = makeGame(101, ADULT)
    base.life.followers = 250_000
    for (let seed = 1; seed < 200 && !spat; seed++) {
      const b = clone(base)
      if (makePost(new Rng(seed), b.hero, b.life, 'provocation', { calendar: b.calendar }).controversy) { ctrl = clone(base); spat = b }
    }
    expect(spat).not.toBeNull()
    expect(spat!.life.discipline).toBeLessThan(ctrl!.life.discipline)
    expect(spat!.life.relationships.press!.value).toBeLessThan(ctrl!.life.relationships.press!.value)
    expect(sponsorImage(spat!.life)).toBeLessThan(sponsorImage(ctrl!.life))
    expect(spat!.life.news.length).toBeGreaterThan(ctrl!.life.news.length)
  })

  it('(i) building the academy → fans and fame every week → a head start for the legacy child', () => {
    const a = makeGame(111, ADULT)
    a.life.money = 10_000_000
    const acad = clone(a)
    expect(buildAcademyStage(acad.life).ok).toBe(true)
    expect(academyLevel(acad.life)).toBe(1)
    for (let w = 0; w < 26; w++) {
      const cal = { ...a.calendar, week: 1 + w }
      weeklyProjectsTick(a.life, a.hero, cal)
      weeklyProjectsTick(acad.life, acad.hero, cal)
    }
    expect(acad.hero.reputation).toBeGreaterThan(a.hero.reputation)
    const entry = { careerId: 'x', name: 'X', gender: 'male' as const, legacyScore: 600, netWorth: 1_000_000 }
    expect(legacyStartFrom({ ...entry, academyLevel: academyLevel(acad.life) }).reputationBonus)
      .toBeGreaterThan(legacyStartFrom({ ...entry, academyLevel: academyLevel(a.life) }).reputationBonus)
  })

  it('(j) a gambling streak → addiction → stress → shakier composure', () => {
    const a = makeGame(121, ADULT)
    const gam = clone(a)
    const rng = new Rng(4)
    for (let w = 0; w < 6; w++) {
      for (let v = 0; v < 4; v++) visitCasino(rng, gam.life, gam.hero, { calendar: gam.calendar, inSeason: false, matchTomorrow: false })
      for (const s of [a, gam]) {
        weeklyCasinoTick(s.life, s.hero)
        weeklyWellbeing(s.life, s.hero, {})
      }
    }
    expect(gam.life.casino.addiction).toBeGreaterThan(a.life.casino.addiction)
    expect(gam.life.stress).toBeGreaterThan(a.life.stress)
    expect(mentalMatchModifier(gam.life)).toBeLessThan(mentalMatchModifier(a.life))
  })

  it('(k) a hostile press (public complaint) → weekly media stress', () => {
    const a = makeGame(131, ADULT)
    a.life.followers = 400_000
    const loud = clone(a)
    changeRelation(loud.life, 'press', -70, { cause: 'interview' })
    const lines = weeklyClimate(loud.hero, loud.life, loud.calendar)
    weeklyClimate(a.hero, a.life, a.calendar)
    expect(loud.life.stress).toBeGreaterThan(a.life.stress)
    expect(lines.some((l) => /Basın/.test(l.tr))).toBe(true)
  })

  it('(l) an unmanaged business in the red → stress', () => {
    const a = makeGame(141, ADULT)
    a.life.money = 5_000_000
    a.hero.reputation = 60
    expect(openBusiness(a.life, a.hero, 'restaurant', a.calendar).ok).toBe(true)
    const red = clone(a)
    red.life.businesses![0]!.brand = 0
    red.life.businesses![0]!.boost = { mult: 0.1, weeks: 4 }
    weeklyBusinessTick(new Rng(7), a.life, a.hero, a.calendar)
    weeklyBusinessTick(new Rng(7), red.life, red.hero, red.calendar)
    expect(red.life.businesses![0]!.history[0]!.profit).toBeLessThan(a.life.businesses![0]!.history[0]!.profit)
    expect(red.life.stress).toBeGreaterThan(a.life.stress)
  })

  it('(m) a won award → more leverage at the negotiating table; a fallen-out agent → less', () => {
    const a = makeGame(151, ADULT)
    const star = clone(a)
    star.hero.awards.push({ season: star.calendar.season, key: 'top_scorer', name: { tr: 'Gol Kralı', en: 'Top Scorer' } })
    const base = negotiationLeverage(a.hero, a.life, a.calendar.season, true)
    const won = negotiationLeverage(star.hero, star.life, star.calendar.season, true)
    expect(won.headroom).toBeGreaterThan(base.headroom)
    expect(won.causes.some((c) => c.key === 'awards')).toBe(true)
    a.life.agent = { name: 'Ajan', quality: 3, commission: 0.08 }
    a.life.relationships.agent = { id: 'agent', kind: 'agent', name: 'Ajan', value: -60, memory: [], lastContactWeek: 0 }
    const sour = negotiationLeverage(a.hero, a.life, a.calendar.season, true)
    expect(sour.headroom).toBeLessThan(base.headroom)
    expect(sour.patience).toBeLessThan(0)
  })

  it('(n) poor conduct (discipline) → fewer starts and a lower national call-up meter', () => {
    const a = makeGame(161, ADULT)
    const bad = clone(a)
    bad.life.discipline = 15
    expect(startProbability(bad.hero, bad.life)).toBeLessThan(startProbability(a.hero, a.life))
    expect(callupFor(bad, 'A').meter).toBeLessThan(callupFor(a, 'A').meter)
    expect(whyPlaying(bad)!.factors.some((f) => f.key === 'conduct') || startProbability(bad.hero, bad.life) === 0).toBe(true)
  })

  it('(o) a cold dressing room → weaker team chemistry and loneliness stress', () => {
    const a = makeGame(171, ADULT)
    const cold = clone(a)
    for (const r of Object.values(cold.life.relationships)) if (r.kind === 'teammate') changeRelation(cold.life, r.id, -60, { cause: 'event' })
    expect(dressingRoomChemistry(cold.hero, cold.life).mult).toBeLessThan(dressingRoomChemistry(a.hero, a.life).mult)
    weeklyClimate(cold.hero, cold.life, cold.calendar)
    weeklyClimate(a.hero, a.life, a.calendar)
    expect(cold.life.stress).toBeGreaterThan(a.life.stress)
    expect(cold.hero.morale).toBeLessThan(a.hero.morale)
  })

  it('(p) more followers → sponsors call more often', () => {
    const a = makeGame(181, ADULT)
    const famous = clone(a)
    famous.life.followers = 2_000_000
    expect(sponsorOfferChance(famous.hero, famous.life, a.calendar.season)).toBeGreaterThan(sponsorOfferChance(a.hero, a.life, a.calendar.season))
  })

  it('(q) low manager trust → benched → no minutes → sharpness falls → rusty in the next match', () => {
    const a = makeGame(191, ADULT)
    const out = clone(a)
    out.hero.managerTrust = 10
    expect(startProbability(out.hero, out.life)).toBeLessThan(startProbability(a.hero, a.life))
    for (let w = 0; w < 6; w++) {
      weeklySharpnessDecay(a.hero, 90)
      weeklySharpnessDecay(out.hero, 0)
      weeklyTrustTick(out.hero, out.life)
    }
    expect(out.hero.sharpness).toBeLessThan(a.hero.sharpness)
    expect(preMatchCondition(out.hero, out.life, absDayOf(out)).rustMult).toBeLessThan(preMatchCondition(a.hero, a.life, absDayOf(a)).rustMult)
  })

  it('(r) a family home → family and partner warmer → happier weeks', () => {
    const a = makeGame(201, ADULT)
    const home = clone(a)
    const house = ASSETS.find((d) => d.category === 'house')!
    luxuryReaction(new Rng(1), home.hero, home.life, house, home.calendar, true)
    expect(home.life.relationships.mother?.value ?? home.life.relationships.father!.value)
      .toBeGreaterThan(a.life.relationships.mother?.value ?? a.life.relationships.father!.value)
    for (let w = 0; w < 4; w++) for (const s of [a, home]) weeklyWellbeing(s.life, s.hero, {})
    expect(home.life.happiness).toBeGreaterThanOrEqual(a.life.happiness)
  })

  it('(s) age → physical attributes decline, reading of the game holds', () => {
    const a = makeGame(211, { birthYear: 1990 })
    const before = { ...a.hero.attrs }
    for (let w = 0; w < 44; w++) weeklyAging(a.hero, a.calendar.season)
    const drop = (k: keyof typeof before) => before[k] - a.hero.attrs[k]
    expect(drop('pace')).toBeGreaterThan(0)
    expect(drop('pace')).toBeGreaterThan(drop('vision'))
  })

  it('(t) an unhappy partner crisis → stress weeks later', () => {
    const a = makeGame(221, ADULT)
    a.life.relationships.partner = { id: 'partner', kind: 'partner', name: 'Selin', value: 40, memory: [], lastContactWeek: absWeek(a.calendar) }
    const crisis = clone(a)
    changeRelation(crisis.life, 'partner', -80, { cause: 'event' })
    for (let w = 0; w < 3; w++) for (const s of [a, crisis]) { weeklyClimate(s.hero, s.life, s.calendar); weeklyWellbeing(s.life, s.hero, {}) }
    expect(crisis.life.stress).toBeGreaterThan(a.life.stress)
  })

  it('(u) the agent you hire and keep sweet → more patience at the table (contract talks)', () => {
    const a = makeGame(231, ADULT)
    a.life.agent = { name: 'Ajan', quality: 3, commission: 0.08 }
    a.life.relationships.agent = { id: 'agent', kind: 'agent', name: 'Ajan', value: 10, memory: [], lastContactWeek: 0 }
    const sweet = clone(a)
    sweet.life.relationships.agent!.value = 70
    const offer = getOffers(a)[0]
    if (offer) {
      const n0 = startNegotiation(a, offer.id).value!
      const n1 = startNegotiation(sweet, offer.id).value!
      expect(n1.hidden.maxWage).toBeGreaterThanOrEqual(n0.hidden.maxWage)
      expect(n1.patience).toBeGreaterThanOrEqual(n0.patience)
    }
    expect(negotiationLeverage(sweet.hero, sweet.life, sweet.calendar.season, false).patience).toBeGreaterThan(negotiationLeverage(a.hero, a.life, a.calendar.season, false).patience)
  })

  it('(v) claiming the penalty duty in the dressing room → the hero takes the spot kicks', () => {
    let prep: ReturnType<typeof prepareHeroMatch> = null
    for (let seed = 251; seed < 300 && !prep?.starts; seed++) {
      const [, s] = evePair(seed)
      advanceDay(s)
      prep = prepareHeroMatch(s)
    }
    expect(prep?.starts).toBe(true)
    const kicks = (order: boolean): number => {
      let n = 0
      for (let i = 0; i < 40; i++) {
        const sim = new MatchSim({ ...prep!.setup, heroPenaltyTaker: order, seed: 9100 + i }, 'en', prep!.opts)
        while (!sim.finished) {
          const h = sim.pendingHighlight
          if (h) { if (h.kind === 'penalty') n++; sim.skipHighlight() } else sim.step()
        }
      }
      return n
    }
    expect(kicks(true)).toBeGreaterThan(kicks(false))
  })

  it('(w) the luxury purchase through the shop: logged reaction and a ledger cause', () => {
    const a = makeGame(261)
    a.life.money = 50_000_000
    a.hero.reputation = 99
    a.calendar.week = 12
    const car = ASSETS.filter((d) => d.category === 'car').sort((p, q) => q.price - p.price)[0]!
    const r = buyAsset(a, car.id)
    expect(r.ok).toBe(true)
    expect(r.lines.some((l) => /gündemde/.test(l.tr))).toBe(true)
    expect(recentLuxury(a.life, absWeek(a.calendar))?.id).toBe(car.id)
  })
})
