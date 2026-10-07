/** Pure helpers for the post-match step flow (kept free of Preact for unit tests). */
import type { PostMatchView, RatingLineView } from '../../store'

export type PostStep = 'result' | 'rating' | 'map' | 'trust' | 'relations' | 'interview'

/** Steps shown for a view: data-less steps are skipped; the summary/interview step always closes the flow. */
export function postSteps(pm: Pick<PostMatchView, 'stats' | 'heroMap' | 'trust' | 'relations'>): PostStep[] {
  const steps: PostStep[] = ['result']
  const played = pm.stats.minutes > 0
  if (played) steps.push('rating')
  if (played && pm.heroMap) steps.push('map')
  if (pm.trust && (played || pm.trust.reasons.length > 0)) steps.push('trust')
  if (pm.relations && pm.relations.length > 0) steps.push('relations')
  steps.push('interview')
  return steps
}

export interface RatingGroup {
  source: RatingLineView['source']
  lines: RatingLineView[]
  total: number
}

/**
 * Groups the rating log by source (moments → team → background → full time)
 * and adds an 'other' line so base + lines equals the shown final rating
 * (clamping to 1–10 and rounding to one decimal).
 */
export function ratingGroups(base: number, final: number, log: readonly RatingLineView[]): { groups: RatingGroup[]; other: number } {
  const order: RatingLineView['source'][] = ['moment', 'team', 'background', 'final']
  const groups: RatingGroup[] = []
  for (const source of order) {
    const lines = log.filter((l) => l.source === source)
    if (!lines.length) continue
    groups.push({ source, lines: [...lines].sort((a, b) => a.minute - b.minute), total: lines.reduce((a, l) => a + l.delta, 0) })
  }
  const sum = log.reduce((a, l) => a + l.delta, 0)
  const other = Math.round((final - base - sum) * 100) / 100
  return { groups, other: Math.abs(other) >= 0.05 ? other : 0 }
}

/** The single biggest positive and negative contribution (for the "why" headline). */
export function ratingExtremes(log: readonly RatingLineView[]): { best: RatingLineView | null; worst: RatingLineView | null } {
  let best: RatingLineView | null = null
  let worst: RatingLineView | null = null
  for (const l of log) {
    if (l.delta > 0 && (!best || l.delta > best.delta)) best = l
    if (l.delta < 0 && (!worst || l.delta < worst.delta)) worst = l
  }
  return { best, worst }
}

/** Formats a signed rating/trust delta: +0.4 / −0.25 (two decimals only when needed, so lines add up visibly). */
export function signedDelta(v: number, digits = 1): string {
  const a = Math.abs(v)
  const needs2 = Math.abs(Math.round(a * 100) - Math.round(a * 10) * 10) > 0
  const s = a.toFixed(needs2 ? Math.max(2, digits) : digits)
  return `${v > 0 ? '+' : v < 0 ? '−' : '±'}${s}`
}
