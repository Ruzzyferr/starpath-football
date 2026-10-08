import { describe, expect, it } from 'vitest'
import { makeGame } from './testHelpers'
import { whyPlaying } from './whyPlaying'
import { startProbability } from '../career/squadRole'

describe('whyPlaying', () => {
  it('reports the real start chance with at most 3 factors including the merit gap', () => {
    const s = makeGame(11)
    const w = whyPlaying(s)
    expect(w).not.toBeNull()
    expect(w!.chance).toBeCloseTo(startProbability(s.hero, s.life), 6)
    expect(w!.factors.length).toBeGreaterThan(0)
    expect(w!.factors.length).toBeLessThanOrEqual(3)
    expect(w!.factors.some((f) => f.key === 'merit' || f.key === 'role')).toBe(true)
  })
  it('explains an injury as the only reason', () => {
    const s = makeGame(12)
    s.hero.injury = { kind: 'x', weeksLeft: 3 } as never
    const w = whyPlaying(s)!
    expect(w.chance).toBe(0)
    expect(w.factors[0]!.key).toBe('injury')
  })
  it('lists fatigue as an actionable negative', () => {
    const s = makeGame(13)
    s.hero.fatigue = 95
    const f = whyPlaying(s)!.factors.find((x) => x.key === 'fatigue')
    expect(f?.points).toBeLessThan(0)
    expect(f?.actionable).toBe(true)
  })
})
