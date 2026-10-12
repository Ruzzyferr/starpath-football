import { describe, expect, it } from 'vitest'
import { CHANCE_CAP, CHANCE_FLOOR, statChance, statChancePct } from './statChance'

describe('statChance: +1 point → +1 % until the cap (owner rule)', () => {
  it('uncontested: a stat of S is S %', () => {
    for (const s of [10, 40, 50, 62, 80]) expect(statChance(s)).toBeCloseTo(s / 100, 10)
  })

  it('every point is worth exactly 1 % on both sides, until the cap / floor', () => {
    for (let s = 20; s < 85; s++) expect(statChance(s + 1, 62) - statChance(s, 62)).toBeCloseTo(0.01, 10)
    for (let o = 26; o < 100; o++) expect(statChance(60, o) - statChance(60, o + 1)).toBeCloseTo(0.01, 10)
  })

  it('contested: 50 vs 50 is 50 %, 70 vs 62 is 58 %', () => {
    expect(statChance(50, 50)).toBeCloseTo(0.5, 10)
    expect(statChancePct(70, 62)).toBe(58)
  })

  it('caps at 85 % and floors at 5 %', () => {
    expect(statChance(100)).toBe(CHANCE_CAP)
    expect(statChance(99, 20)).toBe(CHANCE_CAP)
    expect(statChance(0)).toBe(CHANCE_FLOOR)
    expect(statChance(10, 99)).toBe(CHANCE_FLOOR)
    expect(CHANCE_CAP).toBeGreaterThanOrEqual(0.8)
    expect(CHANCE_CAP).toBeLessThanOrEqual(0.85)
  })

  it('input quality moves it by its points, inside the bounds', () => {
    expect(statChance(60, 50, 5) - statChance(60, 50)).toBeCloseTo(0.05, 10)
    expect(statChance(60, 50, -10) - statChance(60, 50)).toBeCloseTo(-0.1, 10)
  })
})
