import { describe, expect, it } from 'vitest'
import { NET_COLS, NET_ROWS, clothAt, clothEnergy, clothSettled, createCloth, hitCloth, stepCloth } from './netCloth'

describe('net cloth (2.2#66)', () => {
  it('is a 12×8 grid with pinned edges', () => {
    const c = createCloth(30.34, 37.66, 1.6)
    expect(c.d.length).toBe(NET_COLS * NET_ROWS)
    expect(NET_COLS).toBe(12)
    expect(NET_ROWS).toBe(8)
    hitCloth(c, 34, 0.8, 0.5)
    for (let t = 0; t < 10; t++) stepCloth(c, 1 / 60)
    expect(clothAt(c, 30.34, 0.8)).toBeCloseTo(0, 6)
    expect(clothAt(c, 34, 0)).toBeCloseTo(0, 6)
  })
  it('deforms most at the impact point', () => {
    const c = createCloth(30.34, 37.66, 1.6)
    hitCloth(c, 32, 1, 0.5)
    stepCloth(c, 1 / 60)
    expect(Math.abs(clothAt(c, 32, 1))).toBeGreaterThan(Math.abs(clothAt(c, 36.5, 0.4)))
  })
  it('settles in about 700 ms, independent of frame rate', () => {
    for (const dt of [1 / 30, 1 / 60, 1 / 144]) {
      const c = createCloth(30.34, 37.66, 1.6)
      hitCloth(c, 34, 0.9, 0.55)
      let t = 0
      while (t < 0.3) {
        stepCloth(c, dt)
        t += dt
      }
      expect(clothEnergy(c)).toBeGreaterThan(0.03)
      while (t < 0.72) {
        stepCloth(c, dt)
        t += dt
      }
      expect(clothSettled(c)).toBe(true)
    }
  })
})
