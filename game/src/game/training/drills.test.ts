import { describe, expect, it } from 'vitest'
import { flatAttrs } from '../setup'
import { cloneBall, predictPlaneCrossing } from '../physics'
import { dist, norm, sub, type Vec2 } from '../model'
import { DIVE_PEAK } from '../ai'
import type { HeroAction } from '../runtime'
import { createDrill, type DribblingDrill, type FinishingDrill, type FitnessDrill, type GoalkeepingDrill, type PassingDrill } from './drills'
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

const BOTS: Record<DrillKind, { good: Bot; meh: Bot }> = {
  finishing: { good: finishingGood, meh: finishingMeh },
  passing: { good: passingGood, meh: passingMeh },
  dribbling: { good: dribbleBot(true), meh: dribbleBot(false) },
  fitness: { good: fitnessBot(true), meh: fitnessBot(false) },
  goalkeeping: { good: keeperBot(true), meh: keeperBot(false) },
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const KINDS: DrillKind[] = ['finishing', 'passing', 'dribbling', 'fitness', 'goalkeeping']

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
      if (process.env.DRILL_DEBUG) console.log(kind, { good: pg.toFixed(2), meh: pm.toFixed(2), none: pn.toFixed(2), pts: good.map((r) => r.points), mehPts: meh.map((r) => r.points), stats: good[0].stats, mehStats: meh[0].stats })
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

  it('set-piece finishing builds a wall and still rewards good strikes', () => {
    const d = make('finishing', 5, 'setPiece') as FinishingDrill
    expect(d.wall.length).toBe(4)
    const r = play(d, finishingGood)
    expect(r.stats.shots).toBeGreaterThan(4)
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
