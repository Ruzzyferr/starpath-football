/**
 * Passing drill (passing / tactical sessions).
 *
 * Four team-mates spread across the half; one lights up each round with the
 * technique the lane demands:
 *  - GROUND: a two-cone gate sits in the lane — drive it along the floor
 *    through the gate (tap / click the mate, pad A).
 *  - LOFT: mannequins block the lane — chip it over them (swipe, hold &
 *    release, pad X; Space lofts to the lit mate).
 * A completed pass scores; the right technique and a quick release add
 * bonuses and keep the streak alive. Later rounds have moving receivers and
 * narrower gates. Kicks use the match kick model (skill-based error).
 */
import { PITCH_LENGTH, PITCH_WIDTH } from '../../../sim/match/types'
import { kickSkill, leadPosition, planKick, type KickKind } from '../../kick'
import { createTracker, stepBall, type BallState, type BallTracker, type PhysicsEvent } from '../../physics'
import { flatAttrs } from '../../setup'
import { a01, add, angleDiff, clampN, dist, dot, len, norm, scale, sub, type Agent, type Vec2 } from '../../model'
import type { HeroAction } from '../../runtime'
import { firstTouchChance } from '../../chanceEvents'
import { DrillBase, actorView, makeActor, place, snapPrev } from '../base'
import { drillNoise, PASS_ACCURACY_M, passPoints } from '../scoring'
import type { ConeView, DrillConfig, DrillInput, DrillView, GateView, RingView } from '../types'

type RoundState = 'ready' | 'flight' | 'resolved'

interface Station {
  mate: Agent
  home: Vec2
  sway: number
  phase: number
}

interface Lane {
  wanted: 'ground' | 'loft'
  /** Gate cones (ground lanes). */
  gate: [Vec2, Vec2] | null
  /** Mannequins (loft lanes). */
  dummies: Agent[]
}

const HERO_SPOT: Vec2 = { x: 40, y: PITCH_WIDTH / 2 }
/** Drill kick spread: tight gates and a receiver who wants it on his foot make the passing skill show. */
const PASS_NOISE = 2

/** Segment–segment intersection: returns params (t on p→q, u on a→b) or null. */
export function segIntersect(p: Vec2, q: Vec2, a: Vec2, b: Vec2): { t: number; u: number } | null {
  const r = sub(q, p)
  const s = sub(b, a)
  const den = r.x * s.y - r.y * s.x
  if (Math.abs(den) < 1e-9) return null
  const ap = sub(a, p)
  const t = (ap.x * s.y - ap.y * s.x) / den
  const u = (ap.x * r.y - ap.y * r.x) / den
  return { t, u }
}

export class PassingDrill extends DrillBase {
  readonly hero: Agent
  readonly stations: Station[] = []
  readonly ball: BallState
  private tracker: BallTracker = createTracker()
  private readonly phys: PhysicsEvent[] = []
  private lane: Lane = { wanted: 'ground', gate: null, dummies: [] }
  private readonly dummyPool: Agent[]
  private target = 0
  private round = 0
  private state: RoundState = 'ready'
  private stateT = 0
  private readyAt = 0
  private kickInfo: { lofted: boolean; release: number; gateCleared: boolean; gateMissed: boolean; prev: Vec2; aim: Vec2 } | null = null
  private flash: { at: number; tone: 'green' | 'red' } | null = null

  constructor(cfg: DrillConfig) {
    super('passing', cfg)
    this.hero = makeActor('hero', 'hero', 'CM', HERO_SPOT, this.attrs, { hero: true, number: 8 })
    for (let i = 0; i < 4; i++) {
      const m = makeActor(`m${i}`, 'hero', 'CM', { x: 60, y: 10 + i * 15 }, flatAttrs(68), { number: [7, 9, 10, 11][i] })
      this.stations.push({ mate: m, home: { ...m.pos }, sway: 0, phase: this.rng.range(0, 6) })
    }
    this.dummyPool = [0, 1, 2].map((i) => makeActor(`d${i}`, 'opp', 'CB', { x: 50, y: 30 }, flatAttrs(60), { number: 0 }))
    this.ball = { x: HERO_SPOT.x + 0.7, y: HERO_SPOT.y, z: 0, vx: 0, vy: 0, vz: 0, spin: { side: 0, top: 0 } }
    this.newRound()
  }

  // ───────────────────────── Rounds ─────────────────────────

  private newRound(): void {
    this.round++
    const r = this.round
    // Lay out the four receivers in a fan ahead of the passer.
    const angles = [-1.0, -0.38, 0.38, 1.0].map((a) => a + this.rng.range(-0.18, 0.18))
    this.stations.forEach((st, i) => {
      const d = this.rng.range(13, 34)
      let p = { x: HERO_SPOT.x + Math.cos(angles[i]!) * d, y: HERO_SPOT.y + Math.sin(angles[i]!) * d }
      p = { x: clampN(p.x, HERO_SPOT.x + 8, PITCH_LENGTH - 20), y: clampN(p.y, 4, PITCH_WIDTH - 4) }
      st.home = p
      st.sway = r <= 3 ? 0 : Math.min(2.6, 0.6 + (r - 3) * 0.35)
      st.phase = this.rng.range(0, Math.PI * 2)
      place(st.mate, p, Math.atan2(HERO_SPOT.y - p.y, HERO_SPOT.x - p.x))
    })
    let t = this.rng.int(0, 3)
    if (t === this.target && r > 1) t = (t + 1 + this.rng.int(0, 2)) % 4
    this.target = t
    const tgt = this.stations[t]!.home
    const d = dist(HERO_SPOT, tgt)
    const wanted: Lane['wanted'] = d > 28 ? 'loft' : d < 17 ? 'ground' : this.rng.chance(0.5) ? 'loft' : 'ground'
    const dir = norm(sub(tgt, HERO_SPOT))
    const perp = { x: -dir.y, y: dir.x }
    const f = this.rng.range(0.42, 0.58)
    const mid = add(HERO_SPOT, scale(dir, d * f))
    if (wanted === 'ground') {
      const w = Math.max(2.6, 3.6 - r * 0.07) / 2
      this.lane = { wanted, gate: [add(mid, scale(perp, w)), add(mid, scale(perp, -w))], dummies: [] }
    } else {
      const ds = this.dummyPool.slice(0, d > 26 ? 3 : 2)
      ds.forEach((m, i) => {
        const off = (i - (ds.length - 1) / 2) * 0.75
        place(m, add(mid, scale(perp, off)), Math.atan2(-dir.y, -dir.x))
        m.state = 'wall'
      })
      this.lane = { wanted, gate: null, dummies: ds }
    }
    this.tracker = createTracker()
    place(this.hero, HERO_SPOT, Math.atan2(dir.y, dir.x))
    Object.assign(this.ball, { x: HERO_SPOT.x + dir.x * 0.7, y: HERO_SPOT.y + dir.y * 0.7, z: 0, vx: 0, vy: 0, vz: 0 })
    this.ball.spin = { side: 0, top: 0 }
    this.state = 'ready'
    this.stateT = 0
    this.readyAt = this.clock
    this.kickInfo = null
  }

  /** Which mate an action aims at, and with which technique. */
  private interpret(act: HeroAction): { to: Station | null; dir: Vec2; lofted: boolean; power: number } | null {
    const from = HERO_SPOT
    const lit = this.stations[this.target]!
    const cone = this.assist === 'full' ? 0.38 : this.assist === 'half' ? 0.26 : 0.14
    const byDir = (dir: Vec2): Station | null => {
      let best: Station | null = null
      let bestA = cone
      for (const s of this.stations) {
        const a = Math.abs(angleDiff(Math.atan2(s.mate.pos.y - from.y, s.mate.pos.x - from.x), Math.atan2(dir.y, dir.x)))
        if (a < bestA) {
          bestA = a
          best = s
        }
      }
      return best
    }
    const byPoint = (p: Vec2): Station | null => {
      const near = this.stations.filter((s) => dist(s.mate.pos, p) < 4).sort((a, b) => dist(a.mate.pos, p) - dist(b.mate.pos, p))[0]
      return near ?? byDir(norm(sub(p, from)))
    }
    switch (act.kind) {
      case 'tapAt': {
        const to = byPoint(act.at)
        return { to, dir: norm(sub(to?.mate.pos ?? act.at, from)), lofted: false, power: 0.6 }
      }
      case 'pass': {
        const dir = act.target ? norm(sub(act.target, from)) : act.dir && len(act.dir) > 0.2 ? norm(act.dir) : norm(sub(lit.mate.pos, from))
        const to = act.target ? byPoint(act.target) : byDir(dir) ?? (act.dir ? null : lit)
        return { to, dir, lofted: !!act.lofted, power: 0.62 }
      }
      case 'shoot': {
        // PC hold & release / pad B: a lofted ball in that direction.
        const dir = norm(sub(act.target, from))
        return { to: byDir(dir), dir, lofted: true, power: clampN(act.power, 0.45, 1.1) }
      }
      case 'swipe': {
        if (act.swipe.isTap) return null
        const dir = act.swipe.dir
        return { to: byDir(dir), dir, lofted: true, power: clampN(act.swipe.power, 0.45, 1.1) }
      }
      case 'action':
        return { to: lit, dir: norm(sub(lit.mate.pos, from)), lofted: false, power: 0.6 }
      case 'skill':
        return { to: lit, dir: norm(sub(lit.mate.pos, from)), lofted: true, power: 0.65 }
      default:
        return null
    }
  }

  private pass(input: DrillInput): void {
    for (const act of input.actions) {
      const p = this.interpret(act)
      if (!p) continue
      const kind: KickKind = p.lofted ? 'lofted' : 'pass'
      const from = { x: this.ball.x, y: this.ball.y }
      const target = p.to
        ? leadPosition(from, { id: p.to.mate.id, pos: p.to.mate.pos, vel: p.to.mate.vel }, p.lofted ? 17 : 13, 4)
        : add(from, scale(p.dir, 14 + p.power * 20))
      // Long-ball weight from the gesture: soft (<0.55) drops short, hard (>1) runs long.
      const weight = p.lofted ? 1 + (p.power - 0.75) * 0.35 : 1
      const aim = p.to && p.lofted ? add(from, scale(sub(target, from), clampN(weight, 0.85, 1.12))) : target
      const noise = PASS_NOISE * drillNoise(kickSkill(kind, this.attrs, dist(from, aim)))
      const plan = planKick(
        { kind, from, fromZ: 0, target: aim, power: p.power, curl: 0, attrs: this.attrs, pressure: 0, assist: this.assist, env: this.env, noiseScale: noise },
        this.rng,
      )
      this.ball.vx = plan.vx
      this.ball.vy = plan.vy
      this.ball.vz = plan.vz
      this.ball.spin = { ...plan.spin }
      this.hero.facing = Math.atan2(p.dir.y, p.dir.x)
      this.hero.state = 'skill'
      this.hero.stateT = 0
      this.state = 'flight'
      this.stateT = 0
      this.stat('passes')
      if (p.lofted) this.stat('lofted')
      this.kickInfo = { lofted: p.lofted, release: this.clock - this.readyAt, gateCleared: false, gateMissed: false, prev: from, aim: target }
      this.events.push({ type: 'kick', power: p.power, hero: true, x: from.x, y: from.y })
      return
    }
  }

  private resolve(ok: boolean, label: 'pass' | 'wrongType' | 'blocked' | 'overhit' | 'miss' | 'gateMissed', at: Vec2, by: Station | null = null): void {
    if (this.state !== 'flight' || !this.kickInfo) return
    this.state = 'resolved'
    this.stateT = 0
    const k = this.kickInfo
    if (ok && by) {
      // Accuracy: how far the receiver had to come off the spot the pass was meant for.
      const accuracy = Math.max(0, 1 - dist(at, k.aim) / PASS_ACCURACY_M)
      const pts = passPoints({ received: true, wanted: this.lane.wanted, lofted: k.lofted, gateCleared: k.gateCleared, release: k.release, combo: this.combo, accuracy })
      const right = this.lane.wanted === 'loft' ? k.lofted : !k.lofted && k.gateCleared
      this.stat('completed')
      if (right) this.stat('perfect')
      this.flash = { at: this.time, tone: right ? 'green' : 'red' }
      this.award(pts, right, { label: right ? (k.release <= 1.2 ? 'quick' : 'pass') : this.lane.wanted === 'ground' ? 'gateMissed' : 'wrongType', x: at.x, y: at.y })
      by.mate.state = 'skill'
      by.mate.stateT = 0
      return
    }
    this.flash = { at: this.time, tone: 'red' }
    this.stat(label === 'blocked' ? 'blocked' : 'failed')
    this.award(0, false, { label, x: at.x, y: at.y })
  }

  // ───────────────────────── Step ─────────────────────────

  protected beforeStep(): void {
    snapPrev([this.hero, ...this.stations.map((s) => s.mate), ...this.lane.dummies])
  }

  protected busy(): boolean {
    return this.state === 'flight'
  }

  protected tick(dt: number, input: DrillInput, live: boolean): void {
    this.stateT += dt
    if (live && this.state === 'ready') this.pass(input)
    const h = this.hero
    h.stateT += dt
    if (h.state === 'skill' && h.stateT > 0.4) h.state = 'run'
    this.moveMates(dt)
    for (const d of this.lane.dummies) {
      d.stateT += dt
      if (d.state === 'jump') {
        d.z = Math.max(0, Math.sin((Math.PI * d.stateT) / 0.5) * 0.25)
        if (d.stateT > 0.5) {
          d.state = 'wall'
          d.z = 0
        }
      }
    }
    if (this.state === 'flight') this.flight()
    else if (this.state === 'resolved' && this.stateT > 0.75 && (live || this.phase === 'countdown')) this.newRound()
  }

  private moveMates(dt: number): void {
    const b = this.ball
    const flying = this.state === 'flight'
    for (const [i, st] of this.stations.entries()) {
      const m = st.mate
      m.stateT += dt
      if (m.state === 'skill' && m.stateT > 0.5) m.state = 'run'
      let goal = { x: st.home.x, y: clampN(st.home.y + Math.sin(this.time * 0.85 + st.phase) * st.sway, 3, PITCH_WIDTH - 3) }
      if (this.state === 'resolved') goal = m.pos
      if (flying && i === this.target) {
        // Step toward the ball's line (not further than 2.4 m from the station).
        const v = { x: b.vx, y: b.vy }
        const sp = len(v)
        if (sp > 1) {
          const dir = scale(v, 1 / sp)
          const tProj = Math.max(0, dot(sub(m.pos, b), dir))
          const onLine = add(b, scale(dir, tProj))
          const off = sub(onLine, st.home)
          goal = len(off) < 2.4 ? onLine : add(st.home, scale(norm(off), 2.4))
        }
      }
      const d = sub(goal, m.pos)
      const l = len(d)
      const maxV = 3.2 + a01(m.attrs.pace) * 1.5
      m.vel = l < 0.05 ? { x: 0, y: 0 } : scale(d, Math.min(maxV, l * 3) / l)
      m.pos = add(m.pos, scale(m.vel, dt))
      m.facing = Math.atan2(b.y - m.pos.y, b.x - m.pos.x)
    }
  }

  private flight(): void {
    const b = this.ball
    const k = this.kickInfo
    if (!k) return
    const prev = { x: b.x, y: b.y }
    const prevZ = b.z
    this.phys.length = 0
    stepBall(b, this.env, this.tracker, this.phys)
    const now = { x: b.x, y: b.y }
    // Gate crossing (only counts along the floor).
    const g = this.lane.gate
    if (g && !k.gateCleared && !k.gateMissed) {
      const hit = segIntersect(prev, now, g[0], g[1])
      if (hit && hit.t >= 0 && hit.t <= 1) {
        const z = prevZ + (b.z - prevZ) * hit.t
        if (hit.u >= 0 && hit.u <= 1 && z < 1.0) k.gateCleared = true
        else k.gateMissed = true
      }
    }
    // Mannequins block anything low.
    for (const d of this.lane.dummies) {
      if (dist(d.pos, b) < 0.45 && b.z < 1.9) {
        b.vx *= -0.25
        b.vy *= -0.25
        b.vz = 1.2
        d.state = 'jump'
        d.stateT = 0
        this.events.push({ type: 'touch', x: b.x, y: b.y })
        return this.resolve(false, 'blocked', now)
      }
    }
    // Receivers.
    for (const st of this.stations) {
      const m = st.mate
      if (dist(m.pos, b) < 1.1 && b.z < 1.7) {
        const rel = Math.hypot(b.vx - m.vel.x, b.vy - m.vel.y, b.vz)
        // First touch, the match rule: a soft ball is his, a harder one is First Touch (+1 % a point).
        if (!this.rng.chance(firstTouchChance(m, rel))) {
          b.vx *= 0.35
          b.vy *= 0.35
          b.vz = Math.min(3, rel * 0.08)
          this.events.push({ type: 'touch', x: b.x, y: b.y })
          return this.resolve(false, 'overhit', now)
        }
        b.vx = b.vy = b.vz = 0
        b.z = 0
        this.events.push({ type: 'touch', x: b.x, y: b.y })
        if (st === this.stations[this.target]) return this.resolve(true, 'pass', now, st)
        return this.resolve(false, 'miss', now)
      }
    }
    if (this.phys.some((e) => e.type === 'out')) return this.resolve(false, 'miss', now)
    const slow = Math.hypot(b.vx, b.vy) < 0.6 && b.z < 0.05
    if (slow || this.stateT > 4) this.resolve(false, 'miss', now)
  }

  // ───────────────────────── Bots / tests ─────────────────────────

  get ready(): boolean {
    return this.state === 'ready' && this.live
  }
  get litMate(): Agent {
    return this.stations[this.target]!.mate
  }
  get wanted(): 'ground' | 'loft' {
    return this.lane.wanted
  }

  view(): DrillView {
    const lit = this.stations[this.target]!
    const flash = this.flash && this.time - this.flash.at < 0.6 ? this.flash.tone : null
    const rings: RingView[] = [{ x: lit.mate.pos.x, y: lit.mate.pos.y, r: 1.3, tone: flash ?? 'gold', pulse: this.state === 'ready' }]
    const cones: ConeView[] = []
    const gates: GateView[] = []
    const g = this.lane.gate
    if (g) {
      const tone = this.kickInfo?.gateCleared ? 'green' : this.kickInfo?.gateMissed ? 'red' : 'orange'
      cones.push({ x: g[0].x, y: g[0].y, tone }, { x: g[1].x, y: g[1].y, tone })
      gates.push({ a: g[0], b: g[1], tone, label: 'ground' })
    }
    return {
      focus: { x: (HERO_SPOT.x + lit.home.x) / 2 + 2, y: (HERO_SPOT.y + lit.home.y) / 2 },
      span: 34,
      goals: [],
      hero: actorView(this.hero, 'hero'),
      actors: [
        ...this.stations.map((s, i) => actorView(s.mate, 'mate', i === this.target)),
        ...this.lane.dummies.map((d) => actorView(d, 'dummy')),
      ],
      ball: this.ballView(this.ball),
      cones,
      gates,
      goalTargets: [],
      rings,
      lines: this.state === 'ready' ? [{ a: HERO_SPOT, b: lit.mate.pos, tone: this.lane.wanted === 'loft' ? 'blue' : 'white', width: 0.12 }] : [],
      preview: null,
      hud: {
        points: Math.round(this.points),
        combo: this.combo,
        timeLeft: this.timeLeft,
        duration: this.duration,
        prompt: this.phase === 'countdown' ? 'ready' : this.phase === 'post' || this.finished ? 'done' : this.lane.wanted === 'loft' ? 'passLoft' : 'passGround',
        meters: [],
        level: this.round,
        countdown: this.countdown,
      },
      heroOnBall: this.state === 'ready',
      heroIsKeeper: false,
    }
  }
}
