/**
 * Fitness drill: a shuttle "beep test" about rhythm and stamina management.
 *
 * Run 20 m shuttles between two lines; each shuttle must be finished before
 * the next beep, and the beeps speed up every two shuttles. Leave on the beep
 * (tap / Space / pad A) for a rhythm bonus — the runner jogs by default and
 * sprints while SPRINT is held, which drains stamina; arrive early and you
 * recover while waiting for the beep. Empty the tank and you are "gassed"
 * (slow until you recover). Two late arrivals in a row end the test.
 */
import { a01, add, clampN, scale, type Agent } from '../../model'
import { DrillBase, actorView, makeActor, snapPrev } from '../base'
import {
  SHUTTLES_PER_LEVEL, SHUTTLE_LENGTH, beepInterval, shuttlePoints, sprintDrain, staminaRecovery, startTiming, type StartTiming,
} from '../scoring'
import type { ConeView, DrillConfig, DrillInput, DrillView, LineView } from '../types'

const LINE_A = 58
const LINE_B = LINE_A + SHUTTLE_LENGTH
const LANE_Y = 34

type RunState = 'waiting' | 'running'

export class FitnessDrill extends DrillBase {
  readonly hero: Agent
  private run: RunState = 'waiting'
  /** Line the runner is heading to / standing on. */
  private targetX = LINE_B
  private level = 1
  private shuttle = 0
  /** Clock time of the next beep. */
  private nextBeep = 0
  private lastBeep = 0
  /** Shuttle in progress was started for beep #n; arriving before beep n+1 scores. */
  private onTime = true
  private start: StartTiming = 'slow'
  private goPressedAt = -9
  /** Spam guard: pressing "go" well before the beep locks the button briefly. */
  private goLockUntil = -9
  /** Beeps sounded so far; shuttle n may start after beep n. */
  private beeps = 0
  private lateStreak = 0
  private gassed = false
  private failed = false
  private flash: { at: number; tone: 'green' | 'red' } | null = null

  constructor(cfg: DrillConfig) {
    super('fitness', cfg)
    this.hero = makeActor('hero', 'hero', 'CM', { x: LINE_A, y: LANE_Y }, this.attrs, { hero: true, number: 6 })
    this.hero.stamina = 1
  }

  get jogSpeed(): number {
    return 3.9 + a01(this.attrs.pace) * 1.3
  }
  get sprintSpeed(): number {
    return 6.0 + a01(this.attrs.pace) * 2.0
  }

  protected onStart(): void {
    this.lastBeep = 0
    this.nextBeep = 0
    this.beep()
  }

  private beep(): void {
    // A beep while still running = late for this shuttle.
    if (this.run === 'running' && this.shuttle > 0) {
      if (this.onTime) {
        this.onTime = false
        this.lateStreak++
        this.stat('late')
        this.flash = { at: this.time, tone: 'red' }
        this.award(0, false, { label: 'lateArrival', x: this.hero.pos.x, y: this.hero.pos.y })
        if (this.lateStreak >= 2) this.failed = true
      }
    }
    this.beeps++
    this.events.push({ type: 'beep', level: this.level })
    this.lastBeep = this.nextBeep
    this.nextBeep = this.lastBeep + beepInterval(this.level)
    // Pre-pressed "go" just before the beep counts as a perfect start.
    if (this.run === 'waiting') {
      if (this.clock - this.goPressedAt < 0.2) this.depart(0)
    }
  }

  private depart(delay: number): void {
    this.run = 'running'
    this.onTime = true
    this.start = startTiming(delay)
    this.shuttle++
    this.stat(this.start === 'perfect' ? 'perfectStarts' : this.start === 'good' ? 'goodStarts' : 'slowStarts')
  }

  private arrive(): void {
    const h = this.hero
    if (this.onTime) {
      this.lateStreak = 0
      this.stat('shuttles')
      this.flash = { at: this.time, tone: 'green' }
      this.award(shuttlePoints(this.level, this.start), true, { label: this.start === 'perfect' ? 'perfectStart' : this.start === 'good' ? 'goodStart' : 'shuttle', x: h.pos.x, y: h.pos.y })
    }
    if (this.shuttle % SHUTTLES_PER_LEVEL === 0) this.level++
    this.targetX = this.targetX === LINE_B ? LINE_A : LINE_B
    h.facing = this.targetX > h.pos.x ? 0 : Math.PI
    if (this.onTime) {
      this.run = 'waiting'
      h.vel = scale(h.vel, 0.2)
    } else {
      // Late: turn straight round and chase the next beep.
      this.onTime = true
      this.start = 'slow'
      this.shuttle++
      h.vel = scale(h.vel, -0.3)
    }
  }

  // ───────────────────────── Step ─────────────────────────

  protected beforeStep(): void {
    snapPrev([this.hero])
  }

  protected busy(): boolean {
    return false
  }

  protected forceEnd(): boolean {
    return this.failed
  }

  protected tick(dt: number, input: DrillInput, live: boolean): void {
    const h = this.hero
    h.stateT += dt
    if (live) {
      const go = input.actions.some((a) => a.kind === 'action' || a.kind === 'skill' || a.kind === 'tapAt' || (a.kind === 'swipe' && !a.swipe.isTap) || a.kind === 'pass' || a.kind === 'shoot')
      if (go && this.run === 'waiting') {
        const since = this.clock - this.lastBeep
        const until = this.nextBeep - this.clock
        if (this.shuttle < this.beeps) this.depart(since)
        else if (until <= 0.15 && this.clock >= this.goLockUntil) this.goPressedAt = this.clock // buffered for the coming beep
        else this.goLockUntil = this.clock + 0.45
      }
      if (this.clock >= this.nextBeep - 1e-9) this.beep()
      // Auto-leave half a second after the beep (slow start).
      if (this.run === 'waiting' && this.shuttle < this.beeps && this.clock - this.lastBeep > 0.5) this.depart(this.clock - this.lastBeep)
    }

    // Stamina & speed.
    const st01 = a01(this.attrs.stamina)
    const running = this.run === 'running' && live
    const sprinting = running && input.sprint && !this.gassed
    if (sprinting) h.stamina = Math.max(0, h.stamina - sprintDrain(st01) * dt)
    else h.stamina = Math.min(1, h.stamina + staminaRecovery(st01, !running) * dt)
    if (h.stamina <= 0 && !this.gassed) {
      this.gassed = true
      this.stat('gassed')
      this.events.push({ type: 'score', points: 0, label: 'gassed', good: false, x: h.pos.x, y: h.pos.y })
    }
    if (this.gassed && h.stamina >= 0.35) this.gassed = false
    const want = !running ? 0 : this.gassed ? this.jogSpeed * 0.72 : sprinting ? this.sprintSpeed : this.jogSpeed
    const dir = this.targetX > h.pos.x ? 1 : -1
    const cur = h.vel.x * dir
    const acc = (9 + a01(this.attrs.agility) * 4 + a01(this.attrs.pace) * 3) * dt
    const next = cur < want ? Math.min(want, cur + acc) : Math.max(want, cur - acc * 1.6)
    h.vel = { x: next * dir, y: 0 }
    h.sprint = sprinting
    const before = h.pos.x
    h.pos = add(h.pos, scale(h.vel, dt))
    h.pos.y = LANE_Y
    if (running && (before - this.targetX) * (h.pos.x - this.targetX) <= 0 && before !== this.targetX) {
      h.pos.x = this.targetX
      this.arrive()
    }
    h.pos.x = clampN(h.pos.x, LINE_A - 2, LINE_B + 2)
    if (Math.abs(h.vel.x) > 0.3) h.facing = h.vel.x > 0 ? 0 : Math.PI
  }

  // ───────────────────────── Bots / tests ─────────────────────────

  get state(): { run: RunState; stamina: number; untilBeep: number; distanceLeft: number; level: number; gassed: boolean; sinceBeep: number } {
    return {
      run: this.run,
      stamina: this.hero.stamina,
      untilBeep: this.nextBeep - this.clock,
      sinceBeep: this.clock - this.lastBeep,
      distanceLeft: Math.abs(this.targetX - this.hero.pos.x),
      level: this.level,
      gassed: this.gassed,
    }
  }

  view(): DrillView {
    const h = this.hero
    const flash = this.flash && this.time - this.flash.at < 0.6 ? this.flash.tone : null
    const lineTone = (x: number) => (x === this.targetX ? flash ?? (this.run === 'running' ? 'gold' : 'white') : 'white')
    const lines: LineView[] = [
      { a: { x: LINE_A, y: LANE_Y - 4 }, b: { x: LINE_A, y: LANE_Y + 4 }, tone: lineTone(LINE_A), width: 0.22 },
      { a: { x: LINE_B, y: LANE_Y - 4 }, b: { x: LINE_B, y: LANE_Y + 4 }, tone: lineTone(LINE_B), width: 0.22 },
    ]
    const cones: ConeView[] = [LINE_A, LINE_B].flatMap((x) => [
      { x, y: LANE_Y - 4.4, tone: 'orange' as const },
      { x, y: LANE_Y + 4.4, tone: 'orange' as const },
    ])
    const interval = beepInterval(this.level)
    const beat = this.phase === 'live' ? clampN(1 - (this.nextBeep - this.clock) / interval, 0, 1) : 0
    const eta = this.run === 'running' ? Math.abs(this.targetX - h.pos.x) / Math.max(0.5, Math.abs(h.vel.x) || this.jogSpeed) : 0
    const behind = this.run === 'running' && eta > this.nextBeep - this.clock
    return {
      focus: { x: (LINE_A + LINE_B) / 2, y: LANE_Y },
      span: 26,
      goals: [],
      hero: actorView(h, 'hero'),
      actors: [],
      ball: null,
      cones,
      gates: [],
      goalTargets: [],
      rings: this.run === 'waiting' && this.phase === 'live' ? [{ x: h.pos.x, y: h.pos.y, r: 1.2 + beat * 0.8, tone: beat > 0.85 ? 'green' : 'white', pulse: true }] : [],
      lines,
      preview: null,
      hud: {
        points: Math.round(this.points),
        combo: this.combo,
        timeLeft: this.timeLeft,
        duration: this.duration,
        prompt: this.phase === 'countdown' ? 'ready' : this.phase === 'post' || this.finished ? 'done' : this.run === 'waiting' ? (beat > 0.8 ? 'fitnessGo' : 'fitnessWait') : 'fitnessRun',
        meters: [
          { kind: 'stamina', value: h.stamina, tone: this.gassed || h.stamina < 0.25 ? 'red' : 'green' },
          { kind: 'beat', value: beat, tone: behind ? 'red' : 'gold' },
        ],
        level: this.level,
        countdown: this.countdown,
      },
      heroOnBall: false,
      heroIsKeeper: false,
    }
  }
}
