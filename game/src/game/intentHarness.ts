/**
 * Intent harness ("sensible human"): plays real generated moments through the
 * headless runtime the way a person on a phone does — with the REAL input
 * paths (synthesised screen-space swipes run through {@link analyzeSwipe} and
 * the view mapping, context buttons with the joystick direction attached) —
 * and checks that a sensible input is respected and that success follows the
 * moment's own attributes.
 *
 * Two input skills: `good` (a sensible player: aims at a corner, steers the
 * stick at the man, tackles in reach) and `sloppy` (same intent, much noisier
 * thumb and timing). The human noise is the same for every hero; only the
 * hero's attributes change between levels. Unlike humanBot (which calls
 * `shoot` with a goal-line target and so skips the swipe → target mapping),
 * every shot here is a gesture and every pass a button press.
 */
import { Rng } from '../core/rng'
import type { AttributeKey, Difficulty } from '../core/types'
import { PITCH_LENGTH } from '../sim/match/types'
import type { HighlightKind } from '../sim/match/types'
import { generatedHighlight } from './demoHighlights'
import { analyzeSwipe, laneOpenness, leadPosition, type GesturePoint } from './kick'
import { dist, norm, sub, type Agent, type Vec2 } from './model'
import { MOMENT_ATTRS } from './momentSkill'
import { GOAL_CENTER_Y, POST_Y_HIGH, POST_Y_LOW } from './physics'
import { HighlightRuntime } from './runtime'
import { pitchDirToScreen, project, unproject } from './view'

/** Hero profiles by OVR (the two teams around him stay at {@link TEAM_OVR}). */
export const PROFILES = { weak: 45, start: 57, average: 66, strong: 78 } as const
export type Profile = keyof typeof PROFILES
export const PROFILE_KEYS = Object.keys(PROFILES) as Profile[]
/** Team-mates and opponents (a starting hero's league). */
export const TEAM_OVR = 62
/** Attribute levels of the curve tables (the moment's own attributes set to this, the rest of the sheet a starting hero's). */
export const LEVELS = [40, 50, 60, 70, 80, 90] as const
/** Base sheet OVR for curve levels. */
const CURVE_BASE_OVR = 57

export type IntentKind = 'shot' | 'shotBtn' | 'pass' | 'shortPass' | 'passRun' | 'through' | 'cross' | 'tackle'
export const INTENT_KINDS: readonly IntentKind[] = ['shot', 'shotBtn', 'pass', 'shortPass', 'passRun', 'through', 'cross', 'tackle']
/** Kinds with an input-skill dimension (curve tables, monotonicity tests). */
export const CURVE_KINDS: readonly IntentKind[] = ['shot', 'pass', 'through', 'cross', 'tackle']
/** `atKeeper` (shots only): a bad input, struck straight at the keeper. */
export type InputSkill = 'good' | 'sloppy' | 'atKeeper'

const MOMENT: Record<IntentKind, HighlightKind> = {
  shot: 'one_on_one', shotBtn: 'one_on_one', pass: 'build_up', shortPass: 'build_up', passRun: 'build_up', through: 'counter', cross: 'cross', tackle: 'defend',
}

/** The attributes each intent kind is about (game/momentSkill). */
export const KIND_ATTRS: Record<IntentKind, readonly AttributeKey[]> = {
  shot: MOMENT_ATTRS.shot, shotBtn: MOMENT_ATTRS.shot, pass: MOMENT_ATTRS.pass, shortPass: MOMENT_ATTRS.pass, passRun: MOMENT_ATTRS.pass,
  through: MOMENT_ATTRS.through, cross: MOMENT_ATTRS.cross, tackle: MOMENT_ATTRS.tackle,
}

/** Cross input path under test (the CROSS button by default; the swipe for the gesture variant). */
export let CROSS_BY_SWIPE = false
export function setCrossBySwipe(v: boolean): void {
  CROSS_BY_SWIPE = v
}

/** Phone viewport short side (CSS px) = one gesture unit. */
const UNIT = 390
/** World px → CSS px on the phone (any value: the mapping is affine, only lengths in units matter). */
const ZOOM = 0.9

interface HumanNoise {
  /** 1σ swipe direction error on screen (deg). */
  swipeAngleSd: number
  /** Swipe chord length (gesture units) mean / σ. */
  swipeLen: readonly [number, number]
  /** Swipe duration (s) mean / σ. */
  swipeDur: readonly [number, number]
  /** Path curvature (max deviation / chord) σ: a thumb arcs a little. */
  arcSd: number
  /** Joystick direction error (deg) when steering a pass toward a team-mate. */
  stickSd: number
  /** Button reaction (s) mean / σ. */
  react: readonly [number, number]
}

/** Human noise per input skill (the same for every hero). */
export const HUMAN: Record<InputSkill, HumanNoise> = {
  good: { swipeAngleSd: 4, swipeLen: [0.36, 0.08], swipeDur: [0.15, 0.035], arcSd: 0.05, stickSd: 15, react: [0.22, 0.08] },
  sloppy: { swipeAngleSd: 9, swipeLen: [0.36, 0.16], swipeDur: [0.15, 0.06], arcSd: 0.12, stickSd: 45, react: [0.45, 0.2] },
  atKeeper: { swipeAngleSd: 4, swipeLen: [0.36, 0.08], swipeDur: [0.15, 0.035], arcSd: 0.05, stickSd: 15, react: [0.22, 0.08] },
}

export interface TrialLog {
  outcome: string
  success: boolean
  /** Shots: intended goal-line y, actual crossing y / height (undefined when saved/blocked before the line). */
  aimY?: number
  hitY?: number
  hitZ?: number
  offTarget?: boolean
  /** Passes: why it failed (`intercepted` = an opponent's first touch, `heavy` = the receiver's heavy touch, `out`, `timeout`). */
  why?: string
  /** Passes: the team-mate the human meant (id) and the one the ball was played to. */
  meant?: string
  playedTo?: string
}

const rnd = (rng: Rng, m: number, sd: number) => rng.normal(m, sd)

/** Builds the screen path of a swipe whose intended pitch direction is `dir`, with human noise. */
export function humanSwipePoints(rng: Rng, from: Vec2, dir: Vec2, h: HumanNoise = HUMAN.good): GesturePoint[] {
  const s = pitchDirToScreen(dir.x, dir.y)
  const a = Math.atan2(s.y, s.x) + (rnd(rng, 0, h.swipeAngleSd) * Math.PI) / 180
  const L = Math.max(0.12, rnd(rng, h.swipeLen[0], h.swipeLen[1])) * UNIT
  const T = Math.max(0.07, rnd(rng, h.swipeDur[0], h.swipeDur[1]))
  const arc = rnd(rng, 0, h.arcSd) * L
  // Start a little below the ball (where the thumb rests), not on it.
  const b = project(from.x, from.y)
  const sx0 = b.x * ZOOM + rnd(rng, 0, 12)
  const sy0 = b.y * ZOOM + 25 + rnd(rng, 0, 10)
  const ux = Math.cos(a)
  const uy = Math.sin(a)
  const pts: GesturePoint[] = []
  const n = Math.max(3, Math.round(T * 60))
  for (let i = 0; i <= n; i++) {
    const f = i / n
    // Ease-in-out finger profile; a sine bulge for the arc.
    const e = f * f * (3 - 2 * f)
    const bulge = Math.sin(Math.PI * f) * arc
    const px = sx0 + ux * L * e - uy * bulge
    const py = sy0 + uy * L * e + ux * bulge
    const w = unproject(px / ZOOM, py / ZOOM)
    pts.push({ sx: px / UNIT, sy: py / UNIT, wx: w.x, wy: w.y, t: f * T })
  }
  return pts
}

/** Rotates a pitch vector by `deg`. */
const rot = (v: Vec2, deg: number): Vec2 => {
  const r = (deg * Math.PI) / 180
  return { x: v.x * Math.cos(r) - v.y * Math.sin(r), y: v.x * Math.sin(r) + v.y * Math.cos(r) }
}

interface BotState {
  rng: Rng
  h: HumanNoise
  input: InputSkill
  real: number
  heldSince: number
  /** Game time the hero got the ball (bullet time slows the game, not the person's decisions about position). */
  heldSinceGame: number
  /** Sloppy release: real time he finally lets it go after being pressed (−1 = not pressed yet). */
  pressedAt: number
  actAt: number
  acted: boolean
  intent: Agent | null
  zone: Vec2 | null
  kicked: boolean
  done: boolean
  log: TrialLog
}

const mates = (rt: HighlightRuntime) => rt.agents.filter((a) => a.team === 'hero' && !a.isHero && !a.isKeeper)
const opps = (rt: HighlightRuntime) => rt.agents.filter((a) => a.team === 'opp')

/** Clean short pass (playtester build 8): an unmarked team-mate 5–18 m away with a clear lane. */
export const SHORT_PASS = { minD: 5, maxD: 18, open: 0.75, free: 5 } as const

/** The obvious open team-mate a person would pick (closest well-open one 8–28 m away, slightly preferring forward; `short`: the clean short ball). */
function obviousMate(rt: HighlightRuntime, from: Vec2, short = false): Agent | null {
  const o = opps(rt).map((a) => a.pos)
  const [minD, maxD, minOpen, minFree] = short ? [SHORT_PASS.minD, SHORT_PASS.maxD, SHORT_PASS.open, SHORT_PASS.free] : [8, 28, 0.55, 3.5]
  const c = mates(rt)
    .map((m) => ({ m, d: dist(m.pos, from), open: laneOpenness(from, m.pos, o), free: Math.min(...o.map((p) => dist(p, m.pos))) }))
    .filter((c) => c.d > minD && c.d < maxD && c.open > minOpen && c.free > minFree)
    .sort((p, q) => p.d - (p.m.pos.x - from.x) * 0.3 - (q.d - (q.m.pos.x - from.x) * 0.3))[0]
  return c?.m ?? null
}

/** Sloppy release: keeps the ball until a man is on him (≤ `near` m, or `maxHold` s), then needs a beat to let it go. True = still holding. */
function dwell(rt: HighlightRuntime, st: BotState, held: number, near = 1.8, maxHold = 4.5): boolean {
  if (st.pressedAt < 0) {
    if (held < maxHold && !opps(rt).some((a) => !a.isKeeper && dist(a.pos, rt.hero.pos) < near)) return true
    st.pressedAt = st.real + Math.max(0.05, rnd(st.rng, 0.18, 0.1))
  }
  return st.real < st.pressedAt
}

/** One frame of the human. */
function step(rt: HighlightRuntime, k: IntentKind, st: BotState, dt: number): void {
  st.real += dt
  if (rt.phase !== 'live') {
    rt.setControl({ move: { x: 0, y: 0 }, sprint: false })
    return
  }
  const hero = rt.hero
  const ball = { x: rt.ball.x, y: rt.ball.y }
  const goal = { x: PITCH_LENGTH, y: GOAL_CENTER_Y }
  const h = st.h
  const moveTo = (p: Vec2, sprint = false) => {
    const d = sub(p, hero.pos)
    rt.setControl({ move: Math.hypot(d.x, d.y) > 0.3 ? norm(d) : { x: 0, y: 0 }, sprint })
  }

  if (k === 'tackle') {
    const o = rt.owner
    if (!o || o.team !== 'opp') {
      if (!rt.owner) moveTo(ball, true)
      return
    }
    const d = dist(hero.pos, o.pos)
    if (st.input === 'good') {
      // Goal-side of the carrier, ~1.4 m off him; TACKLE when he is in reach.
      const toGoal = norm(sub({ x: 0, y: GOAL_CENTER_Y }, o.pos))
      moveTo({ x: o.pos.x + toGoal.x * 1.4, y: o.pos.y + toGoal.y * 1.4 }, d > 2.5)
    } else {
      // Ball-watching: straight at the ball.
      moveTo(o.pos, true)
    }
    const reach = st.input === 'good' ? 2.1 : 3.4
    if (d >= reach || st.real < st.actAt) return
    if (!st.acted) {
      st.acted = true
      // Sloppy: stabs at it the instant he is anywhere near (out of reach → a lunge on the charge).
      st.actAt = st.real + (st.input === 'good' ? Math.max(0.05, rnd(st.rng, h.react[0], h.react[1])) : 0.03)
      return
    }
    rt.queueAction({ kind: 'btn', id: 'tackle', dir: norm(sub(o.pos, hero.pos)) })
    st.acted = false
    st.actAt = st.real + 0.9
    return
  }

  if (!rt.heroOnBall) {
    if (st.kicked) {
      rt.setControl({ move: { x: 0, y: 0 }, sprint: false })
      return
    }
    // Not on the ball yet: go and get it.
    if (!rt.owner) moveTo(ball, true)
    return
  }
  if (st.heldSince < 0) {
    st.heldSince = st.real
    st.heldSinceGame = rt.time
  }
  const held = st.real - st.heldSince
  const heldGame = rt.time - st.heldSinceGame

  switch (k) {
    case 'shot':
    case 'shotBtn': {
      const dGoal = dist(ball, goal)
      // Run in; finish from 11–16 m (sooner with a defender closing in, or when time is getting short).
      if (st.actAt < 0) st.actAt = st.rng.range(11, 16)
      const kp = rt.agents.find((a) => a.isKeeper && a.team === 'opp')
      const chased = opps(rt).some((a) => !a.isKeeper && dist(a.pos, hero.pos) < 2.2)
      if (dGoal > st.actAt && !(chased && dGoal < 22) && heldGame < 2.5 && rt.timeLeft > 2) {
        moveTo(goal, true)
        return
      }
      if (st.acted) return
      st.acted = true
      let aimY: number
      if (st.input === 'good') {
        // Corner away from the keeper's side of the ball line, ~0.5–1.1 m inside the post.
        const kpOff = kp ? kp.pos.y - (ball.y + ((GOAL_CENTER_Y - ball.y) * (kp.pos.x - ball.x)) / Math.max(1, PITCH_LENGTH - ball.x)) : 0
        const side = Math.abs(kpOff) > 0.3 ? -Math.sign(kpOff) : st.rng.chance(0.5) ? 1 : -1
        const post = side > 0 ? POST_Y_HIGH : POST_Y_LOW
        aimY = post - side * st.rng.range(0.5, 1.1)
      } else if (st.input === 'atKeeper' && kp) {
        // Bad input: straight at the keeper (where he stands across the ball → goal line).
        aimY = ball.y + ((kp.pos.y - ball.y) * (PITCH_LENGTH - ball.x)) / Math.max(1, kp.pos.x - ball.x)
      } else {
        // Sloppy: "somewhere in the goal".
        aimY = st.rng.range(POST_Y_LOW + 0.4, POST_Y_HIGH - 0.4)
      }
      st.log.aimY = aimY
      if (k === 'shotBtn') {
        rt.queueAction({ kind: 'btn', id: 'shoot' })
        st.log.aimY = undefined
      } else {
        const dir = norm(sub({ x: PITCH_LENGTH, y: aimY }, ball))
        rt.queueAction({ kind: 'swipe', swipe: analyzeSwipe(humanSwipePoints(st.rng, ball, dir, h), 1) })
      }
      rt.setControl({ move: { x: 0, y: 0 }, sprint: false })
      return
    }
    case 'passRun': {
      // Running with it (stick pushed upfield), PASS tapped for the obvious free man: the stick still points upfield.
      const run = rot({ x: 1, y: 0 }, rnd(st.rng, 0, 20))
      rt.setControl({ move: run, sprint: false })
      if (st.acted) return
      if (!st.intent) st.intent = obviousMate(rt, ball)
      if (!st.intent) {
        if (held > 3) st.done = true
        return
      }
      if (held < 0.6 + Math.abs(rnd(st.rng, 0, h.react[1]))) return
      st.acted = true
      rt.queueAction({ kind: 'btn', id: 'pass', dir: run })
      return
    }
    case 'pass':
    case 'shortPass': {
      rt.setControl({ move: { x: 0, y: 0 }, sprint: false })
      if (st.acted) return
      if (!st.intent) st.intent = obviousMate(rt, ball, k === 'shortPass')
      if (!st.intent) {
        // No obvious pass: a sensible player waits a little for one to open up.
        if (held > 3) st.done = true
        return
      }
      if (held < 0.6 + Math.abs(rnd(st.rng, 0, h.react[1]))) return
      // Sloppy: dwells on it until a man is on him, then reacts late.
      if (st.input === 'sloppy' && dwell(rt, st, held)) return
      st.acted = true
      // Joystick toward the man (human error), then PASS.
      let dir = rot(norm(sub(st.intent.pos, ball)), rnd(st.rng, 0, h.stickSd))
      // Clean short ball, good input: he looks at the target ring (MatchScene preview) and corrects the stick if it is on someone else.
      for (let i = 0; k === 'shortPass' && st.input === 'good' && i < 3 && rt.passButtonTarget(dir) !== st.intent.id; i++) dir = rot(norm(sub(st.intent.pos, ball)), rnd(st.rng, 0, h.stickSd))
      rt.setControl({ move: dir, sprint: false })
      rt.queueAction({ kind: 'btn', id: 'pass', dir })
      return
    }
    case 'through': {
      if (st.acted) return
      // Drive forward a beat, then slide the runner in.
      moveTo(goal, false)
      if (held < 0.7) return
      // Sloppy: runs on until a man closes him down and only then (late) looks for the runner.
      if (st.input === 'sloppy' && dwell(rt, st, held, 2.3, 2.4)) return
      const o = opps(rt).map((a) => a.pos)
      const runner = mates(rt)
        .filter((m) => m.pos.x > ball.x + 3 && dist(m.pos, ball) < 32)
        .sort((p, q) => q.pos.x + laneOpenness(ball, q.pos, o) * 6 - (p.pos.x + laneOpenness(ball, p.pos, o) * 6))[0]
      if (!runner) {
        if (held > 3) st.done = true
        return
      }
      st.acted = true
      st.intent = runner
      // Into the space ahead of him.
      const lead = leadPosition(ball, { id: runner.id, pos: runner.pos, vel: runner.vel }, 14)
      const space = { x: lead.x + 5, y: lead.y }
      const dir = rot(norm(sub(space, ball)), rnd(st.rng, 0, h.stickSd))
      rt.setControl({ move: dir, sprint: false })
      rt.queueAction({ kind: 'btn', id: 'through', dir })
      return
    }
    case 'cross': {
      if (st.acted) return
      const good = st.input === 'good'
      // Carry it down the line, then whip it in (CROSS, or a swipe at the runner). Sloppy: dwells into the full-back.
      moveTo({ x: PITCH_LENGTH - 4, y: hero.pos.y }, true)
      if (good && held < 0.9 + Math.abs(rnd(st.rng, 0, h.react[1])) && ball.x < PITCH_LENGTH - 9) return
      if (!good && dwell(rt, st, held, 2.3, 3.6)) return
      st.acted = true
      const box = mates(rt)
        .filter((m) => m.pos.x > PITCH_LENGTH - 20 && Math.abs(m.pos.y - GOAL_CENTER_Y) < 13)
        .sort((p, q) => dist(p.pos, { x: PITCH_LENGTH - 9, y: GOAL_CENTER_Y }) - dist(q.pos, { x: PITCH_LENGTH - 9, y: GOAL_CENTER_Y }))[0]
      st.intent = box ?? null
      st.zone = box ? leadPosition(ball, { id: box.id, pos: box.pos, vel: box.vel }, 18, 3) : { x: PITCH_LENGTH - 8, y: GOAL_CENTER_Y }
      if (CROSS_BY_SWIPE) rt.queueAction({ kind: 'swipe', swipe: analyzeSwipe(humanSwipePoints(st.rng, ball, norm(sub(st.zone, ball)), h), 1) })
      else rt.queueAction({ kind: 'btn', id: 'cross' })
      return
    }
  }
}

/** A hero level: an OVR profile, or a number = the moment's own attributes set to it (curve tables). */
export type Level = Profile | number

/** Optional sheet overrides for the players around the hero (attribute → value). */
export interface TrialSetup {
  /** Applied to every outfield team-mate (e.g. the receivers' First Touch / Anticipation). */
  mates?: Partial<Record<AttributeKey, number>>
  /** Applied to every outfield opponent (pace, tackling, …). */
  opps?: Partial<Record<AttributeKey, number>>
  /** Applied to the hero on top of the level (e.g. Pace, Dribbling for a breakaway). */
  hero?: Partial<Record<AttributeKey, number>>
  /** Applied to the opposition keeper. */
  keeper?: Partial<Record<AttributeKey, number>>
}

/** The overrides that apply to scenario player `p` (hero side `side`). */
const overFor = (setup: TrialSetup, p: { isHero: boolean; role: string; side: string }, side: string) =>
  p.isHero ? setup.hero : p.role === 'GK' ? (p.side === side ? undefined : setup.keeper) : p.side === side ? setup.mates : setup.opps

function highlightFor(k: IntentKind, seed: number, level: Level, setup: TrialSetup = {}, kind: HighlightKind = MOMENT[k]) {
  const hl = typeof level === 'string'
    ? generatedHighlight(kind, seed, { ovr: TEAM_OVR, heroOvr: PROFILES[level] })
    : generatedHighlight(kind, seed, { ovr: TEAM_OVR, heroOvr: CURVE_BASE_OVR })
  for (const p of hl.scenario.players) {
    const over = overFor(setup, p, hl.side)
    if (p.isHero && typeof level === 'number') {
      p.attrs = { ...p.attrs }
      for (const a of KIND_ATTRS[k]) p.attrs[a] = level
    }
    if (over) p.attrs = { ...p.attrs, ...over }
  }
  return hl
}

/** Plays one trial. */
export function playIntent(
  k: IntentKind,
  seed: number,
  level: Level,
  input: InputSkill = 'good',
  difficulty: Difficulty = 'normal',
  assist: 'full' | 'half' | 'manual' = 'half',
  setup: TrialSetup = {},
): TrialLog {
  const rt = new HighlightRuntime(highlightFor(k, seed, level, setup), { aimAssist: assist, slowMoAim: true, difficulty, seed: seed * 7919 + 101 })
  const st: BotState = {
    rng: new Rng(`intent:${k}:${seed}`), h: HUMAN[input], input, real: 0, heldSince: -1, heldSinceGame: -1, pressedAt: -1, actAt: -1, acted: false, intent: null, zone: null, kicked: false, done: false,
    log: { outcome: 'timeout', success: false },
  }
  const passLike = k === 'pass' || k === 'shortPass' || k === 'passRun' || k === 'through' || k === 'cross'
  const dt = 1 / 60
  let kickT = -1
  let resolved: boolean | null = null
  let crossed = false
  for (let f = 0; f < 60 * 40 && !rt.finished; f++) {
    step(rt, k, st, dt)
    rt.update(dt)
    for (const e of rt.drainEvents()) {
      if (e.type === 'kick' && e.hero && kickT < 0) {
        kickT = st.real
        st.kicked = true
        st.log.meant = st.intent?.id
        st.log.playedTo = rt.passTargetId ?? undefined
      }
      // Tackle: the hero's first challenge decides it (won the ball, or lost / fouled).
      if (k === 'tackle' && resolved === null && 'by' in e && e.by === rt.hero.id && (e.type === 'tackle' || e.type === 'foul')) {
        resolved = e.type === 'tackle' && e.won
      }
      if (kickT < 0 || resolved !== null || !passLike) continue
      if (e.type === 'out') {
        resolved = false
        st.log.why = 'out'
      }
      // First touch on the pass: a team-mate's heavy touch, or an opponent getting a foot to it.
      if (e.type === 'touch' && !e.hero && !st.log.why) {
        const a = rt.agents.find((x) => x.id === e.by)
        if (a && rt.owner !== a) st.log.why = a.team === 'hero' ? 'heavy' : 'intercepted'
        else if (a && a.team === 'opp') st.log.why = 'intercepted'
      }
      // Cross: a team-mate getting his head (or a foot) to it first counts; an opponent's touch ends it.
      if (k === 'cross' && (e.type === 'header' || e.type === 'aerial' || e.type === 'touch' || e.type === 'save')) {
        const a = rt.agents.find((x) => x.id === e.by)
        if (a && !a.isHero) resolved = a.team === 'hero'
      }
    }
    // Pass / through ball: the next player to bring it under control (not a heavy touch) decides it, within 4 s.
    if ((k === 'pass' || k === 'shortPass' || k === 'passRun' || k === 'through') && kickT >= 0 && resolved === null) {
      const o = rt.owner
      // A through ball is for the runner it was meant for; a pass for any team-mate.
      if (o && !o.isHero) resolved = o.team === 'hero' && (k !== 'through' || o === st.intent)
      else if (st.real - kickT > 4) {
        resolved = false
        st.log.why ??= 'timeout'
      }
    }
    // Shots: where the ball crosses the goal line.
    if ((k === 'shot' || k === 'shotBtn') && kickT >= 0 && !crossed && rt.ball.x >= PITCH_LENGTH) {
      crossed = true
      st.log.hitY = rt.ball.y
      st.log.hitZ = rt.ball.z
    }
    // Cross: the ball reaches the target zone (within 2.5 m, header height or below) before an opponent touches it.
    if (k === 'cross' && kickT >= 0 && resolved === null && st.zone && rt.ball.z < 2.8 && dist({ x: rt.ball.x, y: rt.ball.y }, st.zone) < 2.5) resolved = true
    if (st.done) break
    if (resolved !== null && (passLike || k === 'tackle')) break
  }
  const outcome =
    k === 'tackle'
      ? resolved === null ? 'no_challenge' : resolved ? 'won' : 'lost'
      : rt.result?.outcome ?? (resolved === true ? 'reached' : resolved === false ? 'lost' : kickT < 0 ? 'no_kick' : 'timeout')
  st.log.outcome = outcome
  if (k === 'shot' || k === 'shotBtn') {
    st.log.success = outcome === 'goal'
    st.log.offTarget = outcome === 'missed' || outcome === 'woodwork'
  } else if (k === 'tackle') st.log.success = resolved === true
  else st.log.success = resolved === true
  return st.log
}

export interface IntentRate {
  rate: number
  offTarget: number
  /** Trials where the human found no sensible option (excluded from the rate). */
  skipped: number
  n: number
}

/** Success rate over seeds 1..n (trials with no kick at all — no sensible option — are skipped). */
export function intentRate(
  k: IntentKind,
  level: Level,
  n: number,
  input: InputSkill = 'good',
  difficulty: Difficulty = 'normal',
  assist: 'full' | 'half' | 'manual' = 'half',
  setup: TrialSetup = {},
): IntentRate {
  let ok = 0
  let off = 0
  let used = 0
  let skipped = 0
  for (let s = 1; s <= n; s++) {
    const r = playIntent(k, s, level, input, difficulty, assist, setup)
    if (r.outcome === 'no_kick' || (k === 'tackle' && r.outcome === 'no_challenge')) {
      skipped++
      continue
    }
    used++
    if (r.success) ok++
    if (r.offTarget) off++
  }
  return { rate: used ? ok / used : 0, offTarget: used ? off / used : 0, skipped, n: used }
}

export interface ReceptionRate {
  /** Share of clean short passes played to the man meant that a team-mate brought under control. */
  rate: number
  /** Share of presses that went to a different team-mate than the one meant. */
  wrongTarget: number
  n: number
}

/**
 * Clean-short-pass reception (playtester build 8): an unmarked team-mate 5–18 m away with an open lane, the
 * hero's pass played to him. `level` = the hero's pass attributes, `setup.mates` e.g. the receivers' First Touch.
 */
export function shortPassReception(level: Level, n: number, input: InputSkill = 'good', setup: TrialSetup = {}): ReceptionRate {
  let ok = 0
  let used = 0
  let wrong = 0
  let kicked = 0
  for (let s = 1; s <= n; s++) {
    const r = playIntent('shortPass', s, level, input, 'normal', 'half', setup)
    if (r.outcome === 'no_kick') continue
    kicked++
    if (r.meant !== r.playedTo) {
      wrong++
      continue
    }
    used++
    if (r.success) ok++
  }
  return { rate: used ? ok / used : 0, wrongTarget: kicked ? wrong / kicked : 0, n: used }
}

// ───────────────────────── Pressure on the ball (playtester build 8) ─────────────────────────

/** Moments that start with the hero on the ball in open play. */
export const ON_BALL_KINDS: readonly HighlightKind[] = ['build_up', 'counter', 'one_on_one', 'cross', 'edge_of_box', 'counter_2v1', 'hold_up', 'dribble', 'long_shot', 'switch_play']

export interface PressureLog {
  /** Game seconds from the hero's first control to an opponent winning it (−1 = kept it). */
  lostAt: number
  /** The winner came from behind the hero. */
  behind: boolean
  /** Distance (m) of the nearest outfield opponent when the hero got the ball. */
  nearest0: number
  /** The winner started behind the hero (a chaser), not in front of him. */
  chaser: boolean
}

/**
 * The hero holds the ball (`idle`: stands on it, `run`: carries it toward goal, sprinting) and does nothing else;
 * logs when (and from where) an opponent takes it. Used for the start-of-moment grace window and breakaway chases.
 */
export function pressureTrial(kind: HighlightKind, seed: number, mode: 'idle' | 'run', setup: TrialSetup = {}, heroOvr: number = PROFILES.start, maxT = 6): PressureLog {
  const hl = generatedHighlight(kind, seed, { ovr: TEAM_OVR, heroOvr })
  for (const p of hl.scenario.players) {
    const over = overFor(setup, p, hl.side)
    if (over) p.attrs = { ...p.attrs, ...over }
  }
  const rt = new HighlightRuntime(hl, { aimAssist: 'half', slowMoAim: true, difficulty: 'normal', seed: seed * 7919 + 101 })
  const goal = { x: PITCH_LENGTH, y: GOAL_CENTER_Y }
  let t0 = -1
  let nearest0 = Infinity
  const startX = new Map<string, number>()
  let heroX0 = 0
  for (let f = 0; f < 60 * 30 && !rt.finished; f++) {
    const hero = rt.hero
    if (rt.phase === 'live' && rt.owner === hero) {
      if (t0 < 0) {
        t0 = rt.time
        for (const a of opps(rt)) if (!a.isKeeper) nearest0 = Math.min(nearest0, dist(a.pos, hero.pos))
        for (const a of rt.agents) startX.set(a.id, a.pos.x)
        heroX0 = hero.pos.x
      }
      if (mode === 'run') {
        const d = sub(goal, hero.pos)
        rt.setControl({ move: norm(d), sprint: true })
      } else rt.setControl({ move: { x: 0, y: 0 }, sprint: false })
    } else rt.setControl({ move: { x: 0, y: 0 }, sprint: false })
    const facing = hero.facing
    const hp = { ...hero.pos }
    const had = rt.owner === hero
    rt.update(1 / 60)
    rt.drainEvents()
    if (t0 >= 0 && had && rt.owner !== hero) {
      const o = rt.owner
      // A loose ball after a challenge / shoulder: whoever takes it next decides (the ball is gone either way).
      let winner = o
      for (let g = 0; g < 90 && !winner && !rt.finished; g++) {
        rt.setControl({ move: { x: 0, y: 0 }, sprint: false })
        rt.update(1 / 60)
        rt.drainEvents()
        winner = rt.owner
      }
      if (winner && winner.team === 'opp') {
        const fwd = { x: Math.cos(facing), y: Math.sin(facing) }
        const to = norm(sub(winner.pos, hp))
        return { lostAt: rt.time - t0, behind: to.x * fwd.x + to.y * fwd.y < -0.45, nearest0, chaser: (startX.get(winner.id) ?? 0) < heroX0 - 1 }
      }
      return { lostAt: -1, behind: false, nearest0, chaser: false }
    }
    if (t0 >= 0 && rt.time - t0 > maxT) break
    if (mode === 'run' && hero.pos.x > PITCH_LENGTH - 14) break
  }
  return { lostAt: -1, behind: false, nearest0, chaser: false }
}

export interface PressureRate {
  /** Share of trials lost within `within` s of the first control. */
  lostEarly: number
  /** Share lost at all (within the trial). */
  lost: number
  /** Share lost to a man coming from behind. */
  behind: number
  /** Share lost to a man who started behind the hero (caught from behind on a breakaway). */
  caught: number
  n: number
}

export function pressureRate(kinds: readonly HighlightKind[], n: number, mode: 'idle' | 'run', within = 1.5, setup: TrialSetup = {}, heroOvr: number = PROFILES.start, maxT = 6): PressureRate {
  let early = 0
  let lost = 0
  let behind = 0
  let caught = 0
  let used = 0
  for (const k of kinds) {
    for (let s = 1; s <= n; s++) {
      const r = pressureTrial(k, s, mode, setup, heroOvr, maxT)
      if (!Number.isFinite(r.nearest0)) continue
      used++
      if (r.lostAt >= 0) {
        lost++
        if (r.lostAt <= within) early++
        if (r.behind) behind++
        if (r.chaser) caught++
      }
    }
  }
  return { lostEarly: used ? early / used : 0, lost: used ? lost / used : 0, behind: used ? behind / used : 0, caught: used ? caught / used : 0, n: used }
}

/**
 * Pure breakaway (playtester build 8: "when I run, the man behind me catches up and takes it"): a 1v1 with one
 * chaser `gap` m behind the hero (the other outfield opponents far behind), the hero carries it at goal at full
 * sprint. True = the chaser (or anyone) won the ball before the hero reached the edge of the box.
 */
export function breakawayCaught(seed: number, setup: TrialSetup, gap = 3): boolean {
  const hl = generatedHighlight('one_on_one', seed, { ovr: TEAM_OVR, heroOvr: PROFILES.start })
  const hero = hl.scenario.players.find((p) => p.isHero)!
  // From the halfway line: a 35 m run to the edge of the box.
  hero.pos = { x: PITCH_LENGTH / 2, y: hero.pos.y }
  let first = true
  for (const p of hl.scenario.players) {
    const over = overFor(setup, p, hl.side)
    if (over) p.attrs = { ...p.attrs, ...over }
    if (p.side !== hl.side && p.role !== 'GK') {
      // One chaser on his shoulder-blade, the rest out of it.
      p.pos = first ? { x: hero.pos.x - gap, y: hero.pos.y + 0.8 } : { x: hero.pos.x - 25, y: p.pos.y }
      first = false
    }
  }
  hl.scenario.ball.pos = { ...hero.pos }
  hl.scenario.ball.ownerId = hero.id
  const rt = new HighlightRuntime(hl, { aimAssist: 'half', slowMoAim: true, difficulty: 'normal', seed: seed * 7919 + 101 })
  for (let f = 0; f < 60 * 20 && !rt.finished; f++) {
    const h = rt.hero
    rt.setControl(rt.owner === h ? { move: norm(sub({ x: PITCH_LENGTH, y: GOAL_CENTER_Y }, h.pos)), sprint: true } : { move: { x: 0, y: 0 }, sprint: false })
    rt.update(1 / 60)
    rt.drainEvents()
    if (rt.owner && rt.owner.team === 'opp' && !rt.owner.isKeeper) {
      if (BREAKAWAY_DEBUG) console.log(`caught seed=${seed} t=${rt.time.toFixed(2)} by=${rt.owner.id} at x=${rt.owner.pos.x.toFixed(1)} heroX=${h.pos.x.toFixed(1)}`)
      return true
    }
    if (rt.phase === 'live' && rt.owner !== h && rt.owner?.team !== 'hero' && !rt.owner) {
      // Knocked loose: whoever is next on it.
      continue
    }
    if (h.pos.x > PITCH_LENGTH - 18) return false
  }
  return false
}

export let BREAKAWAY_DEBUG = false
export function setBreakawayDebug(v: boolean): void {
  BREAKAWAY_DEBUG = v
}

/** Share of breakaways caught over seeds 1..n. */
export function breakawayRate(n: number, setup: TrialSetup, gap = 3): number {
  let c = 0
  for (let s = 1; s <= n; s++) if (breakawayCaught(s, setup, gap)) c++
  return c / n
}

// ───────────────────────── Setup phase & support (playtester build 8) ─────────────────────────

/** Attacking moments whose opening is scripted for an AI team-mate on the ball (the feed to the hero). */
export const SETUP_KINDS: readonly HighlightKind[] = ['long_ball_control', 'header', 'shoulder_duel', 'timed_run']

/**
 * Setup-phase possession loss: the moment opens with a team-mate on the ball (the hero idle — the worst case: the
 * feed waits longest); true = an opponent had the ball before the team-mate released it.
 */
export function setupLost(kind: HighlightKind, seed: number): boolean | null {
  const rt = new HighlightRuntime(generatedHighlight(kind, seed, { ovr: TEAM_OVR, heroOvr: PROFILES.start }), { aimAssist: 'half', difficulty: 'normal', seed: seed * 7919 + 101 })
  const o0 = rt.owner
  if (!o0 || o0.isHero || o0.team !== 'hero') return null
  for (let f = 0; f < 60 * 12 && !rt.finished; f++) {
    rt.setControl({ move: { x: 0, y: 0 }, sprint: false })
    rt.update(1 / 60)
    for (const e of rt.drainEvents()) if (e.type === 'kick' && e.by === o0.id) return false
    if (rt.owner?.isHero) return false
    if ((rt.owner && rt.owner.team === 'opp') || rt.result) return true
  }
  return false
}

export function setupLossRate(kinds: readonly HighlightKind[], n: number): { rate: number; n: number } {
  let lost = 0
  let used = 0
  for (const k of kinds) {
    for (let s = 1; s <= n; s++) {
      const r = setupLost(k, s)
      if (r === null) continue
      used++
      if (r) lost++
    }
  }
  return { rate: used ? lost / used : 0, n: used }
}

export interface SupportLog {
  /** Samples (every 0.5 s on the ball) with at least one viable pass option. */
  withOption: number
  samples: number
  /** Mean viable options per sample. */
  mean: number
  /** Samples with an option ahead / to the left / to the right of the hero (pitch frame). */
  ahead: number
  left: number
  right: number
}

/** A viable pass option: an onside team-mate 6–30 m away, the lane open, nobody within 3 m of him. */
export function viableOptions(rt: HighlightRuntime): Agent[] {
  const from = { x: rt.ball.x, y: rt.ball.y }
  const o = opps(rt).filter((a) => !a.isKeeper).map((a) => a.pos)
  const off = rt.offsideMates()
  return mates(rt).filter((m) => {
    const d = dist(m.pos, from)
    return d >= 6 && d <= 30 && !off.has(m.id) && laneOpenness(from, m.pos, o) > 0.45 && Math.min(...o.map((p) => dist(p, m.pos))) > 3
  })
}

/** Carries the ball toward goal (`run`, at a jog) for up to 4 s and samples the pass options twice a second. */
export function supportTrial(kind: HighlightKind, seed: number, setup: TrialSetup = {}): SupportLog {
  const hl = generatedHighlight(kind, seed, { ovr: TEAM_OVR, heroOvr: PROFILES.start })
  for (const p of hl.scenario.players) {
    const over = overFor(setup, p, hl.side)
    if (over) p.attrs = { ...p.attrs, ...over }
  }
  const rt = new HighlightRuntime(hl, { aimAssist: 'half', slowMoAim: true, difficulty: 'normal', seed: seed * 7919 + 101 })
  const log: SupportLog = { withOption: 0, samples: 0, mean: 0, ahead: 0, left: 0, right: 0 }
  let t0 = -1
  let next = 0
  for (let f = 0; f < 60 * 20 && !rt.finished; f++) {
    const h = rt.hero
    const on = rt.phase === 'live' && rt.owner === h
    rt.setControl(on ? { move: norm(sub({ x: PITCH_LENGTH, y: GOAL_CENTER_Y }, h.pos)), sprint: false } : { move: { x: 0, y: 0 }, sprint: false })
    rt.update(1 / 60)
    rt.drainEvents()
    if (!on) {
      if (t0 >= 0) break
      continue
    }
    if (t0 < 0) {
      t0 = rt.time
      next = t0 + 0.5
    }
    if (rt.time >= next) {
      next += 0.5
      const v = viableOptions(rt)
      log.samples++
      log.mean += v.length
      if (v.length) log.withOption++
      if (v.some((m) => m.pos.x > h.pos.x + 3)) log.ahead++
      if (v.some((m) => m.pos.y < h.pos.y - 4)) log.left++
      if (v.some((m) => m.pos.y > h.pos.y + 4)) log.right++
    }
    if (rt.time - t0 > 4) break
  }
  if (log.samples) log.mean /= log.samples
  return log
}

export function supportRate(kinds: readonly HighlightKind[], n: number, setup: TrialSetup = {}): { withOption: number; mean: number; ahead: number; sides: number; samples: number; moments: number } {
  let mo = 0
  let tr = 0
  let w = 0
  let m = 0
  let ah = 0
  let sides = 0
  let s = 0
  for (const k of kinds) {
    for (let i = 1; i <= n; i++) {
      const r = supportTrial(k, i, setup)
      if (r.samples) {
        tr++
        if (r.withOption) mo++
      }
      w += r.withOption
      m += r.mean * r.samples
      ah += r.ahead
      sides += Math.min(r.left, r.right)
      s += r.samples
    }
  }
  return { withOption: s ? w / s : 0, mean: s ? m / s : 0, ahead: s ? ah / s : 0, sides: s ? sides / s : 0, samples: s, moments: tr ? mo / tr : 0 }
}
