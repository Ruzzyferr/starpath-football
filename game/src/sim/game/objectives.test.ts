import { describe, expect, it } from 'vitest'
import { makeGame, autoRun } from './testHelpers'
import { OBJECTIVES_FLAG, matchExpectations, objectivesAfterMatch, objectivesDaily, objectivesView, objectivesWeekly, type Objective } from './objectives'
import { LAST_MATCH_FLAG, type MatchFeats } from './records'
import { readJson, writeJson } from './internal'
import { absWeek } from '../career/common'
import type { GameState } from '../../core/types'

const feats = (over: Partial<MatchFeats>): MatchFeats => ({
  fixtureId: 'fx1', season: 2026, week: 5, compType: 'league', final: false, opponent: 'Atlas', opponentReputation: 50, minutes: 90, started: true,
  goals: 0, assists: 0, freeKickGoals: 0, penaltyGoals: 0, headerGoals: 0, rating: 7, motm: false, won: false, drew: false, goalsFor: 1, goalsAgainst: 1,
  cleanSheet: false, saves: 0, isKeeper: false, red: false, injured: false, ...over,
})

function seed(s: GameState, o: Partial<Objective>): void {
  const now = absWeek(s.calendar)
  const base: Objective = {
    id: 'o1', source: 'manager', kind: 'goals', title: { tr: 'Gol at', en: 'Score' }, desc: { tr: '', en: '' }, target: 2, progress: 0,
    startWeek: now, deadlineWeek: now + 3, season: s.calendar.season, reward: { trust: 4, rel: { manager: 5 } }, penalty: { trust: -2 }, status: 'active',
  }
  writeJson(s.life, OBJECTIVES_FLAG, { active: [{ ...base, ...o }], history: [], done: 0, failed: 0, lastBy: {}, serial: 1, seen: 'none' })
}

describe('personal objectives', () => {
  it('counts each hero match once and pays the reward on completion', () => {
    const s = makeGame(41)
    seed(s, {})
    const trust0 = s.hero.managerTrust
    writeJson(s.life, LAST_MATCH_FLAG, feats({ fixtureId: 'a', goals: 1 }))
    objectivesDaily(s, [])
    objectivesDaily(s, []) // same match again: not double counted
    expect(objectivesView(s).active[0]!.progress).toBe(1)
    writeJson(s.life, LAST_MATCH_FLAG, feats({ fixtureId: 'b', goals: 1 }))
    const out: { tr: string; en: string }[] = []
    objectivesDaily(s, out)
    const v = objectivesView(s)
    expect(v.active).toHaveLength(0)
    expect(v.done).toBe(1)
    expect(v.recent[0]!.status).toBe('done')
    expect(s.hero.managerTrust).toBeGreaterThan(trust0)
    expect(out.some((l) => l.tr.includes('Hedef tamamlandı'))).toBe(true)
  })

  it('a missed deadline fails the objective and applies only its small penalty', () => {
    const s = makeGame(42)
    seed(s, { deadlineWeek: absWeek(s.calendar) })
    const trust0 = s.hero.managerTrust
    objectivesWeekly(s, [])
    const st = readJson<{ failed: number; history: Objective[] }>(s.life, OBJECTIVES_FLAG, { failed: 0, history: [] })
    expect(st.failed).toBe(1)
    expect(st.history[0]!.status).toBe('failed')
    expect(s.hero.managerTrust).toBeLessThanOrEqual(trust0)
    expect(s.hero.managerTrust).toBeGreaterThanOrEqual(trust0 - 2)
  })

  it('rating objectives judge the average over the counted matches', () => {
    const s = makeGame(43)
    seed(s, { kind: 'rating', target: 2, base: 70, sum: 0 })
    writeJson(s.life, LAST_MATCH_FLAG, feats({ fixtureId: 'a', rating: 8 }))
    objectivesDaily(s, [])
    writeJson(s.life, LAST_MATCH_FLAG, feats({ fixtureId: 'b', rating: 6.5 }))
    objectivesDaily(s, [])
    expect(objectivesView(s).done).toBe(1) // (8 + 6.5) / 2 = 7.25 ≥ 7.0
  })

  it('a real season hands out season and short objectives with readable text', () => {
    const s = makeGame(44)
    autoRun(s, (x) => x.calendar.week >= 12, 4000, true)
    const st = readJson<{ active: Objective[]; history: Objective[] }>(s.life, OBJECTIVES_FLAG, { active: [], history: [] })
    const all = [...st.active, ...st.history]
    expect(all.some((o) => o.kind === 'seasonGoals' || o.kind === 'seasonApps' || o.kind === 'seasonCleanSheets')).toBe(true)
    expect(all.filter((o) => o.source !== 'board' && o.source !== 'self').length).toBeGreaterThanOrEqual(2)
    for (const o of all) {
      expect(o.title.tr).not.toMatch(/\{\w+\}/)
      expect(o.title.en).not.toMatch(/\{\w+\}/)
    }
    expect(s.life.log.some((l) => l.text.tr.includes('Yeni hedef'))).toBe(true)
  })
})

describe('career-start objectives', () => {
  it('issues board, personal and one short objective before week one', () => {
    const s = makeGame(11)
    const v = objectivesView(s)
    expect(v.active.filter((o) => o.source === 'board')).toHaveLength(1)
    expect(v.active.some((o) => o.seasonal && o.source !== 'board')).toBe(true)
    expect(v.active.filter((o) => !o.seasonal)).toHaveLength(1)
    expect(v.active.find((o) => o.source === 'manager')?.rewardParts.some((p) => p.key === 'relation' && p.rel === 'manager')).toBe(true)
  })
})

describe('manager expectations (2.4#47)', () => {
  it('press and team-play expectations count tackles / completed passes and are marked after the match', () => {
    const s = makeGame(43)
    seed(s, { kind: 'press', target: 5, title: { tr: 'Pres yap', en: 'Press hard' } })
    const trust0 = s.hero.managerTrust
    writeJson(s.life, LAST_MATCH_FLAG, feats({ fixtureId: 'p1', tackles: 3, passesCompleted: 40 }))
    objectivesAfterMatch(s, [])
    let marks = matchExpectations(s)
    expect(marks).toHaveLength(1)
    expect(marks[0]).toMatchObject({ status: 'open', progress: 3, target: 5 })
    writeJson(s.life, LAST_MATCH_FLAG, feats({ fixtureId: 'p2', tackles: 4, passesCompleted: 10 }))
    objectivesAfterMatch(s, [])
    marks = matchExpectations(s)
    expect(marks[0]).toMatchObject({ status: 'done' })
    expect(s.hero.managerTrust).toBeGreaterThan(trust0) // +4 paid at once, visible in the same post-match report

    seed(s, { id: 'o2', kind: 'teamPlay', target: 50, title: { tr: 'Takım oyunu', en: 'Play for the team' } })
    writeJson(s.life, LAST_MATCH_FLAG, feats({ fixtureId: 'p3', passesCompleted: 55 }))
    objectivesAfterMatch(s, [])
    expect(matchExpectations(s)[0]).toMatchObject({ status: 'done' })
  })
})
