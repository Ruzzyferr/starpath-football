/**
 * Goalkeeper mechanics shared by the finishing drill (AI keeper) and the
 * goalkeeping drill (hero keeper). Mirrors the highlight runtime: dives along
 * a direction with the same timing/speed curves, the match keeper's reach
 * (keeperPhysics armReach / handsReach / catchHeight), no save roll (a hand
 * on the ball is a save), hold vs parry on keeperHoldChance and a
 * deterministic parry (parryVelocity).
 */
import type { Rng } from '../../core/rng'
import type { HighlightKind } from '../../sim/match/types'
import {
  DIVE_PEAK, DIVE_TIME, arrive, attackDir, diveSpeed, keeperReaction, keeperTarget, ownGoalX, planSave,
  type AiWorld,
} from '../ai'
import { armReach, catchHeight, handsReach, keeperHoldChance, parryVelocity } from '../keeperPhysics'
import { BALL_RADIUS, type BallState, type PhysicsEnv } from '../physics'
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

/** AI keepers' dive length (m of body travel) so a quick diver stops where his hands meet the ball. */
const diveTravel = new WeakMap<Agent, { left: number }>()

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
    let sp = diveSpeed(k) * (t < DIVE_PEAK ? 1 : Math.max(0, 1 - (t - DIVE_PEAK) / 0.22))
    const cap = diveTravel.get(k)
    if (cap) {
      sp = Math.min(sp, cap.left / dt)
      cap.left = Math.max(0, cap.left - sp * dt)
    }
    k.vel = scale(k.actionDir, sp)
    k.z = Math.max(0, Math.sin((Math.PI * t) / DIVE_TIME) * 0.55)
    if (t > DIVE_TIME) {
      diveTravel.delete(k)
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

/**
 * Training keeper's set position: the match bisector at a standard depth (a fixed Positioning 66),
 * so the opposition keeper's quality shows in his reactions, dives and hands, not in coming further
 * off his line for every strike (which made a better keeper easier to beat at drill range).
 */
export function drillKeeperSpot(k: Agent, w: AiWorld): Vec2 {
  return keeperTarget({ ...k, attrs: { ...k.attrs, gkPositioning: 66 } }, w).pos
}

export interface KeeperTouch {
  /** 0 = at the body, 1 = fingertips at full stretch. */
  stretch: number
}

/**
 * Can the keeper's hands reach the ball this step? The match keeper's reach (keeperPhysics.ts): on his feet his
 * hands cover handsReach (Reflexes) round his body, diving the body lies along the dive line with the arm
 * reaching armReach (Diving) ahead of it — the same numbers for the drill's AI keeper and a hero keeper.
 */
export function keeperReach(k: Agent, b: BallState): KeeperTouch | null {
  if (k.noTouch > 0) return null
  const bp = { x: b.x, y: b.y }
  let reachD = Math.hypot(k.pos.x - b.x, k.pos.y - b.y)
  let reachR = handsReach(k)
  let reachZ = catchHeight(k) + k.z
  let stretch = 0.15
  if (k.state === 'dive') {
    // The whole body lies along the dive line: legs trail behind, hands reach ahead.
    // (Every keeper's body blocks; a quick diver must not fly past a ball he got to.)
    const tail = 0.45
    const arm = armReach(k)
    const seg = pointSegment(bp, add(k.pos, scale(k.actionDir, -tail)), add(k.pos, scale(k.actionDir, arm)))
    reachD = seg.d
    reachR = 0.33
    reachZ = catchHeight(k) - 0.05 + k.z
    stretch = Math.max(0, (seg.t * (arm + tail) - tail) / arm)
  } else if (k.state === 'down') {
    reachR = 0.45
    reachZ = 0.7
  }
  if (reachD < reachR + BALL_RADIUS && b.z < reachZ) return { stretch }
  return null
}

export type SaveOutcome = 'held' | 'parried'

/**
 * Resolves a keeper touch like the match runtime (owner, build 9): a keeper who gets a hand to the ball SAVES it —
 * no save roll. Whether he holds it is keeperHoldChance (Handling, the pace of the ball, the stretch); otherwise
 * he parries it, and the parry is physics (keeperPhysics.parryVelocity: out and wide, a third of its pace).
 */
export function resolveSave(rng: Rng, k: Agent, b: BallState, touch: KeeperTouch): SaveOutcome {
  const speed = Math.hypot(b.vx, b.vy, b.vz)
  k.noTouch = 5
  if (rng.chance(keeperHoldChance(k, speed, touch.stretch))) {
    b.vx = 0
    b.vy = 0
    b.vz = 0
    b.z = Math.min(b.z, 1.2)
    return 'held'
  }
  const v = parryVelocity(b.y, speed, touch.stretch, attackDir(k.team))
  b.vx = v.vx
  b.vy = v.vy
  b.vz = v.vz
  b.spin.side = 0
  b.spin.top = 0
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
    // He dives as far as the ball needs: full stretch at the point, never flying past it.
    diveTravel.set(k, { left: Math.max(0.2, len(sub(plan.point, k.pos)) - armReach(k) * 0.6) })
    return true
  }
}

/** x of the goal line the keeper defends. */
export const keeperGoalX = (k: Agent): number => ownGoalX(k.team)
