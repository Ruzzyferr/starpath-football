/**
 * Bullet-time ramps (GAP 2.2#14, #15). Entering slow motion the time scale
 * eases out from 1.0x to the bullet scale (0.25x) in 150 ms; when the
 * composure window runs out it returns to normal in 120 ms. Timed ramps
 * replace the old exponential approach so both durations are exact and
 * independent of the frame rate. Pure TS, unit tested.
 */

/** Slow-down ramp (s). */
export const BULLET_IN_TIME = 0.15
/** Return-to-normal ramp (s). */
export const BULLET_OUT_TIME = 0.12

export interface ScaleRamp {
  from: number
  to: number
  t: number
}

/** Ease-out quadratic. */
const easeOut = (u: number): number => 1 - (1 - u) * (1 - u)

/**
 * Advances the ramp by `dt` real seconds toward `target` and returns the new
 * time scale. A changed target restarts the ramp from `current`.
 */
export function stepTimeScale(r: ScaleRamp, current: number, target: number, dt: number): number {
  if (r.to !== target) {
    r.from = current
    r.to = target
    r.t = 0
  }
  r.t += dt
  const dur = target < r.from ? BULLET_IN_TIME : BULLET_OUT_TIME
  const u = Math.min(1, r.t / dur)
  return r.from + (r.to - r.from) * easeOut(u)
}

/** Max extra vignette opacity from bullet time (2.2#14: 15 %). */
export const BULLET_VIGNETTE_MAX = 0.15
/** Max saturation drop in bullet time ("hafif"). */
export const BULLET_DESAT_MAX = 0.35

/** `slow` = 1 − time scale (0..0.75 for a 0.25x bullet). */
const slowFrac = (slow: number): number => Math.min(1, Math.max(0, slow / 0.75))

export const bulletVignette = (slow: number): number => BULLET_VIGNETTE_MAX * slowFrac(slow)
export const bulletDesaturation = (slow: number): number => BULLET_DESAT_MAX * slowFrac(slow)

/** Composure ring radius (m) around the ball: 3 m at the start of the window, 0.6 m as it closes (2.2#15). */
export const composureRingRadius = (frac: number): number => 0.6 + 2.4 * Math.min(1, Math.max(0, frac))
