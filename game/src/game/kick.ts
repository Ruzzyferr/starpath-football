/**
 * Kick model: turns player input (swipes, aim + power bars, taps) into a ball
 * launch — initial velocity, lift and spin — applying the kicker's attributes
 * as accuracy noise and the chosen aim-assist level.
 *
 * Pure and deterministic given an {@link Rng}. Launch parameters are solved
 * numerically against the real physics ({@link stepBall}) so curl, drag and
 * wind are all accounted for: a curled swipe still ends where it was aimed —
 * the curve only shapes the path. Noise is applied after solving.
 */
import type { Attributes } from '../core/types'
import type { Rng } from '../core/rng'
import { GOAL_HEIGHT, PITCH_LENGTH, PITCH_WIDTH } from '../sim/match/types'
import {
  BALL_RADIUS,
  GOAL_CENTER_Y,
  GRAVITY,
  PHYSICS_DT,
  POST_Y_HIGH,
  POST_Y_LOW,
  createTracker,
  predictTrajectory,
  stepBall,
  type BallState,
  type PhysicsEnv,
  type PhysicsEvent,
  type Spin,
} from './physics'
import {
  a01,
  angleDiff,
  angleOf,
  clamp01,
  clampN,
  dist,
  dot,
  fromAngle,
  len,
  norm,
  pointSegment,
  sub,
  type Vec2,
} from './model'

export type AimAssist = 'full' | 'half' | 'manual'

/** A sampled pointer path point. `sx/sy` are screen coords normalised by the viewport's short side; `wx/wy` are pitch meters. */
export interface GesturePoint {
  sx: number
  sy: number
  wx: number
  wy: number
  /** Seconds. */
  t: number
}

/** Features extracted from a swipe. */
export interface SwipeFeatures {
  /** Unit direction on the pitch (chord of the swipe). */
  dir: Vec2
  /** Chord length in normalised screen units (1 = short side of the viewport). */
  length: number
  /** Duration in seconds. */
  duration: number
  /** Peak finger speed (normalised units / s, see {@link peakSpeed}). */
  speed: number
  /** 0..1.15 power; above 1 = overhit. */
  power: number
  /** -1..1 curl; positive bends toward +90° of the direction of travel (pitch coords). */
  curl: number
  /** Gesture reads as a chip (short flick or two fingers). */
  chip: boolean
  /** True when the gesture was too small to be a swipe (treat as tap). */
  isTap: boolean
}

/** Minimum normalised length for a gesture to count as a swipe. */
export const SWIPE_MIN_LENGTH = 0.045

/**
 * Gesture unit (owner feedback: power felt stuck mid-range). Swipe lengths and
 * speeds are measured in units of the viewport's short side, capped at
 * {@link GESTURE_UNIT_MAX_CSS} CSS px so that on a tablet or a big touch
 * screen a "full" swipe is the same physical size as on a large phone. `w`/`h`
 * are canvas pixels and `dpr` the canvas pixels per CSS pixel, so the result
 * is independent of the device pixel ratio and of the camera zoom (screen
 * space, not pitch meters).
 */
export const GESTURE_UNIT_MAX_CSS = 480
export function gestureUnit(w: number, h: number, dpr = 1): number {
  const short = Math.max(1, Math.min(w, h))
  return Math.min(short, GESTURE_UNIT_MAX_CSS * Math.max(1, dpr))
}

/** Release-velocity window (s), plan 2.1#18: speeds are measured over at least this span of samples. */
export const SWIPE_VELOCITY_WINDOW = 0.04
/** Swipe length (gesture units) that alone gives its full share of power. */
export const SWIPE_FULL_LENGTH = 0.5
/** Peak finger speed (units/s) below which speed adds nothing / at which it gives its full share. */
export const SWIPE_SOFT_SPEED = 0.45
export const SWIPE_FULL_SPEED = 3.2
/** Peak speed range that pushes a long swipe past full power into the overhit band. */
export const SWIPE_OVERHIT_SPEED = [4.6, 7] as const
/** Short quick flicks read as a chip (plan 2.1#47) — only genuinely tiny, sharp ones. */
export const CHIP_FLICK = { length: 0.12, duration: 0.15 } as const

/**
 * Swipe power from its length and peak speed (both in gesture units).
 * Additive and monotonic in both: a short slow push is soft (~0.12), a long
 * slow drag or a short sharp flick is mid-range (~0.55–0.7), a long fast
 * swipe is full power (1.0), and only a violent long flick overhits (≤1.15).
 */
export function swipePower(length: number, peakSpeed: number): number {
  const lenT = clamp01((length - SWIPE_MIN_LENGTH) / (SWIPE_FULL_LENGTH - SWIPE_MIN_LENGTH))
  const spdT = clamp01((peakSpeed - SWIPE_SOFT_SPEED) / (SWIPE_FULL_SPEED - SWIPE_SOFT_SPEED))
  const core = 0.1 + 0.9 * (0.45 * lenT + 0.55 * spdT)
  const [o0, o1] = SWIPE_OVERHIT_SPEED
  const over = 0.15 * clamp01((peakSpeed - o0) / (o1 - o0)) * lenT
  return clampN(core + over, 0, 1.15)
}

/**
 * Peak speed of a sampled path: the fastest stretch spanning at least
 * {@link SWIPE_VELOCITY_WINDOW} seconds, so batched or jittery samples
 * (a busy main thread delivering several touch moves at once) cannot spike it,
 * and the deceleration before a deliberate release does not erase it.
 */
export function peakSpeed(pts: readonly GesturePoint[]): number {
  const first = pts[0]
  const last = pts[pts.length - 1]
  if (!first || !last || pts.length < 2) return 0
  const total = Math.max(1 / 60, last.t - first.t)
  let best = Math.hypot(last.sx - first.sx, last.sy - first.sy) / total
  let j = 0
  for (let i = 1; i < pts.length; i++) {
    const pi = pts[i]!
    while (j + 1 < i && pi.t - pts[j + 1]!.t >= SWIPE_VELOCITY_WINDOW) j++
    const pj = pts[j]!
    const dt = pi.t - pj.t
    if (dt >= SWIPE_VELOCITY_WINDOW) best = Math.max(best, Math.hypot(pi.sx - pj.sx, pi.sy - pj.sy) / dt)
  }
  return best
}

/**
 * Analyses a pointer path.
 * @param pts sampled path, oldest first
 * @param fingers simultaneous touches during the gesture (≥2 → chip)
 */
export function analyzeSwipe(pts: readonly GesturePoint[], fingers = 1): SwipeFeatures {
  const first = pts[0]
  const last = pts[pts.length - 1]
  if (!first || !last || pts.length < 2) {
    return { dir: { x: 1, y: 0 }, length: 0, duration: 0, speed: 0, power: 0, curl: 0, chip: false, isTap: true }
  }
  const cdx = last.sx - first.sx
  const cdy = last.sy - first.sy
  const chord = Math.hypot(cdx, cdy)
  const duration = Math.max(1e-3, last.t - first.t)
  const speed = peakSpeed(pts)

  const wdir = norm({ x: last.wx - first.wx, y: last.wy - first.wy })
  const dir = len(wdir) > 0 ? wdir : { x: 1, y: 0 }

  // Curvature: max signed deviation from the chord (screen space has the same handedness as pitch space).
  let dev = 0
  if (chord > 1e-6) {
    const nx = -cdy / chord
    const ny = cdx / chord
    for (const p of pts) {
      const d = (p.sx - first.sx) * nx + (p.sy - first.sy) * ny
      if (Math.abs(d) > Math.abs(dev)) dev = d
    }
  }
  // A path bulging to +normal is drawn like a banana that bends back toward −normal.
  const curl = chord > 1e-6 ? clampN((-dev / chord) * 3.2, -1, 1) : 0
  const power = swipePower(chord, speed)
  const isTap = chord < SWIPE_MIN_LENGTH
  const chip = !isTap && (fingers >= 2 || (duration < CHIP_FLICK.duration && chord < CHIP_FLICK.length))
  return { dir, length: chord, duration, speed, power, curl: Math.abs(curl) < 0.08 ? 0 : curl, chip, isTap }
}

// ───────────────────────── Kick requests & plans ─────────────────────────

export type KickKind = 'pass' | 'lofted' | 'through' | 'shot' | 'chip' | 'cross' | 'header' | 'clear' | 'penalty' | 'freekick'

/** Something that can receive a pass. */
export interface PassCandidate {
  id: string
  pos: Vec2
  vel: Vec2
}

export interface KickRequest {
  kind: KickKind
  /** Ball position at contact. */
  from: Vec2
  /** Ball height at contact. */
  fromZ?: number
  /** Intended target point (ground point, or goal-line point for shots). */
  target: Vec2
  /** Desired height when reaching target (shots: height at goal line). Auto when omitted. */
  targetZ?: number
  /** 0..1.15 (above 1 is overhit). */
  power: number
  /** -1..1 */
  curl: number
  attrs: Attributes
  /** 0..1 defensive pressure on the kicker. */
  pressure: number
  assist: AimAssist
  env: PhysicsEnv
  /** Global accuracy multiplier (difficulty, panic…). 1 = normal. */
  noiseScale?: number
  /** Override of the aim-assist pull (see {@link assistShotTarget}). */
  assistPull?: number
  /** Placed (side-foot) finish (plan 2.1#47): accuracy +15 %, pace −25 %. */
  placed?: boolean
  /** Keeper distribution out of the hands (throw / roll / kick-out): accuracy leans on Distribution (GK). */
  fromHands?: boolean
}

/** Placed-shot modifiers (plan 2.1#47). */
export const PLACED_NOISE = 0.85
export const PLACED_SPEED = 0.75

/** Chip apex (m) for a distance (plan 2.1#47: 2.5–4 m). */
export const chipApex = (d: number): number => clampN(2.5 + (d - 6) * 0.1, 2.5, 4)

/**
 * Chip accuracy multiplier from the keeper's distance off his line (plan 2.1#47):
 * a keeper on his line (≤ 1.5 m) makes the chip hard (×1.4 noise), one
 * caught 6+ m off it makes it easy (×0.75).
 */
export function chipKeeperFactor(keeperOffLine: number): number {
  return clampN(1.4 - Math.max(0, keeperOffLine - 1.5) * (0.65 / 4.5), 0.75, 1.4)
}

export interface KickPlan {
  vx: number
  vy: number
  vz: number
  spin: Spin
  /** Target after assist, before noise. */
  aim: Vec2
  aimZ: number
  /** 0..1 estimate of execution quality (for commentary/feedback). */
  quality: number
  /** True when overhit beyond the skill limit (likely skied). */
  overhit: boolean
}

/** Curve and long passing (the v6 attributes; a sheet without them reads the closest older one). */
const curveOf = (at: Attributes): number => at.curve ?? at.setPieces
const longOf = (at: Attributes): number => at.longPassing ?? at.passing

/** Skill (0..1) relevant to a kick kind. */
export function kickSkill(kind: KickKind, at: Attributes, distance = 18): number {
  switch (kind) {
    case 'shot':
    case 'chip': {
      const close = clamp01((25 - distance) / 15)
      return a01(at.shooting * (1 - close * 0.5) + at.finishing * close * 0.5 + (kind === 'chip' ? at.composure * 0.15 - at.shooting * 0.15 : 0))
    }
    case 'penalty':
      return a01(at.finishing * 0.45 + at.shooting * 0.2 + at.composure * 0.35)
    case 'freekick':
      return a01(at.setPieces * 0.5 + curveOf(at) * 0.3 + at.shooting * 0.2)
    case 'cross':
      return a01(at.crossing * 0.75 + curveOf(at) * 0.15 + at.passing * 0.1)
    case 'header':
      return a01(at.heading * 0.75 + at.jumping * 0.25)
    case 'through': {
      // A through ball over distance is a long pass: the weight comes from long passing, the idea from vision.
      const long = clamp01((distance - 18) / 20)
      return a01(at.passing * (0.55 - long * 0.3) + longOf(at) * long * 0.3 + at.vision * 0.45)
    }
    case 'lofted':
      return a01(longOf(at) * 0.7 + at.vision * 0.3)
    case 'clear':
      return a01(at.strength * 0.35 + longOf(at) * 0.35 + at.heading * 0.3)
    case 'pass': {
      const long = clamp01((distance - 20) / 20)
      return a01(at.passing * (0.85 - long * 0.6) + longOf(at) * long * 0.6 + at.firstTouch * 0.15)
    }
  }
}

/**
 * Skill (0..1) of a keeper's release from the hands: Distribution (GK) carries most of it, the
 * kick kind's own skill (passing / vision) the rest. Sheets without the attribute fall back to passing.
 */
export function handsSkill(kind: KickKind, at: Attributes, distance = 18): number {
  return a01((at.gkDistribution ?? at.passing) * 0.8) + kickSkill(kind, at, distance) * 0.2
}

/** Maximum carry of a header (m), GDD 2.1#71. */
export const HEADER_RANGE = 18

/** Max side-spin (rad/s) a kicker can impart for a kick kind. */
export function maxSpin(kind: KickKind, at: Attributes): number {
  // Curve is the bend a kicker can put on it; the kick's own technique adds the rest.
  const curve = kind === 'freekick' || kind === 'cross' ? curveOf(at) * 0.6 + at.setPieces * 0.2 + at.crossing * 0.2 : curveOf(at) * 0.6 + at.shooting * 0.2 + at.passing * 0.2
  // Curve is the bend: a 40 puts half the spin of an 85 on it (≈ 49 rad/s for a 65, as before).
  return Math.max(5, -35 + a01(curve) * 130)
}

/** Largest bend (m) a kicker can put on a ball: 3.5 m scaled mostly by Curve, with set pieces and shooting (2.1#45). */
export const MAX_CURL_BEND = 3.5
export function curlCap(at: Attributes): number {
  return MAX_CURL_BEND * (0.3 + 0.7 * a01(curveOf(at) * 0.6 + at.setPieces * 0.2 + at.shooting * 0.2))
}

/** Max sideways distance (m) of a launch's flight from the straight line to `target` (noiseless). */
export function curlBulge(from: Vec2, z0: number, l: { vx: number; vy: number; vz: number; spin: Spin }, env: PhysicsEnv, target: Vec2): number {
  const d = dist(from, target)
  if (d < 1) return 0
  const axis = norm(sub(target, from))
  const pts = predictTrajectory({ x: from.x, y: from.y, z: z0, vx: l.vx, vy: l.vy, vz: l.vz, spin: { ...l.spin } }, env, { duration: 3, sampleEvery: 2, stopOnEnd: true })
  let best = 0
  for (const p of pts) {
    const along = (p.x - from.x) * axis.x + (p.y - from.y) * axis.y
    if (along > d) break
    best = Math.max(best, Math.abs((p.x - from.x) * -axis.y + (p.y - from.y) * axis.x))
  }
  return best
}

/** Shot speed (m/s) at power 1 for a kicker. */
export function shotSpeed(power: number, at: Attributes, kind: KickKind = 'shot'): number {
  const p = clampN(power, 0, 1.15)
  const strength = 26 + a01(at.shooting) * 6 + a01(at.strength) * 3
  if (kind === 'header') return 9 + p * (6 + a01(at.heading) * 6)
  return 11 + (strength - 11) * Math.pow(p, 0.85)
}

/** Result of the internal flight solver. */
interface FlightProbe {
  t: number
  /** Signed lateral error at the target plane (positive = to the +90° side of the heading). */
  lateral: number
  z: number
  /** Horizontal speed when reaching the plane. */
  arriveSpeed: number
  reached: boolean
}

/** Flies a ball until it crosses the plane through `target` perpendicular to `axis`. */
function probe(b0: BallState, env: PhysicsEnv, target: Vec2, axis: Vec2, maxT: number): FlightProbe {
  const b: BallState = { ...b0, spin: { ...b0.spin } }
  const tr = createTracker()
  const ev: PhysicsEvent[] = []
  const steps = Math.ceil(maxT / PHYSICS_DT)
  const nrm = { x: -axis.y, y: axis.x }
  let prevAlong = (b.x - target.x) * axis.x + (b.y - target.y) * axis.y
  for (let i = 1; i <= steps; i++) {
    const px = b.x
    const py = b.y
    const pz = b.z
    stepBall(b, env, tr, ev)
    ev.length = 0
    const along = (b.x - target.x) * axis.x + (b.y - target.y) * axis.y
    if (along >= 0 && prevAlong < 0) {
      const f = -prevAlong / (along - prevAlong || 1e-9)
      const cx = px + (b.x - px) * f
      const cy = py + (b.y - py) * f
      return {
        t: (i - 1 + f) * PHYSICS_DT,
        lateral: (cx - target.x) * nrm.x + (cy - target.y) * nrm.y,
        z: pz + (b.z - pz) * f,
        arriveSpeed: Math.hypot(b.vx, b.vy),
        reached: true,
      }
    }
    prevAlong = along
    if (b.z === 0 && Math.hypot(b.vx, b.vy) < 0.2) break
  }
  return { t: maxT, lateral: 0, z: b.z, arriveSpeed: 0, reached: false }
}

/**
 * Launch-speed range (m/s) per pass type (plan 2.1#57): short ground pass 8–16,
 * through ball 10–20, lofted 10–28, chip 7–18. Receivers then control the ball
 * by First Touch against its speed (runtime feetContact).
 */
export const PASS_SPEED_RANGE: Readonly<Partial<Record<KickKind, readonly [number, number]>>> = {
  pass: [8, 16], through: [10, 20], lofted: [10, 28], chip: [7, 18],
}
const passRange = (kind: KickKind, v: number): number => {
  const r = PASS_SPEED_RANGE[kind]
  return r ? clampN(v, r[0], r[1]) : v
}

/** Desired arrival speed of a ground pass over distance d. */
const passArriveSpeed = (d: number, power: number, kind: KickKind = 'pass') =>
  // A ball into space is weighted to die near the point so the runner can take it in stride (2.1#111).
  kind === 'through' ? 4 + d * 0.1 + power * 3.5 : 4.5 + d * 0.12 + power * 4

/**
 * Solves the launch for a request (no noise). Iterates against the physics so
 * the ball reaches `target` (and `targetZ` for aerial balls) with the given curl.
 */
export function solveLaunch(req: KickRequest, spinSide: number): { vx: number; vy: number; vz: number; spin: Spin; aimZ: number } {
  const from = req.from
  const z0 = req.fromZ ?? 0
  const delta = sub(req.target, from)
  const d = Math.max(0.5, len(delta))
  const axis = norm(delta)
  const base = angleOf(axis)
  const kind = req.kind
  const aerial = kind === 'lofted' || kind === 'chip' || kind === 'cross' || kind === 'clear'
  const ground = kind === 'pass' || kind === 'through'
  const env = req.env

  let heading = base
  let vh: number
  let vz: number
  let aimZ: number
  let flightT: number

  if (ground) {
    aimZ = 0
    flightT = 0
    vh = passRange(kind, Math.sqrt(passArriveSpeed(d, req.power, kind) ** 2 + 2 * (env.rollDecel + 0.5) * d))
    vz = 0
  } else if (aerial) {
    // Flight time grows with distance; chips hang longest.
    const hang = kind === 'chip' ? 1.15 : kind === 'cross' ? 0.65 : kind === 'clear' ? 0.9 : 0.8
    flightT = hang + d * (kind === 'chip' ? 0.032 : 0.036)
    aimZ = req.targetZ ?? (kind === 'cross' ? 1.7 : kind === 'chip' ? 1.2 : 0.4)
    if (kind === 'chip') {
      // Pick the flight time that peaks at chipApex(d) and comes down through aimZ.
      const H = Math.max(chipApex(d), aimZ + 0.3, z0 + 0.3)
      const v0 = Math.sqrt(2 * GRAVITY * (H - z0))
      flightT = (v0 + Math.sqrt(Math.max(0, v0 * v0 - 2 * GRAVITY * (aimZ - z0)))) / GRAVITY
    }
    vh = passRange(kind, d / flightT)
    vz = (aimZ - z0 + 0.5 * GRAVITY * flightT * flightT) / flightT
  } else {
    // Shots, headers, penalties, free kicks: speed from power, height from aim.
    vh = shotSpeed(req.power, req.attrs, kind) * (req.placed ? PLACED_SPEED : 1)
    aimZ = req.targetZ ?? 0.5
    flightT = d / vh
    vz = (aimZ - z0 + 0.5 * GRAVITY * flightT * flightT) / flightT
  }

  // Pre-aim against the expected Magnus drift (≈ ½·k·ω·d/v); the loop below refines it.
  heading -= (0.5 * env.magnus * spinSide * d) / Math.max(6, vh)
  // Free kicks get heavy topspin so they can rise over the wall and dip under the bar.
  const topspin = kind === 'freekick' ? 30 + a01(req.attrs.setPieces) * 14 : kind === 'chip' ? -18 : kind === 'shot' ? 6 : 0
  const spin: Spin = { side: spinSide, top: topspin }
  for (let it = 0; it < 6; it++) {
    const dir = fromAngle(heading)
    const b: BallState = { x: from.x, y: from.y, z: z0, vx: dir.x * vh, vy: dir.y * vh, vz, spin: { ...spin } }
    const pr = probe(b, env, req.target, axis, 4.5)
    if (!pr.reached) {
      vh = passRange(kind, vh * 1.25)
      continue
    }
    heading -= Math.atan2(pr.lateral, d) * 0.95
    if (ground) {
      const want = passArriveSpeed(d, req.power, kind)
      vh = passRange(kind, Math.max(3, vh + (want - pr.arriveSpeed) * 0.8))
    } else if (aerial) {
      vh = passRange(kind, vh * clampN(pr.t / flightT, 0.6, 1.6))
      vz += (aimZ - pr.z) / Math.max(0.3, pr.t)
    } else {
      vz += (aimZ - pr.z) / Math.max(0.15, pr.t)
    }
  }
  const dir = fromAngle(heading)
  return { vx: dir.x * vh, vy: dir.y * vh, vz: Math.max(0, vz), spin, aimZ }
}

/** Shot height at the goal line as a function of power (overhit → skied). */
export function shotHeightForPower(power: number, kind: KickKind = 'shot'): number {
  const p = clampN(power, 0, 1.15)
  const over = Math.max(0, p - 1)
  const base = kind === 'penalty' ? 0.25 : kind === 'freekick' ? 0.75 : 0.3
  return base + 1.5 * p * p + over * 9
}

/** Share of an off-frame aim error that each assist level removes. */
export const ASSIST_PULL: Record<AimAssist, number> = { full: 0.6, half: 0.35, manual: 0 }

/**
 * Applies aim assist to a shot target on the goal line: the part of the aim
 * that lies outside the frame (wide or over) is reduced by a share of its
 * size — it is never snapped inside the posts, so a wild swipe still misses
 * and aiming skill still matters. `pull` overrides the level's share (easy
 * mode is more generous).
 */
export function assistShotTarget(target: Vec2, z: number, assist: AimAssist, pull = ASSIST_PULL[assist]): { target: Vec2; z: number } {
  if (pull <= 0) return { target, z }
  const lo = POST_Y_LOW + 0.55
  const hi = POST_Y_HIGH - 0.55
  const ty = clampN(target.y, lo, hi)
  const tz = clampN(z, 0.25, GOAL_HEIGHT - 0.4)
  return { target: { x: target.x, y: target.y + (ty - target.y) * pull }, z: z + (tz - z) * pull }
}

/** Power bands of the aim ring (plan 2.1#19): green 0–0.6, yellow 0.6–0.85, red 0.85–1.0, then overhit. */
export const POWER_BANDS = { yellow: 0.6, red: 0.85 } as const

/**
 * Accuracy-noise factor from power (2.1#19): in the red band (0.85–1.0) the
 * aim drifts by up to +15 % at Composure 0 (none at 100); past full power the
 * kick is overhit and spreads fast (skied / sliced).
 */
export function powerSpread(power: number, composure: number): number {
  const redT = clamp01((power - POWER_BANDS.red) / (1 - POWER_BANDS.red))
  return 1 + 0.15 * redT * (1 - a01(composure)) + Math.max(0, power - 1) * 4.8
}

/** Kicks whose accuracy falls away over a long distance (long passing). */
const PASS_KINDS_RANGE: ReadonlySet<KickKind> = new Set<KickKind>(['pass', 'lofted', 'through'])

/** Accuracy noise (radians, 1σ) for a kick. */
export function headingNoise(req: KickRequest, skill: number): number {
  const baseDeg: Record<KickKind, number> = {
    pass: 2.6, lofted: 3.4, through: 3.2, shot: 4.2, chip: 4.5, cross: 4.0, header: 7, clear: 8, penalty: 2.4, freekick: 3.4,
  }
  const comp = a01(req.attrs.composure)
  // Composure under pressure: a nervous kicker (0) is shaken 1.6×, an ice-cold one (100) barely 1.2×.
  const pressure = 1 + req.pressure * (1.6 - 1.4 * comp)
  const overhit = powerSpread(req.power, req.attrs.composure)
  const assist = req.assist === 'full' ? 0.6 : req.assist === 'half' ? 0.8 : 1
  // From range a strike (beyond 20 m) drifts more for a weak kicker; a long pass (beyond 25 m) drifts more for a poor passer, less for a good one.
  const d = dist(req.from, req.target)
  const range = req.kind === 'shot' ? 1 + Math.max(0, d - 20) * 0.06 * (1.2 - skill) : PASS_KINDS_RANGE.has(req.kind) ? Math.max(0.7, 1 + Math.max(0, d - 25) * 0.04 * (0.65 - skill)) : 1
  const deg = baseDeg[req.kind] * (1.3 - skill) * pressure * overhit * assist * range * (req.noiseScale ?? 1) * (req.placed ? PLACED_NOISE : 1)
  return (deg * Math.PI) / 180
}

/**
 * Plans a kick: assist → solve → noise.
 * @param req kick request
 * @param rng deterministic RNG for execution noise (omit for a noiseless preview)
 */
export function planKick(req: KickRequest, rng?: Rng): KickPlan {
  const distance = dist(req.from, req.target)
  const skill = req.fromHands ? handsSkill(req.kind, req.attrs, distance) : kickSkill(req.kind, req.attrs, distance)
  let target = req.target
  let targetZ = req.targetZ
  const isShot = req.kind === 'shot' || req.kind === 'penalty' || req.kind === 'freekick' || req.kind === 'header'
  if (isShot) {
    const z = targetZ ?? shotHeightForPower(req.power, req.kind)
    const as = assistShotTarget(target, z, req.assist, req.assistPull)
    target = as.target
    targetZ = as.z
  }
  let power = req.power
  if (req.kind === 'header') {
    // Heading range (2.1#71): nobody heads it further than HEADER_RANGE; beyond that the
    // header drops short (a cushioned knock-down rather than a shot).
    const hd = dist(req.from, target)
    if (hd > HEADER_RANGE) {
      target = { x: req.from.x + ((target.x - req.from.x) * HEADER_RANGE) / hd, y: req.from.y + ((target.y - req.from.y) * HEADER_RANGE) / hd }
      targetZ = 0
      power = Math.min(power, 0.55)
    }
  }
  let spinSide = req.kind === 'header' ? 0 : clampN(req.curl, -1, 1) * maxSpin(req.kind, req.attrs)
  let solved = solveLaunch({ ...req, power, target, targetZ }, spinSide)
  if (spinSide !== 0) {
    // Magnus cap (plan 2.1#45): the bend never exceeds curlCap(attrs) metres off the straight line.
    const cap = curlCap(req.attrs)
    const bend = curlBulge(req.from, req.fromZ ?? 0, solved, req.env, target)
    if (bend > cap) {
      spinSide *= cap / bend
      solved = solveLaunch({ ...req, power, target, targetZ }, spinSide)
    }
  }

  let { vx, vy, vz } = solved
  const spin = { ...solved.spin }
  let quality = clamp01(skill * (1 - req.pressure * 0.3) - Math.max(0, req.power - 1) * 2)
  const overhit = req.power > 1 + skill * 0.08

  if (rng) {
    const sd = headingNoise(req, skill)
    const errA = rng.normal(0, sd)
    const c = Math.cos(errA)
    const s = Math.sin(errA)
    const nvx = vx * c - vy * s
    const nvy = vx * s + vy * c
    vx = nvx
    vy = nvy
    // Height and pace scatter grows with power and lack of skill.
    const hErr = rng.normal(0, (0.35 + Math.max(0, req.power - 0.85) * 3) * (1.25 - skill) * (req.noiseScale ?? 1))
    vz = Math.max(0, vz + hErr)
    const sErr = 1 + rng.normal(0, 0.04 * (1.3 - skill))
    vx *= sErr
    vy *= sErr
    spin.side *= 1 + rng.normal(0, 0.12 * (1.2 - skill))
    quality = clamp01(quality - Math.abs(errA) / Math.max(1e-3, sd) * 0.08)
  }
  return { vx, vy, vz, spin, aim: target, aimZ: solved.aimZ, quality, overhit }
}

/** Applies a plan to a ball state (contact). */
export function applyKick(ball: BallState, plan: KickPlan): void {
  ball.vx = plan.vx
  ball.vy = plan.vy
  ball.vz = plan.vz
  ball.spin.side = plan.spin.side
  ball.spin.top = plan.spin.top
  if (ball.z < BALL_RADIUS * 0.1) ball.z = 0
}

// ───────────────────────── Targeting ─────────────────────────

/**
 * Predicts where a moving receiver should get the ball (lead pass).
 * @param from passer position
 * @param receiver current receiver position/velocity
 * @param ballSpeed average ball speed estimate
 */
export function leadPosition(from: Vec2, receiver: PassCandidate, ballSpeed: number, maxLead = 9): Vec2 {
  let p = receiver.pos
  for (let i = 0; i < 4; i++) {
    const t = dist(from, p) / Math.max(4, ballSpeed)
    const lead = { x: receiver.vel.x * t, y: receiver.vel.y * t }
    const l = len(lead)
    const k = l > maxLead ? maxLead / l : 1
    p = { x: receiver.pos.x + lead.x * k, y: receiver.pos.y + lead.y * k }
  }
  return {
    x: clampN(p.x, 1, PITCH_LENGTH - 1),
    y: clampN(p.y, 1, PITCH_WIDTH - 1),
  }
}

/** Snap cone half-angle (radians) per assist level. */
export function snapCone(assist: AimAssist): number {
  return assist === 'full' ? (38 * Math.PI) / 180 : assist === 'half' ? (20 * Math.PI) / 180 : 0
}

/**
 * Picks the best teammate in the direction of a gesture.
 * Scores by angular closeness, distance and lane openness.
 */
export function pickPassTarget(
  from: Vec2,
  dir: Vec2,
  mates: readonly PassCandidate[],
  opponents: readonly Vec2[],
  assist: AimAssist,
  coneOverride?: number,
): PassCandidate | null {
  const cone = coneOverride ?? Math.max(snapCone(assist), (9 * Math.PI) / 180)
  const da = angleOf(dir)
  let best: PassCandidate | null = null
  let bestScore = -Infinity
  for (const m of mates) {
    const d = dist(from, m.pos)
    if (d < 2.5 || d > 55) continue
    const off = Math.abs(angleDiff(angleOf(sub(m.pos, from)), da))
    if (off > cone) continue
    const open = laneOpenness(from, m.pos, opponents)
    const score = -off * 3 - d * 0.015 + open * 0.8
    if (score > bestScore) {
      bestScore = score
      best = m
    }
  }
  return best
}

/** 0..1 how open the lane from a to b is (1 = no opponent near the line). */
export function laneOpenness(a: Vec2, b: Vec2, opponents: readonly Vec2[]): number {
  let minD = Infinity
  for (const o of opponents) {
    const ps = pointSegment(o, a, b)
    if (ps.t < 0.05) continue
    minD = Math.min(minD, ps.d)
  }
  return clamp01((minD - 0.6) / 3.5)
}

/** Point where a ray from `from` along `dir` crosses the attacking goal line, or null. */
export function rayToGoalLine(from: Vec2, dir: Vec2, goalX = PITCH_LENGTH): Vec2 | null {
  if (Math.abs(dir.x) < 1e-6) return null
  const t = (goalX - from.x) / dir.x
  if (t <= 0) return null
  return { x: goalX, y: from.y + dir.y * t }
}

/** A cross delivery zone. `ground` zones are pulled back along the floor (cut-back). */
export interface CrossZone {
  name: 'near_post' | 'far_post' | 'penalty_spot' | 'cut_back'
  point: Vec2
  /** Desired ball height on arrival (header height for aerial zones). */
  z: number
  ground: boolean
}

/**
 * The four classic delivery zones for a cross from the flank at `fromY`
 * (attacking +x): near post, far post, penalty spot and the cut-back to the
 * edge of the six-yard/penalty area on the near side.
 */
export function crossZones(fromY: number, goalX = PITCH_LENGTH): CrossZone[] {
  const side = fromY < GOAL_CENTER_Y ? -1 : 1
  const dir = goalX > PITCH_LENGTH / 2 ? -1 : 1
  return [
    { name: 'near_post', point: { x: goalX + dir * 5, y: GOAL_CENTER_Y + side * 2.6 }, z: 1.8, ground: false },
    { name: 'far_post', point: { x: goalX + dir * 6, y: GOAL_CENTER_Y - side * 3.8 }, z: 1.9, ground: false },
    { name: 'penalty_spot', point: { x: goalX + dir * 11, y: GOAL_CENTER_Y - side * 0.5 }, z: 1.8, ground: false },
    { name: 'cut_back', point: { x: goalX + dir * 13.5, y: GOAL_CENTER_Y + side * 5 }, z: 0, ground: true },
  ]
}

/** Zone closest to a raw delivery point (assisted crossing snaps to it). */
export function nearestZone(zones: readonly CrossZone[], p: Vec2): CrossZone {
  let best = zones[0]
  let bd = Infinity
  for (const z of zones) {
    const d = dist(z.point, p)
    if (d < bd) {
      bd = d
      best = z
    }
  }
  return best!
}

/** Contextual interpretation of a swipe by the ball carrier. */
export type GestureMeaning =
  | { kind: 'shot'; target: Vec2; chip: boolean }
  | { kind: 'pass'; to: PassCandidate; lofted: boolean }
  | { kind: 'through'; point: Vec2; lofted: boolean }
  | { kind: 'cross'; point: Vec2; zone?: CrossZone }

/**
 * Decides what a swipe means for the ball carrier: a shot if it points at the
 * goal from shooting range, a cross from wide areas into the box, a pass if a
 * teammate is in the cone, otherwise a through ball into space.
 */
export function interpretSwipe(
  sw: SwipeFeatures,
  ball: Vec2,
  mates: readonly PassCandidate[],
  opponents: readonly Vec2[],
  assist: AimAssist,
): GestureMeaning {
  const goalHit = rayToGoalLine(ball, sw.dir)
  const distGoal = dist(ball, { x: PITCH_LENGTH, y: GOAL_CENTER_Y })
  const towardGoal = goalHit !== null && Math.abs(goalHit.y - GOAL_CENTER_Y) < 9 + (assist === 'full' ? 4 : 0)
  const wide = ball.x > 68 && (ball.y < 15 || ball.y > PITCH_WIDTH - 15)
  if (towardGoal && distGoal < 38 && !wide) {
    return { kind: 'shot', target: goalHit, chip: sw.chip }
  }
  const mate = pickPassTarget(ball, sw.dir, mates, opponents, assist)
  if (wide && sw.dir.x > -0.2) {
    // Into the box from the flank → cross toward the best attacker or the penalty spot area.
    const intoBox = Math.abs(angleDiff(angleOf(sw.dir), angleOf(sub({ x: PITCH_LENGTH - 9, y: GOAL_CENTER_Y }, ball)))) < 0.7
    if (intoBox) {
      const reach = 10 + sw.power * 26
      const raw = { x: ball.x + sw.dir.x * reach, y: ball.y + sw.dir.y * reach }
      if (assist === 'manual') return { kind: 'cross', point: raw }
      // Assisted: snap to the delivery zone the swipe points at (full) or halfway toward it (half).
      // …preferring a zone a team-mate is arriving at.
      const zones = crossZones(ball.y)
      const mateGap = (z: CrossZone) => Math.min(12, ...mates.map((m) => dist(leadPosition(ball, m, 20, 4), z.point)))
      const zone = zones.reduce((best, z) => (dist(raw, z.point) + mateGap(z) * 0.8 < dist(raw, best.point) + mateGap(best) * 0.8 ? z : best), nearestZone(zones, raw))
      const point = assist === 'full' ? zone.point : { x: (raw.x + zone.point.x) / 2, y: (raw.y + zone.point.y) / 2 }
      return { kind: 'cross', point, zone }
    }
  }
  if (mate) {
    const lofted = sw.chip || dist(ball, mate.pos) > 28 || laneOpenness(ball, mate.pos, opponents) < 0.15
    return { kind: 'pass', to: mate, lofted }
  }
  const reach = 6 + sw.power * 24
  const point = {
    x: clampN(ball.x + sw.dir.x * reach, 1, PITCH_LENGTH - 1),
    y: clampN(ball.y + sw.dir.y * reach, 1, PITCH_WIDTH - 1),
  }
  return { kind: 'through', point, lofted: sw.chip }
}

/**
 * Converts a shot gesture into a goal-line target. The swipe direction picks
 * the y on the goal line; curl shifts the launch while the solver keeps the end point.
 */
export function shotTargetFromDir(from: Vec2, dir: Vec2): Vec2 {
  const hit = rayToGoalLine(from, dir)
  if (hit) return { x: PITCH_LENGTH + BALL_RADIUS * 2, y: hit.y }
  // Pointing sideways/backwards: aim at the near post side.
  return { x: PITCH_LENGTH + BALL_RADIUS * 2, y: dir.y >= 0 ? POST_Y_HIGH + 2 : POST_Y_LOW - 2 }
}

/** True if a direction from `from` is broadly toward the attacking goal. */
export function facesGoal(from: Vec2, dir: Vec2): boolean {
  const toGoal = norm(sub({ x: PITCH_LENGTH, y: GOAL_CENTER_Y }, from))
  return dot(toGoal, dir) > 0.45
}

// ───────────────────────── Control schemes (WP-13) ─────────────────────────

/** Touch shooting scheme: free swipe (default), pull-back sling-shot, or tap + oscillating power meter. */
export type TouchShotScheme = 'swipe' | 'slingshot' | 'meter'
/** PC power: charge while held (default) or an oscillating bar locked on release. */
export type PowerScheme = 'hold' | 'oscillate'
/** Gamepad power: hold-charge, oscillating bar, or analog (left-trigger depth) power. */
export type PadPowerScheme = 'hold' | 'oscillate' | 'analog'

/** Pull length (fraction of the short screen side) that gives 100% sling-shot power. */
export const SLING_FULL = 0.4

/**
 * Sling-shot (pull-back) interpretation of a drag: the ball goes the opposite
 * way, power follows the pull length (not the flick speed). A point reflection
 * keeps the curl's handedness, so the curl value is unchanged.
 * @param fingers simultaneous touches (≥2 → chip)
 */
export function slingshotSwipe(sw: SwipeFeatures, fingers = 1): SwipeFeatures {
  if (sw.isTap) return sw
  const pull = sw.length / SLING_FULL
  const power = clampN(0.12 + pull * 0.88, 0, 1.15)
  return { ...sw, dir: { x: -sw.dir.x, y: -sw.dir.y }, power, chip: fingers >= 2 }
}

/** Seconds for one full oscillation (min → max → min) of the power meter. */
export const OSC_PERIOD = 1.1
export const OSC_MIN = 0.15
export const OSC_MAX = 1.15

/** Triangle-wave power meter: OSC_MIN at t=0, OSC_MAX at half a period. */
export function oscillatingPower(t: number, period = OSC_PERIOD): number {
  const ph = (((t / period) % 1) + 1) % 1
  const tri = ph < 0.5 ? ph * 2 : 2 - ph * 2
  return OSC_MIN + (OSC_MAX - OSC_MIN) * tri
}

/** Charge-while-held power (the default scheme). */
export const CHARGE_TIME = 0.95
export function chargePower(held: number): number {
  return Math.min(1.15, Math.max(0, held) / CHARGE_TIME)
}

/** Mouse-wheel curl step per notch. */
export const WHEEL_CURL_STEP = 0.2

/** Mouse wheel → curl: wheel up bends one way, down the other, clamped to ±1. */
export function wheelCurl(curl: number, deltaY: number): number {
  if (!deltaY) return curl
  return clampN(Math.round((curl + (deltaY < 0 ? WHEEL_CURL_STEP : -WHEEL_CURL_STEP)) * 10) / 10, -1, 1)
}

/** Default stick dead zone. */
export const PAD_DEADZONE = 0.18

/**
 * Radial dead zone with rescale: |v| ≤ dz → 0, full deflection (≈0.93, real
 * sticks rarely hit 1) → 1, linear in between, direction preserved.
 */
export function radialDeadzone(x: number, y: number, dz = PAD_DEADZONE): { x: number; y: number; mag: number } {
  const m = Math.hypot(x, y)
  if (m <= dz) return { x: 0, y: 0, mag: 0 }
  const mag = Math.min(1, (m - dz) / Math.max(0.05, 0.93 - dz))
  return { x: (x / m) * mag, y: (y / m) * mag, mag }
}

/** Single-axis dead zone with rescale (curl stick). */
export function axisDeadzone(v: number, dz = PAD_DEADZONE): number {
  const a = Math.abs(v)
  if (a <= dz) return 0
  return Math.sign(v) * Math.min(1, (a - dz) / Math.max(0.05, 0.93 - dz))
}

/** Analog power from a trigger depth 0..1 → 0.3..1.15 (fully pressed = overhit). */
export function analogPower(trigger: number): number {
  return 0.3 + 0.85 * clamp01(trigger)
}

/**
 * Analog aim: the stick's lateral (pitch-y) deflection picks the spot on the
 * goal line directly, independent of where the shooter stands. Centre stick =
 * centre of goal; full deflection = just outside the post.
 */
export function analogShotTarget(stickY: number): Vec2 {
  const half = (POST_Y_HIGH - POST_Y_LOW) / 2 + 0.45
  return { x: PITCH_LENGTH + BALL_RADIUS * 2, y: GOAL_CENTER_Y + clampN(stickY, -1, 1) * half }
}

/**
 * Vision-based pass options: team-mates the hero "sees" as good outlets, best
 * first. Vision widens the scanned range (22 m → 52 m) and how many options
 * are shown (1 / 2 / 3). Scores lane openness, forward progress and a
 * comfortable distance. Deterministic.
 * @param vision hero vision attribute 0..100
 */
/** Pass options shown by Vision (plan 2.1#60): 30 → 2, 60 → 4, 85+ → every team-mate. */
export function visionOptionCount(vision: number): number {
  return vision >= 85 ? Infinity : vision >= 60 ? 4 : vision >= 45 ? 3 : 2
}

export function rankPassOptions(from: Vec2, vision: number, mates: readonly PassCandidate[], opponents: readonly Vec2[], attackX = 1): string[] {
  const v = clampN(vision, 0, 100)
  const range = 22 + v * 0.3
  const count = visionOptionCount(v)
  const scored: { id: string; s: number }[] = []
  for (const m of mates) {
    const d = dist(from, m.pos)
    if (d < 4 || d > range) continue
    const open = laneOpenness(from, m.pos, opponents)
    if (open < 0.2) continue
    const fwd = ((m.pos.x - from.x) * attackX) / 30
    scored.push({ id: m.id, s: open * 1.2 + clampN(fwd, -0.6, 1) - Math.abs(d - 16) / 40 })
  }
  scored.sort((a, b) => b.s - a.s || (a.id < b.id ? -1 : 1))
  return scored.slice(0, count).map((x) => x.id)
}
