/**
 * Pay-to-win guard (docs/MONETIZASYON.md §6.3). Everything sold only speeds up training (gear, ad boost)
 * or adds career money (cash packs, capped per season). Same seeds per cohort (paired), 5 seasons.
 *
 * Default run (CI): 10 careers per cohort. `BALANCE_FULL=1` runs 30 per cohort and also logs the
 * milestone comparison (top tier, OVR 80, trophies, reputation) used in the review.
 */
import { describe, expect, it } from 'vitest'
import { runCareer, standardMix, type CareerConfig, type CareerTrace } from './balanceSim'

const FULL = process.env.BALANCE_FULL === '1'
const N = FULL ? 30 : 10

function cohort(over: Partial<CareerConfig>): CareerTrace[] {
  return standardMix(N, 5, 7100).map((c) => runCareer({ ...c, ...over }))
}
const growth = (t: CareerTrace) => (t.samples.at(-1)?.ovr ?? t.startOvr) - t.startOvr
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)

describe('purchases vs a free player (5 seasons, paired seeds)', () => {
  const free = cohort({ gear: 'none' })

  it('Golden Boots all career: OVR growth ≤ +25%; the free player still plays', () => {
    const paid = cohort({ gear: 'always' })
    const gFree = avg(free.map(growth))
    const gPaid = avg(paid.map(growth))
    const appsS3 = avg(free.map((t) => t.samples[2]?.apps ?? 0))
    console.log(`[gear balance] n=${N} OVR growth free ${gFree.toFixed(2)} · Golden Boots ${gPaid.toFixed(2)} (×${(gPaid / gFree).toFixed(3)}); free apps in season 3: ${appsS3.toFixed(1)}`)
    expect(gPaid).toBeGreaterThanOrEqual(gFree)
    expect(gPaid / gFree).toBeLessThanOrEqual(1.25)
    expect(appsS3).toBeGreaterThanOrEqual(10)
  }, 1_800_000)

  it('the biggest spender, spending optimally (every gear slot, an ad boost every session, €600k a season into XP facilities and the best trainer): ≤ +25% growth and close milestones', () => {
    const whale = cohort({ gear: 'max', cashPerSeason: true, spendOptimally: true })
    const gFree = avg(free.map(growth))
    const gWhale = avg(whale.map(growth))
    const pct = (xs: CareerTrace[], f: (t: CareerTrace) => boolean) => (100 * xs.filter(f).length) / xs.length
    const top = (t: CareerTrace) => t.firstTopTierAge !== null
    const ovr80 = (t: CareerTrace) => t.ovr80Age !== null
    const trophies = (t: CareerTrace) => t.samples.reduce((a, s) => a + s.trophies, 0)
    const rep = (t: CareerTrace) => t.samples.at(-1)?.reputation ?? 0
    console.log(
      `[gear balance] n=${N} spender: OVR growth ${gWhale.toFixed(2)} vs free ${gFree.toFixed(2)} (×${(gWhale / gFree).toFixed(3)}); ` +
        `top tier ${pct(whale, top).toFixed(0)}% vs ${pct(free, top).toFixed(0)}%; OVR 80 ${pct(whale, ovr80).toFixed(0)}% vs ${pct(free, ovr80).toFixed(0)}%; ` +
        `trophies ${avg(whale.map(trophies)).toFixed(2)} vs ${avg(free.map(trophies)).toFixed(2)}; reputation ${avg(whale.map(rep)).toFixed(1)} vs ${avg(free.map(rep)).toFixed(1)}`,
    )
    expect(gWhale / gFree).toBeLessThanOrEqual(1.25)
    // Paired seeds: at most 30 percentage points more careers reach a top-tier league.
    expect(pct(whale, top) - pct(free, top)).toBeLessThanOrEqual(30)
  }, 3_600_000)
})
