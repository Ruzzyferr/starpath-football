/**
 * Rondo (passing sessions, 2.3#24): 4 v 2 for 60 seconds.
 *
 * The hero and three team-mates hold a diamond around two pressing defenders.
 * Pass to an open mate (tap / click, pad A); the mate lays it back and the
 * cycle repeats. Each completed pass scores 1, a one-touch pass (released
 * within {@link ONE_TOUCH_S} of getting the ball back) 1.5. Losing the ball
 * (intercepted, pressed off it, overhit or loose) resets the streak.
 *
 * Vision decides how many options the hero "sees": below 60 only the two side
 * mates are highlighted and playable; at 60+ the third option, straight
 * through the middle, opens up too.
 */
import { leadPosition, planKick } from '../../kick'
import { createTracker, stepBall, type BallState, type BallTracker, type PhysicsEvent } from '../../physics'
import { flatAttrs } from '../../setup'
import { a01, add, angleDiff, clampN, dist, dot, len, norm, scale, sub, type Agent, type Vec2 } from '../../model'
import type { HeroAction } from '../../runtime'
import { DrillBase, actorView, makeActor, place, snapPrev } from '../base'
import { controllable, rondoPassPoints, RONDO_VISION_THIRD } from '../scoring'
import type { DrillConfig, DrillInput, DrillView, LineView, RingView } from '../types'

/** Release within this long after getting the ball back = one-touch pass. */
export const ONE_TOUCH_S = 0.8
/** Pressed off the ball after this long with a defender within 1 m. */
const PRESS_LOSE_S = 0.9

const C: Vec2 = { x: 52, y: 34 }
const R = 7
const HERO_SPOT: Vec2 = { x: C.x - R, y: C.y }
/** Mates: left side, through the middle (the "third" option), right side. */
const MATE_SPOTS: readonly Vec2[] = [{ x: C.x, y: C.y - R }, { x: C.x + R, y: C.y }, { x: C.x, y: C.y + R }]

type State = 'ready' | 'flight' | 'return' | 'lost'

/** Distance from point p to segment a→b. */
function segDist(p: Vec2, a: Vec2, b: Vec2): number {
  const ab = sub(b, a)
  const l2 = dot(ab, ab)
  const t = l2 > 1e-9 ? clampN(dot(sub(p, a), ab) / l2, 0, 1) : 0
  return dist(p, add(a, scale(ab, t)))
}

export class RondoDrill extends DrillBase {
  readonly hero: Agent
  readonly mates: Agent[]
  readonly defenders: Agent[]
  readonly ball: BallState
  private tracker: BallTracker = createTracker()
  private readonly phys: PhysicsEvent[] = []
  private state: State = 'ready'
  private stateT = 0
  private readyAt = 0
  private pressT = 0
  private target = -1
  private release = 0
  private flash: { at: number; tone: 'green' | 'red' } | null = null
  /** Vision ≥ 60 sees the third option through the middle. */
  readonly seesThird: boolean

  constructor(cfg: DrillConfig) {
    super('passing', cfg)
    this.hero = makeActor('hero', 'hero', 'CM', HERO_SPOT, this.attrs, { hero: true, number: 8 })
    this.mates = MATE_SPOTS.map((p, i) => makeActor(`m${i}`, 'hero', 'CM', p, flatAttrs(68), { number: [7, 9, 11][i] }))
    const dq = 55 + (this.difficulty - 1) * 40
    this.defenders = [0, 1].map((i) => makeActor(`d${i}`, 'opp', 'CB', { x: C.x + (i ? 1.2 : -1.2), y: C.y }, flatAttrs(dq), { number: 4 + i }))
    this.ball = { x: HERO_SPOT.x + 0.6, y: HERO_SPOT.y, z: 0, vx: 0, vy: 0, vz: 0, spin: { side: 0, top: 0 } }
    this.seesThird = this.attrs.vision >= RONDO_VISION_THIRD
    this.restart()
  }

  /** Playable options (indices into `mates`). */
  get options(): number[] {
    return this.seesThird ? [0, 1, 2] : [0, 2]
  }

  private restart(): void {
    place(this.hero, HERO_SPOT, 0)
    this.mates.forEach((m, i) => place(m, MATE_SPOTS[i], Math.atan2(C.y - MATE_SPOTS[i].y, C.x - MATE_SPOTS[i].x)))
    this.defenders.forEach((d, i) => place(d, { x: C.x + (i ? 1.5 : -0.5), y: C.y + (i ? 1 : -1) * this.rng.range(0.5, 2) }, Math.PI))
    this.tracker = createTracker()
    Object.assign(this.ball, { x: HERO_SPOT.x + 0.6, y: HERO_SPOT.y, z: 0, vx: 0, vy: 0, vz: 0 })
    this.ball.spin = { side: 0, top: 0 }
    this.backToHero()
  }

  private backToHero(): void {
    this.state = 'ready'
    this.stateT = 0
    this.pressT = 0
    this.readyAt = this.clock
    this.target = -1
  }

  // ───────────────────────── Passing ─────────────────────────

  private pick(act: HeroAction): number | null {
    const from = HERO_SPOT
    const opts = this.options
    const byPoint = (p: Vec2): number | null => {
      const near = opts.filter((i) => dist(this.mates[i].pos, p) < 4).sort((a, b) => dist(this.mates[a].pos, p) - dist(this.mates[b].pos, p))
      return near[0] ?? byDir(norm(sub(p, from)))
    }
    const byDir = (dir: Vec2): number | null => {
      let best: number | null = null
      let bestA = 0.5
      for (const i of opts) {
        const m = this.mates[i]
        const a = Math.abs(angleDiff(Math.atan2(m.pos.y - from.y, m.pos.x - from.x), Math.atan2(dir.y, dir.x)))
        if (a < bestA) {
          bestA = a
          best = i
        }
      }
      return best
    }
    switch (act.kind) {
      case 'tapAt':
        return byPoint(act.at)
      case 'pass':
        return act.target ? byPoint(act.target) : act.dir && len(act.dir) > 0.2 ? byDir(norm(act.dir)) : this.mostOpen()
      case 'swipe':
        return act.swipe.isTap ? null : byDir(act.swipe.dir)
      case 'shoot':
        return byDir(norm(sub(act.target, from)))
      case 'action':
      case 'skill':
        return this.mostOpen()
      default:
        return null
    }
  }

  /** Option with the widest lane (bots and the auto-pass button). */
  mostOpen(): number {
    let best = this.options[0]
    let bestD = -1
    for (const i of this.options) {
      const d = Math.min(...this.defenders.map((df) => segDist(df.pos, HERO_SPOT, this.mates[i].pos)))
      if (d > bestD) {
        bestD = d
        best = i
      }
    }
    return best
  }

  private pass(input: DrillInput): void {
    for (const act of input.actions) {
      const i = this.pick(act)
      if (i === null) continue
      const m = this.mates[i]
      const from = { x: this.ball.x, y: this.ball.y }
      const target = leadPosition(from, { id: m.id, pos: m.pos, vel: m.vel }, 13, 4)
      const plan = planKick(
        { kind: 'pass', from, fromZ: 0, target, power: 0.6, curl: 0, attrs: this.attrs, pressure: this.pressT > 0 ? 0.4 : 0, assist: this.assist, env: this.env, noiseScale: 0.9 },
        this.rng,
      )
      Object.assign(this.ball, { vx: plan.vx, vy: plan.vy, vz: plan.vz })
      this.ball.spin = { ...plan.spin }
      this.hero.facing = Math.atan2(target.y - from.y, target.x - from.x)
      this.hero.state = 'skill'
      this.hero.stateT = 0
      this.target = i
      this.release = this.clock - this.readyAt
      this.state = 'flight'
      this.stateT = 0
      this.stat('passes')
      this.events.push({ type: 'kick', power: 0.6, hero: true, x: from.x, y: from.y })
      return
    }
  }

  private lose(label: 'blocked' | 'overhit' | 'miss' | 'tackled', at: Vec2): void {
    this.state = 'lost'
    this.stateT = 0
    this.stat('lost')
    this.flash = { at: this.time, tone: 'red' }
    this.award(0, false, { label, x: at.x, y: at.y })
  }

  // ───────────────────────── Step ─────────────────────────

  protected beforeStep(): void {
    snapPrev([this.hero, ...this.mates, ...this.defenders])
  }

  protected busy(): boolean {
    return this.state === 'flight'
  }

  protected tick(dt: number, input: DrillInput, live: boolean): void {
    this.stateT += dt
    const h = this.hero
    h.stateT += dt
    if (h.state === 'skill' && h.stateT > 0.4) h.state = 'run'
    if (live && this.state === 'ready') this.pass(input)
    this.moveDefenders(dt, live)
    if (this.state === 'flight') this.flight()
    else if (this.state === 'return') this.returnFlight()
    else if (this.state === 'lost' && this.stateT > 0.9 && (live || this.phase === 'countdown')) this.restart()
    else if (this.state === 'ready' && live) {
      // Pressing: a defender within 1 m for too long wins the ball.
      const close = this.defenders.some((d) => dist(d.pos, this.ball) < 1)
      this.pressT = close ? this.pressT + dt : Math.max(0, this.pressT - dt)
      if (this.pressT > PRESS_LOSE_S) this.lose('tackled', this.ball)
    }
  }

  private moveDefenders(dt: number, live: boolean): void {
    const [presser, cutter] = this.defenders
    const speed = 3.0 + (this.difficulty - 1) * 2
    const go = (d: Agent, to: Vec2, sp: number) => {
      const v = sub(to, d.pos)
      const l = len(v)
      d.vel = l < 0.05 ? { x: 0, y: 0 } : scale(v, Math.min(sp, l * 4) / l)
      d.pos = add(d.pos, scale(d.vel, dt))
      d.facing = Math.atan2(this.ball.y - d.pos.y, this.ball.x - d.pos.x)
    }
    if (!live && this.phase !== 'grace') {
      go(presser, { x: C.x - 1, y: C.y }, speed)
      go(cutter, { x: C.x + 1, y: C.y }, speed)
      return
    }
    if (this.state === 'flight') {
      // Both chase the ball's line.
      for (const d of this.defenders) go(d, { x: this.ball.x, y: this.ball.y }, speed * 1.1)
      return
    }
    // Presser closes the ball down; cutter shadows the lane to the most open option.
    const ball = { x: this.ball.x, y: this.ball.y }
    const toBall = sub(ball, presser.pos)
    const stop = len(toBall) > 0.8 ? add(presser.pos, scale(norm(toBall), len(toBall) - 0.8)) : presser.pos
    go(presser, stop, speed)
    const open = this.mates[this.mostOpen()].pos
    go(cutter, add(ball, scale(sub(open, ball), 0.45)), speed * 0.9)
  }

  private flight(): void {
    const b = this.ball
    this.phys.length = 0
    stepBall(b, this.env, this.tracker, this.phys)
    const at = { x: b.x, y: b.y }
    for (const d of this.defenders) {
      if (dist(d.pos, b) < 0.6 && b.z < 1.2) {
        this.events.push({ type: 'touch', x: b.x, y: b.y })
        Object.assign(b, { vx: 0, vy: 0, vz: 0, z: 0 })
        return this.lose('blocked', at)
      }
    }
    for (const [i, m] of this.mates.entries()) {
      if (dist(m.pos, b) < 1.1 && b.z < 1.7) {
        const rel = Math.hypot(b.vx, b.vy, b.vz)
        this.events.push({ type: 'touch', x: b.x, y: b.y })
        if (!controllable(rel, a01(m.attrs.firstTouch))) return this.lose('overhit', at)
        Object.assign(b, { vx: 0, vy: 0, vz: 0, z: 0 })
        const oneTouch = this.release <= ONE_TOUCH_S
        this.stat('completed')
        if (oneTouch) this.stat('oneTouch')
        this.flash = { at: this.time, tone: 'green' }
        this.award(rondoPassPoints(true, oneTouch), true, { label: oneTouch ? 'quick' : 'pass', x: b.x, y: b.y })
        m.state = 'skill'
        m.stateT = 0
        this.target = i
        this.state = 'return'
        this.stateT = 0
        return
      }
    }
    if (this.phys.some((e) => e.type === 'out') || (Math.hypot(b.vx, b.vy) < 0.6 && b.z < 0.05) || this.stateT > 3) this.lose('miss', at)
  }

  /** The mate lays it back to the hero (a clean, quick ball). */
  private returnFlight(): void {
    const b = this.ball
    if (this.stateT < 0.35) return
    const to = { x: HERO_SPOT.x + 0.6, y: HERO_SPOT.y }
    const d = sub(to, b)
    const l = len(d)
    if (l < 0.4) {
      Object.assign(b, { x: to.x, y: to.y, vx: 0, vy: 0 })
      this.events.push({ type: 'touch', x: b.x, y: b.y })
      return this.backToHero()
    }
    const v = scale(d, Math.min(13, l * 8) / l)
    b.vx = v.x
    b.vy = v.y
    b.x += v.x / 60
    b.y += v.y / 60
  }

  // ───────────────────────── Bots / tests ─────────────────────────

  get ready(): boolean {
    return this.state === 'ready' && this.live
  }
  /** Mate the last pass went to (-1 while the hero has it). */
  get passTarget(): number {
    return this.target
  }

  view(): DrillView {
    const flash = this.flash && this.time - this.flash.at < 0.6 ? this.flash.tone : null
    const rings: RingView[] = this.options.map((i) => ({ x: this.mates[i].pos.x, y: this.mates[i].pos.y, r: 1.1, tone: flash ?? 'gold', pulse: this.state === 'ready' }))
    const lines: LineView[] = this.state === 'ready' ? this.options.map((i) => ({ a: HERO_SPOT, b: this.mates[i].pos, tone: 'white', width: 0.08 })) : []
    return {
      focus: { x: C.x, y: C.y },
      span: 22,
      goals: [],
      hero: actorView(this.hero, 'hero'),
      actors: [
        ...this.mates.map((m, i) => actorView(m, 'mate', this.options.includes(i))),
        ...this.defenders.map((d) => actorView(d, 'opp')),
      ],
      ball: this.ballView(this.ball),
      cones: [
        { x: C.x - R - 1.5, y: C.y - R - 1.5, tone: 'orange' }, { x: C.x + R + 1.5, y: C.y - R - 1.5, tone: 'orange' },
        { x: C.x - R - 1.5, y: C.y + R + 1.5, tone: 'orange' }, { x: C.x + R + 1.5, y: C.y + R + 1.5, tone: 'orange' },
      ],
      gates: [],
      goalTargets: [],
      rings,
      lines,
      preview: null,
      hud: {
        points: Math.round(this.points * 10) / 10,
        combo: this.combo,
        timeLeft: this.timeLeft,
        duration: this.duration,
        prompt: this.phase === 'countdown' ? 'ready' : this.phase === 'post' || this.finished ? 'done' : 'passGround',
        meters: [],
        countdown: this.countdown,
      },
      heroOnBall: this.state === 'ready',
      heroIsKeeper: false,
    }
  }
}
