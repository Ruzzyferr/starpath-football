import { describe, expect, it } from 'vitest'
import { CROSS_CAM_ZOOM, CROSS_FIT_MIN_ZOOM, FIT_METERS_ACROSS, FIT_METERS_AHEAD, PPM, TILT, FIT_BY_DISTANCE, crossCamFit, crossCamFrame, fitZoom, project, resolveCameraDistance, unproject, type CameraDistance } from './view'

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

describe('camera distance', () => {
  const modes: CameraDistance[] = ['far', 'normal', 'close']
  const sizes = [[1280, 720], [2560, 720], [800, 800], [390, 780], [390, 700], [1920, 400], [768, 1024]] as const
  it('Auto is Close on phone portrait and Normal elsewhere', () => {
    expect(resolveCameraDistance('auto', 390, 844)).toBe('close')
    expect(resolveCameraDistance('auto', 768, 1024)).toBe('normal')
    expect(resolveCameraDistance('auto', 1280, 720)).toBe('normal')
    expect(resolveCameraDistance(undefined, 844, 390)).toBe('normal')
    expect(resolveCameraDistance('far', 390, 844)).toBe('far')
  })
  it('keeps each mode design window on every aspect ratio and orders far < normal < close', () => {
    for (const [w, vh] of sizes) {
      const zs = modes.map((m) => fitZoom(w, vh, w >= vh, m))
      for (let i = 0; i < modes.length; i++) {
        const f = FIT_BY_DISTANCE[modes[i]]
        expect(vh / (zs[i] * PPM * TILT)).toBeGreaterThanOrEqual(f.ahead - 1e-6)
        expect(w / (zs[i] * PPM)).toBeGreaterThanOrEqual((w >= vh ? f.landscape : f.portrait) - 1e-6)
      }
      expect(zs[0]).toBeLessThanOrEqual(zs[1])
      expect(zs[1]).toBeLessThanOrEqual(zs[2])
    }
  })
  it('Close on a 390x844 phone makes figures >= 20 px (14 px at Normal)', () => {
    const hudTop = 44
    const ratio = fitZoom(390, 844 - hudTop, false, 'close') / fitZoom(390, 844 - hudTop, false, 'normal')
    expect(14 * ratio).toBeGreaterThanOrEqual(20)
  })
  it('touch aiming inverts the camera transform in every mode', () => {
    const [w, vh] = [390, 700]
    for (const m of modes) {
      const zoom = fitZoom(w, vh, false, m)
      const focus = project(80, 30)
      for (const p of [{ x: 70, y: 25 }, { x: 95, y: 40 }]) {
        const wp = project(p.x, p.y)
        // world -> screen -> world (the camera maps a screen offset from the viewport centre)
        const sx = w / 2 + (wp.x - focus.x) * zoom
        const sy = vh / 2 + (wp.y - focus.y) * zoom
        const back = unproject(focus.x + (sx - w / 2) / zoom, focus.y + (sy - vh / 2) / zoom)
        expect(back.x).toBeCloseTo(p.x, 6)
        expect(back.y).toBeCloseTo(p.y, 6)
      }
    }
  })
})
