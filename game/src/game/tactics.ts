/**
 * Tactical reasoning for highlight AI: how dangerous a spot is, how safe a
 * pass is, and what a ball carrier should do with it.
 *
 * The old carrier logic used fixed thresholds (shoot inside N m, pass if the
 * lane is roughly open). Here every option is valued the same way a player
 * would: "if I do this, how likely is it to work, and how good is the
 * position it leads to?" Passes are judged by a time-to-intercept race
 * between the ball and every defender (with their reaction time), so lanes a
 * defender can step into are avoided; shots by a chance-quality (xG-like)
 * model that sees blockers and the keeper; dribbles by the space ahead and
 * the duel against the defender in the way. Pure functions over the
 * {@link AiWorld} — unit tested without a renderer.
 */
import type { Rng } from '../core/rng'
import { PITCH_LENGTH, PITCH_WIDTH } from '../sim/match/types'
import type { AiWorld } from './ai'
import { leadPosition } from './kick'
import { GOAL_CENTER_Y } from './physics'
import { a01, angleOf, angleDiff, clamp01, clampN, dist, fromAngle, norm, pointSegment, sub, topSpeed, type Agent, type Team, type Vec2 } from './model'

const HALF_GOAL = 3.66

/** +1 when the team attacks toward +x. */
const dirOf = (team: Team) => (team === 'hero' ? 1 : -1)
const goalOf = (team: Team): Vec2 => ({ x: team === 'hero' ? PITCH_LENGTH : 0, y: GOAL_CENTER_Y })

/**
 * Raw chance quality (0..0.9) of a shot from `p` toward the goal `team`
 * attacks: visible goal angle and distance only.
 */
export function spotXg(p: Vec2, team: Team): number {
  const g = goalOf(team)
  const dx = Math.abs(g.x - p.x)
  const dy = Math.abs(p.y - g.y)
  const d = Math.hypot(dx, dy)
  const a1 = Math.atan2(dy + HALF_GOAL, Math.max(0.05, dx))
  const a2 = Math.atan2(dy - HALF_GOAL, Math.max(0.05, dx))
  const angle = Math.abs(a1 - a2)
  // ≈ 0.69 at 5 m, 0.37 at 9 m, 0.15 at 16 m, 0.06 at 25 m (central).
  const z = -1.6 + angle * 2.2 - d * 0.07
  return clampN(1 / (1 + Math.exp(-z)), 0.003, 0.9)
}

/** Fraction (0..1) of the goal mouth, seen from `p`, hidden behind the given bodies. */
function goalCoverage(p: Vec2, team: Team, bodies: { pos: Vec2; half: number }[]): number {
  const g = goalOf(team)
  const base = angleOf(sub(g, p))
  const a = angleDiff(angleOf(sub({ x: g.x, y: g.y - HALF_GOAL }, p)), base)
  const b = angleDiff(angleOf(sub({ x: g.x, y: g.y + HALF_GOAL }, p)), base)
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  const span = hi - lo
  if (span < 1e-4) return 1
  const toGoal = Math.abs(g.x - p.x)
  const ivs: [number, number][] = []
  for (const bd of bodies) {
    const r = dist(bd.pos, p)
    if (r < 0.2 || Math.abs(g.x - bd.pos.x) > toGoal + 0.3) continue
    const c = angleDiff(angleOf(sub(bd.pos, p)), base)
    const h = Math.atan(bd.half / r)
    const l = Math.max(lo, c - h)
    const u = Math.min(hi, c + h)
    if (u > l) ivs.push([l, u])
  }
  ivs.sort((x, y) => x[0] - y[0])
  let covered = 0
  let curL = 0
  let curU = 0
  let open = false
  for (const [l, u] of ivs) {
    if (!open || l > curU) {
      if (open) covered += curU - curL
      open = true
      curL = l
      curU = u
    } else curU = Math.max(curU, u)
  }
  if (open) covered += curU - curL
  return clamp01(covered / span)
}

/** Half-width (m) of goal a keeper at distance r can cover (more time to dive from further away). */
const keeperHalf = (r: number, down: boolean) => (down ? 0.35 : clampN(0.75 + 0.13 * r, 0.75, 2.4))

/**
 * Chance quality of shooting now from `p`: the spot quality (which already
 * assumes a normally positioned keeper) scaled by how much of the goal is
 * actually hidden — outfield bodies in the cone and the real keeper, relative
 * to a keeper set normally on the angle — and by pressure on the shooter.
 */
export function shotQuality(p: Vec2, team: Team, w: AiWorld, pressure = 0): number {
  const g = goalOf(team)
  const outfield: { pos: Vec2; half: number }[] = []
  let gk: Agent | undefined
  for (const o of w.agents) {
    if (o.team === team) continue
    if (o.isKeeper) gk = o
    else if (o.state !== 'down') outfield.push({ pos: o.pos, half: 0.45 })
  }
  const blocked = goalCoverage(p, team, outfield)
  let keeperF = 1
  if (gk) {
    const inward = team === 'hero' ? -1 : 1
    const toGoal = dist(p, g)
    const normalPos = { x: g.x + inward * 1, y: g.y + (p.y - g.y) * (1 / Math.max(1, toGoal)) }
    const normal = goalCoverage(p, team, [{ pos: normalPos, half: keeperHalf(dist(p, normalPos), false) }])
    const actual = goalCoverage(p, team, [{ pos: gk.pos, half: keeperHalf(dist(p, gk.pos), gk.state === 'down' || gk.state === 'dive') }])
    keeperF = clampN((1 - actual + 0.08) / (1 - normal + 0.08), 0.12, 3)
  }
  const q = spotXg(p, team) * keeperF * (0.2 + 0.8 * (1 - blocked))
  return clampN(q * (1 - pressure * 0.35), 0.002, 0.95)
}

/** Reaction time (s) of an AI agent to a new ball event (pass / shot / loss). */
export function reactionTime(a: Agent, difficulty = 1): number {
  // Reading the play (build 8: interceptions follow the defender's own Anticipation): Anticipation leads, Positioning and Vision help.
  const read = a01(a.attrs.anticipation ?? a.attrs.positioning) * 0.5 + a01(a.attrs.positioning) * 0.3 + a01(a.attrs.vision) * 0.2
  const base = 0.34 - read * 0.2
  return a.team === 'opp' ? clampN(base / Math.max(0.7, difficulty), 0.1, 0.4) : clampN(base, 0.12, 0.4)
}

/**
 * Probability that a pass from `from` to `to` reaches its target without a
 * defender of the passer's opponents getting there first. Each defender races
 * the ball to the points of the lane (after his reaction time); a defender who
 * wins the race by a margin almost surely cuts it out.
 * @param lofted aerial passes can only be cut out near where they land
 */
export function passSafety(from: Vec2, to: Vec2, passer: Team, w: AiWorld, lofted = false, speed?: number): number {
  const d = dist(from, to)
  if (d < 0.5) return 1
  // Average speed of a ground pass as kick.ts launches it (arrives at 4.5 + 0.12·d + ~2.6 m/s).
  const arrive = 7.1 + d * 0.12
  // Lofted: horizontal speed of kick.ts's flight (0.8 s hang + 0.036 s/m).
  const ballSpeed = speed ?? (lofted ? d / (0.8 + d * 0.036) / 0.75 : (arrive + Math.sqrt(arrive * arrive + 2 * (w.env.rollDecel + 0.5) * d)) / 2)
  const n = Math.max(3, Math.ceil(d / 1.5))
  let safe = 1
  for (const o of w.agents) {
    if (o.team === passer || o.state === 'down') continue
    if (o.isKeeper && Math.abs(to.x - goalOf(passer).x) > 16) continue
    let worst = 0
    const sp = topSpeed({ ...o, sprint: true })
    const react = o.isHero ? 0.2 : reactionTime(o, w.difficulty)
    for (let i = 1; i <= n; i++) {
      const t = i / n
      if (lofted && t < 0.7) continue
      const p = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
      const tb = (d * t) / (lofted ? ballSpeed * 0.75 : ballSpeed)
      // Keepers come off their line and dive at a through ball: much bigger effective reach.
      const reach = o.isKeeper ? 2.2 : 0.75
      const td = (o.isKeeper ? Math.min(react, 0.15) : react) + Math.max(0, dist(o.pos, p) - reach) / sp
      const margin = tb - td
      worst = Math.max(worst, 1 / (1 + Math.exp(-margin / 0.16)))
    }
    safe *= 1 - worst * 0.88
  }
  return clamp01(safe)
}

/** Where an AI pass to `m` is aimed (shared by evaluation and execution): short lead near goal. */
export function passLead(from: Vec2, m: Agent, lofted = false): Vec2 {
  const nearGoal = Math.abs(m.pos.x - (m.team === 'hero' ? PITCH_LENGTH : 0)) < 22
  return leadPosition(from, { id: m.id, pos: m.pos, vel: m.vel }, lofted ? 17 : 14, nearGoal ? 3 : 6)
}

/** Distance to the nearest opponent (outfield) of `team` from `p`. */
export function space(p: Vec2, team: Team, w: AiWorld): number {
  let m = Infinity
  for (const o of w.agents) if (o.team !== team && !o.isKeeper && o.state !== 'down') m = Math.min(m, dist(o.pos, p))
  return m
}

/**
 * Value of having the ball at `p` for `team`: the chance it leads to, plus
 * progress toward goal and a little for space around it (time to act).
 */
export function positionValue(p: Vec2, team: Team, w: AiWorld): number {
  const dir = dirOf(team)
  const progress = clamp01(((p.x - (team === 'hero' ? 0 : PITCH_LENGTH)) * dir) / PITCH_LENGTH)
  const room = clamp01(space(p, team, w) / 8)
  const xg = shotQuality(p, team, w, clamp01((2.6 - space(p, team, w)) / 2.6))
  return xg * 0.9 + progress * 0.05 + room * 0.02
}

export type TacticalDecision =
  | { kind: 'shoot'; target: Vec2; value: number }
  | { kind: 'pass'; to: Agent; lofted: boolean; value: number; safety: number }
  | { kind: 'dribble'; dir: Vec2; value: number }
  | { kind: 'takeOn'; defender: Agent; value: number }
  | { kind: 'hold'; value: number }

export interface CarrierContext {
  /** Seconds the carrier has had the ball. */
  heldFor: number
  /** Extra weight on passing to the hero (relationship / vision), hero team only. */
  heroBias?: number
  /** Shoot more readily (gk moments: the attacker means business). */
  shotBias?: number
  /** Bad decisions: 0 = optimal, 1 = very noisy. */
  noise?: number
  /** Allow unpressured backward passes (build-up play). */
  allowBack?: boolean
}

/** Best corner to aim at from `p`: the side away from the keeper. */
export function shotTarget(p: Vec2, team: Team, w: AiWorld, rng: Rng): Vec2 {
  const g = goalOf(team)
  const gk = w.agents.find((a) => a.team !== team && a.isKeeper)
  const keeperY = gk ? gk.pos.y : g.y
  // Away from the keeper; with the keeper centred, mostly across to the far post.
  const far = p.y > g.y ? -1 : 1
  const side = Math.abs(keeperY - g.y) > 0.4 ? (keeperY > g.y ? -1 : 1) : rng.chance(0.7) ? far : -far
  return { x: g.x, y: g.y + side * rng.range(1.6, 3.1) }
}

/**
 * Evaluates the carrier's options and returns the best one.
 *  - shoot: chance quality now;
 *  - pass: target's position value × pass safety (time race against every defender);
 *  - take on: when one defender stands between the carrier and goal, the duel
 *    odds × the value of the space behind him;
 *  - dribble: value of the spot a few meters ahead in the most open direction,
 *    discounted by how quickly a defender can close it.
 */
export function evaluateCarrier(a: Agent, w: AiWorld, rng: Rng, ctx: CarrierContext): TacticalDecision {
  const team = a.team
  const dir = dirOf(team)
  const goal = goalOf(team)
  const mates = w.agents.filter((m) => m.team === team && m !== a && !m.isKeeper && m.state !== 'down')
  const pressure = clamp01((2.6 - space(a.pos, team, w)) / 2.6)
  const vision = a01(a.attrs.vision)
  const noise = ctx.noise ?? 0.15
  const jitter = () => 1 + rng.normal(0, noise * 0.25)

  // Shoot.
  const sq = shotQuality(a.pos, team, w, pressure) * (1 + (ctx.shotBias ?? 0))
  // Attackers shoot when the chance is good *now*; long-range only when nothing better.
  let best: TacticalDecision = { kind: 'shoot', target: shotTarget(a.pos, team, w, rng), value: sq * 1.05 * jitter() }

  // Pass.
  const offside = offsideLine(w, team)
  for (const m of mates) {
    const d = dist(a.pos, m.pos)
    if (d < 4 || d > 42) continue
    if (m.pos.x * dir > offside * dir + 0.2) continue
    // Recycling backwards only makes sense under pressure (or when told to keep it).
    if ((m.pos.x - a.pos.x) * dir < -3 && pressure < 0.5 && !ctx.allowBack) continue
    const lead = passLead(a.pos, m)
    const groundSafe = passSafety(a.pos, lead, team, w, false)
    // A ball in the air is harder to bring down and to time: only when the floor is shut.
    const loftSafe = d > 16 ? passSafety(a.pos, lead, team, w, true) * (0.45 + a01(a.attrs.passing) * 0.3) : 0
    const lofted = loftSafe > groundSafe + 0.15
    const safety = lofted ? loftSafe : groundSafe
    // Nobody forces a pass into a covered lane unless he is being closed down.
    if (safety < 0.5 && pressure < 0.6) continue
    // Receiving under pressure is worth less; a runner arriving into space is worth more.
    const after = positionValue(lead, team, w) * (0.75 + 0.25 * clamp01(space(lead, team, w) / 5))
    let v = safety * after - (1 - safety) * 0.05
    if (m.isHero) v += (ctx.heroBias ?? 0) * safety
    // Vision: poor passers miss the best options more often.
    v *= jitter() * (0.85 + vision * 0.15)
    if (v > best.value) best = { kind: 'pass', to: m, lofted, value: v, safety }
  }

  // Take on the defender in front.
  const ahead = w.agents
    .filter((o) => o.team !== team && !o.isKeeper && o.state === 'run')
    .filter((o) => dist(o.pos, a.pos) < 3.6 && ((o.pos.x - a.pos.x) * dir > -0.3))
    .sort((p, q) => dist(p.pos, a.pos) - dist(q.pos, a.pos))[0]
  if (ahead) {
    const beat = takeOnChance(a, ahead, w.difficulty)
    const behind = { x: ahead.pos.x + dir * 3, y: ahead.pos.y + (a.pos.y - ahead.pos.y) * 0.5 }
    // A defender charging in is out of the play once beaten: attackers go at him.
    const toA = norm(sub(a.pos, ahead.pos))
    const rush = clamp01((ahead.vel.x * toA.x + ahead.vel.y * toA.y - 1) / 4)
    const v = beat * positionValue(behind, team, w) * (0.95 + rush * 0.9) * jitter()
    if (v > best.value) best = { kind: 'takeOn', defender: ahead, value: v }
  }

  // Dribble: try a fan of directions toward goal.
  const toGoal = angleOf(sub(goal, a.pos))
  for (const off of [0, -0.45, 0.45, -0.9, 0.9]) {
    const ang = toGoal + off
    const dv = fromAngle(ang)
    const p = { x: clampN(a.pos.x + dv.x * 4.5, 1, PITCH_LENGTH - 1), y: clampN(a.pos.y + dv.y * 4.5, 1, PITCH_WIDTH - 1) }
    const gk = w.agents.find((o) => o.team !== team && o.isKeeper)
    const room = Math.min(space(p, team, w), gk ? dist(gk.pos, p) + 0.4 : Infinity)
    const keep = clamp01((room - 0.6) / 2.6) * (0.75 + a01(a.attrs.dribbling) * 0.25)
    // Carrying on is worth less than the same chance now: defenders and the keeper close in.
    const v = keep * positionValue(p, team, w) * 0.8 * jitter()
    if (v > best.value) best = { kind: 'dribble', dir: dv, value: v }
  }
  return best
}

/** Offside line x for attackers of `team` (second-last defender or the ball). */
function offsideLine(w: AiWorld, team: Team): number {
  const dir = dirOf(team)
  const xs = w.agents.filter((o) => o.team !== team).map((o) => o.pos.x * dir).sort((p, q) => q - p)
  const second = xs.length >= 2 ? xs[1] : PITCH_LENGTH / 2
  return Math.max(second!, w.ball.x * dir, (PITCH_LENGTH / 2) * dir) * dir
}

/**
 * Chance an AI carrier's take-on beats a defender. Defenders who rush in
 * (fast closing speed, square-on) are easier to beat; a defender jockeying
 * goal-side at a sensible distance is hard to get past.
 */
export function takeOnChance(carrier: Agent, defender: Agent, difficulty = 1): number {
  const c = a01(carrier.attrs.dribbling) * 0.6 + a01(carrier.attrs.agility) * 0.3 + a01(carrier.attrs.pace) * 0.1
  // A keeper is judged on his keeping (build 9: he was judged on outfield Tackling and was rounded every time).
  const d = defender.isKeeper
    ? a01(defender.attrs.gkPositioning) * 0.4 + a01(defender.attrs.handling) * 0.3 + a01(defender.attrs.agility) * 0.3
    : a01(defender.attrs.tackling) * 0.45 + a01(defender.attrs.positioning) * 0.35 + a01(defender.attrs.agility) * 0.2
  const toCarrier = norm(sub(carrier.pos, defender.pos))
  const closing = defender.vel.x * toCarrier.x + defender.vel.y * toCarrier.y
  // Rushing in at > 3 m/s commits the defender; standing off (≤ 1 m/s) is solid.
  // (A keeper coming off his line comes at pace by design: it commits him far less.)
  const rush = clamp01((closing - 1) / 4) * (defender.isKeeper ? 0.3 : 1)
  const goalSide = goalSideness(defender, carrier)
  let p = 0.36 + (c - d) * 0.8 + rush * 0.45 - goalSide * 0.25
  if (carrier.team === 'opp') p += (difficulty - 1) * 0.3
  return clampN(p, 0.08, 0.92)
}

/** 0..1: how well the defender sits between the carrier and the goal he defends. */
export function goalSideness(defender: Agent, carrier: Agent): number {
  const g = goalOf(carrier.team)
  const s = pointSegment(defender.pos, carrier.pos, g)
  if (s.t <= 0) return 0
  return clamp01(1 - s.d / 2.5) * clamp01(1 - Math.abs(dist(defender.pos, carrier.pos) - 2) / 4)
}

/**
 * Off-ball run for an attacker: sample spots within reach and pick the one
 * the carrier could find (pass safety) that is most dangerous, staying onside
 * and away from team-mates.
 */
export function runTarget(a: Agent, w: AiWorld, carrier: Agent | null, rng: Rng): Vec2 {
  const team = a.team
  const dir = dirOf(team)
  const from = carrier ? carrier.pos : { x: w.ball.x, y: w.ball.y }
  const line = offsideLine(w, team)
  const mates = w.agents.filter((m) => m.team === team && m !== a && !m.isKeeper)
  let best = a.pos
  let bestV = -Infinity
  const reach = topSpeed({ ...a, sprint: true }) * 1.6
  const base = angleOf({ x: dir, y: 0 })
  for (let i = 0; i < 12; i++) {
    const ang = base + (i / 12) * Math.PI * 2
    const r = i % 2 ? reach : reach * 0.55
    let p = { x: a.pos.x + Math.cos(ang) * r, y: a.pos.y + Math.sin(ang) * r }
    p = { x: clampN(p.x, 2, PITCH_LENGTH - 2), y: clampN(p.y, 2, PITCH_WIDTH - 2) }
    if (p.x * dir > line * dir - 0.4) p.x = line - dir * 0.6
    const crowd = mates.reduce((s, m) => s + (dist(m.pos, p) < 6 ? 1 : 0), 0)
    const safety = carrier ? passSafety(from, p, team, w, dist(from, p) > 24) : 0.5
    const v = positionValue(p, team, w) * (0.4 + safety * 0.6) - crowd * 0.02 - dist(p, a.pos) * 0.001 + rng.range(0, 0.004)
    if (v > bestV) {
      bestV = v
      best = p
    }
  }
  return best
}

/** True if `angle` points roughly at the goal `team` attacks (±60°). */
export const facesGoal = (p: Vec2, angle: number, team: Team) => Math.abs(angleDiff(angle, angleOf(sub(goalOf(team), p)))) < 1.05
