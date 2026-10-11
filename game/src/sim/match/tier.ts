/**
 * Graded moment success (owner, build 9): a goal-oriented moment is not all-or-nothing. A goal (or the assist
 * the moment was built for) is full success; a shot on target the keeper had to save, the woodwork, or a clear
 * chance the hero created (his cross / corner met by a team-mate, a team-mate's shot off his delivery, a
 * timed run received onside) is a partial success worth about half the reward; anything else is a fail.
 * Every other kind keeps its own success rule (defended, the ball kept, a pass found…) as full / fail.
 *
 * Pure and shared: the runtime stamps it on the result, the match engine / rating consume it, the UI shows it.
 */
import type { HighlightKind, HighlightOutcome, HighlightResult } from './types'

export type MomentTier = 'full' | 'partial' | 'fail'

/** Kinds where full success means a goal (or an assist): the graded ones. */
export const GOAL_KINDS: ReadonlySet<HighlightKind> = new Set<HighlightKind>([
  'one_on_one', 'counter', 'counter_2v1', 'edge_of_box', 'long_shot', 'freekick', 'penalty', 'rebound',
  'cross', 'corner', 'corner_kick', 'header', 'timed_run',
])

/** Share of a goal's reward a partial success earns (rating, and through it form / XP / trust). */
export const PARTIAL_SHARE = 0.5

/** Full success of a moment kind (the old boolean rule). */
export function isFullSuccess(kind: HighlightKind, o: HighlightOutcome): boolean {
  switch (kind) {
    case 'cross':
    case 'corner':
    case 'corner_kick':
    case 'header':
    case 'counter_2v1':
    case 'timed_run':
      return o === 'goal' || o === 'assist'
    case 'dribble':
      // Beating the man counts: he got past and the move ended in a shot, a pass or a foul won.
      return o !== 'lost_ball' && o !== 'foul_committed' && o !== 'timeout'
    case 'long_ball_control':
    case 'hold_up':
    case 'shoulder_duel':
    case 'switch_play':
      return o === 'goal' || o === 'assist' || o === 'pass_complete' || o === 'foul_won'
    case 'gk_distribution':
      return o === 'pass_complete'
    case 'defend':
    case 'interception':
    case 'defend_1v1':
    case 'block':
    case 'back_post':
    case 'recovery_run':
    case 'press_trap':
      return o === 'defended' || o === 'foul_won'
    case 'gk_save':
    case 'gk_penalty':
    case 'fk_wall':
    case 'gk_1v1':
    case 'gk_sweep':
    case 'gk_claim':
      return o !== 'conceded'
    default:
      return o === 'goal'
  }
}

/** The tier of a resolved moment. */
export function momentTier(kind: HighlightKind, r: Pick<HighlightResult, 'outcome' | 'chance' | 'offside'>): MomentTier {
  if (isFullSuccess(kind, r.outcome)) return 'full'
  if (!GOAL_KINDS.has(kind) || r.offside) return 'fail'
  if (r.outcome === 'woodwork') return 'partial'
  // A saved penalty is a missed penalty (only the woodwork is unlucky).
  if (kind === 'penalty') return 'fail'
  // Played moments say whether the keeper was made to work (a placed shot) or a chance was created; an auto-resolved
  // (skipped) moment has no such detail, its save counts as on target.
  if (r.chance === undefined) return r.outcome === 'saved' ? 'partial' : 'fail'
  return r.chance ? 'partial' : 'fail'
}

/** Success for the balance harnesses: full or partial. */
export const tierSuccess = (t: MomentTier): boolean => t !== 'fail'
