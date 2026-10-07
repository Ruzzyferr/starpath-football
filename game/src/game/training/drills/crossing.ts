/**
 * Cross Station ("Orta İstasyonu", crossing sessions).
 *
 * The hero stands wide on a wing near the byline with the ball. Each round a
 * delivery zone lights up in the box (near post, six-yard centre, penalty
 * spot, far post, back post) and a team-mate starts his run into it. Whip the
 * cross in (tap / click the zone, swipe or hold & release toward it, or the
 * CROSS button / Space for the lit zone) so it drops into the zone as the
 * runner arrives:
 *  - dropping inside the zone scores, closer to its centre scores more;
 *  - meeting the runner (ball arrival vs runner arrival within 0.3 s = perfect,
 *    0.7 s = good) adds a timing bonus and keeps the streak alive;
 *  - waiting too long loses the runner ("late").
 * Deliveries use the match kick model ('cross': crossing ×0.8 + passing ×0.2
 * sets the scatter), so better crossers land closer to the spot.
 */
import { PITCH_LENGTH, PITCH_WIDTH } from '../../../sim/match/types'
import { planKick } from '../../kick'
import { GOAL_CENTER_Y, cloneBall, createTracker, stepBall, type BallState, type BallTracker, type PhysicsEvent } from '../../physics'
import { flatAttrs } from '../../setup'
import { add, angleDiff, clampN, dist, len, norm, scale, sub, type Agent, type Vec2 } from '../../model'
import type { HeroAction } from '../../runtime'
import { DT, DrillBase, actorView, makeActor, place, snapPrev } from '../base'
import { CROSS_ZONE_R, crossPoints, crossTiming } from '../scoring'
import type { DrillConfig, DrillInput, DrillView, LineView, RingView } from '../types'

type RoundState = 'ready' | 'flight' | 'resolved'

/** The ball counts as "delivered" when it comes down through this height. */
export const DELIVERY_Z = 1.8
/** Seconds after the runner arrives before he gives up on the cross. */
const RUNNER_PATIENCE = 1.5

interface Delivery {
  at: Vec2
  /** Drill clock when the ball came down into play. */
  t: number
}

export class CrossingDrill extends DrillBase {
  readonly hero: Agent
  readonly runner: Agent
  readonly ball: BallState
  private tracker: BallTracker = createTracker()
  private readonly phys: PhysicsEvent[] = []
  private state: RoundState = 'ready'
  private stateT = 0
  private round = 0
  private side = 1
  private spot: Vec2 = { x: 90, y: 60 }
  private zone: Vec2 = { x: 100, y: GOAL_CENTER_Y }
  private zoneIdx = -1
  private runFrom: Vec2 = { x: 84, y: GOAL_CENTER_Y }
  /** Clock when the round became ready. */
  private readyAt = 0
  /** Seconds after ready the runner reaches the zone. */
  private runTime = 2
  /** Noiseless flight time from the spot to the zone (for the timing cue). */
  private flightEst = 1.4
  private delivered: Delivery | null = null
  private flash: { at: number; tone: 'green' | 'red' } | null = null

  constructor(cfg: DrillConfig) {
    super('crossing', cfg)
    this.hero = makeActor('hero', 'hero', 'RW', this.spot, this.attrs, { hero: true, number: 7 })
    this.runner = makeActor('run', 'hero', 'ST', this.runFrom, flatAttrs(70), { number: 9 })
    this.ball = { x: this.spot.x, y: this.spot.y, z: 0, vx: 0, vy: 0, vz: 0, spin: { side: 0, top: 0 } }
    this.newRound()
  }

  // ───────────────────────── Rounds ─────────────────────────

  /** Zone centres for a hero on side `s` (+1 = high-y wing). */
  private zones(s: number): Vec2[] {
    const c = GOAL_CENTER_Y
    return [
      { x: PITCH_LENGTH - 4.5, y: c + s * 2.6 }, // near post
      { x: PITCH_LENGTH - 5.5, y: c }, // six-yard centre
      { x: PITCH_LENGTH - 11, y: c }, // penalty spot
      { x: PITCH_LENGTH - 4.5, y: c - s * 3 }, // far post
      { x: PITCH_LENGTH - 8, y: c - s * 6.5 }, // back post
    ]
  }

  private newRound(): void {
    this.round++
    this.side = this.round <= 2 ? 1 : this.rng.chance(0.5) ? 1 : -1
    const s = this.side
    this.spot = { x: PITCH_LENGTH - this.rng.range(11, 19), y: GOAL_CENTER_Y + s * this.rng.range(23, 28) }
    const zs = this.zones(s)
    let zi = this.rng.int(0, zs.length - 1)
    if (zi === this.zoneIdx) zi = (zi + 1 + this.rng.int(0, zs.length - 2)) % zs.length
    this.zoneIdx = zi
    this.zone = zs[zi]
    // Ball and hero at the spot, facing the box.
    const toZone = norm(sub(this.zone, this.spot))
    this.tracker = createTracker()
    Object.assign(this.ball, { x: this.spot.x + toZone.x * 0.6, y: this.spot.y + toZone.y * 0.6, z: 0, vx: 0, vy: 0, vz: 0 })
    this.ball.spin = { side: 0, top: 0 }
    place(this.hero, this.spot, Math.atan2(toZone.y, toZone.x))
    // Runner timing: the cross needs `flightEst`; leave 0.7–1.4 s to pick the moment.
    this.flightEst = this.estimateFlight()
    this.runTime = this.flightEst + this.rng.range(0.7, 1.4) + Math.max(0, 0.4 - this.round * 0.05)
    const runDir = norm({ x: 1, y: s * this.rng.range(-0.25, 0.45) })
    const runLen = clampN(6.4 * this.runTime, 8, 16)
    this.runFrom = { x: clampN(this.zone.x - runDir.x * runLen, PITCH_LENGTH - 26, PITCH_LENGTH - 3), y: clampN(this.zone.y - runDir.y * runLen, 12, PITCH_WIDTH - 12) }
    place(this.runner, this.runFrom, Math.atan2(this.zone.y - this.runFrom.y, this.zone.x - this.runFrom.x))
    this.delivered = null
    this.state = 'ready'
    this.stateT = 0
    this.readyAt = this.clock
  }

  /** Noiseless time for a cross from the ball to the zone to come down to delivery height. */
  private estimateFlight(): number {
    const plan = planKick({ kind: 'cross', from: { x: this.ball.x, y: this.ball.y }, fromZ: 0, target: this.zone, power: 0.75, curl: 0, attrs: this.attrs, pressure: 0, assist: this.assist, env: this.env })
    const b = cloneBall(this.ball)
    b.vx = plan.vx
    b.vy = plan.vy
    b.vz = plan.vz
    b.spin = { ...plan.spin }
    const tr = createTracker()
    const ev: PhysicsEvent[] = []
    for (let i = 1; i < 360; i++) {
      stepBall(b, this.env, tr, ev)
      if (b.vz < 0 && b.z <= DELIVERY_Z) return i * DT
    }
    return 1.5
  }

  /** Where an action sends the cross (pitch point) and how hard. */
  private interpret(act: HeroAction): { target: Vec2; power: number } | null {
    const from = { x: this.ball.x, y: this.ball.y }
    const zone = this.zone
    const cone = this.assist === 'full' ? 0.3 : this.assist === 'half' ? 0.2 : 0.1
    const toZone = sub(zone, from)
    const zoneD = len(toZone)
    const along = (dir: Vec2, power: number): Vec2 => {
      const a = Math.abs(angleDiff(Math.atan2(dir.y, dir.x), Math.atan2(toZone.y, toZone.x)))
      // Weight from the gesture: soft drops short, hard runs long.
      const weight = clampN(1 + (power - 0.75) * 0.35, 0.85, 1.12)
      if (a < cone) return add(from, scale(norm(toZone), zoneD * weight))
      return add(from, scale(norm(dir), 12 + power * 22))
    }
    const snap = (p: Vec2): Vec2 => {
      const d = dist(p, zone)
      if (this.assist === 'full' && d < 5) return { ...zone }
      if (this.assist === 'half' && d < 4) return add(p, scale(sub(zone, p), 0.5))
      return p
    }
    switch (act.kind) {
      case 'tapAt':
        return { target: snap(act.at), power: 0.75 }
      case 'pass':
        if (act.target) return { target: snap(act.target), power: 0.75 }
        if (act.dir && len(act.dir) > 0.2) return { target: along(act.dir, 0.75), power: 0.75 }
        return { target: { ...zone }, power: 0.75 }
      case 'shoot': {
        const power = clampN(act.power, 0.45, 1.1)
        return { target: along(sub(act.target, from), power), power }
      }
      case 'swipe': {
        if (act.swipe.isTap) return null
        const power = clampN(act.swipe.power, 0.45, 1.1)
        return { target: along(act.swipe.dir, power), power }
      }
      case 'action':
      case 'skill':
        return { target: { ...zone }, power: 0.75 }
      default:
        return null
    }
  }

  private cross(input: DrillInput): void {
    for (const act of input.actions) {
      const p = this.interpret(act)
      if (!p) continue
      const from = { x: this.ball.x, y: this.ball.y }
      const plan = planKick(
        { kind: 'cross', from, fromZ: 0, target: p.target, power: p.power, curl: 0, attrs: this.attrs, pressure: 0, assist: this.assist, env: this.env, noiseScale: 1.15 },
        this.rng,
      )
      this.ball.vx = plan.vx
      this.ball.vy = plan.vy
      this.ball.vz = plan.vz
      this.ball.spin = { ...plan.spin }
      this.hero.facing = Math.atan2(plan.vy, plan.vx)
      this.hero.state = 'skill'
      this.hero.stateT = 0
      this.state = 'flight'
      this.stateT = 0
      this.stat('crosses')
      this.events.push({ type: 'kick', power: p.power, hero: true, x: from.x, y: from.y })
      return
    }
  }

  private resolveDelivery(d: Delivery): void {
    if (this.state !== 'flight') return
    this.state = 'resolved'
    this.stateT = 0
    this.delivered = d
    const miss = dist(d.at, this.zone)
    const inZone = miss <= CROSS_ZONE_R
    const timing = crossTiming(d.t - (this.readyAt + this.runTime))
    const at = { x: d.at.x, y: d.at.y, z: DELIVERY_Z }
    if (!inZone) {
      this.stat('misses')
      this.flash = { at: this.time, tone: 'red' }
      this.award(0, false, { label: 'miss', ...at })
      return
    }
    const timed = timing === 'perfect' || timing === 'good'
    this.stat('inZone')
    if (timing === 'perfect') this.stat('perfectTiming')
    this.flash = { at: this.time, tone: timed ? 'green' : 'red' }
    this.award(crossPoints({ inZone, miss, timing, combo: this.combo }), timed, { label: timed ? (timing === 'perfect' ? 'perfect' : 'delivery') : timing, ...at })
    // The runner attacks it: a header toward goal (cosmetic).
    const r = this.runner
    if (dist(r.pos, d.at) < 3) {
      r.state = 'jump'
      r.stateT = 0
      const aim = { x: PITCH_LENGTH + 0.5, y: GOAL_CENTER_Y + this.rng.range(-2.6, 2.6) }
      const dir = norm(sub(aim, d.at))
      this.ball.vx = dir.x * 14
      this.ball.vy = dir.y * 14
      this.ball.vz = 0.4
      this.ball.spin = { side: 0, top: 0 }
      this.events.push({ type: 'touch', x: d.at.x, y: d.at.y })
    }
  }

  private fail(label: 'out' | 'miss' | 'late', at: Vec2): void {
    if (this.state === 'resolved') return
    this.state = 'resolved'
    this.stateT = 0
    this.flash = { at: this.time, tone: 'red' }
    this.stat(label === 'late' ? 'timeouts' : 'misses')
    this.award(0, false, { label, x: at.x, y: at.y })
  }

  // ───────────────────────── Step ─────────────────────────

  protected beforeStep(): void {
    snapPrev([this.hero, this.runner])
  }

  protected busy(): boolean {
    return this.state === 'flight'
  }

  protected tick(dt: number, input: DrillInput, live: boolean): void {
    this.stateT += dt
    if (live && this.state === 'ready') this.cross(input)
    const h = this.hero
    h.stateT += dt
    if (h.state === 'skill' && h.stateT > 0.45) h.state = 'run'
    this.moveRunner(dt)
    if (this.state === 'ready' && live && this.clock > this.readyAt + this.runTime + RUNNER_PATIENCE) this.fail('late', this.zone)
    if (this.state === 'flight') this.flight()
    else if (this.state === 'resolved') {
      // Let a delivered ball play out (cosmetic), then reset.
      if (this.delivered) {
        this.phys.length = 0
        stepBall(this.ball, this.env, this.tracker, this.phys)
        for (const e of this.phys) if (e.type === 'goal' && e.end === 'east') this.events.push({ type: 'net', end: 'east', y: e.y, z: e.z, speed: Math.hypot(this.ball.vx, this.ball.vy) })
      }
      if (this.stateT > 0.9 && (live || this.phase === 'countdown')) this.newRound()
    }
  }

  private moveRunner(dt: number): void {
    const r = this.runner
    r.stateT += dt
    if (r.state === 'jump') {
      r.z = Math.max(0, Math.sin((Math.PI * r.stateT) / 0.55) * 0.45)
      if (r.stateT > 0.55) {
        r.state = 'run'
        r.z = 0
      }
    }
    if (this.state === 'resolved' && this.delivered) {
      r.vel = scale(r.vel, 0.9)
    } else {
      const f = this.state === 'ready' || this.state === 'flight' ? clampN((this.clock - this.readyAt) / this.runTime, 0, 1) : 1
      const goal = add(this.runFrom, scale(sub(this.zone, this.runFrom), f))
      r.vel = scale(sub(goal, r.pos), 1 / dt)
      if (len(r.vel) > 9) r.vel = scale(norm(r.vel), 9)
    }
    r.pos = add(r.pos, scale(r.vel, dt))
    const b = this.ball
    if (len(r.vel) > 0.5) r.facing = Math.atan2(r.vel.y, r.vel.x)
    else r.facing = Math.atan2(b.y - r.pos.y, b.x - r.pos.x)
  }

  private flight(): void {
    const b = this.ball
    const prev = { x: b.x, y: b.y }
    this.phys.length = 0
    stepBall(b, this.env, this.tracker, this.phys)
    if (b.vz < 0 && b.z <= DELIVERY_Z) return this.resolveDelivery({ at: { x: b.x, y: b.y }, t: this.clock })
    for (const e of this.phys) {
      if (e.type === 'out' || e.type === 'goal' || e.type === 'post' || e.type === 'bar') return this.fail('out', prev)
    }
    if (this.stateT > 4) this.fail('miss', prev)
  }

  // ───────────────────────── Bots / tests ─────────────────────────

  get ready(): boolean {
    return this.state === 'ready' && this.live
  }
  /** Centre of the lit delivery zone. */
  get zoneCentre(): Vec2 {
    return { ...this.zone }
  }
  /** Seconds until the ideal release (negative = past it). */
  get releaseIn(): number {
    return this.readyAt + this.runTime - this.flightEst - this.clock
  }

  view(): DrillView {
    const flash = this.flash && this.time - this.flash.at < 0.7 ? this.flash.tone : null
    const rel = this.releaseIn
    const window = this.state === 'ready' && this.live && Math.abs(rel) <= 0.3
    const rings: RingView[] = [
      { x: this.zone.x, y: this.zone.y, r: CROSS_ZONE_R, tone: flash ?? (window ? 'green' : 'gold'), pulse: this.state === 'ready' },
      { x: this.zone.x, y: this.zone.y, r: 0.5, tone: 'white' },
    ]
    if (this.state === 'ready') rings.push({ x: this.spot.x, y: this.spot.y, r: 0.6, tone: 'white', pulse: true })
    const lines: LineView[] = this.state === 'ready' ? [{ a: this.runner.pos, b: this.zone, tone: 'white', width: 0.08 }] : []
    const span = Math.max(30, dist(this.spot, this.zone) + 12)
    const lead = this.state === 'ready' ? clampN(1 - rel / Math.max(0.5, this.runTime - this.flightEst), 0, 1) : 0
    return {
      focus: { x: (this.spot.x + this.zone.x) / 2 - 1, y: (this.spot.y + this.zone.y) / 2 },
      span,
      goals: ['east'],
      hero: actorView(this.hero, 'hero'),
      actors: [actorView(this.runner, 'mate', this.state === 'ready')],
      ball: this.ballView(this.ball),
      cones: [],
      gates: [],
      goalTargets: [],
      rings,
      lines,
      preview: null,
      hud: {
        points: Math.round(this.points),
        combo: this.combo,
        timeLeft: this.timeLeft,
        duration: this.duration,
        prompt: this.phase === 'countdown' ? 'ready' : this.phase === 'post' || this.finished ? 'done' : window ? 'crossNow' : 'crossing',
        meters: this.state === 'ready' && this.live ? [{ kind: 'beat', value: lead, tone: window ? 'green' : rel < -0.3 ? 'red' : 'gold' }] : [],
        level: this.round,
        countdown: this.countdown,
      },
      heroOnBall: this.state === 'ready',
      heroIsKeeper: false,
    }
  }
}
