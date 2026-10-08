/**
 * MatchSim — deterministic, minute-by-minute football match simulation.
 *
 * Model (per simulated minute):
 *  - fatigue accrues (stamina, tactic style and weather dependent);
 *  - substitutions (AI around 58–88', hero from the bench 55–80');
 *  - a scheduled hero highlight may replace the minute (sim pauses);
 *  - possession battle from midfield strength × style × home advantage;
 *  - the team in possession may create a chance (attack vs defence ratio,
 *    tempo, game state); chances become typed shots with an xG-like quality
 *    resolved against the keeper; set pieces, offsides, fouls, cards and
 *    injuries are rolled alongside;
 *  - stoppage time per period, half-time, extra time and a penalty shootout
 *    for level knockouts.
 *
 * All randomness comes from one seeded {@link Rng}; the full state is plain
 * JSON so a match can be serialized mid-way and resumed identically.
 */
import { clamp, Rng } from '../../core/rng'
import type { Lang, MatchResultSummary, Position } from '../../core/types'
import { autoResolve, outcomeProbabilities } from './autoResolve'
import { injuryRiskMultiplier } from './injuryRisk'
import { commentary, type CommentaryKey, type CommentaryVars, formatScore } from './commentary'
import type { EngineState, HeroRuntime, MatchSimOptions, PendingRuntime, PlayerRuntime, TeamRuntime } from './engineState'
import { assignSlots } from './formations'
import {
  buildScenario,
  guaranteedKind,
  isDefensiveKind,
  kindWeights,
  pickHighlightKind,
  planHighlightMinutes,
  plannedHighlightCount,
  HIGHLIGHTS_MAX_90,
  type SlotPlayer,
} from './highlightGen'
import { EARLY_BRAKE_MINUTE, MIN_MOMENT_CHANCE, earlyBrake, momentChance } from './fairness'
import { backgroundPasses, mergePassNet } from './passNet'
import { HEAT_COLS, HEAT_ROWS, addHeat, backgroundPresence, emptyHeat, shotEntry, typicalShotSpot } from './heroMap'
import { formationSlots } from './formations'
import { backgroundRedReason, banMatches, copyBook, noteShot, refCardMult, refFoulMult, type RedReason } from './referee'
import {
  clampRating,
  contributionFloor,
  finalRatingParts,
  highlightRatingDelta,
  npcRating,
  pickMotm,
  RATING_BASE,
  roundRating,
  teamGoalRatingDelta,
} from './rating'
import {
  ASSIST_WEIGHT,
  computeRatings,
  FOUL_WEIGHT,
  freekickSkill,
  cornerSkill,
  HEAD_WEIGHT,
  penaltySkill,
  positionGroup,
  SHOOT_WEIGHT,
  skillMult,
  STYLES,
  type TeamRatings,
  unitSkills,
  momentumFactor,
  isLateTired,
  lateFatigueAttrs,
  type UnitSkills,
  WEATHER,
} from './teamModel'
import type {
  HeroMatchStats,
  Highlight,
  HighlightKind,
  HighlightResult,
  MatchEvent,
  MatchEventType,
  MatchPlayer,
  MatchSetup,
  MatchSnapshot,
  MatchTeam,
  RatingLogEntry,
  ShotMapEntry,
  Side,
} from './types'
import { KEEPER_KINDS } from './types'

export type { MatchSimOptions } from './engineState'

// ───────────────────────── Tuning constants ─────────────────────────

/** Base probability that the team in possession creates a shot in a minute. */
const BASE_CHANCE = 0.26
const CHANCE_EXPONENT = 2.2
const HOME_ADVANTAGE = 1.06
const OFFSIDE_RATE = 0.02
const CORNER_RATE = 0.055
const PENALTY_RATE = 0.0026
const FOUL_RATE = 0.22
const YELLOW_PER_FOUL = 0.16
const RED_PER_FOUL = 0.0012
const DANGEROUS_FOUL = 0.12
const FK_SHOT_CHANCE = 0.35
const INJURY_RATE = 0.0035
const FLAVOR_RATE = 0.06
const EXPECTED_TEAM_GOALS_90 = 1.35

const PERIOD_END = [45, 90, 105, 120] as const

type ShotType = 'long' | 'open' | 'header' | 'big' | 'fk' | 'pen'
const SHOT_XG: Record<ShotType, number> = { long: 0.03, open: 0.084, header: 0.07, big: 0.3, fk: 0.06, pen: 0.76 }

/** Background pass attempts per minute for the hero by position. */
const HERO_PASS_RATE: Record<Position, number> = {
  GK: 0.22, CB: 0.38, LB: 0.36, RB: 0.36, DM: 0.45, CM: 0.46, AM: 0.4, LW: 0.3, RW: 0.3, ST: 0.22,
}

const other = (s: Side): Side => (s === 'home' ? 'away' : 'home')
const idx = (s: Side): 0 | 1 => (s === 'home' ? 0 : 1)

function emptyHeroStats(): HeroMatchStats {
  return {
    minutes: 0, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, passes: 0, passesCompleted: 0,
    tackles: 0, dribbles: 0, saves: 0, yellow: 0, red: 0, rating: 0, highlightsPlayed: 0,
  }
}

function newPlayer(id: string, side: Side, slot: number, onPitch: boolean): PlayerRuntime {
  return {
    id, side, slot, onPitch, played: onPitch, gone: false, minutes: 0, fatigue: 0, yellow: 0, red: false,
    goals: 0, assists: 0, ownGoals: 0, shotsOnTarget: 0, saves: 0,
  }
}

function newTeam(team: MatchTeam, maxSubs: number): TeamRuntime {
  return {
    onPitch: team.lineup.map((p) => p.id),
    bench: team.bench.map((p) => p.id),
    subsLeft: maxSubs,
    aiSubsPlanned: 0,
    aiSubsMade: 0,
    shots: 0,
    onTarget: 0,
    corners: 0,
    fouls: 0,
    possession: 0,
    tilt: 0,
  }
}

/**
 * Deterministic match simulation. See the module comment for the model.
 */
export class MatchSim {
  private s!: EngineState
  private rng!: Rng
  private lookup!: Map<string, MatchPlayer>
  private skills!: Map<string, UnitSkills>
  /** Unit skills with the late-fatigue cut (see {@link lateFatigueAttrs}); built lazily. */
  private tiredSkills!: Map<string, UnitSkills>
  private out: MatchEvent[] = []
  /** Transient: the highlight being resolved came from skipHighlight(). */
  private resolvingAuto = false

  /**
   * @param setup teams, seed, competition flags.
   * @param lang commentary language.
   * @param opts optional hero form / manager trust / substitution limit.
   */
  constructor(setup: MatchSetup, lang: Lang, opts: MatchSimOptions = {}) {
    this.rng = new Rng(setup.seed)
    this.s = this.initialState(setup, lang, opts)
    this.indexPlayers()
    this.initMatch()
  }

  // ───────────────────────── Public API ─────────────────────────

  /** The highlight awaiting resolution, or null. */
  get pendingHighlight(): Highlight | null {
    return this.s.pending?.highlight ?? null
  }

  /** True once the final whistle (or shootout) is done. */
  get finished(): boolean {
    return this.s.phase === 'done'
  }

  /** Added minutes for the current period (-1 until announced). */
  get addedTime(): number {
    return this.s.stoppage
  }

  /**
   * Advances one minute (or one shootout kick). Returns the new events.
   * Returns [] without advancing while a highlight is pending or the match is over.
   */
  step(): MatchEvent[] {
    if (this.s.phase === 'done' || this.s.pending) return []
    this.out = []
    if (!this.s.started) this.kickoff()
    if (this.s.phase === 'shootout') {
      this.shootoutKick()
    } else {
      this.advanceClock()
      this.playMinute()
      if (!this.s.pending) this.maybeEndPeriod()
    }
    return this.flush()
  }

  /**
   * Applies the outcome of the pending highlight (played in the MatchScene):
   * score, scorers, cards, injury, hero stats and rating. May immediately
   * create a follow-up highlight (e.g. a penalty won by the hero).
   */
  resolveHighlight(result: HighlightResult): MatchEvent[] {
    const pending = this.s.pending
    if (!pending) return []
    this.out = []
    this.s.pending = null
    this.applyHighlight(pending, result)
    if (!this.s.pending && this.s.phase !== 'done') {
      if (pending.context === 'shootout') this.checkShootoutEnd()
      else this.maybeEndPeriod()
    }
    return this.flush()
  }

  /** Auto-resolves the pending highlight from the hero's attributes. */
  skipHighlight(): MatchEvent[] {
    const pending = this.s.pending
    if (!pending) return []
    const hero = this.heroPlayer()
    if (!hero) return this.resolveHighlight({ outcome: 'timeout', passes: 0, passesCompleted: 0, shots: 0, shotsOnTarget: 0, dribbles: 0, tackles: 0 })
    const r = autoResolve(pending.highlight.kind, hero.attrs, this.s.setup.difficulty, this.rng, this.heroInjuryRisk())
    this.resolvingAuto = true
    try {
      return this.resolveHighlight(r)
    } finally {
      this.resolvingAuto = false
    }
  }

  /** Current state for the UI. */
  snapshot(): MatchSnapshot {
    const s = this.s
    const ph = s.teams.home.possession
    const pa = s.teams.away.possession
    const homePct = ph + pa > 0 ? Math.round((ph / (ph + pa)) * 100) : 50
    const heroStats = { ...s.hero.stats }
    heroStats.rating = s.hero.finalized ? s.hero.stats.rating : this.heroEverPlayed() ? roundRating(s.hero.ratingRaw) : 0
    const snap: MatchSnapshot = {
      minute: s.clock,
      score: [s.score[0], s.score[1]],
      possession: [homePct, 100 - homePct],
      shots: [s.teams.home.shots, s.teams.away.shots],
      shotsOnTarget: [s.teams.home.onTarget, s.teams.away.onTarget],
      events: s.events.slice(),
      ballX: s.ballX,
      finished: s.phase === 'done',
      phase: s.phase,
      heroOnPitch: this.heroOnPitch(),
      heroStats,
      pendingHighlight: s.pending?.highlight ?? null,
    }
    if (s.shootout) snap.penalties = [s.shootout.goals[0], s.shootout.goals[1]]
    if (s.hero.id) {
      snap.heroLog = (s.hero.log ?? []).map((e) => ({ ...e }))
      snap.passNet = Object.fromEntries(Object.entries(s.hero.passNet ?? {}).map(([k, v]) => [k, { ...v }]))
      snap.heroMap = { cols: HEAT_COLS, rows: HEAT_ROWS, heat: (s.hero.heat ?? emptyHeat()).map((v) => Math.round(v * 100) / 100), shots: (s.hero.shots ?? []).map((e) => ({ ...e })) }
    }
    return snap
  }

  /**
   * Runs to the final whistle. With `autoResolve` false it stops at the next
   * pending highlight (returned snapshot has `pendingHighlight` set).
   */
  simulateToEnd(autoResolveHighlights = true): MatchSnapshot {
    let guard = 0
    while (this.s.phase !== 'done' && guard++ < 1000) {
      if (this.s.pending) {
        if (!autoResolveHighlights) break
        this.skipHighlight()
        continue
      }
      this.step()
    }
    return this.snapshot()
  }

  /** Result summary for fixtures / career (valid once finished). */
  result(): MatchResultSummary {
    const s = this.s
    const res: MatchResultSummary = {
      home: s.score[0],
      away: s.score[1],
      scorers: s.scorers.map((x) => ({ ...x })),
    }
    if (s.shootout) res.penalties = { home: s.shootout.goals[0], away: s.shootout.goals[1] }
    if (s.hero.finalized && this.heroEverPlayed()) res.heroRating = s.hero.stats.rating
    if (s.motmId) res.motmId = s.motmId
    return res
  }

  /** JSON string of the complete state (setup, rng, events, counters). */
  serialize(): string {
    this.s.rng = this.rng.state
    return JSON.stringify(this.s)
  }

  /** Recreates a MatchSim from {@link serialize} output; continues identically. */
  static restore(data: string | EngineState): MatchSim {
    const state = (typeof data === 'string' ? JSON.parse(data) : structuredClone(data)) as EngineState
    if (state.v !== 1) throw new Error(`MatchSim.restore: unsupported version ${String(state.v)}`)
    const sim = Object.create(MatchSim.prototype) as MatchSim
    sim.s = state
    sim.rng = new Rng(state.rng)
    sim.out = []
    sim.indexPlayers()
    return sim
  }

  // ───────────────────────── Setup ─────────────────────────

  private initialState(setup: MatchSetup, lang: Lang, opts: MatchSimOptions): EngineState {
    const maxSubs = opts.maxSubs ?? 5
    const heroId = this.findHeroId(setup)
    const hero: HeroRuntime = {
      id: heroId,
      side: heroId ? setup.heroSide : null,
      stats: emptyHeroStats(),
      ratingRaw: RATING_BASE,
      plan: [],
      cap: 0,
      generated: 0,
      teamFactor: 1,
      oppFactor: 1,
      ignoredCount: 0,
      form: opts.heroForm ?? 50,
      trust: opts.managerTrust ?? 50,
      finalized: false,
      log: [],
      heat: emptyHeat(),
      shots: [],
      kinds: {},
      ...(setup.keeperBook ? { book: copyBook(setup.keeperBook) } : {}),
    }
    return {
      v: 1,
      setup: structuredClone(setup),
      lang,
      opts: { ...opts },
      rng: this.rng.state,
      started: false,
      period: 0,
      clock: 0,
      stoppage: -1,
      stoppageUsed: 0,
      periodEvents: 0,
      phase: 'first',
      score: [0, 0],
      events: [],
      scorers: [],
      ballX: 0.5,
      lastAttack: null,
      players: {},
      teams: { home: newTeam(setup.home, maxSubs), away: newTeam(setup.away, maxSubs) },
      hero,
      pending: null,
      shootout: null,
      seq: 0,
    }
  }

  private findHeroId(setup: MatchSetup): string | null {
    if (!setup.heroSide) return null
    const t = setup[setup.heroSide]
    return [...t.lineup, ...t.bench].find((p) => p.isHero)?.id ?? null
  }

  /** Builds lookup tables (not serialized; derived from setup). */
  private indexPlayers(): void {
    this.lookup = new Map()
    this.skills = new Map()
    this.tiredSkills = new Map()
    for (const side of ['home', 'away'] as const) {
      const t = this.s.setup[side]
      for (const p of [...t.lineup, ...t.bench]) {
        this.lookup.set(p.id, p)
        this.skills.set(p.id, unitSkills(p))
      }
    }
  }

  /** Slots, runtime players, AI plans and the hero's highlight plan. */
  private initMatch(): void {
    const s = this.s
    for (const side of ['home', 'away'] as const) {
      const team = s.setup[side]
      const slots = assignSlots(team.lineup, team.formation)
      team.lineup.forEach((p, i) => (s.players[p.id] = newPlayer(p.id, side, slots[i]!, true)))
      team.bench.forEach((p) => (s.players[p.id] = newPlayer(p.id, side, -1, false)))
      s.teams[side].aiSubsPlanned = Math.min(s.teams[side].subsLeft, this.rng.int(3, 5))
      s.teams[side].tilt = this.rng.normal(0, 0.035)
    }
    if (this.heroOnPitch()) this.planHero(1, 90)
  }

  // ───────────────────────── Helpers ─────────────────────────

  private flush(): MatchEvent[] {
    const o = this.out
    this.out = []
    return o
  }

  private team(side: Side): MatchTeam {
    return this.s.setup[side]
  }

  private player(id: string): MatchPlayer {
    const p = this.lookup.get(id)
    if (!p) throw new Error(`MatchSim: unknown player ${id}`)
    return p
  }

  /** Hero injury-risk multiplier (2.3#55): late fatigue, wet/frozen pitch, the opponents' tackling. */
  private heroInjuryRisk(): number {
    const id = this.s.hero.id
    const side = this.s.setup.heroSide
    if (!id || !side) return 1
    const ot = this.team(side === 'home' ? 'away' : 'home')
    const opp = [...ot.lineup, ...ot.bench].filter((p) => this.s.players[p.id]?.onPitch)
    const oppTackling = opp.length ? opp.reduce((t, p) => t + p.attrs.tackling, 0) / opp.length : 50
    const w = this.s.setup.weather
    return injuryRiskMultiplier({ fatigue: (this.s.players[id]?.fatigue ?? 0) * 100, surface: w === 'rain' ? 'wet' : w === 'snow' ? 'frozen' : 'dry', oppTackling })
  }

  private heroPlayer(): MatchPlayer | null {
    return this.s.hero.id ? this.player(this.s.hero.id) : null
  }

  private heroOnPitch(): boolean {
    const id = this.s.hero.id
    return !!id && !!this.s.players[id]?.onPitch
  }

  private heroEverPlayed(): boolean {
    const id = this.s.hero.id
    return !!id && !!this.s.players[id]?.played
  }

  private isHero(id: string | null | undefined): boolean {
    return !!id && id === this.s.hero.id
  }

  private scoreText(): string {
    const h = this.team('home').shortName
    const a = this.team('away').shortName
    return `${h} ${formatScore(this.s.score)} ${a}`
  }

  private say(key: CommentaryKey, vars: CommentaryVars): string {
    return commentary(key, this.s.lang, { score: this.scoreText(), ...vars }, this.rng, this.s.setup.gender)
  }

  private name(id: string | null | undefined): string {
    return id ? this.player(id).name : ''
  }

  private emit(type: MatchEventType, side: Side | null, text: string, extra: { playerId?: string; assistId?: string } = {}): void {
    const e: MatchEvent = { minute: this.s.clock, type, side, text, score: [this.s.score[0], this.s.score[1]] }
    if (extra.playerId) e.playerId = extra.playerId
    if (extra.assistId) e.assistId = extra.assistId
    this.s.events.push(e)
    this.out.push(e)
  }

  private teamVars(side: Side): CommentaryVars {
    return { team: this.team(side).name, opp: this.team(other(side)).name, hero: this.name(this.s.hero.id) }
  }

  private onPitch(side: Side): MatchPlayer[] {
    return this.s.teams[side].onPitch.map((id) => this.player(id))
  }

  private keeper(side: Side): MatchPlayer | undefined {
    const list = this.onPitch(side)
    return list.find((p) => p.position === 'GK') ?? list[0]
  }

  /** Weighted pick from on-pitch players (optionally excluding the hero and GKs). */
  private pickFrom(side: Side, weight: (p: MatchPlayer) => number, opts: { excludeHero?: boolean; exclude?: string } = {}): MatchPlayer | undefined {
    const pool = this.onPitch(side).filter(
      (p) => !(opts.excludeHero && this.isHero(p.id)) && p.id !== opts.exclude,
    )
    if (pool.length === 0) return undefined
    return this.rng.weighted(pool, weight)
  }

  // ───────────────────────── Strength ─────────────────────────

  /** Unit skills for this minute: after 70', players under 40% condition run on tired legs (GAP 2.1#12). */
  private unitSkillsNow(id: string): UnitSkills {
    if (!isLateTired(this.s.clock, this.s.players[id]!.fatigue)) return this.skills.get(id) as UnitSkills
    let t = this.tiredSkills.get(id)
    if (!t) {
      const p = this.player(id)
      t = unitSkills({ ...p, attrs: lateFatigueAttrs(p.attrs) })
      this.tiredSkills.set(id, t)
    }
    return t
  }

  private ratings(side: Side): TeamRatings {
    const rated = this.s.teams[side].onPitch.map((id) => ({
      position: this.player(id).position,
      skills: this.unitSkillsNow(id),
      fatigue: this.s.players[id]!.fatigue,
    }))
    const r = computeRatings(rated)
    const t = this.team(side)
    let m = 1 + (clamp(t.morale, 0.8, 1.2) - 1) * 0.3
    if (side === 'home' && !this.s.setup.neutralVenue) m *= HOME_ADVANTAGE
    return { gk: r.gk, def: r.def * m, mid: r.mid * m, att: r.att * m, n: r.n }
  }

  // ───────────────────────── Timeline ─────────────────────────

  private kickoff(): void {
    this.s.started = true
    this.emit('kickoff', null, this.say('kickoff', this.teamVars('home')))
  }

  private advanceClock(): void {
    const s = this.s
    if (s.clock < PERIOD_END[s.period]!) {
      const periodStart = s.period > 0 && s.clock === PERIOD_END[s.period - 1]
      s.clock++
      if (periodStart) this.announcePeriodStart()
      this.tickMinutes()
    } else {
      s.stoppageUsed++
    }
  }

  private announcePeriodStart(): void {
    if (this.s.period === 1) this.emit('commentary', null, this.say('secondHalf', this.teamVars('home')))
  }

  /** Minutes played for everyone on the pitch (regular minutes only). */
  private tickMinutes(): void {
    for (const side of ['home', 'away'] as const) {
      for (const id of this.s.teams[side].onPitch) this.s.players[id]!.minutes++
    }
    if (this.heroOnPitch()) {
      this.s.hero.stats.minutes++
      this.heroPresence()
    }
  }

  private maybeEndPeriod(): void {
    const s = this.s
    if (s.phase === 'done' || s.phase === 'shootout') return
    if (s.clock < PERIOD_END[s.period]!) return
    if (s.stoppage < 0) {
      s.stoppage = this.decideStoppage()
      return
    }
    if (s.stoppageUsed >= s.stoppage) this.endPeriod()
  }

  private decideStoppage(): number {
    const busy = Math.floor(this.s.periodEvents / 5)
    switch (this.s.period) {
      case 0:
        return Math.min(5, this.rng.int(1, 3) + busy)
      case 1:
        return Math.min(8, this.rng.int(2, 4) + busy)
      default:
        return Math.min(3, this.rng.int(0, 2))
    }
  }

  private startPeriod(period: number): void {
    const s = this.s
    s.period = period
    s.stoppage = -1
    s.stoppageUsed = 0
    s.periodEvents = 0
    s.ballX = 0.5
  }

  private endPeriod(): void {
    const s = this.s
    const level = s.score[0] === s.score[1]
    switch (s.period) {
      case 0:
        this.emit('halftime', null, this.say('halftime', this.teamVars('home')))
        s.phase = 'second'
        this.startPeriod(1)
        return
      case 1:
        if (s.setup.knockout && level) return this.startExtraTime()
        return this.finish()
      case 2:
        this.emit('commentary', null, this.say('extraHalf', this.teamVars('home')))
        this.startPeriod(3)
        return
      default:
        if (level) return this.startShootout()
        return this.finish()
    }
  }

  private startExtraTime(): void {
    this.emit('extratime', null, this.say('extratime', this.teamVars('home')))
    this.s.phase = 'extra'
    this.startPeriod(2)
    if (this.heroOnPitch()) {
      const n = this.rng.int(1, 2)
      const mins = planHighlightMinutes(92, 119, n, this.rng)
      this.s.hero.plan.push(...mins)
      this.s.hero.cap += mins.length
    }
  }

  private finish(): void {
    const s = this.s
    const [h, a] = s.score
    const winner: Side | null = s.shootout
      ? s.shootout.goals[0] > s.shootout.goals[1] ? 'home' : 'away'
      : h > a ? 'home' : a > h ? 'away' : null
    if (s.shootout && winner) {
      const sc = `${s.shootout.goals[0]}-${s.shootout.goals[1]}`
      this.emit('fulltime', winner, this.say('shootoutWin', { ...this.teamVars(winner), score: sc }))
    } else if (winner) {
      this.emit('fulltime', winner, this.say('fulltimeWin', this.teamVars(winner)))
    } else {
      this.emit('fulltime', null, this.say('fulltimeDraw', this.teamVars('home')))
    }
    s.phase = 'done'
    this.finalizeRatings(winner)
  }

  // ───────────────────────── Minute ─────────────────────────

  private playMinute(): void {
    const before = this.out.length
    this.updateFatigue()
    this.substitutions()
    if (this.tryPlannedHighlight()) return
    const att = this.possessionBattle()
    const def = other(att)
    this.maybeIgnoredRun(att)
    this.attack(att)
    if (this.s.pending) return
    this.fouls(def, att)
    if (this.s.pending) return
    this.injuries()
    this.heroBackground(att)
    if (this.out.length === before && this.rng.chance(FLAVOR_RATE)) {
      this.emit('commentary', att, this.say('flavor', this.teamVars(att)))
    }
  }

  private updateFatigue(): void {
    const w = WEATHER[this.s.setup.weather].fatigue
    for (const side of ['home', 'away'] as const) {
      const st = STYLES[this.team(side).style].fatigue
      for (const id of this.s.teams[side].onPitch) {
        const p = this.player(id)
        const rate = p.position === 'GK' ? 0.003 : 0.0085 * (1.3 - p.attrs.stamina / 100)
        const r = this.s.players[id]!
        r.fatigue = Math.min(1, r.fatigue + Math.max(0.001, rate) * st * w)
      }
    }
  }

  /** Possession share for this minute; returns the side in possession. */
  private possessionBattle(): Side {
    const rh = this.ratings('home')
    const ra = this.ratings('away')
    const ch = Math.pow(rh.mid * STYLES[this.team('home').style].control, 2.2)
    const ca = Math.pow(ra.mid * STYLES[this.team('away').style].control, 2.2)
    const tilt = this.s.teams.home.tilt - this.s.teams.away.tilt
    const pHome = clamp(ch / (ch + ca) + tilt, 0.22, 0.78)
    this.s.teams.home.possession += pHome
    this.s.teams.away.possession += 1 - pHome
    return this.rng.chance(pHome) ? 'home' : 'away'
  }

  private gameStateFactor(side: Side): number {
    if (this.s.clock < 60) return 1
    const diff = this.s.score[idx(side)] - this.s.score[idx(other(side))]
    return diff < 0 ? 1.12 : diff > 0 ? 0.92 : 1
  }

  /** Chance-rate compensation while the hero (whose highlights add chances) is on. */
  private heroFactor(att: Side): number {
    if (!this.heroOnPitch()) return 1
    return att === this.s.hero.side ? this.s.hero.teamFactor : this.s.hero.oppFactor
  }

  private chanceRate(att: Side, ra: TeamRatings, rd: TeamRatings): number {
    const def = other(att)
    const ratio = ra.att / Math.max(1, rd.def)
    return (
      BASE_CHANCE *
      Math.pow(ratio, CHANCE_EXPONENT) *
      STYLES[this.team(att).style].tempo *
      STYLES[this.team(def).style].concede *
      WEATHER[this.s.setup.weather].passing *
      this.gameStateFactor(att) *
      this.heroFactor(att) *
      momentumFactor(this.s.momentum, att, this.s.clock)
    )
  }

  private attack(att: Side): void {
    const ra = this.ratings(att)
    const rd = this.ratings(other(att))
    const counter = this.s.lastAttack !== null && this.s.lastAttack !== att
    this.s.lastAttack = att
    const q = this.chanceRate(att, ra, rd)
    const ratio = ra.att / Math.max(1, rd.def)
    const r = this.rng.next()
    this.s.ballX = this.drift(att, 0.15)
    if (r < q) return this.openPlayShot(att, counter)
    if (r < q + OFFSIDE_RATE) return this.offside(att)
    if (r < q + OFFSIDE_RATE + PENALTY_RATE * Math.pow(ratio, 1.5)) return this.penaltyAwarded(att)
    if (r < q + OFFSIDE_RATE + PENALTY_RATE + CORNER_RATE) this.corner(att, null)
  }

  /** Moves the radar ball toward the attacked goal by `amount` (0..1 scale). */
  private drift(att: Side, amount: number): number {
    const target = att === 'home' ? 0.75 : 0.25
    return clamp(this.s.ballX + (target - this.s.ballX) * 0.5 + this.rng.range(-amount, amount), 0.02, 0.98)
  }

  private pickShotType(att: Side, counter: boolean): ShotType {
    const style = this.team(att).style
    const w: Record<'long' | 'open' | 'header' | 'big', number> = { long: 0.32, open: 0.42, header: 0.15, big: 0.11 }
    if (counter) w.big *= 1.3 * STYLES[style].counter
    if (style === 'direct') {
      w.header *= 1.5
      w.long *= 1.2
    }
    if (style === 'possession') {
      w.open *= 1.2
      w.long *= 0.8
    }
    const types = ['long', 'open', 'header', 'big'] as const
    return this.rng.weighted(types, (t) => w[t])
  }

  private openPlayShot(att: Side, counter: boolean): void {
    const type = this.pickShotType(att, counter)
    const shooter = this.pickShooter(att, type === 'header')
    if (!shooter) return
    if (type === 'big' || this.rng.chance(0.2)) {
      const passer = this.pickFrom(att, (p) => ASSIST_WEIGHT[p.position], { excludeHero: true, exclude: shooter.id })
      this.emit('chance', att, this.say('chance', { ...this.teamVars(att), player: shooter.name, passer: passer?.name ?? shooter.name }), { playerId: shooter.id })
    }
    const xg = SHOT_XG[type] * STYLES[this.team(att).style].quality * STYLES[this.team(other(att)).style].concedeQuality * this.rng.range(0.7, 1.3)
    this.resolveShot(att, shooter, xg, type)
  }

  private pickShooter(att: Side, header: boolean): MatchPlayer | undefined {
    return this.pickFrom(
      att,
      (p) => (header ? HEAD_WEIGHT[p.position] * (p.attrs.heading + 10) : SHOOT_WEIGHT[p.position] * (p.attrs.finishing + p.attrs.shooting + 20)),
      { excludeHero: true },
    )
  }

  private shooterSkill(p: MatchPlayer, type: ShotType): number {
    const a = p.attrs
    if (type === 'header') return a.heading * 0.7 + a.jumping * 0.3
    if (type === 'fk') return freekickSkill(a)
    if (type === 'pen') return penaltySkill(a)
    // Long range: power and bend (curve); in the box: finishing, composure and arriving first (anticipation).
    if (type === 'long') return a.shooting * 0.55 + a.curve * 0.15 + a.composure * 0.3
    return a.finishing * 0.55 + a.composure * 0.35 + a.anticipation * 0.1
  }

  /** Resolves a shot: goal, save, block, woodwork or miss (with follow-up corners). */
  private resolveShot(att: Side, shooter: MatchPlayer, xg: number, type: ShotType, allowCorner = true): void {
    const def = other(att)
    const team = this.s.teams[att]
    const gk = this.keeper(def)
    const w = WEATHER[this.s.setup.weather]
    const gkv = skillMult(this.ratings(def).gk)
    const fin = skillMult(this.shooterSkill(shooter, type))
    const pGoal = clamp((xg * fin * w.accuracy * w.keeperError) / gkv, 0.005, 0.95)
    team.shots++
    this.s.ballX = att === 'home' ? 0.9 : 0.1
    if (this.rng.chance(pGoal) && !this.braked(att)) {
      team.onTarget++
      this.s.players[shooter.id]!.shotsOnTarget++
      const assist = this.pickAssist(att, shooter.id, type)
      if (this.rng.chance(0.015) && type !== 'pen') {
        const og = this.pickFrom(def, (p) => (positionGroup(p.position) === 1 ? 3 : 0.5), { excludeHero: true })
        if (og) return this.applyGoal(att, og.id, null, { ownGoal: true })
      }
      return this.applyGoal(att, shooter.id, assist, {})
    }
    this.nonGoalShot(att, shooter, gk, type, allowCorner)
  }

  private pickAssist(att: Side, shooterId: string, type: ShotType): string | null {
    if (type === 'pen' || type === 'fk' || !this.rng.chance(0.75)) return null
    const p = this.pickFrom(att, (x) => ASSIST_WEIGHT[x.position] * (x.attrs.passing + x.attrs.vision + 20), { excludeHero: true, exclude: shooterId })
    return p?.id ?? null
  }

  private nonGoalShot(att: Side, shooter: MatchPlayer, gk: MatchPlayer | undefined, type: ShotType, allowCorner: boolean): void {
    const def = other(att)
    const vars = { ...this.teamVars(att), player: shooter.name, gk: gk?.name ?? '' }
    const u = this.rng.next()
    const blockP = type === 'header' || type === 'pen' ? 0.05 : 0.24
    if (u < blockP) {
      this.emit('shot', att, this.say('blocked', vars), { playerId: shooter.id })
      if (allowCorner && this.rng.chance(0.35)) this.corner(att, null)
      return
    }
    if (u < blockP + 0.03) {
      this.emit('woodwork', att, this.say('woodwork', vars), { playerId: shooter.id })
      return
    }
    if (u < blockP + 0.03 + 0.3) {
      this.s.teams[att].onTarget++
      this.s.players[shooter.id]!.shotsOnTarget++
      if (gk) this.recordSave(def, gk.id)
      this.emit('save', att, this.say('save', vars), { playerId: shooter.id })
      if (allowCorner && this.rng.chance(0.3)) this.corner(att, null)
      return
    }
    this.emit('miss', att, this.say('miss', vars), { playerId: shooter.id })
  }

  private recordSave(side: Side, gkId: string): void {
    this.s.players[gkId]!.saves++
    if (this.isHero(gkId) && this.s.hero.side === side) {
      this.s.hero.stats.saves++
      this.rate(0.05, { source: 'background', key: 'save' })
    }
  }

  private corner(att: Side, takerId: string | null): void {
    this.s.teams[att].corners++
    const taker = takerId ? this.player(takerId) : this.pickFrom(att, (p) => p.attrs.crossing + p.attrs.setPieces + 1, { excludeHero: true })
    // The hero takes the dangerous corners when he is the designated taker (2.1#97).
    const heroTakes = !takerId && this.heroTakes(att, (p) => cornerSkill(p.attrs))
    this.emit('corner', att, this.say('corner', { ...this.teamVars(att), player: heroTakes ? this.name(this.s.hero.id) : taker?.name ?? '' }))
    if (!this.rng.chance(0.22)) return
    if (heroTakes && this.canSetPieceHighlight()) return this.createHighlight('corner_kick', 'setpiece')
    const header = this.pickShooter(att, true)
    if (!header) return
    this.emit('commentary', att, this.say('cornerHeader', { ...this.teamVars(att), player: header.name }), { playerId: header.id })
    this.resolveShot(att, header, SHOT_XG.header * this.rng.range(0.7, 1.3), 'header', false)
  }

  private offside(att: Side): void {
    const p = this.pickFrom(att, (x) => SHOOT_WEIGHT[x.position], { excludeHero: true })
    this.emit('offside', att, this.say('offside', { ...this.teamVars(att), player: p?.name ?? '' }), { playerId: p?.id })
  }

  // ───────────────────────── Goals ─────────────────────────

  private applyGoal(side: Side, scorerId: string, assistId: string | null, flags: { penalty?: boolean; ownGoal?: boolean }): void {
    const s = this.s
    s.score[idx(side)]++
    s.periodEvents++
    s.ballX = 0.5
    s.lastAttack = null
    const scorerRt = s.players[scorerId]!
    if (flags.ownGoal) scorerRt.ownGoals++
    else scorerRt.goals++
    if (assistId && !flags.ownGoal) s.players[assistId]!.assists++
    s.scorers.push({
      minute: s.clock,
      playerId: scorerId,
      team: side,
      ...(flags.ownGoal ? { ownGoal: true } : {}),
      ...(flags.penalty ? { penalty: true } : {}),
    })
    this.heroGoalBookkeeping(side, scorerId, assistId, !!flags.ownGoal)
    const key: CommentaryKey = flags.ownGoal ? 'ownGoal' : flags.penalty ? 'penaltyGoal' : assistId && this.rng.chance(0.6) ? 'goalAssist' : 'goal'
    const vars = { ...this.teamVars(side), player: this.name(scorerId), assist: this.name(assistId) }
    this.emit('goal', side, this.say(key, vars), { playerId: scorerId, ...(assistId ? { assistId } : {}) })
  }

  private heroGoalBookkeeping(side: Side, scorerId: string, assistId: string | null, ownGoal: boolean): void {
    const h = this.s.hero
    if (!h.id) return
    if (!ownGoal && scorerId === h.id) h.stats.goals++
    if (!ownGoal && assistId === h.id) h.stats.assists++
    if (!this.heroOnPitch()) return
    const pos = this.player(h.id).position
    this.rate(teamGoalRatingDelta(pos, side === h.side), { source: 'team', key: side === h.side ? 'goalFor' : 'goalAgainst' })
  }

  // ───────────────────────── Set pieces ─────────────────────────

  /** Best taker on the pitch by a skill function. */
  private bestBy(side: Side, f: (p: MatchPlayer) => number): MatchPlayer | undefined {
    let best: MatchPlayer | undefined
    for (const p of this.onPitch(side)) if (p.position !== 'GK' && (!best || f(p) > f(best))) best = p
    return best
  }

  /** The hero takes a set piece if within 5% of the best taker on the pitch. */
  private heroTakes(side: Side, f: (p: MatchPlayer) => number): boolean {
    const hero = this.heroPlayer()
    if (!hero || this.s.hero.side !== side || !this.heroOnPitch() || hero.position === 'GK') return false
    const best = this.bestBy(side, f)
    return !!best && f(hero) >= f(best) * 0.95
  }

  private heroIsKeeperFor(side: Side): boolean {
    const hero = this.heroPlayer()
    return !!hero && this.s.hero.side === side && this.heroOnPitch() && hero.position === 'GK'
  }

  /** The hero sets the wall for his team: he is the keeper, or the captain on the pitch. */
  private heroOrganisesWall(side: Side): boolean {
    if (this.heroIsKeeperFor(side)) return true
    return !!this.s.setup.heroCaptain && this.s.hero.side === side && this.heroOnPitch()
  }

  private canSetPieceHighlight(): boolean {
    const h = this.s.hero
    const remaining = h.plan.filter((m) => m > this.s.clock).length
    return h.generated + remaining < h.cap
  }

  private penaltyAwarded(att: Side): void {
    const fouled = this.pickFrom(att, (p) => SHOOT_WEIGHT[p.position] + 0.2, {})
    this.s.periodEvents++
    this.emit('penalty', att, this.say('penaltyAwarded', { ...this.teamVars(att), player: fouled?.name ?? '' }), { playerId: fouled?.id })
    if (this.canSetPieceHighlight()) {
      if (this.heroTakes(att, (p) => penaltySkill(p.attrs))) return this.createHighlight('penalty', 'setpiece')
      if (this.heroIsKeeperFor(other(att))) return this.createHighlight('gk_penalty', 'setpiece')
    }
    this.simPenalty(att)
  }

  private simPenalty(att: Side): void {
    const taker = this.bestBy(att, (p) => (this.isHero(p.id) ? -1 : penaltySkill(p.attrs)))
    if (!taker) return
    const gk = this.keeper(other(att))
    const p = clamp(0.76 * Math.sqrt(skillMult(penaltySkill(taker.attrs))) / Math.pow(skillMult(this.ratings(other(att)).gk), 0.4), 0.55, 0.92)
    this.s.teams[att].shots++
    if (this.rng.chance(p) && !this.braked(att)) {
      this.s.teams[att].onTarget++
      return this.applyGoal(att, taker.id, null, { penalty: true })
    }
    const saved = this.rng.chance(0.7)
    if (saved && gk) {
      this.s.teams[att].onTarget++
      this.recordSave(other(att), gk.id)
    }
    this.emit(saved ? 'save' : 'miss', att, this.say('penaltyMiss', { ...this.teamVars(att), player: taker.name, gk: gk?.name ?? '' }), { playerId: taker.id })
  }

  // ───────────────────────── Fouls, cards, injuries ─────────────────────────

  private fouls(def: Side, att: Side): void {
    if (!this.rng.chance(FOUL_RATE * STYLES[this.team(def).style].fouls * refFoulMult(this.s.setup.referee?.strictness))) return
    this.s.teams[def].fouls++
    // Aggressive players commit (and get booked for) more of the fouls; composure keeps them in check.
    const fouler = this.pickFrom(def, (p) => FOUL_WEIGHT[p.position] * (110 - p.attrs.composure) * (0.5 + p.attrs.aggression / 100), { excludeHero: true })
    if (fouler) this.maybeCard(def, fouler)
    if (!this.rng.chance(DANGEROUS_FOUL)) return
    const fouled = this.pickFrom(att, (p) => SHOOT_WEIGHT[p.position] + 0.3, {})
    this.emit('freekick', att, this.say('freekick', { ...this.teamVars(att), player: fouled?.name ?? '' }), { playerId: fouled?.id })
    if (!this.rng.chance(FK_SHOT_CHANCE)) return
    if (this.heroTakes(att, (p) => freekickSkill(p.attrs)) && this.canSetPieceHighlight()) {
      return this.createHighlight('freekick', 'setpiece')
    }
    // Free kick against: the hero in goal, or the captain, sets the wall (2.1#95).
    if (this.heroOrganisesWall(def) && this.canSetPieceHighlight()) return this.createHighlight('fk_wall', 'setpiece')
    const taker = this.bestBy(att, (p) => (this.isHero(p.id) ? -1 : freekickSkill(p.attrs)))
    if (taker) this.resolveShot(att, taker, SHOT_XG.fk * this.rng.range(0.7, 1.3), 'fk')
  }

  private maybeCard(side: Side, p: MatchPlayer): void {
    const r = this.rng.next()
    // The referee's strictness scales both colours (strictness 3 / no referee = 1).
    const m = refCardMult(this.s.setup.referee?.strictness)
    const red = RED_PER_FOUL * m
    if (r < red) return this.sendOff(side, p.id, 'red', backgroundRedReason(`${p.id}:${this.s.clock}:${this.s.seq}`))
    // Booked players tread carefully: far less likely to pick up a second yellow.
    const yellow = YELLOW_PER_FOUL * m * (this.s.players[p.id]!.yellow > 0 ? 0.35 : 1)
    if (r < red + yellow) this.book(side, p.id)
  }

  /** Yellow card; a second yellow becomes a red. */
  private book(side: Side, id: string): void {
    const rt = this.s.players[id]!
    rt.yellow++
    this.s.periodEvents++
    if (this.isHero(id)) this.s.hero.stats.yellow++
    if (rt.yellow >= 2) return this.sendOff(side, id, 'secondYellow')
    this.emit('yellow', side, this.say('yellow', { ...this.teamVars(side), player: this.name(id) }), { playerId: id })
  }

  private sendOff(side: Side, id: string, key: 'red' | 'secondYellow', reason: RedReason = key === 'secondYellow' ? 'secondYellow' : 'serious'): void {
    const rt = this.s.players[id]!
    rt.red = true
    // Ban for the coming matches (1..3), applied by the career layer.
    rt.ban = banMatches(key === 'secondYellow' ? 'secondYellow' : reason, this.s.setup.referee?.strictness)
    this.s.periodEvents++
    if (this.isHero(id)) {
      this.s.hero.stats.red++
      this.s.hero.stats.ban = rt.ban
    }
    this.emit('red', side, this.say(key, { ...this.teamVars(side), player: this.name(id) }), { playerId: id })
    const wasKeeper = this.player(id).position === 'GK'
    this.removeFromPitch(side, id)
    if (wasKeeper) this.replaceKeeper(side)
  }

  /** After a keeper's red card, bring on the bench keeper for an outfielder. */
  private replaceKeeper(side: Side): void {
    const t = this.s.teams[side]
    const benchGk = t.bench.find((b) => this.player(b).position === 'GK' && !this.s.players[b]!.gone)
    if (!benchGk || t.subsLeft <= 0) return
    const victim = this.onPitch(side)
      .filter((p) => !this.isHero(p.id) && positionGroup(p.position) === 3)
      .sort((a, b) => a.ovr - b.ovr)[0]
    if (victim) this.substitute(side, victim.id, benchGk)
  }

  private removeFromPitch(side: Side, id: string): void {
    const t = this.s.teams[side]
    t.onPitch = t.onPitch.filter((x) => x !== id)
    const rt = this.s.players[id]!
    rt.onPitch = false
    rt.gone = true
    rt.slot = -1
  }

  private injuries(): void {
    if (!this.rng.chance(INJURY_RATE)) return
    const side: Side = this.rng.chance(0.5) ? 'home' : 'away'
    const victim = this.pickFrom(side, () => 1, { excludeHero: true })
    if (!victim) return
    this.s.periodEvents++
    this.emit('injury', side, this.say('injury', { ...this.teamVars(side), player: victim.name }), { playerId: victim.id })
    this.replaceInjured(side, victim.id)
  }

  private replaceInjured(side: Side, id: string): void {
    const t = this.s.teams[side]
    const p = this.player(id)
    const sub = t.subsLeft > 0 ? this.bestBenchFor(side, p.position) : undefined
    if (sub) this.substitute(side, id, sub)
    else this.removeFromPitch(side, id)
  }

  // ───────────────────────── Substitutions ─────────────────────────

  /** Best available bench player for a position (never the hero). */
  private bestBenchFor(side: Side, pos: Position): string | undefined {
    const t = this.s.teams[side]
    const avail = t.bench.filter((b) => !this.isHero(b) && !this.s.players[b]!.gone && !this.s.players[b]!.onPitch)
    const fit = (b: string) => {
      const bp = this.player(b).position
      if ((bp === 'GK') !== (pos === 'GK')) return -1000
      return (bp === pos ? 30 : positionGroup(bp) === positionGroup(pos) ? 15 : 0) + this.player(b).ovr
    }
    let best: string | undefined
    for (const b of avail) if (fit(b) > -1000 && (!best || fit(b) > fit(best))) best = b
    return best
  }

  private substitute(side: Side, outId: string, inId: string): void {
    const t = this.s.teams[side]
    const outRt = this.s.players[outId]!
    const inRt = this.s.players[inId]!
    inRt.slot = outRt.slot
    inRt.onPitch = true
    inRt.played = true
    t.onPitch = t.onPitch.map((x) => (x === outId ? inId : x))
    t.bench = t.bench.filter((x) => x !== inId)
    outRt.onPitch = false
    outRt.gone = true
    outRt.slot = -1
    t.subsLeft--
    this.s.periodEvents++
    const vars = { ...this.teamVars(side), player: this.name(inId), out: this.name(outId) }
    if (this.isHero(inId)) {
      this.emit('sub', side, this.say('heroSubOn', vars), { playerId: inId })
      this.onHeroEntered()
    } else if (this.isHero(outId)) {
      this.emit('sub', side, this.say('heroSubOff', vars), { playerId: inId })
      this.s.hero.plan = []
    } else {
      this.emit('sub', side, this.say('sub', vars), { playerId: inId })
    }
  }

  private substitutions(): void {
    if (this.s.period < 1 || this.s.clock < 55) return
    for (const side of ['home', 'away'] as const) {
      this.heroBenchEntry(side)
      this.heroSubOff(side)
      this.aiSub(side)
    }
  }

  private aiSub(side: Side): void {
    const t = this.s.teams[side]
    if (this.s.clock < 58 || t.subsLeft <= 0 || t.aiSubsMade >= t.aiSubsPlanned) return
    const urgency = this.s.clock >= 75 ? 0.14 : 0.06
    if (!this.rng.chance(urgency)) return
    const candidates = this.onPitch(side).filter((p) => p.position !== 'GK' && !this.isHero(p.id))
    if (candidates.length === 0) return
    const tired = candidates.reduce((a, b) => (this.subNeed(a) >= this.subNeed(b) ? a : b))
    const inId = this.bestBenchFor(side, tired.position)
    if (!inId) return
    t.aiSubsMade++
    this.substitute(side, tired.id, inId)
  }

  private subNeed(p: MatchPlayer): number {
    const rt = this.s.players[p.id]!
    return rt.fatigue + rt.yellow * 0.15 - p.ovr / 400
  }

  private heroBenchEntry(side: Side): void {
    const h = this.s.hero
    if (!h.id || h.side !== side || !this.s.setup.heroOnBench) return
    const rt = this.s.players[h.id]!
    if (rt.onPitch || rt.gone || this.s.clock > 80 || this.s.period > 1) return
    const t = this.s.teams[side]
    if (t.subsLeft <= 0) return
    const hero = this.player(h.id)
    if (hero.position === 'GK') return
    const diff = this.s.score[idx(side)] - this.s.score[idx(other(side))]
    const hazard = 0.045 * (0.5 + h.trust / 100) * (diff < 0 ? 1.5 : diff > 0 ? 0.8 : 1)
    if (!this.rng.chance(hazard)) return
    const out = this.onPitch(side)
      .filter((p) => p.position !== 'GK' && positionGroup(p.position) === positionGroup(hero.position))
      .sort((a, b) => this.subNeed(b) - this.subNeed(a))[0]
      ?? this.onPitch(side).filter((p) => p.position !== 'GK').sort((a, b) => this.subNeed(b) - this.subNeed(a))[0]
    if (out) this.substitute(side, out.id, h.id)
  }

  private heroSubOff(side: Side): void {
    const h = this.s.hero
    if (!h.id || h.side !== side || !this.heroOnPitch() || this.s.clock < 65 || this.s.period > 1) return
    const t = this.s.teams[side]
    if (t.subsLeft <= 0) return
    const hero = this.player(h.id)
    if (hero.position === 'GK') return
    const poor = h.ratingRaw < 5.5 ? 0.03 : 0
    const tired = this.s.players[h.id]!.fatigue > 0.75 ? 0.015 : 0
    if (!this.rng.chance((poor + tired) * (1.5 - h.trust / 100))) return
    const inId = this.bestBenchFor(side, hero.position)
    if (inId) this.substitute(side, h.id, inId)
  }

  // ───────────────────────── Hero ─────────────────────────

  private teammateRelationAvg(): number {
    const h = this.s.hero
    if (!h.side || !h.id) return 0
    const mates = this.onPitch(h.side).filter((p) => p.id !== h.id)
    if (mates.length === 0) return 0
    return mates.reduce((a, p) => a + p.relationToHero, 0) / mates.length
  }

  /** Plans open-play highlights for the window [fromMinute, 90]. */
  private planHero(fromMinute: number, toMinute: number): void {
    const h = this.s.hero
    const hero = this.heroPlayer()
    if (!hero || !h.side) return
    const minutes = toMinute - fromMinute + 1
    const n = plannedHighlightCount(
      {
        position: hero.position, relationAvg: this.teammateRelationAvg(), morale: this.team(h.side).morale, form: h.form, minutes, ovr: hero.ovr,
        ...(hero.marked ? { marked: hero.marked } : {}),
        positioning: hero.attrs.positioning, ...(this.s.opts.heroFocus ? { focus: this.s.opts.heroFocus } : {}),
        ...(hero.role ? { role: hero.role } : {}),
      },
      this.rng,
    )
    h.plan = planHighlightMinutes(Math.max(2, fromMinute + 1), Math.min(88, toMinute - 2), n, this.rng, [45, 46])
    h.cap = h.generated + (minutes >= 89 ? Math.min(HIGHLIGHTS_MAX_90, h.plan.length + 2) : h.plan.length + 1)
    this.computeHeroFactors(hero, h.plan.length, minutes)
  }

  /** Compensates team chance rates for the goals highlights are expected to add. */
  private computeHeroFactors(hero: MatchPlayer, n: number, minutes: number): void {
    const w = kindWeights(hero.position, hero.ovr, hero.marked ?? 0, hero.role)
    let total = 0
    let gf = 0
    let ga = 0
    for (const [kind, weight] of Object.entries(w) as [HighlightKind, number][]) {
      const p = outcomeProbabilities(kind, hero.attrs, this.s.setup.difficulty)
      gf += weight * ((p.goal ?? 0) + (p.assist ?? 0))
      ga += weight * (p.conceded ?? 0)
      total += weight
    }
    const expected = (EXPECTED_TEAM_GOALS_90 * minutes) / 90
    const h = this.s.hero
    // Floors keep the team's own play alive; a keeper hero faces most of the
    // opponent's on-target shots as highlights, so that side may drop lower.
    h.teamFactor = clamp(1 - (n * gf) / total / expected, 0.4, 1)
    h.oppFactor = clamp(1 - (n * ga) / total / expected, 0.15, 1)
  }

  private onHeroEntered(): void {
    if (this.s.clock < 88) this.planHero(this.s.clock, 90)
  }

  private tryPlannedHighlight(): boolean {
    const h = this.s.hero
    if (!this.heroOnPitch() || this.s.stoppageUsed > 0 || !h.plan.includes(this.s.clock)) return false
    const hero = this.heroPlayer() as MatchPlayer
    const side = h.side as Side
    const diff = this.s.score[idx(side)] - this.s.score[idx(other(side))]
    const slotsLeft = h.plan.filter((m) => m >= this.s.clock).length
    const forced = hero.position === 'GK' ? null : guaranteedKind(hero.position, h.kinds ?? {}, slotsLeft, this.rng, hero.role)
    // Keepers draw from their own pool (save / 1v1 / sweep, plan 2.1#85).
    const kind = forced ?? pickHighlightKind(hero.position, this.rng, diff, this.s.clock, h.stats.goals, hero.ovr, hero.marked ?? 0, hero.role)
    const att = isDefensiveKind(kind) ? other(side) : side
    const share = att === 'home' ? 0.6 : 0.4
    this.s.teams.home.possession += share
    this.s.teams.away.possession += 1 - share
    this.s.lastAttack = att
    this.createHighlight(kind, 'open')
    return true
  }

  /**
   * On-pitch players with their slots. With `tired`, players running on empty
   * late on (after 70', condition under 40%) lose 10% pace and first touch.
   */
  private slotPlayers(side: Side, tired = false): SlotPlayer[] {
    return this.s.teams[side].onPitch.map((id) => {
      const p = this.player(id)
      const player = tired && isLateTired(this.s.clock, this.s.players[id]!.fatigue) ? { ...p, attrs: lateFatigueAttrs(p.attrs) } : p
      return { player, slot: Math.max(0, this.s.players[id]!.slot) }
    })
  }

  /** Early score brake for a background goal by `att` (see fairness.ts). */
  private braked(att: Side): boolean {
    const s = this.s
    if (s.clock > EARLY_BRAKE_MINUTE || !s.hero.id) return false
    return earlyBrake(s.clock, s.hero.generated, this.heroOnPitch(), s.score[idx(att)], s.score[idx(other(att))])
  }

  private createHighlight(kindIn: HighlightKind, context: PendingRuntime['context']): void {
    const h = this.s.hero
    const side = h.side as Side
    const opp = other(side)
    let kind = kindIn
    const build = (k: HighlightKind) => buildScenario({
      kind: k,
      heroSide: side,
      heroId: h.id as string,
      mates: this.slotPlayers(side, true),
      opps: this.slotPlayers(opp, true),
      mateFormation: this.team(side).formation,
      oppFormation: this.team(opp).formation,
      lang: this.s.lang,
      rng: this.rng,
    })
    let gen = build(kind)
    if (context === 'open') {
      // Fairness: no near-impossible moments. Re-roll the layout, then fall back to keeping the ball.
      const attrs = this.player(h.id as string).attrs
      const chance = (g: typeof gen, k: HighlightKind) => momentChance(k, g.scenario, attrs, this.s.setup.difficulty)
      for (let i = 0; i < 2 && chance(gen, kind) < MIN_MOMENT_CHANCE; i++) gen = build(kind)
      if (chance(gen, kind) < MIN_MOMENT_CHANCE && kind !== 'build_up' && !KEEPER_KINDS.has(kind)) {
        kind = 'build_up'
        gen = build(kind)
      }
      const counts = (h.kinds ??= {})
      counts[kind] = (counts[kind] ?? 0) + 1
    }
    this.s.seq++
    if (context !== 'shootout') h.generated++
    const highlight: Highlight = {
      id: `hl-${this.s.setup.seed >>> 0}-${this.s.seq}`,
      minute: this.s.clock,
      side,
      kind,
      scenario: gen.scenario,
      score: [this.s.score[0], this.s.score[1]],
    }
    const ref = this.s.setup.referee
    if (ref) highlight.referee = { strictness: ref.strictness, advantage: ref.advantage }
    if (h.book) highlight.keeperBook = copyBook(h.book)
    this.s.pending = { highlight, passerId: gen.passerId, finisherId: gen.finisherId, opponentId: gen.opponentId, context }
    const heroX = isDefensiveKind(kind) ? 0.2 : 0.75
    this.s.ballX = side === 'home' ? heroX : 1 - heroX
    this.emit('highlight', side, this.say('highlight', this.teamVars(side)), { playerId: h.id as string })
  }

  private maybeIgnoredRun(att: Side): void {
    const h = this.s.hero
    if (att !== h.side || !this.heroOnPitch() || h.ignoredCount >= 4) return
    const hero = this.heroPlayer() as MatchPlayer
    if (hero.position === 'GK') return
    const passer = this.pickFrom(att, () => 1, { excludeHero: true })
    if (!passer || passer.relationToHero >= -25) return
    if (!this.rng.chance((-passer.relationToHero / 100) * 0.05)) return
    h.ignoredCount++
    this.emit('commentary', att, this.say('heroIgnored', { ...this.teamVars(att), passer: passer.name }), { playerId: passer.id })
  }

  /** Low-level involvement between highlights: passes, tackles, dribbles. */
  private heroBackground(att: Side): void {
    const h = this.s.hero
    if (!this.heroOnPitch() || !h.side) return
    const hero = this.heroPlayer() as MatchPlayer
    const inPossession = att === h.side
    const rel = 0.75 + 0.25 * (1 + this.teammateRelationAvg() / 100)
    const rate = HERO_PASS_RATE[hero.position] * rel * (inPossession ? 1.4 : 0.6)
    const attempts = (this.rng.next() < rate ? 1 : 0) + (this.rng.next() < rate * 0.4 ? 1 : 0)
    // Most of a player's passes are short; long passing carries the switches and balls over the top.
    const pComplete = clamp(0.55 + (hero.attrs.passing * 0.75 + hero.attrs.longPassing * 0.25) * 0.0035, 0.5, 0.93)
    for (let i = 0; i < attempts; i++) {
      h.stats.passes++
      if (this.rng.chance(pComplete)) h.stats.passesCompleted++
    }
    // Pass telemetry (hash-based, no RNG draws): never influences the simulation.
    backgroundPasses(
      (h.passNet ??= {}),
      this.onPitch(h.side).filter((p) => p.id !== h.id).map((p) => ({ id: p.id, relation: p.relationToHero })),
      this.s.setup.seed >>> 0,
      `${this.s.period}:${this.s.clock}:${this.s.stoppageUsed}`,
      inPossession,
      attempts,
    )
    const g = positionGroup(hero.position)
    // Ball-winning: aggression (going into the duel) and anticipation (reading the pass) both win it back; 50/50 = 4 %.
    const win = 0.04 * (0.55 + hero.attrs.aggression * 0.005 + hero.attrs.anticipation * 0.004)
    if (!inPossession && (g === 1 || hero.position === 'DM') && this.rng.chance(win)) h.stats.tackles++
    if (inPossession && g === 3 && this.rng.chance(0.02)) h.stats.dribbles++
  }

  // ───────────────────────── Highlight resolution ─────────────────────────

  private applyHighlight(p: PendingRuntime, r: HighlightResult): void {
    const h = this.s.hero
    const kind = p.highlight.kind
    h.stats.highlightsPlayed++
    h.stats.passes += r.passes
    mergePassNet((h.passNet ??= {}), r.passNet)
    h.stats.passesCompleted += Math.min(r.passes, r.passesCompleted)
    h.stats.shots += r.shots
    h.stats.shotsOnTarget += Math.min(r.shots, r.shotsOnTarget)
    h.stats.dribbles += r.dribbles
    h.stats.tackles += r.tackles
    const entry: Omit<RatingLogEntry, 'minute' | 'delta'> = { source: 'moment', key: r.outcome, kind, outcome: r.outcome }
    if (this.resolvingAuto) entry.auto = true
    this.rate(highlightRatingDelta(kind, r), entry)
    this.recordMomentMap(p, r)
    this.noteHeroShots(r)
    const before: [number, number] = [this.s.score[0], this.s.score[1]]
    if (p.context === 'shootout') this.applyShootoutHighlight(p, r)
    else if (isDefensiveKind(kind)) this.applyDefensiveOutcome(p, r)
    else this.applyAttackingOutcome(p, r)
    if (p.context !== 'shootout') {
      // A goal in the hero's moment swings the next minutes (GAP 2.1#2).
      if (this.s.score[0] > before[0]) this.s.momentum = { side: 'home', from: this.s.clock }
      else if (this.s.score[1] > before[1]) this.s.momentum = { side: 'away', from: this.s.clock }
    }
    this.applyHeroCardAndInjury(r)
  }

  /** Keepers' book: where the hero put his penalties / shots this moment (WP-14). */
  private noteHeroShots(r: HighlightResult): void {
    const log = r.shotLog
    if (!log?.some((e) => e.zone !== undefined)) return
    const h = this.s.hero
    const book = (h.book ??= copyBook(undefined))
    for (const e of log) if (e.zone !== undefined && !e.header) noteShot(book, e.zone, !!e.pen)
  }

  private heroVars(): CommentaryVars {
    const side = this.s.hero.side as Side
    return { ...this.teamVars(side), player: this.name(this.s.hero.id) }
  }

  private applyAttackingOutcome(p: PendingRuntime, r: HighlightResult): void {
    const side = this.s.hero.side as Side
    const heroId = this.s.hero.id as string
    const kind = p.highlight.kind
    const team = this.s.teams[side]
    const gk = this.keeper(other(side))
    const vars = { ...this.heroVars(), gk: gk?.name ?? '' }
    const isShot = r.outcome === 'goal' || r.outcome === 'saved' || r.outcome === 'missed' || r.outcome === 'blocked' || r.outcome === 'woodwork'
    if (isShot) {
      team.shots++
      if (r.outcome === 'goal' || r.outcome === 'saved') team.onTarget++
    }
    switch (r.outcome) {
      case 'goal': {
        this.s.players[heroId]!.shotsOnTarget++
        const scorer = r.scorerId && this.lookup.has(r.scorerId) ? r.scorerId : heroId
        const assist = r.assistId && this.lookup.has(r.assistId) ? r.assistId : kind === 'penalty' || kind === 'freekick' ? null : p.passerId
        return this.applyGoal(side, scorer, assist === scorer ? null : assist, { penalty: kind === 'penalty' })
      }
      case 'assist': {
        team.shots++
        team.onTarget++
        const scorer = this.validMate(r.scorerId) ?? this.validMate(p.finisherId) ?? this.pickShooter(side, kind === 'corner' || kind === 'cross' || kind === 'corner_kick')?.id
        if (scorer) return this.applyGoal(side, scorer, heroId, {})
        return
      }
      case 'saved':
        if (gk) this.recordSave(other(side), gk.id)
        this.emit('save', side, this.say(kind === 'penalty' ? 'penaltyMiss' : 'save', vars), { playerId: heroId })
        if (kind !== 'penalty' && this.rng.chance(0.3)) this.corner(side, null)
        return
      case 'missed':
        return this.emit('miss', side, this.say(kind === 'penalty' ? 'penaltyMiss' : 'miss', vars), { playerId: heroId })
      case 'woodwork':
        return this.emit('woodwork', side, this.say('woodwork', vars), { playerId: heroId })
      case 'blocked':
        return this.emit('shot', side, this.say('blocked', vars), { playerId: heroId })
      case 'pass_complete':
        return this.emit('commentary', side, this.say('heroPass', vars), { playerId: heroId })
      case 'foul_won':
        return this.heroFoulWon(p, vars)
      case 'cleared':
        return this.emit('commentary', side, this.say('heroCornerCleared', vars), { playerId: heroId })
      case 'foul_committed':
        return this.emit('commentary', side, this.say('foulCommitted', vars), { playerId: heroId })
      default:
        // Flag up: the attack dies, the opponents restart with an indirect free kick.
        if (r.offside) return this.emitHighlightOffside(side, r.offside.playerId, heroId)
        this.emit('commentary', side, this.say('heroLostBall', vars), { playerId: heroId })
        if (this.rng.chance(0.15)) this.openPlayShot(other(side), true)
    }
  }

  /** Offside flag raised during an interactive moment (runtime reported the player). */
  private emitHighlightOffside(att: Side, playerId: string, fallbackId: string | null): void {
    const id = this.lookup.has(playerId) ? playerId : fallbackId
    this.emit('offside', att, this.say('offside', { ...this.teamVars(att), player: this.name(id) }), id ? { playerId: id } : {})
  }

  private validMate(id: string | null | undefined): string | undefined {
    const side = this.s.hero.side
    if (!id || !side || this.isHero(id)) return undefined
    return this.s.teams[side].onPitch.includes(id) ? id : undefined
  }

  private heroFoulWon(p: PendingRuntime, vars: CommentaryVars): void {
    const side = this.s.hero.side as Side
    const kind = p.highlight.kind
    const inBox = kind === 'one_on_one' || kind === 'counter' || kind === 'cross' || kind === 'edge_of_box' || kind === 'dribble' || kind === 'header'
    const def = other(side)
    const fouler = this.pickFrom(def, (x) => FOUL_WEIGHT[x.position], { excludeHero: true })
    this.s.teams[def].fouls++
    if (fouler) this.maybeCard(def, fouler)
    if (inBox && this.rng.chance(0.3)) {
      this.s.periodEvents++
      this.emit('penalty', side, this.say('penaltyAwarded', vars), { playerId: this.s.hero.id as string })
      if (this.heroTakes(side, (x) => penaltySkill(x.attrs)) && this.canSetPieceHighlight()) return this.createHighlight('penalty', 'setpiece')
      return this.simPenalty(side)
    }
    this.emit('freekick', side, this.say('foulWon', vars), { playerId: this.s.hero.id as string })
  }

  private applyDefensiveOutcome(p: PendingRuntime, r: HighlightResult): void {
    const side = this.s.hero.side as Side
    const opp = other(side)
    const heroId = this.s.hero.id as string
    const kind = p.highlight.kind
    const attacker = (p.opponentId && this.s.teams[opp].onPitch.includes(p.opponentId) ? this.player(p.opponentId) : undefined)
      ?? this.pickShooter(opp, false)
    const vars = { ...this.heroVars(), player: attacker?.name ?? '', hero: this.name(heroId), gk: this.name(heroId) }
    const oppTeam = this.s.teams[opp]
    switch (r.outcome) {
      case 'defended':
        if (r.offside) return this.emitHighlightOffside(opp, r.offside.playerId, attacker?.id ?? null)
        if (kind === 'block') {
          oppTeam.shots++
          return this.emit('shot', opp, this.say('heroBlocked', vars), { playerId: heroId })
        }
        if (kind === 'fk_wall') {
          oppTeam.shots++
          return this.emit('shot', opp, this.say('heroWallHeld', vars), { playerId: heroId })
        }
        // Outfield defending (tackle, interception, 1v1): no shot, no save.
        // A sweeper keeper gets there first: no shot either.
        if (kind !== 'gk_save' && kind !== 'gk_penalty' && kind !== 'gk_1v1') return this.emit('commentary', side, this.say('heroDefended', vars), { playerId: heroId })
        oppTeam.shots++
        oppTeam.onTarget++
        this.recordSave(side, heroId)
        return this.emit('save', opp, this.say(kind === 'gk_penalty' ? 'penaltyMiss' : 'heroGkSave', vars), { playerId: attacker?.id })
      case 'conceded':
        oppTeam.shots++
        oppTeam.onTarget++
        if (attacker) {
          const assist = kind === 'gk_penalty' || kind === 'fk_wall' ? null : this.pickAssist(opp, attacker.id, 'open')
          this.applyGoal(opp, attacker.id, assist, { penalty: kind === 'gk_penalty' })
        }
        return
      case 'shot_conceded': {
        // The attacker got a shot away; our keeper or the woodwork/wide kept it out.
        oppTeam.shots++
        const gk = this.keeper(side)
        if (this.rng.chance(0.55) && gk) {
          oppTeam.onTarget++
          this.recordSave(side, gk.id)
          return this.emit('save', opp, this.say('save', { ...this.teamVars(opp), player: attacker?.name ?? '', gk: gk.name }), { playerId: attacker?.id })
        }
        return this.emit('miss', opp, this.say('miss', { ...this.teamVars(opp), player: attacker?.name ?? '', gk: gk?.name ?? '' }), { playerId: attacker?.id })
      }
      case 'foul_committed':
        this.s.teams[side].fouls++
        this.emit('freekick', opp, this.say('foulCommitted', vars), { playerId: heroId })
        // A foul in or near the box can be a penalty (the block is right on its edge).
        if ((kind === 'defend' || kind === 'defend_1v1' || kind === 'block') && this.rng.chance(kind === 'block' ? 0.3 : 0.2)) {
          this.s.periodEvents++
          this.emit('penalty', opp, this.say('penaltyAwarded', { ...this.teamVars(opp), player: attacker?.name ?? '' }), { playerId: attacker?.id })
          if (this.heroIsKeeperFor(side) && this.canSetPieceHighlight()) return this.createHighlight('gk_penalty', 'setpiece')
          this.simPenalty(opp)
        }
        return
      case 'lost_ball':
        this.emit('commentary', side, this.say('heroLostBall', vars), { playerId: heroId })
        if (this.rng.chance(0.3)) this.openPlayShot(opp, false)
        return
      default:
        this.emit('commentary', side, this.say('heroPass', vars), { playerId: heroId })
    }
  }

  private applyHeroCardAndInjury(r: HighlightResult): void {
    const h = this.s.hero
    const side = h.side as Side
    const heroId = h.id as string
    if (!this.heroOnPitch()) return
    if (r.card === 'yellow') this.book(side, heroId)
    else if (r.card === 'red') this.sendOff(side, heroId, 'red', r.redReason ?? 'serious')
    if (r.injured && this.heroOnPitch()) {
      this.s.periodEvents++
      this.emit('injury', side, this.say('injury', { ...this.teamVars(side), player: this.name(heroId) }), { playerId: heroId })
      this.replaceInjured(side, heroId)
      h.plan = []
    }
    if (!this.heroOnPitch()) h.plan = []
  }

  // ───────────────────────── Shootout ─────────────────────────

  private startShootout(): void {
    const s = this.s
    this.emit('shootout', null, this.say('shootout', this.teamVars('home')))
    s.phase = 'shootout'
    const order = (side: Side) =>
      this.onPitch(side)
        .slice()
        .sort((a, b) => (a.position === 'GK' ? 1 : 0) - (b.position === 'GK' ? 1 : 0) || penaltySkill(b.attrs) - penaltySkill(a.attrs) || (a.id < b.id ? -1 : 1))
        .map((p) => p.id)
    s.shootout = { goals: [0, 0], taken: [0, 0], order: [order('home'), order('away')], first: this.rng.chance(0.5) ? 'home' : 'away', kicks: 0 }
  }

  private shootoutKick(): void {
    const so = this.s.shootout
    if (!so) return
    const side = so.kicks % 2 === 0 ? so.first : other(so.first)
    const list = so.order[idx(side)]
    const kicker = list[so.taken[idx(side)] % list.length]
    so.kicks++
    if (this.isHero(kicker) && this.s.hero.side === side) return this.createHighlight('penalty', 'shootout')
    if (this.heroIsKeeperFor(other(side))) {
      this.createHighlight('gk_penalty', 'shootout')
      if (this.s.pending) this.s.pending.opponentId = kicker!
      return
    }
    const gk = this.keeper(other(side))
    const p = clamp(0.75 * Math.sqrt(skillMult(penaltySkill(this.player(kicker!).attrs))) / Math.pow(skillMult(this.ratings(other(side)).gk), 0.35), 0.5, 0.9)
    const forced = so.taken[0] > 30 && so.taken[0] === so.taken[1] && side === so.first
    this.recordShootoutKick(side, kicker!, !forced && this.rng.chance(p), gk?.name ?? '')
    this.checkShootoutEnd()
  }

  private recordShootoutKick(side: Side, kicker: string, scored: boolean, gkName: string): void {
    const so = this.s.shootout
    if (!so) return
    so.taken[idx(side)]++
    if (scored) so.goals[idx(side)]++
    const score = `${so.goals[0]}-${so.goals[1]}`
    const key: CommentaryKey = scored ? 'shootoutGoal' : 'shootoutMiss'
    this.emit('shootout', side, this.say(key, { ...this.teamVars(side), player: this.name(kicker), gk: gkName, score }), { playerId: kicker })
  }

  private applyShootoutHighlight(p: PendingRuntime, r: HighlightResult): void {
    const side = this.s.hero.side as Side
    if (p.highlight.kind === 'penalty') {
      const gk = this.keeper(other(side))
      this.recordShootoutKick(side, this.s.hero.id as string, r.outcome === 'goal', gk?.name ?? '')
      return
    }
    const kicker = p.opponentId ?? this.keeper(other(side))?.id ?? ''
    const saved = r.outcome === 'defended'
    if (saved) this.s.hero.stats.saves++
    this.recordShootoutKick(other(side), kicker, !saved, this.name(this.s.hero.id))
  }

  private checkShootoutEnd(): void {
    const so = this.s.shootout
    if (!so || this.s.phase !== 'shootout') return
    const [gh, ga] = so.goals
    const [th, ta] = so.taken
    let done = false
    if (th <= 5 && ta <= 5) {
      done = gh + (5 - th) < ga || ga + (5 - ta) < gh
      if (!done && th === 5 && ta === 5) done = gh !== ga
    } else if (th === ta) {
      done = gh !== ga
    }
    if (done) this.finish()
  }

  // ───────────────────────── Ratings ─────────────────────────

  // ───────────────────────── Hero rating log & map ─────────────────────────

  /**
   * In-match decision window result (sim/match/decisions): nudges the hero's rating
   * and may book him. Draws no engine RNG. No-op while the hero is off the pitch.
   */
  applyHeroDecision(ratingDelta: number, book: boolean): void {
    const id = this.s.hero.id
    const side = this.s.hero.side
    if (!id || !side || !this.heroOnPitch() || this.finished) return
    if (ratingDelta) this.rate(ratingDelta, { source: 'final', key: 'decision' })
    if (book && !this.s.players[id]!.red) this.book(side, id)
  }

  /** Moves the hero's running rating and records why. */
  private rate(delta: number, entry: Omit<RatingLogEntry, 'minute' | 'delta'>): void {
    const h = this.s.hero
    h.ratingRaw += delta
    if (Math.abs(delta) < 1e-9) return
    ;(h.log ??= []).push({ minute: this.s.clock, delta: Math.round(delta * 1000) / 1000, ...entry })
  }

  /** One background minute of presence on the heat map. */
  private heroPresence(): void {
    const h = this.s.hero
    if (!h.id || !h.side) return
    const hero = this.player(h.id)
    const slots = formationSlots(this.team(h.side).formation)
    const slot = slots[Math.max(0, this.s.players[h.id]!.slot)] ?? slots[0]
    const bx = h.side === 'home' ? this.s.ballX : 1 - this.s.ballX
    const p = backgroundPresence(slot!, bx, this.s.clock, hero.position === 'GK')
    addHeat((h.heat ??= emptyHeat()), p.x, p.y, 1)
  }

  /** Heat + shot map contribution of a resolved moment (hero frame, meters). */
  private recordMomentMap(p: PendingRuntime, r: HighlightResult): void {
    const h = this.s.hero
    const heat = (h.heat ??= emptyHeat())
    const shots = (h.shots ??= [])
    const start = p.highlight.scenario.players.find((x) => x.isHero)?.pos ?? { x: 52, y: 34 }
    if (r.track && r.track.length) {
      const w = Math.min(0.2, 4 / r.track.length)
      for (const t of r.track) addHeat(heat, t.x / 105, t.y / 68, w)
    } else {
      addHeat(heat, start.x / 105, start.y / 68, 2)
    }
    const shotOutcome = (o: HighlightResult['outcome']): ShotMapEntry['outcome'] | null =>
      o === 'goal' || o === 'saved' || o === 'missed' || o === 'blocked' || o === 'woodwork' ? o : null
    const minute = this.s.clock
    if (r.shotLog && r.shotLog.length) {
      for (const sh of r.shotLog) shots.push(shotEntry(minute, sh, sh.outcome ?? shotOutcome(r.outcome) ?? 'missed', 'moment', !!sh.header))
    } else if (r.shots > 0 && !isDefensiveKind(p.highlight.kind)) {
      const header = p.highlight.kind === 'corner'
      shots.push(shotEntry(minute, typicalShotSpot(p.highlight.kind, start), shotOutcome(r.outcome) ?? 'missed', 'auto', header))
    }
  }

  private finalizeRatings(winner: Side | null): void {
    const s = this.s
    const cands: { id: string; rating: number; minutes: number; won: boolean }[] = []
    for (const side of ['home', 'away'] as const) {
      const gf = s.score[idx(side)]
      const ga = s.score[idx(other(side))]
      for (const id of [...this.team(side).lineup, ...this.team(side).bench].map((p) => p.id)) {
        const rt = s.players[id]!
        if (!rt.played) continue
        const rating = this.isHero(id) ? this.finalizeHero(gf, ga) : this.npcFinal(id, gf, ga)
        cands.push({ id, rating, minutes: rt.minutes, won: winner === side })
      }
    }
    s.motmId = pickMotm(cands)
  }

  private npcFinal(id: string, gf: number, ga: number): number {
    const rt = this.s.players[id]!
    return npcRating({
      position: this.player(id).position,
      minutes: rt.minutes,
      goals: rt.goals,
      assists: rt.assists,
      shotsOnTarget: rt.shotsOnTarget,
      saves: rt.saves,
      yellow: rt.yellow,
      red: rt.red ? 1 : 0,
      ownGoals: rt.ownGoals,
      goalsFor: gf,
      goalsAgainst: ga,
      noise: this.rng.normal(0, 0.35),
    })
  }

  private finalizeHero(gf: number, ga: number): number {
    const h = this.s.hero
    const hero = this.heroPlayer() as MatchPlayer
    const parts = finalRatingParts({
      position: hero.position,
      minutes: h.stats.minutes,
      goalsFor: gf,
      goalsAgainst: ga,
      passes: h.stats.passes,
      passesCompleted: h.stats.passesCompleted,
      saves: h.stats.saves,
    })
    for (const part of parts) this.rate(part.delta, { source: 'final', key: part.key })
    const floor = contributionFloor(h.stats.goals, h.stats.assists, h.stats.red > 0)
    if (h.ratingRaw < floor) this.rate(floor - h.ratingRaw, { source: 'final', key: 'floor' })
    h.stats.rating = roundRating(clampRating(h.ratingRaw))
    h.finalized = true
    return h.stats.rating
  }
}
