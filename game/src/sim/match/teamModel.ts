/**
 * Team strength model: per-player unit skills, team unit ratings from the
 * players currently on the pitch, and tactic-style / weather profiles.
 */
import { clamp } from '../../core/rng'
import type { Attributes, Position, TacticStyle } from '../../core/types'
import type { MatchPlayer, Weather } from './types'

/** Player's skill in each team unit, 0..100. */
export interface UnitSkills {
  gk: number
  def: number
  mid: number
  att: number
}

/** Team unit ratings (0..100 scale, before modifiers). */
export interface TeamRatings {
  gk: number
  def: number
  mid: number
  att: number
  /** Players on the pitch. */
  n: number
}

type Mix = Partial<Record<keyof Attributes, number>>

const DEF_MIX: Mix = { tackling: 0.25, positioning: 0.17, anticipation: 0.12, strength: 0.1, balance: 0.05, heading: 0.12, pace: 0.08, acceleration: 0.06, aggression: 0.05 }
const MID_MIX: Mix = { passing: 0.24, longPassing: 0.08, vision: 0.18, firstTouch: 0.14, workRate: 0.13, stamina: 0.1, dribbling: 0.08, anticipation: 0.05 }
const ATT_MIX: Mix = { finishing: 0.28, shooting: 0.12, curve: 0.04, dribbling: 0.18, pace: 0.09, acceleration: 0.08, composure: 0.1, firstTouch: 0.08, anticipation: 0.03 }
const GK_MIX: Mix = { reflexes: 0.28, diving: 0.2, handling: 0.22, gkPositioning: 0.18, positioning: 0.04, composure: 0.08 }
/** A keeper's share of the build-up is his distribution (throws, kicks out of the hands). */
const GK_DIST_MIX: Mix = { gkDistribution: 0.55, passing: 0.15, longPassing: 0.15, vision: 0.15 }

/** Contribution weight of each position to [def, mid, att]. */
const UNIT_WEIGHTS: Record<Position, readonly [number, number, number]> = {
  GK: [0, 0.08, 0],
  CB: [1.0, 0.1, 0],
  LB: [0.8, 0.35, 0.15],
  RB: [0.8, 0.35, 0.15],
  DM: [0.5, 0.8, 0.05],
  CM: [0.2, 1.0, 0.25],
  AM: [0, 0.7, 0.6],
  LW: [0.05, 0.35, 0.9],
  RW: [0.05, 0.35, 0.9],
  ST: [0, 0.1, 1.0],
}

function mix(attrs: Attributes, m: Mix): number {
  let s = 0
  let w = 0
  for (const k in m) {
    const weight = m[k as keyof Attributes] ?? 0
    s += (attrs[k as keyof Attributes] ?? 50) * weight
    w += weight
  }
  return w > 0 ? s / w : 50
}

/** Unit skills for one player: 75% attributes, 25% overall rating. */
export function unitSkills(p: MatchPlayer): UnitSkills {
  const blend = (v: number) => v * 0.75 + p.ovr * 0.25
  return {
    gk: blend(mix(p.attrs, GK_MIX)),
    def: blend(mix(p.attrs, DEF_MIX)),
    mid: blend(mix(p.attrs, p.position === 'GK' ? GK_DIST_MIX : MID_MIX)),
    att: blend(mix(p.attrs, ATT_MIX)),
  }
}

/** One on-pitch player as seen by the rating function. */
export interface RatedPlayer {
  position: Position
  skills: UnitSkills
  /** 0..1 */
  fatigue: number
}

/** After this minute, players under {@link LATE_TIRED_CONDITION} condition lose pace and first touch. */
export const LATE_TIRED_MINUTE = 70
/** Condition (1 − fatigue) below which the late cut applies (40%). */
export const LATE_TIRED_CONDITION = 0.4
/** Pace / first-touch multiplier for late-tired players (−10%). */
export const LATE_TIRED_MULT = 0.9

/** True when a player is running on empty late on (GAP 2.1#12). */
export function isLateTired(minute: number, fatigue: number): boolean {
  return minute >= LATE_TIRED_MINUTE && 1 - fatigue < LATE_TIRED_CONDITION
}

/** Pace and first touch −10% (used both by the sim ratings and the live moment's players). */
export function lateFatigueAttrs<A extends { pace: number; firstTouch: number }>(a: A): A {
  return { ...a, pace: Math.round(a.pace * LATE_TIRED_MULT), firstTouch: Math.round(a.firstTouch * LATE_TIRED_MULT) }
}

/** Chance-rate boost for the side that just scored in a hero moment, fading linearly over MOMENTUM_MINUTES. */
export const MOMENTUM_BOOST = 0.15
export const MOMENTUM_MINUTES = 10

/** Momentum multiplier for `att` (1 when none or faded). */
export function momentumFactor(m: { side: 'home' | 'away'; from: number } | null | undefined, att: 'home' | 'away', clock: number): number {
  if (!m || m.side !== att) return 1
  const left = 1 - (clock - m.from) / MOMENTUM_MINUTES
  return left > 0 ? 1 + MOMENTUM_BOOST * Math.min(1, left) : 1
}

/** Multiplier from fatigue: fresh 1.0, exhausted ≈ 0.82. */
export function fatigueFactor(f: number): number {
  return 1 - 0.18 * clamp(f, 0, 1)
}

/**
 * Team unit ratings. Each unit is the weighted average of contributing
 * players, scaled down when the team is short of players (red cards / injuries
 * without subs): (n / 11)^0.9.
 */
export function computeRatings(players: readonly RatedPlayer[]): TeamRatings {
  const acc = [0, 0, 0]
  const wsum = [0, 0, 0]
  let gk = 0
  let gkFound = false
  for (const p of players) {
    const f = fatigueFactor(p.fatigue)
    if (p.position === 'GK' && !gkFound) {
      gk = p.skills.gk * (0.97 + 0.03 * f)
      gkFound = true
      continue
    }
    const w = UNIT_WEIGHTS[p.position]
    const vals = [p.skills.def, p.skills.mid, p.skills.att]
    for (let i = 0; i < 3; i++) {
      acc[i]! += w[i]! * vals[i]! * f
      wsum[i]! += w[i]!
    }
  }
  if (!gkFound) {
    // An outfielder in goal: use the best outfield gk skill, heavily penalized.
    gk = Math.max(15, ...players.map((p) => p.skills.gk)) * 0.6
  }
  const short = Math.pow(players.length / 11, 0.9)
  const avg = (i: number) => (wsum[i]! > 0 ? acc[i]! / wsum[i]! : 30) * short
  return { gk, def: avg(0), mid: avg(1), att: avg(2), n: players.length }
}

/** Tactic style modifiers. */
export interface StyleProfile {
  /** Midfield control multiplier (possession). */
  control: number
  /** Chance creation rate multiplier. */
  tempo: number
  /** Own shot quality multiplier. */
  quality: number
  /** Multiplier applied to the OPPONENT's chance rate. */
  concede: number
  /** Multiplier applied to the OPPONENT's shot quality. */
  concedeQuality: number
  /** Extra danger when winning the ball back (counter attacks). */
  counter: number
  fatigue: number
  fouls: number
}

/** Style table; 'balanced' is neutral. */
export const STYLES: Record<TacticStyle, StyleProfile> = {
  balanced: { control: 1, tempo: 1, quality: 1, concede: 1, concedeQuality: 1, counter: 1, fatigue: 1, fouls: 1 },
  possession: { control: 1.12, tempo: 0.95, quality: 1.08, concede: 0.97, concedeQuality: 1, counter: 0.9, fatigue: 0.95, fouls: 0.9 },
  counter: { control: 0.9, tempo: 0.95, quality: 1.04, concede: 0.97, concedeQuality: 0.97, counter: 1.8, fatigue: 1, fouls: 1 },
  pressing: { control: 1.05, tempo: 1.06, quality: 1, concede: 0.98, concedeQuality: 1.04, counter: 1.2, fatigue: 1.2, fouls: 1.2 },
  direct: { control: 0.95, tempo: 1.12, quality: 0.88, concede: 1.02, concedeQuality: 1, counter: 1.1, fatigue: 1.05, fouls: 1.05 },
  defensive: { control: 0.9, tempo: 0.85, quality: 0.97, concede: 0.86, concedeQuality: 0.92, counter: 1.3, fatigue: 0.95, fouls: 1.1 },
}

/** Weather modifiers. */
export interface WeatherProfile {
  fatigue: number
  /** Multiplies shooter accuracy (goal probability). */
  accuracy: number
  /** Multiplies chance creation (passing quality). */
  passing: number
  /** Extra goal probability from keeper handling errors (multiplier). */
  keeperError: number
}

export const WEATHER: Record<Weather, WeatherProfile> = {
  clear: { fatigue: 1, accuracy: 1, passing: 1, keeperError: 1 },
  rain: { fatigue: 1.05, accuracy: 0.97, passing: 0.97, keeperError: 1.1 },
  snow: { fatigue: 1.1, accuracy: 0.95, passing: 0.92, keeperError: 1.08 },
  wind: { fatigue: 1, accuracy: 0.93, passing: 0.97, keeperError: 1.04 },
  hot: { fatigue: 1.3, accuracy: 1, passing: 0.98, keeperError: 1 },
}

/** Position weights for picking a shooter in open play. */
export const SHOOT_WEIGHT: Record<Position, number> = {
  GK: 0, CB: 0.35, LB: 0.4, RB: 0.4, DM: 0.6, CM: 1.3, AM: 2.6, LW: 2.8, RW: 2.8, ST: 5,
}

/** Position weights for picking a header taker at set pieces. */
export const HEAD_WEIGHT: Record<Position, number> = {
  GK: 0, CB: 3, LB: 0.6, RB: 0.6, DM: 1.2, CM: 1, AM: 0.7, LW: 0.8, RW: 0.8, ST: 3,
}

/** Position weights for picking an assister. */
export const ASSIST_WEIGHT: Record<Position, number> = {
  GK: 0.05, CB: 0.3, LB: 1.2, RB: 1.2, DM: 0.8, CM: 1.8, AM: 3, LW: 2.6, RW: 2.6, ST: 1.6,
}

/** Position weights for picking who commits a foul / gets booked. */
export const FOUL_WEIGHT: Record<Position, number> = {
  GK: 0.1, CB: 1.6, LB: 1.3, RB: 1.3, DM: 1.8, CM: 1.3, AM: 0.8, LW: 0.8, RW: 0.8, ST: 0.9,
}

/** Coarse group for substitution matching. */
export function positionGroup(p: Position): 0 | 1 | 2 | 3 {
  if (p === 'GK') return 0
  if (p === 'CB' || p === 'LB' || p === 'RB') return 1
  if (p === 'DM' || p === 'CM' || p === 'AM') return 2
  return 3
}

/** Penalty-taking score. */
export function penaltySkill(a: Attributes): number {
  return a.composure * 0.4 + a.finishing * 0.3 + a.setPieces * 0.3
}

/** Direct free-kick score. */
export function freekickSkill(a: Attributes): number {
  return a.setPieces * 0.45 + a.curve * 0.3 + a.shooting * 0.25
}

/** Corner delivery skill (designated corner taker). */
export function cornerSkill(a: Attributes): number {
  return a.crossing * 0.45 + a.curve * 0.3 + a.setPieces * 0.25
}

/** Scales an attribute-like value (0..100) into a ~0.6..1.4 multiplier around 60. */
export function skillMult(v: number): number {
  return clamp(0.6 + 0.8 * ((v - 30) / 60), 0.45, 1.5)
}
