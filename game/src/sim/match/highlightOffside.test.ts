import { describe, expect, it } from 'vitest'
import { MatchSim } from './engine'
import { highlightRatingDelta } from './rating'
import { makeSetup } from './testFixtures'
import type { HighlightResult } from './types'

const blank = (outcome: HighlightResult['outcome']): HighlightResult => ({
  outcome, passes: 0, passesCompleted: 0, shots: 0, shotsOnTarget: 0, dribbles: 0, tackles: 0,
})

function attackingMoment(seed: number) {
  const sim = new MatchSim(makeSetup({ seed, heroSide: 'home', home: { heroPosition: 'ST', formation: '4-4-2' } }), 'en')
  while (!sim.pendingHighlight || ['defend', 'gk_save', 'gk_penalty', 'penalty', 'freekick', 'corner'].includes(sim.pendingHighlight.kind)) {
    if (sim.finished) throw new Error('no attacking highlight')
    if (sim.pendingHighlight) sim.skipHighlight()
    else sim.step()
  }
  return sim
}

describe('MatchSim: offside from an interactive moment', () => {
  it('a team-mate flagged offside produces an offside event naming him (no lost-ball line)', () => {
    const sim = attackingMoment(21)
    const h = sim.pendingHighlight!
    const mate = h.scenario.players.find((p) => p.side === h.side && !p.isHero && p.role !== 'GK')!
    const ev = sim.resolveHighlight({ ...blank('lost_ball'), passes: 1, offside: { playerId: mate.id, byHero: false } })
    const off = ev.find((e) => e.type === 'offside')
    expect(off).toBeDefined()
    expect(off!.side).toBe('home')
    expect(off!.playerId).toBe(mate.id)
    expect(off!.text.length).toBeGreaterThan(0)
  })

  it('the hero flagged offside is named in the event', () => {
    const sim = attackingMoment(22)
    const ev = sim.resolveHighlight({ ...blank('lost_ball'), offside: { playerId: 'hero', byHero: true } })
    expect(ev.some((e) => e.type === 'offside' && e.playerId === 'hero')).toBe(true)
  })

  it('rating: a team-mate offside costs the hero less than his own offside', () => {
    const mate = highlightRatingDelta('build_up', { ...blank('lost_ball'), offside: { playerId: 'x', byHero: false } })
    const own = highlightRatingDelta('build_up', { ...blank('lost_ball'), offside: { playerId: 'hero', byHero: true } })
    expect(mate).toBeGreaterThan(own)
    expect(own).toBe(highlightRatingDelta('build_up', blank('lost_ball')))
  })
})
