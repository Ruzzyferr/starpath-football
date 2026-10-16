/**
 * Live match camera maths (GAP 2.2#2, #3, #4, #7). Pure TS so the rules are
 * unit tested without Phaser; MatchScene feeds it world-pixel positions.
 *
 * - Follow: a critically damped spring (ζ = 1) stepped at a fixed 60 Hz, so
 *   the feel does not depend on the frame rate, with the on-screen speed
 *   capped at {@link CAM_MAX_SPEED_PX} (no whip pans).
 * - Look-ahead: the frame leads the ball carrier by 18 % of the visible
 *   screen in the direction they are moving, so pass options stay in view.
 * - Moment framing: when a moment starts the camera eases (350 ms) to a zoom
 *   that holds the ball, the hero and the three nearest pass options.
 * - Bounds: the view may spill at most {@link CAM_BOUND_M} metres past the
 *   pitch lines; on screens wider than that (ultrawide) the frame centres and
 *   the extra space shows the stands.
 */
import { PITCH_LENGTH, PITCH_WIDTH } from '../sim/match/types'
import type { Vec2 } from './model'
import { PPM, project } from './view'

/** Fixed spring step (s). */
export const CAM_STEP = 1 / 60
/** Spring angular frequency (rad/s); ζ = 1. Settles ~90 % in ≈ 0.55 s, matching the old exponential feel. */
export const CAM_OMEGA = 7
/** Maximum camera speed in screen pixels per second. */
export const CAM_MAX_SPEED_PX = 1200
/** Look-ahead as a fraction of the visible screen. */
export const LOOK_AHEAD_FRAC = 0.18
/** Carrier speed (m/s) at which the full look-ahead applies. */
export const LOOK_AHEAD_FULL_SPEED = 5
/** Moment-start framing: transition time (s) and margin around the framed points (m). */
export const MOMENT_FRAME_TIME = 0.35
export const MOMENT_FRAME_PAD_M = 4
export const MOMENT_FRAME_MIN_ZOOM = 0.62
/** Max overshoot of the view past the pitch lines (m). */
export const CAM_BOUND_M = 6

export interface Spring2 {
  x: number
  y: number
  vx: number
  vy: number
  /** Unconsumed time below one fixed step. */
  acc: number
}

export const newSpring = (x: number, y: number): Spring2 => ({ x, y, vx: 0, vy: 0, acc: 0 })

/**
 * Advances the camera spring toward (tx, ty) by `dt` seconds in fixed 60 Hz
 * steps. `zoom` converts the on-screen speed cap to world pixels.
 */
export function springStep(s: Spring2, tx: number, ty: number, dt: number, zoom: number, omega = CAM_OMEGA): Spring2 {
  s.acc += Math.min(Math.max(dt, 0), 0.25)
  const maxV = CAM_MAX_SPEED_PX / Math.max(1e-3, zoom)
  const w2 = omega * omega
  while (s.acc >= CAM_STEP) {
    s.acc -= CAM_STEP
    // Semi-implicit Euler on x'' = ω²(t − x) − 2ωx'.
    s.vx += (w2 * (tx - s.x) - 2 * omega * s.vx) * CAM_STEP
    s.vy += (w2 * (ty - s.y) - 2 * omega * s.vy) * CAM_STEP
    const v = Math.hypot(s.vx, s.vy)
    if (v > maxV) {
      s.vx *= maxV / v
      s.vy *= maxV / v
    }
    s.x += s.vx * CAM_STEP
    s.y += s.vy * CAM_STEP
  }
  return s
}

/**
 * Look-ahead offset in world pixels: 18 % of the visible screen along the
 * carrier's on-screen movement direction, faded in with speed.
 * `vel` is the carrier's pitch velocity (m/s).
 */
export function lookAheadOffset(vel: Vec2, view: { w: number; h: number }, zoom: number): { x: number; y: number } {
  const a = project(0, 0)
  const b = project(vel.x, vel.y)
  const sx = b.x - a.x
  const sy = b.y - a.y
  const l = Math.hypot(sx, sy)
  const speed = Math.hypot(vel.x, vel.y)
  if (l < 1e-6 || speed < 0.2) return { x: 0, y: 0 }
  const k = Math.min(1, speed / LOOK_AHEAD_FULL_SPEED) * LOOK_AHEAD_FRAC
  return { x: (sx / l) * k * (view.w / zoom), y: (sy / l) * k * (view.h / zoom) }
}

/** The three pitch points nearest `from` (pass options when the hero has no ranked list). */
export function nearestPoints(from: Vec2, pts: readonly Vec2[], n = 3): Vec2[] {
  return [...pts].sort((p, q) => Math.hypot(p.x - from.x, p.y - from.y) - Math.hypot(q.x - from.x, q.y - from.y)).slice(0, n)
}

/**
 * Moment-start frame: centre (world px) and zoom multiplier (× base zoom,
 * ≤ 1) that hold the ball, the hero and the given pass options.
 */
export function momentFrame(ball: Vec2, hero: Vec2, options: readonly Vec2[], view: { w: number; h: number }, baseZoom: number, maxMult = 1, minMult = MOMENT_FRAME_MIN_ZOOM): { x: number; y: number; zoomMult: number } {
  const pts = [project(ball.x, ball.y), project(hero.x, hero.y), ...options.map((o) => project(o.x, o.y))]
  const pad = MOMENT_FRAME_PAD_M * PPM
  const minX = Math.min(...pts.map((p) => p.x)) - pad
  const maxX = Math.max(...pts.map((p) => p.x)) + pad
  const minY = Math.min(...pts.map((p) => p.y)) - pad
  const maxY = Math.max(...pts.map((p) => p.y)) + pad
  const fit = Math.min(view.w / Math.max(1, maxX - minX), view.h / Math.max(1, maxY - minY))
  const zoomMult = Math.min(maxMult, Math.max(minMult, fit / Math.max(1e-6, baseZoom)))
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, zoomMult }
}

/** Ease-out cubic on 0..1. */
export const easeOut = (t: number): number => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3)

/** World-pixel rectangle the camera centre may move in so the view stays within {@link CAM_BOUND_M} of the pitch. */
export function cameraBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
  return {
    minX: -CAM_BOUND_M * PPM,
    maxX: (PITCH_WIDTH + CAM_BOUND_M) * PPM,
    minY: project(PITCH_LENGTH + CAM_BOUND_M, 0).y,
    maxY: project(-CAM_BOUND_M, 0).y,
  }
}

/** Clamps a camera centre to {@link cameraBounds} for a view of half-size (hw, hh) world px; centres when the view is wider than the bounds. */
export function clampCamera(x: number, y: number, hw: number, hh: number): { x: number; y: number } {
  const b = cameraBounds()
  const cx = b.maxX - b.minX < hw * 2 ? (b.minX + b.maxX) / 2 : Math.min(b.maxX - hw, Math.max(b.minX + hw, x))
  const cy = b.maxY - b.minY < hh * 2 ? (b.minY + b.maxY) / 2 : Math.min(b.maxY - hh, Math.max(b.minY + hh, y))
  return { x: cx, y: cy }
}
