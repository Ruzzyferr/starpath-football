/**
 * Common machinery for the headless drills: fixed 60 Hz stepping driven by
 * real seconds, a 3-2-1 countdown, the time limit (with a grace period for a
 * ball still in flight), points/combo bookkeeping, events and the result.
 */
import { Rng } from '../../core/rng'
import type { Attributes, Position } from '../../core/types'
import { envForWeather, PHYSICS_DT, type BallState, type PhysicsEnv } from '../physics'
import type { AimAssist } from '../kick'
import { clampN, type Agent, type Team, type Vec2 } from '../model'
import { DRILL_DURATION, gradeFor, performanceFromPoints } from './scoring'
import type {
  ActorRole, ActorView, Drill, DrillConfig, DrillEvent, DrillInput, DrillKind, DrillResult, DrillVariant, DrillView,
} from './types'

export const DT = PHYSICS_DT
/** Countdown before the clock starts (s). */
export const COUNTDOWN = 2.4
/** How long a ball still in flight may run past the buzzer (s). */
const GRACE = 2.5
/** Pause after the final whistle before the drill reports done (s). */
const POST = 1.2

export type DrillPhase = 'countdown' | 'live' | 'grace' | 'post' | 'done'

/** A body on the drill pitch (re-uses the highlight Agent shape so AI/keeper helpers apply). */
export function makeActor(id: string, team: Team, role: Position, pos: Vec2, attrs: Attributes, opts: { hero?: boolean; number?: number; facing?: number } = {}): Agent {
  const facing = opts.facing ?? (team === 'hero' ? 0 : Math.PI)
  return {
    id,
    team,
    number: opts.number ?? (role === 'GK' ? 1 : 10),
    role,
    isHero: !!opts.hero,
    isKeeper: role === 'GK',
    name: id,
    attrs: { ...attrs },
    relationToHero: 0,
    pos: { ...pos },
    vel: { x: 0, y: 0 },
    facing,
    anchor: { ...pos },
    state: 'run',
    stateT: 0,
    z: 0,
    actionDir: { x: 1, y: 0 },
    noTouch: 0,
    think: 0,
    sprint: false,
    stamina: 1,
    intent: null,
    prev: { x: pos.x, y: pos.y, z: 0, facing },
    touch: 0,
    cd: 0,
  }
}

/** Teleport an actor (no interpolation streak). */
export function place(a: Agent, p: Vec2, facing?: number): void {
  a.pos = { ...p }
  a.vel = { x: 0, y: 0 }
  if (facing !== undefined) a.facing = facing
  a.prev = { x: p.x, y: p.y, z: 0, facing: a.facing }
  a.z = 0
  a.state = 'run'
  a.stateT = 0
}

export function actorView(a: Agent, role: ActorRole, highlight = false): ActorView {
  return { id: a.id, role, x: a.pos.x, y: a.pos.y, z: a.z, facing: a.facing, state: a.state, stateT: a.stateT, number: a.number, ...(highlight ? { highlight } : {}) }
}

/** Snapshot of the previous step for render interpolation. */
export function snapPrev(agents: readonly Agent[]): void {
  for (const a of agents) {
    a.prev.x = a.pos.x
    a.prev.y = a.pos.y
    a.prev.z = a.z
    a.prev.facing = a.facing
  }
}

export abstract class DrillBase implements Drill {
  readonly kind: DrillKind
  readonly duration: number
  readonly variant: DrillVariant
  readonly attrs: Attributes
  readonly assist: AimAssist
  readonly difficulty: number
  readonly env: PhysicsEnv
  protected readonly rng: Rng

  phase: DrillPhase = 'countdown'
  /** Live seconds elapsed (the drill clock). */
  clock = 0
  /** Total game seconds stepped (countdown included). */
  time = 0
  points = 0
  combo = 0
  bestCombo = 0
  readonly stats: Record<string, number> = {}

  protected readonly events: DrillEvent[] = []
  private acc = 0
  private countdownLeft = COUNTDOWN
  private graceLeft = GRACE
  private postLeft = POST
  /** Interpolation factor between the previous and the current step. */
  alpha = 0

  constructor(kind: DrillKind, cfg: DrillConfig) {
    this.kind = kind
    this.duration = DRILL_DURATION[kind]
    this.variant = cfg.variant ?? 'standard'
    this.attrs = { ...cfg.attrs }
    this.assist = cfg.aimAssist ?? 'half'
    this.difficulty = clampN(cfg.difficulty ?? 1, 0.7, 1.4)
    this.rng = new Rng(typeof cfg.seed === 'number' ? cfg.seed : `drill:${kind}:${cfg.seed}`)
    this.env = envForWeather(cfg.weather ?? 'clear', { x: 0.2, y: 1 })
  }

  get finished(): boolean {
    return this.phase === 'done'
  }

  get timeLeft(): number {
    return Math.max(0, this.duration - this.clock)
  }

  /** Seconds left in the 3-2-1 countdown (0 once live). */
  get countdown(): number {
    return this.phase === 'countdown' ? this.countdownLeft : 0
  }

  /** True while the hero may act. */
  get live(): boolean {
    return this.phase === 'live' || this.phase === 'grace'
  }

  update(realDt: number, input: DrillInput): void {
    if (this.phase === 'done') return
    this.acc += clampN(realDt, 0, 0.1)
    let n = 0
    let inp = input
    while (this.acc >= DT && n < 8) {
      this.step(inp)
      // Discrete actions are consumed by the first step only.
      if (inp.actions.length) inp = { ...inp, actions: [] }
      this.acc -= DT
      n++
      if ((this.phase as DrillPhase) === 'done') break
    }
    if (n === 8) this.acc = 0
    this.alpha = clampN(this.acc / DT, 0, 1)
  }

  /** One fixed step (tests may call it directly). */
  step(input: DrillInput): void {
    this.time += DT
    this.beforeStep()
    switch (this.phase) {
      case 'countdown':
        this.countdownLeft -= DT
        this.tick(DT, { ...input, actions: [] }, false)
        if (this.countdownLeft <= 0) {
          this.phase = 'live'
          this.events.push({ type: 'go' }, { type: 'whistle', long: false })
          this.onStart()
        }
        return
      case 'live':
        this.clock = Math.min(this.duration, this.clock + DT)
        this.tick(DT, input, true)
        if (this.forceEnd()) return this.end()
        if (this.clock >= this.duration) {
          if (this.busy()) this.phase = 'grace'
          else this.end()
        }
        return
      case 'grace':
        this.graceLeft -= DT
        this.tick(DT, { ...input, actions: [] }, false)
        if (!this.busy() || this.graceLeft <= 0) this.end()
        return
      case 'post':
        this.tick(DT, { ...input, actions: [] }, false)
        this.postLeft -= DT
        if (this.postLeft <= 0) this.phase = 'done'
        return
      case 'done':
        return
    }
  }

  private end(): void {
    if (this.phase === 'post' || this.phase === 'done') return
    this.phase = 'post'
    this.onEnd()
    this.events.push({ type: 'whistle', long: true }, { type: 'end' })
  }

  drainEvents(): DrillEvent[] {
    return this.events.splice(0, this.events.length)
  }

  result(): DrillResult {
    const performance = performanceFromPoints(this.kind, this.points)
    return {
      kind: this.kind,
      points: Math.max(0, Math.round(this.points)),
      performance,
      grade: gradeFor(performance),
      stats: { ...this.stats, bestCombo: this.bestCombo },
      played: Math.round(this.clock * 10) / 10,
    }
  }

  // ───────────────────────── Helpers for subclasses ─────────────────────────

  protected stat(key: string, by = 1): void {
    this.stats[key] = (this.stats[key] ?? 0) + by
  }

  /** Award points (already multiplied) and update the streak. */
  protected award(points: number, success: boolean, ev: Omit<Extract<DrillEvent, { type: 'score' }>, 'type' | 'points' | 'good'>): void {
    this.points = Math.max(0, this.points + points)
    if (success) {
      this.combo++
      this.bestCombo = Math.max(this.bestCombo, this.combo)
    } else {
      this.combo = 0
    }
    this.events.push({ type: 'score', points, good: success, ...ev })
  }

  protected ballView(b: BallState | null): DrillView['ball'] {
    return b ? { x: b.x, y: b.y, z: b.z, speed: Math.hypot(b.vx, b.vy, b.vz) } : null
  }

  // ───────────────────────── Subclass hooks ─────────────────────────

  /** Called at the start of every step (snapshot prev positions). */
  protected abstract beforeStep(): void
  /** Advance the world one step. `live` = the hero may act and points count. */
  protected abstract tick(dt: number, input: DrillInput, live: boolean): void
  /** True while an attempt is still resolving (keeps the drill alive past the buzzer). */
  protected abstract busy(): boolean
  protected onStart(): void {}
  protected onEnd(): void {}
  /** Early finish (e.g. failing the beep test). */
  protected forceEnd(): boolean {
    return false
  }
  abstract view(): DrillView
}
