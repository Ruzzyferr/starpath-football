/**
 * Attribute model shared by NPCs and the hero.
 *
 * - {@link POSITION_WEIGHTS}: how much each attribute contributes to OVR per position.
 * - {@link computeOvr}: weighted OVR, used for the hero too.
 * - {@link deriveAttributes}: rebuilds a full attribute sheet for an NpcPlayer
 *   from (ovr, position, styleSeed). NPCs only store those three numbers; the
 *   sheet is derived on demand (e.g. when a match needs it) and calibrated so
 *   that `computeOvr(deriveAttributes(p), p.position) ≈ p.ovr`.
 */
import { ATTRIBUTE_KEYS } from '../../core/types'
import type { AttributeKey, Attributes, NpcPlayer, Position } from '../../core/types'
import { Rng, clamp } from '../../core/rng'

export type PositionGroup = 'GK' | 'DEF' | 'MID' | 'FWD'
type WeightTable = Partial<Record<AttributeKey, number>>

const GROUP_OF: Readonly<Record<Position, PositionGroup>> = {
  GK: 'GK', CB: 'DEF', LB: 'DEF', RB: 'DEF', DM: 'MID', CM: 'MID', AM: 'MID', LW: 'FWD', RW: 'FWD', ST: 'FWD',
}

/** Coarse group of a position (GK / DEF / MID / FWD). */
export function positionGroup(pos: Position): PositionGroup {
  return GROUP_OF[pos]
}

const RAW_WEIGHTS: Record<Position, WeightTable> = {
  GK: { reflexes: 24, diving: 14, handling: 22, gkPositioning: 12, gkDistribution: 6, composure: 6, agility: 6, jumping: 5, passing: 2, firstTouch: 2, leadership: 2 },
  CB: { tackling: 22, positioning: 15, anticipation: 8, heading: 14, strength: 9, balance: 5, jumping: 7, composure: 6, pace: 5, acceleration: 2, passing: 4, longPassing: 2, aggression: 3, workRate: 3, leadership: 1 },
  LB: { tackling: 17, pace: 12, acceleration: 6, positioning: 10, anticipation: 4, crossing: 12, stamina: 10, passing: 8, dribbling: 6, workRate: 7, agility: 4, firstTouch: 5 },
  RB: { tackling: 17, pace: 12, acceleration: 6, positioning: 10, anticipation: 4, crossing: 12, stamina: 10, passing: 8, dribbling: 6, workRate: 7, agility: 4, firstTouch: 5 },
  DM: { tackling: 18, positioning: 12, anticipation: 7, passing: 12, longPassing: 6, strength: 8, stamina: 8, workRate: 9, aggression: 3, vision: 8, composure: 8, firstTouch: 7 },
  CM: { passing: 16, longPassing: 6, vision: 14, firstTouch: 10, stamina: 10, workRate: 8, tackling: 8, dribbling: 8, composure: 8, shooting: 7, positioning: 4, anticipation: 4 },
  AM: { passing: 16, vision: 18, dribbling: 16, firstTouch: 12, shooting: 8, curve: 4, finishing: 8, composure: 10, agility: 5, acceleration: 4, setPieces: 3 },
  LW: { pace: 12, acceleration: 8, dribbling: 20, crossing: 14, curve: 4, agility: 8, firstTouch: 10, passing: 7, finishing: 8, shooting: 5, stamina: 7 },
  RW: { pace: 12, acceleration: 8, dribbling: 20, crossing: 14, curve: 4, agility: 8, firstTouch: 10, passing: 7, finishing: 8, shooting: 5, stamina: 7 },
  ST: { finishing: 26, shooting: 10, composure: 12, positioning: 9, anticipation: 4, heading: 10, pace: 6, acceleration: 5, firstTouch: 10, dribbling: 5, strength: 3, balance: 3 },
}

function normalizeWeights(t: WeightTable): Readonly<WeightTable> {
  let total = 0
  for (const v of Object.values(t)) total += v ?? 0
  const out: WeightTable = {}
  for (const [k, v] of Object.entries(t) as [AttributeKey, number][]) out[k] = v / total
  return Object.freeze(out)
}

/**
 * Per-position OVR weights (each table sums to 1). Exported so the hero's OVR
 * and any UI breakdown use exactly the same formula as NPCs.
 */
export const POSITION_WEIGHTS: Readonly<Record<Position, Readonly<WeightTable>>> = Object.freeze({
  GK: normalizeWeights(RAW_WEIGHTS.GK),
  CB: normalizeWeights(RAW_WEIGHTS.CB),
  LB: normalizeWeights(RAW_WEIGHTS.LB),
  RB: normalizeWeights(RAW_WEIGHTS.RB),
  DM: normalizeWeights(RAW_WEIGHTS.DM),
  CM: normalizeWeights(RAW_WEIGHTS.CM),
  AM: normalizeWeights(RAW_WEIGHTS.AM),
  LW: normalizeWeights(RAW_WEIGHTS.LW),
  RW: normalizeWeights(RAW_WEIGHTS.RW),
  ST: normalizeWeights(RAW_WEIGHTS.ST),
})

function weightedOvr(attrs: Attributes, pos: Position): number {
  let s = 0
  for (const [k, w] of Object.entries(POSITION_WEIGHTS[pos]) as [AttributeKey, number][]) s += attrs[k] * w
  return s
}

/** Overall rating (1..99) of an attribute sheet when playing `pos`. */
export function computeOvr(attrs: Attributes, pos: Position): number {
  return clamp(Math.round(weightedOvr(attrs, pos)), 1, 99)
}

// ───────────────────────── Derivation ─────────────────────────

/** Default offset from OVR for attributes a position template does not mention. */
const OUTFIELD_DEFAULTS: Readonly<Record<AttributeKey, number>> = {
  pace: -4, stamina: -2, strength: -4, agility: -4, jumping: -6,
  passing: -6, shooting: -12, finishing: -14, dribbling: -8, firstTouch: -6, crossing: -12, heading: -10,
  tackling: -14, setPieces: -14,
  vision: -8, composure: -6, positioning: -8, leadership: -12, workRate: -4,
  reflexes: -62, handling: -62, gkPositioning: -58, gkDistribution: -54,
  acceleration: -4, longPassing: -10, curve: -14, anticipation: -8, aggression: -8, diving: -62, balance: -4,
}

const GK_DEFAULTS: Readonly<Record<AttributeKey, number>> = {
  pace: -22, stamina: -18, strength: -8, agility: 0, jumping: -2,
  passing: -14, shooting: -40, finishing: -50, dribbling: -35, firstTouch: -18, crossing: -40, heading: -35,
  tackling: -40, setPieces: -30,
  vision: -20, composure: -2, positioning: 0, leadership: -8, workRate: -15,
  reflexes: 3, handling: 2, gkPositioning: 1, gkDistribution: -4,
  acceleration: -20, longPassing: -10, curve: -30, anticipation: -6, aggression: -20, diving: 2, balance: -8,
}

/** Offsets from OVR that give each position its recognisable profile. */
const TEMPLATES: Readonly<Record<Position, WeightTable>> = {
  GK: { reflexes: 4, diving: 2, handling: 2, gkPositioning: 2, positioning: 1, agility: 1 },
  CB: { tackling: 4, positioning: 4, anticipation: 2, heading: 4, strength: 5, jumping: 3, aggression: 4, pace: -6, acceleration: -6, dribbling: -16, finishing: -28, shooting: -22, crossing: -18, curve: -16 },
  LB: { pace: 4, acceleration: 3, tackling: 2, crossing: 3, stamina: 4, finishing: -22, heading: -10 },
  RB: { pace: 4, acceleration: 3, tackling: 2, crossing: 3, stamina: 4, finishing: -22, heading: -10 },
  DM: { tackling: 3, positioning: 3, anticipation: 3, passing: 2, longPassing: 2, workRate: 4, stamina: 2, aggression: 2, finishing: -20, dribbling: -10 },
  CM: { passing: 4, longPassing: 2, vision: 2, stamina: 3, firstTouch: 1, tackling: -6, finishing: -10, heading: -12 },
  AM: { vision: 4, passing: 3, dribbling: 3, firstTouch: 2, curve: 0, tackling: -24, heading: -16, strength: -10, aggression: -12, setPieces: -2 },
  LW: { pace: 5, acceleration: 5, dribbling: 4, agility: 3, crossing: 2, tackling: -26, heading: -16, strength: -10, aggression: -12 },
  RW: { pace: 5, acceleration: 5, dribbling: 4, agility: 3, crossing: 2, tackling: -26, heading: -16, strength: -10, aggression: -12 },
  ST: { finishing: 5, composure: 2, positioning: 2, anticipation: 0, heading: -2, shooting: 0, tackling: -30, crossing: -16, longPassing: -14 },
}

/** Player "flavours" within a position; one is chosen per player from styleSeed. */
const FLAVOURS: Readonly<Record<Position, readonly WeightTable[]>> = {
  GK: [{}, { reflexes: 4, diving: 3, handling: -3, gkPositioning: -2 }, { gkDistribution: 12, passing: 10, longPassing: 10, firstTouch: 8, composure: 3, acceleration: 4 }, { jumping: 5, strength: 6, agility: -3, diving: -3, gkPositioning: 3 }],
  CB: [{}, { pace: 8, acceleration: 6, agility: 4, aggression: 4, strength: -4 }, { passing: 8, longPassing: 8, vision: 6, composure: 4, aggression: -4 }, { heading: 6, strength: 6, pace: -6 }],
  LB: [{}, { crossing: 6, dribbling: 6, tackling: -4 }, { tackling: 6, positioning: 4, crossing: -5 }],
  RB: [{}, { crossing: 6, dribbling: 6, tackling: -4 }, { tackling: 6, positioning: 4, crossing: -5 }],
  DM: [{}, { passing: 6, longPassing: 6, vision: 6, tackling: -3 }, { tackling: 6, strength: 6, aggression: 6, anticipation: 3, passing: -4 }],
  CM: [{}, { shooting: 8, finishing: 6, positioning: -3 }, { tackling: 8, workRate: 6, vision: -4 }, { dribbling: 6, agility: 4 }],
  AM: [{}, { shooting: 8, finishing: 8, passing: -3 }, { setPieces: 14, curve: 12, vision: 3 }, { dribbling: 6, agility: 6, acceleration: 4, vision: -3 }],
  LW: [{}, { finishing: 8, shooting: 6, curve: 6, crossing: -4 }, { crossing: 8, passing: 4, finishing: -4 }, { pace: 6, acceleration: 6, agility: 4, firstTouch: -3 }],
  RW: [{}, { finishing: 8, shooting: 6, curve: 6, crossing: -4 }, { crossing: 8, passing: 4, finishing: -4 }, { pace: 6, acceleration: 6, agility: 4, firstTouch: -3 }],
  ST: [{}, { heading: 10, strength: 10, jumping: 6, aggression: 6, pace: -8 }, { pace: 8, acceleration: 8, anticipation: 4, agility: 6, heading: -8 }, { passing: 8, vision: 8, finishing: -3 }],
}

const ATTR_NOISE_SD = 3.5

/**
 * Deterministically derive a full attribute sheet for an NPC. Same
 * (ovr, position, styleSeed) always yields the same sheet.
 */
export function deriveAttributes(p: Pick<NpcPlayer, 'ovr' | 'position' | 'styleSeed'>): Attributes {
  const rng = new Rng(p.styleSeed >>> 0)
  const defaults = p.position === 'GK' ? GK_DEFAULTS : OUTFIELD_DEFAULTS
  const template = TEMPLATES[p.position]
  const flavour = rng.pick(FLAVOURS[p.position])
  const raw = {} as Attributes
  for (const k of ATTRIBUTE_KEYS) {
    const offset = (template[k] ?? defaults[k]) + (flavour[k] ?? 0)
    raw[k] = p.ovr + offset + rng.normal(0, ATTR_NOISE_SD)
  }
  return calibrate(raw, p.position, p.ovr)
}

/** Shift a float sheet so its weighted OVR hits `target`, then round & clamp. */
function calibrate(raw: Attributes, pos: Position, target: number): Attributes {
  const a = { ...raw }
  for (let i = 0; i < 5; i++) {
    for (const k of ATTRIBUTE_KEYS) a[k] = clamp(a[k], 1, 99)
    const delta = target - weightedOvr(a, pos)
    if (Math.abs(delta) < 0.05) break
    for (const k of ATTRIBUTE_KEYS) a[k] += delta
  }
  const out = {} as Attributes
  for (const k of ATTRIBUTE_KEYS) out[k] = clamp(Math.round(a[k]), 1, 99)
  // Rounding can leave the weighted OVR one point off; nudge the top-weighted attribute.
  const diff = target - computeOvr(out, pos)
  if (diff !== 0) {
    const [topKey, topW] = topWeight(pos)
    out[topKey] = clamp(out[topKey] + Math.round(diff / topW), 1, 99)
  }
  return out
}

function topWeight(pos: Position): [AttributeKey, number] {
  let best: [AttributeKey, number] = ['passing', 0]
  for (const [k, w] of Object.entries(POSITION_WEIGHTS[pos]) as [AttributeKey, number][]) if (w > best[1]) best = [k, w]
  return best
}
