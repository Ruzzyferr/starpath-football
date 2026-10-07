/**
 * Highlight AI: teammates, opponents and goalkeepers.
 *
 * Every function is pure (reads a {@link AiWorld}, returns a decision/target)
 * so behaviour can be unit tested without a renderer. The runtime calls these
 * at "think" intervals (shorter for high vision/positioning players) and moves
 * agents toward the returned targets with their physical limits.
 */
import type { Rng } from '../core/rng'
import type { HighlightKind } from '../sim/match/types'
import { PITCH_LENGTH, PITCH_WIDTH } from '../sim/match/types'
import { laneOpenness } from './kick'
import { GOAL_CENTER_Y, cloneBall, createTracker, stepBall, type BallState, type PhysicsEnv } from './physics'
import {
  a01,
  add,
  angleDiff,
  angleOf,
  clamp01,
  clampN,
  dist,
  dot,
  len,
  norm,
  pointSegment,
  scale,
  sub,
  topSpeed,
  type Agent,
  type Team,
  type Vec2,
} from './model'

/** Read-only view of the highlight used by AI decisions. */
export interface AiWorld {
  agents: readonly Agent[]
  ball: BallState
  /** Agent in control of the ball, if any. */
  owner: Agent | null
  env: PhysicsEnv
  time: number
  /** 0.8 (easy) … 1.3 (legend). Scales opponent sharpness. */
  difficulty: number
  kind: HighlightKind
}

/** +1 when the team attacks toward +x. */
export const attackDir = (team: Team) => (team === 'hero' ? 1 : -1)
/** x of the goal a team attacks. */
export const attackGoalX = (team: Team) => (team === 'hero' ? PITCH_LENGTH : 0)
/** x of the goal a team defends. */
export const ownGoalX = (team: Team) => (team === 'hero' ? 0 : PITCH_LENGTH)
export const other = (team: Team): Team => (team === 'hero' ? 'opp' : 'hero')

export const teamOf = (w: AiWorld, team: Team) => w.agents.filter((a) => a.team === team)
const outfield = (w: AiWorld, team: Team) => w.agents.filter((a) => a.team === team && !a.isKeeper)

/** Clamp a point to the field. */
export const inField = (p: Vec2, m = 0.5): Vec2 => ({ x: clampN(p.x, m, PITCH_LENGTH - m), y: clampN(p.y, m, PITCH_WIDTH - m) })

// ───────────────────────── Offside & shape ─────────────────────────

/**
 * Offside line for attackers of `attacking` team: the x of the second-last
 * defender (keeper counts), or the ball if further forward. Never behind halfway.
 */
export function offsideLineX(w: AiWorld, attacking: Team): number {
  const dir = attackDir(attacking)
  const defenders = teamOf(w, other(attacking)).map((a) => a.pos.x * dir).sort((a, b) => b - a)
  const second = defenders.length >= 2 ? defenders[1] : defenders.length === 1 ? defenders[0] : PITCH_LENGTH / 2
  const line = Math.max(second, w.ball.x * dir, (PITCH_LENGTH / 2) * dir)
  return line * dir
}

/** True if `a` would be offside receiving now. */
export function isOffside(w: AiWorld, a: Agent): boolean {
  const dir = attackDir(a.team)
  return a.pos.x * dir > offsideLineX(w, a.team) * dir + 0.3
}

/** Formation anchor shifted by the ball (compactness). */
export function shiftedAnchor(a: Agent, w: AiWorld, ballX0: number): Vec2 {
  const dx = (w.ball.x - ballX0) * (a.role === 'GK' ? 0.15 : 0.7)
  const dy = (w.ball.y - GOAL_CENTER_Y) * 0.28
  return inField({ x: a.anchor.x + dx, y: a.anchor.y + dy }, 2)
}

const attackingRole = (a: Agent) => a.role === 'ST' || a.role === 'LW' || a.role === 'RW' || a.role === 'AM'

// ───────────────────────── Support play (team in possession) ─────────────────────────

/**
 * Where an off-ball attacker should go: offers a passing lane near its shifted
 * anchor, forwards make runs in behind (kept onside) when the carrier can play forward.
 */
export function supportTarget(a: Agent, w: AiWorld, ballX0: number, rng: Rng): Vec2 {
  const carrier = w.owner
  const dir = attackDir(a.team)
  const base = shiftedAnchor(a, w, ballX0)
  const opp = teamOf(w, other(a.team)).map((o) => o.pos)
  const line = offsideLineX(w, a.team)
  const from = carrier ? carrier.pos : { x: w.ball.x, y: w.ball.y }

  // Runs in behind: forwards, when carrier has space and is within ~40m of goal.
  if (carrier && carrier.team === a.team && attackingRole(a)) {
    const goalDist = Math.abs(attackGoalX(a.team) - carrier.pos.x)
    const pressure = nearestDist(carrier.pos, opp)
    if (goalDist < 50 && pressure > 3.5 && rng.chance(0.35 + a01(a.attrs.positioning) * 0.4)) {
      // Hold the run on the last defender's shoulder so the pass can be played into
      // the space behind; a poorly-positioned forward sometimes mistimes it and
      // drifts beyond the line (caught offside if the ball is played then).
      const mistime = rng.chance(clampN(0.22 - a01(a.attrs.positioning) * 0.18, 0.03, 0.2))
      const runX = mistime ? line + dir * rng.range(1.2, 4) : line - dir * 0.6
      const laneY = clampN(a.pos.y + (GOAL_CENTER_Y - a.pos.y) * 0.35, 8, PITCH_WIDTH - 8)
      return inField({ x: runX, y: laneY }, 3)
    }
  }

  // Offer a lane: sample around base, score openness/forwardness/space.
  let best = base
  let bestScore = -Infinity
  for (let i = 0; i < 9; i++) {
    const ang = (i / 9) * Math.PI * 2
    const r = i === 0 ? 0 : 5.5
    const p = inField({ x: base.x + Math.cos(ang) * r, y: base.y + Math.sin(ang) * r }, 2)
    // Stay onside.
    if (p.x * dir > line * dir - 0.5) p.x = line - dir * 0.8
    const open = laneOpenness(from, p, opp)
    const space = clamp01(nearestDist(p, opp) / 8)
    const fwd = ((p.x - from.x) * dir) / 30
    const d = dist(p, from)
    const range = d < 6 ? -0.6 : d > 35 ? -0.5 : 0
    const s = open * 1.2 + space * 0.8 + fwd * 0.5 + range - dist(p, a.pos) * 0.02
    if (s > bestScore) {
      bestScore = s
      best = p
    }
  }
  return best
}

const nearestDist = (p: Vec2, others: readonly Vec2[]) => {
  let m = Infinity
  for (const o of others) m = Math.min(m, dist(p, o))
  return m
}

// ───────────────────────── Defending (team out of possession) ─────────────────────────

/** Role of a defender this think-tick. */
export type DefendAssignment = { kind: 'press' } | { kind: 'cover'; target: Vec2 }

/**
 * Assigns pressers and coverers. The 1–2 closest players (by time to ball)
 * press; the rest mark attackers goal-side and hold the defensive line.
 */
export function defendTargets(w: AiWorld, team: Team, ballX0: number): Map<string, DefendAssignment> {
  const res = new Map<string, DefendAssignment>()
  const mine = outfield(w, team)
  const att = outfield(w, other(team))
  const goal = { x: ownGoalX(team), y: GOAL_CENTER_Y }
  const ballP = { x: w.ball.x, y: w.ball.y }
  const byTime = [...mine].sort((p, q) => dist(p.pos, ballP) / topSpeed(p) - dist(q.pos, ballP) / topSpeed(q))
  const pressers = new Set<string>()
  // When the hero is already engaging the carrier, AI team-mates don't swarm
  // him: one drops in behind as cover, the rest mark. Otherwise one presser
  // (two for the opponents when the ball is close).
  const hero = mine.find((d) => d.isHero)
  const heroEngaged = !!(hero && w.owner && w.owner.team !== team && dist(hero.pos, w.owner.pos) < 7)
  let coverId: string | null = null
  if (heroEngaged) {
    coverId = byTime.find((d) => !d.isHero)?.id ?? null
  } else {
    if (byTime[0]) pressers.add(byTime[0].id)
    const second = byTime[1]
    if (second && dist(second.pos, ballP) < 9 && (team === 'opp' || !hero)) pressers.add(second.id)
  }

  const marked = new Set<string>()
  const dirOwn = -attackDir(team)
  // Defensive line depth: hold with ball, drop when ball is near own goal.
  const lineX = dirOwn > 0 ? clampN(ballP.x + 12, 55, PITCH_LENGTH - 6) : clampN(ballP.x - 12, 6, 50)
  for (const d of mine) {
    if (pressers.has(d.id) && !d.isHero) {
      res.set(d.id, { kind: 'press' })
      continue
    }
    if (d.id === coverId && w.owner) {
      // Second line: 5–6 m goal-side of the carrier, slightly inside.
      const c = w.owner.pos
      const toGoal = norm(sub(goal, c))
      res.set(d.id, { kind: 'cover', target: inField(add(c, scale(toGoal, 5.5))) })
      continue
    }
    // Mark the most dangerous unmarked attacker near our anchor.
    let target: Agent | null = null
    let bestScore = Infinity
    const anchor = shiftedAnchor(d, w, ballX0)
    for (const a of att) {
      if (marked.has(a.id) || (w.owner && a.id === w.owner.id)) continue
      const danger = dist(a.pos, goal) * 0.6 + dist(a.pos, anchor)
      if (danger < bestScore && dist(a.pos, anchor) < 20) {
        bestScore = danger
        target = a
      }
    }
    if (target) {
      marked.add(target.id)
      // Goal-side and slightly toward the ball (cuts the lane).
      const goalSide = add(target.pos, scale(norm(sub(goal, target.pos)), 1.6))
      const laneSide = add(goalSide, scale(norm(sub(ballP, goalSide)), 1.2))
      res.set(d.id, { kind: 'cover', target: inField(laneSide) })
    } else {
      const hold = { x: (anchor.x + lineX) / 2, y: anchor.y }
      res.set(d.id, { kind: 'cover', target: inField(hold) })
    }
  }
  return res
}

/** Pursuit target for pressing a carrier: aim between carrier and own goal. */
export function pressTarget(presser: Agent, w: AiWorld): Vec2 {
  const ballP = { x: w.ball.x, y: w.ball.y }
  if (!w.owner) return interceptPoint(presser, w).point
  const goal = { x: ownGoalX(presser.team), y: GOAL_CENTER_Y }
  const lead = add(w.owner.pos, scale(w.owner.vel, 0.35))
  const toGoal = norm(sub(goal, lead))
  return add(lead, scale(toGoal, dist(presser.pos, ballP) > 3 ? 0.9 : 0.4))
}

// ───────────────────────── Loose ball / interception ─────────────────────────

/**
 * Earliest point on the ball's future path that `a` can reach in time
 * (ground balls or balls low enough to play). Falls back to the ball's resting spot.
 */
export function interceptPoint(a: Agent, w: AiWorld, horizon = 2.5): { point: Vec2; t: number; reachable: boolean } {
  const b = cloneBall(w.ball)
  const tr = createTracker()
  const dt = 1 / 30
  const sp = topSpeed({ ...a, sprint: true })
  const react = a.isHero ? 0 : 0.15
  for (let t = 0; t <= horizon; t += dt) {
    if (t > 0) {
      stepBall(b, w.env, tr, [], dt / 2)
      stepBall(b, w.env, tr, [], dt / 2)
    }
    if (b.z > (a.isKeeper ? 2.4 : 1.9)) continue
    const need = Math.max(0, dist(a.pos, b) - 0.7) / sp + react
    if (need <= t) return { point: { x: b.x, y: b.y }, t, reachable: true }
  }
  return { point: inField({ x: b.x, y: b.y }), t: horizon, reachable: false }
}

// ───────────────────────── Duels ─────────────────────────

export interface TackleOdds {
  /** Probability the tackler wins the ball cleanly. */
  win: number
  /** Probability of a foul (checked when the tackle doesn't win cleanly). */
  foul: number
}

/**
 * Tackle odds from tackling vs dribbling + agility, timing and angle.
 * @param timing 0..1 (1 = ball exposed / perfect timing)
 * @param fromBehind tackling from behind the carrier
 * @param slide sliding tackle (higher reward, higher foul risk)
 */
export function tackleOdds(tackler: Agent, carrier: Agent, timing: number, fromBehind: boolean, slide: boolean, difficulty = 1): TackleOdds {
  const t = a01(tackler.attrs.tackling) * 0.75 + a01(tackler.attrs.strength) * 0.15 + a01(tackler.attrs.positioning) * 0.1
  const c = a01(carrier.attrs.dribbling) * 0.6 + a01(carrier.attrs.agility) * 0.3 + a01(carrier.attrs.strength) * 0.1
  const diffAdj = tackler.isHero ? (1 - difficulty) * 0.25 : (difficulty - 1) * 0.3
  // Timing dominates: a tackle as the ball leaves the carrier's foot is usually clean, a lunge at his feet rarely.
  let win = 0.4 + (t - c) * 0.7 + (timing - 0.55) * 1.3 + diffAdj + (slide ? 0.06 : 0)
  if (fromBehind) win -= 0.22
  win = clampN(win, 0.05, 0.94)
  let foul = (slide ? 0.3 : 0.12) + (1 - timing) * 0.35 + (fromBehind ? 0.35 : 0) - t * 0.2
  foul = clampN(foul, 0.02, 0.92)
  return { win, foul }
}

/** Probability a skill move / take-on beats a defender. */
export function skillBeatChance(carrier: Agent, defender: Agent | null, difficulty = 1): number {
  const c = a01(carrier.attrs.dribbling) * 0.6 + a01(carrier.attrs.agility) * 0.3 + a01(carrier.attrs.pace) * 0.1
  if (!defender) return clampN(0.55 + c * 0.4, 0.3, 0.97)
  const d = a01(defender.attrs.tackling) * 0.5 + a01(defender.attrs.positioning) * 0.3 + a01(defender.attrs.agility) * 0.2
  const diffAdj = carrier.isHero ? (1 - difficulty) * 0.3 : 0
  return clampN(0.5 + (c - d) * 0.8 + diffAdj, 0.12, 0.92)
}

/** Card for a foul: red for a cynical last-man/from-behind slide, yellow for reckless ones. */
export function cardForFoul(rng: Rng, slide: boolean, fromBehind: boolean, lastMan: boolean): 'yellow' | 'red' | undefined {
  if (lastMan && (slide || fromBehind) && rng.chance(0.55)) return 'red'
  if (fromBehind && slide && rng.chance(0.35)) return 'red'
  const p = (slide ? 0.45 : 0.18) + (fromBehind ? 0.35 : 0) + (lastMan ? 0.3 : 0)
  return rng.chance(Math.min(0.95, p)) ? 'yellow' : undefined
}

// ───────────────────────── Ball carrier decisions (AI) ─────────────────────────

export type CarrierDecision =
  | { kind: 'pass'; to: Agent; lofted: boolean }
  | { kind: 'shoot'; target: Vec2 }
  | { kind: 'cross'; to: Agent | null; point: Vec2 }
  | { kind: 'dribble'; dir: Vec2 }

/**
 * AI carrier: shoots in range when the angle is open, passes to the hero
 * based on relationship & vision when the hero is in a good spot, crosses
 * from wide areas, otherwise dribbles toward goal away from pressure.
 */
export function carrierDecision(a: Agent, w: AiWorld, rng: Rng, opts: { heldFor: number }): CarrierDecision {
  const team = a.team
  const dir = attackDir(team)
  const goal = { x: attackGoalX(team), y: GOAL_CENTER_Y }
  const goalDist = dist(a.pos, goal)
  const opp = teamOf(w, other(team))
  const oppPos = opp.map((o) => o.pos)
  const mates = teamOf(w, team).filter((m) => m.id !== a.id && !m.isKeeper)
  const pressure = nearestDist(a.pos, oppPos)
  const vision = a01(a.attrs.vision)
  const angleToGoal = Math.abs(angleDiff(angleOf(sub(goal, a.pos)), dir > 0 ? 0 : Math.PI))

  // Shooting.
  const shotLane = laneOpenness(a.pos, goal, opp.filter((o) => !o.isKeeper).map((o) => o.pos))
  const shootRange = 16 + a01(a.attrs.shooting) * 10
  if (goalDist < shootRange && angleToGoal < 1.05 && (shotLane > 0.25 || goalDist < 11)) {
    const side = rng.chance(0.5) ? 1 : -1
    const tY = GOAL_CENTER_Y + side * rng.range(1.2, 3.1)
    return { kind: 'shoot', target: { x: goal.x, y: tY } }
  }

  // Wide → cross.
  const wide = a.pos.y < 14 || a.pos.y > PITCH_WIDTH - 14
  const deep = (a.pos.x - goal.x) * -dir < 22
  if (wide && deep && (pressure < 5 || opts.heldFor > 0.8)) {
    const box = mates
      .filter((m) => Math.abs(m.pos.x - goal.x) < 18 && Math.abs(m.pos.y - GOAL_CENTER_Y) < 12)
      .sort((p, q) => (q.isHero ? 1 : 0) - (p.isHero ? 1 : 0))[0]
    const point = box ? box.pos : { x: goal.x - dir * 9, y: GOAL_CENTER_Y }
    return { kind: 'cross', to: box ?? null, point }
  }

  // Passing, hero bias by relationship & vision.
  const offsideFree = mates.filter((m) => !isOffside(w, m))
  let best: Agent | null = null
  let bestScore = -Infinity
  for (const m of offsideFree) {
    const d = dist(a.pos, m.pos)
    if (d < 4 || d > 40) continue
    const open = laneOpenness(a.pos, m.pos, oppPos)
    const space = clamp01(nearestDist(m.pos, oppPos) / 7)
    const fwd = ((m.pos.x - a.pos.x) * dir) / 25
    let s = open * 1.3 + space + fwd * (0.5 + vision * 0.6)
    if (m.isHero) s += 0.25 + (a.relationToHero / 100) * 0.6 + vision * 0.2
    if (s > bestScore) {
      bestScore = s
      best = m
    }
  }
  const mustRelease = pressure < 2.2 || opts.heldFor > 2.8
  const wantsPass = best && (mustRelease || bestScore > 1.6 - vision * 0.4) && opts.heldFor > 0.35
  if (best && wantsPass) {
    // Bad relationships make passing to the hero rarer.
    if (best.isHero && a.relationToHero < -30 && rng.chance(0.5)) {
      // Ignore the hero this time.
    } else {
      const lofted = laneOpenness(a.pos, best.pos, oppPos) < 0.2 || dist(a.pos, best.pos) > 28
      return { kind: 'pass', to: best, lofted }
    }
  }

  // Dribble toward goal, steering away from the nearest opponent.
  const toGoal = norm(sub(goal, a.pos))
  let away = { x: 0, y: 0 }
  for (const o of oppPos) {
    const d = dist(a.pos, o)
    if (d < 6) away = add(away, scale(norm(sub(a.pos, o)), (6 - d) / 6))
  }
  return { kind: 'dribble', dir: norm(add(toGoal, scale(away, 0.9))) }
}

// ───────────────────────── Goalkeeper ─────────────────────────

/**
 * Keeper positioning: on the bisector of the angle formed by the ball and the
 * posts, further off the line as the ball approaches; rushes out 1v1.
 */
export function keeperTarget(gk: Agent, w: AiWorld): { pos: Vec2; rushing: boolean } {
  const gx = ownGoalX(gk.team)
  const inward = gk.team === 'hero' ? 1 : -1
  const ballP = { x: w.ball.x, y: w.ball.y }
  const postA = { x: gx, y: GOAL_CENTER_Y - 3.66 }
  const postB = { x: gx, y: GOAL_CENTER_Y + 3.66 }
  // Bisector direction from the ball toward the goal mouth.
  const ua = norm(sub(postA, ballP))
  const ub = norm(sub(postB, ballP))
  const bis = norm(add(ua, ub))
  const dBall = dist(ballP, { x: gx, y: GOAL_CENTER_Y })

  // 1v1 rush: carrier in the box/close, moving at goal, no defender between.
  const carrier = w.owner
  if (carrier && carrier.team !== gk.team && dBall < 20) {
    const defenders = w.agents.filter((a) => a.team === gk.team && !a.isKeeper)
    const covered = defenders.some((d) => pointSegment(d.pos, carrier.pos, { x: gx, y: GOAL_CENTER_Y }).d < 1.8 && (d.pos.x - gx) * inward < (carrier.pos.x - gx) * inward)
    const rushBias = a01(gk.attrs.positioning) * 0.5 + 0.5
    if (!covered && dBall < 14 + rushBias * 4) {
      const stop = add(ballP, scale(norm(sub({ x: gx, y: GOAL_CENTER_Y }, ballP)), 1.6))
      return { pos: inField(stop), rushing: true }
    }
  }
  // Depth off the line, then the point on the bisector ray (from the ball) at that depth.
  const depth = clampN(1 + (36 - dBall) * 0.09, 0.6, 4.5)
  const px = gx + inward * depth
  let py = GOAL_CENTER_Y
  if (Math.abs(bis.x) > 0.05) {
    const s = (px - ballP.x) / bis.x
    if (s > 0) py = ballP.y + bis.y * s
  }
  const p = { x: px, y: clampN(py, GOAL_CENTER_Y - 3.2, GOAL_CENTER_Y + 3.2) }
  return { pos: p, rushing: false }
}

/** Reaction delay (s) before a keeper starts moving for a shot. */
export function keeperReaction(gk: Agent, difficulty: number): number {
  const base = 0.34 - a01(gk.attrs.reflexes) * 0.22
  // Difficulty sharpens the opponents' keeper only (never the hero's own team-mate).
  return gk.isHero || gk.team === 'hero' ? clampN(base, 0.08, 0.4) : clampN(base / Math.max(0.6, difficulty), 0.08, 0.4)
}

/** Lateral speed of a keeper dive (m/s). */
export function diveSpeed(gk: Agent): number {
  return 3.6 + a01(gk.attrs.agility) * 1.6 + a01(gk.attrs.jumping) * 0.7
}

/** Arm reach from body centre when diving/standing (m). */
export const KEEPER_REACH = 0.9
/** Duration of a full-stretch dive (s). */
export const DIVE_TIME = 0.62
/** Time into a dive at which the keeper reaches full stretch (s). */
export const DIVE_PEAK = 0.36

/** Plan of a keeper's response to a shot. */
export interface SavePlan {
  /** Where the ball crosses the keeper's plane. */
  point: Vec2
  z: number
  /** Time until the ball arrives there (s). */
  t: number
  /** Whether a dive can reach it. */
  reachable: boolean
  /** Whether it is worth diving at all (ball heading on target). */
  onTarget: boolean
}

/**
 * Predicts the shot crossing at the keeper's x-plane and whether the keeper
 * can get there after reacting.
 */
export function planSave(gk: Agent, w: AiWorld, reaction: number): SavePlan | null {
  const b = cloneBall(w.ball)
  const tr = createTracker()
  const gx = ownGoalX(gk.team)
  const planeX = gk.pos.x
  const startSide = Math.sign(b.x - planeX)
  for (let i = 1; i < 180; i++) {
    const px = b.x
    const py = b.y
    const pz = b.z
    stepBall(b, w.env, tr, [])
    if (Math.sign(b.x - planeX) !== startSide) {
      const f = (planeX - px) / (b.x - px || 1e-9)
      const y = py + (b.y - py) * f
      const z = pz + (b.z - pz) * f
      const t = (i - 1 + f) / 60
      const onTarget = Math.abs(y - GOAL_CENTER_Y) < 3.66 + 0.8 + Math.abs(planeX - gx) * 0.3 && z < 2.44 + 0.4
      const lateral = Math.abs(y - gk.pos.y)
      const avail = Math.max(0, t - reaction)
      const reachLat = diveSpeed(gk) * Math.min(avail, DIVE_PEAK) + KEEPER_REACH + 0.3 + (z > 1.6 ? -0.15 : 0)
      const reachZ = z < 2.35 + a01(gk.attrs.jumping) * 0.35
      return { point: { x: planeX, y }, z, t, reachable: lateral <= reachLat && reachZ, onTarget }
    }
    if (b.z === 0 && Math.hypot(b.vx, b.vy) < 0.5) break
  }
  return null
}

/** Probability a keeper holds (catches) rather than parries a shot of given speed. */
export function catchChance(gk: Agent, ballSpeed: number, stretch: number, difficulty = 1): number {
  const h = a01(gk.attrs.handling)
  const diffAdj = gk.team === 'opp' ? (difficulty - 1) * 0.15 : 0
  return clampN(0.25 + h * 0.65 - Math.max(0, ballSpeed - 15) * 0.02 - stretch * 0.35 + diffAdj, 0.05, 0.95)
}

/** Probability a keeper gets a hand to a ball inside reach (fingertips at the edge). */
export function saveChance(gk: Agent, stretch: number, ballSpeed: number, difficulty = 1): number {
  const r = a01(gk.attrs.reflexes) * 0.6 + a01(gk.attrs.agility) * 0.25 + a01(gk.attrs.positioning) * 0.15
  const diffAdj = gk.isHero ? 0.06 : gk.team === 'opp' ? (difficulty - 1) * 0.3 : 0
  // Balls into the body/hands are nearly always stopped; fingertip stretches are a coin flip.
  const edge = Math.pow(clamp01(stretch), 1.6) * (0.75 - r * 0.35)
  return clampN(0.97 - edge - Math.max(0, ballSpeed - 24) * 0.012 + diffAdj, 0.05, 0.98)
}

/** Whether a keeper should come to claim a high ball landing near goal. */
export function shouldClaimCross(gk: Agent, landing: Vec2, tLand: number): boolean {
  const gx = ownGoalX(gk.team)
  const inBox = Math.abs(landing.x - gx) < 6.5 + a01(gk.attrs.positioning) * 3 && Math.abs(landing.y - GOAL_CENTER_Y) < 9
  const canReach = dist(gk.pos, landing) / (5.5 + a01(gk.attrs.pace) * 1.5) < tLand + 0.1
  return inBox && canReach
}

// ───────────────────────── Steering ─────────────────────────

/**
 * Arrival steering: desired velocity toward `target`, slowing within `slowR`.
 * Returns a velocity vector (m/s).
 */
export function arrive(a: Agent, target: Vec2, maxSpeed: number, slowR = 2.5): Vec2 {
  const d = sub(target, a.pos)
  const l = len(d)
  if (l < 0.05) return { x: 0, y: 0 }
  const s = l < slowR ? maxSpeed * (l / slowR) : maxSpeed
  return scale(d, s / l)
}

/** Separation push from nearby agents (avoids stacking). */
export function separation(a: Agent, agents: readonly Agent[], radius = 1.3): Vec2 {
  let p = { x: 0, y: 0 }
  for (const o of agents) {
    if (o === a) continue
    const d = dist(a.pos, o.pos)
    if (d > 1e-3 && d < radius) p = add(p, scale(norm(sub(a.pos, o.pos)), (radius - d) / radius))
  }
  return p
}

/** True if `b` is roughly behind `a` relative to a's facing (for from-behind tackles). */
export function isBehind(carrier: Agent, tackler: Agent): boolean {
  const fwd = { x: Math.cos(carrier.facing), y: Math.sin(carrier.facing) }
  return dot(norm(sub(tackler.pos, carrier.pos)), fwd) < -0.45
}
