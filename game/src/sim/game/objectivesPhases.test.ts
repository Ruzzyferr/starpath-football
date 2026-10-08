import { describe, expect, it } from 'vitest'
import { makeGame } from './testHelpers'
import { OBJECTIVES_FLAG, careerPhase, objectivesDaily, objectivesView, phaseCandidates, type Objective } from './objectives'
import { LAST_MATCH_FLAG, type MatchFeats } from './records'
import { readJson, writeJson } from './internal'
import { absWeek } from '../career/common'
import type { GameState, Position, SquadRole } from '../../core/types'

const feats = (over: Partial<MatchFeats>): MatchFeats => ({
  fixtureId: 'fx1', season: 2026, week: 5, compType: 'league', final: false, opponent: 'Atlas', opponentReputation: 50, minutes: 90, started: true,
  goals: 0, assists: 0, freeKickGoals: 0, penaltyGoals: 0, headerGoals: 0, rating: 7, motm: false, won: false, drew: false, goalsFor: 1, goalsAgainst: 1,
  cleanSheet: false, saves: 0, isKeeper: false, red: false, injured: false, ...over,
})

function setup(seed: number, o: { age: number; rep: number; pos: Position; role: SquadRole }): GameState {
  const s = makeGame(seed)
  s.hero.birthYear = s.calendar.season - o.age
  s.hero.reputation = o.rep
  s.hero.position = o.pos
  if (s.hero.contract) s.hero.contract.role = o.role
  return s
}

const store = () => ({ active: [] as Objective[], history: [], done: 0, failed: 0, lastBy: {}, serial: 0 })
const kinds = (s: GameState): string[] => {
  const st = store()
  return phaseCandidates(s, st as never, true, true, true).map((c) => c.make().kind)
}

describe('career-phase objectives', () => {
  it('classifies the career stage from age, reputation and role', () => {
    expect(careerPhase(setup(1, { age: 17, rep: 5, pos: 'CM', role: 'youth' }))).toBe('youth')
    expect(careerPhase(setup(2, { age: 22, rep: 40, pos: 'CM', role: 'starter' }))).toBe('rising')
    expect(careerPhase(setup(3, { age: 27, rep: 85, pos: 'ST', role: 'star' }))).toBe('peak')
    expect(careerPhase(setup(4, { age: 33, rep: 80, pos: 'CM', role: 'starter' }))).toBe('veteran')
  })

  it('each phase draws from its own pool', () => {
    const youth = kinds(setup(5, { age: 17, rep: 5, pos: 'CM', role: 'youth' }))
    const rising = kinds(setup(6, { age: 22, rep: 40, pos: 'CM', role: 'starter' }))
    const peak = kinds(setup(7, { age: 27, rep: 85, pos: 'ST', role: 'star' }))
    const vet = kinds(setup(8, { age: 34, rep: 80, pos: 'CM', role: 'captain' }))
    expect(youth).toContain('teamPlay')
    expect(rising).toEqual(expect.arrayContaining(['motm', 'bigGame']))
    expect(peak).toEqual(expect.arrayContaining(['rating', 'contGoals']))
    expect(vet).toContain('captainApps')
    expect(vet).not.toContain('contGoals')
    expect(youth).not.toContain('captainApps')
  })

  it('defenders and keepers get their own goals', () => {
    const cb = kinds(setup(9, { age: 26, rep: 60, pos: 'CB', role: 'starter' }))
    const gk = kinds(setup(10, { age: 26, rep: 60, pos: 'GK', role: 'starter' }))
    const st = kinds(setup(11, { age: 26, rep: 60, pos: 'ST', role: 'starter' }))
    expect(cb).toEqual(expect.arrayContaining(['streak', 'headGoals', 'press']))
    expect(gk).toEqual(expect.arrayContaining(['streak', 'saves']))
    expect(gk).not.toContain('headGoals')
    expect(st).not.toContain('streak')
  })

  it('a veteran with a young teammate is offered a mentor goal', () => {
    const s = setup(12, { age: 34, rep: 80, pos: 'CM', role: 'starter' })
    const tm = Object.values(s.life.relationships).find((r) => r.kind === 'teammate' && r.npcId)
    if (!tm) return // world without teammate relations: nothing to assert
    s.world.players[tm.npcId!]!.birthYear = s.calendar.season - 18
    expect(kinds(s)).toContain('mentor')
  })

  it('clean-sheet streaks reset on a conceded game; set-piece and big-game counters work', () => {
    const s = makeGame(13)
    const now = absWeek(s.calendar)
    const mk = (kind: Objective['kind'], target: number): Objective => ({
      id: kind, source: 'self', kind, title: { tr: 'x', en: 'x' }, desc: { tr: '', en: '' }, target, progress: 0, startWeek: now, deadlineWeek: now + 9,
      season: s.calendar.season, reward: { morale: 1 }, status: 'active',
    })
    writeJson(s.life, OBJECTIVES_FLAG, { active: [mk('streak', 3), mk('headGoals', 1), mk('bigGame', 1)], history: [], done: 0, failed: 0, lastBy: {}, serial: 3, seen: 'none' })
    writeJson(s.life, LAST_MATCH_FLAG, feats({ fixtureId: 'a', cleanSheet: true, goalsAgainst: 0 }))
    objectivesDaily(s, [])
    writeJson(s.life, LAST_MATCH_FLAG, feats({ fixtureId: 'b', cleanSheet: false, goalsAgainst: 2 }))
    objectivesDaily(s, [])
    let v = objectivesView(s)
    expect(v.active.find((o) => o.id === 'streak')!.progress).toBe(0)
    writeJson(s.life, LAST_MATCH_FLAG, feats({ fixtureId: 'c', headerGoals: 1, goals: 1, opponentReputation: 80 }))
    objectivesDaily(s, [])
    v = objectivesView(s)
    expect(v.done).toBe(2)
    expect(readJson<{ history: Objective[] }>(s.life, OBJECTIVES_FLAG, { history: [] }).history.map((o) => o.kind).sort()).toEqual(['bigGame', 'headGoals'])
  })
})
