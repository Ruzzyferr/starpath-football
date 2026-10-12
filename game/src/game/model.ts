/**
 * Shared runtime model for the interactive highlight player: vector helpers,
 * the Agent (a player on the pitch during a highlight) and geometry constants.
 * Pure TypeScript — no Phaser imports — so it can be unit tested in node.
 */
import type { Attributes, Position } from '../core/types'
import type { Vec2 } from '../sim/match/types'
import { PITCH_LENGTH, PITCH_WIDTH } from '../sim/match/types'

export type { Vec2 }

/** Team relative to the hero: hero's team always attacks +x (the east goal). */
export type Team = 'hero' | 'opp'

/** x of the goal the hero's team attacks. */
export const ATTACK_GOAL_X = PITCH_LENGTH
/** x of the goal the hero's team defends. */
export const DEFEND_GOAL_X = 0
export const CENTER_Y = PITCH_WIDTH / 2

// ───────────────────────── Vector helpers ─────────────────────────

export const v2 = (x = 0, y = 0): Vec2 => ({ x, y })
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y })
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y })
export const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s })
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y
export const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x
export const len = (a: Vec2): number => Math.hypot(a.x, a.y)
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y)
export const lerpV = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
export const angleOf = (a: Vec2): number => Math.atan2(a.y, a.x)
export const fromAngle = (r: number, l = 1): Vec2 => ({ x: Math.cos(r) * l, y: Math.sin(r) * l })
export const rotate = (a: Vec2, r: number): Vec2 => {
  const c = Math.cos(r)
  const s = Math.sin(r)
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c }
}
/** Unit vector (zero vector stays zero). */
export const norm = (a: Vec2): Vec2 => {
  const l = Math.hypot(a.x, a.y)
  return l > 1e-9 ? { x: a.x / l, y: a.y / l } : { x: 0, y: 0 }
}
/** Clamp vector length. */
export const clampLen = (a: Vec2, max: number): Vec2 => {
  const l = Math.hypot(a.x, a.y)
  return l > max ? { x: (a.x / l) * max, y: (a.y / l) * max } : a
}
/** Smallest signed difference between two angles (radians), in (-π, π]. */
export const angleDiff = (a: number, b: number): number => {
  let d = a - b
  while (d > Math.PI) d -= Math.PI * 2
  while (d <= -Math.PI) d += Math.PI * 2
  return d
}
/** Distance from point p to segment ab, plus the projection parameter t ∈ [0,1]. */
export function pointSegment(p: Vec2, a: Vec2, b: Vec2): { d: number; t: number } {
  const ab = sub(b, a)
  const l2 = dot(ab, ab)
  const t = l2 > 1e-9 ? Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2)) : 0
  return { d: dist(p, { x: a.x + ab.x * t, y: a.y + ab.y * t }), t }
}
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
export const clampN = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
/** Attribute 0..100 → 0..1. */
export const a01 = (v: number) => clamp01(v / 100)

// ───────────────────────── Agent ─────────────────────────

/** Animation / control state of an agent. */
export type AgentState = 'run' | 'slide' | 'dive' | 'jump' | 'down' | 'celebrate' | 'skill' | 'wall'

/** A player on the pitch during a highlight. */
export interface Agent {
  id: string
  team: Team
  number: number
  role: Position
  isHero: boolean
  isKeeper: boolean
  name: string
  attrs: Attributes
  relationToHero: number
  pos: Vec2
  vel: Vec2
  /** Facing angle (radians, pitch coordinates). */
  facing: number
  /** Formation anchor at the start of the moment. */
  anchor: Vec2
  state: AgentState
  /** Seconds spent in current state. */
  stateT: number
  /** Body height off the ground for jumps/dives (m). */
  z: number
  /** Direction of an ongoing slide/dive. */
  actionDir: Vec2
  /** Seconds during which this agent cannot touch the ball (after losing it, being beaten…). */
  noTouch: number
  /** Seconds of AI "thinking" lag before the next decision. */
  think: number
  /** Wants to sprint this frame. */
  sprint: boolean
  /** 0..1 stamina for sprinting (hero only meaningfully drains). */
  stamina: number
  /** Arbitrary AI memory. */
  intent: AgentIntent | null
  /** Position/height at the previous fixed step (for render interpolation). */
  prev: { x: number; y: number; z: number; facing: number }
  /** Dribble touch phase 0..1 while carrying the ball (1 = ball furthest ahead). */
  touch: number
  /** Generic action cooldown (tackles, jumps, skills), seconds. */
  cd: number
  /** Top-speed multiplier from match fatigue (1 = fresh legs; see {@link legsFor}). Missing = 1. */
  legs?: number
}

/** What an AI agent is currently trying to do. */
export type AgentIntent =
  | { kind: 'run'; to: Vec2; until: number; chase?: boolean; support?: boolean }
  | { kind: 'press'; target: string }
  | { kind: 'mark'; target: string }
  | { kind: 'hold' }

/** Top speed (m/s) from pace, sprinting or not (tired legs late in the match run slower). */
export function topSpeed(a: Agent): number {
  const pace = a01(a.attrs.pace)
  const base = 5.2 + pace * 1.6
  return (a.sprint && a.stamina > 0.05 ? base + 1.4 + pace * 1.2 : base) * (a.legs ?? 1)
}

// ───────────────────────── Match fatigue (Stamina, Work Rate) ─────────────────────────

/** Per-minute fatigue of the match sim (sim/match/engine updateFatigue): Stamina saves legs, Work Rate costs them. */
export function fatiguePerMinute(stamina: number, workRate: number | undefined, keeper = false): number {
  if (keeper) return 0.003
  return 0.0085 * (1.3 - stamina / 100) * (0.85 + clamp01((workRate ?? 50) / 100) * 0.3)
}

/** Expected condition (1 − fatigue, 0..1) at `minute` for a player who started the match. */
export function conditionAt(minute: number, stamina: number, workRate: number | undefined, keeper = false): number {
  return clamp01(1 - Math.max(0, minute) * fatiguePerMinute(stamina, workRate, keeper))
}

/** Condition above which the legs are fresh: tiredness only bites late in a match. */
export const FRESH_CONDITION = 0.75

/** Top-speed multiplier for a condition: 1 while fresh, −25 % per unit of condition below {@link FRESH_CONDITION}. */
export const legsFor = (condition: number): number => 1 - 0.25 * Math.max(0, FRESH_CONDITION - clamp01(condition))

/** Sprint tank at the start of a moment: full early on, emptier late for a tired player. */
export const sprintTankFor = (condition: number): number => clamp01(0.45 + 0.65 * clamp01(condition))

/** Accuracy-noise multiplier from fatigue: tired legs, tired technique (+30 % per unit below fresh). */
export const fatigueNoise = (condition: number): number => 1 + 0.3 * Math.max(0, FRESH_CONDITION - clamp01(condition))

/**
 * Sprint stamina drained per second: Stamina sets the engine (−35 % at 100), Work Rate the willingness to keep
 * going (a hard worker paces his runs: −40 % from 0 to 100).
 */
export const sprintDrain = (stamina: number, workRate: number | undefined): number =>
  0.22 * (1.3 - 0.6 * a01(stamina)) * (1.25 - 0.5 * a01(workRate ?? 50))

/** Sprint stamina recovered per second when not sprinting (Stamina and Work Rate both help). */
export const sprintRecover = (stamina: number, workRate: number | undefined): number =>
  0.12 * (0.7 + 0.4 * a01(stamina) + 0.2 * a01(workRate ?? 50))

/** Hero turning rate (rad/s) from Agility: 9 at 0, 19 at 100 (≈ 15.5 for a 65). */
export const heroTurnRate = (agility: number): number => 9 + a01(agility) * 10

/**
 * Change-of-direction multiplier on acceleration (Agility): 1 when carrying on straight, and on a full turn
 * ×0.7 at Agility 40 up to ×1.24 at 85 (1 for a 65).
 */
export function turnAccelMult(a: Agent, desired: Vec2): number {
  const v = Math.hypot(a.vel.x, a.vel.y)
  const d = Math.hypot(desired.x, desired.y)
  if (v < 0.5 || d < 0.1) return 1
  const cos = (a.vel.x * desired.x + a.vel.y * desired.y) / (v * d)
  const turn = clamp01(1 - cos)
  return 1 + (a01(a.attrs.agility) - 0.65) * 1.2 * turn
}

/** Acceleration (m/s²): the acceleration attribute (first yards), a little agility (balance on the turn). */
export function accel(a: Agent): number {
  return 6.6 + a01(a.attrs.acceleration ?? a.attrs.pace) * 10 + a01(a.attrs.agility) * 2
}

/** Height (m) a player's jump lifts him, from Jumping (0.45 m at 40 … 0.80 m at 85; 0.25–0.95). */
export function jumpHeight(jumping: number): number {
  return clampN(0.45 + (jumping - 40) * (0.35 / 45), 0.25, 0.95)
}
