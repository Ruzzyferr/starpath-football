/**
 * Relationship presentation selectors (2.4#3, 2.7#81): five 40-point bands
 * with a written gameplay effect, and a 4-week trend from the change ledger.
 * Pure; the UI renders the keys.
 */
import type { Relationship, RelationKind } from '../../core/types'
import { passFactor } from '../life/relationships'

export type RelBand = 'enemy' | 'cold' | 'neutral' | 'warm' | 'loyal'
export type RelGroup = 'team' | 'boss' | 'close' | 'public'

/** -100..-60 enemy, -60..-20 cold, -20..20 neutral, 20..60 warm, 60..100 loyal. */
export function relBand(value: number): RelBand {
  if (value < -60) return 'enemy'
  if (value < -20) return 'cold'
  if (value <= 20) return 'neutral'
  if (value <= 60) return 'warm'
  return 'loyal'
}

export function relGroup(kind: RelationKind): RelGroup {
  if (kind === 'teammate') return 'team'
  if (kind === 'manager' || kind === 'chairman') return 'boss'
  if (kind === 'fans' || kind === 'press' || kind === 'agent') return 'public'
  return 'close'
}

/** Teammate pass-frequency change in percent (matches the engine's `passFactor`). */
export function passPercent(value: number): number {
  return Math.round((passFactor(value) - 1) * 100)
}

export type RelTrend = 'up' | 'down' | 'flat'
/** Net ledger movement over the last `weeks` weeks (absolute week `now`). */
export function relTrend(r: Pick<Relationship, 'log'>, now: number, weeks = 4): { trend: RelTrend; delta: number } {
  let sum = 0
  for (const e of r.log ?? []) if (e.w > now - weeks) sum += e.d
  const delta = Math.round(sum * 10) / 10
  return { trend: delta >= 1 ? 'up' : delta <= -1 ? 'down' : 'flat', delta }
}
