/**
 * HighlightRuntime — the renderer-independent core loop of an interactive
 * highlight ("An"). Owns agents, ball, AI, rules, outcome resolution, bullet
 * time and the replay buffer. MatchScene only renders its state and feeds it
 * input; headless tests drive it directly.
 *
 * Time: the runtime is advanced with real seconds via {@link HighlightRuntime.update};
 * internally it runs fixed 60 Hz steps of *game* time, scaled by bullet time.
 * {@link HighlightRuntime.alpha} gives the interpolation factor between the
 * previous and current step for smooth rendering in slow motion.
 */
import { Rng } from '../core/rng'
import type { Difficulty } from '../core/types'
import type { Highlight, HighlightKind, HighlightOutcome, HighlightResult, Weather } from '../sim/match/types'
import { GOAL_HEIGHT, PITCH_LENGTH, PITCH_WIDTH } from '../sim/match/types'
import {
  DIVE_PEAK,
  DIVE_TIME,
  KEEPER_REACH,
  arrive,
  attackDir,
  cardForFoul,
  carrierDecision,
  catchChance,
  defendTargets,
  diveSpeed,
  inField,
  interceptPoint,
  isBehind,
  keeperReaction,
  keeperTarget,
  other,
  ownGoalX,
  planSave,
  pressTarget,
  saveChance,
  separation,
  shouldClaimCross,
  skillBeatChance,
  supportTarget,
  tackleOdds,
  type AiWorld,
  type DefendAssignment,
} from './ai'
import {
  applyKick,
  crossZones,
  interpretSwipe,
  laneOpenness,
  rankPassOptions,
  type CrossZone,
  leadPosition,
  pickPassTarget,
  planKick,
  shotTargetFromDir,
  type AimAssist,
  type KickKind,
  type KickPlan,
  type PassCandidate,
  type SwipeFeatures,
} from './kick'
import {
  BALL_RADIUS,
  GOAL_CENTER_Y,
  PHYSICS_DT,
  createTracker,
  envForWeather,
  predictPlaneCrossing,
  predictTrajectory,
  stepBall,
  type BallState,
  type BallTracker,
  type PhysicsEnv,
  type PhysicsEvent,
  type TrajectoryPoint,
} from './physics'
import { offsideSnapshot } from './offside'
import { ASSIST_REWARD } from '../sim/match/rating'
import { evaluateCarrier, passLead, reactionTime, runTarget, shotTarget, takeOnChance } from './tactics'
import { buildCast, isDefendingKind, isKeeperKind, type SetPiece } from './setup'
import {
  a01,
  accel,
  add,
  angleDiff,
  clamp01,
  clampN,
  dist,
  dot,
  fromAngle,
  len,
  norm,
  pointSegment,
  scale,
  sub,
  topSpeed,
  type Agent,
  type AgentState,
  type Team,
  type Vec2,
} from './model'

// ── Match-feel tuning (measured with feel.test.ts; see docs/BALANCE.md) ──
/** Hero shot accuracy noise on top of attributes/difficulty: swipes are imprecise (was 1, i.e. almost nothing missed the frame). */
export const HERO_SHOT_NOISE = 1.5
/** Extra noise on hero headers (corner headers converted ~45% before). */
export const HERO_HEADER_NOISE = 1.3
/** Flat extra save probability on every keeper contact with a shot. */
export const KEEPER_SAVE_BONUS = 0.08
/** Base chance an AI keeper reads a penalty's side (before positioning/difficulty). Was 0.2. */
export const PENALTY_READ_BASE = 0.22
/** A diving keeper's body extends this far (m) behind his centre, opposite the dive (legs/torso): an over-dive no longer lets the ball through the body. */
export const DIVE_BODY_BACK = 0.7
/** Dive reach of opposition keepers facing the hero (m): a touch under {@link KEEPER_REACH} so 1v1 finishing lands ~38–40% (docs/BALANCE.md). */
export const OPP_KEEPER_REACH = 0.75
const keeperReach = (k: Pick<Agent, 'team'>): number => (k.team === 'opp' ? OPP_KEEPER_REACH : KEEPER_REACH)
/** Balls within 0.55 m of the keeper below this height are taken standing (was 1.7: keepers flung themselves past head-high shots). */
export const KEEPER_STAND_MAX_Z = 2.2
/** One-two: after a hero pass, a second tap within this many seconds asks the receiver to return it. */
export const ONE_TWO_WINDOW = 2.2
/** An armed one-two the receiver could not play is dropped after this long. */
export const ONE_TWO_ARMED_MAX = 3

/** Difficulty label → opponent sharpness multiplier. */
export const DIFFICULTY_SCALE: Record<Difficulty, number> = { easy: 0.85, normal: 1, hard: 1.15, legend: 1.3 }

export interface RuntimeOptions {
  aimAssist?: AimAssist
  /** Enable bullet-time aiming windows. */
  slowMoAim?: boolean
  /** Label or numeric multiplier (0.8 … 1.3). */
  difficulty?: Difficulty | number
  weather?: Weather
  /** Overrides the RNG seed (defaults to a hash of the highlight id). */
  seed?: number
  /** Display names by player id. */
  names?: Record<string, string>
  /** 0..1 match importance — raises penalty panic. */
  importance?: number
  /** Accessibility: multiplies timing windows (bullet time, one-two). 1 = off. */
  timingMult?: number
}

/** Continuous hero input, in pitch space. */
export interface HeroControl {
  /** Desired movement, length ≤ 1. */
  move: Vec2
  sprint: boolean
}

/** Discrete hero intents (already converted to pitch space). */
export type HeroAction =
  | { kind: 'swipe'; swipe: SwipeFeatures }
  | { kind: 'tapAt'; at: Vec2 }
  | { kind: 'shoot'; target: Vec2; power: number; curl: number; chip: boolean }
  | { kind: 'pass'; target?: Vec2; dir?: Vec2; through?: boolean; lofted?: boolean }
  | { kind: 'skill' }
  | { kind: 'action' }
  | { kind: 'dive'; dir: Vec2 }

/** Live aim state (while the player drags / holds) for previews. */
export type AimState =
  | { kind: 'swipe'; swipe: SwipeFeatures }
  | { kind: 'target'; target: Vec2; power: number; curl: number; chip: boolean }

/** Events for renderer / audio / haptics. */
export type RuntimeEvent =
  | { type: 'kick'; by: string; hero: boolean; kick: KickKind; power: number; speed: number; x: number; y: number }
  | { type: 'touch'; by: string; hero: boolean; x: number; y: number }
  | { type: 'dribble'; by: string }
  | { type: 'bounce'; speed: number; x: number; y: number }
  | { type: 'post'; speed: number; x: number; y: number; z: number }
  | { type: 'bar'; speed: number; x: number; y: number; z: number }
  | { type: 'net'; speed: number; end: 'west' | 'east' }
  | { type: 'goal'; team: Team; scorerId: string; end: 'west' | 'east' }
  | { type: 'save'; by: string; held: boolean; x: number; y: number; z: number }
  | { type: 'block'; by: string; x: number; y: number }
  | { type: 'tackle'; by: string; won: boolean; slide: boolean; x: number; y: number }
  | { type: 'foul'; by: string; on: string; card?: 'yellow' | 'red' }
  | { type: 'whistle'; long: boolean }
  | { type: 'skill'; by: string; success: boolean }
  | { type: 'jump'; by: string }
  | { type: 'dive'; by: string }
  | { type: 'header'; by: string }
  | { type: 'bullet'; on: boolean }
  | { type: 'out'; x: number; y: number }
  | { type: 'callForBall'; by: string }
  /** One-two armed: `by` (the receiver of the hero's pass) will return it into the hero's run. */
  | { type: 'oneTwo'; by: string }
  /** Assistant referee's flag: `by` touched the ball from an offside position. */
  | { type: 'offside'; by: string; team: Team; x: number; y: number }
  | { type: 'end'; result: HighlightResult; reason: string }

export type Phase = 'intro' | 'live' | 'post' | 'done'

/** One recorded replay frame. Agents are packed as [x, y, z, facing, stateCode] × n. */
export interface ReplayFrame {
  t: number
  bx: number
  by: number
  bz: number
  agents: Float32Array
}

export const STATE_CODES: readonly AgentState[] = ['run', 'slide', 'dive', 'jump', 'down', 'celebrate', 'skill', 'wall']

const DT = PHYSICS_DT
const REPLAY_SECONDS = 6
const SHOT_KINDS: ReadonlySet<KickKind> = new Set<KickKind>(['shot', 'chip', 'header', 'penalty', 'freekick'])
/** Deliveries that can put a team-mate offside (shots/clearances cannot). */
const PASS_KINDS: ReadonlySet<KickKind> = new Set<KickKind>(['pass', 'lofted', 'through', 'cross'])

interface ShotTrack {
  by: Agent
  kind: KickKind
  t: number
  woodwork: boolean
  blocked: boolean
  parried: boolean
  /** Keeper ids that already failed a save roll on this shot. */
  beaten: Set<string>
  /** Hero passed to the shooter right before (assist candidate). */
  assistBy: string | null
}

interface KeeperAlert {
  keeper: Agent
  at: number
  penaltyGuess?: { read: boolean; centre: boolean }
}

/**
 * Interactive highlight simulation.
 * @example
 * const rt = new HighlightRuntime(highlight, { aimAssist: 'full', slowMoAim: true })
 * rt.queueAction({ kind: 'shoot', target: { x: 105, y: 32 }, power: 0.8, curl: 0, chip: false })
 * while (!rt.finished) rt.update(1 / 60)
 */
export class HighlightRuntime {
  readonly highlight: Highlight
  readonly kind: HighlightKind
  readonly agents: Agent[]
  readonly hero: Agent
  readonly ball: BallState
  readonly prevBall = { x: 0, y: 0, z: 0 }
  readonly env: PhysicsEnv
  readonly assist: AimAssist
  readonly slowMoAim: boolean
  readonly difficulty: number
  readonly defending: boolean
  readonly timeLimit: number
  readonly importance: number
  readonly timingMult: number

  owner: Agent | null = null
  setPiece: SetPiece | null
  phase: Phase = 'intro'
  /** Game seconds since start. */
  time = 0
  /** Real seconds since start. */
  realTime = 0
  /** Current time scale (bullet time eases toward its target). */
  timeScale = 1
  /** Interpolation factor between previous and current step. */
  alpha = 0
  result: HighlightResult | null = null
  endReason = ''
  /** Game time of the goal (for replay). */
  goalTime = -1
  /** Live aim for previews. */
  aim: AimState | null = null

  private readonly rng: Rng
  private readonly tracker: BallTracker
  private readonly control: HeroControl = { move: { x: 0, y: 0 }, sprint: false }
  private readonly actions: HeroAction[] = []
  private readonly events: RuntimeEvent[] = []
  private readonly frames: ReplayFrame[] = []
  private readonly stats = { passes: 0, passesCompleted: 0, shots: 0, shotsOnTarget: 0, dribbles: 0, tackles: 0 }
  private card: 'yellow' | 'red' | undefined
  private injured = false
  private acc = 0
  private introLeft: number
  private postLeft = 0
  private ownerSince = 0
  private lastTouch: Agent | null = null
  private lastPossTeam: Team
  private shot: ShotTrack | null = null
  private heroPassTo: { id: string; t: number } | null = null
  private assistChain: string | null = null
  private keeperAlert: KeeperAlert | null = null
  private bulletLeft = 0
  private bulletScale = 0.25
  private lossT = 0
  private oppClearedAt = -1
  private heroRequest: { at: Vec2 | null; t: number } | null = null
  private heroHeaderAim: Vec2 | null = null
  private heroTackleResolved = false
  private ballX0: number
  private defendCache: { t: number; team: Team; map: Map<string, DefendAssignment> } | null = null
  private penaltyPlan: { target: Vec2; z: number; runStart: number } | null = null
  private crossBulletArmed = false
  private readonly physEvents: PhysicsEvent[] = []
  private lastTouchBefore: Agent | null = null
  private readonly wallIds: Set<string>
  /** Defensive moment: the opponents got a shot away that the hero did not block or win back. */
  private oppShotFree = false
  /** Game time of the hero's last delivery (pass/cross); −1 once a team-mate took possession otherwise. */
  private heroDeliveryAt = -1
  /** The hero has had the ball under control this moment. */
  private heroControlled = false
  /** Hero positions sampled twice a second (heat map). */
  private readonly track: Vec2[] = []
  /** Hero shots this moment (shot map). */
  private readonly shotLog: NonNullable<HighlightResult['shotLog']> = []
  /** Team-mates of the last passer who were offside when the ball was played. */
  private offsideSnap: { team: Team; ids: Set<string> } | null = null
  /** One-two: the hero just passed to `id`; `armed` once the hero tapped again (return into his run). */
  private oneTwo: { id: string; t: number; armed: boolean; armedAt: number } | null = null
  /** Vision pass options cache (ids, best first). */
  private passOpts: { t: number; ids: string[] } = { t: -1, ids: [] }

  constructor(highlight: Highlight, opts: RuntimeOptions = {}) {
    this.highlight = highlight
    this.kind = highlight.scenario.kind ?? highlight.kind
    this.rng = new Rng(opts.seed ?? `hl:${highlight.id}`)
    const cast = buildCast(highlight, this.rng.fork('cast'), opts.names)
    this.agents = cast.agents
    this.hero = cast.hero
    this.setPiece = cast.setPiece
    this.wallIds = new Set(cast.setPiece?.wall ?? [])
    this.defending = cast.defending
    this.ball = { x: cast.ball.x, y: cast.ball.y, z: cast.ball.z, vx: cast.ball.vx, vy: cast.ball.vy, vz: 0, spin: { side: 0, top: 0 } }
    Object.assign(this.prevBall, { x: this.ball.x, y: this.ball.y, z: this.ball.z })
    this.owner = cast.ownerId ? this.agents.find((a) => a.id === cast.ownerId) ?? null : null
    this.lastTouch = this.owner
    this.lastPossTeam = this.owner ? this.owner.team : this.defending ? 'opp' : 'hero'
    this.ballX0 = this.ball.x
    this.env = envForWeather(opts.weather ?? 'clear', fromAngle(this.rng.range(0, Math.PI * 2)))
    this.tracker = createTracker()
    this.assist = opts.aimAssist ?? 'full'
    this.slowMoAim = opts.slowMoAim ?? true
    const d = opts.difficulty ?? 'normal'
    this.difficulty = typeof d === 'number' ? clampN(d, 0.6, 1.5) : DIFFICULTY_SCALE[d]
    this.timeLimit = Math.max(3, highlight.scenario.timeLimit || 10)
    this.importance = clamp01(opts.importance ?? 0.5)
    this.timingMult = clampN(opts.timingMult ?? 1, 1, 2)
    this.introLeft = this.setPiece ? 0.7 : 0.35
    this.events.push({ type: 'whistle', long: false })
    // Stagger AI thinking so they don't all decide on the same frame.
    for (const a of this.agents) a.think = this.rng.range(0.05, 0.3)
  }

  // ───────────────────────── Public API ─────────────────────────

  /** True once the moment and its post-roll are over. */
  get finished(): boolean {
    return this.phase === 'done'
  }

  /** Seconds remaining (game time). */
  get timeLeft(): number {
    return Math.max(0, this.timeLimit - this.time)
  }

  /** True while slow motion is (mostly) active. */
  get bulletActive(): boolean {
    return this.bulletLeft > 0
  }

  /** Remaining fraction of the current bullet-time window (0..1). */
  bulletFrac = 0

  /** True when the hero is on the ball (or is the set-piece taker). */
  get heroOnBall(): boolean {
    return this.owner === this.hero || (this.setPiece?.takerId === this.hero.id && this.phase !== 'post' && this.phase !== 'done')
  }

  /** True when the hero is the goalkeeper in this moment. */
  get heroIsKeeper(): boolean {
    return this.hero.isKeeper
  }

  /** Sets continuous movement input. */
  setControl(c: HeroControl): void {
    this.control.move = len(c.move) > 1 ? norm(c.move) : { ...c.move }
    this.control.sprint = c.sprint
  }

  /** Queues a discrete action (processed on the next step). */
  queueAction(a: HeroAction): void {
    if (this.actions.length < 8) this.actions.push(a)
  }

  /** Returns and clears pending events. */
  drainEvents(): RuntimeEvent[] {
    return this.events.splice(0, this.events.length)
  }

  /** Replay frames (oldest first) covering the last {@link REPLAY_SECONDS}. */
  replayFrames(): readonly ReplayFrame[] {
    return this.frames
  }

  /**
   * Panic aim offset (pitch meters at the goal line) for set pieces when the
   * hero's composure is low. Deterministic in time, also used by the renderer
   * to shake the aim reticle.
   */
  panicOffset(): { y: number; z: number } {
    if (!this.setPiece || this.setPiece.takerId !== this.hero.id) return { y: 0, z: 0 }
    const comp = a01(this.hero.attrs.composure)
    const amp = clamp01((0.75 - comp) / 0.75) * (0.6 + this.importance * 0.8) * (this.setPiece.kind === 'penalty' ? 1.3 : 0.8)
    const t = this.realTime
    return { y: amp * (Math.sin(t * 9.1) + 0.6 * Math.sin(t * 15.7 + 1.3)), z: amp * 0.5 * Math.sin(t * 7.3 + 0.4) }
  }

  /**
   * One-two prompt for the renderer: the team-mate who would return the ball
   * (`armed` once requested). Null when no one-two is available.
   */
  oneTwoHint(): { id: string; armed: boolean } | null {
    const o = this.oneTwo
    if (!o || this.phase !== 'live' || this.owner === this.hero) return null
    if (!o.armed && this.time - o.t > ONE_TWO_WINDOW * this.timingMult) return null
    return { id: o.id, armed: o.armed }
  }

  /**
   * Best pass options the hero "sees" (ids, best first), refreshed every
   * 0.15 s of game time. Count and scan range grow with Vision. Empty when the
   * hero is not on the ball.
   */
  passOptions(): readonly string[] {
    if (!this.heroOnBall || this.hero.isKeeper || this.phase !== 'live' || this.setPiece?.kind === 'penalty') return []
    if (this.passOpts.t >= 0 && this.time - this.passOpts.t < 0.15) return this.passOpts.ids
    const opp = this.agents.filter((a) => a.team === 'opp').map((a) => a.pos)
    const ids = rankPassOptions({ x: this.ball.x, y: this.ball.y }, this.hero.attrs.vision ?? 50, this.passCandidates(), opp)
    this.passOpts = { t: this.time, ids }
    return ids
  }

  /**
   * Predicted trajectory for the current aim (noiseless), for the dotted preview line.
   * Returns null when the hero cannot kick.
   */
  preview(aim: AimState | null = this.aim): { points: TrajectoryPoint[]; kind: KickKind; power: number; target: Vec2 } | null {
    if (!aim || !this.heroOnBall) return null
    const kick = this.resolveHeroKick(aim.kind === 'swipe' ? { kind: 'swipe', swipe: aim.swipe } : { ...aim, kind: 'shoot' }, true)
    if (!kick) return null
    const b: BallState = { x: this.ball.x, y: this.ball.y, z: this.ball.z, vx: kick.plan.vx, vy: kick.plan.vy, vz: kick.plan.vz, spin: { ...kick.plan.spin } }
    const points = predictTrajectory(b, this.env, { duration: SHOT_KINDS.has(kick.kind) ? 1.4 : 2.2, sampleEvery: 3, stopOnEnd: true })
    return { points, kind: kick.kind, power: kick.power, target: kick.plan.aim }
  }

  /**
   * Advances the simulation by `realDt` seconds of wall time.
   * Bullet time scales the game time that elapses.
   */
  update(realDt: number): void {
    if (this.phase === 'done') return
    const rdt = clampN(realDt, 0, 0.1)
    this.realTime += rdt
    if (this.bulletLeft > 0) {
      this.bulletLeft -= rdt
      if (this.bulletLeft <= 0) {
        this.bulletLeft = 0
        this.events.push({ type: 'bullet', on: false })
      }
    }
    const target = this.bulletLeft > 0 ? this.bulletScale : 1
    this.timeScale += (target - this.timeScale) * (1 - Math.exp(-rdt * (target < this.timeScale ? 14 : 6)))
    this.bulletFrac = this.bulletLeft > 0 ? this.bulletLeft / this.bulletWindow : 0
    this.acc += rdt * this.timeScale
    let n = 0
    while (this.acc >= DT && n < 8) {
      this.step()
      this.acc -= DT
      n++
      if ((this.phase as Phase) === 'done') break
    }
    if (n === 8) this.acc = 0
    this.alpha = clamp01(this.acc / DT)
  }

  /** Runs one fixed step regardless of time scale (tests). */
  stepOnce(): void {
    this.step()
  }

  /** Builds the HighlightResult for an outcome with current micro-stats. */
  buildResult(outcome: HighlightOutcome, extra: Partial<HighlightResult> = {}): HighlightResult {
    const r: HighlightResult = { outcome, ...this.stats, ...extra }
    r.assistMult = ASSIST_REWARD[this.assist]
    if (this.track.length) r.track = this.track.map((p) => ({ ...p }))
    if (this.shotLog.length) {
      const last = this.shotLog[this.shotLog.length - 1]
      if (outcome === 'goal' || outcome === 'saved' || outcome === 'missed' || outcome === 'blocked' || outcome === 'woodwork') last.outcome = outcome
      r.shotLog = this.shotLog.map((x) => ({ ...x, outcome: x.outcome ?? 'missed' }))
    }
    if (this.card) r.card = this.card
    if (this.injured) r.injured = true
    return r
  }

  // ───────────────────────── Core step ─────────────────────────

  private bulletWindow = 1

  private step(): void {
    this.time += DT
    for (const a of this.agents) {
      a.prev.x = a.pos.x
      a.prev.y = a.pos.y
      a.prev.z = a.z
      a.prev.facing = a.facing
    }
    this.prevBall.x = this.ball.x
    this.prevBall.y = this.ball.y
    this.prevBall.z = this.ball.z

    if (this.phase === 'intro') {
      this.introLeft -= DT
      if (this.introLeft <= 0) this.goLive()
    }

    if (this.oneTwo && (this.oneTwo.armed ? this.time - this.oneTwo.armedAt > ONE_TWO_ARMED_MAX : this.time - this.oneTwo.t > ONE_TWO_WINDOW * this.timingMult)) this.oneTwo = null
    if (this.phase === 'live') {
      while (this.actions.length) this.handleAction(this.actions.shift()!)
      this.setPieceAI()
    } else {
      this.actions.length = 0
    }

    this.moveHero()
    for (const a of this.agents) if (!a.isHero) this.thinkAndSteer(a)
    for (const a of this.agents) this.integrateAgent(a)

    this.updateBall()
    if (this.phase === 'live') {
      if (!this.owner && !this.tracker.inGoal && !this.tracker.out) this.contacts()
      this.duels()
      this.keeperLogic()
      this.checkEnd()
    }
    this.record()
    if (this.phase === 'live' && Math.round(this.time / DT) % 30 === 0) this.track.push({ x: Math.round(this.hero.pos.x * 10) / 10, y: Math.round(this.hero.pos.y * 10) / 10 })

    if (this.phase === 'post') {
      this.postLeft -= DT
      if (this.postLeft <= 0) this.phase = 'done'
    }
  }

  private goLive(): void {
    this.phase = 'live'
    if (this.owner === this.hero) this.startBullet(0.25, this.possessionWindow())
    if (this.kind === 'rebound') this.startBullet(0.45, 0.45 + a01(this.hero.attrs.composure) * 0.3)
    if (this.kind === 'long_ball_control') this.longBall()
  }

  /** long_ball_control: the deep team-mate hits a long diagonal toward the hero's feet/chest. */
  private longBall(): void {
    const by = this.owner
    if (!by || by.isHero || by.team !== 'hero') return
    const heroC = { id: this.hero.id, pos: this.hero.pos, vel: this.hero.vel }
    // Played into the space in front of him (away from the marker on his back), dropping to his chest/feet.
    const from = { x: this.ball.x, y: this.ball.y }
    const lead = leadPosition(from, heroC, 16, 2)
    const back = norm(sub(from, lead))
    const target = add(lead, scale(back, 1.6))
    const plan = planKick({ kind: 'lofted', from, target, targetZ: 0.7, power: 0.75, curl: 0, attrs: by.attrs, pressure: 0, assist: 'manual', env: this.env, noiseScale: 0.9 }, this.rng)
    this.kickBall(by, plan, 'lofted', 0.75, this.hero.id)
  }

  // ───────────────────────── Bullet time ─────────────────────────

  private possessionWindow(): number {
    return 0.85 + a01(this.hero.attrs.composure) * 1.35
  }

  private startBullet(scale: number, seconds: number): void {
    if (!this.slowMoAim) return
    seconds *= this.timingMult
    this.bulletScale = scale
    this.bulletLeft = seconds
    this.bulletWindow = seconds
    this.events.push({ type: 'bullet', on: true })
  }

  private stopBullet(): void {
    if (this.bulletLeft > 0) {
      this.bulletLeft = 0
      this.events.push({ type: 'bullet', on: false })
    }
  }

  // ───────────────────────── Hero input ─────────────────────────

  private heroBusy(): boolean {
    const s = this.hero.state
    return s === 'slide' || s === 'dive' || s === 'down'
  }

  private handleAction(act: HeroAction): void {
    const hero = this.hero
    if (this.heroBusy()) return
    if (hero.isKeeper && this.owner !== hero) {
      this.keeperAction(act)
      return
    }
    if (this.heroOnBall) {
      if (act.kind === 'skill') return this.skillMove()
      const k = this.resolveHeroKick(act, false)
      if (k) this.kickBall(hero, k.plan, k.kind, k.power, k.passTo)
      return
    }
    this.offBallAction(act)
  }

  /** Converts a hero action into a concrete kick (or null if not a kick). */
  private resolveHeroKick(
    act: HeroAction,
    preview: boolean,
  ): { plan: KickPlan; kind: KickKind; power: number; passTo: string | null } | null {
    const hero = this.hero
    const from = { x: this.ball.x, y: this.ball.y }
    const mates = this.passCandidates()
    const opp = this.agents.filter((a) => a.team === 'opp').map((a) => a.pos)
    const pressure = this.pressureOn(hero)
    const sp = this.setPiece && this.setPiece.takerId === hero.id ? this.setPiece : null
    const rng = preview ? undefined : this.rng
    const base = { from, fromZ: this.ball.z, attrs: hero.attrs, pressure, assist: this.assist, env: this.env, assistPull: this.assistPull() }

    const shot = (target: Vec2, power: number, curl: number, chip: boolean) => {
      const kind: KickKind = chip ? 'chip' : sp?.kind === 'penalty' ? 'penalty' : sp?.kind === 'freekick' ? 'freekick' : 'shot'
      let t = { ...target }
      let tz: number | undefined
      if (sp) {
        // Low composure: the aim trembles (also visible on the reticle).
        const p = this.panicOffset()
        t = { x: t.x, y: t.y + p.y }
      }
      if (kind === 'chip') {
        tz = 1.5
        t = { x: PITCH_LENGTH + 0.3, y: t.y }
      }
      const plan = planKick({ ...base, kind, target: t, targetZ: tz, power, curl, noiseScale: this.noiseScale() * HERO_SHOT_NOISE }, rng)
      return { plan, kind, power, passTo: null }
    }
    const pass = (to: PassCandidate, lofted: boolean, power: number) => {
      const target = leadPosition(from, to, lofted ? 17 : 13)
      const kind: KickKind = lofted ? 'lofted' : 'pass'
      const plan = planKick({ ...base, kind, target, power, curl: 0, noiseScale: this.noiseScale() }, rng)
      return { plan, kind, power, passTo: to.id }
    }
    const through = (point: Vec2, lofted: boolean, power: number) => {
      const kind: KickKind = lofted ? 'lofted' : 'through'
      const plan = planKick({ ...base, kind, target: inField(point, 1), power, curl: 0, noiseScale: this.noiseScale() }, rng)
      return { plan, kind, power, passTo: null }
    }

    switch (act.kind) {
      case 'shoot':
        return shot(act.target, act.power, act.curl, act.chip)
      case 'swipe': {
        const sw = act.swipe
        if (sw.isTap) return null
        if (sp && sp.kind === 'penalty') return shot(shotTargetFromDir(from, sw.dir), sw.power, sw.curl * 0.6, sw.chip)
        const m = interpretSwipe(sw, from, mates, opp, this.assist)
        switch (m.kind) {
          case 'shot':
            return shot(shotTargetFromDir(from, sw.dir), sw.power, sw.curl, m.chip)
          case 'pass':
            return pass(m.to, m.lofted, sw.power)
          case 'through':
            return through(m.point, m.lofted, sw.power)
          case 'cross': {
            if (m.zone?.ground) {
              // Cut-back: a firm pass along the floor to the edge of the box.
              const plan = planKick({ ...base, kind: 'through', target: m.point, power: 0.7, curl: 0, noiseScale: this.noiseScale() }, rng)
              return { plan, kind: 'through' as KickKind, power: 0.7, passTo: null }
            }
            const plan = planKick({ ...base, kind: 'cross', target: m.point, targetZ: m.zone?.z ?? 1.8, power: sw.power, curl: sw.curl * 0.7, noiseScale: this.noiseScale() }, rng)
            return { plan, kind: 'cross' as KickKind, power: sw.power, passTo: null }
          }
        }
        return null
      }
      case 'tapAt': {
        const mate = mates.filter((m) => dist(m.pos, act.at) < 3.2).sort((p, q) => dist(p.pos, act.at) - dist(q.pos, act.at))[0]
        if (mate) return pass(mate, dist(from, mate.pos) > 30, 0.6)
        // Tap inside the goal mouth area → placed shot.
        if (act.at.x > PITCH_LENGTH - 3 && Math.abs(act.at.y - GOAL_CENTER_Y) < 6) return shot({ x: PITCH_LENGTH, y: act.at.y }, 0.75, 0, false)
        return through(act.at, dist(from, act.at) > 28, 0.6)
      }
      case 'pass': {
        if (act.target) {
          const mate = mates.filter((m) => dist(m.pos, act.target!) < 3.5).sort((p, q) => dist(p.pos, act.target!) - dist(q.pos, act.target!))[0]
          if (mate && !act.through) return pass(mate, act.lofted ?? dist(from, mate.pos) > 30, 0.6)
          return through(act.target, act.lofted ?? false, 0.65)
        }
        const dir = act.dir && len(act.dir) > 0.2 ? norm(act.dir) : fromAngle(hero.facing)
        if (act.through) {
          const ahead = mates.filter((m) => dot(norm(sub(m.pos, from)), dir) > 0.5).sort((p, q) => q.pos.x - p.pos.x)[0]
          const point = ahead ? add(leadPosition(from, ahead, 14), scale(dir, 5)) : add(from, scale(dir, 18))
          return through(point, act.lofted ?? false, 0.7)
        }
        const mate = pickPassTarget(from, dir, mates, opp, this.assist === 'manual' ? 'half' : this.assist)
        if (mate) return pass(mate, act.lofted ?? dist(from, mate.pos) > 30, 0.6)
        return through(add(from, scale(dir, 14)), act.lofted ?? false, 0.6)
      }
      case 'action': {
        // Quick contextual play: shoot if facing goal in range, else pass forward.
        const toGoal = sub({ x: PITCH_LENGTH, y: GOAL_CENTER_Y }, from)
        if (len(toGoal) < 22) return shot({ x: PITCH_LENGTH, y: GOAL_CENTER_Y + (this.rng.chance(0.5) ? 2 : -2) }, 0.8, 0, false)
        const mate = pickPassTarget(from, fromAngle(hero.facing), mates, opp, 'full')
        if (mate) return pass(mate, false, 0.6)
        return null
      }
      default:
        return null
    }
  }

  /** Easy mode keeps aim assist generous (pulls most of a miss back toward the frame). */
  private assistPull(): number | undefined {
    if (this.assist === 'manual') return undefined
    return this.difficulty < 0.9 ? (this.assist === 'full' ? 0.85 : 0.55) : undefined
  }

  private noiseScale(): number {
    // Hero is slightly penalised on harder difficulty.
    return 0.85 + (this.difficulty - 1) * 0.6
  }

  private passCandidates(): PassCandidate[] {
    return this.agents.filter((a) => a.team === 'hero' && !a.isHero && !a.isKeeper).map((a) => ({ id: a.id, pos: a.pos, vel: a.vel }))
  }

  private pressureOn(a: Agent): number {
    let m = Infinity
    for (const o of this.agents) if (o.team !== a.team && !o.isKeeper) m = Math.min(m, dist(o.pos, a.pos))
    return clamp01((3.5 - m) / 3.5)
  }

  /** Keeper-hero input: dives. */
  private keeperAction(act: HeroAction): void {
    const hero = this.hero
    let dir: Vec2 | null = null
    if (act.kind === 'swipe') dir = act.swipe.isTap ? null : act.swipe.dir
    else if (act.kind === 'dive') dir = act.dir
    else if (act.kind === 'tapAt') dir = dist(act.at, hero.pos) > 0.8 ? norm(sub(act.at, hero.pos)) : null
    else if (act.kind === 'action' || act.kind === 'skill') {
      const plan = planSave(hero, this.aiWorld(), 0)
      dir = plan && Math.abs(plan.point.y - hero.pos.y) > 0.4 ? norm(sub(plan.point, hero.pos)) : null
      if (!dir) {
        // Set & claim: short step toward the ball.
        hero.cd = 0.3
        return
      }
    }
    if (!dir || len(dir) < 0.1) return
    // Assist bends the dive toward the actual crossing point if roughly the same side.
    if (this.assist !== 'manual') {
      const plan = planSave(hero, this.aiWorld(), 0)
      if (plan && plan.onTarget) {
        const ideal = norm(sub(plan.point, hero.pos))
        if (dot(ideal, dir) > 0.2) dir = norm(add(scale(dir, this.assist === 'full' ? 0.25 : 0.6), scale(ideal, this.assist === 'full' ? 0.75 : 0.4)))
      }
    }
    this.startDive(hero, dir)
  }

  private startDive(k: Agent, dir: Vec2): void {
    // Dives are mostly lateral; clamp forward component.
    const inward = attackDir(k.team)
    let d = norm(dir)
    if (d.x * inward < -0.2) d = norm({ x: -0.2 * inward, y: d.y })
    k.state = 'dive'
    k.stateT = 0
    k.actionDir = d
    k.facing = Math.atan2(d.y, d.x)
    this.events.push({ type: 'dive', by: k.id })
  }

  /** Hero without the ball: headers, volleys, tackles, calling for the ball. */
  private offBallAction(act: HeroAction): void {
    const hero = this.hero
    const ballP = { x: this.ball.x, y: this.ball.y }
    const carrier = this.owner
    // Defending: tackles.
    if (carrier && carrier.team === 'opp') {
      const d = dist(hero.pos, carrier.pos)
      if (act.kind === 'swipe' && !act.swipe.isTap) return this.startSlide(act.swipe.dir)
      if (act.kind === 'action' || act.kind === 'skill' || act.kind === 'tapAt' || act.kind === 'pass') {
        if (d < 1.8) return this.standingTackle(carrier)
        if (d < 5.5) return this.startSlide(norm(sub(add(ballP, scale(carrier.vel, 0.25)), hero.pos)))
      }
      return
    }
    // One-two: a second tap shortly after passing asks the receiver to return it into the run.
    if (this.tryArmOneTwo(act)) return
    // Loose/aerial ball near: header or volley.
    const incoming = this.ballIncomingToHero()
    if (act.kind === 'swipe' && !act.swipe.isTap) this.heroHeaderAim = this.headerAimFromDir(act.swipe.dir)
    if (incoming || act.kind === 'action' || act.kind === 'tapAt' || act.kind === 'swipe') {
      if (incoming && this.ball.z < 1.0 && dist(hero.pos, ballP) < 1.6) {
        // First-time volley / shot.
        const aim = this.heroHeaderAim ?? this.autoGoalAim()
        const plan = planKick({ kind: 'shot', from: ballP, fromZ: this.ball.z, target: aim, power: 0.85, curl: 0, attrs: hero.attrs, pressure: this.pressureOn(hero), assist: this.assist, assistPull: this.assistPull(), env: this.env, noiseScale: this.noiseScale() * 1.3 * HERO_SHOT_NOISE }, this.rng)
        this.kickBall(hero, plan, 'shot', 0.85, null)
        return
      }
      if (incoming || this.ball.z > 0.8 || !carrier) {
        if (hero.cd <= 0 && hero.state !== 'jump') {
          hero.state = 'jump'
          hero.stateT = 0
          hero.cd = 0.75
          if (!this.heroHeaderAim) this.heroHeaderAim = this.autoGoalAim()
          this.events.push({ type: 'jump', by: hero.id })
        }
        return
      }
    }
    // Team-mate on the ball: call for it (optionally pointing to space).
    if (carrier && carrier.team === 'hero') {
      const at = act.kind === 'tapAt' ? act.at : act.kind === 'swipe' && !act.swipe.isTap ? add(hero.pos, scale(act.swipe.dir, 10)) : null
      this.heroRequest = { at, t: this.time }
      this.events.push({ type: 'callForBall', by: hero.id })
    }
  }

  /** Arms the one-two if the action is a tap/press within the window. */
  private tryArmOneTwo(act: HeroAction): boolean {
    const o = this.oneTwo
    if (!o || o.armed || this.time - o.t > ONE_TWO_WINDOW * this.timingMult) return false
    const tap = act.kind === 'action' || act.kind === 'tapAt' || act.kind === 'pass' || act.kind === 'skill' || (act.kind === 'swipe' && act.swipe.isTap)
    if (!tap) return false
    const mate = this.agents.find((a) => a.id === o.id)
    if (!mate) return false
    // The ball must be with the receiver or still on its way to him.
    if (this.owner && this.owner !== mate) return false
    if (!this.owner) {
      // Still travelling from the hero's boot toward the receiver (moving away from the hero).
      const away = this.ball.vx * (this.ball.x - this.hero.pos.x) + this.ball.vy * (this.ball.y - this.hero.pos.y) > 0
      if (this.lastTouch !== this.hero || !away) return false
    }
    o.armed = true
    o.armedAt = this.time
    mate.think = Math.min(mate.think, 0.05)
    this.events.push({ type: 'oneTwo', by: mate.id })
    return true
  }

  /** The receiver plays the return pass first time into the hero's run. */
  private playOneTwo(a: Agent): void {
    this.oneTwo = null
    const heroC = { id: this.hero.id, pos: this.hero.pos, vel: this.hero.vel }
    const from = { x: this.ball.x, y: this.ball.y }
    const target = inField(add(leadPosition(from, heroC, 15, 10), { x: attackDir('hero') * 1.5, y: 0 }), 1)
    const opp = this.agents.filter((q) => q.team === 'opp').map((q) => q.pos)
    const lofted = dist(from, target) > 26 || laneOpenness(from, target, opp) < 0.1
    const kind: KickKind = lofted ? 'lofted' : 'pass'
    const noiseScale = clampN(1.15 - a01(a.attrs.vision) * 0.5, 0.6, 1.15)
    const plan = planKick({ kind, from, target, power: 0.65, curl: 0, attrs: a.attrs, pressure: this.pressureOn(a), assist: 'manual', env: this.env, noiseScale }, this.rng)
    this.kickBall(a, plan, kind, 0.65, this.hero.id)
  }

  private headerAimFromDir(dir: Vec2): Vec2 {
    return shotTargetFromDir({ x: this.hero.pos.x, y: this.hero.pos.y }, dir)
  }

  /** Corner of the goal away from the keeper. */
  private autoGoalAim(): Vec2 {
    const gk = this.agents.find((a) => a.team === 'opp' && a.isKeeper)
    const side = gk && gk.pos.y > GOAL_CENTER_Y ? -1 : 1
    return { x: PITCH_LENGTH + 0.2, y: GOAL_CENTER_Y + side * 2.6 }
  }

  /** True if a loose ball will come within reach of the hero soon. */
  private ballIncomingToHero(): boolean {
    if (this.owner) return false
    const pts = predictTrajectory(this.ball, this.env, { duration: 1.2, sampleEvery: 3 })
    return pts.some((p) => Math.hypot(p.x - this.hero.pos.x, p.y - this.hero.pos.y) < 2.2 && p.z < 3)
  }

  private skillMove(): void {
    const hero = this.hero
    if (hero.cd > 0 || this.owner !== hero || this.setPiece) return
    hero.cd = 1.0
    const fwd = fromAngle(hero.facing)
    const def = this.agents
      .filter((a) => a.team === 'opp' && !a.isKeeper && a.state !== 'down')
      .filter((a) => dist(a.pos, hero.pos) < 3.6 && dot(norm(sub(a.pos, hero.pos)), fwd) > 0.2)
      .sort((p, q) => dist(p.pos, hero.pos) - dist(q.pos, hero.pos))[0]
    const success = this.rng.chance(skillBeatChance(hero, def ?? null, this.difficulty))
    if (success || !def) {
      const side = def ? (angleDiff(Math.atan2(def.pos.y - hero.pos.y, def.pos.x - hero.pos.x), hero.facing) > 0 ? -1 : 1) : 0
      hero.state = 'skill'
      hero.stateT = 0
      hero.actionDir = fromAngle(hero.facing + side * 0.45)
      if (def) {
        def.noTouch = 1.0
        def.state = 'down'
        def.stateT = 0
        this.stats.dribbles++
      }
      this.events.push({ type: 'skill', by: hero.id, success: true })
    } else {
      // Ball knocked loose toward the defender.
      this.owner = null
      const d = norm(sub(def.pos, hero.pos))
      this.ball.vx = d.x * 5
      this.ball.vy = d.y * 5
      hero.noTouch = 0.6
      this.lastTouch = def
      this.events.push({ type: 'skill', by: hero.id, success: false })
    }
  }

  private standingTackle(carrier: Agent): void {
    const hero = this.hero
    if (hero.cd > 0) return
    hero.cd = 0.9
    const timing = this.exposure(carrier)
    const behind = isBehind(carrier, hero)
    const odds = tackleOdds(hero, carrier, timing, behind, false, this.difficulty)
    if (this.rng.chance(odds.win)) {
      this.winBall(hero, carrier, false)
    } else if (this.rng.chance(odds.foul)) {
      this.heroFoul(carrier, false, behind)
    } else {
      hero.state = 'down'
      hero.stateT = -0.15 // brief stumble
      hero.noTouch = 0.6
      this.events.push({ type: 'tackle', by: hero.id, won: false, slide: false, x: hero.pos.x, y: hero.pos.y })
    }
  }

  private startSlide(dir: Vec2): void {
    const hero = this.hero
    if (hero.cd > 0 || len(dir) < 0.1) return
    hero.cd = 1.4
    hero.state = 'slide'
    hero.stateT = 0
    hero.actionDir = norm(dir)
    hero.vel = scale(hero.actionDir, Math.max(len(hero.vel), topSpeed({ ...hero, sprint: true })) + 1.2)
    this.heroTackleResolved = false
    this.events.push({ type: 'tackle', by: hero.id, won: false, slide: true, x: hero.pos.x, y: hero.pos.y })
  }

  private winBall(tackler: Agent, from: Agent, slide: boolean): void {
    this.owner = null
    from.noTouch = 0.8
    if (slide) {
      const d = tackler.actionDir
      this.ball.vx = d.x * 8 + from.vel.x * 0.3
      this.ball.vy = d.y * 8 + from.vel.y * 0.3
      this.lastTouch = tackler
    } else {
      this.setOwner(tackler)
    }
    if (tackler.isHero) this.stats.tackles++
    this.events.push({ type: 'tackle', by: tackler.id, won: true, slide, x: tackler.pos.x, y: tackler.pos.y })
  }

  private heroFoul(on: Agent, slide: boolean, behind: boolean): void {
    const lastMan = !this.agents.some((a) => a.team === 'hero' && !a.isHero && !a.isKeeper && a.pos.x < on.pos.x)
    this.card = cardForFoul(this.rng, slide, behind, lastMan)
    this.events.push({ type: 'foul', by: this.hero.id, on: on.id, card: this.card })
    this.finish('foul_committed', 'hero foul')
  }

  // ───────────────────────── Kicks & possession ─────────────────────────

  private kickBall(by: Agent, plan: KickPlan, kind: KickKind, power: number, passTo: string | null): void {
    if (this.owner && this.owner !== by) return
    // A first-time touch (volley, header, flick) is the receiver's first involvement.
    if (this.owner !== by && this.offsideCheck(by)) return
    // First-time finish/flick by a team-mate straight from the hero's delivery completes the pass.
    if (!by.isHero && by.team === 'hero' && this.owner !== by && this.lastTouch?.isHero && this.heroPassTo) {
      this.stats.passesCompleted++
      this.assistChain = by.id
      this.heroPassTo = null
    }
    applyKick(this.ball, plan)
    if (this.ball.z < 0.01 && plan.vz > 0) this.ball.z = 0.02
    // Nobody reads a pass instantly: AI players keep their current plan for their reaction time.
    for (const a of this.agents) if (!a.isHero && a !== by && !a.isKeeper) a.think = Math.max(a.think, reactionTime(a, this.difficulty) * this.rng.range(0.85, 1.2))
    this.owner = null
    by.noTouch = 0.3
    by.touch = 0
    this.lastTouch = by
    this.lastPossTeam = by.team
    const spd = Math.hypot(plan.vx, plan.vy, plan.vz)
    this.events.push({ type: 'kick', by: by.id, hero: by.isHero, kick: kind, power, speed: spd, x: this.ball.x, y: this.ball.y })
    if (kind === 'header') this.events.push({ type: 'header', by: by.id })

    const wasSetPiece = this.setPiece
    if (this.setPiece) {
      // Wall jumps, everyone is released.
      for (const id of this.setPiece.wall) {
        const w = this.agents.find((a) => a.id === id)
        if (w) {
          w.state = 'jump'
          w.stateT = 0
        }
      }
      this.setPiece = null
    }

    if (by.isHero) {
      this.stopBullet()
      this.aim = null
      if (SHOT_KINDS.has(kind)) this.stats.shots++
      else this.stats.passes++
      this.heroPassTo = passTo ? { id: passTo, t: this.time } : SHOT_KINDS.has(kind) ? null : { id: '*', t: this.time }
      this.oneTwo = passTo && (kind === 'pass' || kind === 'lofted') ? { id: passTo, t: this.time, armed: false, armedAt: -1 } : null
      this.heroDeliveryAt = SHOT_KINDS.has(kind) ? -1 : this.time
      this.heroHeaderAim = null
    }

    // Offside positions are judged at the moment the ball is played (no offside from a corner).
    this.offsideSnap = null
    if (PASS_KINDS.has(kind) && wasSetPiece?.kind !== 'corner' && (by.team === 'hero' || this.defending)) {
      const ids = offsideSnapshot(this.agents, this.ball.x, by)
      if (ids.size) this.offsideSnap = { team: by.team, ids }
    }

    if (SHOT_KINDS.has(kind) && by.team === 'opp' && this.defending && !isKeeperKind(this.kind)) this.oppShotFree = true
    if (SHOT_KINDS.has(kind) && by.isHero) {
      // Settle the previous shot of the moment, then log this one.
      const prev = this.shotLog[this.shotLog.length - 1]
      if (prev && !prev.outcome && this.shot?.by.isHero) prev.outcome = this.shot.parried ? 'saved' : this.shot.blocked ? 'blocked' : this.shot.woodwork ? 'woodwork' : 'missed'
      const e: NonNullable<HighlightResult['shotLog']>[number] = { x: Math.round(this.ball.x * 10) / 10, y: Math.round(this.ball.y * 10) / 10 }
      if (kind === 'header') e.header = true
      this.shotLog.push(e)
    }
    if (SHOT_KINDS.has(kind)) {
      this.shot = { by, kind, t: this.time, woodwork: false, blocked: false, parried: false, beaten: new Set(), assistBy: !by.isHero && this.assistChain === by.id ? this.hero.id : null }
      const defTeam = other(by.team)
      const keeper = this.agents.find((a) => a.team === defTeam && a.isKeeper)
      if (keeper) {
        if (keeper.isHero) {
          // Reflex window for the hero keeper (penalties are a pure read — no slow motion).
          if (wasSetPiece?.kind !== 'penalty') this.startBullet(0.3, 0.3 + a01(keeper.attrs.reflexes) * 0.55)
        } else {
          const isPen = wasSetPiece?.kind === 'penalty'
          const reaction = isPen ? 0.06 : keeperReaction(keeper, this.difficulty)
          let penaltyGuess: KeeperAlert['penaltyGuess']
          if (isPen) {
            const pRead = clampN(PENALTY_READ_BASE + a01(keeper.attrs.positioning) * 0.25 + (this.difficulty - 1) * 0.4 - (power > 0.9 ? 0.08 : 0), 0.1, 0.6)
            penaltyGuess = { read: this.rng.chance(pRead), centre: this.rng.chance(0.1) }
          }
          this.keeperAlert = { keeper, at: this.time + reaction, penaltyGuess }
        }
      }
    } else {
      this.shot = null
    }

    if (kind === 'cross' || kind === 'lofted') this.planAttackingRuns(by)
    // Corner/cross toward the hero → header slow-mo armed.
    if ((kind === 'cross' || kind === 'lofted') && !by.isHero && by.team === 'hero') this.crossBulletArmed = true
    if (by.team === 'opp' && this.lastPossTeam === 'opp' && !this.defending) this.oppClearedAt = this.time
  }

  private setOwner(a: Agent): void {
    const prevOwner = this.owner
    this.lastTouchBefore = this.lastTouch
    this.owner = a
    this.ownerSince = this.time
    a.touch = 0.6
    this.lastTouch = a
    this.lastPossTeam = a.team
    this.ball.z = 0
    this.ball.vz = 0
    this.ball.spin.side = 0
    this.ball.spin.top = 0
    this.events.push({ type: 'touch', by: a.id, hero: a.isHero, x: a.pos.x, y: a.pos.y })
    if (a.isHero) this.heroControlled = true

    // Pass completion bookkeeping: a team-mate receiving the hero's pass may score → assist.
    if (this.heroPassTo && a.team === 'hero' && !a.isHero && (this.heroPassTo.id === a.id || this.heroPassTo.id === '*')) {
      this.stats.passesCompleted++
      this.assistChain = a.id
    } else if (a.id !== this.assistChain) {
      this.assistChain = null
      if (a.team === 'hero' && !a.isHero && !a.isKeeper) this.heroDeliveryAt = -1
    }
    // Interceptions by the hero while defending count as successful defensive actions.
    if (a.isHero && this.defending && !a.isKeeper && prevOwner === null && this.lastTouchBefore?.team === 'opp') this.stats.tackles++
    this.heroPassTo = null
    if (a.team !== 'hero') this.heroRequest = null
    if (this.oneTwo && a.id !== this.oneTwo.id) this.oneTwo = null
    else if (this.oneTwo?.armed) a.think = Math.min(a.think, 0.02)

    // Shot ends when someone controls the ball (unless keeper hold handled elsewhere).
    if (!a.isKeeper) this.shot = null

    // Bullet time each time the hero gains possession.
    if (a.isHero && prevOwner !== a && !a.isKeeper && !this.setPiece && this.phase === 'live') this.startBullet(0.25, this.possessionWindow())
  }

  /** 0..1 how exposed the carrier's ball is (1 = just after a touch, far from feet). */
  private exposure(o: Agent): number {
    const moving = len(o.vel) > 1.2
    return moving ? clamp01(1 - o.touch) * 0.8 + 0.2 : 0.3
  }

  // ───────────────────────── Movement ─────────────────────────

  private moveHero(): void {
    const hero = this.hero
    if (this.phase === 'intro' || this.phase === 'done') {
      hero.vel = scale(hero.vel, 0.85)
      return
    }
    if (hero.state === 'slide' || hero.state === 'dive' || hero.state === 'down' || hero.state === 'celebrate') return
    const locked = this.setPiece !== null && this.setPiece.takerId === hero.id
    if (locked || this.phase === 'post') {
      hero.vel = scale(hero.vel, 0.8)
      if (this.phase === 'post' && this.result?.outcome === 'goal') this.celebrate(hero)
      return
    }
    hero.sprint = this.control.sprint
    let mv = this.control.move
    // Assisted keeper auto-positioning when idle.
    if (hero.isKeeper && len(mv) < 0.1 && this.assist !== 'manual' && hero.state === 'run') {
      const tgt = keeperTarget(hero, this.aiWorld()).pos
      const v = arrive(hero, tgt, topSpeed(hero) * (this.assist === 'full' ? 0.7 : 0.4), 1.5)
      mv = scale(v, 1 / Math.max(1, topSpeed(hero)))
    }
    let max = topSpeed(hero)
    if (this.owner === hero) max *= 0.86 + a01(hero.attrs.dribbling) * 0.1
    if (hero.state === 'skill') {
      hero.vel = scale(hero.actionDir, topSpeed({ ...hero, sprint: true }) + 1.5)
      return
    }
    const desired = scale(mv, max)
    const dv = sub(desired, hero.vel)
    const a = accel(hero) * (len(desired) < len(hero.vel) ? 1.6 : 1) * DT
    hero.vel = len(dv) <= a ? desired : add(hero.vel, scale(norm(dv), a))
    if (hero.sprint && len(mv) > 0.3) hero.stamina = Math.max(0, hero.stamina - DT * 0.22)
    else hero.stamina = Math.min(1, hero.stamina + DT * 0.12)
    if (hero.isKeeper) {
      // Stay in the box.
      const gx = ownGoalX(hero.team)
      const inward = attackDir(hero.team)
      const nx = hero.pos.x + hero.vel.x * DT
      if ((nx - gx) * inward > 16.5 || (nx - gx) * inward < -0.2) hero.vel.x = 0
    }
  }

  private celebrate(a: Agent): void {
    if (a.state !== 'celebrate') {
      a.state = 'celebrate'
      a.stateT = 0
    }
    const flag = { x: PITCH_LENGTH - 1, y: a.pos.y < GOAL_CENTER_Y ? 1 : PITCH_WIDTH - 1 }
    a.vel = arrive(a, flag, 6.5, 3)
  }

  /** AI decision + steering for non-hero agents. */
  private thinkAndSteer(a: Agent): void {
    if (a.state === 'slide' || a.state === 'dive' || a.state === 'down' || a.state === 'jump' || a.state === 'skill') return
    if (a.state === 'wall') {
      a.vel = { x: 0, y: 0 }
      return
    }
    if (this.phase === 'intro') {
      a.vel = scale(a.vel, 0.85)
      return
    }
    if (this.phase === 'post') {
      if (this.result && this.goalTime > 0) {
        const scorerTeam: Team = this.ball.x > PITCH_LENGTH / 2 ? 'hero' : 'opp'
        if (a.team === scorerTeam && !a.isKeeper && dist(a.pos, this.ball) < 30) {
          const lead = this.agents.find((q) => q.id === this.result?.scorerId) ?? this.hero
          a.vel = a === lead ? arrive(a, { x: PITCH_LENGTH - 1, y: a.pos.y < GOAL_CENTER_Y ? 1 : PITCH_WIDTH - 1 }, 6.5, 3) : arrive(a, lead.pos, 5.5, 2)
          if (a === lead && a.state !== 'celebrate') a.state = 'celebrate'
          return
        }
      }
      a.vel = scale(a.vel, 0.94)
      return
    }
    // Scripted set-piece takers are driven by setPieceAI().
    if (this.setPiece && this.setPiece.takerId === a.id) return

    a.think -= DT
    if (a.think <= 0) {
      const vis = a01(a.attrs.vision)
      a.think = (a.isKeeper && this.owner && this.owner.team !== a.team ? 0.1 : clampN(0.34 - vis * 0.16, 0.12, 0.36)) * (a.team === 'opp' ? 1 / this.difficulty : 1)
      this.decide(a)
    }

    let target: Vec2 | null = null
    let speed = topSpeed(a) * 0.72
    const intent = a.intent
    if (intent?.kind === 'run') {
      target = intent.to
      if (dist(a.pos, target) > 7) speed = topSpeed({ ...a, sprint: true })
      // A keeper coming off his line to narrow the angle does it at full speed.
      if (a.isKeeper && this.owner && this.owner.team !== a.team && dist(a.pos, target) > 1.2) speed = topSpeed({ ...a, sprint: true })
    } else if (intent?.kind === 'press') {
      target = pressTarget(a, this.aiWorld())
      a.sprint = true
      speed = topSpeed(a)
      a.sprint = false
    }
    if (this.owner === a) {
      // A carrier running at a retreating defence attacks the space at pace.
      const chased = this.agents.some((o) => o.team !== a.team && !o.isKeeper && dist(o.pos, a.pos) < 6)
      speed = (chased || a.team === 'opp' ? topSpeed({ ...a, sprint: true }) * (0.8 + a01(a.attrs.dribbling) * 0.12) : speed) * 0.92
    }
    // Respect set-piece distance.
    if (this.setPiece && !a.isKeeper && target && dist(target, this.setPiece.spot) < 9.15 && a.id !== this.setPiece.takerId) {
      target = add(this.setPiece.spot, scale(norm(sub(target, this.setPiece.spot)), 9.3))
    }
    let desired = target ? arrive(a, target, speed, a.isKeeper ? 1.2 : 2.2) : { x: 0, y: 0 }
    desired = add(desired, scale(separation(a, this.agents), 2.2))
    const dv = sub(desired, a.vel)
    const acc = accel(a) * DT * (a.team === 'opp' ? this.difficulty : 1)
    a.vel = len(dv) <= acc ? desired : add(a.vel, scale(norm(dv), acc))
  }

  /** One AI think-tick for agent `a`. */
  private decide(a: Agent): void {
    const w = this.aiWorld()
    const ballP = { x: this.ball.x, y: this.ball.y }
    if (a.isKeeper) {
      if (this.owner === a) {
        a.intent = { kind: 'hold' }
        return
      }
      // Claim crosses.
      if (!this.owner && this.ball.z > 1 && this.ball.vz < 2) {
        const land = this.landingPoint()
        if (land && shouldClaimCross(a, land.p, land.t)) {
          a.intent = { kind: 'run', to: land.p, until: this.time + 1 }
          return
        }
      }
      // Loose slow ball in the box: collect.
      if (!this.owner && Math.abs(this.ball.x - ownGoalX(a.team)) < 15 && Math.abs(this.ball.y - GOAL_CENTER_Y) < 18 && Math.hypot(this.ball.vx, this.ball.vy) < 9) {
        a.intent = { kind: 'run', to: interceptPoint(a, w, 1.5).point, until: this.time + 1 }
        return
      }
      if (this.setPiece?.kind === 'penalty' && !a.isHero) {
        a.intent = { kind: 'run', to: { x: a.pos.x, y: GOAL_CENTER_Y + Math.sin(this.time * 2.2) * 0.45 }, until: this.time + 1 }
        return
      }
      a.intent = { kind: 'run', to: keeperTarget(a, w).pos, until: this.time + 1 }
      return
    }

    if (this.owner === a) {
      this.carrierAct(a)
      return
    }

    if (!this.owner) {
      // Loose ball: best-placed player per team chases.
      const mates = this.agents.filter((q) => q.team === a.team && !q.isKeeper && !q.isHero)
      let bestId = ''
      let bestT = Infinity
      for (const m of mates) {
        const ip = interceptPoint(m, w, 2)
        const t = ip.reachable ? ip.t : 9 + dist(m.pos, ip.point) / 7
        if (t < bestT) {
          bestT = t
          bestId = m.id
        }
      }
      // Hero takes priority on own team if they're closest by distance.
      if (bestId === a.id) {
        const heroCloser = a.team === 'hero' && dist(this.hero.pos, ballP) + 1.5 < dist(a.pos, ballP) && !this.hero.isKeeper
        if (!heroCloser) {
          a.intent = { kind: 'run', to: interceptPoint(a, w, 2.2).point, until: this.time + 0.6 }
          return
        }
      }
      // Pass target receiver keeps moving to the lead point.
      if (this.heroPassTo && this.heroPassTo.id === a.id) {
        a.intent = { kind: 'run', to: interceptPoint(a, w, 2.5).point, until: this.time + 0.6 }
        return
      }
    }

    const possTeam = this.owner ? this.owner.team : this.lastPossTeam
    if (possTeam === a.team) {
      const near = dist(a.pos, ballP) < 35
      const runner = a.team === 'opp' && this.defending && near && (a.role === 'ST' || a.role === 'LW' || a.role === 'RW' || a.role === 'AM' || a.role === 'CM')
      a.intent = { kind: 'run', to: runner ? runTarget(a, w, this.owner, this.rng) : supportTarget(a, w, this.ballX0, this.rng), until: this.time + 1.5 }
      return
    }
    // Defending.
    if (!this.defendCache || this.defendCache.t !== this.time || this.defendCache.team !== a.team) {
      this.defendCache = { t: this.time, team: a.team, map: defendTargets(w, a.team, this.ballX0) }
    }
    const as = this.defendCache.map.get(a.id)
    if (as?.kind === 'press') a.intent = { kind: 'press', target: this.owner?.id ?? '' }
    else if (as?.kind === 'cover') a.intent = { kind: 'run', to: as.target, until: this.time + 1 }
    else a.intent = { kind: 'run', to: inField(a.anchor), until: this.time + 1 }
  }

  /** AI ball carrier executes a decision. */
  private carrierAct(a: Agent): void {
    const w = this.aiWorld()
    const heldFor = this.time - this.ownerSince
    // One-two requested: first-time return into the hero's run.
    if (a.team === 'hero' && this.oneTwo?.armed && this.oneTwo.id === a.id) return this.playOneTwo(a)
    // Hero called for the ball.
    if (a.team === 'hero' && this.heroRequest && this.time - this.heroRequest.t < 1.6 && heldFor > 0.2) {
      const p = 0.4 + (a.relationToHero / 100) * 0.35 + a01(a.attrs.vision) * 0.25
      const req = this.heroRequest
      this.heroRequest = null
      if (this.rng.chance(clamp01(p))) {
        const heroC = { id: this.hero.id, pos: this.hero.pos, vel: this.hero.vel }
        const target = req.at ? inField(req.at, 1) : leadPosition(a.pos, heroC, 13)
        const lofted = dist(a.pos, target) > 26
        const plan = planKick({ kind: lofted ? 'lofted' : 'pass', from: { x: this.ball.x, y: this.ball.y }, target, power: 0.6, curl: 0, attrs: a.attrs, pressure: this.pressureOn(a), assist: 'manual', env: this.env, noiseScale: 0.9 }, this.rng)
        this.kickBall(a, plan, lofted ? 'lofted' : 'pass', 0.6, null)
        return
      }
    }
    // Shooting wait for drama in keeper moments; in gk_save the attacker always pulls the trigger.
    const minHold = this.kind === 'gk_save' ? 0.7 : 0.3
    // Tactical carrier: opponents everywhere (except the scripted gk moments), team-mates in the
    // final third away from the flanks (wide areas keep the crossing logic).
    const toGoal = dist(a.pos, { x: attackDir(a.team) > 0 ? PITCH_LENGTH : 0, y: GOAL_CENTER_Y })
    const wide = a.pos.y < 14 || a.pos.y > PITCH_WIDTH - 14
    const smart = a.team === 'opp' ? true : toGoal < 30 && !wide
    if (smart && this.smartCarrier(a, heldFor, minHold)) return
    let dec = carrierDecision(a, w, this.rng, { heldFor })
    if (this.kind === 'gk_save' && a.team === 'opp' && heldFor > 0.9 && dec.kind !== 'shoot') {
      dec = { kind: 'shoot', target: { x: -0.2, y: GOAL_CENTER_Y + (this.rng.chance(0.5) ? 1 : -1) * this.rng.range(0.8, 3.1) } }
    }
    const from = { x: this.ball.x, y: this.ball.y }
    const base = { from, attrs: a.attrs, pressure: this.pressureOn(a), assist: 'manual' as AimAssist, env: this.env }
    const oppNoise = a.team === 'opp' ? 1.15 / this.difficulty : 1
    switch (dec.kind) {
      case 'shoot': {
        if (heldFor < minHold) break
        const power = this.rng.range(0.72, 0.95)
        const plan = planKick({ ...base, kind: 'shot', target: dec.target, power, curl: this.rng.range(-0.35, 0.35), noiseScale: oppNoise }, this.rng)
        this.kickBall(a, plan, 'shot', power, null)
        return
      }
      case 'pass': {
        const target = leadPosition(a.pos, dec.to, dec.lofted ? 17 : 13)
        const kind: KickKind = dec.lofted ? 'lofted' : 'pass'
        const plan = planKick({ ...base, kind, target, power: 0.55, curl: 0, noiseScale: oppNoise }, this.rng)
        this.kickBall(a, plan, kind, 0.55, null)
        return
      }
      case 'cross': {
        const zone = this.pickCrossZone(a)
        if (zone.ground) {
          const plan = planKick({ ...base, kind: 'through', target: zone.point, power: 0.7, curl: 0, noiseScale: oppNoise }, this.rng)
          this.kickBall(a, plan, 'through', 0.7, null)
          return
        }
        const plan = planKick({ ...base, kind: 'cross', target: zone.point, targetZ: zone.z, power: 0.7, curl: 0.3 * Math.sign(GOAL_CENTER_Y - a.pos.y), noiseScale: oppNoise }, this.rng)
        this.kickBall(a, plan, 'cross', 0.7, null)
        return
      }
      case 'dribble':
        break
    }
    const dir = dec.kind === 'dribble' ? dec.dir : norm(sub({ x: attackDir(a.team) > 0 ? PITCH_LENGTH : 0, y: GOAL_CENTER_Y }, a.pos))
    a.intent = { kind: 'run', to: inField(add(a.pos, scale(dir, 5)), 1), until: this.time + 0.5 }
  }

  /**
   * Opponent carrier with tactical reasoning (see tactics.ts): values shooting,
   * every pass (time race against defenders), taking on the defender in front
   * and dribbling into space, and acts on the best. Returns false to fall back.
   */
  private smartCarrier(a: Agent, heldFor: number, minHold: number): boolean {
    const w = this.aiWorld()
    const noise = clampN(0.35 - a01(a.attrs.vision) * 0.25, 0.05, 0.35) / (a.team === 'opp' ? this.difficulty : 1)
    const heroBias = a.team === 'hero' ? 0.02 + (a.relationToHero / 100) * 0.04 + a01(a.attrs.vision) * 0.02 : 0
    // In a keeper moment the striker is set on shooting: he only picks his moment and corner.
    const shotBias = this.kind === 'gk_save' ? 0.6 + heldFor * 0.6 : 0
    const dec = evaluateCarrier(a, w, this.rng, { heldFor, noise, heroBias, shotBias })
    const from = { x: this.ball.x, y: this.ball.y }
    const base = { from, attrs: a.attrs, pressure: this.pressureOn(a), assist: 'manual' as AimAssist, env: this.env }
    const oppNoise = a.team === 'opp' ? 1.15 / this.difficulty : 1
    switch (dec.kind) {
      case 'shoot': {
        // Only pull the trigger on a real chance (or when time is up / swamped).
        const late = this.time > this.timeLimit - 2.5 || (this.kind === 'gk_save' && heldFor > 1.4)
        if (heldFor < minHold || (dec.value < 0.13 && !late && heldFor < 2.6)) break
        const power = this.rng.range(0.72, 0.95)
        const plan = planKick({ ...base, kind: 'shot', target: dec.target, power, curl: this.rng.range(-0.35, 0.35), noiseScale: oppNoise }, this.rng)
        this.kickBall(a, plan, 'shot', power, null)
        return true
      }
      case 'pass': {
        if (heldFor < 0.35) break
        // Lead the runner as evaluated (half a second ahead), never past his reach into the keeper.
        const target = passLead(a.pos, dec.to, dec.lofted)
        const kind: KickKind = dec.lofted ? 'lofted' : 'pass'
        const power = 0.55 + clamp01(dist(a.pos, target) / 40) * 0.25
        const plan = planKick({ ...base, kind, target, power, curl: 0, noiseScale: oppNoise }, this.rng)
        this.kickBall(a, plan, kind, power, null)
        return true
      }
      case 'takeOn': {
        if (a.cd > 0 || heldFor < 0.25) break
        this.aiTakeOn(a, dec.defender)
        return true
      }
      case 'dribble': {
        a.intent = { kind: 'run', to: inField(add(a.pos, scale(dec.dir, 5)), 1), until: this.time + 0.4 }
        return true
      }
      default:
        break
    }
    // Waiting for the right moment: keep the ball moving toward goal, shielding from the nearest defender.
    const toGoal = norm(sub({ x: attackDir(a.team) > 0 ? PITCH_LENGTH : 0, y: GOAL_CENTER_Y }, a.pos))
    a.intent = { kind: 'run', to: inField(add(a.pos, scale(toGoal, 3)), 1), until: this.time + 0.3 }
    return true
  }

  /**
   * AI crosser's choice of delivery zone: the zone a team-mate (the hero
   * weighted by relationship) can attack first relative to his marker, with
   * the cut-back when the box is crowded and a runner arrives late.
   */
  private pickCrossZone(a: Agent): CrossZone {
    const zones = crossZones(a.pos.y, attackDir(a.team) > 0 ? PITCH_LENGTH : 0)
    const mates = this.agents.filter((m) => m.team === a.team && m !== a && !m.isKeeper)
    const opps = this.agents.filter((m) => m.team !== a.team && !m.isKeeper)
    let best = zones[2]
    let bestV = -Infinity
    for (const z of zones) {
      let v = -Infinity
      for (const m of mates) {
        const tm = dist(m.pos, z.point) / topSpeed({ ...m, sprint: true })
        const td = Math.min(...opps.map((o) => dist(o.pos, z.point) / topSpeed({ ...o, sprint: true }) + reactionTime(o, this.difficulty)))
        let s = (td - tm) + (m.isHero ? 0.3 + m.relationToHero / 250 : 0) + a01(m.attrs.heading) * (z.ground ? 0 : 0.3)
        if (z.ground) s += a01(m.attrs.shooting) * 0.3 - 0.15
        v = Math.max(v, s)
      }
      v += this.rng.range(-0.25, 0.25)
      if (v > bestV) {
        bestV = v
        best = z
      }
    }
    return best
  }

  /**
   * Attacking the cross: each attacker of the delivering team near the
   * landing area picks the point on the ball's flight (header height) he can
   * reach in time and runs to arrive with the ball, not before it.
   */
  private planAttackingRuns(by: Agent): void {
    const pts = predictTrajectory(this.ball, this.env, { duration: 2.6, sampleEvery: 2 })
    const window = pts.filter((p) => p.z > 1.2 && p.z < 2.4 && p.t > 0.25)
    const low = pts.filter((p) => p.z <= 1.2 && p.t > 0.25)
    const cand = window.length ? window : low.slice(0, 6)
    if (!cand.length) return
    const runners = this.agents.filter((m) => m.team === by.team && m !== by && !m.isKeeper && !m.isHero && dist(m.pos, cand[0]) < 20)
    for (const m of runners) {
      let best: { x: number; y: number; t: number } | null = null
      for (const p of cand) {
        const need = Math.max(0, dist(m.pos, p) - 0.4) / topSpeed({ ...m, sprint: true }) + 0.12
        if (need <= p.t + 0.05) {
          best = p
          break
        }
      }
      if (best) {
        m.intent = { kind: 'run', to: { x: best.x, y: best.y }, until: this.time + best.t + 0.4 }
        m.think = Math.max(m.think, Math.min(best.t, 1.2))
      }
    }
  }

  /** AI carrier tries to beat the defender in front (skill move / change of pace). */
  private aiTakeOn(a: Agent, def: Agent): void {
    a.cd = 1.1
    const p = takeOnChance(a, def, this.difficulty)
    if (this.rng.chance(p)) {
      const side = angleDiff(Math.atan2(def.pos.y - a.pos.y, def.pos.x - a.pos.x), a.facing) > 0 ? -1 : 1
      a.state = 'skill'
      a.stateT = 0
      a.actionDir = fromAngle(a.facing + side * 0.55)
      def.noTouch = 0.9
      if (!def.isHero) {
        def.state = 'down'
        def.stateT = 0
      } else {
        // The hero is wrong-footed: a committed (rushing) defender is sold and needs a moment to turn.
        const toA = norm(sub(a.pos, def.pos))
        const closing = def.vel.x * toA.x + def.vel.y * toA.y
        def.cd = Math.max(def.cd, 0.5)
        def.vel = scale(def.vel, closing > 2.5 ? 0.15 : 0.45)
        if (closing > 2.5) {
          def.state = 'down'
          def.stateT = 0.1
        }
      }
      this.events.push({ type: 'skill', by: a.id, success: true })
    } else {
      // Read and blocked: the ball squirts off the defender's legs, a real 50/50.
      this.owner = null
      const d = fromAngle(Math.atan2(def.pos.y - a.pos.y, def.pos.x - a.pos.x) + this.rng.range(-1.3, 1.3))
      const sp = this.rng.range(2.5, 5)
      this.ball.vx = d.x * sp
      this.ball.vy = d.y * sp
      a.noTouch = 0.35
      this.lastTouch = def
      this.events.push({ type: 'skill', by: a.id, success: false })
    }
  }

  /** Scripted set-piece takers (corner delivery, opposition penalty). */
  private setPieceAI(): void {
    const sp = this.setPiece
    if (!sp) return
    const taker = this.agents.find((a) => a.id === sp.takerId)
    if (!taker || taker.isHero) return
    if (sp.kind === 'corner' && this.time >= 1.4) {
      // Aim at the hero (relationship + crossing decide accuracy), else best header.
      const heroC = { id: this.hero.id, pos: this.hero.pos, vel: this.hero.vel }
      const toHero = this.rng.chance(clamp01(0.65 + taker.relationToHero / 250))
      let target = toHero ? leadPosition(sp.spot, heroC, 18, 3) : { x: PITCH_LENGTH - 8 - this.rng.range(0, 5), y: GOAL_CENTER_Y + this.rng.range(-5, 5) }
      target = { x: clampN(target.x, PITCH_LENGTH - 16, PITCH_LENGTH - 4), y: clampN(target.y, GOAL_CENTER_Y - 10, GOAL_CENTER_Y + 10) }
      const plan = planKick({ kind: 'cross', from: sp.spot, target, targetZ: 1.95, power: 0.7, curl: sp.spot.y < GOAL_CENTER_Y ? 0.5 : -0.5, attrs: taker.attrs, pressure: 0, assist: 'manual', env: this.env, noiseScale: 0.8 }, this.rng)
      this.ball.x = sp.spot.x
      this.ball.y = sp.spot.y
      this.kickBall(taker, plan, 'cross', 0.7, null)
      return
    }
    if (sp.kind === 'penalty') {
      if (!this.penaltyPlan) {
        const centre = this.rng.chance(0.12)
        const side = this.rng.chance(0.5) ? 1 : -1
        this.penaltyPlan = {
          target: { x: -0.2, y: centre ? GOAL_CENTER_Y + this.rng.range(-0.5, 0.5) : GOAL_CENTER_Y + side * this.rng.range(1.6, 3.2) },
          z: this.rng.range(0.15, 1.9),
          runStart: this.time + 0.6,
        }
      }
      const pp = this.penaltyPlan
      if (this.time < pp.runStart) return
      // Run-up: approach the ball; a good keeper may read the taker's body shape.
      const behind = { x: sp.spot.x + 0.5, y: sp.spot.y + 0.25 }
      taker.vel = arrive(taker, behind, 4.2, 0.4)
      const readSkill = a01(this.hero.attrs.positioning) * 0.6 + a01(this.hero.attrs.reflexes) * 0.2
      const look = Math.atan2(pp.target.y - taker.pos.y, pp.target.x - taker.pos.x)
      taker.facing = Math.PI + angleDiff(look, Math.PI) * readSkill
      if (dist(taker.pos, behind) < 0.35) {
        const plan = planKick({ kind: 'penalty', from: sp.spot, target: pp.target, targetZ: pp.z, power: this.rng.range(0.78, 0.95), curl: 0, attrs: taker.attrs, pressure: 0.3, assist: 'manual', env: this.env, noiseScale: 0.9 }, this.rng)
        this.ball.x = sp.spot.x
        this.ball.y = sp.spot.y
        this.kickBall(taker, plan, 'penalty', 0.88, null)
      }
    }
  }

  private landingPoint(): { p: Vec2; t: number } | null {
    const pts = predictTrajectory(this.ball, this.env, { duration: 2.5, sampleEvery: 2 })
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].z < 2.4 && pts[i - 1].z >= pts[i].z) return { p: { x: pts[i].x, y: pts[i].y }, t: pts[i].t }
    }
    return null
  }

  /** Integrates position + state timers for an agent. */
  private integrateAgent(a: Agent): void {
    a.stateT += DT
    a.cd = Math.max(0, a.cd - DT)
    a.noTouch = Math.max(0, a.noTouch - DT)
    switch (a.state) {
      case 'slide': {
        const t = a.stateT
        a.vel = scale(a.actionDir, Math.max(0, len(a.vel) - 9 * DT))
        if (t > 0.6) {
          a.state = 'down'
          a.stateT = 0
        }
        break
      }
      case 'dive': {
        const t = a.stateT
        const dur = DIVE_TIME
        const sp = diveSpeed(a) * (t < DIVE_PEAK ? 1 : Math.max(0, 1 - (t - DIVE_PEAK) / 0.22))
        a.vel = scale(a.actionDir, sp)
        a.z = Math.max(0, Math.sin((Math.PI * t) / dur) * 0.55)
        if (t > dur) {
          a.state = 'down'
          a.stateT = 0
          a.z = 0
        }
        break
      }
      case 'jump': {
        const dur = 0.56
        const h = this.wallIds.has(a.id) ? 0.18 + a01(a.attrs.jumping) * 0.2 : 0.3 + a01(a.attrs.jumping) * 0.45
        a.z = Math.max(0, Math.sin((Math.PI * a.stateT) / dur) * h)
        a.vel = scale(a.vel, 0.97)
        if (a.stateT > dur) {
          a.state = 'run'
          a.z = 0
          a.stateT = 0
        }
        break
      }
      case 'down': {
        a.vel = scale(a.vel, 0.85)
        if (a.stateT > 0.55) {
          a.state = 'run'
          a.stateT = 0
        }
        break
      }
      case 'skill': {
        if (!a.isHero) a.vel = scale(a.actionDir, topSpeed({ ...a, sprint: true }) + 1)
        if (a.stateT > 0.42) {
          a.state = 'run'
          a.stateT = 0
        }
        break
      }
      default:
        break
    }
    a.pos.x = clampN(a.pos.x + a.vel.x * DT, -3, PITCH_LENGTH + 3)
    a.pos.y = clampN(a.pos.y + a.vel.y * DT, -3, PITCH_WIDTH + 3)
    // Facing: toward motion, else toward the ball.
    const sp = len(a.vel)
    let want: number
    if (a.state === 'dive' || a.state === 'slide') want = Math.atan2(a.actionDir.y, a.actionDir.x)
    else if (sp > 0.8) want = Math.atan2(a.vel.y, a.vel.x)
    else want = Math.atan2(this.ball.y - a.pos.y, this.ball.x - a.pos.x)
    if (this.setPiece && this.setPiece.takerId === a.id && a.isHero) want = Math.atan2(GOAL_CENTER_Y - a.pos.y, PITCH_LENGTH - a.pos.x)
    if (this.setPiece?.kind === 'penalty' && this.setPiece.takerId === a.id && !a.isHero) return
    const rate = (a.isHero ? 14 : 8 + a01(a.attrs.agility) * 5) * DT
    const d = angleDiff(want, a.facing)
    a.facing += clampN(d, -rate, rate)
  }

  // ───────────────────────── Ball ─────────────────────────

  private updateBall(): void {
    const o = this.owner
    if (o) {
      // Dribble: touch cycle pushes the ball ahead, then the player catches up.
      const sp = len(o.vel)
      const moving = sp > 1
      const period = 0.62 - a01(o.attrs.dribbling) * 0.2
      if (moving) {
        o.touch += (DT / period) * clampN(sp / 6, 0.5, 1.4)
        if (o.touch >= 1) {
          o.touch -= 1
          if (o.isHero) this.events.push({ type: 'dribble', by: o.id })
        }
      }
      const ahead = 0.42 + (moving ? (1 - o.touch) * 0.55 * clampN(sp / 6, 0, 1.2) : 0)
      const f = fromAngle(o.facing)
      if (o.isKeeper) {
        // Held in hands.
        this.ball.x = o.pos.x + f.x * 0.3
        this.ball.y = o.pos.y + f.y * 0.3
        this.ball.z = 1.0
      } else {
        this.ball.x = o.pos.x + f.x * ahead
        this.ball.y = o.pos.y + f.y * ahead
        this.ball.z = 0
      }
      this.ball.vx = o.vel.x
      this.ball.vy = o.vel.y
      this.ball.vz = 0
      return
    }
    if (this.setPiece) {
      this.ball.vx = this.ball.vy = this.ball.vz = 0
      return
    }
    this.physEvents.length = 0
    stepBall(this.ball, this.env, this.tracker, this.physEvents)
    for (const e of this.physEvents) this.onPhysics(e)
  }

  private onPhysics(e: PhysicsEvent): void {
    switch (e.type) {
      case 'bounce':
        if (e.speed > 2) this.events.push({ type: 'bounce', speed: e.speed, x: e.x, y: e.y })
        break
      case 'post':
      case 'bar':
        this.events.push({ type: e.type, speed: e.speed, x: e.x, y: e.y, z: e.z })
        if (this.shot) this.shot.woodwork = true
        break
      case 'net':
        this.events.push({ type: 'net', speed: e.speed, end: e.end })
        break
      case 'goal':
        this.onGoal(e.end)
        break
      case 'out':
        this.events.push({ type: 'out', x: e.x, y: e.y })
        this.onOut()
        break
    }
  }

  // ───────────────────────── Contacts ─────────────────────────

  private contacts(): void {
    const b = this.ball
    const bp = { x: b.x, y: b.y }
    const speed = Math.hypot(b.vx, b.vy, b.vz)
    let best: Agent | null = null
    let bestD = Infinity
    let mode: 'feet' | 'head' | 'body' | 'keeper' = 'feet'
    const heads: Agent[] = []

    for (const a of this.agents) {
      if (a.noTouch > 0 || (a.state === 'down' && !a.isKeeper)) continue
      const d = Math.hypot(a.pos.x - b.x, a.pos.y - b.y)
      if (d > 3) continue
      // Keepers (hands) inside their box.
      if (a.isKeeper && this.inOwnBox(a, bp)) {
        let reachD = d
        // Off his line closing down a shooter, a keeper spreads himself (bigger, lower barrier).
        const off = Math.abs(a.pos.x - ownGoalX(a.team))
        const spread = !a.isHero && off > 3 && a.state === 'run' && !!this.shot && this.shot.by.team !== a.team && this.time - this.shot.t < 0.25
        let reachR = spread ? 0.95 : 0.6
        let reachZ = spread ? 1.9 : 2.45 + a.z
        if (a.state === 'dive') {
          // The diving body is a line from trailing legs to fingertips: a ball behind the body (over-dive) still hits it.
          const seg = pointSegment(bp, add(a.pos, scale(a.actionDir, -DIVE_BODY_BACK)), add(a.pos, scale(a.actionDir, keeperReach(a))))
          reachD = seg.d
          reachR = 0.32
          reachZ = 2.4 + a.z
        }
        if (reachD < reachR + BALL_RADIUS && b.z < reachZ && !(this.shot?.beaten.has(a.id))) {
          if (reachD < bestD) {
            best = a
            bestD = reachD
            mode = 'keeper'
          }
        }
        continue
      }
      // Shot blocks by opponents of the shooter (bodies in the way, incl. jumping wall).
      if (this.shot && this.shot.by.team !== a.team && speed > 12 && d < 0.46 && b.z < 1.8 + a.z) {
        if (d < bestD) {
          best = a
          bestD = d
          mode = 'body'
        }
        continue
      }
      // Headers: ball centre between shoulders and just over the top of the head.
      const headZ = 1.72 + a.z
      const headR = 0.55 + a01(a.attrs.heading) * 0.2 + (a.state === 'jump' ? 0.15 : 0)
      if (b.z > 1.15 && b.z > headZ - 0.42 && b.z < headZ + 0.28 && d < headR) {
        // A fast shot hitting an opponent's head is a block, not a controlled header.
        if (this.shot && this.shot.by.team !== a.team && speed > 15) {
          if (d < bestD) {
            best = a
            bestD = d
            mode = 'body'
          }
          continue
        }
        if (a.isHero && a.state !== 'jump') {
          // Hero must time the jump to head it; a ball at chest height can be brought down
          // (and is contested like any aerial ball).
          if (b.z < 1.95 && d < 0.8) heads.push(a)
          continue
        }
        heads.push(a)
        continue
      }
      // Feet / chest.
      const footR = a.state === 'slide' ? 0.85 : 0.62
      if (b.z < 1.2 && d < footR && d < bestD) {
        best = a
        bestD = d
        mode = 'feet'
      }
    }
    if (heads.length && mode !== 'keeper' && mode !== 'body') {
      best = this.headerContest(heads, bp)
      // The hero on the ground wins it with his chest: a first touch, not a header.
      mode = best.isHero && best.state !== 'jump' ? 'feet' : 'head'
    }
    if (!best) return
    switch (mode) {
      case 'keeper':
        return this.keeperContact(best, speed)
      case 'body':
        return this.block(best)
      case 'head':
        return this.headerContact(best)
      case 'feet':
        return this.feetContact(best, speed)
    }
  }

  /**
   * Aerial duel: everyone close enough to jump for the ball competes, not just
   * whoever is nearest. Heading, jumping and strength, distance to the ball
   * and (for the hero) the timing of the jump decide who wins it.
   */
  private headerContest(heads: Agent[], bp: Vec2): Agent {
    const b = this.ball
    const pool = new Set<Agent>(heads)
    for (const a of this.agents) {
      if (pool.has(a) || a.noTouch > 0 || a.state === 'down' || a.isKeeper) continue
      if (a.isHero && a.state !== 'jump') continue
      const jumpTop = 1.72 + 0.3 + a01(a.attrs.jumping) * 0.45 + 0.28
      if (b.z < 1.15 || b.z > jumpTop) continue
      if (dist(a.pos, bp) < 1.15) pool.add(a)
    }
    const list = [...pool]
    if (list.length === 1) return list[0]
    // Body position: the player in front (toward where the ball comes from) gets there first.
    const inc = norm({ x: -b.vx, y: -b.vy })
    const frontness = (a: Agent) => (a.pos.x - bp.x) * inc.x + (a.pos.y - bp.y) * inc.y
    const front = Math.max(...list.map(frontness))
    const weight = (a: Agent) => {
      const d = dist(a.pos, bp)
      const lead = frontness(a) >= front - 0.15 ? 1.6 : 1
      let w = (0.35 + a01(a.attrs.heading) * 0.35 + a01(a.attrs.jumping) * 0.3 + a01(a.attrs.strength) * 0.2) * Math.max(0.05, 1.2 - d / 1.15)
      if (a.isHero && a.state !== 'jump') {
        // Chest control: positioning under the ball and first touch / strength to hold off the marker.
        w = (0.4 + a01(a.attrs.firstTouch) * 0.35 + a01(a.attrs.strength) * 0.3) * Math.max(0.05, 1.25 - d / 0.8)
      } else if (a.isHero) {
        const timing = a.stateT > 0.12 && a.stateT < 0.44 ? 1 : 0.5
        w *= 0.8 + timing * 0.6
      } else if (a.team === 'opp') w *= this.difficulty
      return w * lead
    }
    const winner = this.rng.weighted(list, weight)
    for (const a of list) {
      if (a === winner) continue
      a.noTouch = Math.max(a.noTouch, 0.35)
      if (!a.isHero && a.state === 'run') {
        a.state = 'jump'
        a.stateT = 0
      }
    }
    if (!winner.isHero && winner.state === 'run') {
      winner.state = 'jump'
      winner.stateT = 0.2
    }
    return winner
  }

  private inOwnBox(a: Agent, p: Vec2): boolean {
    const gx = ownGoalX(a.team)
    return Math.abs(p.x - gx) < 16.5 && Math.abs(p.y - GOAL_CENTER_Y) < 20.2
  }

  private block(a: Agent): void {
    if (this.offsideCheck(a)) return
    const b = this.ball
    const sp = Math.hypot(b.vx, b.vy)
    const ang = Math.atan2(-b.vy, -b.vx) + this.rng.range(-1.1, 1.1)
    b.vx = Math.cos(ang) * sp * 0.3
    b.vy = Math.sin(ang) * sp * 0.3
    b.vz = this.rng.range(0.5, 3.5)
    b.spin.side = 0
    a.noTouch = 0.35
    this.lastTouch = a
    if (a.isHero && this.defending) {
      this.stats.tackles++
      this.oppShotFree = false
    }
    if (this.shot) this.shot.blocked = true
    this.events.push({ type: 'block', by: a.id, x: b.x, y: b.y })
  }

  private headerContact(a: Agent): void {
    const b = this.ball
    const bp = { x: b.x, y: b.y }
    if (a.isHero) {
      // Timing quality: how close to the apex & ball centre.
      const dz = Math.abs(b.z - (1.78 + a.z))
      const timing = clamp01(1 - dz / 0.5) * (a.stateT > 0.12 && a.stateT < 0.44 ? 1 : 0.7)
      const aim = this.heroHeaderAim ?? this.autoGoalAim()
      const plan = planKick({ kind: 'header', from: bp, fromZ: b.z, target: aim, targetZ: 0.6, power: 0.55 + timing * 0.45, curl: 0, attrs: a.attrs, pressure: this.pressureOn(a), assist: this.assist, assistPull: this.assistPull(), env: this.env, noiseScale: (1.6 - timing * 0.8) * this.noiseScale() * HERO_SHOT_NOISE * HERO_HEADER_NOISE }, this.rng)
      this.kickBall(a, plan, 'header', 0.55 + timing * 0.45, null)
      this.stopBullet()
      return
    }
    const attacking = a.team === 'hero' ? b.x > PITCH_LENGTH - 20 : b.x < 20
    if (attacking) {
      // Head it down and away from the keeper.
      const aim = shotTarget(bp, a.team, this.aiWorld(), this.rng)
      const plan = planKick({ kind: 'header', from: bp, fromZ: b.z, target: { x: aim.x + attackDir(a.team) * 0.2, y: aim.y }, targetZ: 0.45, power: 0.8, curl: 0, attrs: a.attrs, pressure: this.pressureOn(a), assist: 'manual', env: this.env, noiseScale: a.team === 'opp' ? 1 / this.difficulty : 1 }, this.rng)
      this.kickBall(a, plan, 'header', 0.8, null)
    } else {
      // Defensive clearance header: up and away.
      const away = attackDir(a.team)
      const target = inField({ x: b.x + away * this.rng.range(14, 24), y: b.y + this.rng.range(-10, 10) }, 2)
      const plan = planKick({ kind: 'clear', from: bp, fromZ: b.z, target, power: 0.7, curl: 0, attrs: a.attrs, pressure: 0.5, assist: 'manual', env: this.env }, this.rng)
      this.kickBall(a, plan, 'clear', 0.7, null)
      this.events.push({ type: 'header', by: a.id })
    }
  }

  private feetContact(a: Agent, speed: number): void {
    const b = this.ball
    const rel = Math.hypot(b.vx - a.vel.x, b.vy - a.vel.y, b.vz)
    const limit = 9.5 + a01(a.attrs.firstTouch) * 9 + (a.isHero && this.assist === 'full' ? 3 : 0)
    // Hero slide tackle on a loose ball.
    if (a.isHero && a.state === 'slide') {
      if (this.offsideCheck(a)) return
      this.heroTackleResolved = true
      b.vx = a.actionDir.x * 8
      b.vy = a.actionDir.y * 8
      b.vz = 0.5
      this.lastTouch = a
      a.noTouch = 0.3
      this.events.push({ type: 'tackle', by: a.id, won: true, slide: true, x: a.pos.x, y: a.pos.y })
      if (this.defending) {
        this.stats.tackles++
        this.finish('defended', 'slide won ball')
      }
      return
    }
    const opponentsBall = this.lastTouch && this.lastTouch.team !== a.team
    // Interception skill for opponents of the passer.
    if (opponentsBall && !a.isHero && speed > 6) {
      const helper = a.team === 'hero' && this.defending
      const p = helper
        ? 0.18 + a01(a.attrs.positioning) * 0.25
        : 0.45 + a01(a.attrs.positioning) * 0.35 + (a.team === 'opp' ? (this.difficulty - 1) * 0.4 : 0)
      if (!this.rng.chance(clamp01(p))) {
        a.noTouch = 0.5
        return
      }
    }
    if (this.offsideCheck(a)) return
    if (rel < limit) {
      this.setOwner(a)
      return
    }
    // Heavy touch: ball pops off.
    const f = fromAngle(a.facing)
    b.vx = b.vx * 0.3 + f.x * 3
    b.vy = b.vy * 0.3 + f.y * 3
    b.vz = Math.min(3, rel * 0.08)
    a.noTouch = 0.3
    this.lastTouch = a
    this.events.push({ type: 'touch', by: a.id, hero: a.isHero, x: a.pos.x, y: a.pos.y })
  }

  private keeperContact(k: Agent, speed: number): void {
    if (this.offsideCheck(k)) return
    const b = this.ball
    const bp = { x: b.x, y: b.y }
    let stretch = 0.15
    if (k.state === 'dive') stretch = clamp01(pointSegment(bp, k.pos, add(k.pos, scale(k.actionDir, keeperReach(k)))).t)
    let p = saveChance(k, stretch, speed, this.difficulty)
    if (this.shot && this.shot.by.team !== k.team) p += KEEPER_SAVE_BONUS
    if (speed < 11) p = 1
    if (k.isHero) p = clamp01(p + 0.12)
    if (!this.rng.chance(p)) {
      // Fingertips — slight deflection, keeper beaten.
      if (this.shot) this.shot.beaten.add(k.id)
      k.noTouch = 0.6
      b.vx *= 0.9
      b.vy *= 0.9
      return
    }
    const held = speed < 11 || this.rng.chance(catchChance(k, speed, stretch, this.difficulty))
    if (held) {
      this.events.push({ type: 'save', by: k.id, held: true, x: b.x, y: b.y, z: b.z })
      const wasShot = this.shot
      this.setOwner(k)
      this.shot = wasShot
      this.onKeeperHold(k)
    } else {
      // Parry wide/away from goal.
      const inward = attackDir(k.team)
      const side = b.y >= GOAL_CENTER_Y ? 1 : -1
      const d = norm({ x: inward * this.rng.range(0.3, 1), y: side * this.rng.range(0.6, 1.2) })
      const sp = Math.max(5, speed * this.rng.range(0.25, 0.4))
      b.vx = d.x * sp
      b.vy = d.y * sp
      b.vz = this.rng.range(1.5, 4.5)
      b.spin.side = 0
      k.noTouch = 0.7
      this.lastTouch = k
      if (this.shot) this.shot.parried = true
      this.events.push({ type: 'save', by: k.id, held: false, x: b.x, y: b.y, z: b.z })
    }
  }

  // ───────────────────────── Offside ─────────────────────────

  /**
   * Called on every touch of a loose ball. The first touch after a pass
   * settles the offside snapshot: if the toucher was offside when the ball was
   * played the flag goes up (returns true, play is dead); otherwise the
   * snapshot is cleared.
   */
  private offsideCheck(a: Agent): boolean {
    const snap = this.offsideSnap
    if (!snap) return false
    this.offsideSnap = null
    if (!snap.ids.has(a.id) || this.phase !== 'live') return false
    const b = this.ball
    this.events.push({ type: 'offside', by: a.id, team: snap.team, x: a.pos.x, y: a.pos.y })
    // Play stops: the receiver checks the ball, everyone eases off.
    b.vx *= 0.25
    b.vy *= 0.25
    b.vz = Math.min(b.vz, 0)
    a.noTouch = 1
    this.heroPassTo = null
    this.assistChain = null
    const offside = { playerId: a.id, byHero: a.isHero }
    if (snap.team === 'hero') this.finish('lost_ball', 'offside', { offside })
    else this.finish('defended', 'opponent offside', { offside })
    return true
  }

  // ───────────────────────── Duels ─────────────────────────

  private duels(): void {
    const o = this.owner
    const hero = this.hero
    // Hero slide tackle vs carrier.
    if (hero.state === 'slide' && !this.heroTackleResolved && o && o.team === 'opp') {
      const foot = add(hero.pos, scale(hero.actionDir, 0.6))
      const bp = { x: this.ball.x, y: this.ball.y }
      const behind = isBehind(o, hero)
      if (dist(foot, bp) < 0.75) {
        this.heroTackleResolved = true
        // Sliding in only pays off when the ball is away from his feet.
        const odds = tackleOdds(hero, o, Math.min(0.95, this.exposure(o) + 0.1), behind, true, this.difficulty)
        if (this.rng.chance(odds.win)) {
          this.winBall(hero, o, true)
          this.finish('defended', 'slide tackle')
        } else if (this.rng.chance(odds.foul)) {
          this.heroFoul(o, true, behind)
        } else {
          // Carrier skips over it.
          o.vel = scale(o.vel, 1.1)
        }
        return
      }
      if (dist(hero.pos, o.pos) < 0.7) {
        this.heroTackleResolved = true
        const odds = tackleOdds(hero, o, 0.3, behind, true, this.difficulty)
        if (this.rng.chance(Math.min(0.95, odds.foul + 0.35))) this.heroFoul(o, true, behind)
        return
      }
    }
    if (!o || o.isKeeper) return
    if (this.keeperSmother(o)) return
    // AI tackles on the carrier.
    for (const a of this.agents) {
      if (a.team === o.team || a.isHero || a.isKeeper || a.cd > 0 || a.noTouch > 0 || a.state !== 'run') continue
      const d = dist(a.pos, o.pos)
      if (d > 1.25) continue
      const rate = (0.55 + a01(a.attrs.tackling) * 1.0) * (a.team === 'opp' ? this.difficulty : this.defending ? 0.3 : 0.8)
      if (!this.rng.chance(rate * DT)) continue
      a.cd = 1.1
      const behind = isBehind(o, a)
      const odds = tackleOdds(a, o, this.exposure(o), behind, false, this.difficulty)
      if (this.rng.chance(odds.win)) {
        this.winBall(a, o, false)
        if (o.isHero) o.noTouch = 0.7
      } else if (a.team === 'opp' && this.rng.chance(odds.foul * 0.3)) {
        this.events.push({ type: 'foul', by: a.id, on: o.id })
        if (o.isHero && this.rng.chance(0.03)) this.injured = true
        this.finish(this.defending ? 'defended' : 'foul_won', 'fouled')
        return
      } else {
        a.state = 'down'
        a.stateT = 0
        a.noTouch = 0.6
        if (o.isHero) this.stats.dribbles++
        this.events.push({ type: 'tackle', by: a.id, won: false, slide: false, x: a.pos.x, y: a.pos.y })
      }
    }
  }

  // ───────────────────────── Keepers ─────────────────────────

  /**
   * An AI keeper closing down a dribbler in his box goes down at his feet:
   * timing (ball off the carrier's foot), handling/agility vs dribbling decide it.
   * Beaten, he is left on the ground. Returns true when the duel ended play.
   */
  private keeperSmother(o: Agent): boolean {
    const k = this.agents.find((a) => a.isKeeper && a.team !== o.team && !a.isHero)
    if (!k || k.state !== 'run' || k.cd > 0 || k.noTouch > 0 || !this.inOwnBox(k, o.pos)) return false
    if (dist(k.pos, { x: this.ball.x, y: this.ball.y }) > 1.5 && dist(k.pos, o.pos) > 1.3) return false
    k.cd = 1.2
    const g = a01(k.attrs.handling) * 0.35 + a01(k.attrs.agility) * 0.35 + a01(k.attrs.positioning) * 0.3
    const c = a01(o.attrs.dribbling) * 0.6 + a01(o.attrs.agility) * 0.25 + a01(o.attrs.composure) * 0.15
    const diffAdj = k.team === 'opp' ? (this.difficulty - 1) * 0.3 : 0
    const p = clampN(0.33 + (g - c) * 0.8 + (this.exposure(o) - 0.55) * 0.7 + diffAdj, 0.1, 0.9)
    k.state = 'dive'
    k.stateT = DIVE_PEAK * 0.6
    k.actionDir = norm(sub(o.pos, k.pos))
    this.events.push({ type: 'dive', by: k.id })
    if (this.rng.chance(p)) {
      o.noTouch = 0.8
      this.events.push({ type: 'save', by: k.id, held: true, x: this.ball.x, y: this.ball.y, z: 0 })
      const wasShot = this.shot
      this.setOwner(k)
      this.shot = wasShot
      this.onKeeperHold(k)
      return true
    }
    k.noTouch = 0.9
    return false
  }

  private keeperLogic(): void {
    const al = this.keeperAlert
    if (!al || this.time < al.at) return
    this.keeperAlert = null
    const k = al.keeper
    if (k.state === 'dive' || this.owner) return
    const plan = planSave(k, this.aiWorld(), 0)
    if (!plan) return
    if (al.penaltyGuess) {
      const g = al.penaltyGuess
      if (g.centre) return
      const actualSide = Math.sign(plan.point.y - k.pos.y) || 1
      const side = g.read ? actualSide : -actualSide
      const target = g.read ? plan.point : { x: k.pos.x, y: GOAL_CENTER_Y + side * 2.6 }
      this.startDive(k, norm(sub(target, k.pos)))
      return
    }
    if (!plan.onTarget) return
    const lateral = Math.abs(plan.point.y - k.pos.y)
    if (lateral < 0.55 && plan.z < KEEPER_STAND_MAX_Z) {
      k.intent = { kind: 'run', to: plan.point, until: this.time + 1 }
      return
    }
    // Shuffle across first; commit to the dive so full stretch coincides with the ball's arrival.
    const lead = DIVE_PEAK + 0.04
    if (plan.t > lead + DT * 2) {
      k.intent = { kind: 'run', to: plan.point, until: this.time + 1 }
      this.keeperAlert = { keeper: k, at: this.time + Math.min(0.12, plan.t - lead) }
      return
    }
    this.startDive(k, norm(sub(plan.point, k.pos)))
  }

  private onKeeperHold(k: Agent): void {
    const s = this.shot
    if (k.team === 'opp') {
      if (s && s.by.isHero) {
        this.stats.shotsOnTarget++
        this.finish('saved', 'keeper holds hero shot')
      } else if (s && s.by.team === 'hero') {
        this.finish(s.assistBy ? 'pass_complete' : this.heroInvolvedOutcome(), 'keeper holds teammate shot')
      } else {
        this.finish('lost_ball', 'keeper claims')
      }
    } else {
      this.finish('defended', 'keeper holds')
    }
  }

  // ───────────────────────── Ending ─────────────────────────

  private heroInvolvedOutcome(): HighlightOutcome {
    if (this.stats.passesCompleted > 0) return 'pass_complete'
    // Bringing a long ball down and keeping it is the job done.
    if (this.kind === 'long_ball_control' && this.heroControlled && this.owner?.team === 'hero') return 'pass_complete'
    return 'timeout'
  }

  private onGoal(end: 'west' | 'east'): void {
    this.goalTime = this.time
    if (this.phase !== 'live') return
    const s = this.shot
    if (end === 'east') {
      // Hero team scores.
      let scorer = this.lastTouch && this.lastTouch.team === 'hero' ? this.lastTouch : s && s.by.team === 'hero' ? s.by : null
      if (!scorer && s) scorer = s.by
      const scorerId = scorer ? scorer.id : this.hero.id
      this.events.push({ type: 'goal', team: 'hero', scorerId, end })
      if (scorer?.isHero) {
        this.stats.shotsOnTarget++
        this.finish('goal', 'hero scored', { scorerId: this.hero.id })
      } else if (s?.assistBy || this.assistChain === scorerId || (this.heroDeliveryAt >= 0 && this.time - this.heroDeliveryAt < 4)) {
        this.finish('assist', 'teammate scored from hero pass', { scorerId, assistId: this.hero.id })
      } else {
        this.finish(this.heroInvolvedOutcome(), 'teammate scored', { scorerId })
      }
    } else {
      const scorerId = this.lastTouch && this.lastTouch.team === 'opp' ? this.lastTouch.id : s?.by.id ?? 'opp'
      this.events.push({ type: 'goal', team: 'opp', scorerId, end })
      this.finish('conceded', 'goal against', { scorerId })
    }
    this.postLeft = 2.4
  }

  private onOut(): void {
    if (this.phase !== 'live') return
    const s = this.shot
    if (s && s.by.isHero) {
      if (s.parried) {
        this.stats.shotsOnTarget++
        return this.finish('saved', 'parried out')
      }
      if (s.blocked) return this.finish('blocked', 'blocked out')
      return this.finish(s.woodwork ? 'woodwork' : 'missed', 'shot out')
    }
    if (this.defending) return this.finish('defended', 'ball out')
    if (s && s.by.team === 'hero') return this.finish(s.assistBy ? 'pass_complete' : this.heroInvolvedOutcome(), 'teammate shot out')
    const lt = this.lastTouch
    if (lt && lt.team === 'opp') return this.finish(this.stats.passesCompleted > 0 ? 'pass_complete' : 'timeout', 'opponent put it out')
    return this.finish('lost_ball', 'hero team put it out')
  }

  private checkEnd(): void {
    if (this.phase !== 'live') return
    const o = this.owner
    // Long ball brought down and shielded under pressure: the job is done.
    if (this.kind === 'long_ball_control' && o === this.hero && this.time - this.ownerSince > 1.0) return this.finish('pass_complete', 'held up')
    if (!this.defending) {
      if (o && o.team === 'opp' && !o.isKeeper) {
        this.lossT += DT
        if (this.lossT > 1.1) {
          const s = this.shot
          if (s && s.by.isHero && s.blocked) return this.finish('blocked', 'blocked and cleared')
          if (s && s.by.isHero && s.parried) {
            this.stats.shotsOnTarget++
            return this.finish('saved', 'parried and cleared')
          }
          return this.finish('lost_ball', 'possession lost')
        }
      } else {
        this.lossT = Math.max(0, this.lossT - DT * 2)
      }
      if (this.oppClearedAt > 0 && this.time - this.oppClearedAt > 0.5 && !o) {
        const s = this.shot
        if (s && s.by.isHero && s.blocked) return this.finish('blocked', 'blocked & cleared')
        if (s && s.by.isHero && s.parried) {
          this.stats.shotsOnTarget++
          return this.finish('saved', 'parry cleared')
        }
        if (this.lastTouch?.team === 'opp' && Math.hypot(this.ball.vx, this.ball.vy) > 10) return this.finish('lost_ball', 'cleared')
      }
    } else {
      if (o && o.team === 'hero') {
        return this.finish('defended', 'won possession')
      }
      if (!o && this.lastTouch?.team === 'hero' && !this.lastTouch.isKeeper && this.lastTouch.isHero === false && Math.hypot(this.ball.vx, this.ball.vy) > 12) {
        return this.finish('defended', 'teammate cleared')
      }
    }
    // Penalty: once the shot is dead, resolve.
    if (this.kind === 'penalty' || this.kind === 'gk_penalty') {
      const s = this.shot
      const slow = Math.hypot(this.ball.vx, this.ball.vy, this.ball.vz) < 1.5
      if (s && this.time - s.t > 0.5 && (slow || this.time - s.t > 3)) {
        if (this.kind === 'penalty') {
          if (s.parried) this.stats.shotsOnTarget++
          return this.finish(s.parried ? 'saved' : s.woodwork ? 'woodwork' : 'missed', 'penalty dead')
        }
        return this.finish('defended', 'penalty dead')
      }
    }
    // Time limit — but let a shot/cross in flight resolve (up to 3 s extra).
    if (this.time >= this.timeLimit) {
      const inFlight = !this.owner && Math.hypot(this.ball.vx, this.ball.vy, this.ball.vz) > 4
      if (inFlight && this.time < this.timeLimit + 3) return
      if (this.defending) return this.finish(isKeeperKind(this.kind) ? 'defended' : 'timeout', 'time limit')
      return this.finish(this.heroInvolvedOutcome(), 'time limit')
    }
  }

  private finish(outcomeIn: HighlightOutcome, reason: string, extra: Partial<HighlightResult> = {}): void {
    if (this.result) return
    // Stopping the attacker means stopping the shot: a save by our keeper or a miss after the
    // hero was beaten is a chance conceded, unless the hero himself won the ball back.
    let outcome = outcomeIn
    if (outcome === 'defended' && this.oppShotFree && !(this.owner?.isHero)) outcome = 'shot_conceded'
    this.result = this.buildResult(outcome, extra)
    this.endReason = reason
    this.phase = 'post'
    this.postLeft = outcome === 'goal' || outcome === 'assist' || outcome === 'conceded' ? 2.4 : 1.3
    this.stopBullet()
    this.events.push({ type: 'whistle', long: true })
    this.events.push({ type: 'end', result: this.result, reason })
  }

  // ───────────────────────── Misc ─────────────────────────

  /** True while a shot is being tracked (tests / diagnostics). */
  shotActive(): boolean {
    return this.shot !== null
  }

  /** Current AI world view. */
  aiWorld(): AiWorld {
    return { agents: this.agents, ball: this.ball, owner: this.owner, env: this.env, time: this.time, difficulty: this.difficulty, kind: this.kind }
  }

  /** True if the hero is the intended target of the incoming ball (header prompt). */
  get headerChance(): boolean {
    if (this.owner || this.hero.isKeeper || this.ball.z < 0.9) return false
    const c = predictPlaneCrossing(this.ball, this.env, this.hero.pos.x, 1.5)
    return !!c && Math.abs(c.y - this.hero.pos.y) < 3 && c.z > 1 && c.z < 3
  }

  private record(): void {
    // Cross slow-mo: when a delivery is about to reach the hero.
    if (this.crossBulletArmed && !this.owner && this.phase === 'live') {
      const eta = dist(this.ball, this.hero.pos) / Math.max(4, Math.hypot(this.ball.vx, this.ball.vy))
      if (eta < 0.75 && this.ball.z > 0.8) {
        this.crossBulletArmed = false
        this.startBullet(0.4, 0.55 + a01(this.hero.attrs.composure) * 0.4)
      }
    }
    const n = this.agents.length
    const arr = new Float32Array(n * 5)
    for (let i = 0; i < n; i++) {
      const a = this.agents[i]
      arr[i * 5] = a.pos.x
      arr[i * 5 + 1] = a.pos.y
      arr[i * 5 + 2] = a.z
      arr[i * 5 + 3] = a.facing
      arr[i * 5 + 4] = STATE_CODES.indexOf(a.state)
    }
    this.frames.push({ t: this.time, bx: this.ball.x, by: this.ball.y, bz: this.ball.z, agents: arr })
    const max = Math.round(REPLAY_SECONDS / DT)
    if (this.frames.length > max) this.frames.splice(0, this.frames.length - max)
  }
}

/** Whether the hero's team is defending in a kind. */
export { isDefendingKind, isKeeperKind }

/** Pitch extents for renderers. */
export const PITCH = { length: PITCH_LENGTH, width: PITCH_WIDTH, goalHeight: GOAL_HEIGHT }
