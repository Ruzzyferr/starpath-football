/**
 * Moment skill: the hero's execution skill (0..1) in a match moment comes from
 * that moment's OWN attributes, not a generic rating. A 1v1 finish is
 * Finishing / Composure / Shooting / Curve, a pass Passing / Vision / First
 * Touch, a through ball Vision / Passing, a cross Crossing / Curve, a standing
 * tackle Tackling / Anticipation / Aggression / Positioning.
 *
 * The runtime feeds this into the hero's kicks (kick.KickRequest.skill) and
 * the success curves are pinned by intent.test.ts (attribute 40…90).
 */
import type { AttributeKey, Attributes } from '../core/types'

export type MomentSkillKind = 'shot' | 'pass' | 'through' | 'cross' | 'tackle'

/** Weights of each moment's attributes (sum 1). */
export const MOMENT_WEIGHTS: Readonly<Record<MomentSkillKind, Readonly<Partial<Record<AttributeKey, number>>>>> = {
  shot: { finishing: 0.45, composure: 0.25, shooting: 0.2, curve: 0.1 },
  pass: { passing: 0.6, vision: 0.2, firstTouch: 0.2 },
  through: { vision: 0.5, passing: 0.4, longPassing: 0.1 },
  cross: { crossing: 0.7, curve: 0.3 },
  tackle: { tackling: 0.45, anticipation: 0.35, aggression: 0.1, positioning: 0.1 },
}

/** The attributes a moment kind is about. */
export const MOMENT_ATTRS: Readonly<Record<MomentSkillKind, readonly AttributeKey[]>> = {
  shot: Object.keys(MOMENT_WEIGHTS.shot) as AttributeKey[],
  pass: Object.keys(MOMENT_WEIGHTS.pass) as AttributeKey[],
  through: Object.keys(MOMENT_WEIGHTS.through) as AttributeKey[],
  cross: Object.keys(MOMENT_WEIGHTS.cross) as AttributeKey[],
  tackle: Object.keys(MOMENT_WEIGHTS.tackle) as AttributeKey[],
}

/** Fallbacks for attributes a pre-v6 sheet may lack. */
const FALLBACK: Partial<Record<AttributeKey, AttributeKey>> = { curve: 'setPieces', longPassing: 'passing', anticipation: 'positioning', aggression: 'tackling' }

/** 0..1 skill of a moment from its own attributes. */
export function momentSkill(kind: MomentSkillKind, at: Attributes): number {
  let s = 0
  for (const [k, w] of Object.entries(MOMENT_WEIGHTS[kind]) as [AttributeKey, number][]) {
    const v = at[k] ?? (FALLBACK[k] ? at[FALLBACK[k]!] : undefined) ?? 50
    s += w * v
  }
  return Math.max(0, Math.min(1, s / 100))
}
