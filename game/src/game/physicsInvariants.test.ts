/**
 * Physics invariants (owner, build 9: "physics with all its rules, as much as the chance"). Deterministic: no
 * roll anywhere in here. The ball model is game/physics.ts (drag, Magnus, bounce, rolling friction, goal frames);
 * kicks are game/kick.ts (launch speed from the kick stat × power); players game/model.ts (pace, acceleration,
 * agility, stamina) as integrated by the runtime.
 */
import { describe, expect, it } from 'vitest'
import type { Attributes } from '../core/types'
import { PITCH_LENGTH } from '../sim/match/types'
import { shotSpeed } from './kick'
import { accel, topSpeed, type Agent } from './model'
import { DEFAULT_ENV, GOAL_CENTER_Y, POST_Y_HIGH, createBall, createTracker, groundSpeed, speed3, stepBall, type PhysicsEvent } from './physics'
import { generatedHighlight } from './demoHighlights'
import { HighlightRuntime } from './runtime'

const attrs = (v: number): Attributes => ({ shooting: v, strength: 60, pace: v, acceleration: v, agility: v, heading: 60 } as unknown as Attributes)
const still = { x: 0, y: 0 }

describe('ball', () => {
  it('a rolling ball only ever slows down, and stops', () => {
    const b = createBall(20, 20)
    b.vx = 18
    const t = createTracker()
    const ev: PhysicsEvent[] = []
    let prev = groundSpeed(b)
    for (let i = 0; i < 60 * 30; i++) {
      stepBall(b, DEFAULT_ENV, t, ev)
      const s = groundSpeed(b)
      expect(s).toBeLessThanOrEqual(prev + 1e-9)
      prev = s
    }
    expect(prev).toBe(0)
  })

  it('in the air (no wind) the speed falls monotonically on the way down range: drag always takes', () => {
    const b = createBall(20, 20)
    b.vx = 28
    b.vz = 3
    const t = createTracker()
    const ev: PhysicsEvent[] = []
    const h0 = Math.hypot(b.vx, b.vy)
    for (let i = 0; i < 40; i++) stepBall(b, DEFAULT_ENV, t, ev)
    expect(Math.hypot(b.vx, b.vy)).toBeLessThan(h0)
  })

  it('a harder kick travels further before it stops (rolling distance grows with speed)', () => {
    const travel = (v: number) => {
      const b = createBall(5, 30)
      b.vx = v
      const t = createTracker()
      const ev: PhysicsEvent[] = []
      for (let i = 0; i < 60 * 30 && groundSpeed(b) > 0; i++) stepBall(b, DEFAULT_ENV, t, ev)
      return b.x - 5
    }
    const d = [6, 10, 14, 18].map(travel)
    for (let i = 1; i < d.length; i++) expect(d[i]!).toBeGreaterThan(d[i - 1]!)
  })

  it('a bounce loses energy (restitution < 1)', () => {
    const b = createBall(20, 20, 2)
    b.vx = 10
    const t = createTracker()
    const ev: PhysicsEvent[] = []
    let firstBounce = -1
    for (let i = 0; i < 600; i++) {
      stepBall(b, DEFAULT_ENV, t, ev)
      const bounce = ev.find((e) => e.type === 'bounce')
      if (bounce && firstBounce < 0) firstBounce = speed3(b)
    }
    expect(firstBounce).toBeGreaterThan(0)
    expect(speed3(b)).toBeLessThan(firstBounce)
  })

  it('a 40 m/s shot does not tunnel through the post', () => {
    const b = createBall(PITCH_LENGTH - 3, POST_Y_HIGH)
    b.vx = 40
    b.z = 1
    b.vz = 0.5
    const t = createTracker()
    const ev: PhysicsEvent[] = []
    for (let i = 0; i < 30; i++) stepBall(b, DEFAULT_ENV, t, ev)
    expect(ev.some((e) => e.type === 'post')).toBe(true)
  })
})

describe('kicks and players', () => {
  it('launch speed rises with Shot Power and with the power of the swing', () => {
    const s = [40, 65, 90].map((v) => shotSpeed(1, attrs(v)))
    expect(s[1]!).toBeGreaterThan(s[0]!)
    expect(s[2]!).toBeGreaterThan(s[1]!)
    const p = [0.4, 0.7, 1].map((pw) => shotSpeed(pw, attrs(62)))
    expect(p[1]!).toBeGreaterThan(p[0]!)
    expect(p[2]!).toBeGreaterThan(p[1]!)
  })

  it('top speed and acceleration rise with Pace / Acceleration', () => {
    const ag = (v: number, sprint: boolean) => ({ attrs: attrs(v), sprint, stamina: 1, legs: 1 } as unknown as Agent)
    expect(topSpeed(ag(90, true))).toBeGreaterThan(topSpeed(ag(40, true)))
    expect(topSpeed(ag(62, true))).toBeGreaterThan(topSpeed(ag(62, false)))
    expect(accel(ag(90, true))).toBeGreaterThan(accel(ag(40, true)))
  })

  it('a running player cannot stop dead: the stopping distance grows with his speed', () => {
    const stop = (v: number) => {
      const rt = new HighlightRuntime(generatedHighlight('build_up', 1, { ovr: 62, heroOvr: 57 }), { aimAssist: 'half', difficulty: 'normal', seed: 1 })
      for (let f = 0; f < 600 && rt.phase !== 'live'; f++) rt.update(1 / 60)
      rt.hero.vel = { x: v, y: 0 }
      const x0 = rt.hero.pos.x
      for (let f = 0; f < 120 && Math.hypot(rt.hero.vel.x, rt.hero.vel.y) > 0.05; f++) {
        rt.setControl({ move: still, sprint: false })
        rt.update(1 / 60)
      }
      return rt.hero.pos.x - x0
    }
    const d = [3, 5, 7].map(stop)
    expect(d[0]!).toBeGreaterThan(0.05)
    expect(d[1]!).toBeGreaterThan(d[0]!)
    expect(d[2]!).toBeGreaterThan(d[1]!)
  })
})

void GOAL_CENTER_Y
