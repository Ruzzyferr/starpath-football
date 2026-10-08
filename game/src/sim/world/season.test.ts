import { Rng, hashString } from '../../core/rng'
import type { MatchResultSummary, World } from '../../core/types'
import { autoPromotionPlaces, continentalCompId, continentalQualifyingCompId, cupCompId, finalRound, isQualifyingComp, leagueCompId, playoffCompId } from './competitions'
import { SEASON_WEEKS } from './fixtures'
import { generateWorld } from './generate'
import { clubFixtures, seasonCompetitions } from './queries'
import { computeTable, sortTable } from './table'
import {
  SQUAD_MAX, SQUAD_MIN, aiTransferWindow, endOfSeason, playFixturesFor, playerSeasonScore, recordFixtureResult,
  seasonAwards, weeklyTick,
} from './season'
import type { EndOfSeasonSummary } from './season'

const S = 2026
const COUNTRIES = ['TR', 'EN', 'ES', 'DE', 'IT', 'FR', 'PT', 'NL']

function playSeason(world: World, rng: Rng, skip: ReadonlySet<string> = new Set()) {
  for (let week = 0; week < SEASON_WEEKS; week++) {
    for (let day = 0; day < 7; day++) playFixturesFor(world, rng, S, week, day, skip)
    weeklyTick(world)
  }
}

describe('a full season', () => {
  let world: World
  let rng: Rng
  let summary: EndOfSeasonSummary
  let preTables: Map<string, string[]>
  let preAges: Map<string, number>

  beforeAll(() => {
    world = generateWorld(new Rng(100), { season: S, heroCountryId: 'TR', countryIds: COUNTRIES })
    rng = new Rng(200)
    playSeason(world, rng)
    preTables = new Map()
    for (const l of Object.values(world.leagues)) {
      const comp = world.competitions[leagueCompId(S, l.id)]
      preTables.set(l.id, sortTable(comp.table!, comp.fixtures).map((r) => r.clubId))
    }
    preAges = new Map(Object.values(world.players).map((p) => [p.id, p.ovr]))
  })

  it('plays every fixture and crowns every competition', () => {
    for (const comp of seasonCompetitions(world, S)) {
      expect(comp.fixtures.every((f) => f.result)).toBe(true)
      // Qualifying rounds / groups send teams on and crown nobody.
      if (isQualifyingComp(comp)) expect(comp.winnerId).toBeNull()
      else expect(comp.winnerId).toBeTruthy()
    }
  })

  it('keeps tables consistent with fixtures', () => {
    for (const l of Object.values(world.leagues)) {
      const comp = world.competitions[leagueCompId(S, l.id)]
      const n = l.clubIds.length
      for (const row of comp.table!) {
        expect(row.p).toBe(2 * (n - 1))
        expect(row.pts).toBe(row.w * 3 + row.d)
      }
      const recomputed = computeTable(comp.participantIds, comp.fixtures)
      const sortById = <T extends { clubId: string }>(r: T[]) => [...r].sort((a, b) => (a.clubId < b.clubId ? -1 : 1))
      expect(sortById(recomputed).map(({ form, ...r }) => r)).toEqual(sortById(comp.table!).map(({ form, ...r }) => r))
      expect(comp.winnerId).toBe(sortTable(comp.table!, comp.fixtures)[0].clubId)
    }
  })

  it('runs national cups as single-elimination down to one winner', () => {
    for (const countryId of COUNTRIES) {
      const cup = world.competitions[cupCompId(S, countryId)]
      expect(cup.alive).toEqual([cup.winnerId])
      const final = cup.fixtures.filter((f) => f.round === finalRound(cup))
      expect(final.length).toBe(1)
      expect([final[0].homeId, final[0].awayId]).toContain(cup.winnerId)
      for (const f of cup.fixtures) {
        const r = f.result!
        expect(r.home !== r.away || !!r.penalties).toBe(true)
      }
      // A club never plays twice in the same cup round
      const perRound = new Map<number, Set<string>>()
      for (const f of cup.fixtures) {
        const set = perRound.get(f.round) ?? new Set()
        expect(set.has(f.homeId) || set.has(f.awayId)).toBe(false)
        set.add(f.homeId)
        set.add(f.awayId)
        perRound.set(f.round, set)
      }
    }
  })

  it('runs qualifying, the continental cup groups then a two-legged knockout', () => {
    const qual = world.competitions[continentalQualifyingCompId(S)]
    const cont = world.competitions[continentalCompId(S)]
    // 8 countries: 12 direct places + 4 qualifying winners → 4 groups, 8-team knockout.
    expect(cont.participantIds.length).toBe(16)
    expect(qual.participantIds.length).toBe(8)
    for (const id of qual.alive!) expect(cont.participantIds).toContain(id)
    const group = cont.fixtures.filter((f) => f.round < 6)
    const ko = cont.fixtures.filter((f) => f.round >= 6)
    expect(group.length).toBe(8 * 6)
    expect(ko.length).toBe(4 * 2 + 2 * 2 + 1)
    expect(ko.filter((f) => !f.leg).length).toBe(1) // single-leg final
    expect(cont.participantIds).toContain(cont.winnerId)
  })

  it('never schedules a club twice on one day or more than twice a week', () => {
    for (const clubId of Object.keys(world.clubs).slice(0, 80)) {
      const fx = clubFixtures(world, clubId, S).map((f) => f.fixture)
      const days = new Set<string>()
      const perWeek = new Map<number, number>()
      for (const f of fx) {
        const key = `${f.week}-${f.day}`
        expect(days.has(key)).toBe(false)
        days.add(key)
        perWeek.set(f.week, (perWeek.get(f.week) ?? 0) + 1)
      }
      for (const n of perWeek.values()) expect(n).toBeLessThanOrEqual(2)
    }
  })

  it('tracks NPC stats and produces awards', () => {
    const awards = seasonAwards(world, S)
    expect(awards.topScorer!.value).toBeGreaterThanOrEqual(15)
    expect(awards.topScorer!.value).toBeLessThanOrEqual(60)
    expect(awards.bestPlayer).not.toBeNull()
    expect(awards.youngPlayer).not.toBeNull()
    const young = world.players[awards.youngPlayer!.playerId]
    expect(S - young.birthYear).toBeLessThanOrEqual(21)
    expect(Object.keys(awards.leagueTopScorers).length).toBe(Object.keys(world.leagues).length)
    const totalGoals = Object.values(world.players).reduce((s, p) => s + p.stats.goals, 0)
    let fixtureGoals = 0
    let ownGoals = 0
    for (const comp of seasonCompetitions(world, S)) {
      if (comp.type === 'international') continue // internationals are not club stats
      for (const f of comp.fixtures) {
        fixtureGoals += f.result!.home + f.result!.away
        ownGoals += f.result!.scorers.filter((s) => s.ownGoal).length
      }
    }
    expect(totalGoals).toBe(fixtureGoals - ownGoals)
    expect(playerSeasonScore({ ...world.players[awards.bestPlayer!.playerId].stats, apps: 1 }, 80, 'ST')).toBeNull()
  })

  describe('endOfSeason', () => {
    beforeAll(() => {
      summary = endOfSeason(world, rng, S).summary
    })

    it('records honours for every competition', () => {
      const playoffs = Object.keys(world.leagues).filter((id) => world.competitions[playoffCompId(S, id)]).length
      expect(playoffs).toBe(7 + 2) // every tier-2/3 league
      const comps = Object.keys(world.leagues).length + COUNTRIES.length + 1 + playoffs
      expect(summary.champions.length).toBe(comps)
      const club = world.honours.filter((h) => !h.compKey.startsWith('nt:'))
      expect(club.length).toBe(comps)
      expect(club.every((h) => h.season === S && world.clubs[h.winnerId])).toBe(true)
      // National tournaments: two youth leagues + the continental championships of the summer.
      const nt = world.honours.filter((h) => h.compKey.startsWith('nt:'))
      expect(nt.map((h) => h.compKey).sort()).toEqual(['nt:EU', 'nt:OC', 'nt:youth:U19', 'nt:youth:U21'])
    })

    it('promotes and relegates the places each country\'s rules define between adjacent tiers', () => {
      let expected = 0
      for (const l of Object.values(world.leagues)) expected += l.relegate
      expect(expected).toBeGreaterThan(9 * 2)
      expect(summary.movements.filter((m) => m.kind === 'promoted').length).toBe(expected)
      expect(summary.movements.filter((m) => m.kind === 'relegated').length).toBe(expected)
      for (const m of summary.movements) {
        const before = preTables.get(m.fromLeagueId)!
        const idx = before.indexOf(m.clubId)
        if (m.kind === 'relegated') expect(idx).toBeGreaterThanOrEqual(before.length - world.leagues[m.fromLeagueId].relegate)
        else {
          // The automatic places go up directly, the last place goes to the play-off winner (3rd-6th).
          const po = world.competitions[playoffCompId(S, m.fromLeagueId)]
          expect(idx < autoPromotionPlaces(world, m.fromLeagueId) || m.clubId === po.winnerId).toBe(true)
          expect(idx).toBeLessThan(6)
        }
        expect(world.clubs[m.clubId].leagueId).toBe(m.toLeagueId)
        expect(world.leagues[m.toLeagueId].clubIds).toContain(m.clubId)
      }
      for (const l of Object.values(world.leagues)) expect(l.clubIds.length).toBe(preTables.get(l.id)!.length)
      const champ = preTables.get('EN1')![0]
      expect(world.clubs[champ].leagueId).toBe('EN1')
    })

    it('ages players, retires veterans and brings in youth', () => {
      expect(summary.retired.length).toBeGreaterThan(50)
      for (const r of summary.retired) {
        expect(world.players[r.id]).toBeUndefined()
        expect(r.age).toBeGreaterThanOrEqual(30)
      }
      expect(summary.youthIntake.length).toBeGreaterThanOrEqual(Object.keys(world.clubs).length)
      const keptYouth = summary.youthIntake.filter((id) => world.players[id])
      expect(keptYouth.length / summary.youthIntake.length).toBeGreaterThan(0.85)
      for (const id of keptYouth) {
        const age = S + 1 - world.players[id].birthYear
        expect(age).toBeGreaterThanOrEqual(16)
        expect(age).toBeLessThanOrEqual(18)
      }
      let improvedYoung = 0, youngCount = 0, declinedOld = 0, oldCount = 0
      for (const p of Object.values(world.players)) {
        const before = preAges.get(p.id)
        if (before === undefined) continue
        const age = S - p.birthYear
        if (age <= 21) { youngCount++; if (p.ovr > before) improvedYoung++ }
        if (age >= 32) { oldCount++; if (p.ovr < before) declinedOld++ }
        expect(p.ovr).toBeLessThanOrEqual(Math.max(p.potential, before))
      }
      expect(improvedYoung / youngCount).toBeGreaterThan(0.6)
      expect(declinedOld / oldCount).toBeGreaterThan(0.7)
    })

    it('runs transfers and keeps squads within limits', () => {
      expect(summary.transfers.length).toBeGreaterThan(50)
      for (const t of summary.transfers) expect(world.players[t.playerId]?.clubId ?? t.toClubId).toBeDefined()
      for (const club of Object.values(world.clubs)) {
        expect(club.squad.length).toBeGreaterThanOrEqual(SQUAD_MIN)
        expect(club.squad.length).toBeLessThanOrEqual(SQUAD_MAX)
        expect(new Set(club.squad).size).toBe(club.squad.length)
        for (const id of club.squad) {
          const p = world.players[id]
          expect(p).toBeDefined()
          expect(p.clubId).toBe(club.id)
          expect(p.contractUntil).toBeGreaterThanOrEqual(S + 1)
        }
      }
      const free = Object.values(world.players).filter((p) => p.clubId === null).length
      expect(free).toBeGreaterThanOrEqual(150)
    })

    it('resets stats and sets up the next season', () => {
      expect(Object.values(world.players).every((p) => p.stats.apps === 0 && p.stats.goals === 0)).toBe(true)
      for (const l of Object.values(world.leagues)) {
        const comp = world.competitions[leagueCompId(S + 1, l.id)]
        expect(comp.participantIds.sort()).toEqual([...l.clubIds].sort())
        expect(comp.fixtures.every((f) => !f.result)).toBe(true)
      }
      const q = world.competitions[continentalQualifyingCompId(S + 1)]
      expect(world.competitions[continentalCompId(S + 1)].participantIds.length + q.participantIds.length / 2).toBe(16)
      expect(seasonCompetitions(world, S).length).toBeGreaterThan(0) // last season kept for history
      // Continental places follow last season's final tables.
      const enChampion = preTables.get('EN1')![0]
      expect(world.competitions[continentalCompId(S + 1)].participantIds).toContain(enChampion)
    })
  })
})

describe('season determinism and hero fixtures', () => {
  const small = () => generateWorld(new Rng(5), { season: S, heroCountryId: 'TR', countryIds: ['TR', 'EN', 'PT', 'NL'] })

  it('replays identically from the same seeds', () => {
    const a = small()
    const b = small()
    const ra = new Rng(9)
    const rb = new Rng(9)
    playSeason(a, ra)
    playSeason(b, rb)
    endOfSeason(a, ra, S)
    endOfSeason(b, rb, S)
    expect(hashString(JSON.stringify(a))).toBe(hashString(JSON.stringify(b)))
  })

  it('skips the hero fixture until it is recorded, then continues the competition', () => {
    const w = small()
    const rng = new Rng(3)
    const heroClub = w.leagues.TR3.clubIds[0]
    const cup = w.competitions[cupCompId(S, 'TR')]
    const heroCupFixture = cup.fixtures.find((f) => f.homeId === heroClub || f.awayId === heroClub)
    const firstLeague = clubFixtures(w, heroClub, S).find((f) => f.competition.type === 'league')!.fixture
    const skip = new Set([firstLeague.id])
    if (heroCupFixture) skip.add(heroCupFixture.id)
    playFixturesFor(w, rng, S, firstLeague.week, firstLeague.day, skip)
    expect(firstLeague.result).toBeNull()

    const scorerId = w.clubs[heroClub].squad[10]
    const result: MatchResultSummary = { home: 2, away: 1, scorers: [] }
    const isHome = firstLeague.homeId === heroClub
    result.scorers.push({ minute: 10, playerId: scorerId, team: isHome ? 'home' : 'away' })
    recordFixtureResult(w, rng, firstLeague.compId, firstLeague.id, isHome ? result : { ...result, home: 1, away: 2 })
    expect(firstLeague.result).not.toBeNull()
    expect(w.players[scorerId].stats.goals).toBe(1)
    const row = w.competitions[firstLeague.compId].table!.find((r) => r.clubId === heroClub)!
    expect(row.pts).toBe(3)

    if (heroCupFixture) {
      // The cup round cannot advance while the hero's tie is unplayed.
      for (let week = 0; week <= heroCupFixture.week; week++) for (let day = 0; day < 7; day++) playFixturesFor(w, rng, S, week, day, skip)
      const roundsBefore = new Set(cup.fixtures.map((f) => f.round)).size
      recordFixtureResult(w, rng, cup.id, heroCupFixture.id, { home: 1, away: 1, penalties: { home: 4, away: 3 }, scorers: [] })
      expect(cup.alive).not.toContain(heroCupFixture.awayId)
      expect(new Set(cup.fixtures.map((f) => f.round)).size).toBe(roundsBefore + 1)
    }
  })

  it('mid-season AI transfer window is light and respects protections', () => {
    const w = small()
    const rng = new Rng(4)
    const heroClub = w.leagues.TR3.clubIds[0]
    const protectedIds = new Set(w.clubs[w.leagues.TR1.clubIds[0]].squad)
    const before = [...w.clubs[heroClub].squad]
    const moves = aiTransferWindow(w, rng, S, { maxPerClub: 1, intensity: 0.3, protectedClubIds: new Set([heroClub]), protectedPlayerIds: protectedIds })
    expect(moves.length).toBeLessThan(Object.keys(w.clubs).length * 0.4)
    expect(w.clubs[heroClub].squad).toEqual(before)
    for (const m of moves) {
      expect(protectedIds.has(m.playerId)).toBe(false)
      expect(w.players[m.playerId].clubId).toBe(m.toClubId)
      expect(w.clubs[m.toClubId].squad).toContain(m.playerId)
    }
    const counts = new Map<string, number>()
    for (const m of moves) counts.set(m.toClubId, (counts.get(m.toClubId) ?? 0) + 1)
    for (const n of counts.values()) expect(n).toBeLessThanOrEqual(1)
  })
})
