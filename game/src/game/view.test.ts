import { describe, expect, it } from 'vitest'
import { CROSS_CAM_ZOOM, crossCamFrame } from './view'

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
