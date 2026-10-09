/**
 * Scripted test bots for the attribute drills (sprint starts / contact, reading the game / pressing,
 * switch of play, diving station). Shared by drills.test.ts and attrDrills.test.ts; not used at runtime.
 */
import type { Vec2 } from '../model'
import type { HeroAction } from '../runtime'
import type { DrillBase } from './base'
import type { CrossingDrill } from './drills/crossing'
import type { InterceptionDrill } from './drills/interception'
import type { SprintDrill } from './drills/sprint'
import type { Drill, DrillInput } from './types'

export type Mem = { t: number; mem: Record<string, number> }
export type Bot = (d: Drill & DrillBase, s: Mem) => DrillInput

export const idle: DrillInput = { move: { x: 0, y: 0 }, sprint: false, actions: [], aim: null }
const tap = (extra: Partial<DrillInput> = {}): DrillInput => ({ ...idle, ...extra, actions: [{ kind: 'action' } as HeroAction] })

/** Sprint / contact: good = goes on the light, drives, braces in the window, dips; meh = slow off, no drive, braces early. */
export const sprintBot = (good: boolean): Bot => (d, s) => {
  const r = d as SprintDrill
  const st = r.state
  if (st.rep === 'set') {
    if (!st.green) {
      s.mem.greenAt = -1
      return idle
    }
    if ((s.mem.greenAt ?? -1) < 0) s.mem.greenAt = s.t
    return s.t - s.mem.greenAt! >= (good ? 0.05 : 0.4) ? tap() : idle
  }
  if (st.rep !== 'run') {
    s.mem.braced = 0
    s.mem.dipped = 0
    return idle
  }
  const drive = good
  if (st.charge && !s.mem.braced) {
    if (good && st.braceOpen) {
      s.mem.braced = 1
      return tap({ sprint: drive })
    }
    if (!good && st.untilContact < 0.9) {
      s.mem.braced = 1
      return tap({ sprint: drive })
    }
  }
  if (good && !s.mem.dipped && st.toLine <= 1.0) {
    s.mem.dipped = 1
    return tap({ sprint: drive })
  }
  return { ...idle, sprint: drive }
}

/** Nearest point of segment ab to p. */
function nearestOn(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const l2 = abx * abx + aby * aby
  const t = l2 > 0 ? Math.max(0.15, Math.min(0.85, ((p.x - a.x) * abx + (p.y - a.y) * aby) / l2)) : 0
  return { x: a.x + abx * t, y: a.y + aby * t }
}
const steer = (from: Vec2, to: Vec2): Vec2 => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const l = Math.hypot(dx, dy)
  return l > 0.1 ? { x: (dx / l) * Math.min(1, l * 2), y: (dy / l) * Math.min(1, l * 2) } : { x: 0, y: 0 }
}

/** Reading the game: good = steps into the lane on the tell; meh = chases the ball once it is played. */
export const readingBot = (good: boolean): Bot => (d) => {
  const r = d as InterceptionDrill
  const st = r.state
  const h = r.hero.pos
  if (good) {
    if (st.target) return { ...idle, move: steer(h, nearestOn(h, st.cycle === 'flight' ? st.ball : st.holder, st.target)), sprint: true }
    return { ...idle, move: steer(h, { x: 60, y: 34 }) }
  }
  if (st.cycle === 'flight') return { ...idle, move: steer(h, st.ball) }
  return idle
}

/** Pressing: good = sprints at the holder (and to the receiver on the tell), saves breath; meh = jogs at the holder. */
export const pressBot = (good: boolean): Bot => (d) => {
  const r = d as InterceptionDrill
  const st = r.state
  const h = r.hero.pos
  if (!good) return st.cycle === 'hold' ? { ...idle, move: steer(h, st.holder) } : idle
  const goal = st.cycle === 'hold' ? (st.target && st.holdLeft < 0.25 ? st.target : st.holder) : st.target ?? st.holder
  return { ...idle, move: steer(h, goal), sprint: st.stamina > 0.15 && !st.gassed }
}

/** Switch of play: good = releases on the cue at the zone; meh = waits and then hits roughly at it. */
export const switchBot = (good: boolean): Bot => (d, s) => {
  const c = d as CrossingDrill
  if (good) return c.ready && c.releaseIn <= 0 ? { ...idle, actions: [{ kind: 'pass', target: c.zoneCentre, lofted: true }] } : idle
  if (!c.ready) {
    s.mem.readyAt = -1
    return idle
  }
  if ((s.mem.readyAt ?? -1) < 0) s.mem.readyAt = s.t
  if (s.t - s.mem.readyAt! < 0.25) return idle
  s.mem.readyAt = -1
  const z = c.zoneCentre
  return { ...idle, actions: [{ kind: 'tapAt', at: { x: z.x + Math.sin(s.t * 5.1) * 3, y: z.y + Math.cos(s.t * 3.7) * 3 } }] }
}
