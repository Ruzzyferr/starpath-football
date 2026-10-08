import { describe, expect, it } from 'vitest'
import { emptyStats } from '../career/common'
import { statsByClub } from './clubStats'

const st = (apps: number, goals: number, ratingSum = 0) => ({ ...emptyStats(), apps, goals, ratingSum })

describe('statsByClub', () => {
  it('aggregates seasons per club and adds the current season', () => {
    const hero = {
      history: [
        { season: 2026, clubId: 'a', clubName: 'A', leagueName: 'L', stats: st(10, 3, 70), leaguePosition: 1, trophies: [] },
        { season: 2027, clubId: 'b', clubName: 'B', leagueName: 'L', stats: st(30, 12, 210), leaguePosition: 2, trophies: [] },
        { season: 2028, clubId: 'a', clubName: 'A', leagueName: 'L', stats: st(5, 1, 30), leaguePosition: 3, trophies: [] },
      ],
      seasonStats: st(8, 4, 56),
    }
    const rows = statsByClub(hero, { clubId: 'b', clubName: 'B' })
    expect(rows.map((r) => [r.clubId, r.seasons, r.stats.apps, r.stats.goals])).toEqual([['b', 2, 38, 16], ['a', 2, 15, 4]])
    expect(rows[0].stats.ratingSum).toBe(266)
  })
  it('skips an empty current season', () => {
    expect(statsByClub({ history: [], seasonStats: emptyStats() }, { clubId: 'x', clubName: 'X' })).toEqual([])
  })
})
