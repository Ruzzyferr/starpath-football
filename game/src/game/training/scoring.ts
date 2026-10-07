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
  finishing: 30,
  passing: 35,
  dribbling: 30,
  fitness: 40,
  goalkeeping: 30,
}

/** Points that count as a top session (performance ≈ 1). Calibrated with scripted bots (drills.test.ts). */
export const DRILL_PAR: Readonly<Record<DrillKind, number>> = {
  finishing: 1600,
  passing: 1900,
  dribbling: 2300,
  fitness: 1500,
  goalkeeping: 1000,
}

/** Which drill a training session plays (null = no mini-game, auto only). */
export const DRILL_FOR_TRAINING: Readonly<Record<TrainingType, { kind: DrillKind; variant: DrillVariant } | null>> = {
  shooting: { kind: 'finishing', variant: 'standard' },
  setPiece: { kind: 'finishing', variant: 'setPiece' },
  passing: { kind: 'passing', variant: 'standard' },
  tactical: { kind: 'passing', variant: 'standard' },
  dribbling: { kind: 'dribbling', variant: 'standard' },
  physical: { kind: 'fitness', variant: 'standard' },
  goalkeeping: { kind: 'goalkeeping', variant: 'standard' },
  recovery: null,
}

/** Raw points → 0..1 performance. */
export function performanceFromPoints(kind: DrillKind, points: number): number {
  const r = Math.max(0, points) / DRILL_PAR[kind]
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

export const SKILL_POINTS: Readonly<Record<SkillTiming, number>> = { perfect: 120, good: 60, early: 0, late: 0 }
export const GATE_POINTS = 60
export const GATE_MISS_PENALTY = -20
export const CONE_PENALTY = -30
export const TACKLED_PENALTY = -40

/** Lap bonus: 200 plus 20 per second under par. */
export function lapPoints(lapTime: number, par: number): number {
  return Math.round(200 + Math.max(0, par - lapTime) * 20)
}

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

/** Points for a shot faced on target. */
export function savePoints(i: SaveScoreInput): number {
  if (!i.saved) return 0
  const base = 100 + (i.held ? 30 : 0) + Math.round(clamp01(i.stretch) * 30) + Math.max(0, Math.min(20, i.speed - 18))
  return Math.round(base * comboMultiplier(i.combo))
}

// ───────────────────────── XP preview ─────────────────────────

/**
 * Mirror of `qualityFactor` in sim/career/training.ts, for UI previews
 * ("+38 XP at this grade"). Kept here so the scene needs no sim import.
 */
export const xpQuality = (performance: number): number => 0.3 + 1.2 * clamp01(performance)
