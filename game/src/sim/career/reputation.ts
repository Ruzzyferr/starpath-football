/**
 * Season-level reputation sources other than goals (docs/BALANCE.md, "Gol
 * dengesi" follow-up): after the goal-tally rebalance the median hero sat at
 * reputation 71–73 at 25 (target 75–85). Fame now also comes from being a
 * consistent performer on a big stage: average rating over the season,
 * Man-of-the-Match count and the league stage (tier, continental football).
 *
 * The amount is "before diminishing returns": callers pass it through
 * `fameGain`, so it saturates at the top like every other fame source. A
 * youngster in a tier-3 league earns a fraction; an established tier-1
 * regular earns most, which keeps the 18 / 21 points of the curve in place
 * and lifts 22–25.
 */
import type { SeasonStats } from '../../core/types'
import { clamp } from './common'

/** Appearances needed before the season counts as "a body of work". */
export const STANDING_MIN_APPS = 12
/** Average rating from which consistency starts to earn fame. */
export const STANDING_RATING_FLOOR = 6.6
/** Fame per 0.1 of average rating above the floor (capped). */
export const STANDING_RATING_SLOPE = 0.6
export const STANDING_RATING_CAP = 4
/** Fame per Man of the Match (first 12 count). */
export const STANDING_MOTM = 0.22
/** Extra for having played continental football this season. */
export const STANDING_CONTINENTAL = 1.5

/**
 * Club stage multiplier: a regular at a big club (reputation 90) is noticed far
 * more than the same numbers at a mid-table side (65). 0.1 .. 1.5.
 */
export function stageForClub(clubReputation: number | null | undefined): number {
  if (clubReputation == null) return 1
  return clamp((clubReputation - 60) / 20, 0.1, 1.5)
}

/** League stage multiplier by tier (1 = top flight). */
export function stageForTier(tier: number | null | undefined): number {
  if (tier == null) return 0
  return tier <= 1 ? 1 : tier === 2 ? 0.5 : tier === 3 ? 0.28 : 0.18
}

export interface StandingInput {
  stats: Pick<SeasonStats, 'apps' | 'ratingSum' | 'motm'>
  leagueTier: number | null | undefined
  /** Reputation of the hero's club (omitted = neutral 1×). */
  clubReputation?: number | null
  /** The hero played at least one continental fixture this season. */
  continental?: boolean
}

export interface StandingBreakdown {
  consistency: number
  motm: number
  continental: number
  stage: number
  total: number
}

/** Pre-diminishing reputation for the season just finished (0 when too few apps). */
export function seasonStandingFame(inp: StandingInput): StandingBreakdown {
  const { apps, ratingSum, motm } = inp.stats
  const stage = stageForTier(inp.leagueTier) * stageForClub(inp.clubReputation)
  if (apps < STANDING_MIN_APPS || stage <= 0) return { consistency: 0, motm: 0, continental: 0, stage, total: 0 }
  const avg = ratingSum / apps
  const consistency = clamp((avg - STANDING_RATING_FLOOR) * 10 * STANDING_RATING_SLOPE, 0, STANDING_RATING_CAP) * stage
  const m = Math.min(12, motm) * STANDING_MOTM * stage
  const continental = inp.continental ? STANDING_CONTINENTAL : 0
  const total = Math.round((consistency + m + continental) * 100) / 100
  return { consistency, motm: m, continental, stage, total }
}
