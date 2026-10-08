import { describe, expect, it } from 'vitest'
import {
  CAM_BOUND_M, CAM_MAX_SPEED_PX, LOOK_AHEAD_FRAC, MOMENT_FRAME_MIN_ZOOM, cameraBounds, clampCamera, easeOut, lookAheadOffset, momentFrame,
  nearestPoints, newSpring, springStep,
} from './camera'
import { PPM, TILT, project } from './view'
import { PITCH_LENGTH, PITCH_WIDTH } from '../sim/match/types'

describe('follow spring (2.2#2)', () => {
  it('is critically damped: no overshoot, settles', () => {
    const s = newSpring(0, 0)
    let max = 0
    for (let i = 0; i < 120; i++) {
      springStep(s, 100, 0, 1 / 60, 1)
      max = Math.max(max, s.x)
    }
    expect(max).toBeLessThanOrEqual(100.0001)
    expect(s.x).toBeGreaterThan(99)
  })

  it('caps on-screen speed at 1200 px/s', () => {
    for (const zoom of [0.5, 1, 2]) {
      const s = newSpring(0, 0)
      let prev = 0
      for (let i = 0; i < 60; i++) {
        springStep(s, 1e5, 0, 1 / 60, zoom)
        expect(((s.x - prev) * 60) * zoom).toBeLessThanOrEqual(CAM_MAX_SPEED_PX + 1e-6)
        prev = s.x
      }
    }
  })

  it('is frame-rate independent (fixed 60 Hz steps)', () => {
    const a = newSpring(0, 0)
    const b = newSpring(0, 0)
    for (let i = 0; i < 60; i++) springStep(a, 50, 30, 1 / 60, 1)
    for (let i = 0; i < 20; i++) springStep(b, 50, 30, 1 / 20, 1)
    expect(a.x).toBeCloseTo(b.x, 6)
    expect(a.y).toBeCloseTo(b.y, 6)
  })
})

describe('look-ahead (2.2#3)', () => {
  const view = { w: 1280, h: 720 }
  it('leads 18% of the screen along the carrier run at full speed', () => {
    // Running up the pitch (toward the opponent goal) = up the screen.
    const o = lookAheadOffset({ x: 7, y: 0 }, view, 1)
    expect(o.x).toBeCloseTo(0, 6)
    expect(o.y).toBeCloseTo(-LOOK_AHEAD_FRAC * view.h, 6)
    const side = lookAheadOffset({ x: 0, y: 7 }, view, 2)
    expect(side.x).toBeCloseTo((LOOK_AHEAD_FRAC * view.w) / 2, 6)
  })
  it('fades in with speed and is zero when still', () => {
    expect(lookAheadOffset({ x: 0, y: 0 }, view, 1)).toEqual({ x: 0, y: 0 })
    expect(Math.abs(lookAheadOffset({ x: 2, y: 0 }, view, 1).y)).toBeLessThan(LOOK_AHEAD_FRAC * view.h * 0.5)
  })
})

describe('moment-start framing (2.2#4)', () => {
  const view = { w: 1280, h: 700 }
  const base = Math.min(1280 / (38 * PPM), 700 / (24 * PPM * TILT))
  it('holds the ball, the hero and the three nearest options', () => {
    const ball = { x: 60, y: 30 }
    const hero = { x: 61, y: 31 }
    const mates = [{ x: 70, y: 20 }, { x: 55, y: 45 }, { x: 80, y: 35 }, { x: 20, y: 10 }]
    const opts = nearestPoints(ball, mates, 3)
    expect(opts).not.toContainEqual({ x: 20, y: 10 })
    const f = momentFrame(ball, hero, opts, view, base)
    expect(f.zoomMult).toBeLessThanOrEqual(1)
    expect(f.zoomMult).toBeGreaterThanOrEqual(MOMENT_FRAME_MIN_ZOOM)
    const z = base * f.zoomMult
    for (const p of [ball, hero, ...opts]) {
      const q = project(p.x, p.y)
      expect(Math.abs(q.x - f.x)).toBeLessThanOrEqual(view.w / (2 * z) + 1)
      expect(Math.abs(q.y - f.y)).toBeLessThanOrEqual(view.h / (2 * z) + 1)
    }
  })
  it('eases out over the transition', () => {
    expect(easeOut(0)).toBe(0)
    expect(easeOut(1)).toBe(1)
    expect(easeOut(0.5)).toBeGreaterThan(0.5)
  })
})

describe('camera bounds (2.2#7)', () => {
  it('lets the view spill at most 6 m past the lines', () => {
    const b = cameraBounds()
    expect(b.minX).toBe(-CAM_BOUND_M * PPM)
    expect(b.maxX).toBe((PITCH_WIDTH + CAM_BOUND_M) * PPM)
    const hw = 300
    const hh = 200
    const c = clampCamera(-9999, 9999, hw, hh)
    expect(c.x - hw).toBeCloseTo(-CAM_BOUND_M * PPM, 6)
    expect(c.y + hh).toBeCloseTo(project(-CAM_BOUND_M, 0).y, 6)
    const top = clampCamera(0, -9999, hw, hh)
    expect(top.y - hh).toBeCloseTo(project(PITCH_LENGTH + CAM_BOUND_M, 0).y, 6)
  })
  it('centres when the view is wider than the stadium (ultrawide)', () => {
    const b = cameraBounds()
    const c = clampCamera(0, 0, (b.maxX - b.minX), 100)
    expect(c.x).toBeCloseTo((b.minX + b.maxX) / 2, 6)
  })
})
