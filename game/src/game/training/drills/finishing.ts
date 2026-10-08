/**
 * Finishing drill (shooting / set-piece sessions).
 *
 * The ball is laid at a new spot 13–24 m out (19–27 m with a defensive wall
 * in the set-piece variant). Two corner targets light up and drift on the
 * goal mouth; beat the keeper for a goal, hit a lit target for a big bonus,
 * keep the streak going for a multiplier. Shots use the match kick model
 * (swipe / hold-release / pad) and the AI keeper reacts like in a highlight.
 *
 * Set-piece variant = curl gate (2.3#25): 5 free kicks; each one that clears
 * the wall and is struck between the two posts (on target, saved or not)
 * scores 20. Every kick gets its own wind, shown in km/h with an arrow.
 */
import { PITCH_LENGTH } from '../../../sim/match/types'
import { createTracker, GOAL_CENTER_Y, isOnTarget, predictPlaneCrossing, stepBall, type BallState, type BallTracker, type PhysicsEvent } from '../../physics'
import { flatAttrs } from '../../setup'
import { add, dist, norm, scale, sub, type Agent, type Vec2 } from '../../model'
import { DrillBase, actorView, makeActor, place, snapPrev } from '../base'
import { aiKeeperReact, integrateKeeper, keeperReach, keeperSpot, keeperWorld, resolveSave } from '../keeper'
import { CURL_GATE_ATTEMPTS, CURL_GATE_MAX_WIND, CURL_GATE_POINTS, inTarget, msToKmh, shotPoints } from '../scoring'
import { distanceToGoal, planIntent, previewPath, shotIntent } from '../shooting'
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
const WALL_GAP = 9.15

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
  private shotFrom = 18
  private aim: DrillInput['aim'] = null

  constructor(cfg: DrillConfig) {
    super('finishing', cfg)
    this.hero = makeActor('hero', 'hero', 'ST', { x: 80, y: GOAL_CENTER_Y }, this.attrs, { hero: true, number: 9 })
    const kq = 56 + (this.difficulty - 1) * 40
    this.keeper = makeActor('gk', 'opp', 'GK', { x: PITCH_LENGTH - 1.2, y: GOAL_CENTER_Y }, flatAttrs(kq, true), { number: 1 })
    this.keeperHome = { ...this.keeper.pos }
    this.ball = { x: 80, y: GOAL_CENTER_Y, z: 0, vx: 0, vy: 0, vz: 0, spin: { side: 0, top: 0 } }
    this.targets = CORNERS.map(([y, z], i) => ({ baseY: y, baseZ: z, phase: i * 1.7, lit: false, hitT: -9 }))
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
    this.shotFrom = distanceToGoal(this.spot)
    this.tracker = createTracker()
    Object.assign(this.ball, { x: this.spot.x, y: this.spot.y, z: 0, vx: 0, vy: 0, vz: 0 })
    this.ball.spin = { side: 0, top: 0 }
    const toGoal = norm(sub({ x: PITCH_LENGTH, y: GOAL_CENTER_Y }, this.spot))
    place(this.hero, sub(this.spot, scale(toGoal, 0.75)), Math.atan2(toGoal.y, toGoal.x))
    // Two lit corners, never the same pair twice in a row.
    const pick = this.rng.int(0, 3)
    let pick2 = this.rng.int(0, 3)
    if (pick2 === pick) pick2 = (pick + 1 + this.rng.int(0, 2)) % 4
    this.targets.forEach((t, i) => {
      t.lit = i === pick || i === pick2
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
    this.keeper.noTouch = 0
    place(this.keeper, this.keeper.pos, Math.PI)
    this.keeperHome = keeperSpot(this.keeper, keeperWorld(this.keeper, [this.hero], this.ball, this.env, this.time, this.difficulty))
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
      const plan = planIntent(intent, { from: this.spot, attrs: this.attrs, assist: this.assist, env: this.env, noise: 0.9 }, this.rng)
      this.ball.vx = plan.vx
      this.ball.vy = plan.vy
      this.ball.vz = plan.vz
      this.ball.spin = { ...plan.spin }
      this.state = 'flight'
      this.stateT = 0
      if (this.variant === 'setPiece') {
        const c = predictPlaneCrossing(this.ball, this.env, PITCH_LENGTH, 3)
        this.onTarget = !!c && isOnTarget(c.y, c.z)
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
      this.react = aiKeeperReact(this.keeper, () => keeperWorld(this.keeper, [this.hero], this.ball, this.env, this.time, this.difficulty), this.difficulty)
      return
    }
  }

  private resolve(kind: 'goal' | 'saved' | 'miss' | 'woodwork' | 'blocked', y = this.ball.y, z = this.ball.z): void {
    if (this.state !== 'flight') return
    this.state = 'resolved'
    this.stateT = 0
    const at = { x: Math.min(this.ball.x, PITCH_LENGTH), y, z }
    if (this.variant === 'setPiece') {
      const through = kind === 'goal' || (kind === 'saved' && this.onTarget)
      if (through) this.stat('gates')
      if (kind === 'goal') this.stat('goals')
      this.award(through ? CURL_GATE_POINTS : 0, through, { label: through ? 'gate' : kind === 'blocked' ? 'blocked' : 'gateMissed', ...at })
      return
    }
    if (kind === 'goal') {
      const hit = this.targets.some((t) => t.lit && inTarget(y, z, this.targetPos(t)))
      if (hit) {
        this.stat('targets')
        for (const t of this.targets) if (t.lit && inTarget(y, z, this.targetPos(t))) t.hitT = this.time
      }
      this.stat('goals')
      this.award(shotPoints({ goal: true, targetHit: hit, distance: this.shotFrom, combo: this.combo }), true, { label: hit ? 'target' : 'goal', ...at })
      return
    }
    this.stat(kind === 'saved' ? 'saves' : kind === 'blocked' ? 'blocked' : kind === 'woodwork' ? 'woodwork' : 'misses')
    this.award(0, false, { label: kind === 'saved' ? 'saved' : kind === 'blocked' ? 'blocked' : kind === 'woodwork' ? 'post' : 'miss', ...at })
  }

  // ───────────────────────── Step ─────────────────────────

  protected beforeStep(): void {
    snapPrev([this.hero, this.keeper, ...this.wall])
  }

  protected busy(): boolean {
    return this.state === 'flight'
  }

  /** Curl gate ends after the fifth kick. */
  protected forceEnd(): boolean {
    return this.variant === 'setPiece' && this.attempt >= CURL_GATE_ATTEMPTS && this.state === 'resolved' && this.stateT > 0.6
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
    const tgt = this.state === 'flight' && intent?.kind === 'run' ? intent.to : this.state === 'ready' ? this.keeperHome : null
    integrateKeeper(this.keeper, dt, tgt, this.state === 'flight' ? 4.2 : 2.6)
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
      const res = resolveSave(this.rng, this.keeper, b, touch, this.difficulty)
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
    const goalTargets: GoalTargetView[] = this.targets.map((t) => {
      const p = this.targetPos(t)
      return { end: 'east', y: p.y, z: p.z, r: p.r, tone: this.time - t.hitT < 0.8 ? 'green' : t.lit ? 'gold' : 'dim' }
    })
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
