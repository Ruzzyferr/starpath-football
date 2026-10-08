/**
 * Moment mix per position (GAP-AUDIT 2.1#85, #119, #124; S21 sweep).
 */
import { describe, expect, it } from 'vitest'
import { Rng } from '../../core/rng'
import type { HighlightKind } from './types'
import { GK_HIGHLIGHTS_MAX_90, HIGHLIGHTS_MIN_90, kindWeights, plannedHighlightCount } from './highlightGen'

const share = (w: Partial<Record<HighlightKind, number>>, ks: HighlightKind[]) => {
  const tot = Object.values(w).reduce((a, v) => a + (v ?? 0), 0)
  return ks.reduce((a, k) => a + (w[k] ?? 0), 0) / tot
}

describe('2.1#119 striker moment mix', () => {
  const w = kindWeights('ST')
  it('has header and dribble moments of its own', () => {
    expect(w.header).toBeGreaterThan(0)
    expect(w.dribble).toBeGreaterThan(0)
  })
  it('≈ 45 % shot (BALANCE-capped, plan 50 %), 20 % header, 20–25 % pass, 10 % dribble', () => {
    expect(share(w, ['counter', 'one_on_one', 'edge_of_box', 'counter_2v1', 'rebound'])).toBeGreaterThan(0.42)
    expect(share(w, ['counter', 'one_on_one', 'edge_of_box', 'counter_2v1', 'rebound'])).toBeLessThan(0.52)
    expect(share(w, ['header', 'corner'])).toBeCloseTo(0.2, 1)
    expect(share(w, ['build_up', 'long_ball_control', 'hold_up'])).toBeGreaterThan(0.18)
    expect(share(w, ['build_up', 'long_ball_control', 'hold_up'])).toBeLessThan(0.26)
    expect(share(w, ['dribble'])).toBeCloseTo(0.1, 1)
  })
})

describe('2.1#124 full-back moments split 50/50', () => {
  for (const pos of ['LB', 'RB'] as const) {
    it(`${pos}: attack and defence shares are 0.5 ± 0.05, back post covered`, () => {
      const w = kindWeights(pos)
      expect(w.back_post).toBeGreaterThan(0)
      const def = share(w, ['defend', 'interception', 'defend_1v1', 'block', 'back_post'])
      expect(Math.abs(def - 0.5)).toBeLessThanOrEqual(0.05)
    })
  }
})

describe('2.1#85 keeper career moments', () => {
  it('keepers draw save, 1v1 and sweeping moments', () => {
    const w = kindWeights('GK')
    expect(Object.keys(w).sort()).toEqual(['gk_1v1', 'gk_save', 'gk_sweep'])
  })
  it('4–8 keeper moments per full match', () => {
    const rng = new Rng(5)
    for (let i = 0; i < 400; i++) {
      const n = plannedHighlightCount({ position: 'GK', relationAvg: rng.range(-100, 100), morale: rng.range(0.8, 1.2), form: rng.range(0, 100), minutes: 90 }, rng)
      expect(n).toBeGreaterThanOrEqual(HIGHLIGHTS_MIN_90)
      expect(n).toBeLessThanOrEqual(GK_HIGHLIGHTS_MAX_90)
    }
  })
})
