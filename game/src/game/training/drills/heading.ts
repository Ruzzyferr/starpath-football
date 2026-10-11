/**
 * Header Machine ("Kafa Topu Makinesi", heading sessions).
 *
 * A ball machine out on the wing fires a cross toward the marked spot in the
 * box, every rep from a new side and slightly different spot. Step onto the
 * spot (stick / WASD), then jump and aim in one go: tap / click where in the
 * goal you want it, swipe toward it, or HEAD / Space for the lit target. The
 * ball must be met in the air — jump too early or too late and it sails over
 * you. Meeting it at the top of the jump gives the best (and best-placed)
 * header; jumping reach comes from `jumping`, header pace and accuracy from
 * `heading` (match kick model). The AI keeper reacts like in a highlight.
 * Goals score, lit targets and a perfectly timed jump add bonuses.
 */
import { PITCH_LENGTH } from '../../../sim/match/types'
import { planKick, shotTargetFromDir } from '../../kick'
import { GOAL_CENTER_Y, POST_Y_HIGH, POST_Y_LOW, cloneBall, createTracker, stepBall, type BallState, type BallTracker, type PhysicsEvent } from '../../physics'
import { flatAttrs } from '../../setup'
import { a01, accel, add, clampN, dist, len, norm, scale, sub, topSpeed, type Agent, type Vec2 } from '../../model'
import type { HeroAction } from '../../runtime'
import { DT, DrillBase, actorView, makeActor, place, snapPrev } from '../base'
import { aiKeeperReact, drillKeeperSpot, integrateKeeper, keeperReach, keeperWorld, resolveSave } from '../keeper'
import { headerPoints, inTarget, jumpTiming } from '../scoring'
import type { DrillConfig, DrillInput, DrillView, GoalTargetView } from '../types'

type RepState = 'setup' | 'incoming' | 'header' | 'resolved'

/** Jump length (s); the peak is at half of it. */
export const JUMP_TIME = 0.62
export const JUMP_PEAK = JUMP_TIME / 2
/** Head height of a standing player (m). */
const HEAD_Z = 1.8
/** Vertical tolerance of a header (m). */
const HEAD_TOL = 0.33
const TARGET_R = 0.85
const SETUP_TIME = 0.75
/** The keeper is screened in a crowded box: he picks the header up this late (s). */
const KEEPER_SCREEN = 0.18

interface Target {
  y: number
  z: number
  lit: boolean
  hitT: number
}

interface Aim {
  y: number
  z: number
}

const TARGET_SPOTS: readonly [number, number][] = [
  [GOAL_CENTER_Y - 2.7, 0.5],
  [GOAL_CENTER_Y + 2.7, 0.5],
  [GOAL_CENTER_Y - 2.6, 1.85],
  [GOAL_CENTER_Y + 2.6, 1.85],
]

export class HeadingDrill extends DrillBase {
  readonly hero: Agent
  readonly keeper: Agent
  readonly machine: Agent
  readonly ball: BallState
  private tracker: BallTracker = createTracker()
  private readonly phys: PhysicsEvent[] = []
  private readonly targets: Target[]
  private state: RepState = 'setup'
  private stateT = 0
  private rep = 0
  private spot: Vec2 = { x: PITCH_LENGTH - 10, y: GOAL_CENTER_Y }
  private machineSide = 1
  private keeperHome: Vec2
  private react: ((now: number) => boolean) | null = null
  private touched: 'held' | 'parried' | null = null
  private woodwork = false
  private aim: Aim | null = null
  private jumpAt = -1
  private contactTiming = 0
  /** Clock when the incoming ball is closest to the spot (for early/late labels). */
  private arriveAt = 0
  private headedAt = 0

  constructor(cfg: DrillConfig) {
    super('heading', cfg)
    this.hero = makeActor('hero', 'hero', 'ST', this.spot, this.attrs, { hero: true, number: 9 })
    // A headed ball is slower than a shot: the keeper is the drill's opposition, 16 points below it.
    this.keeper = makeActor('gk', 'opp', 'GK', { x: PITCH_LENGTH - 1.2, y: GOAL_CENTER_Y }, flatAttrs(this.oppLevel - 16, true), { number: 1 })
    this.keeperHome = { ...this.keeper.pos }
    this.machine = makeActor('machine', 'opp', 'CB', { x: PITCH_LENGTH - 17, y: GOAL_CENTER_Y + 24 }, flatAttrs(60), { number: 0 })
    this.machine.state = 'wall'
    this.ball = { x: this.machine.pos.x, y: this.machine.pos.y, z: 0.4, vx: 0, vy: 0, vz: 0, spin: { side: 0, top: 0 } }
    this.targets = TARGET_SPOTS.map(([y, z]) => ({ y, z, lit: false, hitT: -9 }))
    this.newRep(true)
  }

  // ───────────────────────── Reps ─────────────────────────

  private newRep(first = false): void {
    this.rep++
    this.machineSide = this.rep % 2 === 1 ? 1 : -1
    const prev = this.spot
    const next = { x: PITCH_LENGTH - this.rng.range(8.5, 12.5), y: GOAL_CENTER_Y + this.rng.range(-3.2, 3.2) }
    // Never more than ~2.5 m from the last spot (a couple of steps).
    const d = dist(prev, next)
    this.spot = first || d <= 2.5 ? next : add(prev, scale(sub(next, prev), 2.5 / d))
    if (first) place(this.hero, this.spot, 0)
    place(this.machine, { x: PITCH_LENGTH - this.rng.range(15, 20), y: GOAL_CENTER_Y + this.machineSide * this.rng.range(20, 25) }, this.machineSide > 0 ? -Math.PI / 2 : Math.PI / 2)
    this.machine.state = 'wall'
    this.tracker = createTracker()
    Object.assign(this.ball, { x: this.machine.pos.x, y: this.machine.pos.y - this.machineSide * 0.6, z: 0.4, vx: 0, vy: 0, vz: 0 })
    this.ball.spin = { side: 0, top: 0 }
    const pick = this.rng.int(0, 3)
    let pick2 = this.rng.int(0, 3)
    if (pick2 === pick) pick2 = (pick + 1 + this.rng.int(0, 2)) % 4
    this.targets.forEach((t, i) => {
      t.lit = i === pick || i === pick2
    })
    this.keeper.noTouch = 0
    if (this.keeper.state === 'dive' || this.keeper.state === 'down') {
      this.keeper.state = 'run'
      this.keeper.z = 0
    }
    this.keeperHome = drillKeeperSpot(this.keeper, keeperWorld(this.keeper, [this.hero], { ...this.ball, x: this.spot.x, y: this.spot.y }, this.env, this.time, this.oppSharpness, 'corner'))
    this.react = null
    this.touched = null
    this.woodwork = false
    this.aim = null
    this.jumpAt = -1
    this.contactTiming = 0
    this.state = 'setup'
    this.stateT = 0
  }

  private fire(): void {
    const height = 2.3 + this.rng.range(0, 0.25)
    const plan = planKick(
      { kind: 'cross', from: { x: this.ball.x, y: this.ball.y }, fromZ: this.ball.z, target: this.spot, targetZ: height, power: 0.7, curl: 0, attrs: flatAttrs(85), pressure: 0, assist: 'full', env: this.env, noiseScale: 0.25 },
      this.rng,
    )
    this.ball.vx = plan.vx
    this.ball.vy = plan.vy
    this.ball.vz = plan.vz
    this.ball.spin = { ...plan.spin }
    this.state = 'incoming'
    this.stateT = 0
    this.arriveAt = this.clock + this.closestApproach(this.spot).t
    this.events.push({ type: 'kick', power: 0.7, hero: false, x: this.ball.x, y: this.ball.y })
  }

  /** Time (from now) and height at which the ball passes closest to `p`. */
  private closestApproach(p: Vec2): { t: number; z: number; at: Vec2 } {
    const b = cloneBall(this.ball)
    const tr = createTracker()
    const ev: PhysicsEvent[] = []
    let best = { t: 0, z: b.z, at: { x: b.x, y: b.y }, d: dist(b, p) }
    for (let i = 1; i < 240; i++) {
      stepBall(b, this.env, tr, ev)
      ev.length = 0
      const d = dist(b, p)
      if (d < best.d) best = { t: i * DT, z: b.z, at: { x: b.x, y: b.y }, d }
      else if (d > best.d + 2) break
    }
    return { t: best.t, z: best.z, at: best.at }
  }

  /** Header aim (goal-line y and height) from an action; null = not a header input. */
  private interpret(act: HeroAction): Aim | null {
    const from = { x: this.ball.x, y: this.ball.y }
    const lit = this.targets.filter((t) => t.lit)
    const nearLit = (y: number, z: number): Aim => {
      if (this.assist === 'manual') return { y, z }
      const t = lit.slice().sort((a, b) => Math.abs(a.y - y) - Math.abs(b.y - y))[0]
      if (t && Math.abs(t.y - y) < (this.assist === 'full' ? 1.8 : 1.1)) return { y: this.assist === 'full' ? t.y : (t.y + y) / 2, z: t.z }
      return { y, z }
    }
    const heightFor = (power: number) => clampN(0.3 + 1.5 * power * power, 0.3, 2.6)
    switch (act.kind) {
      case 'action':
      case 'skill':
        return { y: lit[0]?.y ?? GOAL_CENTER_Y, z: lit[0]?.z ?? 0.6 }
      case 'tapAt': {
        const y = act.at.x > PITCH_LENGTH - 4 ? act.at.y : shotTargetFromDir(from, norm(sub(act.at, from))).y
        return nearLit(y, 0.6)
      }
      case 'shoot':
        return nearLit(act.target.y, heightFor(act.power))
      case 'swipe':
        if (act.swipe.isTap) return null
        return nearLit(shotTargetFromDir(this.hero.pos, act.swipe.dir).y, heightFor(act.swipe.power))
      case 'pass': {
        const d = act.target ? norm(sub(act.target, from)) : act.dir ? norm(act.dir) : null
        if (!d || len(d) === 0) return { y: lit[0]?.y ?? GOAL_CENTER_Y, z: lit[0]?.z ?? 0.6 }
        return nearLit(shotTargetFromDir(this.hero.pos, d).y, 0.6)
      }
      default:
        return null
    }
  }

  private jump(input: DrillInput): void {
    const h = this.hero
    if (h.state !== 'run' || h.cd > 0) return
    for (const act of input.actions) {
      const aim = this.interpret(act)
      if (!aim) continue
      h.state = 'jump'
      h.stateT = 0
      h.cd = 0.15
      this.aim = { y: clampN(aim.y, POST_Y_LOW - 1, POST_Y_HIGH + 1), z: aim.z }
      if (this.jumpAt < 0) this.jumpAt = this.clock
      this.stat('jumps')
      return
    }
  }

  /** Jump height (m) at the top: 0.3 + jumping. */
  get jumpHeight(): number {
    return 0.3 + a01(this.attrs.jumping) * 0.5
  }

  private header(): void {
    const b = this.ball
    const h = this.hero
    const aim = this.aim ?? { y: GOAL_CENTER_Y, z: 0.6 }
    const timing = jumpTiming(h.stateT, JUMP_PEAK)
    this.contactTiming = timing
    const plan = planKick(
      {
        kind: 'header', from: { x: b.x, y: b.y }, fromZ: b.z, target: { x: PITCH_LENGTH + 0.2, y: aim.y }, targetZ: aim.z,
        power: 0.6 + timing * 0.4, curl: 0, attrs: this.attrs, pressure: 0, assist: this.assist, env: this.env, noiseScale: 0.7 + (1 - timing) * 0.9,
      },
      this.rng,
    )
    b.vx = plan.vx
    b.vy = plan.vy
    b.vz = plan.vz
    b.spin = { ...plan.spin }
    h.facing = Math.atan2(plan.vy, plan.vx)
    this.state = 'header'
    this.stateT = 0
    this.headedAt = this.time
    this.stat('headers')
    if (timing >= 0.75) this.stat('perfectJumps')
    this.events.push({ type: 'kick', power: 0.6 + timing * 0.4, hero: true, x: b.x, y: b.y })
    this.react = aiKeeperReact(this.keeper, () => keeperWorld(this.keeper, [this.hero], this.ball, this.env, this.time, this.oppSharpness, 'corner'), this.oppSharpness)
  }

  private resolve(kind: 'goal' | 'saved' | 'miss' | 'woodwork' | 'early' | 'late' | 'whiff', y = this.ball.y, z = this.ball.z): void {
    if (this.state !== 'incoming' && this.state !== 'header') return
    this.state = 'resolved'
    this.stateT = 0
    const at = { x: Math.min(this.ball.x, PITCH_LENGTH), y, z }
    if (kind === 'goal') {
      const hit = this.targets.some((t) => t.lit && inTarget(y, z, { ...t, r: TARGET_R }))
      for (const t of this.targets) if (t.lit && inTarget(y, z, { ...t, r: TARGET_R })) t.hitT = this.time
      if (hit) this.stat('targets')
      this.stat('goals')
      this.award(headerPoints({ goal: true, targetHit: hit, timing: this.contactTiming, combo: this.combo }), true, { label: hit ? 'target' : 'goal', ...at })
      return
    }
    this.stat(kind === 'saved' ? 'saves' : kind === 'woodwork' ? 'woodwork' : kind === 'miss' ? 'misses' : 'whiffs')
    const label = kind === 'saved' ? 'saved' : kind === 'woodwork' ? 'post' : kind === 'whiff' ? 'whiff' : kind
    this.award(0, false, { label, ...at })
  }

  // ───────────────────────── Step ─────────────────────────

  protected beforeStep(): void {
    snapPrev([this.hero, this.keeper, this.machine])
  }

  protected busy(): boolean {
    return this.state === 'incoming' || this.state === 'header'
  }

  protected tick(dt: number, input: DrillInput, live: boolean): void {
    this.stateT += dt
    if (live && (this.state === 'setup' || this.state === 'incoming')) this.jump(input)
    this.moveHero(dt, live ? input : { ...input, move: { x: 0, y: 0 }, sprint: false })

    // Keeper.
    if (this.react && this.state === 'header' && this.time - this.headedAt >= KEEPER_SCREEN && this.react(this.time)) this.react = null
    const intent = this.keeper.intent
    const tgt = this.state === 'header' && intent?.kind === 'run' ? intent.to : this.state !== 'header' ? this.keeperHome : null
    integrateKeeper(this.keeper, dt, tgt, this.state === 'header' ? 4.2 : 2.6)
    if (this.state !== 'header') this.keeper.intent = null

    switch (this.state) {
      case 'setup':
        if (this.stateT > SETUP_TIME && live) this.fire()
        break
      case 'incoming':
        this.incoming()
        break
      case 'header':
        this.headerFlight()
        break
      case 'resolved':
        if (this.touched !== 'held') {
          this.phys.length = 0
          stepBall(this.ball, this.env, this.tracker, this.phys)
        }
        if (this.stateT > 0.9 && (live || this.phase === 'countdown')) this.newRep()
        break
    }
  }

  private moveHero(dt: number, input: DrillInput): void {
    const h = this.hero
    h.stateT += dt
    h.cd = Math.max(0, h.cd - dt)
    if (h.state === 'jump') {
      h.z = Math.max(0, Math.sin((Math.PI * h.stateT) / JUMP_TIME) * this.jumpHeight)
      h.vel = scale(h.vel, 0.92)
      if (h.stateT >= JUMP_TIME) {
        h.state = 'run'
        h.stateT = 0
        h.z = 0
      }
    } else {
      h.sprint = false
      const max = topSpeed(h) * 0.75
      const desired = scale(input.move, max)
      const dv = sub(desired, h.vel)
      const a = accel(h) * dt
      h.vel = len(dv) <= a ? desired : add(h.vel, scale(norm(dv), a))
    }
    h.pos = { x: clampN(h.pos.x + h.vel.x * dt, PITCH_LENGTH - 16, PITCH_LENGTH - 6), y: clampN(h.pos.y + h.vel.y * dt, GOAL_CENTER_Y - 9, GOAL_CENTER_Y + 9) }
    if (len(h.vel) > 0.6 && h.state !== 'jump') h.facing = Math.atan2(h.vel.y, h.vel.x)
    else if (this.state === 'incoming' || this.state === 'setup') h.facing = Math.atan2(this.ball.y - h.pos.y, this.ball.x - h.pos.x)
  }

  private incoming(): void {
    const b = this.ball
    const h = this.hero
    this.phys.length = 0
    stepBall(b, this.env, this.tracker, this.phys)
    if (h.state === 'jump') {
      const reach = 0.55 + a01(this.attrs.heading) * 0.3
      const headZ = HEAD_Z + h.z
      if (dist(h.pos, b) <= reach && Math.abs(b.z - headZ) <= HEAD_TOL) return this.header()
    }
    const gone = this.clock > this.arriveAt + 0.35 && dist(h.pos, b) > 1.6
    if (gone || this.phys.some((e) => e.type === 'out') || (b.z <= 0.02 && this.stateT > 0.3)) {
      if (this.jumpAt < 0) return this.resolve('whiff')
      return this.resolve(this.jumpAt < this.arriveAt - JUMP_PEAK ? 'early' : 'late')
    }
  }

  private headerFlight(): void {
    const b = this.ball
    if (this.touched === 'held') {
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
      if (e.type === 'out') return this.resolve(this.touched === 'parried' ? 'saved' : this.woodwork ? 'woodwork' : 'miss')
    }
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
    if (slow || this.stateT > 3) this.resolve(this.touched === 'parried' ? 'saved' : this.woodwork ? 'woodwork' : 'miss')
  }

  // ───────────────────────── Bots / tests ─────────────────────────

  /** The marked spot the machine aims at. */
  get target(): Vec2 {
    return { ...this.spot }
  }
  /** Ball on its way in (the hero may jump). */
  get incomingBall(): boolean {
    return this.state === 'incoming' && this.live
  }
  /** Seconds until the incoming ball passes closest to the hero, and its height there. */
  eta(): { t: number; z: number } {
    const c = this.closestApproach(this.hero.pos)
    return { t: c.t, z: c.z }
  }
  litTargets(): { y: number; z: number }[] {
    return this.targets.filter((t) => t.lit).map((t) => ({ y: t.y, z: t.z }))
  }

  view(): DrillView {
    const goalTargets: GoalTargetView[] = this.targets.map((t) => ({ end: 'east', y: t.y, z: t.z, r: TARGET_R, tone: this.time - t.hitT < 0.8 ? 'green' : t.lit ? 'gold' : 'dim' }))
    const onSpot = dist(this.hero.pos, this.spot) < 0.8
    const near = this.state === 'incoming' && Math.abs(this.arriveAt - this.clock - JUMP_PEAK) < 0.12
    return {
      focus: { x: PITCH_LENGTH - 9, y: (GOAL_CENTER_Y + this.machine.pos.y) / 2 },
      span: 34,
      goals: ['east'],
      hero: actorView(this.hero, 'hero'),
      actors: [actorView(this.keeper, 'keeper'), actorView(this.machine, 'dummy')],
      ball: this.ballView(this.ball),
      cones: [{ x: this.machine.pos.x, y: this.machine.pos.y, tone: 'orange' }],
      gates: [],
      goalTargets,
      rings: this.state === 'setup' || this.state === 'incoming' ? [{ x: this.spot.x, y: this.spot.y, r: 0.8, tone: near ? 'green' : onSpot ? 'white' : 'gold', pulse: true }] : [],
      lines: [],
      preview: null,
      hud: {
        points: Math.round(this.points),
        combo: this.combo,
        timeLeft: this.timeLeft,
        duration: this.duration,
        prompt: this.phase === 'countdown' ? 'ready' : this.phase === 'post' || this.finished ? 'done' : near ? 'headNow' : 'heading',
        meters: [],
        level: this.rep,
        countdown: this.countdown,
      },
      heroOnBall: false,
      heroIsKeeper: false,
    }
  }
}
