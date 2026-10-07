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
import { isBehind, keeperTarget, planSave } from './ai'
import { dist, norm, sub, type Agent, type Vec2 } from './model'
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
  /** Defending: chance to wait for the carrier's heavy touch before tackling (vs. lunging at any time). */
  read: number
  /** Defending: chance to charge straight at the ball (ball-watching) instead of jockeying goal-side. */
  rush: number
  /** Defending: chance to go to ground with a slide when in range. */
  slide: number
  /** Defending: chance to read passing lanes / the pass when not engaged with the carrier. */
  anticipate: number
}

export const BOT_SKILL: Readonly<Record<BotLevel, BotSkill>> = {
  novice: { aimSd: 1.6, powerMean: 0.9, powerSd: 0.14, reaction: 0.42, wrongSide: 0.3, timingSd: 0.22, shootFrom: [16, 24], read: 0.2, rush: 0.5, slide: 0.35, anticipate: 0.15 },
  average: { aimSd: 1.1, powerMean: 0.86, powerSd: 0.1, reaction: 0.32, wrongSide: 0.18, timingSd: 0.15, shootFrom: [12, 20], read: 0.5, rush: 0.22, slide: 0.18, anticipate: 0.45 },
  good: { aimSd: 0.75, powerMean: 0.84, powerSd: 0.07, reaction: 0.25, wrongSide: 0.1, timingSd: 0.1, shootFrom: [11, 18], read: 0.72, rush: 0.1, slide: 0.08, anticipate: 0.7 },
  expert: { aimSd: 0.45, powerMean: 0.84, powerSd: 0.05, reaction: 0.2, wrongSide: 0.05, timingSd: 0.06, shootFrom: [10, 16], read: 0.88, rush: 0.04, slide: 0.04, anticipate: 0.85 },
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
  /** Defending style for this moment: charges at the ball rather than jockeying. */
  rusher: boolean
  /** Waits for the carrier's heavy touch before tackling (this engagement). */
  reader: boolean
  /** Reads lanes when not engaged (this moment). */
  anticipator: boolean
  /** Real time the bot started waiting for a tackle opening (−1 = not waiting). */
  waitSince: number
  /** Id of the opponent carrier the current engagement is against. */
  engaged: string
  /** Real time the ball last became loose (−1 = someone has it). */
  looseSince: number
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
    slider: rng.chance(skill.slide),
    jumpErr: rng.normal(0, skill.timingSd),
    pendingAt: -1,
    crosser: rng.chance(0.6),
    rusher: rng.chance(skill.rush),
    reader: rng.chance(skill.read),
    anticipator: rng.chance(skill.anticipate),
    waitSince: -1,
    engaged: '',
    looseSince: -1,
  }
}

type Act = (a: Parameters<HighlightRuntime['queueAction']>[0]) => void

/**
 * Defending like a person: a patient defender gets goal-side, jockeys at
 * ~1.8 m and tackles when the carrier pushes the ball away from his feet; a
 * rash one charges at the ball and lunges whenever he gets close (and gets
 * turned or gives away fouls). Away from the ball, a reader steps into the
 * passing lane to the most dangerous runner.
 */
function defendStep(rt: HighlightRuntime, st: HumanBotState, owner: Agent, act: Act, moveTo: (p: Vec2, sprint?: boolean) => void): void {
  const hero = rt.hero
  const d = dist(hero.pos, owner.pos)
  if (st.engaged !== owner.id) {
    // New carrier: re-roll this engagement's habits.
    st.engaged = owner.id
    st.reader = st.rng.chance(st.skill.read)
    st.rusher = st.rng.chance(st.skill.rush)
    st.waitSince = -1
    st.pendingAt = -1
  }
  const ownGoal = { x: 0, y: GOAL_CENTER_Y }
  const toGoal = norm(sub(ownGoal, owner.pos))

  // Not engaged yet and a reader: cut the lane to the most dangerous runner.
  // Close to goal there is no time to wait: engage and get in the shooting lane.
  const urgent = dist(owner.pos, ownGoal) < 24
  const interception = rt.kind === 'interception'
  const mateOnHim = interception || rt.agents.some((a) => a.team === 'hero' && !a.isHero && !a.isKeeper && a.state === 'run' && dist(a.pos, owner.pos) < Math.min(d - 1, 4))
  if (d > 7 && st.anticipator && mateOnHim && !urgent) {
    const runner = rt.agents
      .filter((a) => a.team === 'opp' && a !== owner && !a.isKeeper)
      .sort((p, q) => p.pos.x - q.pos.x)[0]
    if (runner && runner.pos.x < owner.pos.x + 4) {
      const t = 0.45
      const lane = { x: owner.pos.x + (runner.pos.x - owner.pos.x) * t, y: owner.pos.y + (runner.pos.y - owner.pos.y) * t }
      // Stay goal-side of the lane point.
      moveTo({ x: lane.x - 1, y: lane.y }, true)
      return
    }
  }

  if (st.rusher) {
    moveTo(owner.pos, true)
  } else {
    // Goal-side jockey: sprint to get there, then shadow at ~1.8 m.
    const stand = d > 4 || urgent ? 1.2 : 1.8
    const spot = { x: owner.pos.x + toGoal.x * stand, y: owner.pos.y + toGoal.y * stand }
    // Match the carrier's pace: anyone sprints when the gap opens.
    moveTo(spot, d > stand + 0.6 || Math.hypot(owner.vel.x, owner.vel.y) > 5.5)
  }

  if (st.slider && d < 4.5 && d > 2) {
    act({ kind: 'swipe', swipe: { dir: norm(sub(owner.pos, hero.pos)), length: 0.5, duration: 0.2, speed: 2.5, power: 0.8, curl: 0, chip: false, isTap: false } })
    st.slider = false
    return
  }
  if (d > (st.rusher ? 1.75 : 1.85)) {
    st.waitSince = -1
    return
  }
  if (st.pendingAt < 0) st.pendingAt = st.real + Math.max(0.05, st.skill.reaction * 0.6 + st.rng.normal(0, st.skill.timingSd))
  if (st.real < st.pendingAt) return
  if (st.reader) {
    // Wait (up to ~1.2 s) for the ball to be exposed, and never from behind.
    if (st.waitSince < 0) st.waitSince = st.real
    const moving = Math.hypot(owner.vel.x, owner.vel.y) > 1.2
    const exposed = moving && owner.touch < 0.3
    const behind = isBehind(owner, hero)
    // Contain rather than dive in; only force it when he is about to get a shot away.
    const danger = dist(owner.pos, ownGoal) < 18
    if (behind && !danger) return
    if (!exposed && (!danger || st.real - st.waitSince < 0.5)) return
  }
  // A patient defender only presses when the man is in reach; a rash one stabs anyway (and slides in).
  if (d > 1.72 && !st.rusher) return
  act({ kind: 'action' })
  st.pendingAt = -1
  st.waitSince = -1
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
    if (rt.kind === 'long_ball_control' && held > 3) {
      // Shield it, then lay it off to the most advanced free team-mate.
      // The nearest free team-mate in range (a safe lay-off), preferring forward ones.
      const free = (a: Agent) => !rt.agents.some((o) => o.team === 'opp' && !o.isKeeper && dist(o.pos, a.pos) < 2.5)
      const mate = rt.agents
        .filter((a) => a.team === 'hero' && !a.isHero && !a.isKeeper && dist(a.pos, hero.pos) > 6 && dist(a.pos, hero.pos) < 24 && free(a))
        .sort((p, q) => dist(p.pos, hero.pos) - (p.pos.x - hero.pos.x) * 0.3 - (dist(q.pos, hero.pos) - (q.pos.x - hero.pos.x) * 0.3))[0]
      if (mate) act({ kind: 'pass', target: { x: mate.pos.x + st.rng.normal(0, st.skill.aimSd), y: mate.pos.y + st.rng.normal(0, st.skill.aimSd) } })
    }
    if (rt.kind === 'counter_2v1') {
      // 2-on-1: drive at the last defender; when he commits to you, square it to the runner.
      const runner = rt.agents.filter((a) => a.team === 'hero' && !a.isHero && !a.isKeeper).sort((p, q) => q.pos.x - p.pos.x)[0]
      const def = rt.agents.filter((a) => a.team === 'opp' && !a.isKeeper && a.pos.x > hero.pos.x - 1).sort((p, q) => dist(p.pos, hero.pos) - dist(q.pos, hero.pos))[0]
      const dDef = def ? dist(def.pos, hero.pos) : 99
      // Reading the moment: when the last man blocks the way to goal, square it (good players
      // release at 5–8 m; novices too early or too late, or never look up).
      const release = 7 + st.rng.normal(0, st.skill.timingSd * 10)
      const lane = def ? Math.abs((def.pos.y - hero.pos.y) - ((goal.y - hero.pos.y) * (def.pos.x - hero.pos.x)) / Math.max(1, goal.x - hero.pos.x)) : 99
      if (runner && def && dDef < release && lane < 3 && dist(goal, runner.pos) < dist(goal, hero.pos) + 12 && st.anticipator) {
        act({ kind: 'pass', target: { x: runner.pos.x + 2 + st.rng.normal(0, st.skill.aimSd), y: runner.pos.y + st.rng.normal(0, st.skill.aimSd) } })
        moveTo(goal, true)
        return
      }
    }
    const dGoal = dist(hero.pos, goal)
    // On a break there is space to run into: no panic shot from distance.
    const patience = rt.kind === 'counter_2v1' || rt.kind === 'counter' ? 7 : 2.4
    if (dGoal < st.shootAt || (held > patience && dGoal < 30)) {
      act({ kind: 'shoot', target: aimPoint(st, 0.9), power: power(st), curl: -0.25 * st.side * st.rng.range(0, 1), chip: false })
    }
    moveTo(goal, true)
    return
  }
  st.heldSinceReal = -1

  // ── Defending ──
  const owner = rt.owner
  if (owner && owner.team === 'opp') {
    defendStep(rt, st, owner, act, moveTo)
    return
  }

  // ── Long ball to bring down: get under it, don't jump ──
  if (!owner && rt.kind === 'long_ball_control' && rt.ball.z > 0.5) {
    const pts = predictTrajectory(rt.ball, rt.env, { duration: 2.5, sampleEvery: 2 })
    const drop = pts.find((p) => p.z < 1.8 && p.t > 0.1 && p.z < (pts[pts.indexOf(p) - 1]?.z ?? 9)) ?? pts[pts.length - 1]
    // A late reader arrives off-line by up to a meter.
    moveTo({ x: drop.x + st.jumpErr * 3, y: drop.y }, dist(hero.pos, drop) > 0.8)
    return
  }

  // ── Loose / aerial ball ──
  if (owner) st.looseSince = -1
  else if (st.looseSince < 0) st.looseSince = st.real
  // Seeing that the ball is loose takes a human reaction time: keep the old run until then.
  if (!owner && st.real - st.looseSince < st.skill.reaction * 0.8) return
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
