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
import type { Attributes, Formation, Gender, KitColors, Position, ShotBook, TacticStyle } from '../../core/types'
import type { Referee, RefereeBrief, RedReason } from './referee'

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
  /** Hero only, 0..1: extra marking earned by a prolific scoring run (see sim/game/match markedMan). */
  marked?: number
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
  /** Match referee (WP-14). Missing = neutral (strictness 3, no advantage data). */
  referee?: Referee
  /** Keepers' book on the hero from earlier matches (WP-14). */
  keeperBook?: ShotBook
  /** The hero wears the armband: he organises the wall at opposition free kicks. */
  heroCaptain?: boolean
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
  | 'hold_up' // back to goal under a tight marker: shield it until support arrives, then lay it off
  | 'defend_1v1' // isolated against a dribbler with space behind: jockey, show him wide, tackle on the heavy touch
  | 'block' // an opponent winds up a shot from the edge: get in the line and block it
  | 'corner_kick' // the hero takes a corner: pick delivery zone, height and curl, team-mates attack it
  | 'fk_wall' // opposition free kick near our box: the hero (keeper or captain) sets the wall, then the kick
  | 'dribble' // take-on (2.1#36): one defender squared up in front, beat him with the ball (3–8 s)
  | 'header' // open-play cross from a team-mate to the hero in the box: time the header (2.1#67, #119)
  | 'gk_1v1' // keeper (2.1#85): an attacker is through on goal, come out and narrow the angle
  | 'gk_sweep' // keeper (2.1#85): a ball over the top, come off the line and sweep it up first
  | 'back_post' // full-back / defender (2.1#124): a cross from the far flank, cover the back post

/** Keeper-hero kinds (2.1#85: save, penalty, 1v1, sweeping). */
export const KEEPER_KINDS: ReadonlySet<HighlightKind> = new Set<HighlightKind>(['gk_save', 'gk_penalty', 'gk_1v1', 'gk_sweep'])

/** Kinds where the hero's team is defending (WP-14 adds defend_1v1 and block). */
export const DEFENSIVE_KINDS: ReadonlySet<HighlightKind> = new Set<HighlightKind>(['defend', 'gk_save', 'gk_penalty', 'interception', 'defend_1v1', 'block', 'fk_wall', 'gk_1v1', 'gk_sweep', 'back_post'])

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
  /** Referee in charge (strictness / advantage), WP-14. */
  referee?: RefereeBrief
  /** What the keepers know of the hero's shooting habits (WP-14). */
  keeperBook?: ShotBook
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
  | 'cleared' // the hero's corner was delivered but the defence (or keeper) dealt with it
  | 'foul_won' | 'foul_committed'
  | 'timeout'

/** Passes between the hero and one team-mate. */
export interface PassPair {
  /** Passes the team-mate gave the hero. */
  from: number
  /** Passes the hero gave the team-mate. */
  to: number
}

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
  /** Per-team-mate pass telemetry for the moment: `from` = passes to the hero, `to` = hero passes to them (counting only). */
  passNet?: Record<string, PassPair>
  /** Optional booking for the hero (rash tackle). */
  card?: 'yellow' | 'red'
  /** Why a straight red was shown (ban length, WP-14). Missing = 'serious'. */
  redReason?: RedReason
  /** The referee played advantage during the moment (and whether it was called back). */
  advantage?: 'played' | 'called_back'
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
  shotLog?: { x: number; y: number; header?: boolean; outcome?: 'goal' | 'saved' | 'missed' | 'blocked' | 'woodwork'; zone?: 0 | 1 | 2; pen?: boolean }[]
  /**
   * Aim-assist reward multiplier for the interactive moment (WP-13): less
   * assist, more reward. Scales the positive part of the moment's rating
   * delta (and so match XP). Absent = 1 (auto-resolved moments).
   */
  assistMult?: number
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
  /** Matches banned for this match's red card (1..3), WP-14. */
  ban?: number
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
  /** Per-team-mate pass telemetry so far (player id -> pair). */
  passNet?: Record<string, PassPair>
}
