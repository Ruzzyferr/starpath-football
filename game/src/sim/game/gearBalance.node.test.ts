/**
 * Pay-to-win guard (docs/MONETIZASYON.md §6.3), for stat gear (career/gear, 2026-10-19): boots add capped
 * stat points that count in matches, so this measures MATCH impact, not only growth. Paired seeds, 5 seasons:
 *
 * - off:   no gear at all (earned rewards removed too), the pure baseline;
 * - free:  never buys gear, keeps what rewards give (boots sponsor, season awards, trophies);
 * - cash:  free player who buys the best boots career cash allows (New Star Soccer style);
 * - gear:  diamond spender in max gear only (no bought cash): the pure +5-cap match effect;
 * - whale: diamond spender in the position's Legend boots + best accessory + compression all career, an ad
 *          boost every session, and €200k bought cash a season spent optimally on XP facilities + trainer.
 *
 * The spender's edge has to stay about what a +5 cap can do: small. Default run (CI): 10 careers per
 * cohort. `BALANCE_FULL=1` runs 30.
 */
import { describe, expect, it } from 'vitest'
import { runCareer, standardMix, type CareerConfig, type CareerTrace } from './balanceSim'

const FULL = process.env.BALANCE_FULL === '1'
const N = FULL ? 30 : 10

function cohort(over: Partial<CareerConfig>): CareerTrace[] {
  return standardMix(N, 5, 7100).map((c) => runCareer({ ...c, ...over }))
}
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)
const pct = (xs: CareerTrace[], f: (t: CareerTrace) => boolean) => (100 * xs.filter(f).length) / xs.length

interface Row { growth: number; rating: number; goals: number; top: number; ovr80: number; trophies: number; rep: number }
function row(ts: CareerTrace[]): Row {
  const apps = (t: CareerTrace) => t.samples.reduce((a, s) => a + s.apps, 0)
  return {
    growth: avg(ts.map((t) => (t.samples.at(-1)?.ovr ?? t.startOvr) - t.startOvr)),
    // Appearance-weighted season ratings, then the cohort average.
    rating: avg(ts.filter((t) => apps(t) > 0).map((t) => t.samples.reduce((a, s) => a + s.rating * s.apps, 0) / apps(t))),
    goals: avg(ts.map((t) => t.samples.reduce((a, s) => a + s.goals, 0))),
    top: pct(ts, (t) => t.firstTopTierAge !== null),
    ovr80: pct(ts, (t) => t.ovr80Age !== null),
    trophies: avg(ts.map((t) => t.samples.at(-1)?.trophies ?? 0)),
    rep: avg(ts.map((t) => t.samples.at(-1)?.reputation ?? 0)),
  }
}
const fmt = (n: string, r: Row) =>
  `${n.padEnd(6)} growth ${r.growth.toFixed(2)} · rating ${r.rating.toFixed(2)} · goals/5y ${r.goals.toFixed(1)} · top tier ${r.top.toFixed(0)}% · OVR80 ${r.ovr80.toFixed(0)}% · trophies ${r.trophies.toFixed(2)} · rep ${r.rep.toFixed(1)}`

describe('stat gear vs a free player (5 seasons, paired seeds)', () => {
  it('a diamond spender in max gear stays within a small, capped edge over free players', () => {
    const off = row(cohort({ gear: 'off' }))
    const free = row(cohort({ gear: 'none' }))
    const cash = row(cohort({ gear: 'cash' }))
    const gear = row(cohort({ gear: 'max' }))
    const whale = row(cohort({ gear: 'max', cashPerSeason: true, spendOptimally: true }))
    console.log(`[gear balance] n=${N}\n${fmt('off', off)}\n${fmt('free', free)}\n${fmt('cash', cash)}\n${fmt('gear', gear)}\n${fmt('whale', whale)}`)

    // Growth runs on the base attributes; gear itself adds none (only the bought cash and ad boost can).
    expect(whale.growth / off.growth).toBeLessThanOrEqual(1.25)
    // Match ratings: max gear alone is at most 0.3 of a rating point ahead of the free player who shops
    // with career money; the full spender (gear + bought cash spent on XP) at most 0.4, and half a point
    // ahead of a player with no gear at all.
    expect(gear.rating - cash.rating).toBeLessThanOrEqual(0.3)
    expect(whale.rating - cash.rating).toBeLessThanOrEqual(0.4)
    expect(whale.rating - off.rating).toBeLessThanOrEqual(0.5)
    // Goals over 5 seasons (noisy at n=10): max gear alone at most +40% over the cash shopper, the full
    // spender at most +50%.
    expect(gear.goals).toBeLessThanOrEqual(cash.goals * 1.4 + 3)
    expect(whale.goals).toBeLessThanOrEqual(cash.goals * 1.5 + 3)
    // Milestones: at most 30 percentage points more careers reach a top-tier league or OVR 80.
    expect(whale.top - cash.top).toBeLessThanOrEqual(30)
    expect(whale.ovr80 - cash.ovr80).toBeLessThanOrEqual(30)
    // Gear does something: the cash shopper is not behind the player with no gear on the pitch.
    expect(cash.rating).toBeGreaterThanOrEqual(off.rating - 0.1)
  }, 3_600_000)
})
