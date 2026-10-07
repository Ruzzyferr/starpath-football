/**
 * Serializable runtime state of a MatchSim (extra types local to the match
 * engine; the public contract lives in ./types.ts).
 *
 * Everything here is plain JSON data so `MatchSim.serialize()` can persist a
 * match mid-way and `MatchSim.restore()` resumes it bit-identically.
 */
import type { HighlightKind, RatingLogEntry, ShotMapEntry } from './types'
import type { Lang, MatchResultSummary, ShotBook } from '../../core/types'
import type { RngState } from '../../core/rng'
import type { HeroMatchStats, Highlight, MatchEvent, MatchSetup, Side } from './types'

/** Optional knobs passed by the career layer. */
export interface MatchSimOptions {
  /** Hero form 0..100 (50 neutral). More form → slightly more highlights. */
  heroForm?: number
  /** Manager trust 0..100. Affects bench appearances and being subbed off. */
  managerTrust?: number
  /** Max substitutions per team (default 5). */
  maxSubs?: number
}

/** Per-player match counters. */
export interface PlayerRuntime {
  id: string
  side: Side
  /** Formation slot index (0..10) while on the pitch, -1 on the bench. */
  slot: number
  onPitch: boolean
  played: boolean
  /** Left the pitch (sub/red/injury) and cannot return. */
  gone: boolean
  minutes: number
  fatigue: number
  yellow: number
  red: boolean
  /** Matches banned after this match's red card (1..3), WP-14. */
  ban?: number
  goals: number
  assists: number
  ownGoals: number
  shotsOnTarget: number
  saves: number
}

/** Per-team counters. */
export interface TeamRuntime {
  onPitch: string[]
  bench: string[]
  subsLeft: number
  aiSubsPlanned: number
  aiSubsMade: number
  shots: number
  onTarget: number
  corners: number
  fouls: number
  /** Sum of per-minute possession shares. */
  possession: number
  /** Per-match possession bias. */
  tilt: number
}

/** A highlight waiting for the UI (or skip) to resolve it. */
export interface PendingRuntime {
  highlight: Highlight
  passerId: string | null
  finisherId: string | null
  opponentId: string | null
  context: 'open' | 'setpiece' | 'shootout'
}

/** Penalty shootout progress. */
export interface ShootoutRuntime {
  goals: [number, number]
  taken: [number, number]
  order: [string[], string[]]
  first: Side
  kicks: number
}

/** Hero tracking. */
export interface HeroRuntime {
  id: string | null
  side: Side | null
  stats: HeroMatchStats
  ratingRaw: number
  /** Planned clock minutes for open-play highlights (current window). */
  plan: number[]
  /** Max total highlights allowed in regulation (planned + set pieces). */
  cap: number
  generated: number
  /** Chance-rate multipliers compensating for highlight-generated goals. */
  teamFactor: number
  oppFactor: number
  ignoredCount: number
  form: number
  trust: number
  finalized: boolean
  /** Rating breakdown (optional: absent in saves from older versions). */
  log?: RatingLogEntry[]
  /** Heat map grid (HEAT_COLS × HEAT_ROWS, hero attacking +x). */
  heat?: number[]
  shots?: ShotMapEntry[]
  /** Moment kinds generated so far (position guarantees). */
  kinds?: Partial<Record<HighlightKind, number>>
  /** Keepers' book on the hero (setup.keeperBook + this match), WP-14. */
  book?: ShotBook
}

/** Complete engine state. */
export interface EngineState {
  v: 1
  setup: MatchSetup
  lang: Lang
  opts: MatchSimOptions
  rng: RngState
  started: boolean
  /** 0 first half, 1 second half, 2 extra time 1st, 3 extra time 2nd. */
  period: number
  /** Match clock minute (capped at the period end during stoppage). */
  clock: number
  /** Added minutes for the current period, -1 until decided. */
  stoppage: number
  stoppageUsed: number
  periodEvents: number
  phase: 'first' | 'second' | 'extra' | 'shootout' | 'done'
  score: [number, number]
  events: MatchEvent[]
  scorers: MatchResultSummary['scorers']
  ballX: number
  lastAttack: Side | null
  players: Record<string, PlayerRuntime>
  teams: { home: TeamRuntime; away: TeamRuntime }
  hero: HeroRuntime
  pending: PendingRuntime | null
  shootout: ShootoutRuntime | null
  seq: number
  motmId?: string
  heroFinalRating?: number
}
