/**
 * `STATS_GUARD=1 [STATS_GUARD_N=40] [STATS_GUARD_UPDATE=1] npx vitest run src/sim/game/statsGuard.test.ts`
 * Without STATS_GUARD only the cheap unit checks run.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { runCareer, standardMix } from './balanceSim'
import { makeGame } from './testHelpers'
import { advanceToNextMatch } from './calendar'
import { firstEnabledChoice, resolveEventChoice } from './actions'
import { TOLERANCE, driftReport, metricsOf, type StatsMetrics } from './statsGuard'

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
const BASELINE = new URL('./statsBaseline.json', import.meta.url)

describe('stats guard helpers', () => {
  const base: StatsMetrics = { careers: 40, seasons: 10, bankruptRate: 0.02, ovrS3: 60, ovrS6: 68, ovrLast: 72, repLast: 50, netWorthLog: 6.5, goalsPerSeason: 10, injuredWeeksPerSeason: 3.5, trophiesLast: 1 }
  it('passes identical metrics and flags drift beyond tolerance', () => {
    expect(driftReport(base, base)).toEqual([])
    const drift = driftReport({ ...base, ovrLast: base.ovrLast + TOLERANCE.ovrLast + 1, bankruptRate: 0.09 }, base)
    expect(drift.some((d) => d.startsWith('ovrLast'))).toBe(true)
    expect(drift.some((d) => d.includes('5% hard cap'))).toBe(true)
  })
  it('flags non-finite metrics', () => {
    expect(driftReport({ ...base, repLast: NaN }, base).length).toBe(1)
  })
  it('a career run is deterministic per seed (rng streams are stable)', () => {
    const cfg = standardMix(1, 1, 4242)[0]
    // Exact equality: no module-level state may leak between runs in one process.
    expect(JSON.stringify(runCareer(cfg))).toBe(JSON.stringify(runCareer(cfg)))
  }, 60_000)
  it('interleaved seeds do not leak state: A, B, A gives byte-identical careers and game states', () => {
    const [a, b] = [standardMix(1, 1, 4242)[0], standardMix(1, 1, 777)[0]]
    const careerA1 = JSON.stringify(runCareer(a))
    const careerB = JSON.stringify(runCareer(b))
    const careerA2 = JSON.stringify(runCareer(a))
    expect(careerA2).toBe(careerA1)
    expect(careerB).not.toBe(careerA1)
    const playWeeks = (seed: number): string => {
      const g = makeGame(seed)
      for (let i = 0; i < 6; i++) {
        while (g.pendingEvents.length) resolveEventChoice(g, 0, firstEnabledChoice(g, 0))
        advanceToNextMatch(g)
      }
      return JSON.stringify(g)
    }
    const stateA1 = playWeeks(31)
    const stateB = playWeeks(32)
    const stateA2 = playWeeks(31)
    expect(stateA2).toBe(stateA1)
    expect(stateB).not.toBe(stateA1)
  }, 120_000)
})

describe.skipIf(!env.STATS_GUARD)('nightly stats guard', () => {
  it('headline metrics stay within tolerance of the committed baseline', () => {
    const n = Number(env.STATS_GUARD_N ?? 40)
    const seasons = Number(env.STATS_GUARD_SEASONS ?? 10)
    const now = metricsOf(standardMix(n, seasons).map(runCareer))
    console.log('STATS_GUARD metrics', JSON.stringify(now))
    if (env.STATS_GUARD_UPDATE || !existsSync(BASELINE)) {
      writeFileSync(BASELINE, JSON.stringify(now, null, 2) + '\n')
      return
    }
    const drift = driftReport(now, JSON.parse(readFileSync(BASELINE, 'utf8')) as StatsMetrics)
    expect(drift, `Balance drift (update with STATS_GUARD_UPDATE=1 if intended):\n${drift.join('\n')}`).toEqual([])
  }, 3_000_000)
})
