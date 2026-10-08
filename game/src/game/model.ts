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
}

/** What an AI agent is currently trying to do. */
export type AgentIntent =
  | { kind: 'run'; to: Vec2; until: number; chase?: boolean }
  | { kind: 'press'; target: string }
  | { kind: 'mark'; target: string }
  | { kind: 'hold' }

/** Top speed (m/s) from pace, sprinting or not. */
export function topSpeed(a: Agent): number {
  const pace = a01(a.attrs.pace)
  const base = 5.2 + pace * 1.6
  return a.sprint && a.stamina > 0.05 ? base + 1.4 + pace * 1.2 : base
}

/** Acceleration (m/s²): the acceleration attribute (first yards), a little agility (balance on the turn). */
export function accel(a: Agent): number {
  return 9 + a01(a.attrs.acceleration ?? a.attrs.pace) * 7 + a01(a.attrs.agility) * 2
}
