import { describe, expect, it } from 'vitest'
import { fameGain } from './common'
import { seasonStandingFame, stageForTier, STANDING_MIN_APPS } from './reputation'

const stats = (apps: number, avg: number, motm: number) => ({ apps, ratingSum: apps * avg, motm })

describe('season standing fame (non-goal reputation)', () => {
  it('needs a body of work', () => {
    expect(seasonStandingFame({ stats: stats(STANDING_MIN_APPS - 1, 8, 5), leagueTier: 1 }).total).toBe(0)
  })

  it('pays a tier-1 regular far more than a tier-3 youngster with the same numbers', () => {
    const top = seasonStandingFame({ stats: stats(30, 7.2, 5), leagueTier: 1 }).total
    const low = seasonStandingFame({ stats: stats(30, 7.2, 5), leagueTier: 3 }).total
    expect(top).toBeGreaterThan(3)
    expect(low).toBeLessThan(top * 0.35)
  })

  it('grows with consistency and MOTMs, with caps', () => {
    const a = seasonStandingFame({ stats: stats(30, 6.9, 2), leagueTier: 1 }).total
    const b = seasonStandingFame({ stats: stats(30, 7.4, 8), leagueTier: 1 }).total
    const c = seasonStandingFame({ stats: stats(30, 9.9, 40), leagueTier: 1 }).total
    expect(b).toBeGreaterThan(a)
    expect(c).toBeLessThanOrEqual(4 + 12 * 0.22 + 0.01)
    expect(seasonStandingFame({ stats: stats(30, 7.2, 5), leagueTier: 1, clubReputation: 90 }).total).toBeGreaterThan(seasonStandingFame({ stats: stats(30, 7.2, 5), leagueTier: 1, clubReputation: 60 }).total * 2)
    expect(seasonStandingFame({ stats: stats(30, 6.4, 0), leagueTier: 1 }).total).toBe(0)
  })

  it('continental football adds a flat bonus; still saturates through fameGain', () => {
    const base = seasonStandingFame({ stats: stats(30, 7.2, 5), leagueTier: 1 }).total
    const cont = seasonStandingFame({ stats: stats(30, 7.2, 5), leagueTier: 1, continental: true }).total
    expect(cont - base).toBeCloseTo(1.5, 5)
    expect(fameGain(90, cont)).toBeLessThan(cont * 0.11)
  })

  it('stage table', () => {
    expect(stageForTier(1)).toBe(1)
    expect(stageForTier(2)).toBeGreaterThan(stageForTier(3))
    expect(stageForTier(null)).toBe(0)
  })
})
