/**
 * Extra, optional world data for national teams, cup structure and awards.
 *
 * Added through module augmentation of `core/types` so the shared type file
 * stays untouched: every field is optional, so old saves load unchanged and
 * the systems initialise the data lazily (see `ensureNational`, `ensureAwards`).
 */
import type { LText, Position } from '../../core/types'

export type NationalLevel = 'A' | 'U21' | 'U19'
export type NationalStatus = 'certain' | 'likely' | 'borderline' | 'out'

/**
 * Sub-format of a competition:
 *  - playoff        tier-2/3 promotion play-off (type 'cup')
 *  - continental_q  continental qualifying round (type 'continental', two legs)
 *  - nt_qual        national-team qualifying groups (type 'international')
 *  - nt_finals      national-team finals tournament (groups → knockout)
 *  - nt_youth       U19/U21 development league (type 'international')
 */
export type CompFormat = 'playoff' | 'continental_q' | 'nt_qual' | 'nt_finals' | 'nt_youth' | 'nt_friendly'

/** One knockout draw, kept for the draw screen. */
export interface DrawRecord {
  round: number
  /** Week of the (first leg of the) round. */
  week: number
  /** [home, away] of each tie (first leg). */
  pairs: [string, string][]
  /** Seeded pot (higher tier / group winners), if the draw was seeded. */
  seeded?: string[]
  twoLegged?: boolean
}

export interface CompMeta {
  format?: CompFormat
  /** Group members by group index (group stages of international comps). */
  groups?: string[][]
  /** First knockout round (rounds below are group matchdays). */
  koFrom?: number
  /** Knockout rounds from this one on (except the final) are two-legged. */
  twoLegFrom?: number
  hostId?: string
  /** Stable key used in honours (e.g. 'nt:WORLD', 'nt:EU', 'playoff:<leagueId>'). */
  key?: string
  /** Qualifying competition → id of the competition its winners enter. */
  feedsInto?: string
  /** International competitions: team level. */
  level?: NationalLevel
  /** Number of qualifiers that go through (international qualifying). */
  slots?: number
  draws?: DrawRecord[]
}

/** Hero-side national team state. */
export interface NationalHero {
  /** Team id the hero is currently called up to ('TR', 'TR:U21'…), null if none. */
  teamId: string | null
  /** Last computed call-up meter 0..100 and the level it was computed for. */
  meter: number
  level: NationalLevel
  status: NationalStatus
  youthCaps: number
  youthGoals: number
  /** Last international matches (newest first, max 20). */
  log: { season: number; week: number; teamId: string; oppId: string; gf: number; ga: number; goals: number; comp: LText }[]
}

export interface NationalWorld {
  v: 1
  /** Nation id → head coach name. */
  coaches: Record<string, string>
  /** Team id → selected NPC ids (+ 'hero' when called). */
  squads: Record<string, string[]>
  /** When the current squads were announced. */
  announced: { season: number; week: number } | null
  /** Player id → [caps, goals] for senior internationals in the current award year. */
  stats: Record<string, [number, number]>
  hero: NationalHero
}

/** A goal good enough to be nominated for Goal of the Season. */
export interface GoalCandidate {
  playerId: string
  name: string
  teamId: string
  oppId: string
  compName: LText
  season: number
  week: number
  minute: number
  kind: 'volley' | 'long_range' | 'solo' | 'free_kick' | 'header' | 'chip' | 'curler' | 'team_move'
  /** Distance to goal in metres. */
  distance: number
  /** Beauty 0..10. */
  score: number
  isHero?: boolean
}

export interface MonthAward {
  season: number
  /** 0-based month of the season (4 weeks each). */
  month: number
  leagueId: string
  playerId: string
  name: string
  clubId: string | null
  goals: number
  assists: number
  score: number
  isHero?: boolean
}

export interface StarCandidate {
  playerId: string
  name: string
  clubId: string | null
  nationality: string
  position: Position
  /** Transparent score parts. */
  parts: { league: number; continental: number; international: number; trophies: number }
  score: number
  points: number
  firsts: number
  isHero?: boolean
}

export interface GoldenStarResult {
  season: number
  /** Top 30 shortlist, ranked by votes (points). */
  ranking: StarCandidate[]
  journalists: number
}

export interface SeasonAwardRecord {
  season: number
  goldenGlove: { playerId: string; name: string; clubId: string | null; value: number; isHero?: boolean } | null
  youngPlayer: { playerId: string; name: string; clubId: string | null; value: number; isHero?: boolean } | null
  goalOfSeason: GoalCandidate | null
  /** Nominees shown on the ceremony screen. */
  goalNominees: GoalCandidate[]
  /** Team of the season (4-3-3): slot position + player. */
  teamOfSeason: { slot: Position; playerId: string; name: string; clubId: string | null; rating: number; isHero?: boolean }[]
  teamOfSeasonLeague: string | null
}

export interface WorldAwards {
  v: 1
  months: MonthAward[]
  goldenStar: GoldenStarResult[]
  seasons: SeasonAwardRecord[]
  /** Running Goal-of-the-Season nominees of the current season (best first). */
  goals: GoalCandidate[]
  /** Season whose ceremony the player has not watched yet. */
  ceremonyPending: number | null
}

declare module '../../core/types' {
  interface Competition {
    meta?: CompMeta
  }
  interface Fixture {
    /** Two-legged ties: 1 or 2. */
    leg?: 1 | 2
    /** Tie index within the round (both legs share it). */
    tie?: number
    /** Neutral venue (finals, tournament games not involving the host). */
    neutral?: boolean
    /** Group index for group-stage fixtures. */
    group?: number
  }
  interface MatchResultSummary {
    /** `assists[i]` assisted `scorers[i]` (null if unassisted). */
    assists?: (string | null)[]
    /** Second legs: the tie went to extra time (aggregate level after 90'). */
    extraTime?: boolean
  }
  interface World {
    national?: NationalWorld
    /** Country id → continental points of the last seasons (oldest first, max 5). */
    coefficients?: Record<string, number[]>
    awards?: WorldAwards
  }
}
