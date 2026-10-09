import { describe, expect, it } from 'vitest'
import { MatchSim } from './engine'
import { makeSetup } from './testFixtures'

const mk = () => new MatchSim(makeSetup({ seed: 11, heroSide: 'home', home: { heroPosition: 'ST', formation: '4-4-2' } }), 'en')
const mom = (m: MatchSim) => (m as unknown as { s: { momentum: { side: string; from: number } | null } }).s.momentum

describe('applyHeroDecision teamBoost', () => {
  it('sets the hero side momentum only when teamBoost > 0', () => {
    const a = mk()
    for (let i = 0; i < 20; i++) a.step()
    const before = mom(a)
    a.applyHeroDecision(0, false, 0)
    expect(mom(a)).toEqual(before)
    a.applyHeroDecision(0, false, 1)
    expect(mom(a)?.side).toBe('home')
  })
  it('draws no RNG: teamBoost=0 continues identically to a plain call', () => {
    const run = (boost: number | null) => {
      const m = mk()
      for (let i = 0; i < 20; i++) m.step()
      if (boost === null) m.applyHeroDecision(0, false)
      else m.applyHeroDecision(0, false, boost)
      return JSON.stringify(m.simulateToEnd().events)
    }
    expect(run(0)).toBe(run(null))
  })
})
