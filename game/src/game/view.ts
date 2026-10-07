/**
 * 2.5D view projection shared by the renderer and input mapping.
 *
 * Orientation (classic top-down football): the hero's team attacks UP the
 * screen. Screen x follows the pitch width (pitch y), screen y follows the
 * pitch length reversed (pitch x = PITCH_LENGTH at the top), foreshortened by
 * {@link TILT} to suggest a camera behind and above; height z lifts objects up
 * the screen by {@link ZS}. Because the camera looks along the pitch length,
 * goal mouths are seen face-on.
 *
 * The mapping pitch→screen is a rotation (+ scale), so handedness — and
 * therefore the sign of swipe curvature vs. ball curl — is preserved.
 * Pure TS so it can be unit tested without Phaser.
 */
import { PITCH_LENGTH } from '../sim/match/types'
import type { Vec2 } from './model'

/** World pixels per meter. */
export const PPM = 24
/** Vertical foreshortening of the pitch plane (1 = pure top-down). */
export const TILT = 0.8
/** Screen lift per meter of height, as a fraction of PPM. */
export const ZS = 0.88

/** Projects a pitch point (meters, height z) to world pixels. */
export function project(x: number, y: number, z = 0): { x: number; y: number } {
  return { x: y * PPM, y: (PITCH_LENGTH - x) * PPM * TILT - z * PPM * ZS }
}

/** Inverse of {@link project} for ground points (z = 0). */
export function unproject(wx: number, wy: number): Vec2 {
  return { x: PITCH_LENGTH - wy / (PPM * TILT), y: wx / PPM }
}

/** Converts a screen-space direction to a unit pitch direction. */
export function screenDirToPitch(dx: number, dy: number): Vec2 {
  const x = -dy / TILT
  const y = dx
  const l = Math.hypot(x, y)
  return l > 1e-9 ? { x: x / l, y: y / l } : { x: 0, y: 0 }
}

/** Screen-space unit direction of a pitch direction (for ground arrows). */
export function pitchDirToScreen(dx: number, dy: number): Vec2 {
  const x = dy
  const y = -dx * TILT
  const l = Math.hypot(x, y)
  return l > 1e-9 ? { x: x / l, y: y / l } : { x: 0, y: 0 }
}

/** Draw-order depth from the pitch x (nearer the camera = lower on screen = drawn later). */
export const depthFor = (x: number, bias = 0) => 1000 + (PITCH_LENGTH - x) * 10 + bias

/** Cross camera: how far along ball → drop point the frame sits, and the pull-back. */
export const CROSS_CAM_T = 0.62
export const CROSS_CAM_ZOOM = 0.86

/**
 * Cross camera (WP-13 #4, 2.1#62). While a cross is in the air the live
 * camera swings off the ball toward where it will drop, framing the delivery
 * across the box from the flank (crosser, runners and keeper in one shot), and
 * pulls back a touch. Returns the pitch-space focus and a zoom multiplier.
 */
export function crossCamFrame(ball: Vec2, landing: Vec2): { x: number; y: number; zoomMult: number } {
  return { x: ball.x + (landing.x - ball.x) * CROSS_CAM_T, y: ball.y + (landing.y - ball.y) * CROSS_CAM_T, zoomMult: CROSS_CAM_ZOOM }
}

/** Cross framing: tightest and widest zoom (× base zoom) and the margin around the framed points (m). */
export const CROSS_FIT_MIN_ZOOM = 0.68
export const CROSS_FIT_PAD_M = 3.5

/**
 * Cross camera framing (WP-16, 2.1#62). A true side-on angle would need a
 * different projection: the pitch, stands, ad boards and goals are drawn in
 * this fixed behind-the-goal view, and touch aiming inverts {@link project}.
 * So instead of rotating the camera, the frame is fitted once at the moment of
 * delivery to hold the crosser, the drop point and the whole goal mouth (posts
 * and crossbar): the ball flies across a still frame, like a broadcast wide
 * shot. Returns the frame centre in world px and a zoom multiplier ≤ 1.
 *
 * `view` is the camera viewport (px) and `baseZoom` the normal live zoom.
 */
export function crossCamFit(
  from: Vec2,
  landing: Vec2,
  goal: { x: number; y: number; halfWidth: number; height: number },
  view: { w: number; h: number },
  baseZoom: number,
): { x: number; y: number; zoomMult: number } {
  const pts = [
    project(from.x, from.y),
    project(landing.x, landing.y),
    project(landing.x, landing.y, 2),
    project(goal.x, goal.y - goal.halfWidth),
    project(goal.x, goal.y + goal.halfWidth),
    project(goal.x, goal.y, goal.height),
  ]
  const pad = CROSS_FIT_PAD_M * PPM
  const minX = Math.min(...pts.map((p) => p.x)) - pad
  const maxX = Math.max(...pts.map((p) => p.x)) + pad
  const minY = Math.min(...pts.map((p) => p.y)) - pad
  const maxY = Math.max(...pts.map((p) => p.y)) + pad
  const fit = Math.min(view.w / Math.max(1, maxX - minX), view.h / Math.max(1, maxY - minY))
  const zoomMult = Math.min(1, Math.max(CROSS_FIT_MIN_ZOOM, fit / Math.max(1e-6, baseZoom)))
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, zoomMult }
}
