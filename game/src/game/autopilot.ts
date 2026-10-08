/**
 * A simple scripted "player" for the hero. Drives a {@link HighlightRuntime}
 * through the same public input API a human uses (setControl / queueAction).
 * Used by headless smoke tests and the demo's attract/auto mode.
 */
import { GOAL_CENTER_Y, predictTrajectory } from './physics'
import { PITCH_LENGTH } from '../sim/match/types'
import { keeperTarget, planSave } from './ai'
import { dist, norm, sub, type Vec2 } from './model'
import type { HighlightRuntime } from './runtime'

/** Per-runtime autopilot memory. */
export interface AutopilotState {
  /** Game time a shot at our goal was first seen (human-like reaction delay). */
  shotSeen: number
  heldSince: number
  lastAct: number
  side: number
}

export function createAutopilot(seed = 1): AutopilotState {
  return { shotSeen: -1, heldSince: -1, lastAct: -10, side: seed % 2 === 0 ? 1 : -1 }
}

/** Feeds one frame of input. Call before `rt.update()`. */
export function autopilotStep(rt: HighlightRuntime, st: AutopilotState): void {
  if (rt.phase !== 'live') {
    rt.setControl({ move: { x: 0, y: 0 }, sprint: false })
    return
  }
  // Set-piece choices: a varied but sensible default.
  if (rt.pendingChoice === 'corner') {
    rt.queueAction({ kind: 'corner', zone: st.side > 0 ? 'far' : 'near', height: 'floated', curl: 'in' })
    return
  }
  if (rt.pendingChoice === 'wall') {
    rt.queueAction({ kind: 'wall', count: 4, nudge: 0 })
    return
  }
  const hero = rt.hero
  const ball = { x: rt.ball.x, y: rt.ball.y }
  const t = rt.time
  const canAct = t - st.lastAct > 0.4
  const act = (a: Parameters<HighlightRuntime['queueAction']>[0]) => {
    if (!canAct) return
    rt.queueAction(a)
    st.lastAct = t
  }
  const moveTo = (p: Vec2, sprint = false) => {
    const d = sub(p, hero.pos)
    const l = Math.hypot(d.x, d.y)
    rt.setControl({ move: l > 0.3 ? norm(d) : { x: 0, y: 0 }, sprint })
  }

  if (rt.heroIsKeeper) {
    const shotIncoming = !rt.owner && Math.hypot(rt.ball.vx, rt.ball.vy) > 9 && rt.ball.vx < 0
    if (!shotIncoming) st.shotSeen = -1
    else if (st.shotSeen < 0) st.shotSeen = t
    // ~0.22 s real reaction, which bullet time stretches in game time.
    const reacted = shotIncoming && t - st.shotSeen > 0.22 * rt.timeScale
    if (reacted && hero.state === 'run') {
      const plan = planSave(hero, rt.aiWorld(), 0)
      if (plan && plan.onTarget && Math.abs(plan.point.y - hero.pos.y) > 0.5) act({ kind: 'dive', dir: norm(sub(plan.point, hero.pos)) })
    }
    moveTo(keeperTarget(hero, rt.aiWorld()).pos)
    return
  }

  if (rt.heroOnBall) {
    if (st.heldSince < 0) st.heldSince = t
    const goal = { x: PITCH_LENGTH, y: GOAL_CENTER_Y }
    const dGoal = dist(hero.pos, goal)
    if (rt.setPiece || dGoal < 24 || t - st.heldSince > 1.6) {
      if (rt.kind === 'cross' && hero.pos.y > 50) {
        const dir = norm(sub({ x: PITCH_LENGTH - 9, y: GOAL_CENTER_Y }, hero.pos))
        act({ kind: 'swipe', swipe: { dir, length: 0.4, duration: 0.2, speed: 2, power: 0.7, curl: 0, chip: false, isTap: false } })
      } else {
        act({ kind: 'shoot', target: { x: PITCH_LENGTH, y: GOAL_CENTER_Y + st.side * 2.4 }, power: 0.82, curl: 0.2 * st.side, chip: false })
      }
    }
    moveTo(goal, true)
    return
  }
  st.heldSince = -1

  const owner = rt.owner
  if (owner && owner.team === 'opp') {
    moveTo({ x: owner.pos.x - 0.6, y: owner.pos.y }, true)
    if (dist(hero.pos, owner.pos) < 1.6) act({ kind: 'action' })
    return
  }
  if (!owner) {
    if (rt.ball.z > 0.8) {
      // Aerial ball: get to where it drops to head height, jump just before it arrives.
      const pts = predictTrajectory(rt.ball, rt.env, { duration: 2.5, sampleEvery: 2 })
      const drop = (pts.find((p, i) => i > 0 && p.z < 2.2 && p.z < pts[i - 1!]!.z) ?? pts[pts.length - 1])!
      moveTo({ x: drop.x, y: drop.y }, true)
      const eta = dist(hero.pos, ball) / Math.max(4, Math.hypot(rt.ball.vx, rt.ball.vy))
      if (eta < 0.3 && dist(hero.pos, { x: drop.x, y: drop.y }) < 1.5) act({ kind: 'action' })
      return
    }
    moveTo(ball, true)
    return
  }
  // Team-mate on the ball: make a run toward goal.
  moveTo({ x: Math.min(PITCH_LENGTH - 8, hero.pos.x + 6), y: GOAL_CENTER_Y }, false)
}
