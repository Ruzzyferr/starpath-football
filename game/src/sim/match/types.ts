/**
 * Match engine contracts.
 *
 * Flow: career layer builds a MatchSetup → MatchSim steps minute by minute,
 * emitting MatchEvents. When the hero is involved in a key moment, the sim
 * pauses with a Highlight. The UI plays it in the Phaser MatchScene (real-time
 * physics) and hands back a HighlightResult via MatchSim.resolveHighlight().
 *
 * Pitch coordinates (meters): x ∈ [0,105] along length, y ∈ [0,68] across.
 * In a Highlight scenario the hero's team ALWAYS attacks toward +x (the scene
 * flips visuals if needed).
 */
import type { Attributes, Formation, Gender, KitColors, Position, TacticStyle } from '../../core/types'

export const PITCH_LENGTH = 105
export const PITCH_WIDTH = 68
export const GOAL_WIDTH = 7.32
export const GOAL_HEIGHT = 2.44

export type Side = 'home' | 'away'

export interface MatchPlayer {
  id: string
  name: string // display/short name
  number: number
  position: Position
  ovr: number
  attrs: Attributes
  isHero: boolean
  /** -100..100, teammates with low values pass to the hero less often. */
  relationToHero: number
}

export interface MatchTeam {
  id: string
  name: string
  shortName: string
  colors: KitColors
  formation: Formation
  style: TacticStyle
  lineup: MatchPlayer[] // 11, index 0 = GK
  bench: MatchPlayer[]
  /** Morale/form modifier, 0.8..1.2 */
  morale: number
}

export type Weather = 'clear' | 'rain' | 'snow' | 'wind' | 'hot'

export interface MatchSetup {
  home: MatchTeam
  away: MatchTeam
  seed: number
  competitionName: string
  weather: Weather
  /** Which side the hero is on, or null for an AI-only match. */
  heroSide: Side | null
  /** Hero starts on the bench and may come on as a sub. */
  heroOnBench: boolean
  /** Knockout: if level after 90' → extra time + penalties. */
  knockout: boolean
  neutralVenue: boolean
  /** 0..1, derby/final etc. Raises crowd intensity & hero composure test. */
  importance: number
  difficulty: number // 0.8 easy … 1.3 legend; scales opponent AI in highlights
  /** Players' gender for commentary pronouns (the world follows the hero). Missing = male. */
  gender?: Gender
}

export type MatchEventType =
  | 'kickoff' | 'goal' | 'shot' | 'save' | 'miss' | 'woodwork' | 'chance'
  | 'yellow' | 'red' | 'injury' | 'sub' | 'halftime' | 'fulltime'
  | 'corner' | 'freekick' | 'penalty' | 'offside' | 'commentary' | 'highlight'
  | 'extratime' | 'shootout'

export interface MatchEvent {
  minute: number
  type: MatchEventType
  side: Side | null
  playerId?: string
  assistId?: string
  text: string // already localized commentary line
  /** Running score after this event. */
  score: [number, number]
}

export type HighlightKind =
  | 'build_up' // hero receives in midfield
  | 'counter' // fast break with space
  | 'one_on_one' // through on goal
  | 'cross' // wide area, deliver or finish a cross
  | 'edge_of_box' // shooting chance from range
  | 'freekick'
  | 'penalty'
  | 'corner' // header chance
  | 'defend' // defensive moment: stop an attacker
  | 'gk_save' // hero is GK: save a shot
  | 'gk_penalty'
  | 'counter_2v1' // fast break, hero + one team-mate against a lone defender
  | 'long_ball_control' // a long diagonal to bring down under pressure, then play on
  | 'rebound' // keeper parries a team-mate's shot: react first to the loose ball
  | 'interception' // defensive: read the opponent's pass and cut it out

export interface Vec2 {
  x: number
  y: number
}

export interface ScenarioPlayer {
  id: string
  side: Side
  pos: Vec2
  role: Position
  number: number
  isHero: boolean
  attrs: Attributes
  relationToHero: number
}

export interface HighlightScenario {
  kind: HighlightKind
  players: ScenarioPlayer[]
  ball: { pos: Vec2; z: number; ownerId: string | null; vel?: Vec2 }
  /** Seconds before the moment auto-ends. */
  timeLimit: number
  /** Short instruction for UI, localized. */
  prompt: string
}

export interface Highlight {
  id: string
  minute: number
  side: Side // hero's side
  kind: HighlightKind
  scenario: HighlightScenario
  /** Score at the moment of the highlight. */
  score: [number, number]
}

export type HighlightOutcome =
  | 'goal' // hero scored
  | 'assist' // hero's pass led to a goal
  | 'saved' | 'missed' | 'blocked' | 'woodwork'
  | 'pass_complete' // good play, no goal
  | 'lost_ball'
  | 'defended' // successful defensive action / GK save
  | 'conceded' // defensive moment failed → goal against
  | 'shot_conceded' // defensive moment: the opponent got a shot away (saved / wide), no goal
  | 'foul_won' | 'foul_committed'
  | 'timeout'

export interface HighlightResult {
  outcome: HighlightOutcome
  scorerId?: string
  assistId?: string
  /** Hero micro-stats accumulated during the moment. */
  passes: number
  passesCompleted: number
  shots: number
  shotsOnTarget: number
  dribbles: number
  tackles: number
  /** Optional booking for the hero (rash tackle). */
  card?: 'yellow' | 'red'
  injured?: boolean
  /**
   * Set when the moment ended on an offside flag: the player who touched the
   * ball from an offside position (hero's team → outcome 'lost_ball',
   * opponents in a defensive moment → 'defended').
   */
  offside?: { playerId: string; byHero: boolean }
  /**
   * Hero positions sampled during the moment (hero-attack frame, pitch meters),
   * for the heat map. Optional: auto-resolved moments leave it out.
   */
  track?: Vec2[]
  /** Hero shots taken during the moment (pitch meters, hero attacks +x). */
  shotLog?: { x: number; y: number; header?: boolean; outcome?: 'goal' | 'saved' | 'missed' | 'blocked' | 'woodwork' }[]
}

/** One line of the hero's rating breakdown (sums, with the base, to the final rating before clamping). */
export interface RatingLogEntry {
  minute: number
  /** moment = an interactive/auto moment, team = goal for/against while on the pitch, background = involvement between moments, final = full-time adjustment. */
  source: 'moment' | 'team' | 'background' | 'final'
  /**
   * Machine key for the UI label. moment: the outcome; team: 'goalFor' | 'goalAgainst';
   * background: 'save' | 'involvement'; final: 'result' | 'cleanSheet' | 'passing' | 'saves' | 'floor'.
   */
  key: string
  kind?: HighlightKind
  outcome?: HighlightOutcome
  delta: number
  /** Moment resolved by the auto-sim (skipped) rather than played. */
  auto?: boolean
}

/** A shot by the hero for the shot map (pitch normalised: x 0 own goal line → 1 opponent goal line, y 0..1). */
export interface ShotMapEntry {
  minute: number
  x: number
  y: number
  outcome: 'goal' | 'saved' | 'missed' | 'blocked' | 'woodwork'
  header?: boolean
  /** Rough chance quality 0..1. */
  xg: number
  /** 'moment' = recorded during a played highlight, 'auto' = from an auto-resolved one (position estimated). */
  source: 'moment' | 'auto'
}

/** Hero heat map + shot map (normalised to the hero's attacking direction, +x = toward the opponent goal). */
export interface HeroMatchMap {
  cols: number
  rows: number
  /** cols × rows presence weights, row-major (row = y band, col = x band). */
  heat: number[]
  shots: ShotMapEntry[]
}

/** Expected moment preview for the pre-match screen. */
export interface ExpectedMoments {
  min: number
  max: number
  /** Kind shares (sum ≈ 1), most likely first. */
  kinds: { kind: HighlightKind; share: number }[]
}

export interface HeroMatchStats {
  minutes: number
  goals: number
  assists: number
  shots: number
  shotsOnTarget: number
  passes: number
  passesCompleted: number
  tackles: number
  dribbles: number
  saves: number
  yellow: number
  red: number
  rating: number // 0..10 running rating
  highlightsPlayed: number
}

export interface MatchSnapshot {
  minute: number
  score: [number, number]
  possession: [number, number] // percentage
  shots: [number, number]
  shotsOnTarget: number[]
  events: MatchEvent[]
  /** Ball zone 0..1 along pitch for a mini radar. */
  ballX: number
  finished: boolean
  phase: 'first' | 'second' | 'extra' | 'shootout' | 'done'
  heroOnPitch: boolean
  heroStats: HeroMatchStats
  pendingHighlight: Highlight | null
  penalties?: [number, number]
  /** Hero rating breakdown so far (base = RATING_BASE). */
  heroLog?: RatingLogEntry[]
  /** Hero heat map & shot map so far. */
  heroMap?: HeroMatchMap
}
