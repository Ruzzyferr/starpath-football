/**
 * Finishing drill (shooting / set-piece sessions).
 *
 * Target grid (2.3#23): 10 shots from new spots 13–24 m out. One of the 9
 * zones of a 3×3 goal grid lights up per shot, in a shuffled sequence: the
 * zone centre scores 10, the rest of the zone 6, any other goal 2. The keeper
 * joins from shot 3 (moving keeper). Shots use the match kick model
 * (swipe / hold-release / pad) and the AI keeper reacts like in a highlight.
 *
 * Set-piece variant = curl gate (2.3#25): 5 free kicks; the two gates are the
 * outer thirds of the goal. A goal scores 20; a kick over the wall into a gate
 * that the keeper saves 4, one at his middle third 2. Every kick gets its own
 * wind, shown in km/h with an arrow.
 */
import { Rng } from '../../../core/rng'
import { PITCH_LENGTH } from '../../../sim/match/types'
import { DRILL_SCENARIO_WEIGHTS, applyKeeperScenario, buildKeeperScenario, momentumDelay, pickScenarioKind, type KeeperScenario, type KeeperScenarioKind } from '../../keeperScenario'
import { createTracker, GOAL_CENTER_Y, isOnTarget, predictPlaneCrossing, stepBall, type BallState, type BallTracker, type PhysicsEvent } from '../../physics'
import { flatAttrs } from '../../setup'
import { add, dist, norm, scale, sub, type Agent, type Vec2 } from '../../model'
import { DrillBase, actorView, makeActor, place, snapPrev } from '../base'
import { aiKeeperReact, drillKeeperSpot, integrateKeeper, keeperReach, keeperWorld, resolveSave } from '../keeper'
import { CURL_GATE_ATTEMPTS, CURL_GATE_MAX_WIND, CURL_GATE_INNER, CURL_GATE_MIDDLE_POINTS, CURL_GATE_SAVED_POINTS, curlGoalPoints, drillNoise, GRID_CENTRE_R, GRID_KEEPER_FROM, GRID_SHOTS, GRID_ZONE_R, gridShotPoints, msToKmh } from '../scoring'
import { distanceToGoal, planIntent, previewPath, shotIntent } from '../shooting'
import { kickSkill } from '../../kick'
import type { DrillConfig, DrillInput, DrillView, GoalTargetView } from '../types'

type AttemptState = 'ready' | 'flight' | 'resolved'

interface Target {
  baseY: number
  baseZ: number
  phase: number
  lit: boolean
  hitT: number
}

const CORNERS: readonly [number, number][] = [
  [GOAL_CENTER_Y - 2.85, 0.5],
  [GOAL_CENTER_Y + 2.85, 0.5],
  [GOAL_CENTER_Y - 2.85, 1.8],
  [GOAL_CENTER_Y + 2.85, 1.8],
]
const TARGET_R = 0.78
/** 3×3 goal grid zone centres (y, z), row by row from the bottom. */
const GRID: readonly [number, number][] = [0.45, 1.22, 1.99].flatMap((z) => [-2.44, 0, 2.44].map((dy): [number, number] => [GOAL_CENTER_Y + dy, z]))
const WALL_GAP = 9.15
/** Curl gate: the two gates drawn in the goal mouth (outer thirds). */
const CURL_GATES: readonly [number, number][] = [[GOAL_CENTER_Y - 2.55, 1.2], [GOAL_CENTER_Y + 2.55, 1.2]]
/** A training keeper reads the strike a beat later than a match keeper (s): placement beats him, a shot at him does not. */
const KEEPER_LATE = 0.15
/** The wall screens the keeper on a free kick: he picks the ball up later (s). */
const WALL_SCREEN = 0.06
/** Free kicks from 19–27 m: the curl gate leans on the set-piece skill (aim spread at the drill's noise). */
const SET_PIECE_NOISE = 1.4

export class FinishingDrill extends DrillBase {
  readonly hero: Agent
  readonly keeper: Agent
  readonly wall: Agent[] = []
  readonly ball: BallState
  private tracker: BallTracker = createTracker()
  private readonly phys: PhysicsEvent[] = []
  private readonly targets: Target[]
  private state: AttemptState = 'ready'
  private stateT = 0
  private spot: Vec2 = { x: PITCH_LENGTH - 18, y: GOAL_CENTER_Y }
  private keeperHome: Vec2
  private react: ((now: number) => boolean) | null = null
  private touched: 'held' | 'parried' | 'blocked' | null = null
  private woodwork = false
  private attempt = 0
  /** Curl gate: the kick was struck between the posts (predicted at the strike). */
  private onTarget = false
  /** Curl gate: the predicted crossing is in one of the two gates (the outer thirds of the goal). */
  private inGate = false
  /** Shuffled 3×3 zone sequence (standard variant). */
  private readonly sequence: number[] = []
  private aim: DrillInput['aim'] = null
  /** Keeper motion scenario of the current attempt (keeperScenario.ts); own seeded stream. */
  private readonly gkRng: Rng
  private scn: KeeperScenario | null = null
  private scnT = 0
  private scnFrom: Vec2 = { x: 0, y: 0 }

  constructor(cfg: DrillConfig) {
    super('finishing', cfg)
    this.gkRng = new Rng(`finishing-gk:${String(cfg.seed ?? 0)}:${this.variant}`)
    this.hero = makeActor('hero', 'hero', 'ST', { x: 80, y: GOAL_CENTER_Y }, this.attrs, { hero: true, number: 9 })
    // The keeper is the opposition: his reflexes, diving and handling decide the saves.
    this.keeper = makeActor('gk', 'opp', 'GK', { x: PITCH_LENGTH - 1.2, y: GOAL_CENTER_Y }, flatAttrs(this.oppLevel, true), { number: 1 })
    this.keeperHome = { ...this.keeper.pos }
    this.ball = { x: 80, y: GOAL_CENTER_Y, z: 0, vx: 0, vy: 0, vz: 0, spin: { side: 0, top: 0 } }
    this.targets = (this.variant === 'setPiece' ? CORNERS : GRID).map(([y, z], i) => ({ baseY: y, baseZ: z, phase: i * 1.7, lit: false, hitT: -9 }))
    if (this.variant !== 'setPiece') {
      const seq = GRID.map((_, i) => i)
      for (let i = seq.length - 1; i > 0; i--) {
        const j = this.rng.int(0, i)
        ;[seq[i], seq[j]] = [seq[j]!, seq[i]!]
      }
      this.sequence.push(...seq)
    }
    if (this.variant === 'setPiece') {
      for (let i = 0; i < 4; i++) this.wall.push(makeActor(`w${i}`, 'opp', 'CB', { x: 90, y: GOAL_CENTER_Y }, flatAttrs(60), { number: 2 + i }))
    }
    this.newAttempt()
  }

  // ───────────────────────── Attempt flow ─────────────────────────

  private newAttempt(): void {
    this.attempt++
    const sp = this.variant === 'setPiece'
    const d = sp ? this.rng.range(19, 27) : this.rng.range(13, 24)
    const th = (this.rng.chance(0.5) ? 1 : -1) * this.rng.range(0, sp ? 0.45 : 0.62)
    this.spot = { x: PITCH_LENGTH - d * Math.cos(th), y: GOAL_CENTER_Y + d * Math.sin(th) }
    this.tracker = createTracker()
    Object.assign(this.ball, { x: this.spot.x, y: this.spot.y, z: 0, vx: 0, vy: 0, vz: 0 })
    this.ball.spin = { side: 0, top: 0 }
    const toGoal = norm(sub({ x: PITCH_LENGTH, y: GOAL_CENTER_Y }, this.spot))
    place(this.hero, sub(this.spot, scale(toGoal, 0.75)), Math.atan2(toGoal.y, toGoal.x))
    // The next zone of the shuffled sequence lights up.
    const lit = this.sequence.length ? this.sequence[(this.attempt - 1) % this.sequence.length] : -1
    this.targets.forEach((t, i) => {
      t.lit = i === lit
    })
    if (this.wall.length) this.buildWall(toGoal)
    if (sp) {
      // Fresh wind every kick, never hidden (2.3#25).
      const ws = this.rng.range(0, CURL_GATE_MAX_WIND)
      const wa = this.rng.range(0, Math.PI * 2)
      this.env.wind = { x: Math.cos(wa) * ws, y: Math.sin(wa) * ws }
      this.targets.forEach((t) => { t.lit = false })
    }
    this.onTarget = false
    this.inGate = false
    this.keeper.noTouch = 0
    place(this.keeper, this.keeperLive ? this.keeper.pos : { x: PITCH_LENGTH - 0.4, y: GOAL_CENTER_Y + 5.2 }, Math.PI)
    this.keeperHome = drillKeeperSpot(this.keeper, keeperWorld(this.keeper, [this.hero], this.ball, this.env, this.time, this.oppSharpness))
    // Free kick: the wall takes the near post, the keeper stands just off the middle toward the far post.
    if (sp) this.keeperHome = { x: PITCH_LENGTH - 0.7, y: GOAL_CENTER_Y + (this.spot.y < GOAL_CENTER_Y ? 0.8 : -0.8) }
    // Moving keeper (grid attempts with a keeper): start him in a seeded motion scenario.
    this.scn = null
    this.scnT = 0
    if (this.keeperLive && this.variant !== 'setPiece') {
      const kind = pickScenarioKind(this.gkRng, DRILL_SCENARIO_WEIGHTS)
      const sc = buildKeeperScenario(kind, this.gkRng, this.keeper, { goalX: PITCH_LENGTH, inward: -1, home: this.keeperHome, ball: this.spot, difficulty: 1, holdScale: 1.6 })
      if (sc.kind !== 'set') {
        this.keeper.state = 'run'
        this.keeper.stateT = 0
        applyKeeperScenario(this.keeper, sc, 0.5)
        this.scn = sc
      }
    }
    this.scnFrom = { ...this.keeper.pos }
    this.react = null
    this.touched = null
    this.woodwork = false
    this.state = 'ready'
    this.stateT = 0
  }

  /** Four-man wall 9.15 m out, shifted to cover the near-post side. */
  private buildWall(toGoal: Vec2): void {
    const centre = add(this.spot, scale(toGoal, WALL_GAP))
    const perp = { x: -toGoal.y, y: toGoal.x }
    const nearPostSide = this.spot.y < GOAL_CENTER_Y ? -1 : 1
    const shift = Math.min(1.2, Math.abs(this.spot.y - GOAL_CENTER_Y) * 0.08) * nearPostSide
    this.wall.forEach((w, i) => {
      const off = (i - 1.5) * 0.62 + shift
      place(w, add(centre, scale(perp, off * (perp.y >= 0 ? 1 : -1))), Math.atan2(-toGoal.y, -toGoal.x))
      w.state = 'wall'
    })
  }

  private shoot(input: DrillInput): void {
    for (const act of input.actions) {
      const intent = shotIntent(act, this.spot)
      if (!intent) continue
      if (this.variant === 'setPiece' && intent.kind === 'shot') intent.kind = 'freekick'
      const skill = kickSkill(intent.kind, this.attrs, distanceToGoal(this.spot))
      const plan = planIntent(intent, { from: this.spot, attrs: this.attrs, assist: this.assist, env: this.env, noise: (this.variant === 'setPiece' ? SET_PIECE_NOISE : 0.9) * drillNoise(skill) }, this.rng)
      this.ball.vx = plan.vx
      this.ball.vy = plan.vy
      this.ball.vz = plan.vz
      this.ball.spin = { ...plan.spin }
      this.state = 'flight'
      this.stateT = 0
      if (this.variant === 'setPiece') {
        const c = predictPlaneCrossing(this.ball, this.env, PITCH_LENGTH, 3)
        this.onTarget = !!c && isOnTarget(c.y, c.z)
        this.inGate = this.onTarget && !!c && Math.abs(c.y - GOAL_CENTER_Y) >= CURL_GATE_INNER
      }
      this.stat('shots')
      this.events.push({ type: 'kick', power: intent.power, hero: true, x: this.spot.x, y: this.spot.y })
      const dir = norm({ x: plan.vx, y: plan.vy })
      this.hero.vel = scale(dir, 2.2)
      this.hero.state = 'skill'
      this.hero.stateT = 0
      for (const w of this.wall) {
        w.state = 'jump'
        w.stateT = 0
      }
      if (this.keeperLive) this.react = aiKeeperReact(this.keeper, () => keeperWorld(this.keeper, [this.hero], this.ball, this.env, this.time, this.oppSharpness), 1, KEEPER_LATE + (this.wall.length ? WALL_SCREEN : 0) + momentumDelay(this.keeper, plan.aim.y))
      return
    }
  }

  private resolve(kind: 'goal' | 'saved' | 'miss' | 'woodwork' | 'blocked', y = this.ball.y, z = this.ball.z): void {
    if (this.state !== 'flight') return
    this.state = 'resolved'
    this.stateT = 0
    const at = { x: Math.min(this.ball.x, PITCH_LENGTH), y, z }
    if (this.variant === 'setPiece') {
      // A gate is an outer third of the goal, over the wall: 20 for a goal, 4 when the keeper saves it;
      // a kick at the keeper's middle third that he saves earns 2.
      const through = kind === 'goal' || (kind === 'saved' && this.onTarget)
      if (through && (kind === 'goal' || this.inGate)) this.stat('gates')
      if (kind === 'goal') this.stat('goals')
      const pts = kind === 'goal' ? curlGoalPoints(Math.abs(y - GOAL_CENTER_Y)) : through ? (this.inGate ? CURL_GATE_SAVED_POINTS : CURL_GATE_MIDDLE_POINTS) : 0
      this.award(pts, through && (kind === 'goal' || this.inGate), { label: kind === 'goal' ? 'goal' : through ? (this.inGate ? 'gate' : 'saved') : kind === 'blocked' ? 'blocked' : 'gateMissed', ...at })
      return
    }
    const zone = this.targets.find((t) => t.lit)
    const pts = zone ? gridShotPoints(kind === 'goal', y, z, this.targetPos(zone)) : 0
    if (kind === 'goal') this.stat('goals')
    if (pts >= 6) {
      this.stat('targets')
      if (zone) zone.hitT = this.time
    }
    if (kind === 'goal' || pts > 0) return this.award(pts, pts >= 6, { label: pts >= 6 ? 'target' : 'goal', ...at })
    this.stat(kind === 'saved' ? 'saves' : kind === 'blocked' ? 'blocked' : kind === 'woodwork' ? 'woodwork' : 'misses')
    this.award(0, false, { label: kind === 'saved' ? 'saved' : kind === 'blocked' ? 'blocked' : kind === 'woodwork' ? 'post' : 'miss', ...at })
  }

  // ───────────────────────── Step ─────────────────────────

  protected beforeStep(): void {
    snapPrev([this.hero, this.keeper, ...this.wall])
  }

  override get heroStatic(): boolean {
    return true
  }

  /** The current attempt's keeper scenario ('set' when none). */
  get keeperScenarioKind(): KeeperScenarioKind {
    return this.scn?.kind ?? 'set'
  }

  /** Seconds since the ball was set for this attempt (0 once struck). */
  get attemptT(): number {
    return this.state === 'ready' ? this.stateT : 0
  }

  /** Seconds the keeper scenario has been playing. */
  get keeperScenarioT(): number {
    return this.scnT
  }

  /** The keeper has visibly moved since the attempt began. */
  get keeperScenarioMoved(): boolean {
    return dist(this.keeper.pos, this.scnFrom) > 0.3
  }

  protected busy(): boolean {
    return this.state === 'flight'
  }

  /** Curl gate ends after the fifth kick, the target grid after the tenth shot. */
  protected forceEnd(): boolean {
    const n = this.variant === 'setPiece' ? CURL_GATE_ATTEMPTS : GRID_SHOTS
    return this.attempt >= n && this.state === 'resolved' && this.stateT > 0.6
  }

  /** Target grid: keeper joins from shot 3; the curl gate always has one. */
  private get keeperLive(): boolean {
    return this.variant === 'setPiece' || this.attempt >= GRID_KEEPER_FROM
  }

  protected tick(dt: number, input: DrillInput, live: boolean): void {
    this.stateT += dt
    this.aim = live && this.state === 'ready' ? input.aim : null
    if (live && this.state === 'ready') this.shoot(input)

    // Hero: small follow-through, then settle.
    const h = this.hero
    h.stateT += dt
    if (h.state === 'skill' && h.stateT > 0.42) h.state = 'run'
    h.vel = scale(h.vel, 0.9)
    h.pos = add(h.pos, scale(h.vel, dt))

    // Wall jump arc.
    for (const w of this.wall) {
      w.stateT += dt
      if (w.state === 'jump') {
        w.z = Math.max(0, Math.sin((Math.PI * w.stateT) / 0.56) * 0.32)
        if (w.stateT > 0.56) {
          w.state = 'wall'
          w.z = 0
        }
      }
    }

    // Keeper.
    if (this.react && this.state === 'flight' && this.react(this.time)) this.react = null
    const intent = this.keeper.intent
    if (this.state === 'ready') this.scnT += dt
    const scn = this.state === 'ready' && this.scn && this.scnT < this.scn.hold ? this.scn : null
    const tgt = this.state === 'flight' && intent?.kind === 'run' ? intent.to : scn ? scn.to : this.state === 'ready' ? this.keeperHome : null
    integrateKeeper(this.keeper, dt, tgt, this.state === 'flight' ? 4.2 : scn ? scn.speed : 2.6)
    if (this.state !== 'flight') this.keeper.intent = null

    if (this.state === 'flight') this.flight()
    else if (this.state === 'resolved' && this.stateT > 0.85 && (live || this.phase === 'countdown')) this.newAttempt()
  }

  private flight(): void {
    const b = this.ball
    if (this.touched === 'held') {
      // Keeper holds: ball sticks to the gloves.
      b.x = this.keeper.pos.x - 0.3
      b.y = this.keeper.pos.y
      b.z = 0.9
      return
    }
    this.phys.length = 0
    stepBall(b, this.env, this.tracker, this.phys)
    for (const e of this.phys) {
      if (e.type === 'goal' && e.end === 'east') {
        this.events.push({ type: 'net', end: 'east', y: e.y, z: e.z, speed: Math.hypot(b.vx, b.vy) })
        return this.resolve('goal', e.y, e.z)
      }
      if (e.type === 'post' || e.type === 'bar') {
        this.woodwork = true
        this.events.push({ type: 'post', x: e.x, y: e.y, z: e.z, speed: e.speed })
      }
      if (e.type === 'out') return this.resolve(this.touched === 'parried' ? 'saved' : this.touched === 'blocked' ? 'blocked' : this.woodwork ? 'woodwork' : 'miss')
    }
    // Wall.
    if (!this.touched) {
      for (const w of this.wall) {
        if (dist(w.pos, b) < 0.42 && b.z < 1.85 + w.z) {
          this.touched = 'blocked'
          const sp = Math.hypot(b.vx, b.vy)
          b.vx = -b.vx * 0.25 + this.rng.range(-2, 2)
          b.vy = b.vy * 0.25 + this.rng.range(-3, 3)
          b.vz = this.rng.range(1, 3)
          b.spin = { side: 0, top: 0 }
          this.events.push({ type: 'touch', x: b.x, y: b.y })
          if (sp > 0) break
        }
      }
    }
    // Keeper.
    const touch = keeperReach(this.keeper, b)
    if (touch) {
      const res = resolveSave(this.rng, this.keeper, b, touch, this.oppSharpness)
      if (res !== 'beaten') {
        this.events.push({ type: 'save', hero: false, held: res === 'held', x: b.x, y: b.y, z: b.z })
        this.touched = res
        if (res === 'held') return this.resolve('saved')
      }
    }
    const slow = Math.hypot(b.vx, b.vy) < 0.8 && b.z < 0.05
    if (slow || this.stateT > 3.5) this.resolve(this.touched === 'parried' ? 'saved' : this.touched === 'blocked' ? 'blocked' : this.woodwork ? 'woodwork' : 'miss')
  }

  private targetPos(t: Target): { y: number; z: number; r: number } {
    if (this.variant !== 'setPiece') return { y: t.baseY, z: t.baseZ, r: GRID_ZONE_R }
    return {
      y: t.baseY + Math.sin(this.time * 0.9 + t.phase) * 0.35,
      z: Math.max(0.35, t.baseZ + Math.cos(this.time * 0.7 + t.phase) * 0.2),
      r: TARGET_R,
    }
  }

  /** Ball spot of the current attempt (bots/tests). */
  get ballSpot(): Vec2 {
    return { ...this.spot }
  }

  /** Lit target centres (bots/tests). */
  litTargets(): { y: number; z: number }[] {
    // Curl gate: the far-post top corner is the natural aim.
    if (this.variant === 'setPiece') return [{ y: GOAL_CENTER_Y + (this.spot.y < GOAL_CENTER_Y ? 2.6 : -2.6), z: 1.7 }]
    return this.targets.filter((t) => t.lit).map((t) => this.targetPos(t))
  }

  get ready(): boolean {
    return this.state === 'ready' && this.live
  }

  view(): DrillView {
    const goalTargets: GoalTargetView[] = this.variant === 'setPiece' ? CURL_GATES.map(([y, z]) => ({ end: 'east', y, z, r: 1.05, tone: 'gold' })) : this.targets.map((t) => {
      const p = this.targetPos(t)
      return { end: 'east', y: p.y, z: p.z, r: p.r, tone: this.time - t.hitT < 0.8 ? 'green' : t.lit ? 'gold' : 'dim' }
    })
    // The lit zone's 10-point centre.
    const lit = this.targets.find((t) => t.lit)
    if (lit && this.variant !== 'setPiece') goalTargets.push({ end: 'east', y: lit.baseY, z: lit.baseZ, r: GRID_CENTRE_R, tone: 'white' })
    let preview: DrillView['preview'] = null
    if (this.aim && this.state === 'ready') {
      const intent = shotIntent(this.aim, this.spot)
      if (intent && this.variant === 'setPiece' && intent.kind === 'shot') intent.kind = 'freekick'
      if (intent) preview = { points: previewPath(planIntent(intent, { from: this.spot, attrs: this.attrs, assist: this.assist, env: this.env }), this.spot, this.env), shot: true }
    }
    return {
      focus: { x: (this.spot.x + PITCH_LENGTH) / 2 + 1.5, y: (this.spot.y + GOAL_CENTER_Y) / 2 },
      span: 26,
      goals: ['east'],
      hero: actorView(this.hero, 'hero'),
      actors: [actorView(this.keeper, 'keeper'), ...this.wall.map((w) => actorView(w, 'dummy'))],
      ball: this.ballView(this.ball),
      cones: [],
      gates: [],
      goalTargets,
      rings: this.state === 'ready' ? [{ x: this.spot.x, y: this.spot.y, r: 0.55, tone: 'white', pulse: true }] : [],
      lines: [],
      preview,
      hud: {
        points: Math.round(this.points),
        combo: this.combo,
        timeLeft: this.timeLeft,
        duration: this.duration,
        prompt: this.phase === 'countdown' ? 'ready' : this.finished || this.phase === 'post' ? 'done' : this.variant === 'setPiece' ? 'setPiece' : 'finishing',
        meters: [],
        level: this.attempt,
        countdown: this.countdown,
        ...(this.variant === 'setPiece'
          ? { wind: { kmh: msToKmh(Math.hypot(this.env.wind.x, this.env.wind.y)), dir: { x: this.env.wind.x, y: this.env.wind.y } } }
          : {}),
      },
      heroOnBall: this.state === 'ready',
      heroIsKeeper: false,
    }
  }
}
