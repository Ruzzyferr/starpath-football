/**
 * "Watch the opponent's video" mini-game (headless rules; the Phaser
 * ScoutingScene renders it, the DOM overlay asks the questions).
 *
 * Four short top-down clips are generated from the next opponent's real
 * tendencies (sim/game/oppScouting): their left-back bombing forward, the
 * long ball to a tall striker, the keeper's penalty side, the high press…
 * Each clip offers three readings; the player taps the one they spotted. A
 * correct answer scores 0.55 plus up to 0.45 for spotting it early; a wrong
 * one or the time running out scores 0. The mean (0..1) grades the session.
 *
 * Coordinates: pitch metres, x across (0..68, screen left → right), y along
 * (0..105). The opponent attacks UP: their goal is at y = 0 (bottom), ours at
 * y = 105 (top). "Their left" is therefore the screen's left.
 */
import { Rng } from '../../core/rng'
import type { KitColors, LText } from '../../core/types'
import { MIRROR, patternText, scoutGrade, type PatternId, type ScoutReport, type Tendency } from '../../sim/game/oppScouting'

export const PITCH_W = 68
export const PITCH_L = 105
/** Clips per session. */
export const CLIPS = 4
/** Seconds a clip waits for an answer before it counts as missed. */
export const CLIP_TIMEOUT = 8
/** Title card before each clip and the feedback after it (s). */
export const TITLE_TIME = 0.9
export const FEEDBACK_TIME = 2.3

type P = [number, number]
type Key = [number, number, number] // t, x, y

export interface ClipActor {
  id: string
  side: 'opp' | 'us'
  number: number
  gk?: boolean
  /** The player the pattern is about (drawn with a halo once revealed). */
  key?: boolean
  keys: Key[]
}

export interface BallSeg {
  t0: number
  t1: number
  from: P
  to: P
  /** Peak height (m) of a lofted ball. */
  lift?: number
}

export interface Annotation {
  kind: 'arrow' | 'ring' | 'path'
  pts: P[]
  r?: number
}

export interface ClipOption {
  id: PatternId
  text: LText
}

export interface Clip {
  pattern: PatternId
  tendency: Tendency
  actors: ClipActor[]
  ball: BallSeg[]
  /** Animation length (s); the clip loops after a short pause. */
  length: number
  /** When the habit is plainly visible (s): answers up to here earn the full speed bonus. */
  reveal: number
  /** Camera window (pitch metres). */
  focus: { x: number; y: number; w: number; h: number }
  annotations: Annotation[]
  options: ClipOption[]
  correct: number
}

export type ScoutPhase = 'title' | 'clip' | 'feedback' | 'done'

export interface ClipAnswer {
  choice: number | null
  correct: boolean
  score: number
  at: number
}

export interface ScoutingResult {
  performance: number
  grade: 'S' | 'A' | 'B' | 'C' | 'D'
  spotted: PatternId[]
  answers: ClipAnswer[]
  played: number
}

export interface ScoutFrame {
  phase: ScoutPhase
  index: number
  clip: Clip
  /** Animation time inside the clip (s). */
  animT: number
  /** Seconds left to answer (clip phase). */
  timeLeft: number
  /** 0..1 progress of the feedback phase (annotation reveal). */
  feedback: number
  answer: ClipAnswer | null
}

// ───────────────────────── Shapes ─────────────────────────

/** Their base 4-4-2 shape (attacking up). Index = role. */
const OPP: Record<string, P> = {
  gk: [34, 4], lb: [10, 28], lcb: [26, 22], rcb: [42, 22], rb: [58, 28],
  lm: [10, 50], lcm: [28, 45], rcm: [40, 45], rm: [58, 50], ls: [28, 70], rs: [40, 72],
}
const OPP_NUM: Record<string, number> = { gk: 1, lb: 3, lcb: 4, rcb: 5, rb: 2, lm: 11, lcm: 8, rcm: 6, rm: 7, ls: 9, rs: 10 }
/** Our shape (defending the top goal). */
const US: Record<string, P> = {
  gk: [34, 101], d1: [12, 82], d2: [27, 87], d3: [41, 87], d4: [56, 82],
  m1: [14, 68], m2: [29, 70], m3: [39, 70], m4: [54, 68], f1: [28, 56], f2: [40, 56],
}

const mirrorX = (p: P): P => [PITCH_W - p[0], p[1]]

/** A static actor with an optional run. */
function actor(id: string, side: 'opp' | 'us', base: P, run: Key[] = [], extra: Partial<ClipActor> = {}): ClipActor {
  const num = side === 'opp' ? OPP_NUM[id] ?? 14 : Object.keys(US).indexOf(id) + 1
  return { id: `${side}:${id}`, side, number: num, ...(id === 'gk' ? { gk: true } : {}), keys: [[0, base[0], base[1]], ...run], ...extra }
}

function team(side: 'opp' | 'us', runs: Record<string, Key[]>, key?: string, shift: P = [0, 0]): ClipActor[] {
  const shape = side === 'opp' ? OPP : US
  return Object.entries(shape).map(([id, p]) => actor(id, side, [p[0] + shift[0], p[1] + shift[1]], runs[id] ?? [], id === key ? { key: true } : {}))
}

// ───────────────────────── Clip scripts ─────────────────────────

interface Script { actors: ClipActor[]; ball: BallSeg[]; length: number; reveal: number; focus: Clip['focus']; annotations: Annotation[] }

const FULL: Clip['focus'] = { x: 0, y: 0, w: PITCH_W, h: PITCH_L }

function fbPush(right: boolean, number?: number): Script {
  const m = (p: P): P => (right ? mirrorX(p) : p)
  const k = (t: number, p: P): Key => { const q = m(p); return [t, q[0], q[1]] }
  const fb = right ? 'rb' : 'lb'
  const wide = right ? 'rm' : 'lm'
  const ourFb = right ? 'd4' : 'd1'
  const opp = team('opp', {
    [fb]: [k(1.0, [10, 30]), k(3.4, [7, 66]), k(4.4, [8, 70])],
    [wide]: [k(1.2, [10, 50]), k(3.0, [21, 60])],
    lcm: [k(1.4, [28, 47])],
    ls: [k(3.6, [28, 72]), k(5.4, [31, 90])],
    rs: [k(3.6, [40, 74]), k(5.6, [40, 88])],
  }, fb)
  if (number) for (const a of opp) if (a.id === `opp:${fb}`) a.number = number
  const us = team('us', {})
  // Their wide man drags our full-back inside; the overlapping full-back is free.
  const ourFbActor = us.find((a) => a.id === `us:${ourFb}`)!
  const fbBase = US[ourFb]!
  ourFbActor.keys = [[0, fbBase[0], fbBase[1]], [1.4, fbBase[0], fbBase[1]], [3.0, m([19, 72])[0], 72]]
  return {
    actors: [...opp, ...us], length: 6.4, reveal: 3.6, focus: FULL,
    ball: [
      { t0: 0.4, t1: 1.2, from: m(OPP.lcb!), to: m([28, 47]) },
      { t0: 3.0, t1: 3.9, from: m([28, 47]), to: m([7, 67]) },
      { t0: 4.5, t1: 5.5, from: m([8, 70]), to: m([32, 91]), lift: 3.5 },
    ],
    annotations: [{ kind: 'arrow', pts: [m([10, 30]), m([7, 50]), m([8, 68])] }, { kind: 'ring', pts: [m([11, 33])], r: 9 }],
  }
}

function longBall(number?: number): Script {
  const opp = team('opp', { ls: [[0.6, 31, 72], [2.6, 33, 78]], rs: [[2.4, 40, 74], [3.6, 46, 88]], lcm: [[1.0, 28, 52]], rcm: [[1.0, 40, 52]] }, 'ls')
  if (number) for (const a of opp) if (a.id === 'opp:ls') a.number = number
  const us = team('us', { d2: [[2.2, 30, 84], [2.7, 32, 80]], d3: [[2.4, 40, 86]] })
  return {
    actors: [...opp, ...us], length: 5.6, reveal: 2.8, focus: FULL,
    ball: [
      { t0: 0.6, t1: 2.7, from: [34, 6], to: [33, 79], lift: 14 },
      { t0: 2.8, t1: 3.5, from: [33, 79], to: [45, 87], lift: 2 },
      { t0: 3.6, t1: 4.4, from: [45, 87], to: [36, 104.5] },
    ],
    annotations: [{ kind: 'arrow', pts: [[34, 7], [33, 44], [33, 77]] }, { kind: 'ring', pts: [[33, 78]], r: 6 }],
  }
}

function penalty(right: boolean, number?: number): Script {
  const s = right ? 1 : -1 // keeper's dive direction in x
  const keeper = actor('gk', 'opp', [34, 1.2], [[1.7, 34, 1.2], [2.2, 34 + 4.5 * s, 1.6], [3.0, 34 + 4.5 * s, 1.6], [3.1, 34, 1.2], [4.6, 34, 1.2], [5.1, 34 + 4.5 * s, 1.6]], { key: true })
  if (number) keeper.number = number
  const kicker = actor('f1', 'us', [31, 16.5], [[0.4, 31, 16.5], [1.6, 33.6, 12.2], [2.6, 33.6, 12.2], [2.8, 31, 16.5], [3.4, 31, 16.5], [4.5, 33.6, 12.2]])
  const others = [
    actor('lcb', 'opp', [20, 18]), actor('rcb', 'opp', [48, 18]), actor('lcm', 'opp', [26, 24]),
    actor('m2', 'us', [22, 20]), actor('m3', 'us', [46, 21]), actor('f2', 'us', [40, 24]),
  ]
  return {
    actors: [keeper, kicker, ...others], length: 6.2, reveal: 2.3, focus: { x: 12, y: -2, w: 44, h: 30 },
    ball: [
      { t0: 0, t1: 1.6, from: [34, 11], to: [34, 11] },
      { t0: 1.7, t1: 2.15, from: [34, 11], to: [34 + 3 * s, 0.6], lift: 0.6 },
      { t0: 2.9, t1: 3.0, from: [34 + 3 * s, 0.6], to: [34, 11] },
      { t0: 4.6, t1: 5.05, from: [34, 11], to: [34 - 2.6 * s, 0.4], lift: 1.2 },
    ],
    annotations: [{ kind: 'arrow', pts: [[34, 1.6], [34 + 4.8 * s, 1.8]] }, { kind: 'ring', pts: [[34 + 2.8 * s, 1.4]], r: 3.2 }],
  }
}

function highPress(): Script {
  const opp = team('opp', {
    ls: [[0.8, 28, 70], [2.4, 27, 86]], rs: [[0.8, 40, 72], [2.4, 37, 92]],
    lcm: [[1.0, 28, 45], [2.6, 30, 76]], rcm: [[1.0, 40, 45], [2.6, 43, 78]],
    lm: [[1.0, 10, 50], [2.6, 13, 76]], rm: [[1.0, 58, 50], [2.6, 55, 76]],
    lb: [[1.4, 12, 46]], rb: [[1.4, 56, 46]], lcb: [[1.4, 26, 40]], rcb: [[1.4, 42, 40]],
  }, 'rs')
  const us = team('us', { d2: [[1.3, 27, 90]], d3: [[1.3, 41, 90]], m2: [[2.0, 29, 74]] })
  return {
    actors: [...opp, ...us], length: 5.4, reveal: 2.4, focus: { x: 0, y: 34, w: PITCH_W, h: 71 },
    ball: [
      { t0: 0.4, t1: 1.2, from: [34, 101], to: [27, 89] },
      { t0: 2.5, t1: 3.0, from: [27, 89], to: [30, 77] },
      { t0: 3.4, t1: 4.2, from: [30, 77], to: [36, 92] },
    ],
    annotations: [{ kind: 'arrow', pts: [[40, 72], [37, 90]] }, { kind: 'arrow', pts: [[28, 45], [30, 74]] }, { kind: 'ring', pts: [[31, 86]], r: 11 }],
  }
}

function cornerNear(number?: number): Script {
  const opp = [
    actor('lcb', 'opp', [40, 84], [[0.8, 40, 86], [2.0, 39, 100]], { key: true }),
    actor('rcb', 'opp', [30, 88], [[1.0, 30, 90], [2.1, 31, 97]]),
    actor('ls', 'opp', [34, 94], [[1.2, 34, 95]]), actor('rs', 'opp', [26, 96]),
    actor('rm', 'opp', [67, 104.5]), actor('lcm', 'opp', [44, 80]),
  ]
  if (number) opp[0]!.number = number
  const us = [
    actor('gk', 'us', [34, 103.5]), actor('d2', 'us', [39, 92], [[1.0, 39, 92], [2.2, 39, 97]]), actor('d3', 'us', [31, 93]),
    actor('d1', 'us', [36.5, 104]), actor('m2', 'us', [28, 99]), actor('m3', 'us', [46, 88]), actor('f1', 'us', [34, 80]),
  ]
  return {
    actors: [...opp, ...us], length: 4.6, reveal: 2.6, focus: { x: 14, y: 72, w: 56, h: 36 },
    ball: [
      { t0: 0, t1: 1.6, from: [67, 104.5], to: [67, 104.5] },
      { t0: 1.6, t1: 2.5, from: [67, 104.5], to: [38.5, 100], lift: 5 },
      { t0: 2.55, t1: 2.95, from: [38.5, 100], to: [35.6, 105] },
    ],
    annotations: [{ kind: 'path', pts: [[66, 104], [52, 99], [39, 100]] }, { kind: 'ring', pts: [[38.5, 100]], r: 3.6 }],
  }
}

function counter(number?: number): Script {
  // We are attacking (pushed into their half); they win it and break.
  const shift: P = [0, -38]
  const us = team('us', { f1: [[0.6, 30, 18]], f2: [[0.6, 42, 20]] }, undefined, shift)
  const opp = team('opp', {
    lcm: [[0.4, 30, 36], [0.7, 32, 38]],
    rm: [[0.9, 56, 48], [2.6, 56, 70], [3.8, 48, 90]],
    rs: [[1.1, 40, 60], [3.4, 38, 80]],
  }, 'rm')
  if (number) for (const a of opp) if (a.id === 'opp:rm') a.number = number
  return {
    actors: [...us, ...opp], length: 5.2, reveal: 2.6, focus: FULL,
    ball: [
      { t0: 0, t1: 0.6, from: [34, 34], to: [32, 38] },
      { t0: 1.2, t1: 2.3, from: [32, 38], to: [56, 68], lift: 3 },
      { t0: 2.6, t1: 3.8, from: [56, 70], to: [48, 90] },
      { t0: 3.9, t1: 4.4, from: [48, 90], to: [36, 104.5] },
    ],
    annotations: [{ kind: 'arrow', pts: [[56, 48], [56, 70], [48, 90]] }, { kind: 'ring', pts: [[56, 64]], r: 9 }],
  }
}

function shortBuild(): Script {
  const opp = team('opp', {
    lcm: [[0.6, 30, 36], [2.4, 30, 52]], rcm: [[1.2, 38, 46], [3.0, 37, 62]], ls: [[2.4, 31, 60], [3.6, 33, 74]],
    lm: [[1.5, 16, 52]], rm: [[1.5, 52, 52]], rs: [[2.8, 41, 70]],
  }, 'lcm')
  const us = team('us', {})
  const pts: P[] = [[26, 22], [30, 36], [38, 46], [30, 52], [37, 62], [31, 60], [33, 74]]
  const ball: BallSeg[] = []
  for (let i = 0; i < pts.length - 1; i++) ball.push({ t0: 0.5 + i * 0.62, t1: 0.5 + i * 0.62 + 0.42, from: pts[i]!, to: pts[i + 1]! })
  return {
    actors: [...opp, ...us], length: 5.4, reveal: 3.0, focus: { x: 0, y: 10, w: PITCH_W, h: 80 },
    ball, annotations: [{ kind: 'path', pts }, { kind: 'ring', pts: [[33, 50]], r: 12 }],
  }
}

function script(t: Tendency): Script {
  switch (t.id) {
    case 'fbLeft': return fbPush(false, t.number)
    case 'fbRight': return fbPush(true, t.number)
    case 'longBall': return longBall(t.number)
    case 'gkPenLeft': return penalty(false, t.number)
    case 'gkPenRight': return penalty(true, t.number)
    case 'highPress': return highPress()
    case 'cornerNear': return cornerNear(t.number)
    case 'counter': return counter(t.number)
    case 'shortBuild': return shortBuild()
  }
}

const ALL: PatternId[] = ['fbLeft', 'fbRight', 'longBall', 'gkPenLeft', 'gkPenRight', 'highPress', 'cornerNear', 'counter', 'shortBuild']

/** Build the session's clips from a report (deterministic for a seed). */
export function buildClips(report: Pick<ScoutReport, 'tendencies'>, seed: number | string): Clip[] {
  const rng = new Rng(`scout:${seed}`)
  const tends = report.tendencies.slice(0, CLIPS)
  const order = rng.shuffle([...tends])
  return order.map((td) => {
    const sc = script(td)
    const textFor = (id: PatternId): LText => {
      const known = report.tendencies.find((x) => x.id === id)
      return patternText(id, known)
    }
    const used = new Set<PatternId>([td.id])
    const wrong: PatternId[] = []
    const mirror = MIRROR[td.id]
    if (mirror && rng.chance(0.7)) { wrong.push(mirror); used.add(mirror) }
    // The other clips' habits are the most tempting distractors.
    const pool = rng.shuffle([...report.tendencies.map((x) => x.id), ...ALL].filter((id, i, a) => a.indexOf(id) === i && !used.has(id) && MIRROR[id] !== td.id))
    while (wrong.length < 2 && pool.length) wrong.push(pool.shift()!)
    const opts = rng.shuffle([td.id, ...wrong]).map((id) => ({ id, text: textFor(id) }))
    return { pattern: td.id, tendency: td, ...sc, options: opts, correct: opts.findIndex((o) => o.id === td.id) }
  })
}

// ───────────────────────── Animation helpers ─────────────────────────

const smooth = (u: number): number => u * u * (3 - 2 * u)

/** Position of an actor at time t (eased between keys). */
export function actorAt(a: ClipActor, t: number): { x: number; y: number; moving: boolean } {
  const k = a.keys
  if (t <= k[0]![0]) return { x: k[0]![1], y: k[0]![2], moving: false }
  for (let i = 1; i < k.length; i++) {
    const p = k[i - 1]!
    const q = k[i]!
    if (t <= q[0]) {
      const u = smooth((t - p[0]) / Math.max(1e-6, q[0] - p[0]))
      return { x: p[1] + (q[1] - p[1]) * u, y: p[2] + (q[2] - p[2]) * u, moving: Math.hypot(q[1] - p[1], q[2] - p[2]) > 0.5 }
    }
  }
  const l = k[k.length - 1]!
  return { x: l[1], y: l[2], moving: false }
}

/** Ball position and height at time t. */
export function ballAt(segs: BallSeg[], t: number): { x: number; y: number; z: number } {
  if (!segs.length) return { x: 34, y: 52.5, z: 0 }
  let last = segs[0]!.from
  for (const s of segs) {
    if (t < s.t0) return { x: last[0], y: last[1], z: 0 }
    if (t <= s.t1) {
      const u = (t - s.t0) / Math.max(1e-6, s.t1 - s.t0)
      const lift = s.lift ?? 0
      return { x: s.from[0] + (s.to[0] - s.from[0]) * u, y: s.from[1] + (s.to[1] - s.from[1]) * u, z: lift * 4 * u * (1 - u) }
    }
    last = s.to
  }
  return { x: last[0], y: last[1], z: 0 }
}

// ───────────────────────── The game ─────────────────────────

export interface ScoutingConfig {
  report: Pick<ScoutReport, 'tendencies' | 'colors' | 'short' | 'name'>
  seed: number | string
}

export class ScoutingGame {
  readonly clips: Clip[]
  readonly colors: KitColors
  readonly answers: ClipAnswer[] = []
  phase: ScoutPhase = 'title'
  index = 0
  /** Seconds in the current phase. */
  t = 0
  /** Total seconds played. */
  time = 0

  constructor(cfg: ScoutingConfig) {
    this.clips = buildClips(cfg.report, cfg.seed)
    this.colors = cfg.report.colors
    if (!this.clips.length) this.phase = 'done'
  }

  get finished(): boolean {
    return this.phase === 'done'
  }

  get clip(): Clip {
    return this.clips[Math.min(this.index, this.clips.length - 1)]!
  }

  /** Animation time inside the current clip (loops with a short pause while waiting). */
  animTime(): number {
    const c = this.clip
    if (this.phase === 'title') return 0
    if (this.phase === 'feedback') return Math.min(c.length, c.reveal + this.t * 0.7)
    if (this.phase === 'done') return c.length
    const loop = c.length + 0.9
    return Math.min(c.length, this.t % loop)
  }

  update(dt: number): void {
    if (this.phase === 'done') return
    const d = Math.max(0, Math.min(0.1, dt))
    this.t += d
    this.time += d
    if (this.phase === 'title' && this.t >= TITLE_TIME) this.go('clip')
    else if (this.phase === 'clip' && this.t >= CLIP_TIMEOUT) {
      this.answers[this.index] = { choice: null, correct: false, score: 0, at: CLIP_TIMEOUT }
      this.go('feedback')
    } else if (this.phase === 'feedback' && this.t >= FEEDBACK_TIME) {
      if (this.index + 1 >= this.clips.length) this.go('done')
      else {
        this.index++
        this.go('title')
      }
    }
  }

  /** The player picks option `i` of the current clip (ignored outside the clip phase). */
  answer(i: number): ClipAnswer | null {
    if (this.phase !== 'clip' || i < 0 || i >= this.clip.options.length) return null
    const c = this.clip
    const at = this.t
    const correct = i === c.correct
    const late = Math.max(0, at - c.reveal) / 4
    const score = correct ? Math.round((0.55 + 0.45 * Math.max(0, 1 - late)) * 1000) / 1000 : 0
    const a: ClipAnswer = { choice: i, correct, score, at: Math.round(at * 100) / 100 }
    this.answers[this.index] = a
    this.go('feedback')
    return a
  }

  private go(p: ScoutPhase): void {
    this.phase = p
    this.t = 0
  }

  frame(): ScoutFrame {
    const c = this.clip
    return {
      phase: this.phase, index: this.index, clip: c, animT: this.animTime(),
      timeLeft: this.phase === 'clip' ? Math.max(0, CLIP_TIMEOUT - this.t) : this.phase === 'title' ? CLIP_TIMEOUT : 0,
      feedback: this.phase === 'feedback' ? Math.min(1, this.t / (FEEDBACK_TIME * 0.6)) : this.phase === 'done' ? 1 : 0,
      answer: this.answers[this.index] ?? null,
    }
  }

  result(): ScoutingResult {
    const n = Math.max(1, this.clips.length)
    const total = this.clips.reduce((a, _c, i) => a + (this.answers[i]?.score ?? 0), 0)
    const performance = Math.round((total / n) * 1000) / 1000
    return {
      performance, grade: scoutGrade(performance),
      spotted: this.clips.filter((_c, i) => this.answers[i]?.correct).map((c) => c.pattern),
      answers: this.clips.map((_c, i) => this.answers[i] ?? { choice: null, correct: false, score: 0, at: CLIP_TIMEOUT }),
      played: Math.round(this.time * 10) / 10,
    }
  }
}
