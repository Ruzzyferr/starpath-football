/**
 * Build 9 (owner: graded success, flat kinds rise, easy kinds are fair, sloppy is sloppy). Pins the graded tiers
 * (sim/match/tier) and their rating. The per-kind matrix checks (band, stats, sloppy gap, opponent) live in
 * kindChecks.a–d.test.ts — docs/BALANCE.md "Build 9". Success = full + partial.
 */
import { describe, expect, it } from 'vitest'
import { highlightRatingDelta } from '../sim/match/rating'
import { GOAL_KINDS, PARTIAL_SHARE, isFullSuccess, momentTier } from '../sim/match/tier'
import type { HighlightResult } from '../sim/match/types'

const res = (o: Partial<HighlightResult>): HighlightResult => ({ outcome: 'missed', passes: 0, passesCompleted: 0, shots: 1, shotsOnTarget: 0, dribbles: 0, tackles: 0, ...o })

describe('build 9: graded success', () => {
  it('goal = full, a placed save / the woodwork / a chance created = partial, the rest = fail', () => {
    expect(momentTier('long_shot', res({ outcome: 'goal' }))).toBe('full')
    expect(momentTier('long_shot', res({ outcome: 'saved', chance: true }))).toBe('partial')
    expect(momentTier('long_shot', res({ outcome: 'saved', chance: false }))).toBe('fail')
    expect(momentTier('freekick', res({ outcome: 'woodwork', chance: false }))).toBe('partial')
    expect(momentTier('cross', res({ outcome: 'lost_ball', chance: true }))).toBe('partial')
    expect(momentTier('timed_run', res({ outcome: 'lost_ball', chance: true }))).toBe('partial')
    expect(momentTier('one_on_one', res({ outcome: 'missed', chance: false }))).toBe('fail')
    // An offside flag kills it; a saved penalty is a missed penalty.
    expect(momentTier('timed_run', res({ outcome: 'lost_ball', chance: true, offside: { playerId: 'h', byHero: true } }))).toBe('fail')
    expect(momentTier('penalty', res({ outcome: 'saved', chance: true }))).toBe('fail')
    expect(momentTier('penalty', res({ outcome: 'woodwork', chance: true }))).toBe('fail')
    // Skipped (auto-resolved) moments carry no chance detail: their save is on target.
    expect(momentTier('edge_of_box', res({ outcome: 'saved' }))).toBe('partial')
    // Kinds that are not about a goal keep their own rule.
    expect(momentTier('defend', res({ outcome: 'defended' }))).toBe('full')
    expect(momentTier('defend', res({ outcome: 'shot_conceded', chance: true }))).toBe('fail')
    expect(isFullSuccess('dribble', 'pass_complete')).toBe(true)
  })

  it('a partial success earns half a goal’s rating (and through it form / XP / trust)', () => {
    for (const k of GOAL_KINDS) {
      const goal = highlightRatingDelta(k, res({ outcome: 'goal', tier: 'full' }))
      const part = highlightRatingDelta(k, res({ outcome: 'saved', tier: 'partial' }))
      const fail = highlightRatingDelta(k, res({ outcome: 'missed', tier: 'fail' }))
      expect(part).toBeGreaterThan(fail)
      expect(part).toBeLessThan(goal)
      expect(part).toBeGreaterThanOrEqual(PARTIAL_SHARE * (goal - 0.031) - 0.01)
    }
  })
})
