/**
 * Dribbling drill: cone slalom with skill-move timing.
 *
 * Cone slalom (2.3#22): 20 s, 8 cones (4 cone gates) laid straight, zigzag
 * or at random by drill level; carry the ball through them (in order), past
 * two mannequins and over the finish line, as many laps as the clock allows.
 * Every cone touch costs 8; each 0.1 s under the lap par earns 1.
 * Close control matters: the ball is pushed ahead on every touch (further when
 * sprinting, less with good dribbling), and clipping a cone costs points and
 * knocks the ball loose. Beat a mannequin with a skill move timed when it is
 * 1.4–2.5 m away (perfect) or 0.9–3.4 m (good); run into it and you are
 * "tackled". Laps are scored with a time bonus; the course mirrors each lap.
 */
import { createTracker, stepBall, type BallState, type BallTracker, type PhysicsEvent } from '../../physics'
import { flatAttrs } from '../../setup'
import { a01, accel, add, angleDiff, clampN, dist, fromAngle, len, norm, scale, sub, topSpeed, type Agent, type Vec2 } from '../../model'
import { DT, DrillBase, actorView, makeActor, place, snapPrev } from '../base'
import { CONE_PENALTY, GATE_MISS_PENALTY, GATE_POINTS, SKILL_POINTS, TACKLED_PENALTY, comboMultiplier, lapPoints, skillTiming, slalomLayout } from '../scoring'
import type { ConeView, DrillConfig, DrillInput, DrillView, GateView, LineView } from '../types'

const START: Vec2 = { x: 45, y: 34 }
const FINISH_X = 89
const GATE_COUNT = 4
const GATE_SPACING = 8.8
const GATE_HALF = 1.3
const CONE_R = 0.2
/** Par lap time (s) for the time bonus. */
export const LAP_PAR = 9

interface Gate {
  x: number
  y: number
  /** -1 pending, 0 next … ; state for rendering. */
  state: 'pending' | 'done' | 'missed'
  knocked: [boolean, boolean]
}

interface Dummy {
  agent: Agent
  beaten: boolean
}

export class DribblingDrill extends DrillBase {
  readonly hero: Agent
  readonly ball: BallState
  private tracker: BallTracker = createTracker()
  private readonly phys: PhysicsEvent[] = []
  private gates: Gate[] = []
  private readonly dummies: Dummy[]
  private next = 0
  private lap = 0
  private lapStart = 0
  private owned = true
  private mirror = 1
  private pause = 0
  private flashLap = -9
  private prevHero: Vec2 = { ...START }

  constructor(cfg: DrillConfig) {
    super('dribbling', cfg)
    this.hero = makeActor('hero', 'hero', 'LW', START, this.attrs, { hero: true, number: 11 })
    this.dummies = [0, 1].map((i) => ({ agent: makeActor(`d${i}`, 'opp', 'CB', { x: 60, y: 34 }, flatAttrs(60), { number: 0 }), beaten: false }))
    this.ball = { x: START.x + 0.5, y: START.y, z: 0, vx: 0, vy: 0, vz: 0, spin: { side: 0, top: 0 } }
    this.newLap()
  }

  private newLap(): void {
    this.lap++
    this.mirror = this.lap % 2 === 1 ? 1 : -1
    this.gates = []
    const layout = slalomLayout(this.difficulty)
    for (let i = 0; i < GATE_COUNT; i++) {
      const side = (i % 2 === 0 ? -1 : 1) * this.mirror
      const off = layout === 'straight' ? 0 : layout === 'zigzag' ? side * 3.1 + this.rng.range(-0.4, 0.4) : this.rng.range(-3.6, 3.6)
      this.gates.push({ x: 51 + i * GATE_SPACING, y: 34 + off, state: 'pending', knocked: [false, false] })
    }
    // Mannequins between gates 0–1 and 2–3, in the running lane.
    this.dummies.forEach((d, i) => {
      const a = this.gates[i * 2]!
      const b = this.gates[1 + i * 2]!
      place(d.agent, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, Math.PI)
      d.beaten = false
    })
    this.next = 0
    place(this.hero, START, 0)
    this.hero.stamina = Math.max(this.hero.stamina, 0.5)
    this.prevHero = { ...START }
    this.tracker = createTracker()
    Object.assign(this.ball, { x: START.x + 0.5, y: START.y, z: 0, vx: 0, vy: 0, vz: 0 })
    this.owned = true
    this.lapStart = this.clock
  }

  // ───────────────────────── Step ─────────────────────────

  protected beforeStep(): void {
    snapPrev([this.hero, ...this.dummies.map((d) => d.agent)])
  }

  protected busy(): boolean {
    return false
  }

  protected tick(dt: number, input: DrillInput, live: boolean): void {
    const h = this.hero
    h.stateT += dt
    h.cd = Math.max(0, h.cd - dt)
    h.noTouch = Math.max(0, h.noTouch - dt)
    for (const d of this.dummies) {
      const a = d.agent
      a.stateT += dt
      if (a.state === 'down' && a.stateT > 0.8) a.state = 'run'
    }
    if (this.pause > 0) {
      this.pause -= dt
      h.vel = scale(h.vel, 0.85)
      if (this.pause <= 0 && live) this.newLap()
      return
    }
    if (live) for (const act of input.actions) if (act.kind === 'skill' || act.kind === 'action' || act.kind === 'tapAt') this.trySkill()
    this.moveHero(dt, live ? input : { ...input, move: { x: 0, y: 0 }, sprint: false })
    this.updateBall()
    if (live) {
      this.checkCones()
      this.checkDummies()
      this.checkGates()
      this.checkFinish()
    }
    this.prevHero = { ...h.pos }
  }

  private moveHero(dt: number, input: DrillInput): void {
    const h = this.hero
    if (h.state === 'down') {
      h.vel = scale(h.vel, 0.85)
      if (h.stateT > 0.45) {
        h.state = 'run'
        h.stateT = 0
      }
    } else if (h.state === 'skill') {
      h.vel = scale(h.actionDir, topSpeed({ ...h, sprint: true }) + 0.8)
      if (h.stateT > 0.42) {
        h.state = 'run'
        h.stateT = 0
      }
    } else {
      h.sprint = input.sprint
      let max = topSpeed(h)
      if (this.owned) max *= 0.86 + a01(h.attrs.dribbling) * 0.1
      const desired = scale(input.move, max)
      const dv = sub(desired, h.vel)
      const a = accel(h) * (len(desired) < len(h.vel) ? 1.6 : 1) * dt
      h.vel = len(dv) <= a ? desired : add(h.vel, scale(norm(dv), a))
      if (h.sprint && len(input.move) > 0.3) h.stamina = Math.max(0, h.stamina - dt * 0.2 * (1.2 - a01(h.attrs.stamina) * 0.4))
      else h.stamina = Math.min(1, h.stamina + dt * 0.12)
      const sp = len(h.vel)
      if (sp > 0.5) h.facing += clampN(angleDiff(Math.atan2(h.vel.y, h.vel.x), h.facing), -14 * dt, 14 * dt)
    }
    h.pos = { x: clampN(h.pos.x + h.vel.x * dt, START.x - 4, FINISH_X + 6), y: clampN(h.pos.y + h.vel.y * dt, 20, 48) }
  }

  private updateBall(): void {
    const h = this.hero
    const b = this.ball
    if (this.owned) {
      const sp = len(h.vel)
      const moving = sp > 1
      const period = 0.62 - a01(h.attrs.dribbling) * 0.2
      if (moving) {
        h.touch += (DT / period) * clampN(sp / 6, 0.5, 1.4)
        if (h.touch >= 1) {
          h.touch -= 1
          this.events.push({ type: 'touch', x: b.x, y: b.y })
        }
      }
      // Sprinting pushes the ball further ahead (harder to steer through gates).
      const push = h.sprint ? 1.25 - a01(h.attrs.dribbling) * 0.25 : 1
      const ahead = 0.42 + (moving ? (1 - h.touch) * 0.55 * clampN(sp / 6, 0, 1.2) * push : 0)
      const f = fromAngle(h.facing)
      b.x = h.pos.x + f.x * ahead
      b.y = h.pos.y + f.y * ahead
      b.z = 0
      b.vx = h.vel.x
      b.vy = h.vel.y
      b.vz = 0
      return
    }
    this.phys.length = 0
    stepBall(b, this.env, this.tracker, this.phys)
    if (h.noTouch <= 0 && h.state !== 'down' && dist(h.pos, b) < 0.65 && b.z < 0.6) {
      this.owned = true
      h.touch = 0.6
      this.events.push({ type: 'touch', x: b.x, y: b.y })
    }
  }

  private loseBall(dir: Vec2, speed: number): void {
    this.owned = false
    this.tracker = createTracker()
    const b = this.ball
    b.vx = dir.x * speed
    b.vy = dir.y * speed
    b.vz = 0.4
    this.hero.noTouch = 0.45
  }

  private checkCones(): void {
    const b = this.ball
    for (const g of this.gates) {
      for (const s of [0, 1] as const) {
        if (g.knocked[s]) continue
        const c = { x: g.x, y: g.y + (s === 0 ? -GATE_HALF : GATE_HALF) }
        if (dist(c, b) < CONE_R + 0.13) {
          g.knocked[s] = true
          this.stat('cones')
          this.award(CONE_PENALTY, false, { label: 'cone', x: c.x, y: c.y })
          this.events.push({ type: 'cone', x: c.x, y: c.y })
          // Ball ricochets off the cone.
          const away = norm(sub(b, c))
          if (this.owned) this.loseBall(norm(add(away, scale(norm(this.hero.vel), 0.4))), Math.max(2.5, len(this.hero.vel) * 0.6))
          else {
            b.vx = away.x * 3
            b.vy = away.y * 3
          }
        }
      }
    }
  }

  /** Skill move: graded by distance to the next unbeaten mannequin ahead. */
  private trySkill(): void {
    const h = this.hero
    if (h.cd > 0 || !this.owned || h.state !== 'run') return
    h.cd = 0.8
    const target = this.dummies
      .filter((d) => !d.beaten && d.agent.pos.x - h.pos.x > -0.3)
      .sort((p, q) => dist(p.agent.pos, h.pos) - dist(q.agent.pos, h.pos))[0]
    const d = target ? dist(target.agent.pos, h.pos) : 99
    const timing = skillTiming(d)
    this.stat('skills')
    if (!target || timing === 'early' || timing === 'late') {
      this.events.push({ type: 'skill', ok: false })
      this.award(0, false, { label: target ? timing : 'early', x: h.pos.x, y: h.pos.y })
      return
    }
    target.beaten = true
    target.agent.state = 'down'
    target.agent.stateT = 0
    const side = h.pos.y >= target.agent.pos.y ? 1 : -1
    h.state = 'skill'
    h.stateT = 0
    h.actionDir = norm({ x: 1, y: side * 0.5 })
    h.facing = Math.atan2(h.actionDir.y, h.actionDir.x)
    this.stat(timing === 'perfect' ? 'perfectSkills' : 'goodSkills')
    this.events.push({ type: 'skill', ok: true })
    this.award(Math.round(SKILL_POINTS[timing] * comboMultiplier(this.combo)), true, { label: timing, x: h.pos.x, y: h.pos.y })
  }

  private checkDummies(): void {
    const h = this.hero
    for (const d of this.dummies) {
      if (d.beaten) continue
      const a = d.agent
      // Walked past it without a skill: no points, but no penalty either.
      if (h.pos.x > a.pos.x + 1) {
        d.beaten = true
        continue
      }
      if (this.owned && dist(a.pos, this.ball) < 0.6) {
        d.beaten = true
        a.state = 'down'
        a.stateT = 0
        h.state = 'down'
        h.stateT = 0
        this.stat('tackled')
        this.loseBall(norm({ x: -0.3, y: h.pos.y >= a.pos.y ? 1 : -1 }), 4)
        this.award(TACKLED_PENALTY, false, { label: 'tackled', x: a.pos.x, y: a.pos.y })
      }
    }
  }

  private checkGates(): void {
    const g = this.gates[this.next]
    if (!g) return
    const h = this.hero
    if (this.prevHero.x < g.x && h.pos.x >= g.x) {
      const f = (g.x - this.prevHero.x) / Math.max(1e-6, h.pos.x - this.prevHero.x)
      const y = this.prevHero.y + (h.pos.y - this.prevHero.y) * f
      const inside = Math.abs(y - g.y) <= GATE_HALF && this.owned
      g.state = inside ? 'done' : 'missed'
      this.next++
      if (inside) {
        this.stat('gates')
        this.award(Math.round(GATE_POINTS * comboMultiplier(this.combo)), true, { label: 'gate', x: g.x, y: g.y })
      } else {
        this.stat('gatesMissed')
        this.award(GATE_MISS_PENALTY, false, { label: 'gateMissed', x: g.x, y: g.y })
      }
    }
  }

  private checkFinish(): void {
    const h = this.hero
    if (this.prevHero.x < FINISH_X && h.pos.x >= FINISH_X && this.owned) {
      // Unvisited gates count as missed.
      while (this.next < this.gates.length) {
        this.gates[this.next]!.state = 'missed'
        this.next++
        this.stat('gatesMissed')
        this.award(GATE_MISS_PENALTY, false, { label: 'gateMissed', x: h.pos.x, y: h.pos.y })
      }
      const t = this.clock - this.lapStart
      this.stat('laps')
      this.stats.bestLap = Math.min(this.stats.bestLap ?? 99, Math.round(t * 10) / 10)
      this.award(lapPoints(t, LAP_PAR), true, { label: 'lap', x: h.pos.x, y: h.pos.y })
      this.flashLap = this.time
      this.pause = 0.7
    }
  }

  // ───────────────────────── Bots / tests ─────────────────────────

  /** Next waypoint for a bot: centre of the next gate, else the finish. */
  nextWaypoint(): Vec2 {
    const g = this.gates[this.next]
    return g ? { x: g.x + 0.4, y: g.y } : { x: FINISH_X + 2, y: 34 }
  }
  /** Nearest unbeaten mannequin ahead (bots/tests). */
  nextDummy(): Vec2 | null {
    const h = this.hero
    const d = this.dummies.filter((x) => !x.beaten && x.agent.pos.x > h.pos.x - 0.3).sort((p, q) => p.agent.pos.x - q.agent.pos.x)[0]
    return d ? { ...d.agent.pos } : null
  }
  get hasBall(): boolean {
    return this.owned
  }

  view(): DrillView {
    const cones: ConeView[] = []
    const gates: GateView[] = []
    this.gates.forEach((g, i) => {
      const tone = g.state === 'done' ? 'green' : g.state === 'missed' ? 'red' : i === this.next ? 'gold' : 'orange'
      const a = { x: g.x, y: g.y - GATE_HALF }
      const b = { x: g.x, y: g.y + GATE_HALF }
      cones.push({ x: a.x, y: a.y, tone: g.knocked[0] ? 'red' : tone }, { x: b.x, y: b.y, tone: g.knocked[1] ? 'red' : tone })
      gates.push({ a, b, tone })
    })
    const lines: LineView[] = [
      { a: { x: START.x + 1.5, y: 27 }, b: { x: START.x + 1.5, y: 41 }, tone: 'white', width: 0.12 },
      { a: { x: FINISH_X, y: 27 }, b: { x: FINISH_X, y: 41 }, tone: this.time - this.flashLap < 0.8 ? 'green' : 'gold', width: 0.2 },
    ]
    const h = this.hero
    const near = this.nextDummy()
    const skillWindow = !!near && this.owned && dist(near, h.pos) < 3.4 && dist(near, h.pos) > 0.9
    return {
      focus: { x: clampN(h.pos.x + 7, 56, 84), y: 34 },
      span: 24,
      goals: [],
      hero: actorView(h, 'hero'),
      actors: this.dummies.map((d) => actorView(d.agent, 'dummy', !d.beaten && skillWindow && near?.x === d.agent.pos.x)),
      ball: this.ballView(this.ball),
      cones,
      gates,
      goalTargets: [],
      rings: near && !this.dummies.every((d) => d.beaten) ? [{ x: near.x, y: near.y, r: 2.0, tone: skillWindow && skillTiming(dist(near, h.pos)) === 'perfect' ? 'green' : 'white', pulse: skillWindow }] : [],
      lines,
      preview: null,
      hud: {
        points: Math.round(this.points),
        combo: this.combo,
        timeLeft: this.timeLeft,
        duration: this.duration,
        prompt: this.phase === 'countdown' ? 'ready' : this.phase === 'post' || this.finished ? 'done' : skillWindow ? 'skillNow' : 'dribble',
        meters: [{ kind: 'stamina', value: h.stamina, tone: h.stamina < 0.25 ? 'red' : 'green' }],
        level: this.lap,
        countdown: this.countdown,
      },
      heroOnBall: this.owned,
      heroIsKeeper: false,
    }
  }
}
