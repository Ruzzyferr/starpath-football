/**
 * Tackle Duel ("Top Kapma Düellosu", tackling sessions).
 *
 * One-on-one: a dribbler comes at the hero from upfield and tries to beat him
 * to the line behind. Jockey with the stick / WASD to stay goal-side, then
 * win the ball:
 *  - TACKLE (button / Space / tap / click): a standing tackle, in reach only;
 *  - swipe / hold & release toward the ball: a sliding tackle (longer reach,
 *    more foul risk, a bonus when it comes off).
 * Timing is the ball: right after the dribbler pushes it ahead it is exposed
 * (ring turns green) — tackle then for the best odds. The odds are the match
 * rule (chanceEvents.ts 'tackle': Tackling vs Dribbling, +1 % a point, timing
 * ±15, from behind −20, slide −5; a miss stays clean on 'clean'). A lost tackle leaves you on the floor;
 * a foul or getting beaten costs points. Every duel the dribbler is a bit
 * different (lane, feint distance, cut side).
 */
import { createTracker, stepBall, type BallState, type BallTracker, type PhysicsEvent } from '../../physics'
import { flatAttrs } from '../../setup'
import { a01, accel, add, clampN, dist, dot, fromAngle, len, norm, scale, sub, topSpeed, type Agent, type Vec2 } from '../../model'
import type { HeroAction } from '../../runtime'
import { CHANCE_MOD, eventChance } from '../../chanceEvents'
import { DrillBase, actorView, makeActor, place, snapPrev } from '../base'
import { BEATEN_PENALTY, FOUL_PENALTY, tacklePoints } from '../scoring'
import type { DrillConfig, DrillInput, DrillView, LineView, RingView } from '../types'

type DuelState = 'setup' | 'duel' | 'resolved'
type CarrierMode = 'approach' | 'cut' | 'escape' | 'stumble'

/** The dribbler wins by carrying the ball over this line. */
export const END_X = 26
const HERO_HOME: Vec2 = { x: 40, y: 34 }
const START_X = 53
const SETUP_TIME = 0.6

/**
 * Duel odds (owner, build 9: the match rule, chanceEvents.ts): the win is eventChance('tackle') — Tackling vs the
 * carrier's Dribbling, +1 % a point — moved by the input: timing ±CHANCE_MOD.timing (the ball just pushed ahead =
 * +15, at his feet = −15), from behind CHANCE_MOD.behind, a slide CHANCE_MOD.slide. A challenge that does not win
 * it stays clean on eventChance('clean') (Tackling + CHANCE_MOD.cleanStanding / cleanSlide, from behind −20), else
 * it is a foul. `timing` is 0..1 (0.45 = neutral).
 */
export function drillTackleChances(tackler: Agent, carrier: Agent, timing: number, fromBehind: boolean, slide: boolean): { win: number; foul: number } {
  const mod = clampN((timing - 0.45) / 0.45, -1, 1) * CHANCE_MOD.timing + (fromBehind ? CHANCE_MOD.behind : 0) + (slide ? CHANCE_MOD.slide : 0)
  const win = eventChance('tackle', tackler, carrier, mod)
  const foul = 1 - eventChance('clean', tackler, undefined, (slide ? CHANCE_MOD.cleanSlide : CHANCE_MOD.cleanStanding) + (fromBehind ? CHANCE_MOD.behind : 0))
  return { win, foul }
}
/** Touch cycle of the dribbler (s): the ball is exposed right after each touch. */
const TOUCH_PERIOD = 0.5
const SLIDE_TIME = 0.6
/** Share of the touch cycle the ball counts as (partly) exposed: wide enough for a human thumb to hit the green ring. */
const EXPOSED_SPAN = 0.85
/** The dribbler plants his foot this long at the start of a cut (the ball is knocked aside: tackle now). */
const PLANT_TIME = 0.25
const SLIDE_SPEED = 7.5

export class TacklingDrill extends DrillBase {
  readonly hero: Agent
  readonly carrier: Agent
  readonly ball: BallState
  private tracker: BallTracker = createTracker()
  private readonly phys: PhysicsEvent[] = []
  private state: DuelState = 'setup'
  private stateT = 0
  private duel = 0
  private mode: CarrierMode = 'approach'
  private modeT = 0
  private lane = 34
  private cutAt = 3
  private cutSide = 1
  /** Touch phase 0..1 (0 = just touched). */
  private touchPhase = 0.5
  private owned = true
  private slideDir: Vec2 = { x: -1, y: 0 }
  private flash: { at: number; tone: 'green' | 'red' } | null = null

  constructor(cfg: DrillConfig) {
    super('tackling', cfg)
    this.hero = makeActor('hero', 'hero', 'CB', HERO_HOME, this.attrs, { hero: true, number: 4, facing: 0 })
    this.carrier = makeActor('drib', 'opp', 'LW', { x: START_X, y: 34 }, flatAttrs(this.oppLevel), { number: 11 })
    this.ball = { x: START_X - 0.5, y: 34, z: 0, vx: 0, vy: 0, vz: 0, spin: { side: 0, top: 0 } }
    this.newDuel()
  }

  // ───────────────────────── Duels ─────────────────────────

  private newDuel(): void {
    this.duel++
    this.lane = 34 + this.rng.range(-7, 7)
    // He commits to his cut just outside the defender's reach: a ball he knocks past you is there to be won.
    this.cutAt = this.reach + this.rng.range(0.5, 1.2)
    this.cutSide = this.rng.chance(0.5) ? 1 : -1
    place(this.hero, { x: HERO_HOME.x, y: 34 + (this.lane - 34) * 0.4 }, 0)
    this.hero.cd = 0
    place(this.carrier, { x: START_X, y: this.lane }, Math.PI)
    this.carrier.state = 'run'
    this.mode = 'approach'
    this.modeT = 0
    this.touchPhase = this.rng.range(0.3, 0.9)
    this.owned = true
    this.tracker = createTracker()
    Object.assign(this.ball, { x: START_X - 0.5, y: this.lane, z: 0, vx: 0, vy: 0, vz: 0 })
    this.ball.spin = { side: 0, top: 0 }
    this.state = 'setup'
    this.stateT = 0
  }

  /** How exposed the ball is right now (0 = at his feet, 1 = just pushed ahead). */
  get exposure(): number {
    return this.owned ? clampN(1 - this.touchPhase / EXPOSED_SPAN, 0, 1) : 0
  }

  /** Standing tackle reach (m) from the hero's tackling. */
  get reach(): number {
    return 1.15 + a01(this.attrs.tackling) * 0.35
  }

  private interpret(act: HeroAction): { slide: boolean; dir: Vec2 } | null {
    const toBall = norm(sub(this.ball, this.hero.pos))
    switch (act.kind) {
      case 'action':
      case 'skill':
      case 'tapAt':
        return { slide: false, dir: toBall }
      case 'pass':
        return { slide: false, dir: toBall }
      case 'swipe':
        if (act.swipe.isTap) return { slide: false, dir: toBall }
        return { slide: true, dir: this.slideAssist(act.swipe.dir) }
      case 'shoot':
        return { slide: true, dir: this.slideAssist(sub(act.target, this.hero.pos)) }
      case 'dive':
        return { slide: true, dir: this.slideAssist(act.dir) }
      default:
        return null
    }
  }

  /** Bends a slide toward the ball by the aim assist. */
  private slideAssist(dir: Vec2): Vec2 {
    const d = norm(dir)
    if (len(d) < 0.1) return norm(sub(this.ball, this.hero.pos))
    const k = this.assist === 'full' ? 0.7 : this.assist === 'half' ? 0.4 : 0
    return norm(add(scale(d, 1 - k), scale(norm(sub(this.ball, this.hero.pos)), k)))
  }

  private tryTackle(input: DrillInput): void {
    const h = this.hero
    if (h.state !== 'run' || h.cd > 0 || !this.owned) return
    for (const act of input.actions) {
      const t = this.interpret(act)
      if (!t) continue
      this.stat('tackles')
      if (t.slide) {
        h.state = 'slide'
        h.stateT = 0
        h.cd = 0.4
        this.slideDir = t.dir
        h.facing = Math.atan2(t.dir.y, t.dir.x)
        this.stat('slides')
        return
      }
      h.cd = 0.55
      h.facing = Math.atan2(t.dir.y, t.dir.x)
      if (dist(h.pos, this.ball) <= this.reach) return this.duelFor(false)
      // Lunged at thin air.
      h.state = 'skill'
      h.stateT = 0
      h.vel = scale(t.dir, 3.2)
      this.stat('whiffs')
      this.flash = { at: this.time, tone: 'red' }
      this.award(0, false, { label: 'whiff', x: h.pos.x, y: h.pos.y })
      return
    }
  }

  /** Resolves a tackle in reach with the match duel odds. */
  private duelFor(slide: boolean): void {
    const h = this.hero
    const c = this.carrier
    const timing = 0.15 + this.exposure * 0.85
    const cdir = len(c.vel) > 0.3 ? norm(c.vel) : fromAngle(c.facing)
    const fromBehind = dot(cdir, norm(sub(h.pos, c.pos))) < -0.35
    const odds = drillTackleChances(h, c, timing, fromBehind, slide)
    const at = { x: this.ball.x, y: this.ball.y }
    if (this.rng.chance(odds.win)) {
      this.stat('won')
      if (timing >= 0.75) this.stat('perfectTackles')
      this.flash = { at: this.time, tone: 'green' }
      this.award(tacklePoints({ won: true, timing, slide, combo: this.combo }), true, { label: timing >= 0.75 ? 'perfect' : 'won', ...at })
      this.events.push({ type: 'touch', x: at.x, y: at.y })
      // Ball poked away upfield; the dribbler stumbles.
      this.owned = false
      this.tracker = createTracker()
      const away = norm({ x: 1, y: this.rng.range(-0.6, 0.6) })
      this.ball.vx = away.x * 6.5
      this.ball.vy = away.y * 6.5
      this.ball.vz = slide ? 0.3 : 1.2
      c.state = 'down'
      c.stateT = 0
      this.mode = 'stumble'
      this.finishDuel()
      return
    }
    if (this.rng.chance(odds.foul)) {
      this.stat('fouls')
      this.flash = { at: this.time, tone: 'red' }
      this.events.push({ type: 'whistle', long: false })
      this.award(FOUL_PENALTY, false, { label: 'foul', ...at })
      c.state = 'down'
      c.stateT = 0
      this.mode = 'stumble'
      this.finishDuel()
      return
    }
    // Lost the duel: on the floor (slide) or off balance (standing).
    this.stat('lost')
    this.events.push({ type: 'skill', ok: false })
    this.award(0, false, { label: 'whiff', ...at })
    h.state = slide ? 'down' : 'skill'
    h.stateT = 0
    h.vel = scale(h.vel, 0.3)
    if (this.mode === 'approach') this.startCut()
  }

  private finishDuel(): void {
    this.state = 'resolved'
    this.stateT = 0
  }

  private startCut(): void {
    const c = this.carrier
    const h = this.hero
    const dy = c.pos.y - h.pos.y
    // Cut away from the side the defender is shading (or the planned side when square).
    this.cutSide = Math.abs(dy) > 0.4 ? Math.sign(dy) : this.cutSide
    this.mode = 'cut'
    this.modeT = 0
    // The cut is a touch: the ball is knocked aside and exposed while he plants.
    this.touchPhase = 0
    this.events.push({ type: 'skill', ok: true })
  }

  // ───────────────────────── Step ─────────────────────────

  protected beforeStep(): void {
    snapPrev([this.hero, this.carrier])
  }

  protected busy(): boolean {
    return this.state === 'duel'
  }

  protected tick(dt: number, input: DrillInput, live: boolean): void {
    this.stateT += dt
    if (live && this.state === 'duel') this.tryTackle(input)
    this.moveHero(dt, live && this.state !== 'resolved' ? input : { ...input, move: { x: 0, y: 0 }, sprint: false })
    this.moveCarrier(dt)
    this.updateBall(dt)
    switch (this.state) {
      case 'setup':
        if (this.stateT > SETUP_TIME && live) {
          this.state = 'duel'
          this.stateT = 0
        }
        break
      case 'duel':
        this.checkDuel()
        break
      case 'resolved':
        if (this.stateT > 0.85 && (live || this.phase === 'countdown')) this.newDuel()
        break
    }
  }

  private moveHero(dt: number, input: DrillInput): void {
    const h = this.hero
    h.stateT += dt
    h.cd = Math.max(0, h.cd - dt)
    if (h.state === 'slide') {
      const sp = SLIDE_SPEED * Math.max(0, 1 - h.stateT / SLIDE_TIME)
      h.vel = scale(this.slideDir, sp)
      // Contact along the slide: feet reach ahead of the body.
      if (this.state === 'duel' && this.owned) {
        const foot = add(h.pos, scale(this.slideDir, 0.6))
        if (dist(foot, this.ball) < 0.85) {
          h.state = 'down'
          h.stateT = 0
          this.duelFor(true)
        }
      }
      if (h.state === 'slide' && h.stateT > SLIDE_TIME) {
        h.state = 'down'
        h.stateT = 0
        if (this.state === 'duel') {
          this.stat('whiffs')
          this.award(0, false, { label: 'whiff', x: h.pos.x, y: h.pos.y })
        }
      }
    } else if (h.state === 'down') {
      h.vel = scale(h.vel, 0.85)
      if (h.stateT > 0.6) {
        h.state = 'run'
        h.stateT = 0
      }
    } else if (h.state === 'skill') {
      h.vel = scale(h.vel, 0.9)
      if (h.stateT > 0.45) {
        h.state = 'run'
        h.stateT = 0
      }
    } else {
      h.sprint = input.sprint
      // Jockeying: positioning keeps the feet quick without sprinting.
      const max = topSpeed(h) * (input.sprint ? 1 : 0.88 + a01(this.attrs.positioning) * 0.16)
      const desired = scale(input.move, max)
      const dv = sub(desired, h.vel)
      const a = accel(h) * dt
      h.vel = len(dv) <= a ? desired : add(h.vel, scale(norm(dv), a))
      if (h.sprint && len(input.move) > 0.3) h.stamina = Math.max(0, h.stamina - dt * 0.15)
      else h.stamina = Math.min(1, h.stamina + dt * 0.1)
      h.facing = Math.atan2(this.carrier.pos.y - h.pos.y, this.carrier.pos.x - h.pos.x)
    }
    h.pos = { x: clampN(h.pos.x + h.vel.x * dt, END_X - 2, START_X + 2), y: clampN(h.pos.y + h.vel.y * dt, 18, 50) }
  }

  private moveCarrier(dt: number): void {
    const c = this.carrier
    const h = this.hero
    c.stateT += dt
    this.modeT += dt
    if (this.state === 'setup' || this.mode === 'stumble') {
      c.vel = scale(c.vel, 0.85)
      if (c.state === 'down' && c.stateT > 0.8) c.state = 'run'
      c.pos = add(c.pos, scale(c.vel, dt))
      return
    }
    if (this.state !== 'duel') return
    const pace = a01(c.attrs.pace)
    let target: Vec2 = { x: END_X - 2, y: c.pos.y }
    let speed = 5
    if (this.mode === 'approach') {
      target = { x: END_X - 2, y: this.lane }
      speed = 4.4 + pace * 0.9
      const ahead = h.pos.x < c.pos.x + 0.5
      if (ahead && dist(h.pos, c.pos) < this.cutAt) this.startCut()
      else if (!ahead) this.mode = 'escape'
    }
    if (this.mode === 'cut') {
      target = add(c.pos, { x: -1, y: this.cutSide * 1.2 })
      speed = this.modeT < PLANT_TIME ? 3 : 4.6 + pace * 1.2
      if (this.modeT > 0.6 + PLANT_TIME) {
        this.mode = 'escape'
        this.modeT = 0
      }
    }
    if (this.mode === 'escape') {
      target = { x: END_X - 2, y: c.pos.y + this.cutSide * 0.2 }
      // Never quicker than a recovering defender's sprint: his pace decides how much he gains.
      speed = 5.4 + pace * 1.6
    }
    const dir = norm(sub(target, c.pos))
    const want = scale(dir, speed)
    c.vel = add(c.vel, scale(sub(want, c.vel), Math.min(1, dt * 7)))
    c.pos = add(c.pos, scale(c.vel, dt))
    c.pos.y = clampN(c.pos.y, 16, 52)
    if (len(c.vel) > 0.4) c.facing = Math.atan2(c.vel.y, c.vel.x)
  }

  private updateBall(dt: number): void {
    const b = this.ball
    const c = this.carrier
    if (this.owned) {
      const sp = len(c.vel)
      if (this.state === 'duel' && sp > 1) {
        // Tighter touches while cutting.
        const period = this.mode === 'cut' ? TOUCH_PERIOD * 0.75 : TOUCH_PERIOD * (1.15 - a01(c.attrs.dribbling) * 0.3)
        this.touchPhase += dt / period
        if (this.touchPhase >= 1) {
          this.touchPhase -= 1
          this.events.push({ type: 'touch', x: b.x, y: b.y })
        }
      }
      const ahead = 0.32 + (1 - this.touchPhase) * 0.75 * clampN(sp / 5, 0.3, 1.1)
      const f = fromAngle(c.facing)
      b.x = c.pos.x + f.x * ahead
      b.y = c.pos.y + f.y * ahead
      b.z = 0
      b.vx = c.vel.x
      b.vy = c.vel.y
      b.vz = 0
      return
    }
    this.phys.length = 0
    stepBall(b, this.env, this.tracker, this.phys)
  }

  private checkDuel(): void {
    const c = this.carrier
    const h = this.hero
    const past = c.pos.x < h.pos.x - 2.2 && this.mode !== 'approach'
    if (c.pos.x <= END_X || past || this.stateT > 9) {
      this.stat('beaten')
      this.flash = { at: this.time, tone: 'red' }
      this.award(BEATEN_PENALTY, false, { label: 'beaten', x: c.pos.x, y: c.pos.y })
      this.finishDuel()
    }
  }

  // ───────────────────────── Bots / tests ─────────────────────────

  get dueling(): boolean {
    return this.state === 'duel' && this.live
  }
  get carrierVel(): Vec2 {
    return { ...this.carrier.vel }
  }

  view(): DrillView {
    const h = this.hero
    const flash = this.flash && this.time - this.flash.at < 0.6 ? this.flash.tone : null
    const inReach = this.state === 'duel' && this.owned && dist(h.pos, this.ball) <= this.reach
    const exposed = this.exposure >= 0.6
    const rings: RingView[] = []
    if (this.state !== 'resolved' && this.owned) rings.push({ x: this.ball.x, y: this.ball.y, r: 0.55, tone: exposed ? 'green' : 'white', pulse: exposed })
    if (flash) rings.push({ x: h.pos.x, y: h.pos.y, r: 1.4, tone: flash })
    const lines: LineView[] = [{ a: { x: END_X, y: 18 }, b: { x: END_X, y: 50 }, tone: 'red', width: 0.2 }]
    return {
      focus: { x: clampN((h.pos.x + this.carrier.pos.x) / 2, END_X + 8, START_X - 8), y: 34 },
      span: 26,
      goals: [],
      hero: actorView(h, 'hero'),
      actors: [actorView(this.carrier, 'opp', inReach && exposed)],
      ball: this.ballView(this.ball),
      cones: [
        { x: END_X, y: 18, tone: 'red' },
        { x: END_X, y: 50, tone: 'red' },
      ],
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
        prompt: this.phase === 'countdown' ? 'ready' : this.phase === 'post' || this.finished ? 'done' : inReach && exposed ? 'tackleNow' : 'tackling',
        meters: [{ kind: 'stamina', value: h.stamina, tone: h.stamina < 0.25 ? 'red' : 'green' }],
        level: this.duel,
        countdown: this.countdown,
      },
      heroOnBall: false,
      heroIsKeeper: false,
    }
  }
}
