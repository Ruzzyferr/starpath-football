/**
 * 2.5D football physics — pure, deterministic, renderer-independent.
 *
 * World units are meters and seconds. The pitch lies in the x/y plane
 * (x ∈ [0, PITCH_LENGTH] along the length, y ∈ [0, PITCH_WIDTH] across) and
 * `z` is height above the grass. Goals sit on the two goal lines (x = 0 and
 * x = PITCH_LENGTH) centred on y = PITCH_WIDTH / 2.
 *
 * The integrator is a fixed-timestep semi-implicit Euler at {@link PHYSICS_DT}
 * (60 Hz). Given the same inputs it always produces the same outputs — no
 * randomness and no wall-clock time are used here.
 *
 * Forces modelled:
 * - gravity, quadratic air drag (relative to wind), Magnus lift from spin
 * - bounces with restitution + tangential friction, spin/grip interaction
 * - rolling resistance on grass (weather dependent)
 * - post / crossbar collisions (cylinders), net capture behind the goal line
 */
import { GOAL_HEIGHT, GOAL_WIDTH, PITCH_LENGTH, PITCH_WIDTH } from '../sim/match/types'
import type { Weather } from '../sim/match/types'

/** Fixed simulation step (seconds). */
export const PHYSICS_DT = 1 / 60
/** Gravitational acceleration (m/s²). */
export const GRAVITY = 9.81
/** Ball radius (m), size-5 ball. */
export const BALL_RADIUS = 0.11
/** Radius of the goal posts and crossbar (m). */
export const POST_RADIUS = 0.06
/** Depth of the goal net behind the goal line (m). */
export const NET_DEPTH = 2.0
/** Centre of the goal mouth on the y axis. */
export const GOAL_CENTER_Y = PITCH_WIDTH / 2
/** y coordinate of the "left" post (lower y) — centre of the post cylinder. */
export const POST_Y_LOW = GOAL_CENTER_Y - GOAL_WIDTH / 2 - POST_RADIUS
/** y coordinate of the "right" post (higher y). */
export const POST_Y_HIGH = GOAL_CENTER_Y + GOAL_WIDTH / 2 + POST_RADIUS
/** Height of the crossbar's centre line. */
export const BAR_Z = GOAL_HEIGHT + POST_RADIUS

/** Spin of the ball, rad/s. */
export interface Spin {
  /**
   * Rotation about the vertical (+z) axis. Positive spin bends the path toward the
   * travel direction rotated +90° in pitch coordinates (i.e. from +x toward +y).
   */
  side: number
  /** Rotation about the horizontal axis perpendicular to travel. Positive = topspin (dips), negative = backspin (floats). */
  top: number
}

/** Complete mutable state of the ball. */
export interface BallState {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  spin: Spin
}

/** Environment parameters derived from weather. */
export interface PhysicsEnv {
  /** Rolling deceleration on grass (m/s²). */
  rollDecel: number
  /** Extra velocity-proportional rolling damping (1/s). */
  rollDamping: number
  /** Vertical restitution on bounce (0..1). */
  restitution: number
  /** Fraction of tangential speed kept on a bounce (skid on wet grass keeps more). */
  bounceGrip: number
  /** Quadratic drag coefficient k in a = -k |v_rel| v_rel. */
  drag: number
  /** Magnus coefficient: a = magnus * (ω × v). */
  magnus: number
  /** Exponential spin decay rate in the air (1/s). */
  spinDecay: number
  /** Wind velocity (m/s) in the pitch plane. */
  wind: { x: number; y: number }
}

/** Default dry-grass environment. */
export const DEFAULT_ENV: Readonly<PhysicsEnv> = Object.freeze({
  rollDecel: 1.25,
  rollDamping: 0.16,
  restitution: 0.58,
  bounceGrip: 0.8,
  drag: 0.0135,
  magnus: 0.0055,
  spinDecay: 0.35,
  wind: Object.freeze({ x: 0, y: 0 }),
})

/**
 * Builds the physics environment for a weather type.
 * @param weather match weather
 * @param windDir unit-free direction for wind (only used for 'wind'); defaults to blowing across the pitch.
 */
export function envForWeather(weather: Weather, windDir: { x: number; y: number } = { x: 0.35, y: 1 }): PhysicsEnv {
  const env: PhysicsEnv = { ...DEFAULT_ENV, wind: { x: 0, y: 0 } }
  switch (weather) {
    case 'rain':
      // Wet grass: ball skids, keeps pace, bounces lower.
      env.rollDecel = 0.8
      env.rollDamping = 0.1
      env.restitution = 0.48
      env.bounceGrip = 0.92
      break
    case 'snow':
      env.rollDecel = 2.2
      env.rollDamping = 0.35
      env.restitution = 0.4
      env.bounceGrip = 0.62
      break
    case 'wind': {
      const len = Math.hypot(windDir.x, windDir.y) || 1
      const speed = 6.5
      env.wind = { x: (windDir.x / len) * speed, y: (windDir.y / len) * speed }
      break
    }
    case 'hot':
      // Thin, dry air & hard pitch: livelier ball.
      env.drag = 0.0125
      env.restitution = 0.63
      env.rollDecel = 1.1
      break
    case 'clear':
      break
  }
  return env
}

/** Creates a ball at rest. */
export function createBall(x: number, y: number, z = 0): BallState {
  return { x, y, z, vx: 0, vy: 0, vz: 0, spin: { side: 0, top: 0 } }
}

/** Deep copy of a ball state. */
export function cloneBall(b: BallState): BallState {
  return { x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, spin: { side: b.spin.side, top: b.spin.top } }
}

/** Horizontal speed (m/s). */
export function groundSpeed(b: BallState): number {
  return Math.hypot(b.vx, b.vy)
}

/** Total speed (m/s). */
export function speed3(b: BallState): number {
  return Math.hypot(b.vx, b.vy, b.vz)
}

/** Which goal: the one at x = 0 ('west') or x = PITCH_LENGTH ('east'). Hero always attacks 'east'. */
export type GoalEnd = 'west' | 'east'

/** Events produced by a physics step. */
export type PhysicsEvent =
  | { type: 'bounce'; x: number; y: number; speed: number }
  | { type: 'post'; end: GoalEnd; x: number; y: number; z: number; speed: number }
  | { type: 'bar'; end: GoalEnd; x: number; y: number; z: number; speed: number }
  | { type: 'goal'; end: GoalEnd; x: number; y: number; z: number }
  | { type: 'net'; end: GoalEnd; speed: number }
  | { type: 'out'; line: 'goal' | 'touch'; end: GoalEnd | null; x: number; y: number }

/** Mutable per-ball bookkeeping that lets {@link stepBall} report line crossings once. */
export interface BallTracker {
  /** Goal already scored this flight (ball is now inside the net). */
  inGoal: GoalEnd | null
  /** Ball already left the field of play. */
  out: boolean
}

export function createTracker(): BallTracker {
  return { inGoal: null, out: false }
}

const goalLineX = (end: GoalEnd) => (end === 'east' ? PITCH_LENGTH : 0)

/**
 * Advances the ball by exactly one fixed step.
 *
 * @param b ball state, mutated in place
 * @param env environment parameters
 * @param tracker crossing bookkeeping, mutated in place
 * @param events output array — events are pushed, never cleared
 * @param dt timestep (defaults to {@link PHYSICS_DT}); pass the default for determinism
 */
export function stepBall(
  b: BallState,
  env: PhysicsEnv,
  tracker: BallTracker,
  events: PhysicsEvent[],
  dt: number = PHYSICS_DT,
): void {
  // Near a goal frame, sub-step so fast shots cannot tunnel through posts/bar.
  const nearGoal = b.x < 4 || b.x > PITCH_LENGTH - 4
  if (nearGoal) {
    const travel = Math.hypot(b.vx, b.vy, b.vz) * dt
    const n = Math.min(12, Math.max(1, Math.ceil(travel / 0.06)))
    const sdt = dt / n
    for (let i = 0; i < n; i++) stepCore(b, env, tracker, events, sdt)
    return
  }
  stepCore(b, env, tracker, events, dt)
}

function stepCore(b: BallState, env: PhysicsEnv, tracker: BallTracker, events: PhysicsEvent[], dt: number): void {
  const px = b.x
  const py = b.y
  const airborne = b.z > 1e-4 || b.vz > 1e-4

  if (airborne) {
    // Air: gravity + drag (relative to wind) + Magnus.
    const rvx = b.vx - env.wind.x
    const rvy = b.vy - env.wind.y
    const rvz = b.vz
    const rs = Math.hypot(rvx, rvy, rvz)
    let ax = -env.drag * rs * rvx
    let ay = -env.drag * rs * rvy
    let az = -env.drag * rs * rvz - GRAVITY

    // Magnus: ω × v. Side spin is ω along +z; top spin is ω along the axis
    // h = ẑ × v̂_h rotated so that topspin pushes the ball down.
    const hs = Math.hypot(b.vx, b.vy)
    if (hs > 1e-3) {
      const ux = b.vx / hs
      const uy = b.vy / hs
      // ω_z ẑ × v = ω_z (-vy, vx, 0)
      ax += env.magnus * b.spin.side * -b.vy
      ay += env.magnus * b.spin.side * b.vx
      // Topspin axis a = (-uy, ux, 0); a × v = (ux·vz, uy·vz, -|v_h|) so positive topspin dips.
      const wt = b.spin.top
      ax += env.magnus * wt * (ux * b.vz)
      ay += env.magnus * wt * (uy * b.vz)
      az += env.magnus * wt * -hs
    }

    b.vx += ax * dt
    b.vy += ay * dt
    b.vz += az * dt
    b.x += b.vx * dt
    b.y += b.vy * dt
    b.z += b.vz * dt

    const decay = Math.exp(-env.spinDecay * dt)
    b.spin.side *= decay
    b.spin.top *= decay

    if (b.z <= 0) {
      b.z = 0
      const impact = -b.vz
      if (impact > 1.2) {
        b.vz = impact * env.restitution
        // Tangential friction on bounce; topspin grips and kicks forward, backspin checks.
        const hsp = Math.hypot(b.vx, b.vy)
        if (hsp > 1e-3) {
          const grip = env.bounceGrip + b.spin.top * 0.004
          const k = Math.max(0.35, Math.min(1.08, grip))
          b.vx *= k
          b.vy *= k
        }
        b.spin.side *= 0.6
        b.spin.top *= 0.5
        events.push({ type: 'bounce', x: b.x, y: b.y, speed: impact })
      } else {
        b.vz = 0
      }
    }
  } else {
    // Rolling on grass.
    b.z = 0
    b.vz = 0
    const s = Math.hypot(b.vx, b.vy)
    if (s > 0) {
      const dec = (env.rollDecel + env.rollDamping * s) * dt
      const ns = Math.max(0, s - dec)
      const f = ns / s
      b.vx *= f
      b.vy *= f
      // Residual side spin bends a rolling ball slightly too.
      if (Math.abs(b.spin.side) > 0.5 && ns > 0.5) {
        b.vx += env.magnus * 0.35 * b.spin.side * -b.vy * dt
        b.vy += env.magnus * 0.35 * b.spin.side * b.vx * dt
      }
      b.spin.side *= Math.exp(-2.5 * dt)
      b.spin.top *= Math.exp(-2.5 * dt)
      b.x += b.vx * dt
      b.y += b.vy * dt
    }
  }


  collideGoalFrames(b, tracker, events)
  detectLines(b, px, py, tracker, events)
}

/** Collides the ball with posts, crossbar and (if inside the goal) the net. */
function collideGoalFrames(b: BallState, tracker: BallTracker, events: PhysicsEvent[]): void {
  for (const end of ['west', 'east'] as const) {
    const gx = goalLineX(end)
    // Cheap reject: far from this goal line.
    if (Math.abs(b.x - gx) > 3) continue

    // Posts: vertical cylinders at (gx, POST_Y_*) from z=0 to BAR_Z.
    if (b.z < BAR_Z + BALL_RADIUS) {
      for (const postY of [POST_Y_LOW, POST_Y_HIGH]) {
        const dx = b.x - gx
        const dy = b.y - postY
        const d = Math.hypot(dx, dy)
        const minD = BALL_RADIUS + POST_RADIUS
        if (d < minD && d > 1e-6) {
          const nx = dx / d
          const ny = dy / d
          const vn = b.vx * nx + b.vy * ny
          if (vn < 0) {
            const sp = Math.hypot(b.vx, b.vy)
            // Reflect normal component with restitution, damp tangential.
            const e = 0.62
            b.vx -= (1 + e) * vn * nx
            b.vy -= (1 + e) * vn * ny
            b.vx *= 0.92
            b.vy *= 0.92
            b.spin.side *= -0.4
            events.push({ type: 'post', end, x: gx, y: postY, z: b.z, speed: sp })
          }
          b.x = gx + nx * minD
          b.y = postY + ny * minD
        }
      }
    }

    // Crossbar: horizontal cylinder along y at (gx, BAR_Z), between the posts.
    if (b.y > POST_Y_LOW && b.y < POST_Y_HIGH) {
      const dx = b.x - gx
      const dz = b.z - BAR_Z
      const d = Math.hypot(dx, dz)
      const minD = BALL_RADIUS + POST_RADIUS
      if (d < minD && d > 1e-6) {
        const nx = dx / d
        const nz = dz / d
        const vn = b.vx * nx + b.vz * nz
        if (vn < 0) {
          const sp = Math.hypot(b.vx, b.vz)
          const e = 0.6
          b.vx -= (1 + e) * vn * nx
          b.vz -= (1 + e) * vn * nz
          b.vy *= 0.94
          b.spin.top *= -0.4
          events.push({ type: 'bar', end, x: gx, y: b.y, z: BAR_Z, speed: sp })
        }
        b.x = gx + nx * minD
        b.z = BAR_Z + nz * minD
      }
    }

    // Net: once in the goal, the net absorbs the ball.
    if (tracker.inGoal === end) {
      const behind = end === 'east' ? b.x - gx : gx - b.x
      const sp = Math.hypot(b.vx, b.vy, b.vz)
      let hit = false
      if (behind > NET_DEPTH - BALL_RADIUS) {
        b.x = end === 'east' ? gx + NET_DEPTH - BALL_RADIUS : gx - NET_DEPTH + BALL_RADIUS
        hit = true
      }
      const sideLo = POST_Y_LOW + POST_RADIUS + BALL_RADIUS
      const sideHi = POST_Y_HIGH - POST_RADIUS - BALL_RADIUS
      if (b.y < sideLo) { b.y = sideLo; hit = true }
      if (b.y > sideHi) { b.y = sideHi; hit = true }
      if (b.z > GOAL_HEIGHT - BALL_RADIUS) { b.z = GOAL_HEIGHT - BALL_RADIUS; if (b.vz > 0) b.vz = 0; hit = true }
      if (hit) {
        if (sp > 2) events.push({ type: 'net', end, speed: sp })
        b.vx *= 0.15
        b.vy *= 0.15
        b.vz = Math.min(b.vz, 0) * 0.3
        b.spin.side = 0
        b.spin.top = 0
      }
    }
  }
}

/** Detects goal-line crossings, goals and balls going out of play. */
function detectLines(b: BallState, px: number, py: number, tracker: BallTracker, events: PhysicsEvent[]): void {
  if (tracker.inGoal || tracker.out) return

  for (const end of ['west', 'east'] as const) {
    const gx = goalLineX(end)
    // Whole ball over the line: centre beyond line by radius.
    const crossedNow = end === 'east' ? b.x > gx + BALL_RADIUS : b.x < gx - BALL_RADIUS
    const before = end === 'east' ? px <= gx + BALL_RADIUS : px >= gx - BALL_RADIUS
    if (!crossedNow || !before) continue
    // Interpolate the y/z at which the ball crossed.
    const denom = b.x - px
    const t = Math.abs(denom) > 1e-9 ? ((end === 'east' ? gx + BALL_RADIUS : gx - BALL_RADIUS) - px) / denom : 1
    const cy = py + (b.y - py) * t
    const cz = b.z // vertical motion per step is tiny; use current height
    const between = cy > POST_Y_LOW + POST_RADIUS && cy < POST_Y_HIGH - POST_RADIUS
    if (between && cz < GOAL_HEIGHT) {
      tracker.inGoal = end
      events.push({ type: 'goal', end, x: gx, y: cy, z: cz })
    } else {
      tracker.out = true
      events.push({ type: 'out', line: 'goal', end, x: b.x, y: b.y })
    }
    return
  }

  if (b.y < -BALL_RADIUS || b.y > PITCH_WIDTH + BALL_RADIUS) {
    tracker.out = true
    events.push({ type: 'out', line: 'touch', end: null, x: b.x, y: b.y })
  }
}

/** Options for {@link predictTrajectory}. */
export interface PredictOptions {
  /** Seconds to simulate. */
  duration: number
  /** Record a sample every n steps. */
  sampleEvery?: number
  /** Stop at the first goal/out event. */
  stopOnEnd?: boolean
}

/** A sampled trajectory point. */
export interface TrajectoryPoint {
  t: number
  x: number
  y: number
  z: number
}

/**
 * Simulates a copy of the ball forward and returns sampled points.
 * Used for aim previews, AI interception and keeper reads.
 */
export function predictTrajectory(ball: BallState, env: PhysicsEnv, opts: PredictOptions): TrajectoryPoint[] {
  const b = cloneBall(ball)
  const tr = createTracker()
  const ev: PhysicsEvent[] = []
  const steps = Math.ceil(opts.duration / PHYSICS_DT)
  const every = Math.max(1, opts.sampleEvery ?? 1)
  const out: TrajectoryPoint[] = [{ t: 0, x: b.x, y: b.y, z: b.z }]
  for (let i = 1; i <= steps; i++) {
    stepBall(b, env, tr, ev)
    if (i % every === 0) out.push({ t: i * PHYSICS_DT, x: b.x, y: b.y, z: b.z })
    if (opts.stopOnEnd && ev.some((e) => e.type === 'goal' || e.type === 'out')) {
      if (i % every !== 0) out.push({ t: i * PHYSICS_DT, x: b.x, y: b.y, z: b.z })
      break
    }
    ev.length = 0
  }
  return out
}

/**
 * Finds where/when a ball will cross the vertical plane x = planeX (e.g. the goal line).
 * Returns null if it does not reach the plane within `maxTime`.
 */
export function predictPlaneCrossing(
  ball: BallState,
  env: PhysicsEnv,
  planeX: number,
  maxTime = 3,
): { t: number; y: number; z: number } | null {
  const b = cloneBall(ball)
  const tr = createTracker()
  const ev: PhysicsEvent[] = []
  const steps = Math.ceil(maxTime / PHYSICS_DT)
  const side0 = Math.sign(b.x - planeX)
  for (let i = 1; i <= steps; i++) {
    const px = b.x
    const py = b.y
    const pz = b.z
    stepBall(b, env, tr, ev)
    ev.length = 0
    const side = Math.sign(b.x - planeX)
    if (side !== side0 && side !== 0) {
      const t = (planeX - px) / (b.x - px || 1e-9)
      return { t: (i - 1 + t) * PHYSICS_DT, y: py + (b.y - py) * t, z: pz + (b.z - pz) * t }
    }
    if (groundSpeed(b) < 0.05 && b.z === 0) return null
  }
  return null
}

/** True when a point (y, z) at the goal line is inside the goal mouth. */
export function isOnTarget(y: number, z: number, margin = 0): boolean {
  return (
    y > POST_Y_LOW + POST_RADIUS + BALL_RADIUS + margin &&
    y < POST_Y_HIGH - POST_RADIUS - BALL_RADIUS - margin &&
    z < GOAL_HEIGHT - BALL_RADIUS - margin
  )
}
