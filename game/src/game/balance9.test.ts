/**
 * Build 9 (owner: graded success, flat kinds rise, easy kinds are fair, sloppy is sloppy). Pins the graded tiers
 * and the all-kinds matrix (game/kindMatrix: human-like bot, half assist, normal; N = 60 per cell, deterministic
 * seeds) — docs/BALANCE.md "Build 9". Success = full + partial (sim/match/tier).
 */
import { describe, expect, it } from 'vitest'
import { highlightRatingDelta } from '../sim/match/rating'
import { GOAL_KINDS, PARTIAL_SHARE, isFullSuccess, momentTier } from '../sim/match/tier'
import type { HighlightResult } from '../sim/match/types'
import type { FeelKind } from './feelHarness'
import { matrixRates, type MatrixInput, type OppStrength } from './kindMatrix'

const N = 60
const rate = (k: FeelKind, lv: number | null, input: MatrixInput = 'good', opp: OppStrength = 'average') => matrixRates(k, lv, input, opp, N)
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

describe('build 9: goal-oriented moments are achievable, goals stay realistic', () => {
  for (const k of ['one_on_one', 'penalty', 'freekick', 'edge_of_box', 'cross', 'long_shot', 'counter_2v1'] as FeelKind[]) {
    it(`${k}: a starting hero with good input succeeds ≥ 50 % against average opposition`, () => {
      const r = rate(k, null)
      expect(r.success).toBeGreaterThanOrEqual(0.5)
      // Goals stay goals: never all of it.
      if (k !== 'penalty') expect(r.full).toBeLessThan(0.75)
    }, 300_000)
  }
})

/** Non-decreasing within `tol` (N = 60 sampling noise between neighbouring levels). */
const rising = (xs: readonly number[], tol = 0.04) => xs.every((x, i) => i === 0 || x >= xs[i - 1]! - tol)

describe('build 9: kinds rise with their own attributes (40 → 65 → 90, success; goals for the strike kinds)', () => {
  const cases: [FeelKind, 'success' | 'full', number][] = [
    ['edge_of_box', 'success', 0.3], ['penalty', 'success', 0.1], ['long_shot', 'full', 0.15], ['freekick', 'full', 0.1],
    ['block', 'success', 0.08], ['gk_distribution', 'success', 0.05], ['corner', 'success', 0.25], ['header', 'success', 0.25],
    ['defend', 'success', 0.3], ['defend_1v1', 'success', 0.2], ['recovery_run', 'success', 0.15], ['shoulder_duel', 'success', 0.3],
    ['dribble', 'success', 0.3], ['hold_up', 'success', 0.05], ['long_ball_control', 'success', 0.1],
  ]
  for (const [k, what, spread] of cases) {
    it(`${k}: ${what} rises by ≥ ${Math.round(spread * 100)} points`, () => {
      const r = [40, 65, 90].map((lv) => rate(k, lv)[what])
      expect(rising(r)).toBe(true)
      expect(r[2]! - r[0]!).toBeGreaterThanOrEqual(spread)
    }, 300_000)
  }
})

describe('build 9: the too-easy kinds are fair for a starting hero (55–78 %), and the opposition matters', () => {
  for (const k of ['defend', 'defend_1v1', 'fk_wall', 'gk_sweep', 'recovery_run'] as FeelKind[]) {
    it(`${k}: good input vs average opposition in band; strong opposition lower`, () => {
      const r = rate(k, null).success
      expect(r).toBeGreaterThanOrEqual(0.5)
      expect(r).toBeLessThanOrEqual(0.78)
      expect(rate(k, null, 'good', 'strong').success).toBeLessThan(rate(k, null, 'good', 'weak').success)
    }, 300_000)
  }
})

describe('build 9: sloppy input is sloppy in defence and in goal', () => {
  for (const [k, gap] of [['defend_1v1', 0.12], ['gk_save', 0.08], ['gk_1v1', 0.08], ['hold_up', 0.15], ['penalty', 0.25], ['edge_of_box', 0.12]] as [FeelKind, number][]) {
    it(`${k}: good − sloppy ≥ ${Math.round(gap * 100)} points`, () => {
      expect(rate(k, null).success - rate(k, null, 'sloppy').success).toBeGreaterThanOrEqual(gap)
    }, 300_000)
  }
})
