/**
 * Post-match "why" builders (pure): manager-trust reasons, relationship change
 * rows, engine rating log / heat map → views, the step list of the post-match
 * flow, and the pre-match expected-moments preview.
 *
 * Trust mirrors sim/career/squadRole.ts `updateTrustFromMatch`:
 *   raw = (rating − 6.3) × 3 × clamp(minutes / 90, 0.3, 1.2)
 *   (a negative raw is scaled by 1 − trustBlameShield(goals, assists, won): goal contributions soften blame)
 * then `changeTrust` shrinks gains near 100 (and perks scale them). The raw
 * term is split into what moved the rating (goals/assists, result, cards, the
 * rest of the performance), the minutes scaling, and the remainder.
 */
import { clamp } from '../../core/rng'
import type { LText, RelationKind, Relationship } from '../../core/types'
import { trustBlameShield } from '../../sim/career/squadRole'
import { expectedMoments } from '../../sim/match'
import type { ExpectedMoments, HeroMatchMap, HighlightPlanInput, RatingLogEntry } from '../../sim/match'
import type { HeroMapView, RatingLineView, RelationChangeView, TrustChangeView } from '../store'

const L = (tr: string, en: string): LText => ({ tr, en })
const r1 = (x: number): number => Math.round(x * 10) / 10

/** Neutral rating of the trust formula (sim/career/squadRole.ts). */
export const TRUST_NEUTRAL_RATING = 6.3
/** Rating points per goal / assist / card used to attribute trust (sim/match/rating.ts deltas). */
const GOAL_PTS = 1.0
const ASSIST_PTS = 0.7
const YELLOW_PTS = 0.3
const RED_PTS = 1.5

export interface TrustReasonInput {
  before: number
  after: number
  rating: number
  minutes: number
  goals: number
  assists: number
  yellow: number
  red: number
  /** Rating points from the full-time result adjustment (rating log 'final'/'result'), if known. */
  resultPts?: number
  won: boolean
  drew: boolean
}

/** Splits a match's manager-trust change into readable reasons that sum to `after − before`. */
export function buildTrustReasons(m: TrustReasonInput): TrustChangeView {
  const reasons: TrustChangeView['reasons'] = []
  const total = m.after - m.before
  if (m.minutes <= 0) {
    if (Math.abs(total) >= 0.05) reasons.push({ key: 'other', value: r1(total), label: L('Maçta forma giymedin', 'You did not play') })
    return { before: r1(m.before), after: r1(m.after), reasons }
  }
  const w = clamp(m.minutes / 90, 0.3, 1.2)
  const k = 3 // trust per rating point at full weight
  const goals = (m.goals * GOAL_PTS + m.assists * ASSIST_PTS) * k
  const result = (m.resultPts ?? (m.won ? 0.3 : m.drew ? 0 : -0.3) * Math.min(1, m.minutes / 90)) * k
  const card = -(m.yellow * YELLOW_PTS + m.red * RED_PTS) * k
  const full = (m.rating - TRUST_NEUTRAL_RATING) * k
  const perf = full - goals - result - card
  const weighted = full * w
  const fair = weighted < 0 ? -weighted * trustBlameShield(m.goals, m.assists, m.won) : 0
  const raw = weighted + fair
  const minutes = weighted - full
  const other = total - raw

  const push = (key: TrustChangeView['reasons'][number]['key'], v: number, label: LText) => {
    if (Math.abs(v) >= 0.05) reasons.push({ key, value: r1(v), label })
  }
  push('rating', perf, L(`Maç notun ${m.rating.toFixed(1)} (beklenen ${TRUST_NEUTRAL_RATING.toFixed(1)})`, `Your rating ${m.rating.toFixed(1)} (expected ${TRUST_NEUTRAL_RATING.toFixed(1)})`))
  if (m.goals + m.assists > 0) push('goals', goals, L(`${m.goals} gol, ${m.assists} asist`, `${m.goals} goals, ${m.assists} assists`))
  push('result', result, m.won ? L('Galibiyet', 'Win') : m.drew ? L('Beraberlik', 'Draw') : L('Mağlubiyet', 'Defeat'))
  if (m.yellow + m.red > 0) push('card', card, m.red ? L('Kırmızı kart', 'Red card') : L('Sarı kart', 'Yellow card'))
  push('fair', fair, L('Gol/asist katkın suçu azalttı', 'Your goal contributions softened the blame'))
  push('minutes', minutes, L(`${m.minutes} dakika oynadın`, `Played ${m.minutes} minutes`))
  push('other', other, other < 0 ? L('Hocanın güven sınırı', 'Trust is slow to earn') : L('Perk / kariyer etkisi', 'Perk / career bonus'))
  // Rounding: make the shown reasons add up exactly to the shown change.
  const shown = r1(m.after) - r1(m.before)
  const sum = reasons.reduce((a, r) => a + r.value, 0)
  const drift = r1(shown - sum)
  if (reasons.length && Math.abs(drift) >= 0.05) {
    const big = reasons.reduce((a, b) => (Math.abs(b.value) > Math.abs(a.value) ? b : a))
    big.value = r1(big.value + drift)
  }
  return { before: r1(m.before), after: r1(m.after), reasons: reasons.filter((r) => r.value !== 0) }
}

/** Relationship values before the match (id → value). */
export function relationValues(rels: Record<string, Relationship>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of Object.values(rels)) out[r.id] = r.value
  return out
}

/**
 * Relationship rows for everything the match moved. Team-mates who all moved
 * by the same amount for the same reason collapse into one 'squad' row.
 */
export function buildRelationChanges(before: Record<string, number>, after: Record<string, Relationship>, max = 8): RelationChangeView[] {
  const rows: RelationChangeView[] = []
  const groups = new Map<string, { rows: RelationChangeView[] }>()
  for (const r of Object.values(after)) {
    const b = before[r.id] ?? 0
    const d = r.value - b
    if (Math.round(d) === 0) continue
    const why = r.log?.[0]?.why
    const row: RelationChangeView = { id: r.id, name: r.name, kind: r.kind, before: Math.round(b), after: Math.round(r.value), ...(why ? { why } : {}) }
    if (r.kind === 'teammate') {
      const key = `${Math.round(d)}|${why?.en ?? ''}`
      const g = groups.get(key) ?? { rows: [] }
      g.rows.push(row)
      groups.set(key, g)
    } else rows.push(row)
  }
  for (const g of groups.values()) {
    if (g.rows.length >= 3) {
      const n = g.rows.length
      const avg = (f: (x: RelationChangeView) => number) => Math.round(g.rows.reduce((a, x) => a + f(x), 0) / n)
      rows.push({ id: 'squad', name: String(n), kind: 'squad', before: avg((x) => x.before), after: avg((x) => x.after), ...(g.rows[0].why ? { why: g.rows[0].why } : {}) })
    } else rows.push(...g.rows)
  }
  return rows.sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before)).slice(0, max)
}

/** Engine rating log → view rows (rounded to 2 dp, zero lines dropped). */
export function ratingLogView(log: readonly RatingLogEntry[] | undefined): RatingLineView[] {
  return (log ?? [])
    .filter((e) => Number.isFinite(e.delta) && Math.abs(e.delta) >= 0.005)
    .map((e) => ({
      minute: e.minute, source: e.source, key: e.key, delta: Math.round(e.delta * 100) / 100,
      ...(e.kind ? { kind: e.kind } : {}), ...(e.outcome ? { outcome: e.outcome } : {}), ...(e.auto ? { auto: true } : {}),
    }))
}

/** Engine heat/shot map → view (defensive copy; null when empty). */
export function heroMapView(map: HeroMatchMap | undefined): HeroMapView | undefined {
  if (!map || !map.cols || !map.rows || map.heat.length !== map.cols * map.rows) return undefined
  if (!map.heat.some((v) => v > 0) && map.shots.length === 0) return undefined
  return { cols: map.cols, rows: map.rows, heat: [...map.heat], shots: map.shots.map((s) => ({ ...s })) }
}

// ───────────────────────── Expected moments ─────────────────────────

/** Engine expected-moments preview (sim/match/highlightGen). */
export function expectedMomentsFor(input: HighlightPlanInput): ExpectedMoments {
  return expectedMoments(input)
}

/** Kinds worth a label (≥ 8% share, at most 4). */
export function topKinds(e: ExpectedMoments, minShare = 0.08, max = 4): ExpectedMoments['kinds'] {
  return e.kinds.filter((k) => k.share >= minShare).slice(0, max)
}

/** Relation kinds whose row label comes from i18n rather than the person's name. */
export const GROUP_RELATIONS: ReadonlySet<RelationKind | 'squad'> = new Set<RelationKind | 'squad'>(['fans', 'press', 'squad'])
