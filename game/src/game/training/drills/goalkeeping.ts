/**
 * Goalkeeping reflex drill (GK heroes).
 *
 * Reflex wall (2.3#29): 12 shots from new angles (11–20 m). The shooter's
 * last strides are the tell: they last the reaction window
 * (220 ms + Reflexes × 2 ms), so better reflexes read the strike earlier.
 * Held saves score 10, parried saves 6. Step across with the stick/WASD and dive with a
 * swipe / click-hold / tap toward the ball (aim assist bends the dive toward
 * the real crossing like in a match). Saves score more when held, at full
 * stretch and against fast shots; a streak multiplies. Shots that miss the
 * target simply don't count.
 */
import { GOAL_CENTER_Y, createTracker, isOnTarget, predictPlaneCrossing, stepBall, type BallState, type BallTracker, type PhysicsEvent } from '../../physics'
import { planKick } from '../../kick'
import { flatAttrs } from '../../setup'
import { planSave } from '../../ai'
import { a01, add, clampN, dist, dot, len, norm, scale, sub, type Agent, type Vec2 } from '../../model'
import { arriveTo } from '../vec'
import { DrillBase, actorView, makeActor, place, snapPrev } from '../base'
import { keeperBurst } from '../../keeperPhysics'
import { integrateKeeper, keeperReach, keeperSpot, keeperWorld, resolveSave, startDive } from '../keeper'
import { GK_SHOTS, GK_WIDE_POINTS, gkReactionWindow, savePoints } from '../scoring'
import type { DrillConfig, DrillInput, DrillView } from '../types'
import type { HeroAction } from '../../runtime'

type Cycle = 'setup' | 'runup' | 'flight' | 'resolved'

export class GoalkeepingDrill extends DrillBase {
  readonly hero: Agent
  readonly shooter: Agent
  readonly ball: BallState
  private tracker: BallTracker = createTracker()
  private readonly phys: PhysicsEvent[] = []
  private cycle: Cycle = 'setup'
  private cycleT = 0
  private spot: Vec2 = { x: 16, y: GOAL_CENTER_Y }
  private runFrom: Vec2 = { x: 18, y: GOAL_CENTER_Y }
  private runTime = 0.7
  private onTarget = false
  private touched = false
  private shotNo = 0

  constructor(cfg: DrillConfig) {
    super('goalkeeping', cfg)
    this.hero = makeActor('hero', 'hero', 'GK', { x: 1.0, y: GOAL_CENTER_Y }, this.attrs, { hero: true, number: 1 })
    // The shooter is the drill's opposition: his shooting sets the pace, his finishing the placement.
    this.shooter = makeActor('sh', 'opp', 'ST', { x: 18, y: GOAL_CENTER_Y }, flatAttrs(this.oppLevel), { number: 9 })
    this.ball = { x: 16, y: GOAL_CENTER_Y, z: 0, vx: 0, vy: 0, vz: 0, spin: { side: 0, top: 0 } }
    this.setup()
  }

  private setup(): void {
    this.shotNo++
    const d = this.rng.range(12, 21)
    const th = (this.rng.chance(0.5) ? 1 : -1) * this.rng.range(0, 0.7)
    this.spot = { x: d * Math.cos(th), y: GOAL_CENTER_Y + d * Math.sin(th) }
    const toGoal = norm(sub({ x: 0, y: GOAL_CENTER_Y }, this.spot))
    this.runFrom = sub(this.spot, scale(toGoal, this.rng.range(2.2, 3.4)))
    this.runTime = this.rng.range(0.33, 0.48) + gkReactionWindow(this.attrs.reflexes)
    place(this.shooter, this.runFrom, Math.atan2(toGoal.y, toGoal.x))
    this.tracker = createTracker()
    Object.assign(this.ball, { x: this.spot.x, y: this.spot.y, z: 0, vx: 0, vy: 0, vz: 0 })
    this.ball.spin = { side: 0, top: 0 }
    this.hero.noTouch = 0
    if (this.hero.state === 'down' || this.hero.state === 'dive') {
      this.hero.state = 'run'
      this.hero.stateT = 0
      this.hero.z = 0
    }
    this.onTarget = false
    this.touched = false
    this.cycle = 'setup'
    this.cycleT = 0
  }

  private strike(): void {
    // Strikers pick the side away from the keeper most of the time.
    const away = this.hero.pos.y >= GOAL_CENTER_Y ? -1 : 1
    const sa = this.shooter.attrs
    // Diving station (Diving): every shot is placed towards a corner, so each save is at full stretch.
    const corner = this.variant === 'diving'
      ? (this.rng.chance(0.75) ? away : -away) * this.rng.range(2.4, 3.4)
      : this.rng.chance(0.1) ? 0 : (this.rng.chance(0.72) ? away : -away) * this.rng.range(0.6 + a01(sa.finishing) * 1.6, 3.35)
    const high = this.rng.chance(0.4)
    const target = { x: -0.2, y: GOAL_CENTER_Y + corner }
    const power = this.rng.range(0.55, 0.8) * (0.78 + a01(sa.shooting) * 0.42)
    const plan = planKick(
      {
        kind: 'shot', from: this.spot, fromZ: 0, target, targetZ: high ? this.rng.range(1.5, 2.1) : this.rng.range(0.2, 0.8),
        power, curl: this.rng.range(-0.3, 0.3), attrs: this.shooter.attrs, pressure: 0, assist: 'manual', env: this.env,
        noiseScale: 1.05,
      },
      this.rng,
    )
    this.ball.vx = plan.vx
    this.ball.vy = plan.vy
    this.ball.vz = plan.vz
    this.ball.spin = { ...plan.spin }
    const c = predictPlaneCrossing(this.ball, this.env, 0, 2.5)
    this.onTarget = !!c && isOnTarget(c.y, c.z)
    if (this.onTarget) this.stat('onTarget')
    this.stat('shots')
    this.events.push({ type: 'kick', power, hero: false, x: this.spot.x, y: this.spot.y })
    this.shooter.state = 'skill'
    this.shooter.stateT = 0
    this.cycle = 'flight'
    this.cycleT = 0
  }

  // ───────────────────────── Hero keeper ─────────────────────────

  private world() {
    return keeperWorld(this.hero, [this.shooter], this.ball, this.env, this.time, this.difficulty, 'gk_save')
  }

  private diveFor(act: HeroAction): void {
    const k = this.hero
    if (k.state === 'dive' || k.state === 'down') return
    let dir: Vec2 | null = null
    if (act.kind === 'swipe') dir = act.swipe.isTap ? null : act.swipe.dir
    else if (act.kind === 'dive') dir = act.dir
    else if (act.kind === 'tapAt') dir = dist(act.at, k.pos) > 0.8 ? norm(sub(act.at, k.pos)) : null
    else if (act.kind === 'shoot') dir = norm(sub(act.target, k.pos))
    else if (act.kind === 'pass') dir = act.target ? norm(sub(act.target, k.pos)) : act.dir ?? null
    if (act.kind === 'action' || act.kind === 'skill' || (act.kind === 'pass' && !dir)) {
      const plan = this.cycle === 'flight' ? planSave(k, this.world(), 0) : null
      dir = plan && Math.abs(plan.point.y - k.pos.y) > 0.4 ? norm(sub(plan.point, k.pos)) : null
    }
    if (!dir || len(dir) < 0.1) return
    if (this.assist !== 'manual' && this.cycle === 'flight') {
      const plan = planSave(k, this.world(), 0)
      if (plan && plan.onTarget) {
        const ideal = norm(sub(plan.point, k.pos))
        if (dot(ideal, dir) > 0.2) dir = norm(add(scale(dir, this.assist === 'full' ? 0.25 : 0.6), scale(ideal, this.assist === 'full' ? 0.75 : 0.4)))
      }
    }
    startDive(k, dir)
    this.stat('dives')
    this.events.push({ type: 'dive' })
  }

  private moveKeeper(dt: number, input: DrillInput, live: boolean): void {
    const k = this.hero
    if (k.state === 'dive' || k.state === 'down') {
      integrateKeeper(k, dt, null, 0)
    } else {
      let mv = live ? input.move : { x: 0, y: 0 }
      if (len(mv) < 0.1 && this.assist !== 'manual') {
        // Assist only centres the keeper on the line; stepping off it is the player's job.
        const spot = keeperSpot(k, this.world())
        const tgt = { x: 0.9, y: GOAL_CENTER_Y + clampN(spot.y - GOAL_CENTER_Y, -1.6, 1.6) }
        const v = arriveTo(k.pos, tgt, (this.assist === 'full' ? 0.7 : 0.4) * 5.5, 1.5)
        mv = scale(v, 1 / 5.5)
      }
      // The match keeper's burst across his goal (keeperPhysics.keeperBurst: his sprint top speed, Pace).
      const speed = keeperBurst(k)
      const target = add(k.pos, scale(mv, speed * 0.25))
      integrateKeeper(k, dt, len(mv) > 0.05 ? target : null, speed * Math.min(1, len(mv)))
    }
    k.pos = { x: clampN(k.pos.x, 0.2, 6), y: clampN(k.pos.y, GOAL_CENTER_Y - 9, GOAL_CENTER_Y + 9) }
  }

  // ───────────────────────── Step ─────────────────────────

  protected beforeStep(): void {
    snapPrev([this.hero, this.shooter])
  }

  protected busy(): boolean {
    return this.cycle === 'flight'
  }

  /** Ends after the 12th shot is resolved. */
  protected forceEnd(): boolean {
    return this.shotNo >= GK_SHOTS && this.cycle === 'resolved' && this.cycleT > 0.6
  }

  protected tick(dt: number, input: DrillInput, live: boolean): void {
    this.cycleT += dt
    if (live) for (const a of input.actions) this.diveFor(a)
    this.moveKeeper(dt, input, live)

    // Shooter run-up.
    const s = this.shooter
    s.stateT += dt
    if (s.state === 'skill' && s.stateT > 0.45) s.state = 'run'
    if (this.cycle === 'setup') {
      s.vel = { x: 0, y: 0 }
      if (this.cycleT > 0.45 && live) {
        this.cycle = 'runup'
        this.cycleT = 0
      }
    } else if (this.cycle === 'runup') {
      const behind = sub(this.spot, scale(norm(sub({ x: 0, y: GOAL_CENTER_Y }, this.spot)), 0.6))
      const sp = dist(this.runFrom, behind) / this.runTime
      s.vel = arriveTo(s.pos, behind, sp, 0.2)
      s.pos = add(s.pos, scale(s.vel, dt))
      if (this.cycleT >= this.runTime) this.strike()
    } else {
      s.vel = scale(s.vel, 0.85)
      s.pos = add(s.pos, scale(s.vel, dt))
    }

    if (this.cycle === 'flight') this.flight()
    else if (this.cycle === 'resolved' && this.cycleT > 0.8 && (live || this.phase === 'countdown')) this.setup()
  }

  private resolve(saved: boolean, label: 'save' | 'held' | 'conceded' | 'wide', extra: { held?: boolean; stretch?: number; speed?: number } = {}): void {
    if (this.cycle !== 'flight') return
    this.cycle = 'resolved'
    this.cycleT = 0
    const at = { x: this.ball.x, y: this.ball.y, z: this.ball.z }
    if (label === 'wide') {
      // Angle covered: a shooter forced wide is half a save (a weaker shooter must never make the keeper's score smaller).
      this.stat('wide')
      this.points += GK_WIDE_POINTS
      this.events.push({ type: 'score', points: GK_WIDE_POINTS, label: 'wide', good: true, ...at })
      return
    }
    if (saved) {
      this.stat('saves')
      if (extra.held) this.stat('held')
      // Diving station: a save at full stretch earns a +4 bonus.
      const stretchBonus = this.variant === 'diving' && (extra.stretch ?? 0) >= 0.55 ? 4 : 0
      if (stretchBonus) this.stat('stretchSaves')
      this.award(savePoints({ saved: true, held: !!extra.held, stretch: extra.stretch ?? 0, speed: extra.speed ?? 0, combo: this.combo }) + stretchBonus, true, { label, ...at })
    } else {
      this.stat('conceded')
      this.award(0, false, { label: 'conceded', ...at })
    }
  }

  private flight(): void {
    const b = this.ball
    if (this.touched) {
      this.phys.length = 0
      stepBall(b, this.env, this.tracker, this.phys)
      return
    }
    const touch = keeperReach(this.hero, b)
    if (touch) {
      const speed = Math.hypot(b.vx, b.vy, b.vz)
      const res = resolveSave(this.rng, this.hero, b, touch)
      // A hand on the ball is a save (no save roll, as in the match).
      this.touched = true
      this.events.push({ type: 'save', hero: true, held: res === 'held', x: b.x, y: b.y, z: b.z })
      return this.resolve(true, res === 'held' ? 'held' : 'save', { held: res === 'held', stretch: touch.stretch, speed })
    }
    this.phys.length = 0
    stepBall(b, this.env, this.tracker, this.phys)
    for (const e of this.phys) {
      if (e.type === 'goal' && e.end === 'west') {
        this.events.push({ type: 'net', end: 'west', y: e.y, z: e.z, speed: Math.hypot(b.vx, b.vy) })
        return this.resolve(false, 'conceded')
      }
      if (e.type === 'post' || e.type === 'bar') this.events.push({ type: 'post', x: e.x, y: e.y, z: e.z, speed: e.speed })
      if (e.type === 'out') return this.resolve(false, this.onTarget ? 'conceded' : 'wide')
    }
    const slow = Math.hypot(b.vx, b.vy) < 0.8 && b.z < 0.05
    if (slow || this.cycleT > 3) this.resolve(false, 'wide')
  }

  // ───────────────────────── Bots / tests ─────────────────────────

  get inFlight(): boolean {
    return this.cycle === 'flight'
  }
  get shotOnTarget(): boolean {
    return this.onTarget
  }

  view(): DrillView {
    return {
      focus: { x: 10.5, y: (GOAL_CENTER_Y * 2 + this.spot.y) / 3 },
      span: 30,
      goals: ['west'],
      hero: actorView(this.hero, 'hero'),
      actors: [actorView(this.shooter, 'opp')],
      ball: this.ballView(this.ball),
      cones: [],
      gates: [],
      goalTargets: [],
      rings: this.cycle === 'setup' || this.cycle === 'runup' ? [{ x: this.spot.x, y: this.spot.y, r: 0.6, tone: 'red', pulse: true }] : [],
      lines: [],
      preview: null,
      hud: {
        points: Math.round(this.points),
        combo: this.combo,
        timeLeft: this.timeLeft,
        duration: this.duration,
        prompt: this.phase === 'countdown' ? 'ready' : this.phase === 'post' || this.finished ? 'done' : this.variant === 'diving' ? 'diving' : 'keeper',
        meters: [],
        level: this.shotNo,
        countdown: this.countdown,
      },
      heroOnBall: false,
      heroIsKeeper: true,
    }
  }
}
