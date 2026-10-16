import { describe, expect, it } from 'vitest'
import { Rng } from '../../core/rng'
import { generateWorld } from './generate'
import { academyLevel, SQUAD_MAX, SQUAD_MIN, endOfSeason, LEGEND_MIN_OVR } from './season'
import { meanAbility } from './anchor'

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
const SEASONS = env.LONGRUN === '1' ? 100 : 50

/**
 * 2.6#71 / #47 / #48: many simulated seasons on a small world (50 by default, 100 with LONGRUN=1).
 * Tier sizes never drift, the player population stays inside a band, ability does not inflate or collapse,
 * squads stay legal, retired stars are listed, nothing goes NaN.
 */
describe(`${SEASONS} simulated seasons`, () => {
  it('keeps the world stable', () => {
    const world = generateWorld(new Rng(9), { season: 2026, heroCountryId: 'TR', countryIds: ['TR', 'EN'] })
    const rng = new Rng(10)
    const sizes = Object.fromEntries(Object.values(world.leagues).map((l) => [l.id, l.clubIds.length]))
    const pop0 = Object.keys(world.players).length
    const ovr0 = meanAbility(world)
    // Top end (playtest Tur 2): the mean anchor alone let p95 82 -> 90 and the max 92 -> 95 while the mean held.
    const top = () => {
      const o = Object.values(world.players).filter((p) => p.clubId).map((p) => p.ovr).sort((a, b) => b - a)
      return { p95: o[Math.floor(o.length * 0.05)], top20: o.slice(0, 20).reduce((a, b) => a + b, 0) / 20, max: o[0] }
    }
    const top0 = top()
    let topHi = { p95: 0, top20: 0, max: 0 }
    let minPop = pop0, maxPop = pop0
    for (let i = 0; i < SEASONS; i++) {
      endOfSeason(world, rng, 2026 + i)
      const pop = Object.keys(world.players).length
      minPop = Math.min(minPop, pop)
      maxPop = Math.max(maxPop, pop)
      if (i % 10 === 9) {
        const t = top()
        topHi = { p95: Math.max(topHi.p95, t.p95!), top20: Math.max(topHi.top20, t.top20), max: Math.max(topHi.max, t.max!) }
        for (const l of Object.values(world.leagues)) expect(l.clubIds.length, `${l.id} @${i}`).toBe(sizes[l.id])
        for (const c of Object.values(world.clubs)) {
          expect(c.squad.length, `${c.id} @${i}`).toBeGreaterThanOrEqual(SQUAD_MIN)
          expect(c.squad.length).toBeLessThanOrEqual(SQUAD_MAX)
          expect(c.reputation).toBeGreaterThanOrEqual(5)
          expect(c.reputation).toBeLessThanOrEqual(99)
        }
      }
    }
    for (const p of Object.values(world.players)) { expect(Number.isFinite(p.ovr)).toBe(true); expect(p.ovr).toBeGreaterThanOrEqual(25) }
    expect(Math.abs(meanAbility(world) - ovr0)).toBeLessThan(1.5)
    expect(topHi.p95 - top0.p95!, 'p95 drift').toBeLessThanOrEqual(2)
    expect(topHi.top20 - top0.top20, 'top-20 drift').toBeLessThanOrEqual(2.5)
    expect(topHi.max - top0.max!, 'max drift').toBeLessThanOrEqual(2)
    expect(Math.abs(top().p95! - top0.p95!)).toBeLessThanOrEqual(2)
    expect(maxPop / pop0).toBeLessThan(1.08)
    expect(minPop / pop0).toBeGreaterThan(0.92)
    const seen = new Set<string>()
    for (const l of Object.values(world.leagues)) for (const id of l.clubIds) { expect(seen.has(id)).toBe(false); seen.add(id) }
    expect(seen.size).toBe(Object.keys(world.clubs).length)
    // 2.6#47 legends: retired stars are listed, strongest first, capped.
    const legends = world.legends ?? []
    expect(legends.length).toBeGreaterThan(5)
    expect(legends.every((l) => l.ovr >= LEGEND_MIN_OVR)).toBe(true)
    expect(legends.every((l, i) => i === 0 || legends[i - 1]!.ovr >= l.ovr)).toBe(true)
    expect(legends.length).toBeLessThanOrEqual(150)
    // Some legends take a dugout job.
    expect(legends.some((l) => l.managerOf)).toBe(true)
    for (const l of legends) if (l.managerOf) expect(world.clubs[l.managerOf]!.managerName).toBe(l.name)
  }, 240_000)

  it('academy level follows club standing', () => {
    expect([5, 25, 45, 65, 95].map((reputation) => academyLevel({ reputation } as never))).toEqual([1, 2, 3, 4, 5])
  })
})

describe('2.6#62 per-country promotion rules keep every tier the same size', () => {
  it('works for 2, 3 and 4 swapping places', { timeout: 30_000 }, () => {
    const world = generateWorld(new Rng(21), { season: 2026, heroCountryId: 'DE', countryIds: ['DE', 'JP', 'BR'] })
    expect(world.leagues.DE1!.relegate).toBe(2)
    expect(world.leagues.DE2!.promote).toBe(2)
    expect(world.leagues.DE2!.relegate).toBe(3)
    expect(world.leagues.JP1!.relegate).toBe(2)
    expect(world.leagues.BR1!.relegate).toBe(4)
    const sizes = Object.fromEntries(Object.values(world.leagues).map((l) => [l.id, l.clubIds.length]))
    const rng = new Rng(22)
    for (let i = 0; i < 6; i++) {
      const { summary } = endOfSeason(world, rng, 2026 + i)
      expect(summary.movements.filter((m) => m.kind === 'promoted').length).toBe(summary.movements.filter((m) => m.kind === 'relegated').length)
      for (const l of Object.values(world.leagues)) expect(l.clubIds.length, `${l.id} season ${i}`).toBe(sizes[l.id])
    }
  })
})
