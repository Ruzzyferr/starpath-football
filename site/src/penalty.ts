/**
 * Penalty rules for the site's playable moment, adapted from the game (read-only source):
 * - swipe power: game/src/game/kick.ts `swipePower` (length + peak speed, overhit above 1),
 * - keeper: game/src/game/ai.ts `diveSpeed`, `KEEPER_REACH`, `DIVE_PEAK` and the reaction delay
 *   used by `planSave` (the ball must cross the keeper's plane before a dive can reach it).
 * Pure and deterministic given `rnd`, so it is unit-testable and shared by the 3D scene and the
 * no-WebGL fallback.
 */

export const GOAL_HALF_W = 3.66
export const GOAL_H = 2.44
export const SPOT_Z = 11
export const BALL_R = 0.11
export const POST_R = 0.06

// kick.ts
export const SWIPE_MIN_LENGTH = 0.045
export const SWIPE_FULL_LENGTH = 0.5
export const SWIPE_SOFT_SPEED = 0.45
export const SWIPE_FULL_SPEED = 3.2
export const SWIPE_OVERHIT_SPEED = [4.6, 7] as const
// ai.ts
export const KEEPER_REACH = 0.9
export const DIVE_PEAK = 0.36
/** A keeper of about 60 Diving / Agility / Jumping (the game's average senior keeper). */
export const KEEPER_DIVE_SPEED = 2.625 + 0.6 * 3 + 0.6 * 0.4 + 0.6 * 0.4
/** Seconds before a keeper who has not guessed can start moving. */
export const KEEPER_REACTION = 0.26

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/** kick.ts swipePower: 0.1..1 core, up to 1.15 for a violent long flick. */
export function swipePower(length: number, peakSpeed: number): number {
  const lenT = clamp01((length - SWIPE_MIN_LENGTH) / (SWIPE_FULL_LENGTH - SWIPE_MIN_LENGTH))
  const spdT = clamp01((peakSpeed - SWIPE_SOFT_SPEED) / (SWIPE_FULL_SPEED - SWIPE_SOFT_SPEED))
  const core = 0.1 + 0.9 * (0.45 * lenT + 0.55 * spdT)
  const [o0, o1] = SWIPE_OVERHIT_SPEED
  const over = 0.15 * clamp01((peakSpeed - o0) / (o1 - o0)) * lenT
  return clamp(core + over, 0, 1.15)
}

export interface ShotInput {
  /** Aimed point on the goal plane (m): x across (0 = centre), y up. */
  x: number
  y: number
  /** 0..1.15 */
  power: number
  /** -1..1, shapes the path only (as in the game: a curled shot still ends where aimed). */
  curl: number
}

export type Outcome = 'goal' | 'saved' | 'weak' | 'post' | 'wide' | 'over'

export interface ShotResult {
  outcome: Outcome
  /** Where the ball really crosses the goal plane. */
  x: number
  y: number
  /** Flight time to the goal plane (s). */
  t: number
  speed: number
  /** Keeper's committed side (-1 left, 0 stays, 1 right) and the point his hands reach. */
  keeperSide: -1 | 0 | 1
  diveX: number
  diveY: number
  /** Seconds after the kick when the keeper starts moving. */
  keeperStart: number
}

function gauss(rnd: () => number): number {
  const u = Math.max(1e-9, rnd())
  const v = rnd()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export function resolveShot(shot: ShotInput, rnd: () => number = Math.random): ShotResult {
  const p = clamp(shot.power, 0.05, 1.15)
  const speed = 11 + 17 * Math.min(p, 1) + Math.max(0, p - 1) * 30
  // Accuracy: a clean strike lands close to the aim; overhit sprays and rises.
  const spread = 0.1 + Math.max(0, p - 0.92) * 2.4 + (p < 0.35 ? 0.05 : 0)
  const x = shot.x + gauss(rnd) * spread
  const y = Math.max(0.05, shot.y + gauss(rnd) * spread * 0.6 + Math.max(0, p - 1) * 9)
  const t = SPOT_Z / (speed * 0.97)

  // Keeper: most keepers guess a side on a penalty; some wait and react.
  const r = rnd()
  const keeperSide: -1 | 0 | 1 = r < 0.3 ? -1 : r < 0.6 ? 1 : 0
  const reacts = r >= 0.78 // a waiting keeper; 0.6..0.78 stays big in the middle
  const keeperStart = keeperSide !== 0 ? 0.08 : KEEPER_REACTION

  const ax = Math.abs(x)
  const result = (outcome: Outcome, diveX: number, diveY: number): ShotResult => ({ outcome, x, y, t, speed, keeperSide, diveX, diveY, keeperStart })
  const defaultDive = keeperSide * Math.min(KEEPER_DIVE_SPEED * DIVE_PEAK + KEEPER_REACH, 2.9)

  // Off target first: posts and bar, then wide or over.
  const nearPost = Math.abs(ax - GOAL_HALF_W) < BALL_R + POST_R && y < GOAL_H + BALL_R
  const nearBar = Math.abs(y - GOAL_H) < BALL_R + POST_R && ax < GOAL_HALF_W + BALL_R
  if (nearPost || nearBar) return result('post', defaultDive, 0.9)
  if (y > GOAL_H) return result('over', defaultDive, 1.2)
  if (ax > GOAL_HALF_W) return result('wide', defaultDive, 0.9)

  // On target: can the hands get there in time? (ai.ts planSave: speed × time up to the dive peak + reach.)
  const sameSide = keeperSide !== 0 && Math.sign(x) === keeperSide
  const highCorner = y > 1.75 && ax > 2.4 ? 0.35 : 0
  let reach: number
  let from = 0
  if (keeperSide === 0) {
    const avail = reacts ? Math.max(0, t - KEEPER_REACTION) : 0
    reach = KEEPER_DIVE_SPEED * Math.min(avail, DIVE_PEAK) + KEEPER_REACH + 0.3
  } else if (sameSide) {
    const avail = Math.max(0, t - keeperStart)
    reach = KEEPER_DIVE_SPEED * Math.min(avail, DIVE_PEAK) + KEEPER_REACH + 0.3
  } else {
    // Gone the wrong way: only a trailing leg near the middle.
    from = keeperSide * 0.4
    reach = 0.45
  }
  reach -= highCorner
  const lateral = Math.abs(x - from)
  const reachable = lateral <= reach && y < 2.35 + 0.2
  if (reachable) {
    const outcome: Outcome = p < 0.32 ? 'weak' : 'saved'
    return result(outcome, x, clamp(y, 0.3, 2.3))
  }
  return result('goal', keeperSide === 0 ? clamp(x, -1.2, 1.2) * (reacts ? 1 : 0.2) : defaultDive, keeperSide === 0 ? 1.1 : clamp(y, 0.4, 1.8))
}

/**
 * Keyboard aim: arrow keys step through the same targets a tap or the corner buttons reach
 * (columns from post to post, rows low / middle / high), so a keyboard corner is a real corner.
 */
export const KEY_AIM_X = [-2.9, -1.45, 0, 1.45, 2.9] as const
export const KEY_AIM_Y = [0.45, 1.25, 1.95] as const

/** Five kicks, then a summary. */
export interface Round {
  kicks: Outcome[]
}
export const KICKS_PER_ROUND = 5
export const goalsIn = (r: Round) => r.kicks.filter((k) => k === 'goal').length
