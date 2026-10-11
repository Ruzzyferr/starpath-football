/**
 * Scripted input bots for every training drill, shared by the drill tests and the balance
 * harness (drillCurves.test.ts). A bot turns the drill's public state into the same
 * DrillInput the InputController produces from touches/keys (move, sprint, tapAt, pass,
 * shoot, dive, action, skill), so a bot plays through the real input path.
 * "good" = a competent human with clean technique; "meh" = sloppy input (late, inaccurate,
 * no feel for timing). Not used at runtime.
 */
import { Rng } from '../../core/rng'
import { cloneBall, predictPlaneCrossing } from '../physics'
import { dist, norm, scale, sub, type Vec2 } from '../model'
import { DIVE_PEAK, diveSpeed } from '../ai'
import type { HeroAction } from '../runtime'
import type { CrossingDrill, DistributionDrill, DribblingDrill, FinishingDrill, FitnessDrill, GoalkeepingDrill, HeadingDrill, PassingDrill, TacklingDrill } from './drills'
import { JUMP_PEAK } from './drills/heading'
import { planIntent, previewPath } from './shooting'
import type { RondoDrill } from './drills/rondo'
import type { Drill, DrillInput, DrillKind, DrillResult } from './types'
import type { DrillBase } from './base'
import { idle, readingBot, sprintBot, type Bot, type Mem } from './attrDrillBots'

export { idle, type Bot, type Mem }
export const act = (a: HeroAction, extra: Partial<DrillInput> = {}): DrillInput => ({ ...idle, ...extra, actions: [a] })

/** Plays a drill to the end at 60 fps with a bot (no assertions; callers check `finished`). */
export function playDrill(d: Drill & DrillBase, bot: Bot): DrillResult {
  const s: Mem = { t: 0, mem: {} }
  for (let i = 0; i < 60 * 90 && !d.finished; i++) {
    s.t += 1 / 60
    d.update(1 / 60, bot(d, s))
  }
  return d.result()
}

/** Waits `delay` seconds after `ready` becomes true, then fires once. */
export function after(ready: boolean, s: Mem, delay: number): boolean {
  if (!ready) {
    s.mem.readyAt = -1
    return false
  }
  if (s.mem.readyAt === undefined || s.mem.readyAt < 0) s.mem.readyAt = s.t
  if (s.t - s.mem.readyAt < delay) return false
  s.mem.readyAt = -1
  return true
}

// ───────────────────────── Bots ─────────────────────────

/** Power whose noiseless preview crosses the goal line closest to height `zWant` (a player reading the dotted preview). */
export function previewPower(f: FinishingDrill, target: Vec2, zWant: number, lo = 0.6, hi = 0.95): number {
  const spot = f.ballSpot
  let best = (lo + hi) / 2
  let bestErr = Infinity
  for (let power = lo; power <= hi + 1e-9; power += 0.05) {
    const intent = { kind: 'shot' as const, target, power, curl: 0 }
    const path = previewPath(planIntent(intent, { from: spot, attrs: f.attrs, assist: f.assist, env: f.env }), spot, f.env, 2)
    const atGoal = path.find((p) => p.x >= 104.9)
    if (!atGoal) continue
    const err = Math.abs(atGoal.z - zWant)
    if (err < bestErr) {
      bestErr = err
      best = power
    }
  }
  return best
}

export const finishingGood: Bot = (d, s) => {
  const f = d as FinishingDrill
  if (!after(f.ready, s, 0.45)) return idle
  const tg = f.litTargets()[0]!
  const target = { x: 105.2, y: tg.y }
  return act({ kind: 'shoot', target, power: previewPower(f, target, tg.z), curl: 0, chip: false })
}

export const finishingMeh: Bot = (d, s) => {
  const f = d as FinishingDrill
  if (!after(f.ready, s, 1.1)) return idle
  const y = 34 + Math.sin(s.t * 7.3) * 2.6
  return act({ kind: 'shoot', target: { x: 105.2, y }, power: 0.78, curl: 0, chip: false })
}

export const passingGood: Bot = (d, s) => {
  const p = d as PassingDrill
  if (!after(p.ready, s, 0.55)) return idle
  const at = { ...p.litMate.pos }
  return p.wanted === 'ground' ? act({ kind: 'tapAt', at }) : act({ kind: 'pass', target: at, lofted: true })
}

export const passingMeh: Bot = (d, s) => {
  const p = d as PassingDrill
  if (!after(p.ready, s, 1.4)) return idle
  return act({ kind: 'tapAt', at: { ...p.litMate.pos } })
}

export const dribbleBot = (good: boolean): Bot => (d, s) => {
  const r = d as DribblingDrill
  const h = r.hero
  const dummy = r.nextDummy()
  let target: Vec2 = r.hasBall ? r.nextWaypoint() : { x: r.ball.x, y: r.ball.y }
  // A mannequin stands in the line between two gates: line up beside it on the next gate's side.
  if (good && r.hasBall && dummy && dummy.x > h.pos.x + 0.8 && dummy.x < target.x) {
    const side = Math.sign(target.y - dummy.y) || 1
    target = { x: dummy.x, y: dummy.y + side * 0.9 }
  }
  // A good dribbler eases the stick into a gate or past a mannequin (close control), and goes full on the straights.
  const move = scale(norm(sub(target, h.pos)), good && dist(target, h.pos) < 3 ? 0.8 : 1)
  const actions: HeroAction[] = []
  if (dummy && r.hasBall) {
    const dd = dist(dummy, h.pos)
    const press = good ? dd < 2.1 && dd > 1.5 : dd < 3.9 && (s.mem.pressed ?? -9) < s.t - 1
    if (press) {
      actions.push({ kind: 'skill' })
      s.mem.pressed = s.t
    }
  }
  // Sprint on the straights, ease off into a gate or past a mannequin.
  return { move, sprint: good && h.stamina > 0.3 && dist(target, h.pos) > 4, actions, aim: null }
}

export const fitnessBot = (good: boolean): Bot => (d) => {
  const f = d as FitnessDrill
  const st = f.state
  if (st.run === 'waiting') {
    if (good && st.untilBeep <= 0.1 && st.untilBeep > 0) return act({ kind: 'action' })
    return idle
  }
  if (!good) return { ...idle, sprint: true }
  const need = st.distanceLeft / Math.max(0.05, st.untilBeep)
  return { ...idle, sprint: need > f.jogSpeed * 0.92 && st.stamina > 0.08 }
}

export const keeperBot = (good: boolean): Bot => (d, s) => {
  const g = d as GoalkeepingDrill
  if (!g.inFlight) {
    s.mem.flightAt = -1
    s.mem.dived = 0
    return idle
  }
  if (s.mem.flightAt === undefined || s.mem.flightAt < 0) s.mem.flightAt = s.t
  if (s.mem.dived) return idle
  const k = g.hero
  if (!good) {
    if (s.t - s.mem.flightAt < 0.3) return idle
    s.mem.dived = 1
    return act({ kind: 'dive', dir: { x: 0.1, y: Math.sin(s.t * 13) > 0 ? 1 : -1 } })
  }
  if (s.t - s.mem.flightAt < 0.16) return idle
  const c = predictPlaneCrossing(cloneBall(g.ball), g.env, k.pos.x, 2)
  if (!c) return idle
  if (Math.abs(c.y - k.pos.y) < 0.5 && c.z < 1.6) return idle
  if (c.t > DIVE_PEAK + 0.06) return idle
  s.mem.dived = 1
  return act({ kind: 'dive', dir: norm(sub({ x: k.pos.x, y: c.y }, k.pos)) })
}

export const crossingGood: Bot = (d) => {
  const c = d as CrossingDrill
  if (!c.ready || c.releaseIn > 0) return idle
  return act({ kind: 'pass', target: c.zoneCentre, lofted: true })
}

export const crossingMeh: Bot = (d, s) => {
  const c = d as CrossingDrill
  if (!after(c.ready, s, 0.25)) return idle
  const z = c.zoneCentre
  return act({ kind: 'tapAt', at: { x: z.x + Math.sin(s.t * 5.1) * 1.6, y: z.y + Math.cos(s.t * 3.7) * 1.6 } })
}

export const headingBot = (good: boolean): Bot => (d, s) => {
  const h = d as HeadingDrill
  const spot = h.target
  const off = sub(spot, h.hero.pos)
  const l = Math.hypot(off.x, off.y)
  const move = l > 0.12 ? { x: (off.x / l) * Math.min(1, l * 2), y: (off.y / l) * Math.min(1, l * 2) } : { x: 0, y: 0 }
  if (!h.incomingBall) {
    s.mem.jumped = 0
    return { ...idle, move }
  }
  if (s.mem.jumped || h.hero.state !== 'run') return { ...idle, move }
  const eta = h.eta()
  if (good && eta.t <= JUMP_PEAK + 0.02) {
    s.mem.jumped = 1
    return act({ kind: 'action' }, { move })
  }
  if (!good && eta.t <= 0.5) {
    s.mem.jumped = 1
    return act({ kind: 'tapAt', at: { x: 105, y: 34 + Math.sin(s.t * 9.1) * 3 } }, { move })
  }
  return { ...idle, move }
}

export const tacklingBot = (good: boolean): Bot => (d, s) => {
  const t = d as TacklingDrill
  if (!t.dueling) return idle
  const h = t.hero
  const ball = { x: t.ball.x, y: t.ball.y }
  const v = t.carrierVel
  const vl = Math.hypot(v.x, v.y)
  const cdir = vl > 0.3 ? { x: v.x / vl, y: v.y / vl } : { x: -1, y: 0 }
  const spot = good ? { x: ball.x + cdir.x * 1.0, y: ball.y + cdir.y * 1.0 } : ball
  const off = sub(spot, h.pos)
  const l = Math.hypot(off.x, off.y)
  const move = l > 0.05 ? { x: (off.x / l) * Math.min(1, l * 1.5), y: (off.y / l) * Math.min(1, l * 1.5) } : { x: 0, y: 0 }
  const db = dist(h.pos, ball)
  const actions: HeroAction[] = []
  if (h.state === 'run') {
    if (good && db <= t.reach - 0.05 && t.exposure >= 0.75) actions.push({ kind: 'action' })
    if (!good && db <= 1.45 && s.t - (s.mem.last ?? -9) > 0.6) {
      actions.push({ kind: 'action' })
      s.mem.last = s.t
    }
  }
  return { move, sprint: good && l > 3, actions, aim: null }
}

export const stepToward = (from: Vec2, to: Vec2): Vec2 => {
  const off = sub(to, from)
  const l = Math.hypot(off.x, off.y)
  return l > 0.1 ? { x: (off.x / l) * Math.min(1, l * 2), y: (off.y / l) * Math.min(1, l * 2) } : { x: 0, y: 0 }
}

/** Distribution & claiming: good = under the ring, quick release leading the runner; meh = waits, aims at his feet. */
export const distributionBot = (good: boolean): Bot => (d, s) => {
  const t = d as DistributionDrill
  const move = good && t.crossing ? stepToward(t.hero.pos, t.landing) : { x: 0, y: 0 }
  if (!t.holding) {
    s.mem.holdAt = -1
    return { ...idle, move }
  }
  if (s.mem.holdAt! < 0 || s.mem.holdAt === undefined) s.mem.holdAt = s.t
  const waited = s.t - s.mem.holdAt
  if (good && waited > 0.5) return act({ kind: 'tapAt', at: t.leadPoint(t.featuredMate) })
  if (!good && waited > 2.4) return act({ kind: 'tapAt', at: t.mateAt(t.featuredMate) })
  return idle
}

export const BOTS: Record<DrillKind, { good: Bot; meh: Bot }> = {
  finishing: { good: finishingGood, meh: finishingMeh },
  passing: { good: passingGood, meh: passingMeh },
  dribbling: { good: dribbleBot(true), meh: dribbleBot(false) },
  fitness: { good: fitnessBot(true), meh: fitnessBot(false) },
  goalkeeping: { good: keeperBot(true), meh: keeperBot(false) },
  crossing: { good: crossingGood, meh: crossingMeh },
  heading: { good: headingBot(true), meh: headingBot(false) },
  tackling: { good: tacklingBot(true), meh: tacklingBot(false) },
  distribution: { good: distributionBot(true), meh: distributionBot(false) },
  sprint: { good: sprintBot(true), meh: sprintBot(false) },
  interception: { good: readingBot(true), meh: readingBot(false) },
}

/**
 * Curl gate: good = far post, curled round the wall, power for the height, aim shifted against the
 * wind on the HUD; meh = straight at the middle of the goal, no curl, wind ignored.
 */
export const setPieceBot = (good: boolean): Bot => (d, s) => {
  const f = d as FinishingDrill
  if (!after(f.ready, s, good ? 0.8 : 1.1)) return idle
  // Sloppy: at the middle, any old power (no look at the preview), no curl, wind ignored.
  if (!good) return act({ kind: 'shoot', target: { x: 105.2, y: 34 + Math.sin(s.t * 7.3) * 1.5 }, power: 0.8, curl: 0, chip: false })
  // Away from the keeper, aimed off against the wind; the power is the one whose preview clears the wall and dips under the bar.
  const spot = f.ballSpot
  const side = f.keeper.pos.y > 34 ? -1 : 1
  const wind = f.view().hud.wind
  const target = { x: 105.2, y: 34 + side * 2.5 - (wind ? wind.dir.y * 0.25 : 0) }
  const curl = -side * 0.4
  const wallD = Math.hypot(f.wall[0]!.pos.x - spot.x, f.wall[0]!.pos.y - spot.y)
  let best = 0.8
  let bestScore = -Infinity
  for (let power = 0.5; power <= 1.0001; power += 0.05) {
    const plan = planIntent({ kind: 'freekick', target, power, curl }, { from: spot, attrs: f.attrs, assist: f.assist, env: f.env })
    const path = previewPath(plan, spot, f.env, 2.5)
    const atWall = path.find((p) => Math.hypot(p.x - spot.x, p.y - spot.y) >= wallD)
    const atGoal = path.find((p) => p.x >= 104.9)
    if (!atWall || !atGoal) continue
    const score = Math.min(atWall.z - 2.3, 2.2 - atGoal.z) + power * 0.2
    if (score > bestScore) {
      bestScore = score
      best = power
    }
  }
  return act({ kind: 'shoot', target, power: best, curl, chip: false })
}

/** Rondo 4v2: good = one/two-touch to the most open man; meh = slow, always the first option. */
export const rondoQuick: Bot = (d, s) => {
  const r = d as RondoDrill
  if (!after(r.ready, s, 0.25)) return idle
  return act({ kind: 'tapAt', at: { ...r.mates[r.mostOpen()]!.pos } })
}
export const rondoSlow: Bot = (d, s) => {
  const r = d as RondoDrill
  if (!after(r.ready, s, 1.0)) return idle
  // Doesn't look: any option, whoever is marked.
  const pick = r.options[Math.floor((Math.sin(s.t * 12.9898) * 43758.5453 % 1 + 1) % 1 * r.options.length)]!
  return act({ kind: 'tapAt', at: { ...r.mates[pick]!.pos } })
}

/** Diving station bot: waits until the dive (at this keeper's dive speed) meets the ball at full stretch. */
export const divingBot: Bot = (d, s) => {
  const g = d as GoalkeepingDrill
  if (!g.inFlight) {
    s.mem.dived = 0
    return idle
  }
  if (s.mem.dived) return idle
  const k = g.hero
  const c = predictPlaneCrossing(cloneBall(g.ball), g.env, k.pos.x, 2)
  if (!c) return idle
  const lateral = Math.abs(c.y - k.pos.y)
  if (c.t > Math.min(DIVE_PEAK, Math.max(0.05, (lateral - 0.9) / diveSpeed(k))) + 0.04) return idle
  s.mem.dived = 1
  return act({ kind: 'dive', dir: norm(sub({ x: k.pos.x, y: c.y }, k.pos)) })
}

// ───────────────────────── Human input profiles ─────────────────────────

/**
 * How a real thumb plays the drill: a perception→action lag on the stick and on every action,
 * timing jitter, aim scatter on taps/targets (m), power scatter on struck balls, and a slowly
 * wandering stick angle. "good" = a competent player who knows the drill; "sloppy" = late,
 * imprecise input.
 */
export interface HumanProfile {
  name: 'good' | 'sloppy'
  /** Seconds between seeing the state and the input landing. */
  lag: number
  /** Timing scatter of each action (s, 1σ). */
  jitter: number
  /** Aim scatter of taps and targets (m, 1σ). */
  aim: number
  /** Power scatter of struck balls (1σ). */
  power: number
  /** Stick angle wander (rad, 1σ). */
  stick: number
}
export const GOOD_HAND: HumanProfile = { name: 'good', lag: 0.1, jitter: 0.05, aim: 0.5, power: 0.05, stick: 0.12 }
export const SLOPPY_HAND: HumanProfile = { name: 'sloppy', lag: 0.22, jitter: 0.12, aim: 1.5, power: 0.14, stick: 0.32 }

interface HumanState { rng: Rng; queue: { due: number; a: HeroAction }[]; moves: { t: number; move: Vec2; sprint: boolean }[]; drift: number }
const humanStates = new WeakMap<Mem, HumanState>()

const jitterVec = (rng: Rng, p: Vec2, sd: number): Vec2 => ({ x: p.x + rng.normal(0, sd), y: p.y + rng.normal(0, sd) })
const rotate = (v: Vec2, a: number): Vec2 => ({ x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) })

function scatter(rng: Rng, a: HeroAction, p: HumanProfile): HeroAction {
  switch (a.kind) {
    case 'tapAt':
      return { ...a, at: jitterVec(rng, a.at, p.aim) }
    case 'pass':
      return { ...a, ...(a.target ? { target: jitterVec(rng, a.target, p.aim) } : {}), ...(a.dir ? { dir: rotate(a.dir, rng.normal(0, p.stick * 0.5)) } : {}) }
    case 'shoot':
      return { ...a, target: { x: a.target.x, y: a.target.y + rng.normal(0, p.aim) }, power: Math.max(0.2, a.power + rng.normal(0, p.power)) }
    case 'dive':
      return { ...a, dir: rotate(a.dir, rng.normal(0, p.stick * 0.5)) }
    default:
      return a
  }
}

/** Wraps a decision bot with a human input profile (lag, jitter, aim and stick scatter). Deterministic per play. */
export function humanize(bot: Bot, p: HumanProfile): Bot {
  return (d, s) => {
    let h = humanStates.get(s)
    if (!h) {
      h = { rng: new Rng(`hand:${p.name}:${String(d.seed)}`), queue: [], moves: [], drift: 0 }
      humanStates.set(s, h)
    }
    const want = bot(d, s)
    for (const a of want.actions) h.queue.push({ due: s.t + Math.max(0.02, p.lag + h.rng.normal(0, p.jitter)), a: scatter(h.rng, a, p) })
    h.moves.push({ t: s.t, move: want.move, sprint: want.sprint })
    while (h.moves.length > 1 && h.moves[1]!.t <= s.t - p.lag) h.moves.shift()
    const seen = h.moves[0]!
    h.drift = h.drift * 0.96 + h.rng.normal(0, p.stick * 0.28)
    const move = Math.hypot(seen.move.x, seen.move.y) > 0.05 ? rotate(seen.move, h.drift) : seen.move
    const actions = h.queue.filter((q) => q.due <= s.t).map((q) => q.a)
    h.queue = h.queue.filter((q) => q.due > s.t)
    return { move, sprint: seen.sprint, actions, aim: null }
  }
}
