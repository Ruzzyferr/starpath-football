import { describe, expect, it } from 'vitest'
import { flatAttrs } from '../setup'
import { cloneBall, predictPlaneCrossing } from '../physics'
import { dist, norm, sub, type Vec2 } from '../model'
import { DIVE_PEAK } from '../ai'
import type { HeroAction } from '../runtime'
import { createDrill, type CrossingDrill, type DistributionDrill, type DribblingDrill, type FinishingDrill, type FitnessDrill, type GoalkeepingDrill, type HeadingDrill, type PassingDrill, type TacklingDrill } from './drills'
import { JUMP_PEAK } from './drills/heading'
import type { RondoDrill } from './drills/rondo'
import type { Attributes } from '../../core/types'
import type { Drill, DrillInput, DrillKind, DrillResult } from './types'
import type { DrillBase } from './base'

type Mem = { t: number; mem: Record<string, number> }
type Bot = (d: Drill & DrillBase, s: Mem) => DrillInput

const idle: DrillInput = { move: { x: 0, y: 0 }, sprint: false, actions: [], aim: null }
const act = (a: HeroAction, extra: Partial<DrillInput> = {}): DrillInput => ({ ...idle, ...extra, actions: [a] })

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
const make = (kind: DrillKind, seed: number, variant?: 'setPiece') =>
  createDrill(kind, { attrs: ATTRS, seed, aimAssist: 'half', ...(variant ? { variant } : {}) })

/** Waits `delay` seconds after `ready` becomes true, then fires once. */
function after(ready: boolean, s: Mem, delay: number): boolean {
  if (!ready) {
    s.mem.readyAt = -1
    return false
  }
  if (s.mem.readyAt === undefined || s.mem.readyAt < 0) s.mem.readyAt = s.t
  if (s.t - s.mem.readyAt < delay) return false
  s.mem.readyAt = -1
  return true
}

// ───────────────────────── Bots ─────────────────────────

const finishingGood: Bot = (d, s) => {
  const f = d as FinishingDrill
  if (!after(f.ready, s, 0.45)) return idle
  const tg = f.litTargets()[0]
  const power = Math.min(1, Math.max(0.45, Math.sqrt(Math.max(0, tg.z - 0.3) / 1.5)))
  return act({ kind: 'shoot', target: { x: 105.2, y: tg.y }, power, curl: 0, chip: false })
}

const finishingMeh: Bot = (d, s) => {
  const f = d as FinishingDrill
  if (!after(f.ready, s, 1.1)) return idle
  const y = 34 + Math.sin(s.t * 7.3) * 2.6
  return act({ kind: 'shoot', target: { x: 105.2, y }, power: 0.78, curl: 0, chip: false })
}

const passingGood: Bot = (d, s) => {
  const p = d as PassingDrill
  if (!after(p.ready, s, 0.55)) return idle
  const at = { ...p.litMate.pos }
  return p.wanted === 'ground' ? act({ kind: 'tapAt', at }) : act({ kind: 'pass', target: at, lofted: true })
}

const passingMeh: Bot = (d, s) => {
  const p = d as PassingDrill
  if (!after(p.ready, s, 1.4)) return idle
  return act({ kind: 'tapAt', at: { ...p.litMate.pos } })
}

const dribbleBot = (good: boolean): Bot => (d, s) => {
  const r = d as DribblingDrill
  const h = r.hero
  const target: Vec2 = r.hasBall ? r.nextWaypoint() : { x: r.ball.x, y: r.ball.y }
  const move = norm(sub(target, h.pos))
  const dummy = r.nextDummy()
  const actions: HeroAction[] = []
  if (dummy && r.hasBall) {
    const dd = dist(dummy, h.pos)
    const press = good ? dd < 2.1 && dd > 1.5 : dd < 3.9 && (s.mem.pressed ?? -9) < s.t - 1
    if (press) {
      actions.push({ kind: 'skill' })
      s.mem.pressed = s.t
    }
  }
  return { move, sprint: good && h.stamina > 0.3, actions, aim: null }
}

const fitnessBot = (good: boolean): Bot => (d) => {
  const f = d as FitnessDrill
  const st = f.state
  if (st.run === 'waiting') {
    if (good && st.untilBeep <= 0.1 && st.untilBeep > 0) return act({ kind: 'action' })
    return idle
  }
  if (!good) return { ...idle, sprint: true }
  const need = st.distanceLeft / Math.max(0.05, st.untilBeep)
  return { ...idle, sprint: need > f.jogSpeed * 0.92 && st.stamina > 0.08 }
}

const keeperBot = (good: boolean): Bot => (d, s) => {
  const g = d as GoalkeepingDrill
  if (!g.inFlight) {
    s.mem.flightAt = -1
    s.mem.dived = 0
    return idle
  }
  if (s.mem.flightAt === undefined || s.mem.flightAt < 0) s.mem.flightAt = s.t
  if (s.mem.dived) return idle
  const k = g.hero
  if (!good) {
    if (s.t - s.mem.flightAt < 0.3) return idle
    s.mem.dived = 1
    return act({ kind: 'dive', dir: { x: 0.1, y: Math.sin(s.t * 13) > 0 ? 1 : -1 } })
  }
  if (s.t - s.mem.flightAt < 0.16) return idle
  const c = predictPlaneCrossing(cloneBall(g.ball), g.env, k.pos.x, 2)
  if (!c) return idle
  if (Math.abs(c.y - k.pos.y) < 0.5 && c.z < 1.6) return idle
  if (c.t > DIVE_PEAK + 0.06) return idle
  s.mem.dived = 1
  return act({ kind: 'dive', dir: norm(sub({ x: k.pos.x, y: c.y }, k.pos)) })
}

const crossingGood: Bot = (d) => {
  const c = d as CrossingDrill
  if (!c.ready || c.releaseIn > 0) return idle
  return act({ kind: 'pass', target: c.zoneCentre, lofted: true })
}

const crossingMeh: Bot = (d, s) => {
  const c = d as CrossingDrill
  if (!after(c.ready, s, 0.25)) return idle
  const z = c.zoneCentre
  return act({ kind: 'tapAt', at: { x: z.x + Math.sin(s.t * 5.1) * 1.6, y: z.y + Math.cos(s.t * 3.7) * 1.6 } })
}

const headingBot = (good: boolean): Bot => (d, s) => {
  const h = d as HeadingDrill
  const spot = h.target
  const off = sub(spot, h.hero.pos)
  const l = Math.hypot(off.x, off.y)
  const move = l > 0.12 ? { x: (off.x / l) * Math.min(1, l * 2), y: (off.y / l) * Math.min(1, l * 2) } : { x: 0, y: 0 }
  if (!h.incomingBall) {
    s.mem.jumped = 0
    return { ...idle, move }
  }
  if (s.mem.jumped || h.hero.state !== 'run') return { ...idle, move }
  const eta = h.eta()
  if (good && eta.t <= JUMP_PEAK + 0.02) {
    s.mem.jumped = 1
    return act({ kind: 'action' }, { move })
  }
  if (!good && eta.t <= 0.5) {
    s.mem.jumped = 1
    return act({ kind: 'tapAt', at: { x: 105, y: 34 + Math.sin(s.t * 9.1) * 3 } }, { move })
  }
  return { ...idle, move }
}

const tacklingBot = (good: boolean): Bot => (d, s) => {
  const t = d as TacklingDrill
  if (!t.dueling) return idle
  const h = t.hero
  const ball = { x: t.ball.x, y: t.ball.y }
  const v = t.carrierVel
  const vl = Math.hypot(v.x, v.y)
  const cdir = vl > 0.3 ? { x: v.x / vl, y: v.y / vl } : { x: -1, y: 0 }
  const spot = good ? { x: ball.x + cdir.x * 1.0, y: ball.y + cdir.y * 1.0 } : ball
  const off = sub(spot, h.pos)
  const l = Math.hypot(off.x, off.y)
  const move = l > 0.05 ? { x: (off.x / l) * Math.min(1, l * 1.5), y: (off.y / l) * Math.min(1, l * 1.5) } : { x: 0, y: 0 }
  const db = dist(h.pos, ball)
  const actions: HeroAction[] = []
  if (h.state === 'run') {
    if (good && db <= t.reach - 0.05 && t.exposure >= 0.75) actions.push({ kind: 'action' })
    if (!good && db <= 1.45 && s.t - (s.mem.last ?? -9) > 0.6) {
      actions.push({ kind: 'action' })
      s.mem.last = s.t
    }
  }
  return { move, sprint: good && l > 3, actions, aim: null }
}

const stepToward = (from: Vec2, to: Vec2): Vec2 => {
  const off = sub(to, from)
  const l = Math.hypot(off.x, off.y)
  return l > 0.1 ? { x: (off.x / l) * Math.min(1, l * 2), y: (off.y / l) * Math.min(1, l * 2) } : { x: 0, y: 0 }
}

/** Distribution & claiming: good = under the ring, quick release leading the runner; meh = waits, aims at his feet. */
const distributionBot = (good: boolean): Bot => (d, s) => {
  const t = d as DistributionDrill
  const move = good && t.crossing ? stepToward(t.hero.pos, t.landing) : { x: 0, y: 0 }
  if (!t.holding) {
    s.mem.holdAt = -1
    return { ...idle, move }
  }
  if (s.mem.holdAt < 0 || s.mem.holdAt === undefined) s.mem.holdAt = s.t
  const waited = s.t - s.mem.holdAt
  if (good && waited > 0.5) return act({ kind: 'tapAt', at: t.leadPoint(t.featuredMate) })
  if (!good && waited > 2.4) return act({ kind: 'tapAt', at: t.mateAt(t.featuredMate) })
  return idle
}

const BOTS: Record<DrillKind, { good: Bot; meh: Bot }> = {
  finishing: { good: finishingGood, meh: finishingMeh },
  passing: { good: passingGood, meh: passingMeh },
  dribbling: { good: dribbleBot(true), meh: dribbleBot(false) },
  fitness: { good: fitnessBot(true), meh: fitnessBot(false) },
  goalkeeping: { good: keeperBot(true), meh: keeperBot(false) },
  crossing: { good: crossingGood, meh: crossingMeh },
  heading: { good: headingBot(true), meh: headingBot(false) },
  tackling: { good: tacklingBot(true), meh: tacklingBot(false) },
  distribution: { good: distributionBot(true), meh: distributionBot(false) },
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const KINDS: DrillKind[] = ['finishing', 'passing', 'dribbling', 'fitness', 'goalkeeping', 'crossing', 'heading', 'tackling', 'distribution']
const NEW_KINDS: DrillKind[] = ['crossing', 'heading', 'tackling', 'distribution']
/** The attributes each new drill is about. */
const KEY_ATTRS: Record<string, (keyof Attributes)[]> = {
  crossing: ['crossing', 'passing'],
  heading: ['heading', 'jumping'],
  tackling: ['tackling', 'positioning', 'strength'],
  distribution: ['handling', 'passing'],
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
      if ((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.DRILL_DEBUG) console.log(kind, { good: pg.toFixed(2), meh: pm.toFixed(2), none: pn.toFixed(2), pts: good.map((r) => r.points), mehPts: meh.map((r) => r.points), stats: good[0].stats, mehStats: meh[0].stats })
      expect(pg).toBeGreaterThan(pm + 0.1)
      expect(pm).toBeGreaterThan(pn)
      expect(pg).toBeGreaterThan(0.75)
      expect(pn).toBeLessThan(0.3)
      for (const r of [...good, ...meh, ...none]) {
        expect(r.performance).toBeGreaterThanOrEqual(0)
        expect(r.performance).toBeLessThanOrEqual(1)
        expect(r.played).toBeGreaterThan(0)
      }
    })
  }

  it('rondo 4v2: 60 s, quick open passes beat slow ones beat standing still; Vision 60 opens the third option (2.3#24)', () => {
    const quick: Bot = (d, s) => {
      const r = d as RondoDrill
      if (!after(r.ready, s, 0.25)) return idle
      return act({ kind: 'tapAt', at: { ...r.mates[r.mostOpen()].pos } })
    }
    const slow: Bot = (d, s) => {
      const r = d as RondoDrill
      if (!after(r.ready, s, 1.3)) return idle
      return act({ kind: 'tapAt', at: { ...r.mates[r.options[0]].pos } })
    }
    const mk = (seed: number, vision = 70) => createDrill('passing', { attrs: { ...flatAttrs(65), vision }, seed, aimAssist: 'half', variant: 'rondo' })
    const good = [1, 2, 3].map((s) => play(mk(s), quick))
    const meh = [1, 2, 3].map((s) => play(mk(s), slow))
    const none = [1, 2, 3].map((s) => play(mk(s), () => idle))
    expect(good[0].played).toBeGreaterThanOrEqual(59)
    expect(avg(good.map((r) => r.performance))).toBeGreaterThan(avg(meh.map((r) => r.performance)) + 0.1)
    expect(avg(good.map((r) => r.performance))).toBeGreaterThan(0.75)
    expect(avg(none.map((r) => r.performance))).toBeLessThan(0.1)
    expect(good[0].stats.oneTouch ?? 0).toBeGreaterThan(0)
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
    const r = play(d, finishingGood)
    // Curl gate (2.3#25): five kicks, 20 points per kick between the posts, wind on the HUD.
    expect(r.stats.shots).toBe(5)
    expect(r.points % 20).toBe(0)
    expect(r.points).toBe((r.stats.gates ?? 0) * 20)
    expect(r.points).toBeGreaterThanOrEqual(40)
    const v = make('finishing', 6, 'setPiece').view()
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

    it(`${kind}: better ${KEY_ATTRS[kind].join('/')} raise the score`, () => {
      const withAttr = (v: number): Attributes => {
        const at = { ...flatAttrs(60) }
        for (const k of KEY_ATTRS[kind]) at[k] = v
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
