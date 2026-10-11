import { describe, expect, it } from 'vitest'
import { Rng } from '../core/rng'
import { ATTRIBUTE_KEYS, type Attributes } from '../core/types'
import { PITCH_LENGTH } from '../sim/match/types'
import {
  analyzeSwipe,
  interpretSwipe,
  leadPosition,
  pickPassTarget,
  planKick,
  shotHeightForPower,
  HEADER_RANGE,
  type GesturePoint,
  type KickRequest,
} from './kick'
import { DEFAULT_ENV, GOAL_CENTER_Y, POST_Y_HIGH, POST_Y_LOW, createBall, createTracker, isOnTarget, predictPlaneCrossing, stepBall } from './physics'

const attrs = (v: number): Attributes => Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, v])) as Attributes

function path(points: [number, number][], dur: number): GesturePoint[] {
  return points.map(([x, y], i) => ({ sx: x, sy: y, wx: x * 40, wy: y * 40, t: (dur * i) / (points.length - 1) }))
}

function shotReq(over: Partial<KickRequest> = {}): KickRequest {
  return {
    kind: 'shot',
    from: { x: PITCH_LENGTH - 18, y: GOAL_CENTER_Y },
    target: { x: PITCH_LENGTH, y: GOAL_CENTER_Y + 2 },
    power: 0.8,
    curl: 0,
    attrs: attrs(70),
    pressure: 0,
    assist: 'manual',
    env: DEFAULT_ENV,
    ...over,
  }
}

function landing(plan: { vx: number; vy: number; vz: number; spin: { side: number; top: number } }, from: { x: number; y: number }, z = 0) {
  const b = createBall(from.x, from.y, z)
  b.vx = plan.vx
  b.vy = plan.vy
  b.vz = plan.vz
  b.spin = { ...plan.spin }
  return b
}

describe('swipe analysis', () => {
  it('straight swipe → direction, no curl', () => {
    const f = analyzeSwipe(path([[0, 0], [0.1, 0], [0.2, 0], [0.4, 0]], 0.25))
    expect(f.dir.x).toBeCloseTo(1)
    expect(f.curl).toBe(0)
    expect(f.isTap).toBe(false)
    expect(f.power).toBeGreaterThan(0.4)
  })

  it('curved swipe → signed curl', () => {
    const a = analyzeSwipe(path([[0, 0], [0.15, 0.08], [0.3, 0.08], [0.45, 0]], 0.3))
    const b = analyzeSwipe(path([[0, 0], [0.15, -0.08], [0.3, -0.08], [0.45, 0]], 0.3))
    expect(a.curl).not.toBe(0)
    expect(Math.sign(a.curl)).toBe(-Math.sign(b.curl))
  })

  it('longer/faster swipes are more powerful; tiny ones are taps; short flicks are chips', () => {
    const slow = analyzeSwipe(path([[0, 0], [0.15, 0]], 0.5))
    const fast = analyzeSwipe(path([[0, 0], [0.5, 0]], 0.15))
    expect(fast.power).toBeGreaterThan(slow.power)
    expect(analyzeSwipe(path([[0, 0], [0.01, 0]], 0.1)).isTap).toBe(true)
    expect(analyzeSwipe(path([[0, 0], [0, -0.1]], 0.1)).chip).toBe(true)
    expect(analyzeSwipe(path([[0, 0], [0.3, 0]], 0.4), 2).chip).toBe(true)
  })
})

describe('kick planning', () => {
  it('noiseless shot reaches the aimed point on the goal line', () => {
    const req = shotReq()
    const plan = planKick(req)
    const c = predictPlaneCrossing(landing(plan, req.from), DEFAULT_ENV, PITCH_LENGTH)!
    expect(c).not.toBeNull()
    expect(Math.abs(c.y - (GOAL_CENTER_Y + 2))).toBeLessThan(0.3)
    expect(isOnTarget(c.y, c.z)).toBe(true)
  })

  it('curled shot still ends at the target but bends', () => {
    const req = shotReq({ curl: 1, target: { x: PITCH_LENGTH, y: GOAL_CENTER_Y - 2.5 } })
    const plan = planKick(req)
    const c = predictPlaneCrossing(landing(plan, req.from), DEFAULT_ENV, PITCH_LENGTH)!
    expect(Math.abs(c.y - (GOAL_CENTER_Y - 2.5))).toBeLessThan(0.4)
    expect(Math.abs(plan.spin.side)).toBeGreaterThan(20)
    // launch heading differs from straight line
    const straight = planKick(shotReq({ target: req.target }))
    expect(Math.abs(Math.atan2(plan.vy, plan.vx) - Math.atan2(straight.vy, straight.vx))).toBeGreaterThan(0.02)
  })

  it('overhit shots go higher', () => {
    expect(shotHeightForPower(1.1)).toBeGreaterThan(2.44)
    expect(shotHeightForPower(0.8)).toBeLessThan(2.0)
  })

  it('full assist shrinks an off-frame miss by a share (no snapping); manual does not', () => {
    const cross = (target: { x: number; y: number }, assist: 'full' | 'half' | 'manual', assistPull?: number) =>
      predictPlaneCrossing(landing(planKick(shotReq({ target, assist, assistPull })), shotReq().from), DEFAULT_ENV, PITCH_LENGTH)!
    // Just wide: pulled back on target with full assist, still wide manually.
    // (0.3 m: build 9's Shot Power slope makes a 70 strike a touch faster; +0.4 m sat right on the assist's edge.)
    const slightly = { x: PITCH_LENGTH, y: POST_Y_HIGH + 0.3 }
    expect(isOnTarget(cross(slightly, 'full').y, cross(slightly, 'full').z)).toBe(true)
    expect(isOnTarget(cross(slightly, 'manual').y, cross(slightly, 'manual').z)).toBe(false)
    // Well wide: full assist cuts the error but a wild aim still misses (skill matters)…
    const wide = { x: PITCH_LENGTH, y: POST_Y_HIGH + 3 }
    const f = cross(wide, 'full')
    const m = cross(wide, 'manual')
    expect(Math.abs(f.y - POST_Y_HIGH)).toBeLessThan(Math.abs(m.y - POST_Y_HIGH))
    expect(isOnTarget(f.y, f.z)).toBe(false)
    // …unless easy mode's generous pull is used.
    const e = cross(wide, 'full', 0.95)
    expect(isOnTarget(e.y, e.z)).toBe(true)
  })

  it('skilled kickers are more accurate than poor ones (noise)', () => {
    const spread = (v: number) => {
      const rng = new Rng(42)
      let s = 0
      for (let i = 0; i < 200; i++) {
        const p = planKick(shotReq({ attrs: attrs(v) }), rng)
        s += Math.abs(Math.atan2(p.vy, p.vx))
      }
      return s
    }
    expect(spread(90)).toBeLessThan(spread(30))
  })

  it('ground pass arrives at a sensible speed', () => {
    const from = { x: 40, y: 34 }
    const plan = planKick({ ...shotReq(), kind: 'pass', from, target: { x: 60, y: 34 }, power: 0.5 })
    expect(plan.vz).toBe(0)
    const b = landing(plan, from)
    const tr = createTracker()
    let t = 0
    while (b.x < 60 && t < 5) {
      stepBall(b, DEFAULT_ENV, tr, [])
      t += 1 / 60
    }
    expect(b.x).toBeGreaterThanOrEqual(60)
    expect(Math.hypot(b.vx, b.vy)).toBeGreaterThan(3)
    expect(Math.hypot(b.vx, b.vy)).toBeLessThan(14)
  })

  it('lofted cross lands near target at head height', () => {
    const from = { x: 92, y: 6 }
    const target = { x: 97, y: 34 }
    const plan = planKick({ ...shotReq(), kind: 'cross', from, target, power: 0.7 })
    const b = landing(plan, from)
    const tr = createTracker()
    let best = Infinity
    let zAt = 0
    for (let i = 0; i < 240; i++) {
      stepBall(b, DEFAULT_ENV, tr, [])
      const d = Math.hypot(b.x - target.x, b.y - target.y)
      if (d < best) {
        best = d
        zAt = b.z
      }
    }
    expect(best).toBeLessThan(0.8)
    expect(zAt).toBeGreaterThan(1)
    expect(zAt).toBeLessThan(2.6)
  })
})

describe('targeting', () => {
  it('lead position goes ahead of a running receiver', () => {
    const p = leadPosition({ x: 40, y: 34 }, { id: 'a', pos: { x: 55, y: 34 }, vel: { x: 6, y: 0 } }, 15)
    expect(p.x).toBeGreaterThan(56)
  })

  it('picks the teammate in the swipe cone', () => {
    const mates = [
      { id: 'up', pos: { x: 50, y: 20 }, vel: { x: 0, y: 0 } },
      { id: 'down', pos: { x: 50, y: 48 }, vel: { x: 0, y: 0 } },
    ]
    const t = pickPassTarget({ x: 40, y: 34 }, { x: 0.6, y: 0.8 }, mates, [], 'full')
    expect(t?.id).toBe('down')
    expect(pickPassTarget({ x: 40, y: 34 }, { x: -1, y: 0 }, mates, [], 'manual')).toBeNull()
  })

  it('swipe toward goal from range is a shot; sideways toward mate is a pass', () => {
    const sw = analyzeSwipe(path([[0, 0], [0.4, 0]], 0.2))
    const mates = [{ id: 'm', pos: { x: 80, y: 50 }, vel: { x: 0, y: 0 } }]
    const m = interpretSwipe(sw, { x: 85, y: 34 }, mates, [], 'full')
    expect(m.kind).toBe('shot')
    const side = analyzeSwipe(path([[0, 0], [-0.2, 0.3]], 0.2))
    // world dir from path mapping (x*40,y*40) → (-0.55,0.83)
    const m2 = interpretSwipe(side, { x: 85, y: 34 }, mates, [], 'full')
    expect(m2.kind).toBe('pass')
  })

  it('posts are symmetric around goal centre', () => {
    expect(GOAL_CENTER_Y - POST_Y_LOW).toBeCloseTo(POST_Y_HIGH - GOAL_CENTER_Y)
  })
})

describe('heading range (WP-13 #4, 2.1#71)', () => {
  /** Distance from `from` at which the ball first comes down to the grass. */
  function carry(fromX: number): number {
    const from = { x: fromX, y: GOAL_CENTER_Y }
    const plan = planKick(shotReq({ kind: 'header', from, fromZ: 2, target: { x: PITCH_LENGTH, y: GOAL_CENTER_Y + 1 }, targetZ: 0.6, power: 1 }))
    const b = landing(plan, from, 2)
    const tr = createTracker()
    for (let i = 0; i < 600; i++) {
      stepBall(b, DEFAULT_ENV, tr, [])
      if (b.z <= 0.12 && b.vz <= 0.5) break
    }
    return Math.hypot(b.x - from.x, b.y - from.y)
  }

  it('a header never carries further than HEADER_RANGE', () => {
    expect(HEADER_RANGE).toBe(18)
    expect(carry(PITCH_LENGTH - 26)).toBeLessThan(HEADER_RANGE + 1)
    expect(carry(PITCH_LENGTH - 34)).toBeLessThan(HEADER_RANGE + 1)
  })

  it('inside the range a header still reaches the goal', () => {
    const from = { x: PITCH_LENGTH - 9, y: GOAL_CENTER_Y }
    const plan = planKick(shotReq({ kind: 'header', from, fromZ: 2, target: { x: PITCH_LENGTH, y: GOAL_CENTER_Y + 1 }, targetZ: 0.6, power: 1 }))
    const c = predictPlaneCrossing(landing(plan, from, 2), DEFAULT_ENV, PITCH_LENGTH)
    expect(c).not.toBeNull()
  })
})
