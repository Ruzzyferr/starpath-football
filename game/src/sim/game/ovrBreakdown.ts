/** "How is OVR calculated?" (2.3#11): the position weight table applied to the hero's attributes. */
import type { AttributeKey, Attributes, Position } from '../../core/types'
import { POSITION_WEIGHTS, ovrFor } from '../career/progression'

export interface OvrRow {
  key: AttributeKey
  value: number
  /** Share of the position's total weight, 0..1. */
  share: number
  /** Points this attribute adds to the overall: share x value. */
  points: number
}

export interface OvrBreakdown {
  ovr: number
  rows: OvrRow[]
  /** Unrounded weighted average. */
  raw: number
}

/** Rows sorted by weight (most important first). The row points sum to `raw`; `ovr` is `ovrFor`. */
export function ovrBreakdown(attrs: Attributes, position: Position): OvrBreakdown {
  const w = POSITION_WEIGHTS[position]
  const keys = Object.keys(w) as AttributeKey[]
  const total = keys.reduce((s, k) => s + (w[k] ?? 0), 0)
  const rows = keys
    .map((key) => {
      const share = total > 0 ? (w[key] ?? 0) / total : 0
      const value = attrs[key] ?? 0
      return { key, value, share, points: share * value }
    })
    .sort((a, b) => b.share - a.share)
  return { ovr: ovrFor(attrs, position), rows, raw: rows.reduce((s, r) => s + r.points, 0) }
}
