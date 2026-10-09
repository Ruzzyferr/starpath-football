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
import { DEFENSIVE_KINDS, KEEPER_KINDS } from './types'

type Outcome = HighlightOutcome
type Weights = Partial<Record<Outcome, number>>

/** Attribute mix that decides how well the hero handles each kind. */
const SKILL_MIX: Record<HighlightKind, Partial<Record<AttributeKey, number>>> = {
  build_up: { passing: 0.3, longPassing: 0.1, vision: 0.25, firstTouch: 0.15, composure: 0.2 },
  counter: { pace: 0.15, acceleration: 0.15, dribbling: 0.25, finishing: 0.25, vision: 0.2 },
  one_on_one: { finishing: 0.45, composure: 0.3, dribbling: 0.15, acceleration: 0.1 },
  cross: { crossing: 0.3, curve: 0.1, finishing: 0.25, heading: 0.15, composure: 0.2 },
  edge_of_box: { shooting: 0.4, curve: 0.2, composure: 0.2, finishing: 0.2 },
  freekick: { setPieces: 0.45, curve: 0.25, shooting: 0.15, composure: 0.15 },
  penalty: { composure: 0.5, finishing: 0.3, setPieces: 0.2 },
  corner: { heading: 0.4, jumping: 0.25, strength: 0.15, balance: 0.1, aggression: 0.1 },
  defend: { tackling: 0.3, positioning: 0.2, anticipation: 0.15, acceleration: 0.1, strength: 0.15, aggression: 0.1 },
  gk_save: { reflexes: 0.3, diving: 0.25, gkPositioning: 0.25, handling: 0.2 },
  gk_penalty: { diving: 0.35, reflexes: 0.25, composure: 0.2, gkPositioning: 0.2 },
  counter_2v1: { pace: 0.15, acceleration: 0.1, finishing: 0.3, vision: 0.25, dribbling: 0.2 },
  long_ball_control: { firstTouch: 0.4, strength: 0.15, balance: 0.1, composure: 0.2, jumping: 0.1, agility: 0.05 },
  rebound: { finishing: 0.3, anticipation: 0.3, agility: 0.2, composure: 0.2 },
  interception: { anticipation: 0.4, positioning: 0.25, acceleration: 0.15, tackling: 0.2 },
  hold_up: { strength: 0.25, balance: 0.15, firstTouch: 0.25, composure: 0.15, passing: 0.2 },
  defend_1v1: { tackling: 0.3, acceleration: 0.2, pace: 0.1, positioning: 0.2, agility: 0.1, aggression: 0.1 },
  block: { positioning: 0.3, anticipation: 0.2, strength: 0.15, tackling: 0.15, aggression: 0.2 },
  corner_kick: { crossing: 0.35, curve: 0.3, setPieces: 0.15, vision: 0.2 },
  // Keeper or captain organising the wall: reading the taker and the angles.
  fk_wall: { positioning: 0.35, anticipation: 0.15, leadership: 0.3, composure: 0.2 },
  dribble: { dribbling: 0.4, agility: 0.15, balance: 0.1, acceleration: 0.15, finishing: 0.2 },
  header: { heading: 0.45, jumping: 0.25, balance: 0.1, positioning: 0.1, aggression: 0.1 },
  gk_1v1: { reflexes: 0.25, gkPositioning: 0.3, diving: 0.15, acceleration: 0.15, composure: 0.15 },
  gk_sweep: { gkPositioning: 0.3, anticipation: 0.15, gkDistribution: 0.1, acceleration: 0.25, handling: 0.2 },
  back_post: { positioning: 0.3, anticipation: 0.15, heading: 0.25, jumping: 0.15, balance: 0.15 },
  // Attribute moments: each one leans on the stats it exists for.
  long_shot: { shooting: 0.55, curve: 0.15, composure: 0.2, strength: 0.1 },
  switch_play: { longPassing: 0.45, vision: 0.3, composure: 0.15, passing: 0.1 },
  recovery_run: { stamina: 0.25, workRate: 0.25, pace: 0.2, acceleration: 0.15, tackling: 0.15 },
  shoulder_duel: { strength: 0.35, balance: 0.3, pace: 0.15, acceleration: 0.1, aggression: 0.1 },
  timed_run: { positioning: 0.3, anticipation: 0.2, acceleration: 0.2, finishing: 0.2, composure: 0.1 },
  press_trap: { anticipation: 0.3, workRate: 0.25, aggression: 0.2, acceleration: 0.15, tackling: 0.1 },
  gk_claim: { handling: 0.35, jumping: 0.25, gkPositioning: 0.25, composure: 0.15 },
  gk_distribution: { gkDistribution: 0.55, composure: 0.2, vision: 0.15, passing: 0.1 },
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
  hold_up: { goal: 0.02, assist: 0.03, pass_complete: 0.42, foul_won: 0.14, lost_ball: 0.32, missed: 0.03, foul_committed: 0.04 },
  defend_1v1: { defended: 0.48, shot_conceded: 0.16, conceded: 0.12, foul_committed: 0.12, lost_ball: 0.06, pass_complete: 0.06 },
  block: { defended: 0.45, shot_conceded: 0.3, conceded: 0.12, foul_committed: 0.07, timeout: 0.06 },
  // A dangerous corner (the engine only stages the threatening ones): mostly cleared.
  corner_kick: { assist: 0.08, goal: 0.02, pass_complete: 0.3, cleared: 0.55, lost_ball: 0.05 },
  // Direct free kick from 18–28 m: the wall and the keeper keep most of them out.
  fk_wall: { defended: 0.86, conceded: 0.14 },
  // Take-on: beat the man, then the chance; most end in a lost ball or a pass on.
  dribble: { goal: 0.04, assist: 0.05, saved: 0.1, missed: 0.13, blocked: 0.06, pass_complete: 0.22, lost_ball: 0.32, foul_won: 0.08 },
  header: { goal: 0.09, saved: 0.25, missed: 0.37, blocked: 0.08, lost_ball: 0.18, woodwork: 0.03 },
  gk_1v1: { defended: 0.6, conceded: 0.4 },
  gk_sweep: { defended: 0.78, conceded: 0.1, foul_committed: 0.04, shot_conceded: 0.08 },
  back_post: { defended: 0.52, shot_conceded: 0.2, conceded: 0.13, foul_committed: 0.05, lost_ball: 0.1 },
  long_shot: { goal: 0.06, saved: 0.3, missed: 0.32, blocked: 0.14, woodwork: 0.04, lost_ball: 0.1, pass_complete: 0.04 },
  switch_play: { pass_complete: 0.55, assist: 0.02, lost_ball: 0.3, foul_won: 0.05, timeout: 0.08 },
  recovery_run: { defended: 0.45, shot_conceded: 0.2, conceded: 0.12, foul_committed: 0.1, timeout: 0.13 },
  shoulder_duel: { pass_complete: 0.33, goal: 0.03, saved: 0.05, missed: 0.05, lost_ball: 0.42, foul_won: 0.08, foul_committed: 0.04 },
  timed_run: { goal: 0.17, assist: 0.02, saved: 0.18, missed: 0.12, woodwork: 0.02, lost_ball: 0.45, foul_won: 0.04 },
  press_trap: { defended: 0.4, timeout: 0.38, foul_committed: 0.1, shot_conceded: 0.04, lost_ball: 0.08 },
  gk_claim: { defended: 0.72, conceded: 0.12, shot_conceded: 0.12, foul_committed: 0.04 },
  gk_distribution: { pass_complete: 0.68, lost_ball: 0.26, timeout: 0.06 },
}

/** Outcomes that improve with skill (+) or worsen (−). */
const GOOD: ReadonlySet<Outcome> = new Set<Outcome>(['goal', 'assist', 'pass_complete', 'defended', 'foul_won', 'woodwork'])
const BAD: ReadonlySet<Outcome> = new Set<Outcome>(['cleared', 'lost_ball', 'missed', 'conceded', 'shot_conceded', 'foul_committed', 'blocked', 'timeout'])

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

/** Foul share multiplier from aggression: 0.7 at 20, 1 at 50, 1.45 at 95 (a missing value reads as 50). */
export function aggressionFoulMult(aggression: number | undefined): number {
  return clamp(1 + ((aggression ?? 50) - 50) * 0.01, 0.7, 1.45)
}

/**
 * Outcome probabilities for a skipped highlight (normalized to sum 1).
 * Exposed for UI previews ("62% chance to score") and tests.
 */
export function outcomeProbabilities(kind: HighlightKind, attrs: Attributes, difficulty: number): Weights {
  const k = skillTerm(kind, attrs, difficulty)
  // Aggression goes into every duel: more of them are won (in its skill mix) but more end in a foul.
  const foulMult = DEFENSIVE_KINDS.has(kind) && !KEEPER_KINDS.has(kind) ? aggressionFoulMult(attrs.aggression) : 1
  const out: Weights = {}
  let total = 0
  for (const [o, base] of Object.entries(BASE[kind]) as [Outcome, number][]) {
    let w = base
    if (GOOD.has(o)) w *= 1 + 0.8 * k
    else if (BAD.has(o)) w *= 1 - 0.6 * k
    if (o === 'foul_committed') w *= foulMult
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
  const attacking = !DEFENSIVE_KINDS.has(kind)
  if (attacking && !KEEPER_KINDS.has(kind) && kind !== 'penalty' && kind !== 'freekick' && kind !== 'corner' && kind !== 'rebound') {
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
      if (DEFENSIVE_KINDS.has(kind) && !KEEPER_KINDS.has(kind)) r.tackles += 1
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
/** Base injury chance of an auto-resolved outfield moment (scaled by injuryRiskMultiplier, 2.3#55). */
export const AUTO_INJURY_CHANCE = 0.0054

export function autoResolve(kind: HighlightKind, attrs: Attributes, difficulty: number, rng: Rng, injuryMult = 1): HighlightResult {
  const probs = outcomeProbabilities(kind, attrs, difficulty)
  const outcomes = Object.keys(probs) as Outcome[]
  const outcome = rng.weighted(outcomes, (o) => probs[o] ?? 0)
  const r = emptyResult(outcome)
  fillStats(kind, r, rng)
  if (!KEEPER_KINDS.has(kind) && rng.chance(AUTO_INJURY_CHANCE * injuryMult)) r.injured = true
  return r
}
