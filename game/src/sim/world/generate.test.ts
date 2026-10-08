import { boundarySpots } from '../../data/world/rules'
import { Rng, hashString } from '../../core/rng'
import type { World } from '../../core/types'
import { POSITIONS } from '../../core/types'
import { isRealClubName } from '../../data/world/names'
import { MIN_KIT_DISTANCE, colorDistance, contrastRatio } from './colors'
import { continentalCompId, cupCompId, leagueCompId, continentalQualifyingCompId } from './competitions'
import { FREE_AGENT_COUNT, MAX_SQUAD, MIN_SQUAD, generateWorld } from './generate'
import { clubStrength } from './queries'

const SEASON = 2026
let world: World
let genMs = 0

beforeAll(() => {
  const t = performance.now()
  world = generateWorld(new Rng(42), { season: SEASON, heroCountryId: 'TR' })
  genMs = performance.now() - t
})

describe('generateWorld', () => {
  it('runs fast enough for mobile (< 1.5 s)', () => {
    expect(genMs).toBeLessThan(1500)
  })

  it('creates ≥10 countries with 2 tiers each and 3 for the hero country', () => {
    const countries = Object.keys(world.countries)
    expect(countries.length).toBeGreaterThanOrEqual(10)
    for (const id of countries) {
      const tiers = Object.values(world.leagues).filter((l) => l.countryId === id).map((l) => l.tier).sort()
      expect(tiers).toEqual(id === 'TR' ? [1, 2, 3] : [1, 2])
    }
  })

  it('fills leagues with 16–20 clubs and consistent promotion/relegation spots', () => {
    for (const l of Object.values(world.leagues)) {
      expect(l.clubIds.length).toBeGreaterThanOrEqual(16)
      expect(l.clubIds.length).toBeLessThanOrEqual(20)
      for (const id of l.clubIds) expect(world.clubs[id]!.leagueId).toBe(l.id)
      const below = Object.values(world.leagues).find((x) => x.countryId === l.countryId && x.tier === l.tier + 1)
      expect(l.relegate).toBe(below ? boundarySpots(l.countryId, l.tier) : 0)
      expect(l.promote).toBe(l.tier > 1 ? boundarySpots(l.countryId, l.tier - 1) : 0)
    }
  })

  it('gives every club a sensible 24–28 man squad', () => {
    for (const club of Object.values(world.clubs)) {
      expect(club.squad.length).toBeGreaterThanOrEqual(MIN_SQUAD)
      expect(club.squad.length).toBeLessThanOrEqual(MAX_SQUAD)
      const players = club.squad.map((id) => world.players[id])
      const count = (pos: string) => players.filter((p) => p!.position === pos).length
      expect(count('GK')).toBeGreaterThanOrEqual(3)
      expect(players.filter((p) => ['CB', 'LB', 'RB'].includes(p!.position)).length).toBeGreaterThanOrEqual(6)
      expect(players.filter((p) => ['LW', 'RW', 'ST', 'AM'].includes(p!.position)).length).toBeGreaterThanOrEqual(3)
      for (const p of players) {
        expect(p!.clubId).toBe(club.id)
        const age = SEASON - p!.birthYear
        expect(age).toBeGreaterThanOrEqual(17)
        expect(age).toBeLessThanOrEqual(36)
        expect(p!.potential).toBeGreaterThanOrEqual(p!.ovr)
        expect(p!.value).toBeGreaterThan(0)
        expect(p!.wage).toBeGreaterThan(0)
        expect(p!.contractUntil).toBeGreaterThanOrEqual(SEASON)
      }
    }
  })

  it('scales ability with tier and country reputation', () => {
    const avg = (leagueId: string) => {
      const s = world.leagues[leagueId]!.clubIds.map((id) => clubStrength(world, id).overall)
      return { mean: s.reduce((a, b) => a + b, 0) / s.length, max: Math.max(...s), min: Math.min(...s) }
    }
    const en1 = avg('EN1')
    const tr3 = avg('TR3')
    expect(en1.max).toBeGreaterThan(80)
    expect(en1.max).toBeLessThan(92)
    expect(en1.min).toBeGreaterThan(66)
    expect(tr3.max).toBeLessThan(68)
    expect(tr3.min).toBeGreaterThan(42)
    expect(avg('EN1').mean).toBeGreaterThan(avg('EN2').mean)
    expect(avg('TR1').mean).toBeGreaterThan(avg('TR2').mean)
    expect(avg('TR2').mean).toBeGreaterThan(avg('TR3').mean)
    expect(avg('EN1').mean).toBeGreaterThan(avg('US1').mean)
    const best = Math.max(...Object.values(world.players).map((p) => p.ovr))
    expect(best).toBeGreaterThanOrEqual(86)
    expect(best).toBeLessThanOrEqual(95)
  })

  it('uses a sensible position mix across the world', () => {
    const counts = new Map(POSITIONS.map((p) => [p, 0]))
    for (const p of Object.values(world.players)) counts.set(p.position, (counts.get(p.position) ?? 0) + 1)
    const total = Object.keys(world.players).length
    for (const pos of POSITIONS) expect((counts.get(pos) ?? 0) / total).toBeGreaterThan(0.03)
    expect((counts.get('GK') ?? 0) / total).toBeGreaterThan(0.09)
    expect((counts.get('GK') ?? 0) / total).toBeLessThan(0.16)
  })

  it('gives clubs unique, fictional names and unique short codes per country', () => {
    const names = new Set<string>()
    const shortByCountry = new Map<string, Set<string>>()
    for (const c of Object.values(world.clubs)) {
      expect(isRealClubName(c.name)).toBe(false)
      expect(names.has(c.name)).toBe(false)
      names.add(c.name)
      expect(c.shortName).toMatch(/^[A-Z]{3}$/)
      const set = shortByCountry.get(c.countryId) ?? new Set()
      expect(set.has(c.shortName)).toBe(false)
      set.add(c.shortName)
      shortByCountry.set(c.countryId, set)
      expect(c.stadium.capacity).toBeGreaterThanOrEqual(3000)
      expect(c.stadium.name.length).toBeGreaterThan(3)
      expect(c.managerName).toMatch(/\S+ \S+/)
      expect(c.crest.initials.length).toBeGreaterThan(0)
      expect(c.budget).toBeGreaterThan(0)
    }
  })

  it('creates kits with readable trim and contrasting away colours', () => {
    for (const c of Object.values(world.clubs)) {
      expect(colorDistance(c.colors.primary, c.awayColors.primary)).toBeGreaterThanOrEqual(MIN_KIT_DISTANCE)
      expect(contrastRatio(c.colors.primary, c.colors.secondary)).toBeGreaterThanOrEqual(1.9)
      expect(contrastRatio(c.awayColors.primary, c.awayColors.secondary)).toBeGreaterThanOrEqual(1.9)
    }
  })

  it('creates ~150 free agents', () => {
    const free = Object.values(world.players).filter((p) => p.clubId === null)
    expect(free.length).toBe(FREE_AGENT_COUNT)
  })

  it('creates all competitions for the season', () => {
    for (const l of Object.values(world.leagues)) {
      const comp = world.competitions[leagueCompId(SEASON, l.id)]!
      const n = l.clubIds.length
      expect(comp.fixtures.length).toBe(n * (n - 1))
      expect(comp.table?.length).toBe(n)
    }
    for (const id of Object.keys(world.countries)) {
      const cup = world.competitions[cupCompId(SEASON, id)]!
      const clubs = Object.values(world.clubs).filter((c) => c.countryId === id).length
      expect(cup.participantIds.length).toBe(clubs)
      expect(cup.alive?.length).toBe(clubs)
      expect(cup.fixtures.length).toBeGreaterThan(0)
    }
    // Continental: 3/4 of the 32-team group stage direct, 8 places through 16 two-legged qualifiers.
    const cont = world.competitions[continentalCompId(SEASON)]!
    const qual = world.competitions[continentalQualifyingCompId(SEASON)]!
    expect(cont.participantIds.length + qual.participantIds.length / 2).toBe(32)
    expect(cont.participantIds.length).toBe(24)
    const all = [...cont.participantIds, ...qual.participantIds]
    expect(new Set(all).size).toBe(all.length)
    expect(cont.fixtures.length).toBe(0) // groups are drawn once the qualifying round is over
    expect(qual.fixtures.length).toBe(qual.participantIds.length)
    expect(qual.fixtures.every((f) => f.leg === 1 || f.leg === 2)).toBe(true)
    for (const id of all) expect(world.leagues[world.clubs[id]!.leagueId]!.tier).toBe(1)
    expect(world.honours).toEqual([])
  })

  it('is deterministic for the same seed and differs for another seed', () => {
    const a = generateWorld(new Rng(7), { season: SEASON, heroCountryId: 'ES' })
    const b = generateWorld(new Rng(7), { season: SEASON, heroCountryId: 'ES' })
    const c = generateWorld(new Rng(8), { season: SEASON, heroCountryId: 'ES' })
    const ja = JSON.stringify(a)
    expect(hashString(ja)).toBe(hashString(JSON.stringify(b)))
    expect(hashString(ja)).not.toBe(hashString(JSON.stringify(c)))
    expect(Object.values(a.leagues).filter((l) => l.countryId === 'ES').length).toBe(3)
  })

  it('supports a restricted country set and rejects unknown hero countries', () => {
    const small = generateWorld(new Rng(1), { season: SEASON, heroCountryId: 'TR', countryIds: ['TR', 'EN', 'DE', 'IT'] })
    expect(Object.keys(small.countries).sort()).toEqual(['DE', 'EN', 'IT', 'TR'])
    const q = small.competitions[continentalQualifyingCompId(SEASON)]
    expect(small.competitions[continentalCompId(SEASON)]!.participantIds.length + (q?.participantIds.length ?? 0) / 2).toBe(16)
    expect(() => generateWorld(new Rng(1), { season: SEASON, heroCountryId: 'XX' })).toThrow()
  })
})
