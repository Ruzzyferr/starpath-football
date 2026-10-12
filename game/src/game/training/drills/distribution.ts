/**
 * Distribution & Claiming ("Çıkış & Hâkimiyet", distribution sessions, 2.3#2).
 *
 * The second goalkeeper drill, built on the match's keeper-hold mechanic
 * (hold the ball, release it before the six-second rule, a thrown / rolled
 * pass or a kick out of the hands). Each round:
 *  1. a winger whips a cross toward the six-yard box; a ring marks where it
 *     comes down. Step across with the stick/WASD to be under it; the hands
 *     take it once it is within reach (handling decides how often it sticks,
 *     a challenging striker makes it harder; a spilled ball is only punched
 *     away for a few points);
 *  2. with the ball in the hands three team-mates break forward. Tap / swipe
 *     toward one (or press THROW for the lit one) to release: up to 24 m it is
 *     a throw, beyond that a kick out of the hands. The team-mate keeps
 *     running, so lead him (aim assist leads him for you);
 *  3. finding a team-mate scores by accuracy, a quick release (within 2 s of
 *     the catch) and distance. Hold it past 6 s or miss everybody and the
 *     streak is gone.
 * Throw and kick use the match kick model ('pass' / 'lofted', Passing and
 * Vision shape the scatter).
 */
import { PITCH_WIDTH } from '../../../sim/match/types'
import { planKick, type KickKind } from '../../kick'
import { GOAL_CENTER_Y, cloneBall, createTracker, stepBall, type BallState, type BallTracker, type PhysicsEvent } from '../../physics'
import { flatAttrs } from '../../setup'
import { KEEPER_HOLD_SECONDS, type HeroAction } from '../../runtime'
import { a01, add, angleDiff, clampN, dist, len, norm, scale, sub, type Agent, type Vec2 } from '../../model'
import { eventChanceOf } from '../../chanceEvents'
import { claimHoldChance, keeperBurst } from '../../keeperPhysics'
import { arriveTo } from '../vec'
import { DT, DrillBase, actorView, makeActor, place, snapPrev } from '../base'
import { DIST_CLAIM_POINTS, DIST_PUNCH_POINTS, DIST_QUICK_S, DIST_RECEIVE_R, DIST_THROW_RANGE, distributionPoints } from '../scoring'
import type { DrillConfig, DrillInput, DrillView, LineView, RingView } from '../types'

type Cycle = 'setup' | 'cross' | 'hold' | 'release' | 'resolved'

/** Points off the striker's contest roll (Jumping vs the keeper's Handling): 56 vs 50 → 36 %. */
const CONTEST_MOD = -20
/** The ball counts as "in reach" below this height while it is dropping. */
const CLAIM_Z = 2.4

interface Mate {
  agent: Agent
  start: Vec2
  vel: Vec2
}

export class DistributionDrill extends DrillBase {
  readonly hero: Agent
  readonly winger: Agent
  readonly striker: Agent
  readonly mates: Mate[]
  readonly ball: BallState
  private tracker: BallTracker = createTracker()
  private readonly phys: PhysicsEvent[] = []
  private cycle: Cycle = 'setup'
  private cycleT = 0
  private round = 0
  private spot: Vec2 = { x: 16, y: 10 }
  private landingAt: Vec2 = { x: 8, y: GOAL_CENTER_Y }
  private contested = false
  private claimed = false
  private holdT = 0
  private featured = 0
  private releaseQuick = false
  private releaseFar = false
  private flash: { at: number; tone: 'green' | 'red' } | null = null

  constructor(cfg: DrillConfig) {
    super('distribution', cfg)
    this.hero = makeActor('hero', 'hero', 'GK', { x: 3, y: GOAL_CENTER_Y }, this.attrs, { hero: true, number: 1 })
    // The winger and the striker attacking the cross are the drill's opposition.
    this.winger = makeActor('wing', 'opp', 'RW', { x: 16, y: 10 }, flatAttrs(this.oppLevel), { number: 7 })
    this.striker = makeActor('st', 'opp', 'ST', { x: 12, y: GOAL_CENTER_Y }, flatAttrs(this.oppLevel), { number: 9 })
    this.mates = [0, 1, 2].map((i) => ({ agent: makeActor(`m${i}`, 'hero', (['LB', 'CM', 'RB'] as const)[i]!, { x: 22, y: 20 + i * 14 }, flatAttrs(65), { number: 2 + i }), start: { x: 22, y: 20 + i * 14 }, vel: { x: 3, y: 0 } }))
    this.ball = { x: 16, y: 10, z: 0, vx: 0, vy: 0, vz: 0, spin: { side: 0, top: 0 } }
    this.newRound()
  }

  // ───────────────────────── Rounds ─────────────────────────

  private newRound(): void {
    this.round++
    const side = this.round % 2 === 1 ? 1 : -1
    const flip = this.rng.chance(0.25) ? -side : side
    this.spot = { x: this.rng.range(13, 20), y: GOAL_CENTER_Y + flip * this.rng.range(22, 26) }
    const zone = { x: this.rng.range(6.5, 9.5), y: GOAL_CENTER_Y + this.rng.range(-5, 5) }
    this.tracker = createTracker()
    Object.assign(this.ball, { x: this.spot.x - 0.5, y: this.spot.y - flip * 0.4, z: 0, vx: 0, vy: 0, vz: 0 })
    this.ball.spin = { side: 0, top: 0 }
    place(this.hero, { x: 3, y: GOAL_CENTER_Y + this.rng.range(-2.5, 2.5) }, 0)
    place(this.winger, this.spot, Math.atan2(zone.y - this.spot.y, zone.x - this.spot.x))
    place(this.striker, { x: zone.x + 4.5, y: zone.y + this.rng.range(-4, 4) }, Math.PI)
    // Team-mates wait up the pitch, then break forward once the keeper has it.
    const ys = [GOAL_CENTER_Y - 15, GOAL_CENTER_Y + 1, GOAL_CENTER_Y + 15]
    this.rng.shuffle(ys)
    this.mates.forEach((m, i) => {
      const far = i === 1
      m.start = { x: far ? this.rng.range(30, 36) : this.rng.range(13, 19), y: ys[i]! + this.rng.range(-2.5, 2.5) }
      m.vel = { x: this.rng.range(2.4, 3.6), y: (i === 1 ? this.rng.range(-1.5, 1.5) : (m.start.y < GOAL_CENTER_Y ? 1 : -1) * this.rng.range(0, 1.4)) }
      place(m.agent, m.start, 0)
    })
    this.featured = this.rng.int(0, 2)
    // Whether the striker gets in on the cross: his Jumping against the keeper's command of it (Handling), the one
    // chance rule (eventChanceOf, +1 % a point) with CONTEST_MOD points off (a cross is the keeper's ball by default).
    this.contested = this.rng.chance(eventChanceOf(this.striker.attrs.jumping, this.attrs.handling, CONTEST_MOD))
    this.claimed = false
    this.holdT = 0
    this.landingAt = zone
    this.cycle = 'setup'
    this.cycleT = 0
  }

  private mateNow(m: Mate): Vec2 {
    const t = this.cycle === 'hold' || this.cycle === 'release' ? this.holdT : 0
    return { x: m.start.x + m.vel.x * t, y: clampN(m.start.y + m.vel.y * t, 8, PITCH_WIDTH - 8) }
  }

  // ───────────────────────── Cross ─────────────────────────

  private deliverCross(): void {
    const plan = planKick(
      // A better crosser whips it in quicker (less time to come for it).
      { kind: 'cross', from: { x: this.ball.x, y: this.ball.y }, fromZ: 0, target: this.landingAt, power: 0.68 + a01(this.winger.attrs.crossing) * 0.2, curl: 0, attrs: this.winger.attrs, pressure: 0, assist: 'manual', env: this.env, noiseScale: 1.1 },
      this.rng,
    )
    this.ball.vx = plan.vx
    this.ball.vy = plan.vy
    this.ball.vz = plan.vz
    this.ball.spin = { ...plan.spin }
    // Where it will really come down (the ring the player steps toward).
    const b = cloneBall(this.ball)
    const tr = createTracker()
    const ev: PhysicsEvent[] = []
    let at = { x: this.landingAt.x, y: this.landingAt.y }
    for (let i = 0; i < 400; i++) {
      stepBall(b, this.env, tr, ev)
      if (b.vz < 0 && b.z <= CLAIM_Z - 0.4) {
        at = { x: b.x, y: b.y }
        break
      }
    }
    this.landingAt = at
    this.winger.state = 'skill'
    this.winger.stateT = 0
    this.stat('crosses')
    this.events.push({ type: 'kick', power: 0.78, hero: false, x: this.ball.x, y: this.ball.y })
    this.cycle = 'cross'
    this.cycleT = 0
  }

  /** A team-mate's receiving room (m): the striker's anticipation and work rate get tight on the outlet. */
  private get receiveR(): number {
    const st = this.striker.attrs
    return DIST_RECEIVE_R * clampN(1.3 - a01((st.anticipation + st.workRate) / 2) * 0.6, 0.8, 1.2)
  }

  private reach(): number {
    // Command of area: Positioning (GK) has him set where the cross drops, so it lands within reach more often.
    return 0.8 + a01(this.attrs.handling) * 0.45 + a01(this.attrs.gkPositioning) * 0.15 + a01(this.attrs.jumping) * 0.2
  }

  private flightCross(): void {
    const b = this.ball
    const d = dist(this.hero.pos, { x: b.x, y: b.y })
    if (!this.claimed && b.vz < 0 && b.z <= CLAIM_Z && d <= this.reach()) {
      this.claimed = true
      // Caught or punched: the match's claimHoldChance (Handling, a striker in on him counts as the runtime's
      // one-man crowd 0.5, the height he takes it at and the pace of the cross).
      const ok = this.rng.chance(claimHoldChance(this.hero, b.z, this.contested ? 0.5 : 0, Math.hypot(b.vx, b.vy, b.vz)))
      if (ok) {
        this.stat('claims')
        this.cycle = 'hold'
        this.cycleT = 0
        this.holdT = 0
        this.hero.vel = { x: 0, y: 0 }
        this.events.push({ type: 'save', hero: true, held: true, x: b.x, y: b.y, z: b.z })
        this.award(DIST_CLAIM_POINTS, true, { label: 'held', x: b.x, y: b.y, z: b.z })
      } else {
        // Spilled: the keeper only gets a fist to it.
        this.stat('punched')
        this.events.push({ type: 'save', hero: true, held: false, x: b.x, y: b.y, z: b.z })
        b.vx = 7
        b.vy = (b.y >= GOAL_CENTER_Y ? 1 : -1) * 3
        b.vz = 3
        this.award(DIST_PUNCH_POINTS, false, { label: 'save', x: b.x, y: b.y, z: b.z })
        this.cycle = 'resolved'
        this.cycleT = 0
      }
      return
    }
    this.phys.length = 0
    stepBall(b, this.env, this.tracker, this.phys)
    for (const e of this.phys) {
      if (e.type === 'goal' || e.type === 'out' || (e.type === 'post' || e.type === 'bar')) return this.missClaim()
    }
    if ((b.z <= 0.05 && b.vz <= 0 && this.cycleT > 0.4) || this.cycleT > 4) this.missClaim()
  }

  private missClaim(): void {
    if (this.cycle !== 'cross') return
    this.stat('missedClaims')
    this.flash = { at: this.time, tone: 'red' }
    this.award(0, false, { label: 'whiff', x: this.ball.x, y: this.ball.y })
    this.cycle = 'resolved'
    this.cycleT = 0
  }

  // ───────────────────────── Distribution ─────────────────────────

  /** Noiseless time for a release of `kind` to run from the hands to `target` (closest approach). */
  private flightTime(kind: KickKind, target: Vec2): number {
    const from = { x: this.hero.pos.x + Math.cos(this.hero.facing) * 0.3, y: this.hero.pos.y + Math.sin(this.hero.facing) * 0.3 }
    const plan = planKick({ kind, from, fromZ: kind === 'pass' ? 1.1 : 0.4, target, power: 0.75, curl: 0, attrs: this.attrs, pressure: 0, assist: 'manual', env: this.env, fromHands: true })
    const b: BallState = { x: from.x, y: from.y, z: kind === 'pass' ? 1.1 : 0.4, vx: plan.vx, vy: plan.vy, vz: plan.vz, spin: { ...plan.spin } }
    const tr = createTracker()
    const ev: PhysicsEvent[] = []
    let best = Infinity
    for (let i = 1; i < 300; i++) {
      stepBall(b, this.env, tr, ev)
      const d = Math.hypot(b.x - target.x, b.y - target.y)
      if (d < best) best = d
      else if (d > best + 0.5) return i * DT
      if (d < 0.8) return i * DT
    }
    return 1.5
  }

  private kindFor(target: Vec2): KickKind {
    return dist(this.hero.pos, target) <= DIST_THROW_RANGE ? 'pass' : 'lofted'
  }

  /** Where to aim so the ball meets team-mate `i` (his run is led). */
  leadPoint(i: number): Vec2 {
    const m = this.mates[i]!
    let p = this.mateNow(m!)
    for (let k = 0; k < 3; k++) {
      const t = this.flightTime(this.kindFor(p), p)
      p = { x: m.agent.pos.x + m.vel.x * t, y: clampN(m.agent.pos.y + m.vel.y * t, 8, PITCH_WIDTH - 8) }
    }
    return p
  }

  /** Aim for an action, or null when it is not a release gesture. */
  private interpret(act: HeroAction): Vec2 | null {
    const from = this.hero.pos
    const snapR = this.assist === 'full' ? 9 : this.assist === 'half' ? 6 : 0
    const nearest = (p: Vec2): { i: number; lead: Vec2; d: number } => {
      let best = { i: 0, lead: p, d: Infinity }
      for (let i = 0; i < this.mates.length; i++) {
        const d = dist(p, this.mateNow(this.mates[i]!))
        if (d < best.d) best = { i, lead: this.leadPoint(i), d }
      }
      return best
    }
    const snap = (p: Vec2): Vec2 => {
      if (snapR <= 0) return p
      const n = nearest(p)
      if (n.d > snapR) return p
      return this.assist === 'full' ? n.lead : add(p, scale(sub(n.lead, p), 0.6))
    }
    const along = (dir: Vec2, power: number): Vec2 => {
      const cone = this.assist === 'full' ? 0.4 : this.assist === 'half' ? 0.28 : 0.1
      const ang = Math.atan2(dir.y, dir.x)
      let best = -1
      let bestA = cone
      for (let i = 0; i < this.mates.length; i++) {
        const m = this.mateNow(this.mates[i]!)
        const a = Math.abs(angleDiff(ang, Math.atan2(m.y - from.y, m.x - from.x)))
        if (a < bestA) {
          bestA = a
          best = i
        }
      }
      if (best >= 0 && this.assist !== 'manual') return this.leadPoint(best)
      return add(from, scale(norm(dir), 10 + clampN(power, 0.3, 1.1) * 28))
    }
    switch (act.kind) {
      case 'tapAt':
        return snap(act.at)
      case 'pass':
        if (act.target) return snap(act.target)
        if (act.dir && len(act.dir) > 0.2) return along(act.dir, 0.75)
        return this.leadPoint(this.featured)
      case 'shoot':
        return snap(act.target)
      case 'swipe':
        return act.swipe.isTap ? null : along(act.swipe.dir, act.swipe.power)
      case 'action':
      case 'skill':
        return this.leadPoint(this.featured)
      default:
        return null
    }
  }

  private release(input: DrillInput): void {
    for (const act of input.actions) {
      const target = this.interpret(act)
      if (!target) continue
      const kind = this.kindFor(target)
      const h = this.hero
      const from = { x: h.pos.x + Math.cos(h.facing) * 0.3, y: h.pos.y + Math.sin(h.facing) * 0.3 }
      const plan = planKick(
        { kind, from, fromZ: kind === 'pass' ? 1.1 : 0.4, target, power: 0.75, curl: 0, attrs: this.attrs, pressure: 0, assist: this.assist, env: this.env, noiseScale: 1.1, fromHands: true },
        this.rng,
      )
      Object.assign(this.ball, { x: from.x, y: from.y, z: kind === 'pass' ? 1.1 : 0.4, vx: plan.vx, vy: plan.vy, vz: plan.vz })
      this.ball.spin = { ...plan.spin }
      this.tracker = createTracker()
      h.facing = Math.atan2(plan.vy, plan.vx)
      h.state = 'skill'
      h.stateT = 0
      this.releaseQuick = this.holdT <= DIST_QUICK_S
      this.releaseFar = kind === 'lofted'
      this.stat(kind === 'pass' ? 'throws' : 'kicks')
      this.events.push({ type: 'kick', power: 0.75, hero: true, x: from.x, y: from.y })
      this.cycle = 'release'
      this.cycleT = 0
      return
    }
  }

  private flightRelease(): void {
    const b = this.ball
    this.phys.length = 0
    stepBall(b, this.env, this.tracker, this.phys)
    for (const m of this.mates) {
      const p = m.agent.pos
      const d = Math.hypot(b.x - p.x, b.y - p.y)
      if (d <= this.receiveR && b.z <= 1.7) return this.received(m, d)
    }
    for (const e of this.phys) if (e.type === 'out' || e.type === 'goal') return this.lost('miss')
    if (this.cycleT > 4.5 || (Math.hypot(b.vx, b.vy) < 0.6 && b.z < 0.05 && this.cycleT > 0.5)) this.lost('miss')
  }

  private received(m: Mate, d: number): void {
    const accuracy = 1 - d / this.receiveR
    this.stat('found')
    if (this.releaseQuick) this.stat('quick')
    this.flash = { at: this.time, tone: 'green' }
    this.events.push({ type: 'touch', x: m.agent.pos.x, y: m.agent.pos.y })
    this.award(distributionPoints({ accuracy, quick: this.releaseQuick, far: this.releaseFar, combo: this.combo }), true, { label: accuracy > 0.6 ? 'perfect' : 'pass', x: m.agent.pos.x, y: m.agent.pos.y, z: 1.5 })
    this.ball.vx = 0
    this.ball.vy = 0
    this.ball.vz = 0
    this.cycle = 'resolved'
    this.cycleT = 0
  }

  private lost(label: 'miss' | 'late'): void {
    if (this.cycle !== 'release' && this.cycle !== 'hold') return
    this.stat(label === 'late' ? 'timeouts' : 'misses')
    this.flash = { at: this.time, tone: 'red' }
    this.award(0, false, { label, x: this.ball.x, y: this.ball.y })
    this.cycle = 'resolved'
    this.cycleT = 0
  }

  // ───────────────────────── Hero keeper ─────────────────────────

  private moveHero(dt: number, input: DrillInput, live: boolean): void {
    const h = this.hero
    h.stateT += dt
    if (h.state === 'skill' && h.stateT > 0.45) h.state = 'run'
    let mv = live ? input.move : { x: 0, y: 0 }
    if (len(mv) < 0.1 && this.assist !== 'manual' && this.cycle === 'cross' && !this.claimed) {
      // Assist walks him toward the ring; the stick overrides it.
      const v = arriveTo(h.pos, this.landingAt, (this.assist === 'full' ? 0.75 : 0.45) * 5.5, 1.2)
      mv = scale(v, 1 / 5.5)
    }
    // The match keeper's burst (keeperPhysics.keeperBurst: Pace), slower with the ball in his hands.
    const speed = keeperBurst(h) * (this.cycle === 'hold' ? 0.6 : 1)
    const m = len(mv) > 1 ? norm(mv) : mv
    h.vel = scale(m, speed)
    h.pos = { x: clampN(h.pos.x + h.vel.x * dt, 0.6, 14), y: clampN(h.pos.y + h.vel.y * dt, GOAL_CENTER_Y - 14, GOAL_CENTER_Y + 14) }
    if (len(h.vel) > 0.5 && this.cycle !== 'hold') h.facing = Math.atan2(h.vel.y, h.vel.x)
    else if (this.cycle === 'cross') h.facing = Math.atan2(this.ball.y - h.pos.y, this.ball.x - h.pos.x)
  }

  // ───────────────────────── Step ─────────────────────────

  protected beforeStep(): void {
    snapPrev([this.hero, this.winger, this.striker, ...this.mates.map((m) => m.agent)])
  }

  protected busy(): boolean {
    return this.cycle === 'cross' || this.cycle === 'hold' || this.cycle === 'release'
  }

  protected tick(dt: number, input: DrillInput, live: boolean): void {
    this.cycleT += dt
    this.moveHero(dt, input, live)
    const w = this.winger
    w.stateT += dt
    if (w.state === 'skill' && w.stateT > 0.45) w.state = 'run'

    // Striker (and winger follow-through) are cosmetic: the striker attacks the landing point.
    const st = this.striker
    st.vel = this.cycle === 'cross' && this.contested ? arriveTo(st.pos, this.landingAt, 4.2, 1.5) : { x: 0, y: 0 }
    st.pos = add(st.pos, scale(st.vel, dt))

    if (this.cycle === 'setup') {
      if (this.cycleT > 0.7 && (live || this.phase === 'countdown')) this.deliverCross()
    } else if (this.cycle === 'cross') {
      this.flightCross()
    } else if (this.cycle === 'hold') {
      this.holdT += dt
      this.ball.x = this.hero.pos.x + Math.cos(this.hero.facing) * 0.3
      this.ball.y = this.hero.pos.y + Math.sin(this.hero.facing) * 0.3
      this.ball.z = 1.1
      this.ball.vx = this.ball.vy = this.ball.vz = 0
      if (live) this.release(input)
      if (this.cycle === 'hold' && this.holdT >= KEEPER_HOLD_SECONDS) this.lost('late')
    } else if (this.cycle === 'release') {
      this.holdT += dt
      this.flightRelease()
    } else if (this.cycle === 'resolved') {
      if (this.ball.z > 0 || Math.hypot(this.ball.vx, this.ball.vy) > 0.1) {
        this.phys.length = 0
        stepBall(this.ball, this.env, this.tracker, this.phys)
      }
      if (this.cycleT > 0.9 && (live || this.phase === 'countdown')) this.newRound()
    }

    // Team-mates: jog on the spot, then break forward once the keeper has the ball.
    for (const m of this.mates) {
      const a = m.agent
      a.stateT += dt
      if (this.cycle === 'hold' || this.cycle === 'release') {
        const p = this.mateNow(m)
        a.vel = scale(sub(p, a.pos), 1 / dt)
        a.pos = p
        a.facing = Math.atan2(m.vel.y, m.vel.x)
      } else if (this.cycle === 'resolved' && len(a.vel) > 0.5) {
        a.vel = scale(a.vel, 0.9)
        a.pos = add(a.pos, scale(a.vel, dt))
      } else {
        a.vel = { x: 0, y: 0 }
        a.facing = Math.atan2(this.hero.pos.y - a.pos.y, this.hero.pos.x - a.pos.x)
      }
    }
  }

  // ───────────────────────── Bots / tests ─────────────────────────

  /** Ring the cross comes down on. */
  get landing(): Vec2 {
    return { ...this.landingAt }
  }
  get crossing(): boolean {
    return this.cycle === 'cross' && !this.claimed
  }
  get holding(): boolean {
    return this.cycle === 'hold' && this.live
  }
  get holdSeconds(): number {
    return this.holdT
  }
  mateAt(i: number): Vec2 {
    return { ...this.mates[i]!.agent.pos }
  }
  get featuredMate(): number {
    return this.featured
  }

  view(): DrillView {
    const flash = this.flash && this.time - this.flash.at < 0.7 ? this.flash.tone : null
    const rings: RingView[] = []
    const lines: LineView[] = []
    if (this.cycle === 'setup' || this.cycle === 'cross') rings.push({ x: this.landingAt.x, y: this.landingAt.y, r: this.reach(), tone: flash ?? 'gold', pulse: this.cycle === 'cross' && !this.claimed })
    if (this.cycle === 'hold') {
      const p = this.mates[this.featured]!.agent.pos
      lines.push({ a: this.hero.pos, b: p, tone: 'white', width: 0.08 })
    }
    const left = clampN(1 - this.holdT / KEEPER_HOLD_SECONDS, 0, 1)
    const hold = this.cycle === 'hold' && this.live
    return {
      focus: { x: 21, y: GOAL_CENTER_Y },
      span: 50,
      goals: ['west'],
      hero: actorView(this.hero, 'hero'),
      actors: [
        actorView(this.winger, 'opp'),
        actorView(this.striker, 'opp'),
        ...this.mates.map((m, i) => actorView(m.agent, 'mate', hold && i === this.featured)),
      ],
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
        prompt: this.phase === 'countdown' ? 'ready' : this.phase === 'post' || this.finished ? 'done' : this.cycle === 'hold' || this.cycle === 'release' ? 'distribute' : 'claim',
        meters: hold ? [{ kind: 'timing', value: left, tone: left < 0.3 ? 'red' : left < 0.6 ? 'gold' : 'green' }] : [],
        level: this.round,
        countdown: this.countdown,
      },
      heroOnBall: this.cycle === 'hold',
      heroIsKeeper: true,
    }
  }
}
