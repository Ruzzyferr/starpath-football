/**
 * Reading the Game ("Oyun Okuma", Anticipation) and its Pressing variant
 * ("Pres Çalışması", Work Rate).
 *
 * Standard: three passers in a triangle knock the ball around; the hero is
 * the defender in the middle. Before every pass the passer gives his
 * intention away (he turns to his target, who lights up): Anticipation shows
 * that tell earlier (0.3 s + up to 0.65 s). Move with the stick, or tap a spot
 * to run there, and get into the lane: a ball that comes within reach is
 * intercepted (100), +50 when you were already standing in the lane as it was
 * played ("read it"). A completed pass breaks the streak.
 *
 * Press: four players on the corners of a square. Whoever receives the ball
 * is your man: close him down to within 2.2 m before he plays it on (80 + 30
 * per second to spare). SPRINT is faster but drains your tank; Work Rate makes
 * the running cheaper, Stamina refills it. Intercepting a pass also counts.
 */
import { a01, clampN, dist, type Agent, type Vec2 } from '../../model'
import { flatAttrs } from '../../setup'
import { arriveTo } from '../vec'
import { DrillBase, actorView, makeActor, snapPrev } from '../base'
import { PRESS_RADIUS, interceptPoints, interceptReach, pressDrain, pressPoints, readTell } from '../scoring'
import type { DrillConfig, DrillInput, DrillView, LineView, RingView } from '../types'

const CX = 60
const CY = 34
type Cycle = 'hold' | 'flight' | 'reset'

/** Distance from point p to segment ab. */
export function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const l2 = abx * abx + aby * aby
  const t = l2 > 0 ? clampN(((p.x - a.x) * abx + (p.y - a.y) * aby) / l2, 0, 1) : 0
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t))
}

export class InterceptionDrill extends DrillBase {
  readonly hero: Agent
  readonly passers: Agent[]
  readonly ball = { x: CX, y: CY, z: 0, vx: 0, vy: 0, vz: 0, spin: { side: 0, top: 0 } }
  private cycle: Cycle = 'hold'
  private cycleT = 0
  private holder = 0
  private target = 1
  private hold = 1.6
  private passSpeed = 13
  private dest: Vec2 | null = null
  private readAtRelease = false
  private pressedThis = false
  private gassed = false
  private flash: { at: number; tone: 'green' | 'red' } | null = null

  constructor(cfg: DrillConfig) {
    super('interception', cfg)
    const spots: Vec2[] = this.press
      ? [{ x: CX + 12, y: CY + 12 }, { x: CX + 12, y: CY - 12 }, { x: CX - 12, y: CY - 12 }, { x: CX - 12, y: CY + 12 }]
      : [{ x: CX + 12.7, y: CY }, { x: CX - 6.35, y: CY + 11 }, { x: CX - 6.35, y: CY - 11 }]
    this.passers = spots.map((p, i) => makeActor(`p${i}`, 'opp', 'CM', p, flatAttrs(this.oppLevel), { number: 4 + i * 3 }))
    this.hero = makeActor('hero', 'hero', 'DM', { x: CX, y: CY }, this.attrs, { hero: true, number: 6 })
    this.hero.stamina = 1
    this.newHold(this.rng.int(0, this.passers.length - 1))
  }

  /** The passers' attributes (their level is {@link oppLevel}). */
  get oppAttrs(): Agent['attrs'] {
    return this.passers[0]!.attrs
  }

  /** Hold-time factor: composure and passing let a passer move the ball on quicker. */
  private get oppHold(): number {
    return 1.2 - a01(this.oppAttrs.composure * 0.5 + this.oppAttrs.passing * 0.5) * 0.4
  }

  get press(): boolean {
    return this.variant === 'press'
  }

  /** Jog / sprint speeds (m/s): pace and acceleration. */
  get jogSpeed(): number {
    return 4.6 + a01(this.attrs.pace) * 1.4 + a01(this.attrs.acceleration) * 0.4
  }
  /** Pressing: Work Rate is the will to keep sprinting at the man (a faster, longer press). */
  get sprintSpeed(): number {
    return this.jogSpeed + (this.press ? a01(this.attrs.workRate) * 3.4 : 1.8)
  }

  private newHold(holder: number): void {
    this.holder = holder
    this.cycle = 'hold'
    this.cycleT = 0
    const others = this.passers.map((_, i) => i).filter((i) => i !== holder)
    if (this.press) {
      // Round the square to an adjacent corner (never through the presser in the middle).
      const adj = others.filter((i) => (i + 2) % 4 !== holder)
      this.target = this.rng.pick(adj)
      this.hold = this.rng.range(1.7, 2.3) * this.oppHold
    } else {
      // A thinking passer plays the lane the defender is further from (Vision: how often he sees it).
      const far = [...others].sort((a, b) => this.laneDist(holder, b) - this.laneDist(holder, a))
      this.target = this.rng.chance(0.35 + a01(this.oppAttrs.vision) * 0.6) ? far[0]! : this.rng.pick(others)
      this.hold = this.rng.range(1.1, 1.9) * this.oppHold
    }
    // Passing: a crisper pass gives the defender less time.
    this.passSpeed = this.rng.range(this.press ? 12 : 14, this.press ? 15 : 18) * (0.88 + a01(this.oppAttrs.passing) * 0.22)
    const h = this.passers[holder]!
    Object.assign(this.ball, { x: h.pos.x + 0.6, y: h.pos.y, z: 0, vx: 0, vy: 0 })
    this.pressedThis = false
  }

  private laneDist(a: number, b: number): number {
    return distToSegment(this.hero.pos, this.passers[a]!.pos, this.passers[b]!.pos)
  }

  /** The passer's intention is visible (tell). */
  get telling(): boolean {
    // Anticipation reads the tell earlier; a passer's Vision disguises it a little.
    return this.cycle === 'hold' && this.hold - this.cycleT <= readTell(this.attrs.anticipation) * (1.15 - a01(this.oppAttrs.vision) * 0.3)
  }

  private release(): void {
    const from = this.passers[this.holder]!.pos
    const to = this.passers[this.target]!.pos
    const d = dist(from, to)
    this.ball.x = from.x
    this.ball.y = from.y
    this.ball.vx = ((to.x - from.x) / d) * this.passSpeed
    this.ball.vy = ((to.y - from.y) / d) * this.passSpeed
    this.readAtRelease = distToSegment(this.hero.pos, from, to) <= 1.6
    this.cycle = 'flight'
    this.cycleT = 0
    this.stat('passes')
    this.events.push({ type: 'kick', power: 0.6, hero: false, x: from.x, y: from.y })
  }

  private intercepted(): void {
    const h = this.hero
    this.stat('interceptions')
    if (this.readAtRelease) this.stat('reads')
    this.flash = { at: this.time, tone: 'green' }
    this.events.push({ type: 'touch', x: h.pos.x, y: h.pos.y })
    this.award(interceptPoints({ read: this.readAtRelease, combo: this.combo }), true, { label: this.readAtRelease ? 'read' : 'intercept', x: h.pos.x, y: h.pos.y })
    this.ball.vx = 0
    this.ball.vy = 0
    this.cycle = 'reset'
    this.cycleT = 0
  }

  // ───────────────────────── Step ─────────────────────────

  protected beforeStep(): void {
    snapPrev([this.hero, ...this.passers])
  }

  protected busy(): boolean {
    return this.cycle === 'flight'
  }

  protected tick(dt: number, input: DrillInput, live: boolean): void {
    this.cycleT += dt
    this.moveHero(dt, input, live)
    for (const p of this.passers) {
      p.stateT += dt
      const look = p === this.passers[this.holder] && this.cycle === 'hold' && this.telling ? this.passers[this.target]!.pos : this.hero.pos
      p.facing = Math.atan2(look.y - p.pos.y, look.x - p.pos.x)
    }
    if (!live) {
      if (this.cycle === 'flight') this.flight(dt, false)
      return
    }
    if (this.cycle === 'hold') {
      if (this.press && !this.pressedThis && dist(this.hero.pos, this.passers[this.holder]!.pos) <= PRESS_RADIUS) {
        this.pressedThis = true
        const spare = this.hold - this.cycleT
        this.stat('presses')
        this.flash = { at: this.time, tone: 'green' }
        this.award(pressPoints(spare, this.combo), true, { label: 'pressed', x: this.hero.pos.x, y: this.hero.pos.y })
        // Forced error: the ball runs loose, a new possession starts elsewhere.
        this.cycle = 'reset'
        this.cycleT = 0
        return
      }
      if (this.cycleT >= this.hold) this.release()
    } else if (this.cycle === 'flight') this.flight(dt, true)
    else if (this.cycle === 'reset' && this.cycleT >= (this.press ? 0.6 : 0.8)) {
      const options = this.passers.map((_, i) => i).filter((i) => i !== this.holder)
      // Never restart right at the hero's feet.
      const pick = options.filter((i) => dist(this.passers[i]!.pos, this.hero.pos) > 6)
      this.newHold(this.rng.pick(pick.length ? pick : options))
    }
  }

  private flight(dt: number, live: boolean): void {
    const b = this.ball
    b.x += b.vx * dt
    b.y += b.vy * dt
    if (live && dist(this.hero.pos, b) <= interceptReach(this.attrs.anticipation)) return this.intercepted()
    const to = this.passers[this.target]!
    if (dist(b, to.pos) < 0.7 || this.cycleT > 4) {
      if (live) {
        this.stat('completed')
        this.flash = { at: this.time, tone: 'red' }
        this.award(0, false, { label: this.press ? 'escaped' : 'pass', x: to.pos.x, y: to.pos.y })
      }
      this.newHold(this.target)
    }
  }

  private moveHero(dt: number, input: DrillInput, live: boolean): void {
    const h = this.hero
    h.stateT += dt
    if (live) {
      for (const a of input.actions) if (a.kind === 'tapAt') this.dest = { ...a.at }
    }
    const stick = Math.hypot(input.move.x, input.move.y) > 0.15
    if (stick) this.dest = null
    // Stamina (pressing variant only).
    const sprinting = live && input.sprint && !this.gassed && (stick || !!this.dest)
    if (this.press) {
      if (sprinting) h.stamina = Math.max(0, h.stamina - pressDrain(this.attrs.workRate, this.attrs.stamina) * dt)
      else h.stamina = Math.min(1, h.stamina + 0.12 * (0.6 + a01(this.attrs.stamina) * 0.8) * dt)
      if (h.stamina <= 0 && !this.gassed) {
        this.gassed = true
        this.stat('gassed')
        this.events.push({ type: 'score', points: 0, label: 'gassed', good: false, x: h.pos.x, y: h.pos.y })
      }
      if (this.gassed && h.stamina >= 0.35) this.gassed = false
    }
    const top = !live ? 0 : this.gassed ? this.jogSpeed * 0.7 : sprinting ? this.sprintSpeed : this.jogSpeed
    let want: Vec2 = { x: 0, y: 0 }
    if (stick) {
      const l = Math.min(1, Math.hypot(input.move.x, input.move.y))
      const n = Math.hypot(input.move.x, input.move.y)
      want = { x: (input.move.x / n) * top * l, y: (input.move.y / n) * top * l }
    } else if (this.dest) {
      want = arriveTo(h.pos, this.dest, top, 1.2)
      if (dist(h.pos, this.dest) < 0.15) this.dest = null
    }
    const acc = (10 + a01(this.attrs.acceleration) * 8 + a01(this.attrs.agility) * 4) * dt
    const dvx = want.x - h.vel.x
    const dvy = want.y - h.vel.y
    const dl = Math.hypot(dvx, dvy)
    h.vel = dl <= acc ? want : { x: h.vel.x + (dvx / dl) * acc, y: h.vel.y + (dvy / dl) * acc }
    h.sprint = sprinting
    h.pos = { x: clampN(h.pos.x + h.vel.x * dt, CX - 20, CX + 20), y: clampN(h.pos.y + h.vel.y * dt, CY - 18, CY + 18) }
    if (Math.hypot(h.vel.x, h.vel.y) > 0.3) h.facing = Math.atan2(h.vel.y, h.vel.x)
    else h.facing = Math.atan2(this.ball.y - h.pos.y, this.ball.x - h.pos.x)
  }

  // ───────────────────────── Bots / tests ─────────────────────────

  get state(): { cycle: Cycle; holder: Vec2; target: Vec2 | null; ball: Vec2; ballVel: Vec2; stamina: number; gassed: boolean; holdLeft: number } {
    return {
      cycle: this.cycle,
      holder: { ...this.passers[this.holder]!.pos },
      target: this.telling || this.cycle === 'flight' ? { ...this.passers[this.target]!.pos } : null,
      ball: { x: this.ball.x, y: this.ball.y },
      ballVel: { x: this.ball.vx, y: this.ball.vy },
      stamina: this.hero.stamina,
      gassed: this.gassed,
      holdLeft: this.cycle === 'hold' ? this.hold - this.cycleT : 0,
    }
  }

  view(): DrillView {
    const flash = this.flash && this.time - this.flash.at < 0.6 ? this.flash.tone : null
    const showTarget = (this.cycle === 'hold' && this.telling) || this.cycle === 'flight'
    const holderP = this.passers[this.holder]!
    const targetP = this.passers[this.target]!
    const lines: LineView[] = showTarget && this.cycle === 'hold' ? [{ a: holderP.pos, b: targetP.pos, tone: 'orange', width: 0.07 }] : []
    const rings: RingView[] = []
    if (this.press && this.cycle === 'hold') rings.push({ x: holderP.pos.x, y: holderP.pos.y, r: PRESS_RADIUS, tone: flash ?? 'gold', pulse: true })
    if (this.dest) rings.push({ x: this.dest.x, y: this.dest.y, r: 0.4, tone: 'white' })
    rings.push({ x: this.hero.pos.x, y: this.hero.pos.y, r: interceptReach(this.attrs.anticipation), tone: flash ?? 'dim' })
    const inLane = this.cycle === 'hold' && this.telling && distToSegment(this.hero.pos, holderP.pos, targetP.pos) <= 1.6
    const prompt =
      this.phase === 'countdown' ? 'ready'
        : this.phase === 'post' || this.finished ? 'done'
          : this.press ? (this.cycle === 'hold' && !this.pressedThis ? 'pressNow' : 'pressing')
            : inLane || this.cycle === 'flight' ? 'interceptNow' : 'reading'
    const meters: DrillView['hud']['meters'] = this.press
      ? [{ kind: 'stamina', value: this.hero.stamina, tone: this.gassed || this.hero.stamina < 0.25 ? 'red' : 'green' }]
      : []
    if (this.cycle === 'hold') meters.push({ kind: 'timing', value: clampN(this.cycleT / this.hold, 0, 1), tone: this.telling ? 'orange' : 'white' })
    return {
      focus: { x: CX, y: CY },
      span: this.press ? 34 : 30,
      goals: [],
      hero: actorView(this.hero, 'hero'),
      actors: this.passers.map((p, i) => actorView(p, 'opp', showTarget && i === this.target)),
      ball: this.cycle === 'reset' ? null : { x: this.ball.x, y: this.ball.y, z: 0, speed: Math.hypot(this.ball.vx, this.ball.vy) },
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
        prompt,
        meters,
        countdown: this.countdown,
      },
      heroOnBall: false,
      heroIsKeeper: false,
    }
  }
}

