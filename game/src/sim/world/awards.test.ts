/**
 * Awards: Golden Star voting (determinism, sanity), Player of the Month from
 * fixture data, Golden Glove, Goal and Team of the Season.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { Rng } from '../../core/rng'
import type { World } from '../../core/types'
import { START_YEAR } from '../../core/config'
import {
  GOLDEN_STAR_JOURNALISTS, GOLDEN_STAR_SHORTLIST, VOTE_POINTS, computeMonthAwards, computeSeasonAwardRecord, describeGoal, ensureAwards,
  goldenStarShortlist, goldenStarVote, monthWeeks,
} from './awards'
import { SEASON_WEEKS } from './fixtures'
import { generateWorld } from './generate'
import { playFixturesFor, weeklyTick } from './season'

const S = START_YEAR

describe('awards over a season', () => {
  let world: World
  beforeAll(() => {
    world = generateWorld(new Rng(9), { season: S, heroCountryId: 'TR', countryIds: ['TR', 'EN', 'ES', 'DE'] })
    const rng = new Rng(10)
    for (let week = 0; week < 42; week++) {
      for (let day = 0; day < 7; day++) playFixturesFor(world, rng, S, week, day)
      weeklyTick(world)
    }
    void SEASON_WEEKS
  })

  it('Golden Star: top-30 shortlist and a deterministic 100-journalist vote', () => {
    const list = goldenStarShortlist(world, S)
    expect(list).toHaveLength(GOLDEN_STAR_SHORTLIST)
    for (let i = 1; i < list.length; i++) expect(list[i - 1].score).toBeGreaterThanOrEqual(list[i].score)
    for (const c of list) expect(c.score).toBeCloseTo(c.parts.league + c.parts.continental + c.parts.international + c.parts.trophies, 1)
    const a = goldenStarVote(list, S)
    const b = goldenStarVote(goldenStarShortlist(world, S), S)
    expect(b).toEqual(a)
    expect(a.journalists).toBe(GOLDEN_STAR_JOURNALISTS)
    const total = a.ranking.reduce((s, c) => s + c.points, 0)
    expect(total).toBe(GOLDEN_STAR_JOURNALISTS * VOTE_POINTS.reduce((s, v) => s + v, 0))
    expect(a.ranking.reduce((s, c) => s + c.firsts, 0)).toBe(GOLDEN_STAR_JOURNALISTS)
    for (let i = 1; i < a.ranking.length; i++) expect(a.ranking[i - 1].points).toBeGreaterThanOrEqual(a.ranking[i].points)
    // Sanity: the winner comes from the top of the shortlist.
    const winnerScoreRank = list.findIndex((c) => c.playerId === a.ranking[0].playerId)
    expect(winnerScoreRank).toBeLessThan(10)
  })

  it('hero competes on equal terms', () => {
    const top = goldenStarShortlist(world, S)[0]
    const p = world.players[top.playerId]
    const hero = { name: 'Hero', clubId: p.clubId, nationality: p.nationality, position: p.position, ovr: p.ovr + 5, age: 24, stats: { ...p.stats, goals: p.stats.goals + 15, ratingSum: p.stats.ratingSum + p.stats.apps * 0.5 }, intlCaps: 6, intlGoals: 4 }
    const list = goldenStarShortlist(world, S, hero)
    expect(list[0].isHero).toBe(true)
    expect(goldenStarVote(list, S).ranking[0].isHero).toBe(true)
  })

  it('Player of the Month per league from real fixture data', () => {
    const awards = computeMonthAwards(world, S, 2)
    expect(awards.length).toBeGreaterThan(0)
    const [from, to] = monthWeeks(2)
    for (const a of awards) {
      expect(a.goals * 3 + a.assists * 2).toBeLessThanOrEqual(a.score + 1e-9)
      let goals = 0
      for (const c of Object.values(world.competitions)) {
        if (c.type === 'international') continue
        for (const f of c.fixtures) if (f.result && f.week >= from && f.week <= to) goals += f.result.scorers.filter((s) => s.playerId === a.playerId && !s.ownGoal).length
      }
      expect(goals).toBe(a.goals)
    }
  })

  it('Golden Glove, Young Player, Goal and Team of the Season', () => {
    const rec = computeSeasonAwardRecord(world, S, undefined, 'EN1')
    expect(world.players[rec.goldenGlove!.playerId].position).toBe('GK')
    expect(rec.youngPlayer).not.toBeNull()
    expect(rec.goalNominees.length).toBeGreaterThan(0)
    expect(rec.goalNominees).toContainEqual(rec.goalOfSeason)
    expect(ensureAwards(world).goals.length).toBeGreaterThan(0)
    expect(rec.teamOfSeason).toHaveLength(11)
    expect(rec.teamOfSeason[0].slot).toBe('GK')
    expect(new Set(rec.teamOfSeason.map((p) => p.playerId)).size).toBe(11)
    for (const p of rec.teamOfSeason) expect(world.leagues.EN1.clubIds).toContain(p.clubId)
  })

  it('goal descriptors are deterministic and penalties are never nominated', () => {
    expect(describeGoal('f1', 33, 'p1')).toEqual(describeGoal('f1', 33, 'p1'))
    expect(describeGoal('f1', 33, 'p1', { penalty: true })).toBeNull()
    const d = describeGoal('f1', 33, 'p1', { kind: 'free_kick' })!
    expect(d.kind).toBe('free_kick')
    expect(d.score).toBeGreaterThanOrEqual(0)
    expect(d.score).toBeLessThanOrEqual(10)
  })
})
