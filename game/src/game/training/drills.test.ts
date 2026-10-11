import { describe, expect, it } from 'vitest'
import { flatAttrs } from '../setup'
import { createDrill, type FinishingDrill } from './drills'
import type { RondoDrill } from './drills/rondo'
import type { Attributes } from '../../core/types'
import type { Drill, DrillKind, DrillResult } from './types'
import type { DrillBase } from './base'
import { BOTS, divingBot, finishingGood, idle, passingGood, rondoQuick, rondoSlow, setPieceBot, type Bot, type Mem } from './drillBots'

/** Plays a drill to the end at 60 fps with a bot. */
function play(d: Drill & DrillBase, bot: Bot): DrillResult {
  const s: Mem = { t: 0, mem: {} }
  for (let i = 0; i < 60 * 90 && !d.finished; i++) {
    s.t += 1 / 60
    d.update(1 / 60, bot(d, s))
  }
  expect(d.finished).toBe(true)
  return d.result()
}

const ATTRS = flatAttrs(65)
/** Keeper drills: a keeper's sheet (goalkeeping attributes, not an outfielder's near-floor ones). */
const GK_DRILL_ATTRS = flatAttrs(65, true)
const make = (kind: DrillKind, seed: number, variant?: 'setPiece') =>
  createDrill(kind, { attrs: kind === 'goalkeeping' ? GK_DRILL_ATTRS : ATTRS, seed, aimAssist: 'half', ...(variant ? { variant } : {}) })

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const KINDS: DrillKind[] = ['finishing', 'passing', 'dribbling', 'fitness', 'goalkeeping', 'crossing', 'heading', 'tackling', 'distribution', 'sprint', 'interception']
const NEW_KINDS: DrillKind[] = ['crossing', 'heading', 'tackling', 'distribution', 'sprint', 'interception']
/** The attributes each new drill is about. */
const KEY_ATTRS: Record<string, (keyof Attributes)[]> = {
  crossing: ['crossing', 'passing'],
  heading: ['heading', 'jumping'],
  tackling: ['tackling', 'positioning', 'strength'],
  distribution: ['handling', 'passing'],
  sprint: ['acceleration', 'pace'],
  interception: ['anticipation'],
}

describe('training drills (headless)', () => {
  for (const kind of KINDS) {
    it(`${kind}: skilled play beats sloppy play beats doing nothing`, () => {
      const seeds = [1, 2, 3]
      const good = seeds.map((s) => play(make(kind, s), BOTS[kind].good))
      const meh = seeds.map((s) => play(make(kind, s), BOTS[kind].meh))
      const none = seeds.map((s) => play(make(kind, s), () => idle))
      const pg = avg(good.map((r) => r.performance))
      const pm = avg(meh.map((r) => r.performance))
      const pn = avg(none.map((r) => r.performance))
      if ((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.DRILL_DEBUG) console.log(kind, { good: pg.toFixed(2), meh: pm.toFixed(2), none: pn.toFixed(2), pts: good.map((r) => r.points), mehPts: meh.map((r) => r.points), stats: good[0]!.stats, mehStats: meh[0]!.stats })
      expect(pg).toBeGreaterThan(pm + 0.1)
      // A wild dive can do worse than standing still (keeper); everywhere else sloppy beats idle.
      if (kind !== 'goalkeeping') expect(pm).toBeGreaterThanOrEqual(pn)
      expect(pg).toBeGreaterThan(pn + 0.25)
      // Perfect-information bot (the human-input curves are pinned in drillCurves.test.ts).
      expect(pg).toBeGreaterThan(0.55)
      expect(pn).toBeLessThan(0.36)
      for (const r of [...good, ...meh, ...none]) {
        expect(r.performance).toBeGreaterThanOrEqual(0)
        expect(r.performance).toBeLessThanOrEqual(1)
        expect(r.played).toBeGreaterThan(0)
      }
    })
  }

  it('rondo 4v2: 60 s, quick open passes beat slow ones beat standing still; Vision 60 opens the third option (2.3#24)', () => {
    const quick = rondoQuick
    const slow = rondoSlow
    const mk = (seed: number, vision = 70) => createDrill('passing', { attrs: { ...flatAttrs(65), vision }, seed, aimAssist: 'half', variant: 'rondo' })
    const good = [1, 2, 3].map((s) => play(mk(s), quick))
    const meh = [1, 2, 3].map((s) => play(mk(s), slow))
    const none = [1, 2, 3].map((s) => play(mk(s), () => idle))
    expect(good[0]!.played).toBeGreaterThanOrEqual(59)
    expect(avg(good.map((r) => r.performance))).toBeGreaterThan(avg(meh.map((r) => r.performance)) + 0.1)
    expect(avg(good.map((r) => r.performance))).toBeGreaterThan(0.75)
    expect(avg(none.map((r) => r.performance))).toBeLessThan(0.1)
    expect(good[0]!.stats.oneTouch ?? 0).toBeGreaterThan(0)
    expect((mk(1, 59) as RondoDrill).options).toEqual([0, 2])
    expect((mk(1, 60) as RondoDrill).options).toEqual([0, 1, 2])
  })

  it('finishing target grid: 10 shots, points made of 10 / 6 / 2 (2.3#23)', () => {
    const r = play(make('finishing', 7), finishingGood)
    expect(r.stats.shots).toBe(10)
    expect(r.points).toBeLessThanOrEqual(100)
    expect(r.points).toBeGreaterThan(0)
    const v = make('finishing', 7).view()
    expect(v.goalTargets.filter((t) => t.tone === 'dim').length).toBe(8)
  })

  it('goalkeeping reflex wall: exactly 12 shots within the drill time (2.3#29)', () => {
    const r = play(make('goalkeeping', 4), BOTS.goalkeeping.good)
    expect(r.stats.shots).toBe(12)
    expect(r.played).toBeLessThanOrEqual(40)
  })

  it('diving station (Diving): corner shots only, full-stretch saves earn a bonus, Diving widens the reach', () => {
    const mk = (seed: number, diving = 65) => createDrill('goalkeeping', { attrs: { ...GK_DRILL_ATTRS, diving }, seed, aimAssist: 'half', variant: 'diving' })
    const good = [1, 2, 3].map((s) => play(mk(s), BOTS.goalkeeping.good))
    const none = [1, 2, 3].map((s) => play(mk(s), () => idle))
    expect(good[0]!.stats.shots).toBe(12)
    expect(avg(good.map((r) => r.performance))).toBeGreaterThan(avg(none.map((r) => r.performance)) + 0.3)
    expect(good.some((r) => (r.stats.stretchSaves ?? 0) > 0)).toBe(true)
    expect(mk(1).view().hud.prompt).toBe('ready')
    const run = (v: number) => avg([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((seed) => play(mk(seed, v), divingBot).stats.saves ?? 0))
    if ((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.DRILL_DEBUG) console.log('diving saves', run(25), run(60), run(95))
    expect(run(95)).toBeGreaterThan(run(25))
  })

  it('distribution & claiming: catches crosses, then throws or kicks to a runner (2.3#2)', () => {
    const r = play(make('distribution', 5), BOTS.distribution.good)
    expect(r.stats.crosses).toBeGreaterThanOrEqual(5)
    expect(r.stats.claims ?? 0).toBeGreaterThan(0)
    expect((r.stats.throws ?? 0) + (r.stats.kicks ?? 0)).toBeGreaterThan(0)
    expect(r.stats.found ?? 0).toBeGreaterThan(0)
    const hold = make('distribution', 6)
    expect(hold.view().heroIsKeeper).toBe(true)
  })

  it('set-piece finishing builds a wall and still rewards good strikes', () => {
    const d = make('finishing', 5, 'setPiece') as FinishingDrill
    expect(d.wall.length).toBe(4)
    const r = play(d, setPieceBot(true))
    // Curl gate (2.3#25): five kicks at the two gates; a goal 20, a saved kick into a gate 6, at the keeper 2.
    expect(r.stats.shots).toBe(5)
    expect(r.points).toBeGreaterThanOrEqual((r.stats.goals ?? 0) * 20)
    expect(r.points).toBeLessThanOrEqual(5 * 20)
    expect(r.points).toBeGreaterThan(0)
    const v = make('finishing', 6, 'setPiece').view()
    expect(v.goalTargets.length).toBe(2)
    expect(v.hud.wind).toBeDefined()
    expect(v.hud.wind!.kmh).toBeGreaterThanOrEqual(0)
    expect(v.hud.wind!.kmh).toBeLessThanOrEqual(26)
  })

  for (const kind of NEW_KINDS) {
    it(`${kind}: deterministic for the same seed and inputs`, () => {
      const a = play(make(kind, 21), BOTS[kind].good)
      const b = play(make(kind, 21), BOTS[kind].good)
      expect(a).toEqual(b)
      expect(a.kind).toBe(kind)
      expect(a.played).toBeGreaterThanOrEqual(20)
      expect(a.played).toBeLessThanOrEqual(40)
    })

    it(`${kind}: better ${KEY_ATTRS[kind]!.join('/')} raise the score`, () => {
      const withAttr = (v: number): Attributes => {
        const at = { ...flatAttrs(60) }
        for (const k of KEY_ATTRS[kind]!) at[k] = v
        return at
      }
      const run = (v: number) =>
        avg([1, 2, 3, 4, 5, 6].map((seed) => play(createDrill(kind, { attrs: withAttr(v), seed, aimAssist: 'half' }), BOTS[kind].good).points))
      const weak = run(35)
      const strong = run(92)
      if ((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.DRILL_DEBUG) console.log(kind, 'attrs', { weak, strong })
      expect(strong).toBeGreaterThan(weak * 1.1)
    })
  }

  it('distribution: Distribution (GK) alone makes releases from the hands land closer', () => {
    const run = (v: number) =>
      avg([1, 2, 3, 4, 5, 6].map((seed) => play(createDrill('distribution', { attrs: { ...flatAttrs(60), gkDistribution: v }, seed, aimAssist: 'half' }), BOTS.distribution.good).points))
    expect(run(92)).toBeGreaterThan(run(20))
  })

  it('is deterministic for the same seed and inputs', () => {
    const a = play(make('passing', 9), passingGood)
    const b = play(make('passing', 9), passingGood)
    expect(a).toEqual(b)
  })

  it('ends after the clock with nothing scored when idle', () => {
    const d = make('finishing', 3)
    const r = play(d, () => idle)
    expect(r.played).toBeCloseTo(d.duration, 0)
    expect(r.points).toBe(0)
    expect(r.grade).toBe('D')
  })

  it('emits a start whistle and an end event', () => {
    const d = make('dribbling', 4)
    const types = new Set<string>()
    for (let i = 0; i < 60 * 60 && !d.finished; i++) {
      d.update(1 / 60, idle)
      for (const e of d.drainEvents()) types.add(e.type)
    }
    expect(types.has('go')).toBe(true)
    expect(types.has('whistle')).toBe(true)
    expect(types.has('end')).toBe(true)
  })

  it('views are renderable at every phase', () => {
    for (const kind of KINDS) {
      const d = make(kind, 11)
      for (let i = 0; i < 60 * 50 && !d.finished; i += 30) {
        for (let k = 0; k < 30; k++) d.update(1 / 60, idle)
        const v = d.view()
        expect(Number.isFinite(v.hero.x) && Number.isFinite(v.hero.y)).toBe(true)
        expect(v.hud.timeLeft).toBeGreaterThanOrEqual(0)
        expect(v.span).toBeGreaterThan(5)
      }
    }
  })
})
