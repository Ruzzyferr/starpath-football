import { describe, expect, it } from 'vitest'
import { passPercent, relBand, relGroup, relTrend } from './relationView'

describe('relationView', () => {
  it('bands follow the 5 x 40 split', () => {
    expect([-100, -61, -60, -21, -20, 0, 20, 21, 60, 61, 100].map(relBand)).toEqual(
      ['enemy', 'enemy', 'cold', 'cold', 'neutral', 'neutral', 'neutral', 'warm', 'warm', 'loyal', 'loyal'],
    )
  })
  it('teammate pass effect is asymmetric', () => {
    expect(passPercent(-100)).toBe(-40)
    expect(passPercent(100)).toBe(30)
    expect(passPercent(0)).toBe(0)
  })
  it('groups', () => {
    expect(relGroup('teammate')).toBe('team')
    expect(relGroup('manager')).toBe('boss')
    expect(relGroup('partner')).toBe('close')
    expect(relGroup('press')).toBe('public')
  })
  it('trend sums the last 4 weeks of the ledger', () => {
    const log = [
      { w: 50, d: 3, v: 10, cause: 'match', why: 'x' },
      { w: 49, d: -1, v: 7, cause: 'decay', why: 'x' },
      { w: 20, d: 9, v: 8, cause: 'event', why: 'x' },
    ] as never
    expect(relTrend({ log }, 50)).toEqual({ trend: 'up', delta: 2 })
    expect(relTrend({ log: [] }, 50).trend).toBe('flat')
    expect(relTrend({ log: [{ w: 49, d: -4, v: 0, cause: 'decay', why: 'x' }] as never }, 50).trend).toBe('down')
  })
})
