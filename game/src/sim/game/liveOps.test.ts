import { describe, expect, it } from 'vitest'
import { EVENT_SLOTS, eventForWeek, milestoneTimeline, newsOfTheDay, nextEvent, seasonCalendar } from './liveOps'
import { applyMatch, challengeFor, emptyLocalMeta, localBoard } from './localMeta'
import type { MatchFeats } from './records'
import type { CareerSummary } from './hallOfFame'

const feats = (o: Partial<MatchFeats> = {}): MatchFeats => ({
  fixtureId: 'f1', season: 2026, week: 3, compType: 'league', final: false, opponent: 'Rival', opponentReputation: 50,
  minutes: 90, started: true, goals: 3, assists: 2, freeKickGoals: 0, penaltyGoals: 0, headerGoals: 0, rating: 9, motm: true,
  won: true, drew: false, goalsFor: 3, goalsAgainst: 0, cleanSheet: true, saves: 5, isKeeper: false, red: false, injured: false, ...o,
})

describe('season event calendar', () => {
  it('is deterministic, fills every slot with distinct events and rotates between seasons', () => {
    const a = seasonCalendar(2026)
    expect(a).toEqual(seasonCalendar(2026))
    expect(a).toHaveLength(EVENT_SLOTS.length)
    expect(new Set(a.map((e) => e.id)).size).toBe(a.length)
    const orders = new Set(Array.from({ length: 8 }, (_, i) => seasonCalendar(2026 + i).map((e) => e.id).join()))
    expect(orders.size).toBeGreaterThan(3)
  })
  it('finds the running and the next event', () => {
    const cal = seasonCalendar(2030)
    expect(eventForWeek(2030, cal[1].start)?.id).toBe(cal[1].id)
    expect(eventForWeek(2030, cal[0].end + 1)).toBeNull()
    expect(nextEvent(2030, cal[0].end)?.id).toBe(cal[1].id)
    expect(nextEvent(2030, 43)).toBeNull()
  })
})

describe('news of the day', () => {
  it('is stable for a week, differs across weeks and reflects challenge and streak state', () => {
    const id = challengeFor(2026, 3, false).id
    const open = newsOfTheDay(2026, 3, { streak: 0, challengeDone: false, challengeId: id })
    expect(open).toEqual(newsOfTheDay(2026, 3, { streak: 0, challengeDone: false, challengeId: id }))
    expect(open.some((n) => n.id === 'ch:open')).toBe(true)
    const done = newsOfTheDay(2026, 3, { streak: 4, challengeDone: true, challengeId: id })
    expect(done.some((n) => n.id === 'ch:done')).toBe(true)
    expect(done.some((n) => n.id === 'streak')).toBe(true)
    const tips = new Set(Array.from({ length: 20 }, (_, w) => newsOfTheDay(2026, w, { streak: 0, challengeDone: false, challengeId: id }).at(-1)?.title.en))
    expect(tips.size).toBeGreaterThan(5)
  })
})

describe('stamps, attempts and tiers', () => {
  it('stamps a cleared challenge inside an event and keeps first and best attempts', () => {
    const m = emptyLocalMeta()
    const ev = seasonCalendar(2026)[0]
    const wk = ev.start + 1
    const base = feats({ week: wk, goals: 0, assists: 0, motm: false, rating: 5.5, won: false, goalsFor: 0, goalsAgainst: 1, cleanSheet: false, saves: 0, opponentReputation: 10, minutes: 30 })
    applyMatch(m, { ...base, fixtureId: 'a' })
    applyMatch(m, { ...base, fixtureId: 'b', rating: 6.8 })
    const key = `2026:${wk}`
    expect(m.attempts[key].count).toBe(2)
    expect(m.attempts[key].first.rating).toBe(5.5)
    expect(m.attempts[key].best.rating).toBe(6.8)
    expect(m.stamps[`2026:${ev.id}`]).toBeUndefined()
    applyMatch(m, feats({ week: wk, fixtureId: 'c' }))
    expect(m.attempts[key].count).toBe(3)
    expect(m.attempts[key].best.passed).toBe(true)
    expect(m.attempts[key].first.passed).toBe(false)
    expect(m.stamps[`2026:${ev.id}`]).toBe(1)
  })
  it('splits the career board into official and modded tables', () => {
    const mk = (id: string, score: number) => ({ careerId: id, legacyScore: score, totals: { goals: 0, assists: 0, apps: 0, avgRating: 0 }, trophies: [] }) as unknown as CareerSummary
    const all = [mk('a', 10), mk('b', 30), mk('c', 20)]
    expect(localBoard(all, 'legacy', 'official', ['b']).map((e) => e.careerId)).toEqual(['c', 'a'])
    expect(localBoard(all, 'legacy', 'modded', ['b']).map((e) => e.careerId)).toEqual(['b'])
    expect(localBoard(all, 'legacy').length).toBe(3)
  })
})

describe('milestone timeline', () => {
  it('merges challenges, careers, stamps and streak badges newest first', () => {
    const m = emptyLocalMeta()
    const ev = seasonCalendar(2026)[0]
    applyMatch(m, feats({ week: ev.start }))
    m.bestStreak = 5
    const career = { careerId: 'x', name: 'Test Hero', endSeason: 2030, totals: { apps: 10, goals: 4 }, trophies: [] } as unknown as CareerSummary
    const t = milestoneTimeline(m, [career])
    expect(t.map((x) => x.kind)).toEqual(expect.arrayContaining(['challenge', 'career', 'stamps', 'streak']))
    expect(t[0].kind).toBe('career')
    for (let i = 1; i < t.length; i++) expect(t[i - 1].season).toBeGreaterThanOrEqual(t[i].season)
    expect(t.filter((x) => x.kind === 'streak')).toHaveLength(2)
  })
})
