import { describe, expect, it } from 'vitest'
import { CHALLENGES, applyMatch, careerCsv, challengeFor, emptyLocalMeta, localBoard } from './localMeta'
import type { MatchFeats } from './records'
import type { CareerSummary } from './hallOfFame'

const feats = (o: Partial<MatchFeats> = {}): MatchFeats => ({
  fixtureId: 'f1', season: 2026, week: 3, compType: 'league', final: false, opponent: 'Rival', opponentReputation: 50,
  minutes: 90, started: true, goals: 0, assists: 0, freeKickGoals: 0, penaltyGoals: 0, headerGoals: 0, rating: 6.5, motm: false,
  won: false, drew: false, goalsFor: 0, goalsAgainst: 1, cleanSheet: false, saves: 0, isKeeper: false, red: false, injured: false, ...o,
})

describe('weekly challenge rotation', () => {
  it('is deterministic and keeper-aware', () => {
    expect(challengeFor(2026, 5, false).id).toBe(challengeFor(2026, 5, false).id)
    for (let w = 0; w < 40; w++) {
      expect(challengeFor(2026, w, true).outfieldOnly).toBeFalsy()
      expect(challengeFor(2026, w, false).keeperOnly).toBeFalsy()
    }
  })
  it('does not repeat inside one rotation block and covers the pool', () => {
    const n = CHALLENGES.filter((c) => !c.keeperOnly).length
    const ids = new Set(Array.from({ length: n }, (_, w) => challengeFor(2027, w, false).id))
    expect(ids.size).toBe(n)
  })
})

describe('applyMatch', () => {
  it('completes the challenge once per week and is idempotent per fixture', () => {
    const m = emptyLocalMeta()
    const def = challengeFor(2026, 3, false)
    // craft a match that passes every challenge test
    const f = feats({ goals: 3, assists: 2, motm: true, rating: 9, won: true, goalsFor: 3, goalsAgainst: 0, cleanSheet: true, opponentReputation: 90 })
    expect(def.test(f)).toBe(true)
    expect(applyMatch(m, f).completed?.id).toBe(def.id)
    expect(applyMatch(m, f).completed).toBeNull()
    expect(Object.keys(m.challenges)).toEqual(['2026:3'])
    expect(m.streak).toBe(1)
    // another match same week does not double count
    expect(applyMatch(m, { ...f, fixtureId: 'f2' }).completed).toBeNull()
  })
  it('streak continues on consecutive weeks and resets after a gap', () => {
    const m = emptyLocalMeta()
    const star = (week: number) => {
      const f = feats({ fixtureId: `w${week}`, week, goals: 3, assists: 2, motm: true, rating: 9.5, won: true, goalsFor: 3, goalsAgainst: 0, cleanSheet: true, opponentReputation: 90, saves: 6 })
      applyMatch(m, f)
    }
    star(1); star(2); star(3)
    expect(m.streak).toBe(3)
    star(7)
    expect(m.streak).toBe(1)
    expect(m.bestStreak).toBe(3)
  })
  it('tracks personal bests and announces improvements only after the first match', () => {
    const m = emptyLocalMeta()
    expect(applyMatch(m, feats({ fixtureId: 'a', rating: 7.2, goals: 1 })).newBests).toEqual([])
    const r = applyMatch(m, feats({ fixtureId: 'b', rating: 8.4, goals: 2, won: true, goalsFor: 2, goalsAgainst: 0 }))
    expect(r.newBests).toEqual(expect.arrayContaining(['bestRating', 'goalsMatch', 'biggestWin']))
    expect(m.bests.bestRating).toBe(8.4)
  })
})

const career = (id: string, goals: number, legacy: number): CareerSummary =>
  ({
    careerId: id, name: id, position: 'ST', startSeason: 2026, endSeason: 2040, clubs: ['A', 'B'], legacyScore: legacy,
    totals: { apps: 100, goals, assists: 10, motm: 1, cleanSheets: 0, avgRating: 7 }, trophies: [],
    timeline: [{ season: 2026, clubName: 'A, "FC"', leagueName: 'L', apps: 10, goals: 4, assists: 1, avgRating: 7.123, leaguePosition: 3, trophies: ['Cup'] }],
  }) as unknown as CareerSummary

describe('leaderboard and export', () => {
  it('sorts by metric with legacy tie-break', () => {
    const list = [career('a', 10, 100), career('b', 30, 50), career('c', 30, 80)]
    expect(localBoard(list, 'goals').map((e) => e.careerId)).toEqual(['c', 'b', 'a'])
    expect(localBoard(list, 'legacy').map((e) => e.careerId)).toEqual(['a', 'c', 'b'])
  })
  it('exports a CSV with escaped cells', () => {
    const csv = careerCsv(career('a', 1, 1), 'en')
    expect(csv.split('\n')[0]).toContain('Season')
    expect(csv).toContain('"A, ""FC"""')
    expect(csv).toContain('7.12')
  })
})
