/**
 * Country coefficients: how well each country's clubs did in the continental
 * cup over the last {@link COEFFICIENT_SEASONS} seasons. The ranking decides
 * how many continental places each country gets (see competitions.ts).
 *
 * Points per season = (2 per win, 1 per draw, half in the qualifying round,
 * +1 for every knockout round reached, +2 for the winner) / clubs entered.
 */
import type { World } from '../../core/types'
import './worldTypes'

export const COEFFICIENT_SEASONS = 5

/** Seed value for one season of a country without history (from its reputation). */
export function seedCoefficient(reputation: number): number {
  return Math.round(Math.max(1, (reputation - 55) / 3.5) * 10) / 10
}

/** Lazily create coefficients for every country of the world (old saves, new worlds). */
export function ensureCoefficients(world: World): Record<string, number[]> {
  if (!world.coefficients) world.coefficients = {}
  for (const c of Object.values(world.countries)) {
    if (!world.coefficients[c.id]) world.coefficients[c.id] = Array.from({ length: COEFFICIENT_SEASONS }, () => seedCoefficient(c.reputation))
  }
  return world.coefficients
}

export const coefficientTotal = (points: readonly number[]): number => Math.round(points.reduce((s, v) => s + v, 0) * 10) / 10

export interface CoefficientRow {
  countryId: string
  total: number
  seasons: number[]
}

/** Countries ranked by coefficient (desc; ties → reputation, id). */
export function coefficientRanking(world: World): CoefficientRow[] {
  const coefs = ensureCoefficients(world)
  return Object.values(world.countries)
    .map((c) => ({ countryId: c.id, total: coefficientTotal(coefs[c.id]), seasons: [...coefs[c.id]] }))
    .sort((a, b) => b.total - a.total || (world.countries[b.countryId].reputation - world.countries[a.countryId].reputation) || (a.countryId < b.countryId ? -1 : 1))
}

/** Points each country earned in the continental competitions of `season`. */
export function seasonCoefficientPoints(world: World, season: number): Record<string, number> {
  const raw: Record<string, number> = {}
  const entered: Record<string, Set<string>> = {}
  const countryOf = (clubId: string): string | null => world.clubs[clubId]?.countryId ?? null
  const add = (clubId: string, pts: number) => {
    const c = countryOf(clubId)
    if (!c) return
    raw[c] = (raw[c] ?? 0) + pts
    ;(entered[c] ??= new Set()).add(clubId)
  }
  for (const comp of Object.values(world.competitions)) {
    if (comp.season !== season || comp.type !== 'continental') continue
    const qualifying = comp.meta?.format === 'continental_q'
    const factor = qualifying ? 0.5 : 1
    for (const id of comp.participantIds) add(id, 0)
    const koRounds = new Map<string, Set<number>>()
    for (const f of comp.fixtures) {
      if (!f.result) continue
      const { home, away } = f.result
      if (home > away) add(f.homeId, 2 * factor)
      else if (away > home) add(f.awayId, 2 * factor)
      else {
        add(f.homeId, factor)
        add(f.awayId, factor)
      }
      if (!qualifying && f.round >= 6) {
        for (const id of [f.homeId, f.awayId]) {
          const set = koRounds.get(id) ?? new Set<number>()
          set.add(f.round)
          koRounds.set(id, set)
        }
      }
    }
    for (const [id, rounds] of koRounds) add(id, rounds.size)
    if (!qualifying && comp.winnerId) add(comp.winnerId, 2)
  }
  const out: Record<string, number> = {}
  for (const [c, pts] of Object.entries(raw)) out[c] = Math.round((pts / Math.max(1, entered[c]?.size ?? 1)) * 10) / 10
  return out
}

/** Close a season: append every country's points (0 when absent) and keep the last 5. */
export function updateCoefficients(world: World, season: number): Record<string, number> {
  const coefs = ensureCoefficients(world)
  const pts = seasonCoefficientPoints(world, season)
  for (const c of Object.keys(world.countries)) {
    const arr = coefs[c]
    arr.push(pts[c] ?? 0)
    while (arr.length > COEFFICIENT_SEASONS) arr.shift()
  }
  return pts
}
