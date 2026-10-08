/**
 * Playable national team: calendar validity with internationals, tournament
 * progression, the hero's international through the live match flow, and a
 * 5-season soak (no NaN, save size within budget).
 */
import { describe, expect, it } from 'vitest'
import { ATTRIBUTE_KEYS } from '../../core/types'
import type { GameState } from '../../core/types'
import { Rng } from '../../core/rng'
import { START_YEAR } from '../../core/config'
import { generateWorld } from '../world/generate'
import { INTERNATIONAL_BREAK_WEEKS, INTERNATIONAL_DATES, NATIONAL_FINALS_DATES, SEASON_WEEKS } from '../world/fixtures'
import { endOfSeason, playFixturesFor, weeklyTick } from '../world/season'
import {
  NATIONAL_SQUAD_SIZE, finalsCompId, nationalCompetitions, nationalTeamPlayers, parseTeamId, qualifierCompId, tournamentKeys, youthCompId,
} from '../world/national'
import { clubFixtures } from '../world/queries'
import { isHeroMatchday } from './calendar'
import { unplayedHeroFixtureToday } from './internal'
import { finishHeroMatch, startHeroMatch } from './match'
import { CALLUP_THRESHOLD, callupFor, eliteLift, heroCallup, statusOf, worldEliteShare } from './national'
import { packedSize } from './persist'
import { autoRun, findNonFinite, makeGame } from './testHelpers'

const SAVE_BUDGET = 2.5 * 1024 * 1024

/** A world-class hero (called up for sure). */
function star(s: GameState): GameState {
  for (const k of ATTRIBUTE_KEYS) s.hero.attrs[k] = 90
  s.hero.reputation = 70
  s.hero.form = 75
  return s
}

describe('international calendar', () => {
  const world = generateWorld(new Rng(11), { season: START_YEAR, heroCountryId: 'TR', countryIds: ['TR', 'EN', 'ES', 'DE', 'IT', 'FR'] })
  const comps = nationalCompetitions(world, START_YEAR)

  it('creates youth leagues and the qualifiers of the season tournament(s)', () => {
    expect(world.competitions[youthCompId(START_YEAR, 'U21')].fixtures).toHaveLength(6 * 8)
    expect(world.competitions[youthCompId(START_YEAR, 'U19')].fixtures).toHaveLength(6 * 8)
    const keys = tournamentKeys(START_YEAR)
    expect(keys).toEqual(['EU', 'OC'])
    expect(tournamentKeys(START_YEAR + 1)).toEqual(['WORLD'])
    for (const k of keys) {
      const q = world.competitions[qualifierCompId(START_YEAR, k)]
      // Double round robin per group: n(n-1) games per group of n.
      const expected = q.meta!.groups!.reduce((s, g) => s + g.length * (g.length - 1), 0)
      expect(q.fixtures).toHaveLength(expected)
      expect(q.participantIds).not.toContain(q.meta!.hostId)
    }
  })

  it('plays internationals only on international dates, never on a club match day', () => {
    const dates = new Set([...INTERNATIONAL_DATES, ...NATIONAL_FINALS_DATES].map((d) => `${d.week}-${d.day}`))
    for (const c of comps) for (const f of c.fixtures) expect(dates.has(`${f.week}-${f.day}`)).toBe(true)
    // No club plays in an international break or in the off-season.
    for (const club of Object.values(world.clubs)) {
      for (const r of clubFixtures(world, club.id, START_YEAR)) {
        expect(INTERNATIONAL_BREAK_WEEKS.includes(r.fixture.week)).toBe(false)
        expect(r.fixture.week).toBeLessThan(42)
      }
    }
  })

  it('a team plays at most once per international date', () => {
    for (const d of INTERNATIONAL_DATES) {
      const seen = new Set<string>()
      for (const c of comps) {
        for (const f of c.fixtures) {
          if (f.week !== d.week || f.day !== d.day) continue
          for (const id of [f.homeId, f.awayId]) {
            expect(seen.has(id)).toBe(false)
            seen.add(id)
          }
        }
      }
    }
  })

  it('selects 23-man squads by nationality (generated squads for nations without leagues)', () => {
    const tr = nationalTeamPlayers(world, 'TR', START_YEAR)
    expect(tr).toHaveLength(NATIONAL_SQUAD_SIZE)
    expect(tr.every((p) => p.nationality === 'TR')).toBe(true)
    expect(tr.filter((p) => p.position === 'GK').length).toBeGreaterThanOrEqual(2)
    const u19 = nationalTeamPlayers(world, 'TR:U19', START_YEAR)
    expect(u19).toHaveLength(NATIONAL_SQUAD_SIZE)
    for (const p of u19) if (!p.id.startsWith('v:')) expect(START_YEAR - p.birthYear).toBeLessThanOrEqual(19)
    const be = nationalTeamPlayers(world, 'BE', START_YEAR)
    expect(be).toHaveLength(NATIONAL_SQUAD_SIZE)
    expect(be.every((p) => p.id.startsWith('v:BE'))).toBe(true)
    // Deterministic generated squads.
    expect(nationalTeamPlayers(world, 'BE', START_YEAR).map((p) => p.ovr)).toEqual(be.map((p) => p.ovr))
  })
})

describe('tournament progression', () => {
  it('always crowns a winner (several seeds, both tournament kinds)', () => {
    for (const seed of [1, 2, 3]) {
      const w = generateWorld(new Rng(seed), { season: START_YEAR, heroCountryId: 'ES', countryIds: ['ES', 'PT', 'NL'] })
      const rng = new Rng(seed * 7)
      for (const season of [START_YEAR, START_YEAR + 1]) {
        for (let week = 0; week < SEASON_WEEKS; week++) {
          for (let day = 0; day < 7; day++) playFixturesFor(w, rng, season, week, day)
          weeklyTick(w)
          if (week === 41) endOfSeason(w, rng, season)
        }
        for (const key of tournamentKeys(season)) {
          const finals = w.competitions[finalsCompId(season, key)]
          expect(finals).toBeDefined()
          expect(finals.fixtures.every((f) => f.result)).toBe(true)
          expect(finals.winnerId).toBeTruthy()
          expect(finals.participantIds).toContain(finals.winnerId)
          // The host is always in its own finals.
          expect(finals.participantIds).toContain(finals.meta!.hostId)
          expect(w.honours.some((h) => h.season === season && h.compKey === `nt:${key}` && h.winnerId === finals.winnerId)).toBe(true)
        }
      }
    }
  }, 120_000)
})

describe('hero call-up and international match flow', () => {
  it('meter is 0–100 with a status label', () => {
    const s = makeGame(5)
    const v = heroCallup(s)!
    expect(v.meter).toBeGreaterThanOrEqual(0)
    expect(v.meter).toBeLessThanOrEqual(100)
    expect(v.status).toBe(statusOf(v.meter))
    for (const k of ['ovr', 'form', 'reputation', 'minutes', 'coach'] as const) expect(Number.isFinite(v.parts[k])).toBe(true)
    // A 17-year-old is in contention for the youth teams; a star for the senior team.
    expect(['U19', 'U21', 'A']).toContain(v.level)
    const strong = star(makeGame(5))
    expect(callupFor(strong, 'A').meter).toBeGreaterThan(callupFor(s, 'A').meter)
    expect(callupFor(strong, 'A').status).toBe('certain')
  })

  it('a called-up hero plays the international through the live flow; caps and goals are written from the match', () => {
    const s = star(makeGame(21))
    // Skip to the announcement week (one week before the first break).
    s.calendar.week = 9
    s.calendar.day = 6
    s.calendar.slot = 2
    autoRun(s, (x) => x.calendar.week >= 10, 50)
    expect(s.world.national!.hero.teamId).toBe('TR')
    expect(s.hero.nationalTeam.called).toBe(true)
    const caps0 = s.hero.nationalTeam.caps
    const goals0 = s.hero.nationalTeam.goals
    // Advance to the international (club games and cards on the way are auto-played).
    autoRun(s, (x) => isHeroMatchday(x) && !!unplayedHeroFixtureToday(x)?.national, 200)
    expect(isHeroMatchday(s)).toBe(true)
    expect(unplayedHeroFixtureToday(s)?.national).toBe(true)
    const club0 = { ...s.hero.seasonStats }
    expect(s.calendar.week).toBe(11)
    const sim = startHeroMatch(s, 'tr')!
    expect(sim).not.toBeNull()
    sim.simulateToEnd(true)
    const rep = finishHeroMatch(s, sim)
    const caps = s.hero.nationalTeam.caps - caps0
    expect(caps).toBe(rep.minutes > 0 ? 1 : 0)
    expect(s.hero.nationalTeam.goals - goals0).toBe(rep.minutes > 0 ? sim.snapshot().heroStats.goals : 0)
    // Club stats untouched by internationals.
    expect(s.hero.seasonStats.apps).toBe(club0.apps)
    const played = nationalCompetitions(s.world, s.calendar.season).flatMap((c) => c.fixtures).find((f) => f.result && (f.homeId === 'TR' || f.awayId === 'TR'))
    expect(played).toBeDefined()
    expect(parseTeamId(played!.homeId)).not.toBeNull()
  })
})

describe('fair selection for strong nations', () => {
  it('eliteLift grows with world standing and a lower share is never worse', () => {
    expect(eliteLift(0.005)).toBeGreaterThan(eliteLift(0.05))
    expect(eliteLift(0.05)).toBeGreaterThan(eliteLift(0.2))
    expect(eliteLift(0.5)).toBe(0)
  })
  it('an elite EN / DE / TR midfielder is called up although the nation pool drifted up by +9 OVR', () => {
    for (const nat of ['EN', 'DE', 'TR']) {
      const s = makeGame(7, { nationality: nat, position: 'CM', birthYear: 2002 })
      for (const k of ATTRIBUTE_KEYS) s.hero.attrs[k] = 82
      s.hero.reputation = 70
      s.hero.form = 75
      Object.assign(s.hero.seasonStats, { apps: 12, minutes: 1000, ratingSum: 12 * 7.3, goals: 4, assists: 5 })
      const before = callupFor(s, 'A').meter
      // World drift (playtest: top-20 OVR 90 -> 95): every compatriot midfielder is 9 better.
      for (const p of Object.values(s.world.players)) if (p.nationality === nat) p.ovr += 9
      s.calendar.week += 1 // new memo key
      const after = callupFor(s, 'A')
      expect(after.cutoff, nat).toBeGreaterThan(callupFor(makeGame(7, { nationality: nat, position: 'CM', birthYear: 2002 }), 'A').cutoff)
      expect(before, nat).toBeGreaterThanOrEqual(CALLUP_THRESHOLD)
      expect(after.status, nat).not.toBe('out') // still a live candidate with the whole pool 9 OVR stronger
      expect(worldEliteShare(s), nat).toBeLessThan(0.2)
    }
  })
})

describe('soak', () => {
  it('5 seasons with internationals, cups and awards: no NaN, save within budget', () => {
    const s = star(makeGame(77))
    const stats = autoRun(s, (x) => x.calendar.season >= START_YEAR + 5, 40_000, true)
    const size = packedSize(s)
    console.log(`national soak: hero matches ${stats.heroMatches}, caps ${s.hero.nationalTeam.caps} (${s.hero.nationalTeam.goals} goals), youth caps ${s.world.national!.hero.youthCaps}, awards ${s.hero.awards.length}, trophies ${s.hero.trophies.length}, save ${(size / 1024).toFixed(0)} KB`)
    expect(s.calendar.season).toBe(START_YEAR + 5)
    expect(findNonFinite(s)).toEqual([])
    expect(size).toBeLessThan(SAVE_BUDGET)
    expect(s.hero.nationalTeam.caps).toBeGreaterThan(5)
    // Every season produced a national champion and a Golden Star.
    for (let y = START_YEAR; y < START_YEAR + 5; y++) expect(s.world.honours.some((h) => h.season === y && /^nt:(EU|OC|WORLD)$/.test(h.compKey))).toBe(true)
    expect(s.world.awards!.goldenStar.length).toBe(5)
  }, 300_000)
})
