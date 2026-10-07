import { Rng } from '../../core/rng'
import {
  CONTINENTAL_GROUP_WEEKS, CONTINENTAL_KO_WEEKS, CUP_WEEKS, END_OF_SEASON_WEEK, INTERNATIONAL_BREAK_WEEKS,
  LAST_MATCH_WEEK, LEAGUE_DAY, LEAGUE_WEEKS, SEASON_WEEKS, buildLeagueFixtures, cupRoundWeek, doubleRoundRobin,
  leagueRoundWeek, roundRobin,
} from './fixtures'

const teams = (n: number) => Array.from({ length: n }, (_, i) => `t${i}`)

function checkDoubleRoundRobin(n: number) {
  const ids = teams(n)
  const rounds = doubleRoundRobin(ids)
  const evenN = n % 2 === 0 ? n : n + 1
  expect(rounds.length).toBe(2 * (evenN - 1))
  const meetings = new Map<string, number>()
  const homeCount = new Map<string, number>()
  for (const round of rounds) {
    const seen = new Set<string>()
    for (const [h, a] of round) {
      expect(h).not.toBe(a)
      expect(seen.has(h) || seen.has(a)).toBe(false) // no team twice per round
      seen.add(h)
      seen.add(a)
      meetings.set(`${h}>${a}`, (meetings.get(`${h}>${a}`) ?? 0) + 1)
      homeCount.set(h, (homeCount.get(h) ?? 0) + 1)
    }
  }
  for (const a of ids) {
    for (const b of ids) {
      if (a !== b) expect(meetings.get(`${a}>${b}`)).toBe(1) // each ordered pairing exactly once
    }
    expect(homeCount.get(a)).toBe(n - 1)
  }
}

describe('round robin', () => {
  it.each([4, 16, 18, 20])('double round robin of %i teams is valid', (n) => checkDoubleRoundRobin(n))
  it.each([5, 17])('handles an odd number (%i) of teams with byes', (n) => checkDoubleRoundRobin(n))

  it('single round robin has n-1 rounds of n/2 matches', () => {
    const r = roundRobin(teams(20))
    expect(r.length).toBe(19)
    for (const round of r) expect(round.length).toBe(10)
  })

  it('home/away alternates reasonably (no team has 3+ consecutive home games too often)', () => {
    const rounds = doubleRoundRobin(teams(20))
    let longRuns = 0
    for (const t of teams(20)) {
      let run = 0
      for (const round of rounds) {
        const home = round.some(([h]) => h === t)
        run = home ? run + 1 : 0
        if (run >= 3) longRuns++
      }
    }
    expect(longRuns).toBeLessThan(40)
  })
})

describe('league schedule', () => {
  it('assigns each round its own Saturday and spreads short leagues to the final week', () => {
    const fixtures = buildLeagueFixtures(new Rng(1), 'L', teams(16))
    expect(fixtures.length).toBe(16 * 15)
    const weekOfRound = new Map<number, number>()
    for (const f of fixtures) {
      expect(f.day).toBe(LEAGUE_DAY)
      const w = weekOfRound.get(f.round)
      if (w === undefined) weekOfRound.set(f.round, f.week)
      else expect(f.week).toBe(w)
    }
    const weeks = [...weekOfRound.values()]
    expect(new Set(weeks).size).toBe(30)
    expect(Math.max(...weeks)).toBe(LAST_MATCH_WEEK)
    expect(leagueRoundWeek(0, 38)).toBe(1)
    expect(leagueRoundWeek(37, 38)).toBe(LAST_MATCH_WEEK)
  })

  it('no team plays twice on the same day', () => {
    const fixtures = buildLeagueFixtures(new Rng(2), 'L', teams(20))
    const byDay = new Map<string, Set<string>>()
    for (const f of fixtures) {
      const key = `${f.week}-${f.day}`
      const set = byDay.get(key) ?? new Set<string>()
      expect(set.has(f.homeId) || set.has(f.awayId)).toBe(false)
      set.add(f.homeId)
      set.add(f.awayId)
      byDay.set(key, set)
    }
  })

  it('is deterministic per seed', () => {
    expect(buildLeagueFixtures(new Rng(7), 'L', teams(18))).toEqual(buildLeagueFixtures(new Rng(7), 'L', teams(18)))
  })
})

describe('calendar layout', () => {
  it('keeps competitions apart and inside the season', () => {
    expect(LEAGUE_WEEKS.length).toBe(38)
    for (const w of LEAGUE_WEEKS) expect(INTERNATIONAL_BREAK_WEEKS).not.toContain(w)
    const midweek = [...CUP_WEEKS, ...CONTINENTAL_GROUP_WEEKS, ...CONTINENTAL_KO_WEEKS]
    expect(new Set(midweek).size).toBe(midweek.length) // ≤ 2 matches per club per week
    for (const w of midweek) {
      expect(INTERNATIONAL_BREAK_WEEKS).not.toContain(w)
      expect(w).toBeGreaterThan(0)
      expect(w).toBeLessThanOrEqual(LAST_MATCH_WEEK)
    }
    expect(END_OF_SEASON_WEEK).toBeLessThan(SEASON_WEEKS)
    expect(cupRoundWeek(5, 6)).toBe(CUP_WEEKS[CUP_WEEKS.length - 1])
  })
})
