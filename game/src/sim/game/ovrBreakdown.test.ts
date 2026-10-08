import { describe, expect, it } from 'vitest'
import type { Attributes, Position } from '../../core/types'
import { POSITION_WEIGHTS } from '../career/progression'
import { ovrBreakdown } from './ovrBreakdown'

const attrs = (v: number): Attributes => new Proxy({} as Attributes, { get: (_t, k) => (typeof k === 'string' ? v + (k.length % 7) : 0) })

describe('ovrBreakdown', () => {
  for (const pos of Object.keys(POSITION_WEIGHTS) as Position[]) {
    it(`${pos}: shares sum to 1 and points reproduce OVR`, () => {
      const b = ovrBreakdown(attrs(60), pos)
      expect(b.rows.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1, 6)
      expect(Math.round(b.raw)).toBe(b.ovr)
      for (let i = 1; i < b.rows.length; i++) expect(b.rows[i - 1]!.share).toBeGreaterThanOrEqual(b.rows[i]!.share)
    })
  }
  it('striker is dominated by finishing', () => {
    expect(ovrBreakdown(attrs(50), 'ST').rows[0]!.key).toBe('finishing')
  })
})
