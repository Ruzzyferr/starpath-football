/**
 * Cup depth: two-legged aggregate logic, draw constraints, continental
 * qualifying from coefficients, coefficient updates and promotion play-offs.
 */
import { describe, expect, it } from 'vitest'
import { Rng } from '../../core/rng'
import type { Competition, Fixture, MatchResultSummary, World } from '../../core/types'
import { START_YEAR } from '../../core/config'
import { coefficientRanking, ensureCoefficients } from './coefficients'
import {
  applyFixtureResult, continentalCompId, continentalGroups, continentalQualifyingCompId, cupCompId, hasPlayoff, playoffCompId,
  selectContinentalEntrants, tieAggregate, tieWinner, twoLegFixtures,
} from './competitions'
import { INTERNATIONAL_BREAK_WEEKS, SEASON_WEEKS } from './fixtures'
import { generateWorld } from './generate'
import { clubFixtures, seasonCompetitions } from './queries'
import { endOfSeason, playFixturesFor, promotedClubs, weeklyTick } from './season'

const S = START_YEAR
const r = (home: number, away: number, penalties?: { home: number; away: number }): MatchResultSummary => ({ home, away, scorers: [], ...(penalties ? { penalties } : {}) })

function tie(): { comp: Competition; legs: Fixture[] } {
  const comp: Competition = {
    id: 'T', type: 'continental', name: { tr: 'T', en: 'T' }, season: S, countryId: null, leagueId: null, participantIds: ['A', 'B'],
    fixtures: [], table: null, alive: ['A', 'B'], winnerId: null, meta: { format: 'continental_q' },
  }
  comp.fixtures = twoLegFixtures(comp, 0, [['A', 'B']], [1, 2], 3)
  return { comp, legs: comp.fixtures }
}

describe('two-legged ties', () => {
  it('second leg is the reverse fixture and nobody is out after the first leg', () => {
    const { comp, legs } = tie()
    expect(legs.map((f) => [f.homeId, f.awayId, f.leg, f.week])).toEqual([['A', 'B', 1, 1], ['B', 'A', 2, 2]])
    applyFixtureResult(comp, legs[0]!, r(3, 0))
    expect(comp.alive).toEqual(['A', 'B'])
    expect(tieWinner(comp, legs[0]!)).toBeNull()
  })

  it('aggregate decides (3-0, 1-2 → A through 4-2)', () => {
    const { comp, legs } = tie()
    applyFixtureResult(comp, legs[0]!, r(3, 0))
    applyFixtureResult(comp, legs[1]!, r(2, 1))
    expect(tieAggregate(comp, legs[1]!)).toEqual([4, 2])
    expect(tieWinner(comp, legs[1]!)).toBe('A')
    expect(comp.alive).toEqual(['A'])
  })

  it('no away-goals rule: level aggregate goes to the second-leg penalties', () => {
    const { comp, legs } = tie()
    applyFixtureResult(comp, legs[0]!, r(1, 2)) // B scored 2 away
    applyFixtureResult(comp, legs[1]!, r(0, 1, { home: 3, away: 4 })) // A scored 1 away, 2-2 on aggregate, A wins pens
    expect(tieAggregate(comp, legs[0]!)).toEqual([2, 2])
    expect(tieWinner(comp, legs[1]!)).toBe('A')
    expect(comp.alive).toEqual(['A'])
  })
})

describe('a season of cups', () => {
  const world: World = generateWorld(new Rng(42), { season: S, heroCountryId: 'TR', countryIds: ['TR', 'EN', 'ES', 'DE', 'IT', 'FR'] })
  const rng = new Rng(43)
  const qual0 = world.competitions[continentalQualifyingCompId(S)]!
  const cup0 = world.competitions[cupCompId(S, 'TR')]!
  const firstDraw = { ...cup0.meta!.draws![0] }
  for (let week = 0; week < SEASON_WEEKS; week++) {
    for (let day = 0; day < 7; day++) playFixturesFor(world, rng, S, week, day)
    weeklyTick(world)
  }

  it('seeds the domestic cup draw (higher tier vs lower tier) and lets the lower tier host', () => {
    const tierOf = (id: string) => world.leagues[world.clubs[id]!.leagueId]!.tier
    expect(firstDraw.seeded?.length).toBe(firstDraw.pairs!.length)
    const seeded = new Set(firstDraw.seeded)
    for (const [h, a] of firstDraw.pairs!) {
      expect(seeded.has(h) !== seeded.has(a)).toBe(true)
      expect(tierOf(h)).toBeGreaterThanOrEqual(tierOf(a))
    }
    // Every round is a valid draw: nobody twice, every tie decided, final at a neutral venue.
    const rounds = new Map<number, Set<string>>()
    for (const f of cup0.fixtures) {
      const set = rounds.get(f.round) ?? new Set()
      expect(set.has(f.homeId) || set.has(f.awayId)).toBe(false)
      set.add(f.homeId).add(f.awayId)
      rounds.set(f.round, set)
      expect(f.result!.home !== f.result!.away || !!f.result!.penalties).toBe(true)
    }
    expect(cup0.fixtures.find((f) => f.round === Math.max(...rounds.keys()))!.neutral).toBe(true)
    expect(cup0.winnerId).toBeTruthy()
  })

  it('qualifying winners join the continental groups; knockout ties are two-legged with a single final', () => {
    const cont = world.competitions[continentalCompId(S)]!
    expect(qual0.fixtures.every((f) => f.leg)).toBe(true)
    for (const id of qual0.alive!) expect(cont.participantIds).toContain(id)
    expect(qual0.alive!.length).toBe(qual0.participantIds.length / 2)
    const ko = cont.fixtures.filter((f) => f.round >= 6)
    const finalRoundNo = Math.max(...ko.map((f) => f.round))
    for (const f of ko) expect(f.round === finalRoundNo ? !f.leg && f.neutral : !!f.leg).toBe(true)
    // First knockout round: group winners host the second leg against runners-up of another group.
    const groups = continentalGroups(cont!)
    const firstKo = ko.filter((f) => f.round === 6 && f.leg === 2)
    for (const f of firstKo) {
      const gh = groups.findIndex((g) => g[0] === f.homeId)
      const ga = groups.findIndex((g) => g[1] === f.awayId)
      expect(gh).toBeGreaterThanOrEqual(0)
      expect(ga).toBeGreaterThanOrEqual(0)
      expect(gh).not.toBe(ga)
    }
    expect(cont.winnerId).toBeTruthy()
  })

  it('keeps the fixture calendar valid: no club twice a day, ≤ 2 games a week, nothing in international breaks', () => {
    for (const clubId of Object.keys(world.clubs)) {
      const days = new Set<string>()
      const perWeek = new Map<number, number>()
      for (const { fixture: f } of clubFixtures(world, clubId, S)) {
        const k = `${f.week}-${f.day}`
        expect(days.has(k)).toBe(false)
        days.add(k)
        perWeek.set(f.week, (perWeek.get(f.week) ?? 0) + 1)
        expect(INTERNATIONAL_BREAK_WEEKS).not.toContain(f.week)
      }
      for (const n of perWeek.values()) expect(n).toBeLessThanOrEqual(2)
    }
  })

  it('runs promotion play-offs for 3rd–6th of tier 2/3 and promotes the winner', () => {
    const lower = Object.values(world.leagues).filter((l) => l.tier >= 2)
    expect(lower.length).toBeGreaterThan(0)
    for (const l of lower) {
      expect(hasPlayoff(world, l.id)).toBe(true)
      const po = world.competitions[playoffCompId(S, l.id)]!
      expect(po.participantIds).toHaveLength(4)
      expect(po.fixtures.every((f) => f.week >= 40 && f.week <= 41)).toBe(true)
      expect(po.winnerId).toBeTruthy()
      const promoted = promotedClubs(world, l.id, S, 3)
      expect(promoted).toHaveLength(3)
      expect(promoted).toContain(po.winnerId)
    }
  })

  it('updates coefficients from results and uses them for next season\'s places', () => {
    ensureCoefficients(world)
    const before = coefficientRanking(world).map((c) => c.total)
    const { summary } = endOfSeason(world, rng, S)
    expect(Object.keys(summary.coefficientPoints).length).toBeGreaterThan(0)
    for (const v of Object.values(summary.coefficientPoints)) expect(Number.isFinite(v) && v >= 0).toBe(true)
    const after = coefficientRanking(world)
    expect(after.map((c) => c.total)).not.toEqual(before)
    for (const c of after) expect(c.seasons).toHaveLength(5)
    const e = selectContinentalEntrants(world, S + 1)
    const perCountry = new Map<string, number>()
    for (const id of [...e.direct, ...e.qualifying]) perCountry.set(world.clubs[id]!.countryId, (perCountry.get(world.clubs[id]!.countryId) ?? 0) + 1)
    // The top-ranked country never gets fewer places than the bottom one.
    expect(perCountry.get(after[0]!.countryId) ?? 0).toBeGreaterThanOrEqual(perCountry.get(after[after.length - 1]!.countryId) ?? 0)
    expect(seasonCompetitions(world, S + 1).some((c) => c.id === continentalCompId(S + 1))).toBe(true)
  })
})
