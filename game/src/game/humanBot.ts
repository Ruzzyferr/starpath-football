/**
 * A noisy, human-like scripted player for balance measurement ("feel" tests).
 *
 * Unlike {@link autopilotStep} (a near-perfect, deterministic bot), this one
 * models an actual thumb on a phone: aim scatter on the goal line, uneven
 * swipe power, late reactions, the occasional wrong-way dive and mistimed
 * tackles/jumps. It drives the runtime only through the public input API
 * (setControl / queueAction) exactly like the UI does.
 *
 * Levels are calibrated against intuition for touch play with aim assist:
 *  - novice: first sessions, big scatter, slow reactions
 *  - average: the "typical player" the match-feel targets are set for
 *  - good: experienced, consistent
 *  - expert: near-optimal human
 */
import { Rng } from '../core/rng'
import { PITCH_LENGTH } from '../sim/match/types'
import { keeperTarget, planSave } from './ai'
import { dist, norm, sub, type Vec2 } from './model'
import { GOAL_CENTER_Y, POST_Y_HIGH, POST_Y_LOW, predictTrajectory } from './physics'
import type { HighlightRuntime } from './runtime'

export type BotLevel = 'novice' | 'average' | 'good' | 'expert'
export const BOT_LEVELS: readonly BotLevel[] = ['novice', 'average', 'good', 'expert']

export interface BotSkill {
  /** 1σ aim scatter of the chosen goal-line point (m). */
  aimSd: number
  /** Mean / 1σ of swipe power (0..1.15). */
  powerMean: number
  powerSd: number
  /** Reaction time to a shot / tackle chance (real seconds). */
  reaction: number
  /** Chance a keeper dive goes the wrong way. */
  wrongSide: number
  /** 1σ timing error of jumps / tackles (real seconds). */
  timingSd: number
  /** Distance band (m) at which the bot pulls the trigger in open play. */
  shootFrom: readonly [number, number]
}

export const BOT_SKILL: Readonly<Record<BotLevel, BotSkill>> = {
  novice: { aimSd: 1.6, powerMean: 0.9, powerSd: 0.14, reaction: 0.42, wrongSide: 0.3, timingSd: 0.22, shootFrom: [16, 24] },
  average: { aimSd: 1.1, powerMean: 0.86, powerSd: 0.1, reaction: 0.32, wrongSide: 0.18, timingSd: 0.15, shootFrom: [12, 20] },
  good: { aimSd: 0.75, powerMean: 0.84, powerSd: 0.07, reaction: 0.25, wrongSide: 0.1, timingSd: 0.1, shootFrom: [11, 18] },
  expert: { aimSd: 0.45, powerMean: 0.84, powerSd: 0.05, reaction: 0.2, wrongSide: 0.05, timingSd: 0.06, shootFrom: [10, 16] },
}

export interface HumanBotState {
  rng: Rng
  skill: BotSkill
  /** Real time (accumulated by the caller via `step`). */
  real: number
  lastAct: number
  shotSeenReal: number
  dove: boolean
  /** Open-play shooting distance chosen for this moment. */
  shootAt: number
  /** Real time the hero first had the ball (−1 = not on ball). */
  heldSinceReal: number
  /** Intended side of goal (+1 / −1). */
  side: number
  /** Planned tackle distance for this moment. */
  tackleAt: number
  /** Will try a slide rather than wait for a standing tackle. */
  slider: boolean
  /** Real-time offset of the jump/press (timing error). */
  jumpErr: number
  /** Real time at which a pending action fires. */
  pendingAt: number
  /** Wide player crosses (else cuts inside and shoots). */
  crosser: boolean
}

export function createHumanBot(level: BotLevel, seed: number): HumanBotState {
  const rng = new Rng(`bot:${level}:${seed}`)
  const skill = BOT_SKILL[level]
  return {
    rng,
    skill,
    real: 0,
    lastAct: -10,
    shotSeenReal: -1,
    dove: false,
    shootAt: rng.range(skill.shootFrom[0], skill.shootFrom[1]),
    heldSinceReal: -1,
    side: rng.chance(0.5) ? 1 : -1,
    tackleAt: Math.max(0.9, rng.normal(1.45, skill.timingSd * 3)),
    slider: rng.chance(0.2),
    jumpErr: rng.normal(0, skill.timingSd),
    pendingAt: -1,
    crosser: rng.chance(0.6),
  }
}

/** Goal-line target the bot "swipes" at: a corner choice plus human scatter. */
function aimPoint(st: HumanBotState, inside: number): Vec2 {
  const post = st.side > 0 ? POST_Y_HIGH : POST_Y_LOW
  const y = post - st.side * inside + st.rng.normal(0, st.skill.aimSd)
  return { x: PITCH_LENGTH, y }
}

const power = (st: HumanBotState, bias = 0): number =>
  Math.max(0.45, Math.min(1.12, st.rng.normal(st.skill.powerMean + bias, st.skill.powerSd)))

/**
 * Feeds one frame of input; call before `rt.update(realDt)`.
 * @param realDt the same wall-clock step passed to `rt.update`
 */
export function humanBotStep(rt: HighlightRuntime, st: HumanBotState, realDt: number): void {
  st.real += realDt
  if (rt.phase !== 'live') {
    rt.setControl({ move: { x: 0, y: 0 }, sprint: false })
    return
  }
  const hero = rt.hero
  const canAct = st.real - st.lastAct > 0.35
  const act = (a: Parameters<HighlightRuntime['queueAction']>[0]): void => {
    if (!canAct) return
    rt.queueAction(a)
    st.lastAct = st.real
  }
  const moveTo = (p: Vec2, sprint = false): void => {
    const d = sub(p, hero.pos)
    const l = Math.hypot(d.x, d.y)
    rt.setControl({ move: l > 0.3 ? norm(d) : { x: 0, y: 0 }, sprint })
  }

  // ── Keeper ──
  if (rt.heroIsKeeper) {
    const shotIncoming = !rt.owner && Math.hypot(rt.ball.vx, rt.ball.vy) > 9 && rt.ball.vx < 0
    if (!shotIncoming) st.shotSeenReal = -1
    else if (st.shotSeenReal < 0) st.shotSeenReal = st.real
    if (shotIncoming && !st.dove && st.real - st.shotSeenReal > st.skill.reaction && hero.state === 'run') {
      const plan = planSave(hero, rt.aiWorld(), 0)
      if (plan && plan.onTarget) {
        let dy = plan.point.y - hero.pos.y + st.rng.normal(0, st.skill.aimSd * 0.5)
        if (st.rng.chance(st.skill.wrongSide)) dy = -dy
        if (Math.abs(dy) > 0.5) act({ kind: 'dive', dir: norm({ x: 0.15, y: dy }) })
        st.dove = true
      }
    }
    moveTo(keeperTarget(hero, rt.aiWorld()).pos)
    return
  }

  // ── On the ball / set-piece taker ──
  if (rt.heroOnBall) {
    if (st.heldSinceReal < 0) st.heldSinceReal = st.real
    const held = st.real - st.heldSinceReal
    const sp = rt.setPiece
    const goal = { x: PITCH_LENGTH, y: GOAL_CENTER_Y }
    if (sp && sp.kind === 'penalty') {
      if (held > 0.8) act({ kind: 'shoot', target: aimPoint(st, 0.9), power: power(st, 0.04), curl: 0, chip: false })
      return
    }
    if (sp && sp.kind === 'freekick') {
      // Bend it toward the far side of the wall's shadow.
      if (held > 1.0) act({ kind: 'shoot', target: aimPoint(st, 0.8), power: power(st, -0.02), curl: -st.side * (0.45 + st.rng.range(0, 0.4)), chip: false })
      return
    }
    if (sp) {
      // Other set pieces (corner taken by the hero): whip it to the near post area.
      const dir = norm(sub({ x: PITCH_LENGTH - 8 + st.rng.normal(0, 2), y: GOAL_CENTER_Y + st.rng.normal(0, 3) }, hero.pos))
      if (held > 0.8) act({ kind: 'swipe', swipe: { dir, length: 0.4, duration: 0.2, speed: 2, power: power(st, -0.15), curl: 0.3, chip: false, isTap: false } })
      return
    }
    if (rt.kind === 'cross' && st.crosser && (hero.pos.y > 52 || hero.pos.y < 16)) {
      // Wide: cross toward the best-placed runner in the box (with scatter).
      if (held > 0.5) {
        const box = rt.agents
          .filter((a) => a.team === 'hero' && !a.isHero && !a.isKeeper && a.pos.x > PITCH_LENGTH - 18 && Math.abs(a.pos.y - GOAL_CENTER_Y) < 12)
          .sort((p, q) => Math.abs(p.pos.y - GOAL_CENTER_Y) - Math.abs(q.pos.y - GOAL_CENTER_Y))[0]
        const aim = box ? box.pos : { x: PITCH_LENGTH - 9, y: GOAL_CENTER_Y }
        const tgt = { x: aim.x + st.rng.normal(0, st.skill.aimSd * 1.6), y: aim.y + st.rng.normal(0, st.skill.aimSd * 2.2) }
        const dir = norm(sub(tgt, hero.pos))
        act({ kind: 'swipe', swipe: { dir, length: 0.4, duration: 0.2, speed: 2, power: power(st, -0.15), curl: 0, chip: false, isTap: false } })
      }
      moveTo({ x: PITCH_LENGTH - 6, y: hero.pos.y }, true)
      return
    }
    const dGoal = dist(hero.pos, goal)
    if (dGoal < st.shootAt || held > 2.4) {
      act({ kind: 'shoot', target: aimPoint(st, 0.9), power: power(st), curl: -0.25 * st.side * st.rng.range(0, 1), chip: false })
    }
    moveTo(goal, true)
    return
  }
  st.heldSinceReal = -1

  // ── Defending ──
  const owner = rt.owner
  if (owner && owner.team === 'opp') {
    // Goal-side approach.
    moveTo({ x: owner.pos.x - 0.9, y: owner.pos.y + (GOAL_CENTER_Y - owner.pos.y) * 0.08 }, true)
    const d = dist(hero.pos, owner.pos)
    if (st.slider && d < 4.5 && d > 2) {
      act({ kind: 'swipe', swipe: { dir: norm(sub(owner.pos, hero.pos)), length: 0.5, duration: 0.2, speed: 2.5, power: 0.8, curl: 0, chip: false, isTap: false } })
      st.slider = false
    } else if (d < st.tackleAt) {
      if (st.pendingAt < 0) st.pendingAt = st.real + Math.max(0.05, st.skill.reaction * 0.6 + st.rng.normal(0, st.skill.timingSd))
      if (st.real >= st.pendingAt) {
        act({ kind: 'action' })
        st.pendingAt = -1
        st.tackleAt = Math.max(0.9, st.rng.normal(1.45, st.skill.timingSd * 3))
      }
    }
    return
  }

  // ── Loose / aerial ball ──
  if (!owner) {
    if (rt.ball.z > 0.8) {
      const pts = predictTrajectory(rt.ball, rt.env, { duration: 2.5, sampleEvery: 2 })
      const drop = pts.find((p, i) => i > 0 && p.z < 2.2 && p.z < pts[i - 1].z) ?? pts[pts.length - 1]
      moveTo({ x: drop.x, y: drop.y }, true)
      const eta = dist(hero.pos, { x: rt.ball.x, y: rt.ball.y }) / Math.max(4, Math.hypot(rt.ball.vx, rt.ball.vy))
      // Press when the ball is about to arrive, with human timing error (game time ≈ eta·timeScale real).
      if (eta < 0.3 + st.jumpErr && dist(hero.pos, { x: drop.x, y: drop.y }) < 1.8) {
        act({ kind: 'action' })
        st.jumpErr = st.rng.normal(0, st.skill.timingSd)
      }
      return
    }
    moveTo({ x: rt.ball.x, y: rt.ball.y }, true)
    return
  }
  // Team-mate on the ball: attack the box.
  moveTo({ x: Math.min(PITCH_LENGTH - 8, hero.pos.x + 6), y: GOAL_CENTER_Y + st.side * 2 }, false)
}
