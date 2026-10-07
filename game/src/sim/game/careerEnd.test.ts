import { describe, expect, it } from 'vitest'
import { autoRun, makeGame } from './testHelpers'
import { isHeroMatchday } from './calendar'
import { autoPlayHeroMatch } from './match'
import { autoTrialPerformance, hasPendingTrials, pendingTrials, resolveTrial, trialTerms } from './trials'
import { continueCareer, retireHero, retirementStatus, careerSummaryOf, FORCED_RETIRE_AGE } from './retirement'
import { legacyScore, legacyTier } from './hallOfFame'
import { legacyStartFrom } from './legacy'
import { clubRecordsFor, lastMatchFeats, personalRecords, heroGoalKinds } from './records'
import {
  ACHIEVEMENTS, achievementProgress, emptyAchStore, processAchievementEvent,
} from './achievements'
import { MemoryKV, MetaStore } from '../../state/metaStore'
import { END_OF_SEASON_WEEK } from '../world/fixtures'

describe('starting-club trials', () => {
  it('a trials career starts unattached with 3 invitations', () => {
    const s = makeGame(77, { trials: true })
    expect(s.hero.contract).toBeNull()
    const inv = pendingTrials(s)
    expect(inv.map((i) => i.kind)).toEqual(['open', 'trial', 'academy'])
    expect(new Set(inv.map((i) => i.clubId)).size).toBe(3)
    expect(hasPendingTrials(s)).toBe(true)
  })

  it('a good trial signs a better deal than the academy, a failed open tryout keeps the others', () => {
    const s = makeGame(77, { trials: true })
    const [open, trial] = pendingTrials(s)
    const r1 = resolveTrial(s, open.id, 0.2)
    expect(r1.signed).toBe(false)
    expect(pendingTrials(s)).toHaveLength(2)
    const r2 = resolveTrial(s, trial.id, 0.9)
    expect(r2.signed).toBe(true)
    expect(s.hero.contract?.clubId).toBe(trial.clubId)
    expect(s.hero.contract?.role).toBe('rotation')
    expect(hasPendingTrials(s)).toBe(false)
  })

  it('the academy always signs; terms scale with performance', () => {
    expect(trialTerms('academy', 0)).toEqual({ role: 'youth', wageMul: 0.7 })
    expect(trialTerms('trial', 0.1)).toBeNull()
    expect(trialTerms('open', 0.7)).not.toBeNull()
    const s = makeGame(5, { trials: true })
    const acad = pendingTrials(s).find((i) => i.kind === 'academy')
    expect(acad).toBeDefined()
    expect(resolveTrial(s, acad?.id ?? '', 0).signed).toBe(true)
    const p = autoTrialPerformance(s, 'x')
    expect(p).toBeGreaterThanOrEqual(0.3)
    expect(p).toBeLessThanOrEqual(0.85)
  })

  it('default careers are unchanged (still auto-signed)', () => {
    const s = makeGame(77)
    expect(s.hero.contract).not.toBeNull()
  })
})

describe('retirement', () => {
  it('decision card from 33 at the end of the season, forced at 40', () => {
    const s = makeGame(11)
    s.hero.birthYear = s.calendar.season - 34
    expect(retirementStatus(s).decisionDue).toBe(false)
    s.calendar.week = END_OF_SEASON_WEEK
    expect(retirementStatus(s).decisionDue).toBe(true)
    continueCareer(s)
    expect(retirementStatus(s).decisionDue).toBe(false)
    s.hero.birthYear = s.calendar.season - FORCED_RETIRE_AGE
    expect(retirementStatus(s).forced).toBe('age')
  })

  it('a career-ending injury forces retirement', () => {
    const s = makeGame(11)
    s.hero.birthYear = s.calendar.season - 32
    s.hero.injury = { name: { tr: 'x', en: 'x' }, severity: 3, weeksLeft: 30 }
    expect(retirementStatus(s).forced).toBe('injury')
  })

  it('too young → refused; 33+ → retired with a documentary and testimonial', () => {
    const s = makeGame(21)
    autoRun(s, (x) => x.hero.careerStats.apps >= 3, 400)
    expect(retireHero(s).ok).toBe(false)
    s.hero.birthYear = s.calendar.season - 35
    const r = retireHero(s, { testimonial: true, retiredAt: 123 })
    expect(r.ok).toBe(true)
    expect(s.hero.retired).toBe(true)
    expect(s.hero.contract).toBeNull()
    const sum = r.summary
    expect(sum?.testimonial?.opponent).toBe('Legends XI')
    expect(sum?.totals.apps).toBe(s.hero.careerStats.apps)
    expect(sum?.timeline.length).toBeGreaterThan(0)
    expect(sum?.legacyScore).toBeGreaterThan(0)
    expect(careerSummaryOf(s)?.careerId).toBe(s.meta.id)
  })

  it('legacy score is transparent', () => {
    const base = { totals: { apps: 100, goals: 50, assists: 20, motm: 0, cleanSheets: 0, avgRating: 7 }, trophies: [], awards: [], caps: 0, intGoals: 0, reputation: 50, netWorth: 0 }
    const { total, breakdown } = legacyScore(base)
    expect(total).toBe(Math.round(breakdown.reduce((a, b) => a + b.value, 0)))
    expect(total).toBe(100 + 20 + 30 + 100)
    expect(legacyTier(2600).en).toBe('Immortal Legend')
  })
})

describe('legacy new game+', () => {
  it('child starts with inheritance, reputation and the famous-name perk', () => {
    const parent = { careerId: 'p1', name: 'Arda Yıldız', gender: 'male' as const, legacyScore: 1800, netWorth: 20_000_000 }
    const l = legacyStartFrom(parent)
    expect(l.inheritance).toBe(1_000_000)
    expect(l.reputationBonus).toBe(15)
    const plain = makeGame(9)
    const child = makeGame(9, { legacy: l, lastName: 'Yıldız' })
    expect(child.life.money).toBeGreaterThanOrEqual(plain.life.money + 1_000_000 - 1)
    expect(child.hero.reputation).toBeGreaterThan(plain.hero.reputation)
    expect(child.hero.perks).toContain('famous_name')
    expect(child.life.flags['c:legacyParentId']).toBe('p1')
  })
})

describe('records & match feats', () => {
  it('every hero match writes feats and personal records', () => {
    const s = makeGame(31)
    autoRun(s, (x) => x.hero.careerStats.apps >= 6, 600)
    const f = lastMatchFeats(s)
    expect(f).not.toBeNull()
    const pr = personalRecords(s)
    expect(pr.highestWage?.value).toBe(s.hero.contract?.wage)
    const cr = clubRecordsFor(s, s.hero.contract?.clubId ?? '')
    expect(cr.goalsSeason?.value).toBeGreaterThan(0)
  })

  it('classifies free-kick and header goals from the event stream', () => {
    const ev = [
      { type: 'freekick', side: 'home' as const }, { type: 'highlight', side: 'home' as const, playerId: 'hero' }, { type: 'goal', side: 'home' as const, playerId: 'hero' },
      { type: 'corner', side: 'home' as const }, { type: 'commentary', side: 'home' as const }, { type: 'highlight', side: 'home' as const, playerId: 'hero' }, { type: 'goal', side: 'home' as const, playerId: 'hero' },
      { type: 'highlight', side: 'home' as const, playerId: 'hero' }, { type: 'goal', side: 'home' as const, playerId: 'hero' },
    ]
    expect(heroGoalKinds(ev, 'home', 'hero')).toEqual({ freeKick: 1, header: 1 })
  })
})

describe('achievements', () => {
  it('has at least 60 unique achievements in every category', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(60)
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length)
    for (const a of ACHIEVEMENTS) {
      expect(a.name.tr && a.name.en && a.desc.tr && a.desc.en).toBeTruthy()
      expect(a.id).toMatch(/^[a-z0-9_]+$/)
    }
    expect(new Set(ACHIEVEMENTS.map((a) => a.category)).size).toBe(7)
  })

  it('match events unlock feats (hat-trick, free kick, GK clean sheet) once', () => {
    const store = emptyAchStore()
    const s = makeGame(3)
    const feats = {
      fixtureId: 'f', season: 2026, week: 3, compType: 'league', final: true, opponent: 'X', opponentReputation: 85, minutes: 90, started: true,
      goals: 3, assists: 0, freeKickGoals: 1, penaltyGoals: 0, headerGoals: 1, rating: 9.6, motm: true, won: true, drew: false, goalsFor: 3, goalsAgainst: 0,
      cleanSheet: true, saves: 0, isKeeper: false, red: false, injured: false,
    }
    const got = processAchievementEvent(store, { type: 'match', feats }, s, 1).map((a) => a.id)
    for (const id of ['hat_trick', 'free_kick_goal', 'header_goal', 'perfect_game', 'final_goal', 'giant_killer', 'first_contract']) expect(got).toContain(id)
    expect(got).not.toContain('gk_clean_sheet')
    const again = processAchievementEvent(store, { type: 'match', feats }, s, 2).map((a) => a.id)
    expect(again).not.toContain('hat_trick')
    const gk = processAchievementEvent(store, { type: 'match', feats: { ...feats, goals: 0, isKeeper: true, saves: 9 } }, s, 3).map((a) => a.id)
    expect(gk).toEqual(expect.arrayContaining(['gk_clean_sheet', 'gk_wall']))
  })

  it('tracks monotonic progress and responsible-gambling events', () => {
    const store = emptyAchStore()
    const s = makeGame(3)
    processAchievementEvent(store, { type: 'tick' }, s)
    const rows = achievementProgress(store)
    expect(rows.find((r) => r.def.id === 'goals_100')?.progress).toBe(0)
    s.hero.careerStats.goals = 40
    processAchievementEvent(store, { type: 'tick' }, s)
    s.hero.careerStats.goals = 10 // a new career must not lower the best progress
    processAchievementEvent(store, { type: 'tick' }, s)
    expect(achievementProgress(store).find((r) => r.def.id === 'goals_100')?.progress).toBe(40)
    const w = processAchievementEvent(store, { type: 'casinoLeave', net: 500 }, s).map((a) => a.id)
    expect(w).toContain('walk_away')
  })

  it('drill and legacy events', () => {
    const store = emptyAchStore()
    for (const kind of ['finishing', 'passing', 'dribbling', 'fitness', 'goalkeeping']) processAchievementEvent(store, { type: 'drill', kind, grade: 'S', performance: 1 }, null)
    expect(store.unlocked.drill_all_s).toBeDefined()
    processAchievementEvent(store, { type: 'newCareer', legacy: true }, null)
    expect(store.unlocked.legacy_start).toBeDefined()
  })
})

describe('meta store (global, outside save slots)', () => {
  it('persists achievements and the Hall of Fame across instances', () => {
    const kv = new MemoryKV()
    const a = new MetaStore(kv)
    a.update((d) => {
      d.achievements.unlocked.debut = 5
    })
    const s = makeGame(21)
    s.hero.birthYear = s.calendar.season - 35
    const r = retireHero(s)
    if (r.summary) a.addHallOfFame(r.summary)
    const b = new MetaStore(kv)
    expect(b.read().achievements.unlocked.debut).toBe(5)
    expect(b.read().hallOfFame).toHaveLength(1)
    a.addHallOfFame({ ...(r.summary as NonNullable<typeof r.summary>) })
    expect(new MetaStore(kv).read().hallOfFame).toHaveLength(1)
  })

  it('a corrupt blob falls back to empty data', () => {
    const kv = new MemoryKV()
    kv.setItem('starpath.meta.v1', '{nope')
    expect(new MetaStore(kv).read().hallOfFame).toEqual([])
  })
})

describe('integration', () => {
  it('a hero match on a trials career works after signing', () => {
    const s = makeGame(44, { trials: true })
    const acad = pendingTrials(s).find((i) => i.kind === 'academy')
    resolveTrial(s, acad?.id ?? '', 0.5)
    autoRun(s, (x) => isHeroMatchday(x) || x.hero.careerStats.apps > 0, 300)
    if (isHeroMatchday(s)) autoPlayHeroMatch(s)
    expect(s.hero.contract).not.toBeNull()
  })
})
