import { describe, expect, it } from 'vitest'
import { CROSS_CAM_ZOOM, CROSS_FIT_MIN_ZOOM, FIT_METERS_ACROSS, FIT_METERS_AHEAD, PPM, TILT, crossCamFit, crossCamFrame, fitZoom, project } from './view'

describe('cross camera (WP-13 #4)', () => {
  it('frames between the ball and the drop point, nearer the box, and pulls back', () => {
    const f = crossCamFrame({ x: 90, y: 4 }, { x: 98, y: 36 })
    expect(f.x).toBeGreaterThan(94)
    expect(f.x).toBeLessThan(98)
    expect(f.y).toBeGreaterThan(20)
    expect(f.y).toBeLessThan(36)
    expect(f.zoomMult).toBe(CROSS_CAM_ZOOM)
    expect(CROSS_CAM_ZOOM).toBeLessThan(1)
  })
})

describe('cross camera framing (WP-16)', () => {
  const goal = { x: 105, y: 34, halfWidth: 3.66, height: 2.44 }
  // Live zoom as MatchScene computes it (24 m across in portrait, 40 m in landscape).
  const views = [
    { w: 390, h: 700, base: Math.min(390 / (24 * PPM), 700 / (24 * PPM * TILT)) },
    { w: 1440, h: 800, base: Math.min(1440 / (40 * PPM), 800 / (24 * PPM * TILT)) },
  ]
  it('holds the crosser, the drop point and the goal mouth in one still frame', () => {
    for (const v of views) {
      for (const [from, land] of [[{ x: 92, y: 3 }, { x: 99, y: 33 }], [{ x: 97, y: 64 }, { x: 100, y: 30 }]] as const) {
        const f = crossCamFit(from, land, goal, v, v.base)
        expect(f.zoomMult).toBeLessThanOrEqual(1)
        expect(f.zoomMult).toBeGreaterThanOrEqual(CROSS_FIT_MIN_ZOOM)
        const z = v.base * f.zoomMult
        const inView = (p: { x: number; y: number }) => Math.abs(p.x - f.x) <= v.w / (2 * z) + 1 && Math.abs(p.y - f.y) <= v.h / (2 * z) + 1
        // Landscape fits everything; portrait keeps at least the drop point and goal mouth.
        expect(inView(project(land.x, land.y))).toBe(true)
        expect(inView(project(goal.x, goal.y, goal.height))).toBe(true)
        if (v.w > v.h) expect(inView(project(from.x, from.y))).toBe(true)
      }
    }
  })
})

describe('FIT design area (WP-P 2.9#12)', () => {
  it('keeps the design window visible on every aspect ratio', () => {
    for (const [w, vh] of [[1280, 720], [2560, 720], [800, 800], [390, 780], [1920, 400]] as const) {
      const z = fitZoom(w, vh)
      // At least 24 m of pitch length is always visible ...
      expect(vh / (z * PPM * TILT)).toBeGreaterThanOrEqual(FIT_METERS_AHEAD - 1e-6)
      // ... and never more than the design width across.
      const across = w >= vh ? FIT_METERS_ACROSS.landscape : FIT_METERS_ACROSS.portrait
      expect(w / (z * PPM)).toBeGreaterThanOrEqual(across - 1e-6)
    }
  })
  it('frames the standard landscape and portrait windows by width', () => {
    expect(fitZoom(1520, 900)).toBeCloseTo(1520 / (38 * PPM), 6)
    expect(fitZoom(390, 780)).toBeCloseTo(390 / (21 * PPM), 6)
  })
})
