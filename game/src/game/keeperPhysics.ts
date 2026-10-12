/**
 * Keeper physics (owner, build 9: "keeper reach and reaction come from the GK's stats; reachability computed from the
 * ball's real trajectory and time-to-arrive; long shots give the keeper more time"). Shared by the match moments and
 * the training drills. No dice: whether a keeper gets to a ball is geometry and time.
 *
 *   reaction        keeperReaction (ai.ts): 0.34 − 0.22·Reflexes s (opposition sharpened by difficulty)
 *   dive            diveSpeed (ai.ts: Diving, Agility, Jumping) for DIVE_PEAK s, then the arm: armReach
 *   shuffle         from a set stance at 6 + 4·Agility m/s² up to 2.4 + 1.6·Agility + 0.6·Pace m/s
 *   arm reach       0.4 + 0.75·Diving m at full stretch (0.70 at 40 … 1.08 at 90)
 *   hands (set)     0.3 + 0.6·Reflexes m round his body when he is on his feet (0.54 … 0.84)
 *   catch height    2.3 + 0.3·Jumping m (+ the height of a dive / jump)
 *
 * {@link keeperIntercept} walks the ball's predicted trajectory (physics.predictTrajectory: drag, bounce, spin) and
 * returns the earliest point in front of his goal he can reach in time, on his feet or diving.
 */
import { a01, dist, jumpHeight, norm, type Agent, type Vec2 } from './model'
import { statChance } from './statChance'
import { DIVE_PEAK, diveSpeed } from './ai'
import { GOAL_CENTER_Y, cloneBall, createTracker, stepBall, type BallState, type PhysicsEnv } from './physics'

/** Full-stretch arm reach of a dive (m) from Diving. */
export const armReach = (k: Pick<Agent, 'attrs'>): number => 0.4 + 0.75 * a01(k.attrs.diving ?? 62)
/** Hand reach round the body of a keeper on his feet (m) from Reflexes. */
export const handsReach = (k: Pick<Agent, 'attrs'>): number => 0.3 + 0.6 * a01(k.attrs.reflexes ?? 62)
/** Highest ball (m) he takes standing, from Jumping. */
export const catchHeight = (k: Pick<Agent, 'attrs'>): number => 2.3 + 0.3 * a01(k.attrs.jumping ?? 60)
/** How fast he gets across / back to a ball once he has read it (m/s): a keeper's shuffle, Agility first, then Pace. */
export const keeperBurst = (k: Pick<Agent, 'attrs'>): number => 2.4 + 1.6 * a01(k.attrs.agility ?? 60) + 0.6 * a01(k.attrs.pace ?? 55)
/** How hard he gets going sideways / back from a set stance (m/s²), from Agility. */
export const keeperAccel = (k: Pick<Agent, 'attrs'>): number => 6 + 4 * a01(k.attrs.agility ?? 60)
/** Ground he covers on his feet in `t` s from a standstill: accelerating (keeperAccel) up to his shuffle (keeperBurst). */
export function keeperCover(k: Pick<Agent, 'attrs'>, t: number): number {
  if (t <= 0) return 0
  const a = keeperAccel(k)
  const v = keeperBurst(k)
  const tv = v / a
  return t <= tv ? 0.5 * a * t * t : (v * v) / (2 * a) + v * (t - tv)
}
/** His area: how far out (m) from his line he goes for a ball. */
export const KEEPER_AREA = 16.5
/** Where he is safest taking a ball heading into goal: within this many metres of his line (the six-yard box). */
export const KEEPER_SAFE_DEPTH = 6

export interface KeeperPlan {
  /** Where (pitch) he meets the ball. */
  point: Vec2
  z: number
  /** Seconds from now until the ball is there. */
  t: number
  /** He has to dive to get there (on his feet otherwise). */
  dive: boolean
  /** On his feet but the ball is above his hands: he jumps for it (Jumping). */
  jump: boolean
  /** He can get there in time (false: the best attempt, at the ball's entry into the goal). */
  reachable: boolean
  /** The ball is heading inside the frame (a keeper lets a wide one go). */
  onTarget: boolean
}

/** Time (s) from take-off to the top of a jump (the runtime's 0.56 s arc). */
export const JUMP_APEX = 0.28

/**
 * Where he meets the ball: on his feet if he can (stepping, running, jumping — Pace, Reflexes, Jumping), diving only
 * when nothing on his feet is in time (Diving), and if nothing is, his best attempt where it crosses the line.
 * Walks the ball's real predicted path (drag, bounce, spin), in front of his goal, from now on.
 * @param goalX x of his goal line; `inward` +1 when the pitch is in +x from his goal, −1 otherwise
 * @param reactionLeft seconds before he can move (his reaction to the strike still running)
 */
export function keeperIntercept(k: Agent, ball: BallState, env: PhysicsEnv, goalX: number, inward: 1 | -1, reactionLeft = 0, horizon = 3.5): KeeperPlan | null {
  const b = cloneBall(ball)
  const tr = createTracker()
  const run = keeperBurst(k)
  const diveV = diveSpeed(k)
  const arm = armReach(k)
  const hands = handsReach(k)
  const zFeet = catchHeight(k)
  const zJump = zFeet + jumpHeight(k.attrs.jumping)
  const dt = 1 / 60
  // A ball heading into his goal: he takes it where he is safest — on his feet near his line if it comes to him there,
  // else on his feet wherever he can, and dives only when nothing on his feet is in time.
  let feetFar: KeeperPlan | null = null
  let diveNear: KeeperPlan | null = null
  let diveFar: KeeperPlan | null = null
  const best = () => feetFar ?? diveNear ?? diveFar
  for (let i = 1; i <= Math.round(horizon * 60); i++) {
    const px = b.x
    stepBall(b, env, tr, [])
    const t = i * dt
    const depth = (b.x - goalX) * inward
    if (depth < 0) {
      const plan = best()
      if (plan) return plan
      const f = (goalX - px) / (b.x - px || 1e-9)
      const onTarget = Math.abs(b.y - GOAL_CENTER_Y) < 3.66 + 0.25 && b.z < 2.44 + 0.2
      return { point: { x: goalX + inward * 0.3, y: b.y }, z: b.z, t: t - dt * (1 - f), dive: true, jump: false, reachable: false, onTarget }
    }
    if (depth > KEEPER_AREA) continue
    const avail = t - reactionLeft
    if (avail <= 0) continue
    const d = dist(k.pos, { x: b.x, y: b.y })
    const p = { x: b.x, y: b.y }
    if (d <= keeperCover(k, avail) + hands && (b.z <= zFeet || (b.z <= zJump && avail >= JUMP_APEX))) {
      const plan = { point: p, z: b.z, t, dive: false, jump: b.z > zFeet, reachable: true, onTarget: true }
      if (depth <= KEEPER_SAFE_DEPTH) return plan
      feetFar ??= plan
    } else if (d > hands && b.z <= zFeet + 0.2) {
      const reach = keeperCover(k, avail - DIVE_PEAK) + diveV * Math.min(avail, DIVE_PEAK) + arm
      if (d <= reach) {
        const plan = { point: p, z: b.z, t, dive: true, jump: false, reachable: true, onTarget: true }
        if (depth <= KEEPER_SAFE_DEPTH) diveNear ??= plan
        else diveFar ??= plan
      }
    }
    if (b.z === 0 && Math.hypot(b.vx, b.vy) < 0.3) {
      // Comes to rest in his area: he walks to it.
      return { point: p, z: 0, t: t + Math.max(0, d - hands) / run, dive: false, jump: false, reachable: true, onTarget: true }
    }
  }
  return best()
}

/** Whether the ball's real path (no one touching it) ends inside his goal frame. */
export function pathEntersGoal(ball: BallState, env: PhysicsEnv, goalX: number, inward: 1 | -1, horizon = 4): boolean {
  const b = cloneBall(ball)
  const tr = createTracker()
  for (let i = 1; i <= Math.round(horizon * 60); i++) {
    stepBall(b, env, tr, [])
    if ((b.x - goalX) * inward < 0) return Math.abs(b.y - GOAL_CENTER_Y) < 3.66 + 0.1 && b.z < 2.44 + 0.1
    if (b.z === 0 && Math.hypot(b.vx, b.vy) < 0.2) return false
  }
  return false
}

// ───────────────────────── After he gets there (shared by the moments and the drills) ─────────────────────────

/**
 * He got to it: is it held (else parried)? Handling, +1 % a point (statChance): a soft ball (< 11 m/s) is simply
 * gathered; harder ones cost 1.5 points per m/s over 14, a full-stretch save up to 20.
 */
export function keeperHoldChance(k: Pick<Agent, 'attrs'>, speed: number, stretch: number): number {
  if (speed < 11) return 1
  return statChance(k.attrs.handling ?? 50, undefined, -Math.max(0, speed - 14) * 1.5 - Math.min(1, Math.max(0, stretch)) * 20)
}

/** A high ball he comes for: caught (else punched) — Handling, minus traffic round him, a ball above him and pace. */
export function claimHoldChance(k: Pick<Agent, 'attrs'>, z: number, crowd: number, speed: number): number {
  return statChance(k.attrs.handling ?? 50, undefined, -crowd * 30 - Math.max(0, z - 2.1) * 40 - Math.max(0, speed - 16) * 2)
}

/**
 * A parry (physics, no dice): pushed out and wide, away from the goal on the side the ball was going, a third of its
 * pace, higher the more he stretched. `inward` points from his goal into the pitch along x.
 */
export function parryVelocity(ballY: number, speed: number, stretch: number, inward: number): { vx: number; vy: number; vz: number } {
  const side = ballY >= GOAL_CENTER_Y ? 1 : -1
  const d = norm({ x: inward * 0.65, y: side * 0.9 })
  const sp = Math.max(5, speed * 0.32)
  return { vx: d.x * sp, vy: d.y * sp, vz: 1.5 + Math.min(1, Math.max(0, stretch)) * 2 }
}
