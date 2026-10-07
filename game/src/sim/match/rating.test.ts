import { Rng } from '../../core/rng'
import { autoResolve, outcomeProbabilities } from './autoResolve'
import { clampRating, finalRatingAdjustment, highlightRatingDelta, npcRating, pickMotm, roundRating } from './rating'
import { makeAttributes } from './testFixtures'
import type { HighlightKind } from './types'

describe('rating', () => {
  it('clamps to 1–10', () => {
    expect(clampRating(-3)).toBe(1)
    expect(clampRating(14)).toBe(10)
    expect(roundRating(6.04)).toBe(6)
  })

  it('rewards goals and punishes red cards', () => {
    const base = { passes: 0, passesCompleted: 0, shots: 1, shotsOnTarget: 1, dribbles: 0, tackles: 0 }
    expect(highlightRatingDelta('one_on_one', { ...base, outcome: 'goal' })).toBeGreaterThan(0.9)
    expect(highlightRatingDelta('defend', { ...base, outcome: 'foul_committed', card: 'red' })).toBeLessThan(-1.5)
    expect(highlightRatingDelta('gk_penalty', { ...base, outcome: 'defended' })).toBeGreaterThan(0.6)
  })

  it('npc ratings stay in range for extreme inputs', () => {
    const extreme = npcRating({ position: 'ST', minutes: 90, goals: 9, assists: 5, shotsOnTarget: 12, saves: 0, yellow: 0, red: 0, ownGoals: 0, goalsFor: 12, goalsAgainst: 0, noise: 1 })
    const awful = npcRating({ position: 'GK', minutes: 90, goals: 0, assists: 0, shotsOnTarget: 0, saves: 0, yellow: 1, red: 1, ownGoals: 3, goalsFor: 0, goalsAgainst: 9, noise: -1 })
    expect(extreme).toBe(10)
    expect(awful).toBeGreaterThanOrEqual(1)
    expect(awful).toBeLessThan(4)
  })

  it('final adjustment favours wins and clean sheets, scaled by minutes', () => {
    const ctx = { position: 'CB' as const, minutes: 90, goalsFor: 1, goalsAgainst: 0, passes: 0, passesCompleted: 0, saves: 0 }
    expect(finalRatingAdjustment(ctx)).toBeCloseTo(0.65)
    expect(finalRatingAdjustment({ ...ctx, minutes: 45 })).toBeCloseTo(0.325)
    expect(finalRatingAdjustment({ ...ctx, goalsFor: 0, goalsAgainst: 3 })).toBeLessThan(0)
  })

  it('picks the man of the match among players with ≥ 20 minutes', () => {
    expect(pickMotm([
      { id: 'a', rating: 9.5, minutes: 10, won: true },
      { id: 'b', rating: 8.0, minutes: 90, won: false },
      { id: 'c', rating: 7.9, minutes: 90, won: true },
    ])).toBe('c')
  })
})

describe('autoResolve', () => {
  const kinds: HighlightKind[] = ['build_up', 'counter', 'one_on_one', 'cross', 'edge_of_box', 'freekick', 'penalty', 'corner', 'defend', 'gk_save', 'gk_penalty']

  it.each(kinds)('%s probabilities sum to 1', (kind) => {
    const attrs = makeAttributes(new Rng(1), 'ST', 65)
    const sum = Object.values(outcomeProbabilities(kind, attrs, 1)).reduce((a, b) => a + (b ?? 0), 0)
    expect(sum).toBeCloseTo(1, 6)
  })

  it('better attributes and easier difficulty raise the goal chance', () => {
    const weak = makeAttributes(new Rng(2), 'ST', 45)
    const strong = makeAttributes(new Rng(2), 'ST', 85)
    const p = (a: typeof weak, d: number) => outcomeProbabilities('one_on_one', a, d).goal ?? 0
    expect(p(strong, 1)).toBeGreaterThan(p(weak, 1) + 0.1)
    expect(p(strong, 0.8)).toBeGreaterThan(p(strong, 1.3))
  })

  it('produces internally consistent micro-stats', () => {
    const rng = new Rng(3)
    const attrs = makeAttributes(rng, 'CM', 70)
    for (let i = 0; i < 2000; i++) {
      const kind = rng.pick(kinds)
      const r = autoResolve(kind, attrs, 1, rng)
      expect(r.passesCompleted).toBeLessThanOrEqual(r.passes)
      expect(r.shotsOnTarget).toBeLessThanOrEqual(r.shots)
      if (r.outcome === 'goal' || r.outcome === 'saved') expect(r.shotsOnTarget).toBeGreaterThanOrEqual(1)
      if (kind === 'gk_save') expect(['defended', 'conceded']).toContain(r.outcome)
    }
  })
})
