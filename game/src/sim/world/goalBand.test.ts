/**
 * GAP 2.1#129 / 2.3#118: realistic goal tallies. A league season is a double
 * round robin of quickSim matches; the league's top scorer must sit in a
 * realistic band and extreme seasons must stay vanishingly rare.
 *
 * Fast by default (24 seasons over three top flights). `GOAL_BAND_SEASONS=10000`
 * runs the plan's 10,000-season extreme-rate check (minutes, not for CI).
 * The hero's own tally by position and OVR is reported by `BALANCE=1` in
 * sim/game/balance.test.ts (docs/BALANCE.md "Gol dengesi").
 */
import { Rng } from '../../core/rng'
import type { World } from '../../core/types'
import { generateWorld } from './generate'
import { quickSimMatch } from './quickSim'

/** Plan band for the best player's league goals on Normal. */
export const TOP_SCORER_BAND: readonly [number, number] = [18, 45]
/** A season this far above the band counts as "extreme" (NSS's 500-goal seasons). */
export const EXTREME_GOALS = 60

let world: World
beforeAll(() => {
  world = generateWorld(new Rng(21), { season: 2026, heroCountryId: 'TR' })
})

function seasonTopScorer(rng: Rng, leagueId: string): number {
  const ids = world.leagues[leagueId]!.clubIds
  const tally = new Map<string, number>()
  for (const h of ids) {
    for (const a of ids) {
      if (h === a) continue
      const r = quickSimMatch(rng, world.clubs[h]!, world.clubs[a]!, world)
      for (const g of r.scorers) if (g.playerId) tally.set(g.playerId, (tally.get(g.playerId) ?? 0) + 1)
    }
  }
  return Math.max(0, ...tally.values())
}

describe('season goal band (2.1#129)', () => {
  const leagues = ['EN1', 'TR1', 'JP1']
  const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
  const seasons = Number(env.GOAL_BAND_SEASONS) || 24

  it('top scorers sit in the realistic band; extreme seasons stay ≤ 0.1%', () => {
    const rng = new Rng(77)
    const tops: number[] = []
    for (let i = 0; i < seasons; i++) tops.push(seasonTopScorer(rng, leagues[i % leagues.length]!))
    tops.sort((a, b) => a - b)
    const median = tops[Math.floor(tops.length / 2)]
    const mean = tops.reduce((a, v) => a + v, 0) / tops.length
    expect(median).toBeGreaterThanOrEqual(TOP_SCORER_BAND[0])
    expect(median).toBeLessThanOrEqual(TOP_SCORER_BAND[1])
    expect(mean).toBeLessThanOrEqual(TOP_SCORER_BAND[1])
    const extreme = tops.filter((g) => g >= EXTREME_GOALS).length / tops.length
    expect(extreme).toBeLessThanOrEqual(0.001)
  }, 120_000)
})
