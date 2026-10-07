/**
 * Probability model for highlights the player chooses to skip (auto-sim).
 *
 * Each highlight kind has base outcome weights. The hero's relevant attributes
 * versus the difficulty setting produce a skill term k ∈ [-1, 1] which scales
 * good outcomes up and bad outcomes down. Micro-stats are then derived from the
 * sampled outcome so the result is internally consistent.
 */
import type { Rng } from '../../core/rng'
import { clamp } from '../../core/rng'
import type { AttributeKey, Attributes } from '../../core/types'
import type { HighlightKind, HighlightOutcome, HighlightResult } from './types'

type Outcome = HighlightOutcome
type Weights = Partial<Record<Outcome, number>>

/** Attribute mix that decides how well the hero handles each kind. */
const SKILL_MIX: Record<HighlightKind, Partial<Record<AttributeKey, number>>> = {
  build_up: { passing: 0.35, vision: 0.25, firstTouch: 0.2, composure: 0.2 },
  counter: { pace: 0.3, dribbling: 0.25, finishing: 0.25, vision: 0.2 },
  one_on_one: { finishing: 0.45, composure: 0.35, dribbling: 0.2 },
  cross: { crossing: 0.35, finishing: 0.25, heading: 0.2, composure: 0.2 },
  edge_of_box: { shooting: 0.5, composure: 0.25, finishing: 0.25 },
  freekick: { setPieces: 0.6, shooting: 0.25, composure: 0.15 },
  penalty: { composure: 0.5, finishing: 0.3, setPieces: 0.2 },
  corner: { heading: 0.45, jumping: 0.3, strength: 0.25 },
  defend: { tackling: 0.4, positioning: 0.3, pace: 0.15, strength: 0.15 },
  gk_save: { reflexes: 0.45, positioning: 0.3, handling: 0.25 },
  gk_penalty: { reflexes: 0.6, composure: 0.2, positioning: 0.2 },
  counter_2v1: { pace: 0.25, finishing: 0.3, vision: 0.25, dribbling: 0.2 },
  long_ball_control: { firstTouch: 0.4, strength: 0.2, composure: 0.2, jumping: 0.1, agility: 0.1 },
  rebound: { finishing: 0.35, agility: 0.25, positioning: 0.2, composure: 0.2 },
  interception: { positioning: 0.4, vision: 0.2, pace: 0.2, tackling: 0.2 },
}

/** Base outcome weights per kind (they need not sum to 1). */
const BASE: Record<HighlightKind, Weights> = {
  build_up: { goal: 0.03, assist: 0.05, pass_complete: 0.5, lost_ball: 0.22, missed: 0.06, saved: 0.05, foul_won: 0.05 },
  counter: { goal: 0.12, assist: 0.08, saved: 0.18, missed: 0.16, blocked: 0.07, lost_ball: 0.17, foul_won: 0.08, woodwork: 0.02 },
  one_on_one: { goal: 0.31, saved: 0.3, missed: 0.2, woodwork: 0.04, lost_ball: 0.05, foul_won: 0.03 },
  cross: { goal: 0.1, assist: 0.09, saved: 0.12, missed: 0.18, pass_complete: 0.2, lost_ball: 0.17, blocked: 0.08 },
  edge_of_box: { goal: 0.07, assist: 0.04, saved: 0.25, missed: 0.27, blocked: 0.17, woodwork: 0.03, lost_ball: 0.1, pass_complete: 0.04 },
  freekick: { goal: 0.08, saved: 0.3, missed: 0.36, blocked: 0.2, woodwork: 0.05 },
  penalty: { goal: 0.76, saved: 0.16, missed: 0.06, woodwork: 0.02 },
  corner: { goal: 0.09, saved: 0.25, missed: 0.38, blocked: 0.1, lost_ball: 0.13, woodwork: 0.03 },
  defend: { defended: 0.5, shot_conceded: 0.16, lost_ball: 0.06, conceded: 0.11, foul_committed: 0.11, pass_complete: 0.06 },
  gk_save: { defended: 0.76, conceded: 0.24 },
  gk_penalty: { defended: 0.22, conceded: 0.78 },
  counter_2v1: { goal: 0.18, assist: 0.08, saved: 0.16, missed: 0.14, blocked: 0.06, lost_ball: 0.2, foul_won: 0.06, woodwork: 0.02 },
  long_ball_control: { goal: 0.02, assist: 0.02, pass_complete: 0.2, lost_ball: 0.6, missed: 0.04, saved: 0.03, blocked: 0.02, foul_won: 0.05, foul_committed: 0.02 },
  rebound: { goal: 0.2, saved: 0.16, missed: 0.12, blocked: 0.08, woodwork: 0.02, lost_ball: 0.36, foul_committed: 0.06 },
  interception: { defended: 0.5, shot_conceded: 0.12, conceded: 0.08, foul_committed: 0.06, lost_ball: 0.09, timeout: 0.15 },
}

/** Outcomes that improve with skill (+) or worsen (−). */
const GOOD: ReadonlySet<Outcome> = new Set<Outcome>(['goal', 'assist', 'pass_complete', 'defended', 'foul_won', 'woodwork'])
const BAD: ReadonlySet<Outcome> = new Set<Outcome>(['lost_ball', 'missed', 'conceded', 'shot_conceded', 'foul_committed', 'blocked', 'timeout'])

/** Weighted hero skill for a kind, 0..100. */
export function skillFor(kind: HighlightKind, attrs: Attributes): number {
  let s = 0
  let w = 0
  for (const [k, weight] of Object.entries(SKILL_MIX[kind]) as [AttributeKey, number][]) {
    s += (attrs[k] ?? 50) * weight
    w += weight
  }
  return w > 0 ? s / w : 50
}

/**
 * Skill term in [-1, 1]: 0 for a 65-rated hero at normal difficulty (1.0),
 * +1 at 95+. Difficulty 0.8 adds +0.2, legend 1.3 subtracts 0.3.
 */
export function skillTerm(kind: HighlightKind, attrs: Attributes, difficulty: number): number {
  return clamp((skillFor(kind, attrs) - 65) / 30 - (difficulty - 1), -1, 1)
}

/**
 * Outcome probabilities for a skipped highlight (normalized to sum 1).
 * Exposed for UI previews ("62% chance to score") and tests.
 */
export function outcomeProbabilities(kind: HighlightKind, attrs: Attributes, difficulty: number): Weights {
  const k = skillTerm(kind, attrs, difficulty)
  const out: Weights = {}
  let total = 0
  for (const [o, base] of Object.entries(BASE[kind]) as [Outcome, number][]) {
    let w = base
    if (GOOD.has(o)) w *= 1 + 0.8 * k
    else if (BAD.has(o)) w *= 1 - 0.6 * k
    w = Math.max(0.001, w)
    out[o] = w
    total += w
  }
  for (const o of Object.keys(out) as Outcome[]) out[o] = (out[o] ?? 0) / total
  return out
}

function emptyResult(outcome: Outcome): HighlightResult {
  return { outcome, passes: 0, passesCompleted: 0, shots: 0, shotsOnTarget: 0, dribbles: 0, tackles: 0 }
}

/** Fills consistent micro-stats for a sampled outcome. */
function fillStats(kind: HighlightKind, r: HighlightResult, rng: Rng): void {
  const attacking = kind !== 'defend' && kind !== 'gk_save' && kind !== 'gk_penalty' && kind !== 'interception'
  if (attacking && kind !== 'penalty' && kind !== 'freekick' && kind !== 'corner' && kind !== 'rebound') {
    const p = rng.int(0, 2)
    r.passes += p
    r.passesCompleted += p
    if (rng.chance(0.35)) r.dribbles += 1
  }
  switch (r.outcome) {
    case 'goal':
    case 'saved':
      r.shots += 1
      r.shotsOnTarget += 1
      break
    case 'missed':
    case 'blocked':
    case 'woodwork':
      r.shots += 1
      break
    case 'assist':
    case 'pass_complete':
      r.passes += 1
      r.passesCompleted += 1
      break
    case 'lost_ball':
      if (rng.chance(0.5)) r.passes += 1
      break
    case 'defended':
      if (kind === 'defend' || kind === 'interception') r.tackles += 1
      break
    case 'foul_won':
      r.dribbles += 1
      break
    case 'foul_committed':
      if (rng.chance(0.3)) r.card = rng.chance(0.06) ? 'red' : 'yellow'
      break
    default:
      break
  }
}

/**
 * Auto-resolves a highlight probabilistically from the hero's attributes and
 * difficulty. Scorer/assist ids are left for the engine to fill.
 */
export function autoResolve(kind: HighlightKind, attrs: Attributes, difficulty: number, rng: Rng): HighlightResult {
  const probs = outcomeProbabilities(kind, attrs, difficulty)
  const outcomes = Object.keys(probs) as Outcome[]
  const outcome = rng.weighted(outcomes, (o) => probs[o] ?? 0)
  const r = emptyResult(outcome)
  fillStats(kind, r, rng)
  if (kind !== 'gk_save' && kind !== 'gk_penalty' && rng.chance(0.004)) r.injured = true
  return r
}
