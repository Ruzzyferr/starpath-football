/**
 * Pure scoring rules for the training mini-games. Everything here is plain
 * math (no Phaser, no state) so it is unit tested directly and shared by the
 * drills, the scene and the UI.
 *
 * Points → performance: each drill has a par score that a strong session
 * reaches. performance = (points / par)^0.85, clamped to 0..1, so an
 * "average human" session lands around the auto-sim value (0.6) and only
 * near-perfect play reaches 1.
 */
import type { TrainingType } from '../../sim/career/training'
import type { DrillKind, DrillVariant, Grade } from './types'

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Drill length in seconds. */
export const DRILL_DURATION: Readonly<Record<DrillKind, number>> = {
  finishing: 40,
  passing: 35,
  dribbling: 20,
  fitness: 40,
  goalkeeping: 40,
  crossing: 35,
  heading: 30,
  tackling: 30,
  distribution: 40,
  sprint: 35,
  interception: 40,
}

/** Points that count as a top session (performance ≈ 1). Calibrated with the human-input bots (drillCurves.test.ts): a level-50 hero with good input lands near 0.67. */
export const DRILL_PAR: Readonly<Record<DrillKind, number>> = {
  finishing: 22,
  passing: 1563,
  dribbling: 202,
  fitness: 1470,
  goalkeeping: 50,
  crossing: 1500,
  heading: 1540,
  tackling: 575,
  distribution: 560,
  sprint: 1990,
  interception: 416,
}

/** Which drill a training session plays (null = no mini-game, auto only). */
export const DRILL_FOR_TRAINING: Readonly<Record<TrainingType, { kind: DrillKind; variant: DrillVariant } | null>> = {
  shooting: { kind: 'finishing', variant: 'standard' },
  setPiece: { kind: 'finishing', variant: 'setPiece' },
  passing: { kind: 'passing', variant: 'rondo' },
  tactical: { kind: 'passing', variant: 'standard' },
  dribbling: { kind: 'dribbling', variant: 'standard' },
  physical: { kind: 'fitness', variant: 'standard' },
  goalkeeping: { kind: 'goalkeeping', variant: 'standard' },
  crossing: { kind: 'crossing', variant: 'standard' },
  heading: { kind: 'heading', variant: 'standard' },
  tackling: { kind: 'tackling', variant: 'standard' },
  distribution: { kind: 'distribution', variant: 'standard' },
  sprint: { kind: 'sprint', variant: 'standard' },
  core: { kind: 'sprint', variant: 'contact' },
  longPass: { kind: 'crossing', variant: 'switch' },
  reading: { kind: 'interception', variant: 'standard' },
  pressing: { kind: 'interception', variant: 'press' },
  keeperDiving: { kind: 'goalkeeping', variant: 'diving' },
  // Leadership is not a ball drill: it is talked, not kicked (team talk + mentoring, auto only).
  leadership: null,
  recovery: null,
}

/** Variants with their own scoring scale (curl gate: 5 × 20 points). */
export const VARIANT_PAR: Readonly<Partial<Record<DrillVariant, number>>> = { setPiece: 16, rondo: 41, switch: 1100, diving: 79, contact: 2020, press: 1180 }
/** Variants with their own length (rondo: 60 s, 2.3#24). */
export const VARIANT_DURATION: Readonly<Partial<Record<DrillVariant, number>>> = { rondo: 60 }

/**
 * Rondo (2.3#24): a completed pass 1, a one-touch pass 1.5, plus up to 0.5 for a ball played onto the
 * mate's foot (`accuracy` 0..1); a lost ball resets the streak.
 */
export const rondoPassPoints = (completed: boolean, oneTouch: boolean, accuracy = 0): number =>
  !completed ? 0 : (oneTouch ? 1.5 : 1) + Math.round(clamp01(accuracy) * 5) / 10
/** Vision from which the third pass option (through the middle) is visible. */
export const RONDO_VISION_THIRD = 60

/** Curl gate (2.3#25): 5 free kicks over the wall; a goal 20, a saved kick into a gate 4, at the keeper 2. */
export const CURL_GATE_ATTEMPTS = 8
export const CURL_GATE_POINTS = 20
/** A curl-gate kick over the wall into a gate (outer third) that the keeper saves. */
export const CURL_GATE_SAVED_POINTS = 2
/** A kick over the wall at the keeper's middle third that he saves. */
export const CURL_GATE_MIDDLE_POINTS = 0
/** A goal through the keeper's middle third (not a placed gate): blasting at the middle earns far less than placing it. */
export const CURL_GATE_MIDDLE_GOAL_POINTS = 10
/** Distance (m) from the goal centre where the gates (outer thirds) begin. */
export const CURL_GATE_INNER = 1.22
/** Wind for a curl-gate attempt: up to 7 m/s (≈ 25 km/h). */
export const CURL_GATE_MAX_WIND = 7
export const msToKmh = (ms: number): number => Math.round(ms * 3.6)

/**
 * Kick-noise multiplier for the training drills from the kick's own skill (0..1): 1 at 0.5, about
 * 1.2 at 0.35 and 0.5 at 0.9. The match kick model's spread already narrows with skill; a drill
 * leans on it harder so practice and progress show (owner: "everything must follow the stats").
 */
export const drillNoise = (skill01: number): number => 0.35 + 1.3 * (1 - clamp01(skill01))

/**
 * Points → performance curve exponent (default 0.85). Drills whose points grow slowly with the
 * attributes (a fixed number of reps in a fixed time) get a steeper curve, so the grade follows the
 * stats: calibrated with the human-input bots in drillCurves.test.ts (BALANCE.md "Training drills").
 */
export const DRILL_CURVE: Readonly<Partial<Record<DrillKind, number>>> = { passing: 0.85, dribbling: 0.85, goalkeeping: 1.9, sprint: 1.91 }
export const VARIANT_CURVE: Readonly<Partial<Record<DrillVariant, number>>> = { setPiece: 1.15, rondo: 0.85, switch: 1.05, contact: 1.09, press: 1.07, diving: 0.85 }

/** Raw points → 0..1 performance. */
export function performanceFromPoints(kind: DrillKind, points: number, variant: DrillVariant = 'standard'): number {
  const r = Math.max(0, points) / (VARIANT_PAR[variant] ?? DRILL_PAR[kind])
  const g = (variant !== 'standard' ? VARIANT_CURVE[variant] : undefined) ?? DRILL_CURVE[kind] ?? 0.85
  return Math.round(clamp01(Math.pow(clamp01(r), g)) * 1000) / 1000
}

/** Letter grade for a performance. */
export function gradeFor(performance: number): Grade {
  const p = clamp01(performance)
  if (p >= 0.92) return 'S'
  if (p >= 0.78) return 'A'
  if (p >= 0.6) return 'B'
  if (p >= 0.4) return 'C'
  return 'D'
}

/** Streak multiplier: +10% per consecutive success, capped at +50%. */
export const comboMultiplier = (combo: number): number => 1 + Math.min(5, Math.max(0, combo)) * 0.1

// ───────────────────────── Finishing ─────────────────────────

export interface ShotScoreInput {
  goal: boolean
  /** Crossed the goal line inside a lit target circle. */
  targetHit: boolean
  /** Distance of the strike from goal (m). */
  distance: number
  /** Consecutive goals before this one. */
  combo: number
}

/** Points for one finishing attempt (0 when it is not a goal). */
export function shotPoints(i: ShotScoreInput): number {
  if (!i.goal) return 0
  const base = 100 + Math.max(0, Math.min(12, i.distance - 14)) * 5
  return Math.round((base + (i.targetHit ? 150 : 0)) * comboMultiplier(i.combo))
}

/** Target grid (2.3#23): 10 shots at the lit zone of a 3×3 goal grid. */
export const GRID_SHOTS = 10
export const GRID_CENTRE_R = 0.4
export const GRID_ZONE_R = 0.85
/** From this shot on the keeper is live (owner, 2026-10-17: from the first — slower for the first two shots). */
export const GRID_KEEPER_FROM = 1
/** Points: zone centre 10, rest of the zone 6, anywhere else in the goal 2, no goal 0. */
export function gridShotPoints(goal: boolean, y: number, z: number, zone: { y: number; z: number }): number {
  if (!goal) return 0
  const d = Math.hypot(y - zone.y, z - zone.z)
  return d <= GRID_CENTRE_R ? 10 : d <= GRID_ZONE_R ? 6 : 2
}

/** Is a goal-plane crossing (y, z) inside a target circle? */
export function inTarget(y: number, z: number, t: { y: number; z: number; r: number }): boolean {
  return Math.hypot(y - t.y, z - t.z) <= t.r
}

// ───────────────────────── Passing ─────────────────────────

export interface PassScoreInput {
  received: boolean
  /** The pass type the lane demanded. */
  wanted: 'ground' | 'loft'
  lofted: boolean
  /** Ground pass went through the gate between the cones. */
  gateCleared: boolean
  /** Seconds between the ball being ready and the pass. */
  release: number
  combo: number
  /** 0..1: 1 = the ball met the receiver on the spot it was meant for (no step needed). */
  accuracy?: number
}

/** Off-spot distance (m) at which a received pass earns no accuracy bonus. */
export const PASS_ACCURACY_M = 2.2

/** Points for one pass: completion + right technique (gate / over the wall) + accuracy + quick release. */
export function passPoints(i: PassScoreInput): number {
  if (!i.received) return 0
  const rightType = i.wanted === 'loft' ? i.lofted : !i.lofted && i.gateCleared
  let p = 60
  if (rightType) p += 70
  p += Math.round(clamp01(i.accuracy ?? 0) * 50)
  if (i.release <= 1.2) p += 20
  return Math.round(p * (rightType ? comboMultiplier(i.combo) : 1))
}

// ───────────────────────── Dribbling ─────────────────────────

export type SkillTiming = 'perfect' | 'good' | 'early' | 'late'

/**
 * Skill-move timing from the distance to the defender (m). `window` scales the bands around their
 * centres (1 = the standard 1.4–2.5 m perfect / 0.9–3.4 m good). The drill uses the standard bands: the
 * stats set the take-on odds (chanceEvents 'takeOn'), the window only the ±timing points.
 */
export function skillTiming(distance: number, window = 1): SkillTiming {
  const w = Math.max(0.3, window)
  if (distance > 2.15 + 1.25 * w) return 'early'
  if (distance < 2.15 - 1.25 * w) return 'late'
  if (Math.abs(distance - 1.95) <= 0.55 * w) return 'perfect'
  return 'good'
}

// Cone slalom (2.3#22): 8 cones, 20 s, −8 per cone touch, +1 per 0.1 s under par.
export const SKILL_POINTS: Readonly<Record<SkillTiming, number>> = { perfect: 12, good: 6, early: 0, late: 0 }
export const GATE_POINTS = 6
export const GATE_MISS_PENALTY = -2
export const CONE_PENALTY = -8
export const TACKLED_PENALTY = -4

/** Lap bonus: 20 plus 1 per 0.1 s under par. */
export function lapPoints(lapTime: number, par: number): number {
  return Math.round(20 + Math.floor(Math.max(0, par - lapTime) * 10 + 1e-6))
}

/** Slalom layout by drill level (2.3#22): straight, zigzag, random. */
export type SlalomLayout = 'straight' | 'zigzag' | 'random'
export const slalomLayout = (difficulty: number): SlalomLayout => (difficulty < 0.95 ? 'straight' : difficulty < 1.15 ? 'zigzag' : 'random')

// ───────────────────────── Fitness (shuttle beep test) ─────────────────────────

export const SHUTTLE_LENGTH = 20

/** Required running speed (m/s) for a beep-test level (1-based). */
export const levelSpeed = (level: number): number => 4.0 + 0.6 * (Math.max(1, level) - 1)

/** Seconds between beeps at a level. */
export const beepInterval = (level: number): number => SHUTTLE_LENGTH / levelSpeed(level)

/** Shuttles per level before the beeps speed up. */
export const SHUTTLES_PER_LEVEL = 2

export type StartTiming = 'perfect' | 'good' | 'slow'

/** How well the runner left on the beep (seconds after the beep; negative = too early is not possible). */
export function startTiming(delay: number): StartTiming {
  if (delay <= 0.2) return 'perfect'
  if (delay <= 0.4) return 'good'
  return 'slow'
}

/** Points for a shuttle that arrived before the beep. */
export function shuttlePoints(level: number, start: StartTiming): number {
  return 100 + 10 * level + (start === 'perfect' ? 40 : start === 'good' ? 15 : 0)
}

/** Stamina drain per second while sprinting (stamina attribute 0..1). */
export const sprintDrain = (stamina01: number): number => 0.24 * (1.25 - stamina01 * 0.5)
/** Stamina recovery per second while jogging / waiting. */
export const staminaRecovery = (stamina01: number, resting: boolean): number => (resting ? 0.2 : 0.06) * (0.6 + stamina01 * 0.8)

// ───────────────────────── Goalkeeping ─────────────────────────

export interface SaveScoreInput {
  saved: boolean
  held: boolean
  /** 0 = ball at the body, 1 = full stretch. */
  stretch: number
  /** Ball speed at contact (m/s). */
  speed: number
  combo: number
}

/** Reflex wall (2.3#29): 12 shots, held 10 points, parried 6. */
export const GK_SHOTS = 12
export const GK_HELD_POINTS = 10
export const GK_PARRY_POINTS = 6
/** A shot forced wide of the frame (the angle was covered). */
export const GK_WIDE_POINTS = 2

/** Points for a shot faced on target (2.3#29: held 10, parried 6). */
export function savePoints(i: SaveScoreInput): number {
  if (!i.saved) return 0
  return i.held ? GK_HELD_POINTS : GK_PARRY_POINTS
}

/** Reaction window before each strike (2.3#29): 220 ms + Reflexes × 2 ms. */
export const gkReactionWindow = (reflexes: number): number => 0.22 + Math.max(0, Math.min(100, reflexes)) * 0.002

// ───────────────────────── Crossing ─────────────────────────

/** Radius (m) of a lit delivery zone in the box. */
export const CROSS_ZONE_R = 2.2

export type CrossTiming = 'perfect' | 'good' | 'early' | 'late'

/**
 * Delivery timing from `dt` = ball arrival − runner arrival (s): the ball
 * should drop into the zone as the runner gets there.
 */
export function crossTiming(dt: number): CrossTiming {
  const a = Math.abs(dt)
  if (a <= 0.3) return 'perfect'
  if (a <= 0.7) return 'good'
  return dt < 0 ? 'early' : 'late'
}

export interface CrossScoreInput {
  /** The ball dropped inside the lit zone. */
  inZone: boolean
  /** Distance from the zone centre where it dropped (m). */
  miss: number
  timing: CrossTiming
  combo: number
}

/** Points for one cross: in the zone + accuracy + timing with the runner. */
export function crossPoints(i: CrossScoreInput): number {
  if (!i.inZone) return 0
  const accuracy = clamp01(1 - i.miss / CROSS_ZONE_R)
  // Mistimed balls (the runner is not there yet / already gone) are worth much less.
  if (i.timing === 'early' || i.timing === 'late') return Math.round(30 + accuracy * 40)
  const timed = i.timing === 'perfect' ? 70 : 30
  return Math.round((60 + accuracy * 60 + timed) * comboMultiplier(i.combo))
}

// ───────────────────────── Heading ─────────────────────────

/** Jump timing quality 0..1: 1 = ball met at the top of the jump. */
export function jumpTiming(stateT: number, peakT: number): number {
  return clamp01(1 - Math.abs(stateT - peakT) / Math.max(1e-6, peakT))
}

export interface HeaderScoreInput {
  goal: boolean
  targetHit: boolean
  /** Jump timing 0..1 at contact. */
  timing: number
  combo: number
}

/** Points for a header (0 unless it is a goal). */
export function headerPoints(i: HeaderScoreInput): number {
  if (!i.goal) return 0
  const base = 100 + (i.targetHit ? 120 : 0) + (i.timing >= 0.75 ? 40 : 0)
  return Math.round(base * comboMultiplier(i.combo))
}

// ───────────────────────── Tackling ─────────────────────────

export interface TackleScoreInput {
  won: boolean
  /** How exposed the ball was at the tackle 0..1 (1 = just pushed ahead). */
  timing: number
  slide: boolean
  combo: number
}

/** Points for a won tackle (0 otherwise; fouls and getting beaten are penalties). */
export function tacklePoints(i: TackleScoreInput): number {
  if (!i.won) return 0
  const base = 100 + (i.timing >= 0.75 ? 50 : 0) + (i.slide ? 20 : 0)
  return Math.round(base * comboMultiplier(i.combo))
}

export const FOUL_PENALTY = -40
export const BEATEN_PENALTY = -25

// ───────────────────────── Distribution & claiming (2.3#2) ─────────────────────────

/** A team-mate counts as found when the ball comes to within this many metres of him (below head height). */
export const DIST_RECEIVE_R = 1.7
/** Up to this range the keeper throws / rolls it; beyond it he kicks from his hands. */
export const DIST_THROW_RANGE = 24
/** Release within this many seconds of the catch earns the quick-restart bonus. */
export const DIST_QUICK_S = 2
/** Held cross / punched-away cross. */
export const DIST_CLAIM_POINTS = 25
export const DIST_PUNCH_POINTS = 8

export interface DistributionScoreInput {
  /** 0..1: 1 = ball met the team-mate exactly. */
  accuracy: number
  /** Released within {@link DIST_QUICK_S}. */
  quick: boolean
  /** Found a team-mate with a kick beyond the throwing range. */
  far: boolean
  combo: number
}

/** Points for a distribution that found a team-mate. */
export function distributionPoints(i: DistributionScoreInput): number {
  const base = 70 + clamp01(i.accuracy) * 50 + (i.quick ? 25 : 0) + (i.far ? 25 : 0)
  return Math.round(base * comboMultiplier(i.combo))
}

// ───────────────────────── Sprint starts (Acceleration) & contact (Balance) ─────────────────────────

/** Length of one sprint rep (m): the first yards, where acceleration (not top speed) wins. */
export const SPRINT_DISTANCE = 15
/** The "dip" at the line: a tap within this many metres before the line. */
export const SPRINT_DIP_M = 1.2

export type ReactionGrade = 'perfect' | 'good' | 'slow'
/** Reaction to the start light (s): ≤ 0.18 perfect, ≤ 0.32 good. */
export function reactionGrade(reaction: number): ReactionGrade {
  if (reaction <= 0.18) return 'perfect'
  if (reaction <= 0.32) return 'good'
  return 'slow'
}

export interface SprintScoreInput {
  reaction: ReactionGrade
  /** Rep time from the light to the line (s), reaction included. */
  time: number
  dip: boolean
  /** Contact variant: braced the shoulder charge (true), stumbled (false), no contact (undefined). */
  braced?: boolean
  combo: number
}

/**
 * Rep time (s, reaction included) from which the run earns points. 3.0 s since the drill runs on the match's
 * model.accel / model.topSpeed (a level-50 runner covers the 15 m in ≈ 2.4 s, 2.1 s at 90): at the old 3.6 s every
 * decent run hit the 110 cap and Acceleration / Balance stopped showing.
 */
export const SPRINT_PAR_TIME = 3.0

/** Points for a sprint rep: reaction + time under SPRINT_PAR_TIME + dip (+ brace in the contact variant). */
export function sprintPoints(i: SprintScoreInput): number {
  const react = i.reaction === 'perfect' ? 60 : i.reaction === 'good' ? 35 : 10
  // The run itself (Acceleration, Pace, Balance through a charge): every 0.1 s under SPRINT_PAR_TIME is worth 10.
  const time = Math.round(Math.max(0, Math.min(110, (SPRINT_PAR_TIME - i.time) * 100)))
  const brace = i.braced === true ? 40 : 0
  const base = 30 + react + time + (i.dip ? 15 : 0) + brace
  return Math.round(base * (i.reaction !== 'slow' && i.braced !== false ? comboMultiplier(i.combo) : 1))
}
export const FALSE_START_PENALTY = -20

/** Brace window (s) before the shoulder charge lands: balance and strength widen it. */
export const braceWindow = (balance: number, strength: number): number =>
  0.26 + clamp01(balance / 100) * 0.22 + clamp01(strength / 100) * 0.08
/** Speed kept after a charge you did not brace for (balance keeps you up). */
export const stumbleKeep = (balance: number): number => 0.3 + clamp01(balance / 100) * 0.3

// ───────────────────────── Reading the game (Anticipation) & pressing (Work Rate) ─────────────────────────

/** How early the passer's intention shows (s before the release): anticipation reads it sooner. */
export const readTell = (anticipation: number): number => 0.25 + clamp01(anticipation / 100) * 0.8

export interface InterceptScoreInput {
  /** Stood in the lane before the ball left the passer's foot. */
  read: boolean
  combo: number
}
/** Points for an interception: 100, +50 when you had read it before the release. */
export const interceptPoints = (i: InterceptScoreInput): number => Math.round((100 + (i.read ? 50 : 0)) * comboMultiplier(i.combo))

/** Radius (m) the presser must close to before the receiver releases. */
export const PRESS_RADIUS = 2.2
/** Points for a successful press: 50 + 60 per second still left on the receiver's clock (up to 1.5 s). */
export const pressPoints = (spare: number, combo: number): number =>
  Math.round((50 + Math.max(0, Math.min(1.5, spare)) * 60) * comboMultiplier(combo))
/**
 * Stamina drain per second of sprinting while pressing: work rate makes the running cheaper. Steeper in Work Rate
 * since the presser runs at the match's topSpeed (Pace): the will to keep going is now how long he can sprint, not
 * how fast (0.29/s at Work Rate 25 … 0.13/s at 95, Stamina 60).
 */
export const pressDrain = (workRate: number, stamina: number): number =>
  0.25 * (1.5 - clamp01(workRate / 100) * 0.9 - clamp01(stamina / 100) * 0.2)

// ───────────────────────── XP preview ─────────────────────────

/**
 * Mirror of `qualityFactor` in sim/career/training.ts, for UI previews
 * ("+38 XP at this grade"). Kept here so the scene needs no sim import.
 */
export const xpQuality = (performance: number): number =>
  Math.max(0.15, (1.02 / Math.pow(0.6, 1.2)) * Math.pow(clamp01(performance), 1.2))

/**
 * Curl-gate goal: placement pays. A goal through the middle of the mouth earns CURL_GATE_MIDDLE_GOAL_POINTS,
 * one into the gate (outer third, 2.55 m off centre) the full CURL_GATE_POINTS, linear in between.
 */
export const curlGoalPoints = (offCentre: number): number =>
  Math.round(CURL_GATE_MIDDLE_GOAL_POINTS + (CURL_GATE_POINTS - CURL_GATE_MIDDLE_GOAL_POINTS) * clamp01((offCentre - 0.4) / 2.15))
