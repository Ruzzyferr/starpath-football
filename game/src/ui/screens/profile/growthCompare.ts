import { ATTRIBUTE_KEYS, type AttributeKey, type Attributes } from '../../../core/types'
import type { AttrHistory } from '../../../sim/game/saveHistory'

export interface GrowthCompare {
  /** Season of the baseline row ("a season ago"). */
  season: number
  week: number
  /** Baseline attributes (missing keys fall back to the current value). */
  then: Attributes
  /** Per-attribute change since the baseline, biggest gain first. */
  deltas: { key: AttributeKey; delta: number }[]
}

/**
 * Picks the baseline for "a season ago": the newest row from the previous season, else (a career
 * younger than one season) the oldest sample on record. Null when there is nothing to compare.
 */
export function growthCompare(hist: AttrHistory | undefined, now: Attributes, season: number): GrowthCompare | null {
  if (!hist || hist.rows.length < 2) return null
  const prev = [...hist.rows].reverse().find((r) => r[0] === season - 1)
  const row = (prev ?? hist.rows[0])!
  const last = hist.rows[hist.rows.length - 1]
  if (row === last) return null
  const then = { ...now }
  hist.keys.forEach((k, i) => { if (ATTRIBUTE_KEYS.includes(k)) then[k] = row[2 + i]! })
  const deltas = ATTRIBUTE_KEYS.map((key) => ({ key, delta: Math.round(now[key] - then[key]) })).sort((a, b) => b.delta - a.delta)
  return { season: row[0]!, week: row[1]!, then, deltas }
}
