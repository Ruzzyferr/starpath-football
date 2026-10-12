/**
 * Explosive Starts ("Patlayıcı Çıkışlar", sprint sessions, Acceleration) and
 * its Core & Contact variant ("Denge & Temas", Balance).
 *
 * Repeated 15 m sprints from a standing start. Each rep the hero waits at the
 * line ("set"); after a random hold the light turns green and the hero goes
 * on a tap (tap / Space / GO). Reaction ≤ 0.18 s is perfect, ≤ 0.32 s good; a
 * tap before the light is a false start (−20, the rep restarts). Once away,
 * holding SPRINT drives hard: Acceleration sets how fast the runner reaches
 * speed, Pace the top speed. A tap in the last 1.2 m is the "dip" at the line.
 *
 * Contact variant: half-way down the lane a team-mate comes in with a
 * shoulder charge. A ring closes on the hero; tap while it is green to brace
 * (+40, speed kept) — whether you stay on your feet is Balance vs the
 * charger's Strength (+1 % a point, +25 for the timed, set body). Balance (and
 * a little Strength) widens the window; miss it and you stumble, keeping only
 * part of your speed (more with Balance).
 */
import { CHANCE_MOD, eventChance } from '../../chanceEvents'
import { flatAttrs } from '../../setup'
import { a01, accel, clampN, topSpeed, type Agent } from '../../model'
import { DrillBase, actorView, makeActor, place, snapPrev } from '../base'
import {
  FALSE_START_PENALTY, SPRINT_DIP_M, SPRINT_DISTANCE, braceWindow, reactionGrade, sprintPoints, stumbleKeep,
  type ReactionGrade,
} from '../scoring'
import type { ConeView, DrillConfig, DrillInput, DrillView, LineView, RingView } from '../types'

const START_X = 40
const FINISH_X = START_X + SPRINT_DISTANCE
const LANE_Y = 34
/** Where the charge lands (m from the start). */
const CONTACT_AT = 7.5
/** Without a tap the runner walks off this long after the light (and the rep scores nothing). */
const AUTO_GO = 0.8
/** Pause after a rep before the next set (s). */
const REST = 0.7

type RepState = 'set' | 'run' | 'rest'

export class SprintDrill extends DrillBase {
  readonly hero: Agent
  readonly bumper: Agent
  private rep: RepState = 'set'
  private repT = 0
  /** Seconds after the set the light goes green. */
  private hold = 1.4
  private green = false
  private goAt = 0
  private reaction = 0
  private reacted: ReactionGrade = 'slow'
  private dipped = false
  private reps = 0
  private speed = 0
  /** Contact variant: the charge of this rep (null once resolved). */
  private charge: { braced: boolean | null; armedAt: number } | null = null
  private lockUntil = -9
  private flash: { at: number; tone: 'green' | 'red' } | null = null

  constructor(cfg: DrillConfig) {
    super('sprint', cfg)
    this.hero = makeActor('hero', 'hero', 'RW', { x: START_X, y: LANE_Y }, this.attrs, { hero: true, number: 7, facing: 0 })
    this.bumper = makeActor('bump', 'hero', 'CB', { x: START_X + CONTACT_AT - 2, y: LANE_Y + 6 }, flatAttrs(70), { number: 5, facing: -Math.PI / 2 })
    this.newRep()
  }

  get contact(): boolean {
    return this.variant === 'contact'
  }

  private newRep(): void {
    this.rep = 'set'
    this.repT = 0
    this.hold = this.rng.range(1.0, 2.2)
    this.green = false
    this.dipped = false
    this.speed = 0
    this.charge = this.contact ? { braced: null, armedAt: -1 } : null
    place(this.hero, { x: START_X, y: LANE_Y }, 0)
    this.hero.state = 'run'
    place(this.bumper, { x: START_X + CONTACT_AT - 3, y: LANE_Y + (this.reps % 2 === 0 ? 6 : -6) }, this.reps % 2 === 0 ? -Math.PI / 2 : Math.PI / 2)
  }

  /** The hold before the first light starts with the whistle, not during the countdown. */
  protected onStart(): void {
    this.repT = 0
  }

  private go(reaction: number): void {
    this.rep = 'run'
    this.reaction = reaction
    this.reacted = reactionGrade(reaction)
    this.stat(this.reacted === 'perfect' ? 'perfectStarts' : this.reacted === 'good' ? 'goodStarts' : 'slowStarts')
  }

  private finish(): void {
    const h = this.hero
    this.reps++
    this.stat('reps')
    const time = this.clock - this.goAt
    const braced = this.charge ? this.charge.braced === true : undefined
    // Never went (the runner walked off on his own): no points for the rep.
    const asleep = this.reaction >= AUTO_GO - 1e-6
    const pts = asleep ? 0 : sprintPoints({ reaction: this.reacted, time, dip: this.dipped, ...(braced !== undefined ? { braced } : {}), combo: this.combo })
    const ok = this.reacted !== 'slow' && braced !== false
    this.flash = { at: this.time, tone: ok ? 'green' : 'red' }
    this.award(pts, ok, { label: this.dipped ? 'dip' : this.reacted === 'perfect' ? 'perfectStart' : this.reacted === 'good' ? 'goodStart' : 'late', x: h.pos.x, y: h.pos.y })
    this.stats.bestTime = Math.min(this.stats.bestTime ?? 99, Math.round(time * 100) / 100)
    this.stats.bestReaction = Math.min(this.stats.bestReaction ?? 9, Math.round(this.reaction * 1000) / 1000)
    this.rep = 'rest'
    this.repT = 0
  }

  // ───────────────────────── Step ─────────────────────────

  protected beforeStep(): void {
    snapPrev([this.hero, this.bumper])
  }

  protected busy(): boolean {
    return this.rep === 'run'
  }

  private tapped(input: DrillInput): boolean {
    return input.actions.some((a) => a.kind === 'action' || a.kind === 'skill' || a.kind === 'tapAt' || a.kind === 'swipe' || a.kind === 'pass' || a.kind === 'shoot')
  }

  protected tick(dt: number, input: DrillInput, live: boolean): void {
    const h = this.hero
    h.stateT += dt
    this.repT += dt
    const tap = live && this.tapped(input)
    if (this.rep === 'set') {
      if (live && !this.green && this.repT >= this.hold) {
        this.green = true
        this.goAt = this.clock
        this.events.push({ type: 'beep', level: this.reps + 1 })
      }
      if (tap) {
        if (!this.green) {
          // False start: penalty and a fresh hold.
          this.stat('falseStarts')
          this.flash = { at: this.time, tone: 'red' }
          this.award(FALSE_START_PENALTY, false, { label: 'falseStart', x: h.pos.x, y: h.pos.y })
          this.repT = 0
          this.hold = this.rng.range(1.0, 2.2)
        } else this.go(this.clock - this.goAt)
      } else if (live && this.green && this.clock - this.goAt > AUTO_GO) this.go(AUTO_GO) // never reacted: walks off
      return
    }
    if (this.rep === 'rest') {
      h.vel = { x: h.vel.x * 0.85, y: 0 }
      h.pos = { x: h.pos.x + h.vel.x * dt, y: LANE_Y }
      if (this.repT >= REST && (live || this.phase === 'countdown')) this.newRep()
      return
    }
    // Running.
    const drive = input.sprint
    // The match's running model: model.accel (Acceleration, a little Agility) up to model.topSpeed (Pace), sprinting
    // while SPRINT is held; a held-back run builds speed at 60 % of the drive.
    const top = this.topSpeed(drive)
    this.speed = Math.min(top, this.speed + accel(h) * (drive ? 1 : 0.6) * dt)
    h.sprint = drive
    const left = FINISH_X - h.pos.x
    if (tap && this.charge && this.charge.braced === null && this.inBraceWindow()) {
      // Braced in time: staying on his feet is the match rule (chanceEvents 'keepFeet': his Balance vs the
      // charger's Strength, +1 % a point), the timed, set body worth CHANCE_MOD.timing + CHANCE_MOD.shield.
      if (this.rng.chance(eventChance('keepFeet', h, this.bumper, CHANCE_MOD.timing + CHANCE_MOD.shield))) {
        this.charge.braced = true
        this.stat('braced')
        // Even a braced charge costs a little speed: Balance keeps more of it.
        this.speed *= 0.55 + a01(this.attrs.balance) * 0.45
        this.events.push({ type: 'score', points: 0, label: 'braced', good: true, x: h.pos.x, y: h.pos.y })
      } else this.stumble()
    } else if (tap && this.charge && this.charge.braced === null && this.braceApproaching()) {
      // Bracing too early: a short lock-out, so mashing the button does not find the window.
      if (this.clock >= this.lockUntil) this.lockUntil = this.clock + 0.25
    } else if (tap && left <= SPRINT_DIP_M && left > 0 && !this.dipped) {
      this.dipped = true
      this.stat('dips')
    }
    // The charge lands.
    if (this.charge && this.charge.braced !== true && h.pos.x >= START_X + CONTACT_AT && this.charge.braced === null) this.stumble()
    if (h.state === 'down' && h.stateT > 0.35) h.state = 'run'
    h.vel = { x: this.speed, y: 0 }
    h.pos = { x: h.pos.x + this.speed * dt, y: LANE_Y }
    h.facing = 0
    this.moveBumper(dt)
    if (h.pos.x >= FINISH_X) this.finish()
  }

  /** The charge put him off his stride (not braced, or braced and knocked off his feet anyway). */
  private stumble(): void {
    const h = this.hero
    this.charge!.braced = false
    this.stat('stumbles')
    this.speed *= stumbleKeep(this.attrs.balance)
    h.state = 'down'
    h.stateT = 0
    this.flash = { at: this.time, tone: 'red' }
    this.events.push({ type: 'score', points: 0, label: 'stumble', good: false, x: h.pos.x, y: h.pos.y })
  }

  /** His top speed (m/s) for this run: the match's model.topSpeed, sprinting (driving) or not. */
  private topSpeed(drive: boolean): number {
    return topSpeed({ ...this.hero, sprint: drive, stamina: 1 })
  }

  /** Seconds until the hero reaches the contact point at the current speed. */
  private untilContact(): number {
    const d = START_X + CONTACT_AT - this.hero.pos.x
    return d <= 0 ? 0 : d / Math.max(1.5, this.speed)
  }
  private inBraceWindow(): boolean {
    if (this.rep !== 'run' || !this.charge || this.charge.braced !== null || this.clock < this.lockUntil) return false
    const u = this.untilContact()
    return u > 0 && u <= braceWindow(this.attrs.balance, this.attrs.strength)
  }
  private braceApproaching(): boolean {
    return this.rep === 'run' && !!this.charge && this.charge.braced === null && this.untilContact() > 0
  }

  private moveBumper(dt: number): void {
    const b = this.bumper
    b.stateT += dt
    if (!this.contact) return
    const side = b.pos.y > LANE_Y ? 1 : -1
    const u = this.untilContact()
    // Comes in from the side so he meets the runner at the contact point.
    const target = { x: START_X + CONTACT_AT, y: LANE_Y + side * (u > 0 ? Math.min(6, 0.9 + u * 3) : 0.9) }
    b.pos = { x: b.pos.x + (target.x - b.pos.x) * Math.min(1, dt * 6), y: b.pos.y + (target.y - b.pos.y) * Math.min(1, dt * 6) }
    b.facing = side > 0 ? -Math.PI / 2 : Math.PI / 2
  }

  // ───────────────────────── Bots / tests ─────────────────────────

  get state(): { rep: RepState; green: boolean; braceOpen: boolean; toLine: number; untilContact: number; charge: boolean } {
    return {
      rep: this.rep,
      green: this.green,
      braceOpen: this.inBraceWindow(),
      toLine: FINISH_X - this.hero.pos.x,
      untilContact: this.untilContact(),
      charge: !!this.charge && this.charge.braced === null,
    }
  }

  view(): DrillView {
    const h = this.hero
    const flash = this.flash && this.time - this.flash.at < 0.6 ? this.flash.tone : null
    const lines: LineView[] = [
      { a: { x: START_X, y: LANE_Y - 3 }, b: { x: START_X, y: LANE_Y + 3 }, tone: this.rep === 'set' ? (this.green ? 'green' : 'red') : 'white', width: 0.24 },
      { a: { x: FINISH_X, y: LANE_Y - 3 }, b: { x: FINISH_X, y: LANE_Y + 3 }, tone: flash ?? 'gold', width: 0.24 },
      { a: { x: FINISH_X - SPRINT_DIP_M, y: LANE_Y - 2 }, b: { x: FINISH_X - SPRINT_DIP_M, y: LANE_Y + 2 }, tone: 'dim', width: 0.08 },
    ]
    const cones: ConeView[] = [START_X, START_X + 5, START_X + 10, FINISH_X].flatMap((x) => [
      { x, y: LANE_Y - 3.4, tone: 'orange' as const },
      { x, y: LANE_Y + 3.4, tone: 'orange' as const },
    ])
    const braceOpen = this.inBraceWindow()
    const rings: RingView[] = []
    if (this.rep === 'set' && this.phase === 'live') rings.push({ x: START_X - 1.2, y: LANE_Y, r: 0.9, tone: this.green ? 'green' : 'red', pulse: this.green })
    if (this.charge && this.charge.braced === null && this.rep === 'run') {
      const u = this.untilContact()
      rings.push({ x: h.pos.x, y: h.pos.y, r: 0.8 + Math.min(2.2, u * 3), tone: braceOpen ? 'green' : 'white', pulse: braceOpen })
    }
    const prompt =
      this.phase === 'countdown' ? 'ready'
        : this.phase === 'post' || this.finished ? 'done'
          : this.rep === 'set' ? (this.green ? 'sprintGo' : 'sprintSet')
            : braceOpen ? 'braceNow' : 'sprintRun'
    const timing = this.rep === 'run' && this.charge && this.charge.braced === null
      ? clampN(1 - this.untilContact() / 1.2, 0, 1)
      : this.rep === 'run' ? clampN(1 - (FINISH_X - h.pos.x) / SPRINT_DISTANCE, 0, 1) : 0
    return {
      focus: { x: (START_X + FINISH_X) / 2, y: LANE_Y },
      span: 22,
      goals: [],
      hero: actorView(h, 'hero'),
      actors: this.contact ? [actorView(this.bumper, 'mate', braceOpen)] : [],
      ball: null,
      cones,
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
        meters: [
          { kind: 'power', value: clampN(this.speed / this.topSpeed(true), 0, 1), tone: this.rep === 'run' ? 'gold' : 'dim' },
          { kind: 'timing', value: timing, tone: braceOpen ? 'green' : 'white' },
        ],
        level: this.reps + 1,
        countdown: this.countdown,
      },
      heroOnBall: false,
      heroIsKeeper: false,
    }
  }
}
