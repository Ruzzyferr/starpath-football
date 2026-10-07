/**
 * Turns hero input (swipes, hold-release, taps, pad) into concrete kicks for
 * the drills, re-using the match kick model (planKick: skill-based noise,
 * curl, chip, over-hitting) so training feels exactly like a highlight.
 */
import type { Rng } from '../../core/rng'
import type { Attributes } from '../../core/types'
import { PITCH_LENGTH } from '../../sim/match/types'
import { planKick, shotTargetFromDir, type AimAssist, type KickKind, type KickPlan } from '../kick'
import { GOAL_CENTER_Y, predictTrajectory, type BallState, type PhysicsEnv } from '../physics'
import { dist, len, norm, sub, type Vec2 } from '../model'
import type { AimState, HeroAction } from '../runtime'

export interface ShotIntent {
  kind: KickKind
  target: Vec2
  targetZ?: number
  power: number
  curl: number
}

/** Interprets a hero action as a shot at the east goal (null = not a shot). */
export function shotIntent(act: HeroAction | AimState, from: Vec2): ShotIntent | null {
  const make = (target: Vec2, power: number, curl: number, chip: boolean): ShotIntent =>
    chip
      ? { kind: 'chip', target: { x: PITCH_LENGTH + 0.3, y: target.y }, targetZ: 1.5, power, curl }
      : { kind: 'shot', target, power, curl }
  switch (act.kind) {
    case 'shoot':
      return make(act.target, act.power, act.curl, act.chip)
    case 'target':
      return make(act.target, act.power, act.curl, act.chip)
    case 'swipe': {
      const sw = act.swipe
      if (sw.isTap) return null
      return make(shotTargetFromDir(from, sw.dir), sw.power, sw.curl, sw.chip)
    }
    case 'tapAt': {
      // Tap in/near the goal mouth = placed shot there; elsewhere = shot along that direction.
      if (act.at.x > PITCH_LENGTH - 4 && Math.abs(act.at.y - GOAL_CENTER_Y) < 7) return make({ x: PITCH_LENGTH + 0.2, y: act.at.y }, 0.78, 0, false)
      const d = norm(sub(act.at, from))
      return len(d) > 0 ? make(shotTargetFromDir(from, d), 0.72, 0, false) : null
    }
    case 'pass': {
      const d = act.target ? norm(sub(act.target, from)) : act.dir ? norm(act.dir) : null
      if (!d || len(d) === 0) return null
      return make(shotTargetFromDir(from, d), 0.7, 0, !!act.lofted)
    }
    case 'action':
      // Quick finish: far side, firm.
      return make({ x: PITCH_LENGTH + 0.2, y: GOAL_CENTER_Y + (from.y < GOAL_CENTER_Y ? 2.4 : -2.4) }, 0.8, 0, false)
    default:
      return null
  }
}

export interface KickContext {
  from: Vec2
  attrs: Attributes
  assist: AimAssist
  env: PhysicsEnv
  /** Accuracy multiplier (1 = match normal). */
  noise?: number
  pressure?: number
}

/** Plans the kick for an intent; noiseless when no rng is given (preview). */
export function planIntent(i: ShotIntent, ctx: KickContext, rng?: Rng): KickPlan {
  return planKick(
    {
      kind: i.kind,
      from: ctx.from,
      fromZ: 0,
      target: i.target,
      targetZ: i.targetZ,
      power: i.power,
      curl: i.curl,
      attrs: ctx.attrs,
      pressure: ctx.pressure ?? 0,
      assist: ctx.assist,
      env: ctx.env,
      noiseScale: ctx.noise ?? 1,
    },
    rng,
  )
}

/** Dotted preview path for a plan launched from `from`. */
export function previewPath(plan: KickPlan, from: Vec2, env: PhysicsEnv, duration = 1.4): { x: number; y: number; z: number }[] {
  const b: BallState = { x: from.x, y: from.y, z: 0, vx: plan.vx, vy: plan.vy, vz: plan.vz, spin: { ...plan.spin } }
  return predictTrajectory(b, env, { duration, sampleEvery: 3, stopOnEnd: true }).map((p) => ({ x: p.x, y: p.y, z: p.z }))
}

/** Straight-line distance from a spot to the goal centre. */
export const distanceToGoal = (p: Vec2): number => dist(p, { x: PITCH_LENGTH, y: GOAL_CENTER_Y })
