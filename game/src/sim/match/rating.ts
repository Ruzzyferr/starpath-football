/**
 * Player ratings (0–10 scale, clamped to 1–10).
 *
 * The hero's rating is a running value: it starts at {@link RATING_BASE},
 * moves with every highlight outcome and team event, and gets a final
 * adjustment for the team result and passing accuracy. NPC ratings are a
 * rougher post-match estimate used to pick the Man of the Match.
 */
import type { Position } from '../../core/types'
import type { HighlightKind, HighlightResult } from './types'

/** Baseline rating every player starts the match with. */
export const RATING_BASE = 6.0
export const RATING_MIN = 1
export const RATING_MAX = 10

/** Clamps a rating to [1, 10]. */
export function clampRating(r: number): number {
  return r < RATING_MIN ? RATING_MIN : r > RATING_MAX ? RATING_MAX : r
}

/** Rounds to one decimal (display precision). */
export function roundRating(r: number): number {
  return Math.round(clampRating(r) * 10) / 10
}

const OUTCOME_DELTA: Record<HighlightResult['outcome'], number> = {
  goal: 1.0,
  assist: 0.7,
  saved: 0.12,
  missed: -0.15,
  blocked: -0.05,
  woodwork: 0.05,
  pass_complete: 0.08,
  lost_ball: -0.25,
  defended: 0.25,
  conceded: -0.45,
  shot_conceded: -0.12,
  // A corner delivered and dealt with by the defence: the cross itself is judged by passes.
  cleared: -0.05,
  foul_won: 0.1,
  foul_committed: -0.2,
  timeout: -0.15,
}

/** Kind-specific overrides where the default delta would be misleading. */
function kindAdjustment(kind: HighlightKind, outcome: HighlightResult['outcome']): number {
  if (kind === 'penalty' && outcome === 'goal') return -0.3 // expected to score
  if (kind === 'penalty' && outcome !== 'goal') return -0.35
  if (kind === 'one_on_one' && (outcome === 'missed' || outcome === 'saved')) return -0.2
  if (kind === 'gk_penalty' && outcome === 'defended') return 0.55
  if (kind === 'gk_penalty' && outcome === 'conceded') return 0.4 // penalties usually go in
  if (kind === 'freekick' && outcome === 'goal') return 0.2
  // Free kicks against usually do not go in: keeping one out is a smaller deed than a 1v1 stop.
  if (kind === 'fk_wall' && outcome === 'defended') return -0.1
  if (kind === 'fk_wall' && outcome === 'conceded') return 0.25
  return 0
}

/**
 * Aim-assist reward multipliers (GDD 3.3, WP-13): full assist earns less,
 * manual aiming more. Applied to the positive part of a played moment's
 * rating delta; mistakes are never amplified.
 */
export const ASSIST_REWARD: Readonly<Record<'full' | 'half' | 'manual', number>> = { full: 0.8, half: 1, manual: 1.25 }

/**
 * Rating change for one resolved highlight: outcome, micro-stats and cards.
 */
export function highlightRatingDelta(kind: HighlightKind, r: HighlightResult): number {
  let d = OUTCOME_DELTA[r.outcome] + kindAdjustment(kind, r.outcome)
  // Offside: a team-mate's mistimed run is mostly not the hero's fault; an
  // opponent flagged offside in a defensive moment is not really a hero stop.
  if (r.offside && r.outcome === 'lost_ball' && !r.offside.byHero) d += 0.15
  if (r.offside && r.outcome === 'defended') d -= 0.2
  const failedPasses = Math.max(0, r.passes - r.passesCompleted)
  d += r.passesCompleted * 0.03 - failedPasses * 0.05
  d += r.tackles * 0.08 + r.dribbles * 0.04
  d += Math.min(r.shotsOnTarget, r.shots) * 0.03
  if (r.card === 'yellow') d -= 0.3
  if (r.card === 'red') d -= 1.5
  if (d > 0 && r.assistMult !== undefined) d *= r.assistMult
  return d
}

/** Defensive positions take more blame for goals conceded. */
function isDefensive(pos: Position): boolean {
  return pos === 'GK' || pos === 'CB' || pos === 'LB' || pos === 'RB' || pos === 'DM'
}

/**
 * Rating change for a team-level event while the player is on the pitch.
 * @param forTeam true if the player's team scored, false if it conceded.
 */
export function teamGoalRatingDelta(pos: Position, forTeam: boolean): number {
  if (forTeam) return 0.1
  return pos === 'GK' ? -0.3 : isDefensive(pos) ? -0.2 : -0.05
}

/** Context for the end-of-match adjustment. */
export interface FinalRatingContext {
  position: Position
  minutes: number
  goalsFor: number
  goalsAgainst: number
  passes: number
  passesCompleted: number
  saves: number
}

/** One component of the full-time adjustment (already scaled by minutes). */
export interface FinalRatingPart {
  key: 'result' | 'cleanSheet' | 'passing' | 'saves'
  delta: number
}

/**
 * Full-time adjustment split into its components (result, clean sheet, pass
 * accuracy, GK saves), each scaled by minutes played. Zero parts are omitted.
 */
export function finalRatingParts(ctx: FinalRatingContext): FinalRatingPart[] {
  const share = Math.min(1, ctx.minutes / 90)
  const parts: FinalRatingPart[] = []
  const push = (key: FinalRatingPart['key'], d: number) => {
    if (Math.abs(d * share) > 1e-9) parts.push({ key, delta: d * share })
  }
  push('result', ctx.goalsFor > ctx.goalsAgainst ? 0.3 : ctx.goalsFor < ctx.goalsAgainst ? -0.3 : 0)
  if (ctx.goalsAgainst === 0 && isDefensive(ctx.position)) push('cleanSheet', ctx.position === 'GK' ? 0.5 : 0.35)
  if (ctx.passes >= 8) push('passing', (ctx.passesCompleted / ctx.passes - 0.78) * 1.5)
  if (ctx.position === 'GK') push('saves', Math.min(1, ctx.saves * 0.12))
  return parts
}

/**
 * Final adjustment applied at full time: result, clean sheet, pass accuracy and
 * GK saves. Scaled by minutes played (a 10-minute cameo moves less).
 */
export function finalRatingAdjustment(ctx: FinalRatingContext): number {
  return finalRatingParts(ctx).reduce((a, p) => a + p.delta, 0)
}

/**
 * Decisive-contribution floor: goals and assists guarantee a minimum rating
 * (1 goal + 2 assists ≥ 7.0, a hat-trick ≥ 8.0) so a match-winning display is
 * never rated as average. A red card lowers the floor.
 */
export function contributionFloor(goals: number, assists: number, red = false): number {
  if (goals + assists <= 0) return RATING_MIN
  return Math.min(9.2, 5.8 + goals * 0.75 + assists * 0.45) - (red ? 1.5 : 0)
}

/** Per-player counters the engine keeps for NPC ratings. */
export interface NpcRatingInput {
  position: Position
  minutes: number
  goals: number
  assists: number
  shotsOnTarget: number
  saves: number
  yellow: number
  red: number
  ownGoals: number
  goalsFor: number
  goalsAgainst: number
  /** Small per-player random term supplied by the caller (seeded). */
  noise: number
}

/** Rough NPC match rating used for Man-of-the-Match selection. */
export function npcRating(p: NpcRatingInput): number {
  if (p.minutes <= 0) return 0
  let r = RATING_BASE + p.noise
  r += p.goals * 1.0 + p.assists * 0.6 + p.shotsOnTarget * 0.1
  r += p.saves * (p.position === 'GK' ? 0.25 : 0)
  r -= p.yellow * 0.3 + p.red * 1.5 + p.ownGoals * 1.0
  r += finalRatingAdjustment({
    position: p.position,
    minutes: p.minutes,
    goalsFor: p.goalsFor,
    goalsAgainst: p.goalsAgainst,
    passes: 0,
    passesCompleted: 0,
    saves: 0,
  })
  if (p.goalsAgainst > 1) r -= (p.goalsAgainst - 1) * (isDefensive(p.position) ? 0.25 : 0.05)
  return roundRating(r)
}

/**
 * Picks the Man of the Match: highest rating among players with at least
 * 20 minutes; ties go to the winning side, then the earlier id.
 */
export function pickMotm(
  candidates: readonly { id: string; rating: number; minutes: number; won: boolean }[],
): string | undefined {
  let best: (typeof candidates)[number] | undefined
  for (const c of candidates) {
    if (c.minutes < 20) continue
    const score = c.rating + (c.won ? 0.25 : 0)
    const bestScore = best ? best.rating + (best.won ? 0.25 : 0) : -Infinity
    if (score > bestScore) best = c
  }
  return best?.id
}
