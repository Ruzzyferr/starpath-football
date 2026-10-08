import { describe, expect, it } from 'vitest'
import { Rng } from '../../core/rng'
import { hashString } from '../../core/rng'
import type { Fixture, World } from '../../core/types'
import { CITY_CAPACITY_CAP, cityTier, isRealPersonName } from '../../data/world/names'
import { derbyKey, buildLeagueFixtures, DERBY_FREE_ROUNDS } from './fixtures'
import { generateWorld } from './generate'
import { randomName } from './players'
import { computeTable, sortTable, tieBreakHint, tieRuleFor } from './table'

let cached: World | null = null
const world = (): World => (cached ??= generateWorld(new Rng(42), { season: 2026, heroCountryId: 'TR' }))

describe('2.6#1/#2 deterministic, sized world', () => {
  it('same seed gives a byte-identical world (pinned hash, platform independent)', () => {
    const json = JSON.stringify(world())
    expect(json).toBe(JSON.stringify(generateWorld(new Rng(42), { season: 2026, heroCountryId: 'TR' })))
    // FNV-style string hash of the canonical JSON: any generation change must update this deliberately.
    expect(hashString(json)).toBe(PINNED_WORLD_HASH)
  })
  it('has at least 8 countries and 450 clubs', () => {
    expect(Object.keys(world().countries).length).toBeGreaterThanOrEqual(8)
    expect(Object.keys(world().clubs).length).toBeGreaterThanOrEqual(450)
  })
})

describe('2.6#5/#10 names', () => {
  it('no two players of a club share a full name', () => {
    for (const c of Object.values(world().clubs)) {
      const names = c.squad.map((id) => `${world().players[id]!.firstName} ${world().players[id]!.lastName}`)
      expect(new Set(names).size, c.id).toBe(names.length)
    }
  })
  it('never generates a real footballer or manager name (players and managers)', () => {
    const w = world()
    const hits = Object.values(w.players).filter((p) => isRealPersonName(p.firstName, p.lastName)).map((p) => p.firstName + ' ' + p.lastName)
    for (const c of Object.values(w.clubs)) {
      const [first, ...rest] = c.managerName.split(' ')
      if (isRealPersonName(first!, rest.join(' '))) hits.push(c.managerName)
    }
    expect(hits).toEqual([])
    // The guard: a blacklisted draw is re-rolled; the pools do contain combinations such as Sergio Ramos.
    let calls = 0
    const stub = { pick: (xs: readonly string[]) => (xs.includes('Sergio') ? 'Sergio' : calls++ === 0 ? 'Ramos' : 'Alvarez') } as unknown as Rng
    expect(randomName(stub, 'spanish')).toEqual({ firstName: 'Sergio', lastName: 'Alvarez' })
    expect(isRealPersonName('Lionel', 'Messi')).toBe(true)
    expect(isRealPersonName('Ayşe', 'Yılmaz')).toBe(false)
  })
})

describe('2.6#7/#9 cities and clubs', () => {
  it('stadium capacity never exceeds what the city tier sustains', () => {
    const tiers = new Set<string>()
    for (const c of Object.values(world().clubs)) {
      const tier = cityTier(c.countryId, c.city)
      tiers.add(tier)
      expect(c.stadium.capacity, c.id).toBeLessThanOrEqual(CITY_CAPACITY_CAP[tier])
    }
    expect(tiers.size).toBeGreaterThanOrEqual(3)
  })
  it('every club has a founding year; stronger clubs tend to be older', () => {
    const clubs = Object.values(world().clubs)
    expect(clubs.every((c) => c.founded !== undefined && c.founded >= 1860 && c.founded <= 1960)).toBe(true)
    const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
    expect(avg(clubs.filter((c) => c.reputation >= 60).map((c) => c.founded!))).toBeLessThan(avg(clubs.filter((c) => c.reputation < 40).map((c) => c.founded!)))
  })
})

describe('2.6#65 per-country tie-break rules', () => {
  const fx = (id: string, home: string, away: string, h: number, a: number, comp: string): Fixture => ({ id, compId: comp, round: 0, week: 1, day: 5, homeId: home, awayId: away, result: { home: h, away: a, scorers: [] } })
  // x and y level on points; y has the better overall goal difference but x won the head-to-head.
  const games = (comp: string) => [fx('1', 'x', 'y', 1, 0, comp), fx('2', 'y', 'x', 1, 1, comp), fx('3', 'y', 'z', 6, 0, comp), fx('4', 'x', 'z', 1, 0, comp), fx('5', 'z', 'y', 0, 1, comp)]
  it('GD-first countries and head-to-head-first countries order the same tie differently', () => {
    const ids = ['x', 'y', 'z']
    const tr = games('L-2026-TR1')
    const es = games('L-2026-ES1')
    const rowsTr = computeTable(ids, tr)
    expect(rowsTr.find((r) => r.clubId === 'x')!.pts).toBe(rowsTr.find((r) => r.clubId === 'y')!.pts)
    expect(sortTable(rowsTr, tr).map((r) => r.clubId)).toEqual(['y', 'x', 'z'])
    expect(sortTable(computeTable(ids, es), es).map((r) => r.clubId)).toEqual(['x', 'y', 'z'])
    expect(tieRuleFor('ES')).toBe('h2h')
    expect(tieRuleFor('TR')).toBe('gd')
    expect(tieBreakHint('h2h').en).toMatch(/head-to-head, overall/)
  })
})

describe('2.6#69/#70 fixture rules', () => {
  const clubFixtures = (w: World) => {
    const m = new Map<string, { t: number; league: boolean; home: boolean; round: number }[]>()
    for (const comp of Object.values(w.competitions)) for (const f of comp.fixtures) for (const [id, home] of [[f.homeId, true], [f.awayId, false]] as const) {
      if (!w.clubs[id]) continue
      if (!m.has(id)) m.set(id, [])
      m.get(id)!.push({ t: f.week * 7 + f.day, league: comp.type === 'league', home, round: f.round })
    }
    return m
  }
  it('no club plays 3 league games in a row at the same ground', () => {
    for (const [id, list] of clubFixtures(world())) {
      const lg = list.filter((x) => x.league).sort((a, b) => a.t - b.t)
      for (let i = 2; i < lg.length; i++) expect(lg[i]!.home === lg[i - 1]!.home && lg[i]!.home === lg[i - 2]!.home, `${id} round ${lg[i]!.round}`).toBe(false)
    }
  })
  it('derbies (same city) are kept out of the first rounds', () => {
    const ids = Array.from({ length: 16 }, (_, i) => `c${i}`)
    const derbies = new Set([derbyKey('c0', 'c1'), derbyKey('c2', 'c3'), derbyKey('c4', 'c5'), derbyKey('c6', 'c7')])
    for (const seed of [1, 2, 3, 4, 5]) {
      const fixtures = buildLeagueFixtures(new Rng(seed), 'L', ids, undefined, derbies)
      for (const f of fixtures) if (f.round < DERBY_FREE_ROUNDS) expect(derbies.has(derbyKey(f.homeId, f.awayId))).toBe(false)
      expect(fixtures).toHaveLength(16 * 15)
    }
    const w = world()
    for (const comp of Object.values(w.competitions)) if (comp.type === 'league') for (const f of comp.fixtures) if (f.round < DERBY_FREE_ROUNDS) expect(w.clubs[f.homeId]!.city === w.clubs[f.awayId]!.city, f.id).toBe(false)
  })
  it('no club plays twice within 72 hours', () => {
    for (const [id, list] of clubFixtures(world())) {
      const ts = list.map((x) => x.t).sort((a, b) => a - b)
      for (let i = 1; i < ts.length; i++) expect(ts[i]! - ts[i - 1]!, id).toBeGreaterThanOrEqual(3)
    }
  })
})

const PINNED_WORLD_HASH = 2297840475
