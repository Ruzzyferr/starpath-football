/**
 * Nightly statistics guard (2.9#26/#31): a fixed mix of auto careers is reduced to a handful of
 * headline metrics which are compared against the committed baseline (`statsBaseline.json`).
 * Pure helpers here; `statsGuard.test.ts` runs the simulation when STATS_GUARD=1.
 */
import type { CareerTrace } from './balanceSim'

export interface StatsMetrics {
  careers: number
  seasons: number
  bankruptRate: number
  /** Median OVR at the end of season 3 / 6 / last. */
  ovrS3: number
  ovrS6: number
  ovrLast: number
  repLast: number
  /** log10 of the median final net worth. */
  netWorthLog: number
  goalsPerSeason: number
  injuredWeeksPerSeason: number
  trophiesLast: number
}

const median = (xs: number[]): number => {
  if (!xs.length) return NaN
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)

export function metricsOf(traces: CareerTrace[]): StatsMetrics {
  const at = (i: number) => traces.map((t) => t.samples[Math.min(i, t.samples.length - 1)]).filter(Boolean)
  const last = traces.map((t) => t.samples[t.samples.length - 1]).filter(Boolean)
  const all = traces.flatMap((t) => t.samples)
  return {
    careers: traces.length,
    seasons: Math.max(...traces.map((t) => t.samples.length)),
    bankruptRate: traces.filter((t) => t.bankrupt).length / traces.length,
    ovrS3: median(at(2).map((r) => r!.ovr)),
    ovrS6: median(at(5).map((r) => r!.ovr)),
    ovrLast: median(last.map((r) => r!.ovr)),
    repLast: median(last.map((r) => r!.reputation)),
    netWorthLog: Math.log10(Math.max(1, median(last.map((r) => r!.netWorth)))),
    goalsPerSeason: mean(all.map((r) => r.goals)),
    injuredWeeksPerSeason: mean(all.map((r) => r.weeksInjured)),
    trophiesLast: mean(last.map((r) => r!.trophies)),
  }
}

/** Allowed absolute drift per metric. Wide enough for sampling noise at n >= 40, tight enough to catch a rebalance. */
export const TOLERANCE: Record<Exclude<keyof StatsMetrics, 'careers' | 'seasons'>, number> = {
  bankruptRate: 0.05,
  ovrS3: 3,
  ovrS6: 3,
  ovrLast: 3.5,
  repLast: 7,
  netWorthLog: 0.35,
  goalsPerSeason: 3,
  injuredWeeksPerSeason: 1.2,
  trophiesLast: 0.8,
}

/** Human-readable drifts beyond tolerance (empty = pass). Hard cap: at most 5% bankruptcies. */
export function driftReport(now: StatsMetrics, base: StatsMetrics): string[] {
  const out: string[] = []
  for (const k of Object.keys(TOLERANCE) as (keyof typeof TOLERANCE)[]) {
    const d = now[k] - base[k]
    if (!Number.isFinite(now[k]) || Math.abs(d) > TOLERANCE[k]) out.push(`${k}: ${base[k].toFixed(2)} -> ${now[k].toFixed(2)} (limit +/-${TOLERANCE[k]})`)
  }
  if (now.bankruptRate > 0.05) out.push(`bankruptRate ${now.bankruptRate.toFixed(3)} exceeds the 5% hard cap`)
  return out
}
