/**
 * "You vs opponent" for the training drills: who the drill's opposition is, the attributes they
 * play with (the very sheet the drill builds them from) and the hero's attributes that answer
 * them. Shown on the drill's intro card so the player can see the duel is fair.
 */
import type { AttributeKey, Attributes } from '../../core/types'
import { flatAttrs } from '../setup'
import { clampN } from '../model'
import { DEFAULT_OPP_LEVEL } from './base'
import type { DrillKind, DrillVariant } from './types'

export type DrillOppRole = 'keeper' | 'dribbler' | 'defenders' | 'passers' | 'shooter' | 'attackers' | 'mannequins'

interface Spec {
  role: DrillOppRole
  /** Hero attribute ↔ opponent attribute, most decisive first. */
  pairs: [AttributeKey, AttributeKey][]
  /** The opponent is a keeper (his goalkeeping sheet). */
  gk?: boolean
  /** Opponent level offset from the drill's opposition level (the header machine's keeper is 16 below it). */
  offset?: number
}

const SPECS: Partial<Record<string, Spec>> = {
  finishing: { role: 'keeper', gk: true, pairs: [['finishing', 'reflexes'], ['shooting', 'diving'], ['composure', 'handling']] },
  setPiece: { role: 'keeper', gk: true, pairs: [['setPieces', 'reflexes'], ['curve', 'diving'], ['shooting', 'gkPositioning']] },
  heading: { role: 'keeper', gk: true, offset: -16, pairs: [['heading', 'reflexes'], ['jumping', 'diving'], ['strength', 'handling']] },
  tackling: { role: 'dribbler', pairs: [['tackling', 'dribbling'], ['positioning', 'agility'], ['pace', 'pace'], ['strength', 'balance']] },
  dribbling: { role: 'mannequins', pairs: [['dribbling', 'tackling'], ['agility', 'anticipation']] },
  rondo: { role: 'defenders', pairs: [['passing', 'anticipation'], ['firstTouch', 'pace'], ['composure', 'aggression']] },
  interception: { role: 'passers', pairs: [['anticipation', 'vision'], ['pace', 'passing'], ['acceleration', 'composure']] },
  press: { role: 'passers', pairs: [['workRate', 'passing'], ['stamina', 'composure'], ['pace', 'vision']] },
  goalkeeping: { role: 'shooter', pairs: [['reflexes', 'shooting'], ['diving', 'finishing'], ['handling', 'shooting']] },
  distribution: { role: 'attackers', pairs: [['handling', 'crossing'], ['jumping', 'jumping'], ['gkPositioning', 'aggression']] },
}

const specFor = (kind: DrillKind, variant: DrillVariant = 'standard'): Spec | null =>
  (variant !== 'standard' ? SPECS[variant] : undefined) ?? SPECS[kind] ?? null

/** True when the drill has an opposition (keeper, dribbler, defenders, passers, shooter…). */
export const drillHasOpponent = (kind: DrillKind, variant: DrillVariant = 'standard'): boolean => !!specFor(kind, variant)

/** The opposition's attribute sheet at a level (exactly what the drill builds its opponents from). */
export function drillOpponentAttrs(kind: DrillKind, variant: DrillVariant, level: number): Attributes {
  const s = specFor(kind, variant)
  return flatAttrs(level + (s?.offset ?? 0), !!s?.gk)
}

/**
 * Opposition level for a training drill: the default training partner (56) pulled 40 % toward the
 * squad's level (the hero's own level when there is no squad yet), plus the game difficulty. A
 * better hero meets better partners, but by much less than he improves himself.
 */
export function trainingOpponentLevel(heroLevel: number, squadLevel: number | null, difficulty = 1): number {
  const base = squadLevel && squadLevel > 0 ? squadLevel : heroLevel
  return Math.round(clampN(DEFAULT_OPP_LEVEL + (base - DEFAULT_OPP_LEVEL) * 0.4 + (difficulty - 1) * 40, 35, 85))
}

export interface DrillMatchupRow {
  heroKey: AttributeKey
  oppKey: AttributeKey
  heroV: number
  oppV: number
  /** 1 = hero ahead, -1 = opponent ahead, 0 = within 3. */
  edge: -1 | 0 | 1
}

export interface DrillMatchup {
  role: DrillOppRole
  level: number
  rows: DrillMatchupRow[]
  edge: -1 | 0 | 1
}

const edgeOf = (d: number, tol: number): -1 | 0 | 1 => (d > tol ? 1 : d < -tol ? -1 : 0)

/** You vs opponent for a drill (null when the drill has no opposition). */
export function drillMatchup(kind: DrillKind, variant: DrillVariant, hero: Attributes, level: number): DrillMatchup | null {
  if (!drillHasOpponent(kind, variant)) return null
  const s = specFor(kind, variant)!
  const opp = drillOpponentAttrs(kind, variant, level)
  const rows = s.pairs.map(([h, o]): DrillMatchupRow => {
    const heroV = Math.round(hero[h])
    const oppV = Math.round(clampN(opp[o], 1, 99))
    return { heroKey: h, oppKey: o, heroV, oppV, edge: edgeOf(heroV - oppV, 3) }
  })
  const avg = rows.reduce((a, r) => a + r.heroV - r.oppV, 0) / rows.length
  return { role: s.role, level: Math.round(level + (s.offset ?? 0)), rows, edge: edgeOf(avg, 3) }
}
