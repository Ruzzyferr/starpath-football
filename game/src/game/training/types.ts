/**
 * Shared types for the training mini-games ("drills").
 *
 * A drill is a short (20–40 s) self-contained game played on a slice of the
 * pitch. Its rules live in a headless class (see ./drills/*) driven with real
 * seconds and a per-frame {@link DrillInput}; the Phaser TrainingScene only
 * renders the renderer-neutral {@link DrillView} and plays juice for the
 * {@link DrillEvent}s. Every drill ends with a {@link DrillResult} whose
 * `performance` (0..1) feeds `runTraining(..., performance)`.
 *
 * Coordinates are pitch meters (see sim/match/types): the hero's team attacks
 * +x (the east goal at x = PITCH_LENGTH, drawn at the top of the screen).
 */
import type { Attributes } from '../../core/types'
import type { Weather } from '../../sim/match/types'
import type { AimAssist } from '../kick'
import type { AgentState, Vec2 } from '../model'
import type { AimState, HeroAction } from '../runtime'

export type DrillKind = 'finishing' | 'passing' | 'dribbling' | 'fitness' | 'goalkeeping' | 'crossing' | 'heading' | 'tackling'
export const DRILL_KINDS: readonly DrillKind[] = ['finishing', 'passing', 'dribbling', 'fitness', 'goalkeeping', 'crossing', 'heading', 'tackling']

/** Optional variation of a drill (set-piece finishing = free kicks over a wall). */
export type DrillVariant = 'standard' | 'setPiece' | 'rondo'

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D'

/** Per-frame player input (already in pitch space), produced by the InputController. */
export interface DrillInput {
  move: Vec2
  sprint: boolean
  actions: HeroAction[]
  /** Live aim while dragging/holding (for the trajectory preview). */
  aim: AimState | null
}

export const NO_INPUT: Readonly<DrillInput> = Object.freeze({ move: { x: 0, y: 0 }, sprint: false, actions: [], aim: null })

export interface DrillConfig {
  /** Hero attributes (skills shape kick accuracy, speed, stamina, reflexes). */
  attrs: Attributes
  /** Deterministic seed (same seed + same inputs = same drill). */
  seed: number | string
  aimAssist?: AimAssist
  /** Opposition sharpness multiplier 0.8..1.3 (keeper/shooter quality). Default 1. */
  difficulty?: number
  weather?: Weather
  variant?: DrillVariant
}

/** Short feedback labels; the scene localises them. */
export type DrillLabel =
  | 'goal' | 'target' | 'saved' | 'miss' | 'post' | 'blocked'
  | 'pass' | 'gate' | 'gateMissed' | 'wrongType' | 'overhit' | 'quick'
  | 'cone' | 'perfect' | 'good' | 'early' | 'late' | 'tackled' | 'lap'
  | 'shuttle' | 'perfectStart' | 'goodStart' | 'lateArrival' | 'gassed' | 'out'
  | 'save' | 'held' | 'conceded' | 'wide'
  | 'delivery' | 'won' | 'foul' | 'beaten' | 'whiff'

/** Things that happened this step (sound, haptics, floaters). */
export type DrillEvent =
  | { type: 'whistle'; long: boolean }
  | { type: 'go' }
  | { type: 'kick'; power: number; hero: boolean; x: number; y: number }
  | { type: 'touch'; x: number; y: number }
  | { type: 'score'; points: number; label: DrillLabel; good: boolean; x: number; y: number; z?: number }
  | { type: 'net'; end: 'east' | 'west'; y: number; z: number; speed: number }
  | { type: 'post'; x: number; y: number; z: number; speed: number }
  | { type: 'save'; hero: boolean; held: boolean; x: number; y: number; z: number }
  | { type: 'dive' }
  | { type: 'cone'; x: number; y: number }
  | { type: 'skill'; ok: boolean }
  | { type: 'beep'; level: number }
  | { type: 'end' }

export type ActorRole = 'hero' | 'mate' | 'keeper' | 'opp' | 'dummy'

export interface ActorView {
  id: string
  role: ActorRole
  x: number
  y: number
  z: number
  facing: number
  state: AgentState
  stateT: number
  /** Kit number shown on the shirt. */
  number: number
  /** Currently the target (pass target, next dummy…). */
  highlight?: boolean
}

export type Tone = 'gold' | 'white' | 'green' | 'red' | 'blue' | 'orange' | 'dim'

export interface ConeView {
  x: number
  y: number
  tone: Tone
}

export interface GateView {
  a: Vec2
  b: Vec2
  tone: Tone
  /** Pass type the gate/lane demands (passing drill). */
  label?: 'ground' | 'loft'
}

/** A target circle on a goal plane (y across, z height). */
export interface GoalTargetView {
  end: 'east' | 'west'
  y: number
  z: number
  r: number
  tone: Tone
}

export interface RingView {
  x: number
  y: number
  r: number
  tone: Tone
  pulse?: boolean
}

export interface LineView {
  a: Vec2
  b: Vec2
  tone: Tone
  width?: number
}

export interface MeterView {
  kind: 'stamina' | 'beat' | 'power' | 'timing'
  value: number // 0..1
  tone: Tone
}

/** Prompt shown under the score (localised by the scene). */
export type DrillPrompt =
  | 'finishing' | 'setPiece' | 'passGround' | 'passLoft' | 'dribble' | 'skillNow' | 'fitnessRun' | 'fitnessWait' | 'fitnessGo'
  | 'keeper' | 'crossing' | 'crossNow' | 'heading' | 'headNow' | 'tackling' | 'tackleNow' | 'ready' | 'done'

export interface DrillHud {
  points: number
  combo: number
  timeLeft: number
  duration: number
  prompt: DrillPrompt
  meters: MeterView[]
  /** Fitness level / round number. */
  level?: number
  /** Countdown before the start (3,2,1 → 0). */
  countdown: number
  /** Wind shown to the player (2.3#25): speed in km/h and the pitch direction it blows to. */
  wind?: { kmh: number; dir: Vec2 }
}

export interface DrillView {
  /** Camera focus (pitch meters) and how many meters the shorter screen side should show. */
  focus: Vec2
  span: number
  goals: ('east' | 'west')[]
  hero: ActorView
  actors: ActorView[]
  ball: { x: number; y: number; z: number; speed: number } | null
  cones: ConeView[]
  gates: GateView[]
  goalTargets: GoalTargetView[]
  rings: RingView[]
  lines: LineView[]
  /** Dotted aim preview (pitch points with height). */
  preview: { points: { x: number; y: number; z: number }[]; shot: boolean } | null
  hud: DrillHud
  heroOnBall: boolean
  heroIsKeeper: boolean
}

export interface DrillResult {
  kind: DrillKind
  points: number
  /** 0..1 → runTraining performance. */
  performance: number
  grade: Grade
  /** Drill-specific counters (shots, goals, passes…). */
  stats: Record<string, number>
  /** Seconds actually played. */
  played: number
}

/** The headless contract every drill implements. */
export interface Drill {
  readonly kind: DrillKind
  readonly duration: number
  readonly finished: boolean
  /** Advance by real seconds with this frame's input. */
  update(realDt: number, input: DrillInput): void
  drainEvents(): DrillEvent[]
  view(): DrillView
  result(): DrillResult
}
