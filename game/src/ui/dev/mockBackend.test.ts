import { describe, expect, it } from 'vitest'
import { blackjack, gameState, match, negotiation } from '../store'
import { mockActions as A } from './mockActions'
import { mockData as D } from './mockData'
import { createMockState, DEFAULT_INPUT } from './mockState'

describe('mock backend', () => {
  it('builds a deterministic, rich world', () => {
    const a = createMockState(7)
    const b = createMockState(7)
    expect(JSON.stringify(a.world.clubs)).toBe(JSON.stringify(b.world.clubs))
    expect(Object.keys(a.world.leagues)).toEqual(['tr1', 'tr2', 'en1', 'es1', 'de1'])
    expect(Object.keys(a.world.clubs).length).toBe(94)
    const tr1 = a.world.competitions['tr1-2026']
    expect(tr1.table?.[0].p).toBe(12)
    expect(a.life.log.length).toBe(40)
    expect(a.life.news.length).toBe(25)
    expect(a.pendingEvents.length).toBe(2)
  })

  it('serves view models and runs the day loop', () => {
    gameState.value = createMockState()
    expect(D.heroOvr()).toBeGreaterThan(40)
    expect(D.nextFixture()?.daysUntil).toBe(2)
    expect(D.activities().length).toBeGreaterThanOrEqual(24)
    expect(D.eventView(0)?.choices.length).toBeGreaterThan(1)
    expect(D.preMatch()?.homeLineup.length).toBe(11)
    expect(D.topScorers('tr1').some((r) => r.isHero)).toBe(true)
    const out = A.resolveEvent(0, 1)
    expect(out.text.tr.length).toBeGreaterThan(0)
    A.planSlot(0, 'gym')
    A.advanceToMatch()
    expect(D.nextFixture()?.daysUntil).toBe(0)
    expect(D.dayPlan().slots[2].state).toBe('match')
  })

  it('plays a match end-to-end', () => {
    gameState.value = createMockState()
    A.advanceToMatch()
    A.playMatch()
    expect(match.value?.paused).toBe(true)
    A.matchSimToEnd()
    expect(match.value?.finished).toBe(true)
    const post = D.postMatch()
    expect(post?.interview?.options.length).toBe(4)
    A.answerInterview('humble')
    const apps = gameState.value?.hero.seasonStats.apps ?? 0
    A.finishMatch()
    expect(match.value).toBeNull()
    expect(gameState.value?.hero.seasonStats.apps).toBe(apps + 1)
  })

  it('casino, negotiation and new game work', () => {
    gameState.value = createMockState()
    const bj = A.casino.blackjackDeal(100)
    expect(bj.player.length).toBe(2)
    expect(blackjack.value).not.toBeNull()
    if (bj.phase === 'player') A.casino.blackjackStand()
    expect(blackjack.value?.phase).toBe('done')
    const race = A.casino.horseRace(100, 0)
    expect(race.timeline.length).toBe(60)
    expect(Math.max(...race.timeline[59])).toBe(1)
    A.openNegotiation(gameState.value?.hero.contract?.clubId ?? '')
    const n = negotiation.value
    expect(n?.kind).toBe('renewal')
    A.proposeTerms({ ...(n?.clubOffer ?? DEFAULT_INPUT as never), wage: (n?.clubOffer.wage ?? 0) * 3 })
    expect(negotiation.value?.patience).toBeLessThan(100)
    A.newGame({ ...DEFAULT_INPUT, firstName: 'Ali' })
    expect(gameState.value?.hero.firstName).toBe('Ali')
    expect(gameState.value?.calendar.week).toBe(0)
  })
})
