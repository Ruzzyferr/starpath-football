/**
 * Goalkeeper mechanics shared by the finishing drill (AI keeper) and the
 * goalkeeping drill (hero keeper). Mirrors the highlight runtime: dives along
 * a direction with the same timing/speed curves, hand reach as a segment from
 * the body, and the save/catch probabilities from ai.ts.
 */
import type { Rng } from '../../core/rng'
import type { HighlightKind } from '../../sim/match/types'
import {
  DIVE_PEAK, DIVE_TIME, KEEPER_REACH, arrive, attackDir, catchChance, diveSpeed, keeperReaction, keeperTarget, ownGoalX, planSave, saveChance,
  type AiWorld,
} from '../ai'
import { BALL_RADIUS, GOAL_CENTER_Y, type BallState, type PhysicsEnv } from '../physics'
import { add, len, norm, pointSegment, scale, sub, type Agent, type Vec2 } from '../model'

/** A keeper's world view for the AI helpers. */
export function keeperWorld(k: Agent, others: readonly Agent[], ball: BallState, env: PhysicsEnv, time: number, difficulty: number, kind: HighlightKind = 'one_on_one'): AiWorld {
  return { agents: [k, ...others], ball, owner: null, env, time, difficulty, kind }
}

/** Starts a dive (mostly lateral; a forward component is allowed, backward is clamped). */
export function startDive(k: Agent, dir: Vec2): void {
  const inward = attackDir(k.team)
  let d = norm(dir)
  if (len(d) < 0.1) return
  if (d.x * inward < -0.2) d = norm({ x: -0.2 * inward, y: d.y })
  k.state = 'dive'
  k.stateT = 0
  k.actionDir = d
  k.facing = Math.atan2(d.y, d.x)
}

/**
 * Integrates a keeper one step: dive arc, recovery after landing, otherwise
 * steering toward `target` (if given) at `speed`.
 */
export function integrateKeeper(k: Agent, dt: number, target: Vec2 | null, speed: number): void {
  k.stateT += dt
  k.cd = Math.max(0, k.cd - dt)
  k.noTouch = Math.max(0, k.noTouch - dt)
  if (k.state === 'dive') {
    const t = k.stateT
    const sp = diveSpeed(k) * (t < DIVE_PEAK ? 1 : Math.max(0, 1 - (t - DIVE_PEAK) / 0.22))
    k.vel = scale(k.actionDir, sp)
    k.z = Math.max(0, Math.sin((Math.PI * t) / DIVE_TIME) * 0.55)
    if (t > DIVE_TIME) {
      k.state = 'down'
      k.stateT = 0
      k.z = 0
    }
  } else if (k.state === 'down') {
    k.vel = scale(k.vel, 0.85)
    if (k.stateT > 0.5) {
      k.state = 'run'
      k.stateT = 0
    }
  } else if (target) {
    k.vel = arrive(k, target, speed, 1.2)
  } else {
    k.vel = scale(k.vel, 0.8)
  }
  k.pos = add(k.pos, scale(k.vel, dt))
  // Keepers keep facing the play while shuffling.
  if (k.state !== 'dive' && k.state !== 'down') k.facing = k.team === 'hero' ? 0 : Math.PI
}

/** Where an idle keeper should stand for a ball at rest/in play (angle bisector). */
export function keeperSpot(k: Agent, w: AiWorld): Vec2 {
  return keeperTarget(k, w).pos
}

export interface KeeperTouch {
  /** 0 = at the body, 1 = fingertips at full stretch. */
  stretch: number
}

/** Can the keeper's hands reach the ball this step? */
export function keeperReach(k: Agent, b: BallState): KeeperTouch | null {
  if (k.noTouch > 0) return null
  const bp = { x: b.x, y: b.y }
  let reachD = Math.hypot(k.pos.x - b.x, k.pos.y - b.y)
  let reachR = 0.6
  let reachZ = 2.45 + k.z
  let stretch = 0.15
  if (k.state === 'dive') {
    // The whole body lies along the dive line: legs trail behind, hands reach ahead.
    // (Hero keepers only — a forgiving body for touch players; AI keepers use the match's hands-only reach.)
    const tail = k.isHero ? 0.45 : 0
    const seg = pointSegment(bp, add(k.pos, scale(k.actionDir, -tail)), add(k.pos, scale(k.actionDir, KEEPER_REACH)))
    reachD = seg.d
    reachR = k.isHero ? 0.34 : 0.32
    reachZ = 2.4 + k.z
    stretch = Math.max(0, (seg.t * (KEEPER_REACH + tail) - tail) / KEEPER_REACH)
  } else if (k.state === 'down') {
    reachR = 0.45
    reachZ = 0.7
  }
  if (reachD < reachR + BALL_RADIUS && b.z < reachZ) return { stretch }
  return null
}

export type SaveOutcome = 'held' | 'parried' | 'beaten'

/**
 * Resolves a keeper touch like the runtime: slow balls are always held, fast
 * ones roll save → catch. Parries knock the ball wide and away from goal.
 */
export function resolveSave(rng: Rng, k: Agent, b: BallState, touch: KeeperTouch, difficulty: number): SaveOutcome {
  const speed = Math.hypot(b.vx, b.vy, b.vz)
  let p = saveChance(k, touch.stretch, speed, difficulty)
  if (speed < 11) p = 1
  if (k.isHero) p = Math.min(1, p + 0.12)
  if (!rng.chance(p)) {
    k.noTouch = 0.6
    b.vx *= 0.9
    b.vy *= 0.9
    return 'beaten'
  }
  const held = speed < 11 || rng.chance(catchChance(k, speed, touch.stretch, difficulty))
  if (held) {
    b.vx = 0
    b.vy = 0
    b.vz = 0
    b.z = Math.min(b.z, 1.2)
    k.noTouch = 5
    return 'held'
  }
  const inward = attackDir(k.team)
  const side = b.y >= GOAL_CENTER_Y ? 1 : -1
  const d = norm({ x: inward * rng.range(0.3, 1), y: side * rng.range(0.6, 1.2) })
  const sp = Math.max(5, speed * rng.range(0.25, 0.4))
  b.vx = d.x * sp
  b.vy = d.y * sp
  b.vz = rng.range(1.5, 4.5)
  b.spin.side = 0
  b.spin.top = 0
  k.noTouch = 5
  return 'parried'
}

/**
 * AI keeper response to a shot: schedules the dive so full stretch meets the
 * ball (as in the runtime's keeperLogic). Returns a function to call every
 * step until it returns true (decision made).
 */
export function aiKeeperReact(k: Agent, w: () => AiWorld, difficulty: number, extraDelay = 0): (now: number) => boolean {
  let at = -1
  let lastNow = 0
  return (now: number) => {
    lastNow = now
    if (at < 0) at = now + keeperReaction(k, difficulty) + extraDelay
    if (now < at || k.state === 'dive') return k.state === 'dive'
    // Still on the ground (getting up after a parry): he cannot dive yet.
    if (k.state === 'down') return false
    const plan = planSave(k, w(), 0)
    if (!plan || !plan.onTarget) return true
    const lateral = Math.abs(plan.point.y - k.pos.y)
    if (lateral < 0.55 && plan.z < 1.7) {
      k.intent = { kind: 'run', to: plan.point, until: lastNow + 1 }
      return true
    }
    const lead = DIVE_PEAK + 0.04
    if (plan.t > lead + 1 / 30) {
      k.intent = { kind: 'run', to: plan.point, until: lastNow + 1 }
      at = now + Math.min(0.12, plan.t - lead)
      return false
    }
    startDive(k, sub(plan.point, k.pos))
    return true
  }
}

/** x of the goal line the keeper defends. */
export const keeperGoalX = (k: Agent): number => ownGoalX(k.team)
