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
}

/** Points that count as a top session (performance ≈ 1). Calibrated with scripted bots (drills.test.ts). */
export const DRILL_PAR: Readonly<Record<DrillKind, number>> = {
  finishing: 55,
  passing: 1900,
  dribbling: 200,
  fitness: 1500,
  goalkeeping: 66,
  crossing: 1900,
  heading: 1700,
  tackling: 1150,
  distribution: 650,
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
  recovery: null,
}

/** Variants with their own scoring scale (curl gate: 5 × 20 points). */
export const VARIANT_PAR: Readonly<Partial<Record<DrillVariant, number>>> = { setPiece: 80, rondo: 26 }
/** Variants with their own length (rondo: 60 s, 2.3#24). */
export const VARIANT_DURATION: Readonly<Partial<Record<DrillVariant, number>>> = { rondo: 60 }

/** Rondo (2.3#24): a completed pass 1, a one-touch pass 1.5; a lost ball resets the streak. */
export const rondoPassPoints = (completed: boolean, oneTouch: boolean): number => (!completed ? 0 : oneTouch ? 1.5 : 1)
/** Vision from which the third pass option (through the middle) is visible. */
export const RONDO_VISION_THIRD = 60

/** Curl gate (2.3#25): 5 free kicks over the wall, 20 points per kick between the posts. */
export const CURL_GATE_ATTEMPTS = 5
export const CURL_GATE_POINTS = 20
/** Wind for a curl-gate attempt: up to 7 m/s (≈ 25 km/h). */
export const CURL_GATE_MAX_WIND = 7
export const msToKmh = (ms: number): number => Math.round(ms * 3.6)

/** Raw points → 0..1 performance. */
export function performanceFromPoints(kind: DrillKind, points: number, variant: DrillVariant = 'standard'): number {
  const r = Math.max(0, points) / (VARIANT_PAR[variant] ?? DRILL_PAR[kind])
  return Math.round(clamp01(Math.pow(clamp01(r), 0.85)) * 1000) / 1000
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
/** From this shot on the keeper is live (2.3#23: moving keeper from level 3). */
export const GRID_KEEPER_FROM = 3
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
}

/** Points for one pass: completion + right technique (gate / over the wall) + quick release. */
export function passPoints(i: PassScoreInput): number {
  if (!i.received) return 0
  const rightType = i.wanted === 'loft' ? i.lofted : !i.lofted && i.gateCleared
  let p = 60
  if (rightType) p += 70
  if (i.release <= 1.2) p += 20
  return Math.round(p * (rightType ? comboMultiplier(i.combo) : 1))
}

/** Can a receiver control a ball arriving at `relSpeed` (m/s relative to him)? */
export const controllable = (relSpeed: number, firstTouch01: number): boolean => relSpeed < 9.5 + firstTouch01 * 9

// ───────────────────────── Dribbling ─────────────────────────

export type SkillTiming = 'perfect' | 'good' | 'early' | 'late'

/** Skill-move timing from the distance to the dummy defender (m). */
export function skillTiming(distance: number): SkillTiming {
  if (distance > 3.4) return 'early'
  if (distance < 0.9) return 'late'
  if (distance >= 1.4 && distance <= 2.5) return 'perfect'
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
export const levelSpeed = (level: number): number => 4.0 + 0.45 * (Math.max(1, level) - 1)

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

/** Chance that the keeper's hands hold a cross he got to (handling 0..100). */
export function claimChance(handling: number, contested: boolean, stretched: boolean, difficulty: number): number {
  const p = 0.4 + clamp01(handling / 100) * 0.55 - (contested ? 0.18 : 0) - (stretched ? 0.08 : 0) - (difficulty - 1) * 0.15
  return Math.max(0.1, Math.min(0.97, p))
}

// ───────────────────────── XP preview ─────────────────────────

/**
 * Mirror of `qualityFactor` in sim/career/training.ts, for UI previews
 * ("+38 XP at this grade"). Kept here so the scene needs no sim import.
 */
export const xpQuality = (performance: number): number =>
  Math.max(0.15, (1.02 / Math.pow(0.6, 1.2)) * Math.pow(clamp01(performance), 1.2))
