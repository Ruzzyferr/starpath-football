import { describe, expect, it } from 'vitest'
import type { GameState } from '../../core/types'
import { startProbability } from '../career/squadRole'
import { advanceDay, isHeroMatchday } from './calendar'
import { GFLAG, absDayOf, readJson } from './internal'
import { HERO_ID, autoPlayHeroMatch, finishHeroMatch, prepareHeroMatch, prepareReserveMatch, reserveMatchBlock, startHeroMatch } from './match'
import {
  CAMEO_AFTER, DRY_FLAG, IMPRESS_BONUS, RESERVE_FLAG, afterClubMatch, nextClubFixture, resolveImpress, selectionOutlook, selectionTerms,
  talkToManager, termsTotal,
} from './selection'
import { makeGame } from './testHelpers'
import { oneOnOne, oneOnOneBlock, weekIdeas } from './weekIdeas'

/** An in-season morning that is not a matchday (the day after the first match). */
function inSeason(seed: number): GameState {
  const s = makeGame(seed)
  let played = false
  for (let i = 0; i < 120; i++) {
    s.pendingEvents.length = 0
    if (isHeroMatchday(s)) { autoPlayHeroMatch(s); played = true }
    advanceDay(s)
    if (played && !isHeroMatchday(s)) break
  }
  s.pendingEvents.length = 0
  s.hero.injury = null
  s.life.energy = 100
  return s
}

describe('selection: match context, drought cameo, levers', () => {
  it('the selection roll adds the context terms the meter shows', () => {
    const s = inSeason(21)
    const ref = nextClubFixture(s)
    expect(ref).not.toBeNull()
    const terms = selectionTerms(s, ref)
    const o = selectionOutlook(s)!
    expect(o.chance).toBeGreaterThanOrEqual(0)
    expect(termsTotal(terms)).toBeCloseTo(termsTotal(o.terms), 6)
    expect(startProbability(s.hero, s.life, undefined, 0.2)).toBeGreaterThanOrEqual(startProbability(s.hero, s.life))
  })

  it('after CAMEO_AFTER dry matchdays a benched hero gets a planned 60–74 minute entry and plays', () => {
    const s = inSeason(22)
    s.life.flags[DRY_FLAG] = CAMEO_AFTER
    s.hero.contract!.role = 'youth'
    s.hero.managerTrust = 5
    s.hero.form = 0
    for (let i = 0; i < 20 && !isHeroMatchday(s); i++) { s.pendingEvents.length = 0; advanceDay(s) }
    s.hero.injury = null
    const prep = prepareHeroMatch(s)
    expect(prep).not.toBeNull()
    if (prep!.starts) return // rolled a start anyway: nothing to check
    expect(prep!.setup.heroEntryMinute).toBeGreaterThanOrEqual(60)
    expect(prep!.setup.heroEntryMinute).toBeLessThanOrEqual(74)
    const sim = startHeroMatch(s)!
    const rep = finishHeroMatch(s, sim)
    expect(rep.minutes).toBeGreaterThan(0)
    expect(s.life.flags[DRY_FLAG]).toBe(0)
  })

  it('the coach’s challenge adds its bonus until the next club match', () => {
    const s = inSeason(23)
    s.calendar.slot = 0
    const r = resolveImpress(s, 0.9, 'A')
    expect(r.ok && r.passed).toBe(true)
    const t = selectionTerms(s, nextClubFixture(s)).find((x) => x.key === 'impress')
    expect(t?.value).toBe(IMPRESS_BONUS)
    expect(resolveImpress(s, 0.9, 'A').ok).toBe(false) // once per match
    afterClubMatch(s.life, 0)
    expect(selectionTerms(s, nextClubFixture(s)).some((x) => x.key === 'impress')).toBe(false)
  })

  it('levers are evaluated on the real model (talk = trust change → chance change)', () => {
    const s = inSeason(24)
    s.hero.managerTrust = 30
    const o = selectionOutlook(s)!
    const talk = o.levers.find((l) => l.key === 'talk')
    const before = s.hero.managerTrust
    const r = talkToManager(s)
    expect(r.ok).toBe(true)
    expect(s.hero.managerTrust).toBeGreaterThan(before)
    const after = selectionOutlook(s)!
    if (talk) expect(Math.round((after.chance - o.chance) * 100)).toBe(talk.points)
    expect(talkToManager(s).ok).toBe(false) // once a week
  })
})

describe('reserve / training matches', () => {
  it('a U21 game plays through the match flow: minutes, sharpness, a reserve record, one slot', () => {
    const s = inSeason(31)
    s.hero.contract!.role = 'reserve'
    s.calendar.slot = 0
    // Avoid the day before a match.
    for (let i = 0; i < 7 && reserveMatchBlock(s, 'reserve'); i++) { advanceDay(s); s.life.energy = 100; s.hero.injury = null; if (isHeroMatchday(s)) autoPlayHeroMatch(s) }
    if (reserveMatchBlock(s, 'reserve')) return
    const sharp0 = s.hero.sharpness = 30
    expect(prepareReserveMatch(s, 'reserve').ok).toBe(true)
    const blob = readJson<{ setup: { heroEntryMinute?: number } } | null>(s.life, GFLAG.match, null)
    expect(blob?.setup.heroEntryMinute).toBe(46)
    const sim = startHeroMatch(s)!
    expect(sim).toBeTruthy()
    const rep = finishHeroMatch(s, sim)
    expect(rep.minutes).toBeGreaterThanOrEqual(40)
    expect(s.hero.sharpness).toBeGreaterThan(sharp0)
    expect(readJson(s.life, RESERVE_FLAG, null)).not.toBeNull()
    expect(s.activeMatchId).toBeNull()
    expect(s.calendar.slot).toBe(1)
    expect(reserveMatchBlock(s, 'reserve')).not.toBeNull() // once a week
    expect(sim.snapshot().events.some((e) => e.type === 'sub' && e.playerId === HERO_ID)).toBe(true)
  })

  it('the training match puts the B team against the first XI', () => {
    const s = inSeason(32)
    s.calendar.slot = 0
    for (let i = 0; i < 7 && reserveMatchBlock(s, 'scrimmage'); i++) { advanceDay(s); s.life.energy = 100; s.hero.injury = null; if (isHeroMatchday(s)) autoPlayHeroMatch(s) }
    if (reserveMatchBlock(s, 'scrimmage')) return
    expect(prepareReserveMatch(s, 'scrimmage').ok).toBe(true)
    const rep = finishHeroMatch(s, startHeroMatch(s)!)
    expect(rep.minutes).toBeGreaterThan(20)
    expect(absDayOf(s)).toBeGreaterThan(0)
  })
})

describe('week ideas and the 1-on-1 session', () => {
  it('suggests at most 3 things that can be done now', () => {
    const s = inSeason(41)
    s.calendar.slot = 0
    const ideas = weekIdeas(s)
    expect(ideas.length).toBeGreaterThan(0)
    expect(ideas.length).toBeLessThanOrEqual(3)
    for (const i of ideas) {
      expect(i.title.tr.length).toBeGreaterThan(0)
      expect(i.reward.en.length).toBeGreaterThan(0)
    }
  })

  it('a 1-on-1 builds the bond and gives XP, twice a week at most', () => {
    const s = inSeason(42)
    s.calendar.slot = 0
    if (oneOnOneBlock(s)) return
    const r = oneOnOne(s)
    expect(r.ok).toBe(true)
    expect(r.xp!.reduce((a, x) => a + x.xp, 0)).toBeGreaterThan(0)
    expect(r.relation).toBeGreaterThanOrEqual(0)
    s.calendar.slot = 0
    s.life.energy = 100
    expect(oneOnOne(s).ok).toBe(true)
    s.calendar.slot = 0
    expect(oneOnOne(s).ok).toBe(false)
  })
})
