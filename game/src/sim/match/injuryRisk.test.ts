import { describe, expect, it } from 'vitest'
import { Rng } from '../../core/rng'
import { ATTRIBUTE_KEYS, type Attributes } from '../../core/types'
import { autoResolve } from './autoResolve'
import { injuryRiskMultiplier } from './injuryRisk'
import { keeperSaveScore } from './rating'

const attrs = Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, 65])) as Attributes

describe('2.3#55 injury risk reaches auto-resolved match moments', () => {
  it('multiplier: fatigue > 80 doubles, wet pitch ×1.2, hard tacklers +30 %', () => {
    expect(injuryRiskMultiplier({ fatigue: 50 })).toBe(1)
    expect(injuryRiskMultiplier({ fatigue: 85 })).toBe(2)
    expect(injuryRiskMultiplier({ fatigue: 50, surface: 'wet', oppTackling: 100 })).toBeCloseTo(1.2 * 1.3, 6)
  })
  it('scales the auto-resolve injury chance', () => {
    const count = (mult: number) => {
      const rng = new Rng(7)
      let n = 0
      for (let i = 0; i < 20000; i++) if (autoResolve('one_on_one', attrs, 1, rng, mult).injured) n++
      return n
    }
    expect(count(0)).toBe(0)
    expect(count(3)).toBeGreaterThan(count(1) * 2)
  })
})

describe('2.3#2 keeper rating: save % and goals prevented', () => {
  it('rewards a high save rate, punishes a sieve, ignores tiny samples', () => {
    expect(keeperSaveScore(2, 0)).toBeCloseTo(0.24, 6)
    expect(keeperSaveScore(6, 0)).toBeGreaterThan(keeperSaveScore(6, 3))
    expect(keeperSaveScore(1, 4)).toBeLessThan(0)
    expect(keeperSaveScore(10, 0)).toBeLessThanOrEqual(1.6)
  })
})
