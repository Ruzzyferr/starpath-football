import { describe, expect, it } from 'vitest'
import { Rng } from '../../core/rng'
import { counterOffer, startNegotiation, type NegotiationState } from '../career/contract'
import { previewPatience } from './patienceEstimate'

function open(): NegotiationState {
  const terms = { wage: 10_000, years: 3, signingBonus: 20_000, goalBonus: 500, assistBonus: 250, releaseClause: 5_000_000, role: 'starter' as const }
  const offer = { id: 'o', clubId: 'c', clubName: 'Club', kind: 'transfer', loan: false, terms } as never
  return startNegotiation(new Rng(7), offer, { birthYear: 2008, perks: [] } as never, { agent: { quality: 2 } as never, season: 2027 })
}

describe('previewPatience', () => {
  it('asking for nothing extra costs nothing', () => {
    const s = open()
    expect(previewPatience(s, {})).toEqual({ drain: 0, walk: false })
  })
  it('a greedy ask drains more than a modest one and may end the talks', () => {
    const s = open()
    const modest = previewPatience(s, { wage: Math.round(s.offer.terms.wage * 1.02) })
    const greedy = previewPatience(s, { wage: s.offer.terms.wage * 3 })
    expect(greedy.drain).toBeGreaterThanOrEqual(modest.drain)
    expect(greedy.walk).toBe(true)
  })
  it('matches the real drain within one band and never mutates the state', () => {
    const s = open()
    const snap = JSON.stringify(s)
    const ask = { wage: Math.round(s.offer.terms.wage * 1.1) }
    const p = previewPatience(s, ask)
    expect(JSON.stringify(s)).toBe(snap)
    const real = counterOffer(new Rng(99), s, ask).state
    if (!p.walk) expect(Math.abs(Math.round(s.patience) - Math.round(real.patience) - p.drain)).toBeLessThanOrEqual(3)
  })
})
