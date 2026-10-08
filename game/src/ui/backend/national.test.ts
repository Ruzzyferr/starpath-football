/**
 * The hero's international through the REAL backend actions (advance →
 * playMatch → simMoment → finishMatch), plus the national/cup/award views.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { ATTRIBUTE_KEYS } from '../../core/types'
import { MemoryStorage } from '../../state/save'
import { gameState, installBackend, match } from '../store'
import { DEFAULT_CAREER } from './index'
import { MS_PER_MINUTE } from './liveMatch'
import { useStorage } from './persistence'
import { realActions as A } from './realActions'
import { realData as D } from './realData'
import { awardsView, callupCard, cupsView, drawView, nationalView } from './worldViews'

const S = () => {
  const s = gameState.value
  if (!s) throw new Error('no state')
  return s
}

function clearEvents(): void {
  for (let n = 0; S().pendingEvents.length > 0 && n < 20; n++) {
    const v = D.eventView(0)!
    A.resolveEvent(0, Math.max(0, v.choices.findIndex((c) => !c.requirement || c.requirement.met)))
  }
}

describe('international through the real backend', () => {
  beforeAll(() => {
    vi.useFakeTimers()
    useStorage(new MemoryStorage())
    installBackend({ actions: A, data: D })
  })
  afterAll(() => vi.useRealTimers())

  it('call-up → play the international (moments simmed) → caps increase', () => {
    A.newGame({ ...DEFAULT_CAREER, seed: 4242 })
    const s = S()
    for (const k of ATTRIBUTE_KEYS) s.hero.attrs[k] = 90
    s.hero.reputation = 70
    s.hero.form = 75
    const card = callupCard()!
    expect(card.callup.meter).toBeGreaterThanOrEqual(0)
    expect(card.callup.meter).toBeLessThanOrEqual(100)
    expect(card.announceIn).toBe(10)
    // Jump to the eve of the first squad announcement (week 10).
    s.calendar.week = 9
    s.calendar.day = 6
    s.calendar.slot = 2
    clearEvents()
    A.advance()
    expect(S().calendar.week).toBe(10)
    expect(S().world.national!.hero.teamId).toBe(S().hero.nationality)
    expect(nationalView()!.squad.some((p) => p.isHero)).toBe(true)
    const caps0 = S().hero.nationalTeam.caps

    // Slot by slot, keeping the hero fit: this test is about the international flow, and a random knock in
    // the days before the window (the RNG path moves with every sim change) would skip the call-up game.
    for (let i = 0; i < 240; i++) {
      clearEvents()
      S().hero.injury = null
      const fx = D.nextFixture()
      if (fx?.daysUntil === 0 && S().calendar.slot >= 1 && fx.compType === 'international') break
      if (fx?.daysUntil === 0 && S().calendar.slot >= 1) {
        // A club game on the way: let the sim play it.
        A.advance()
        continue
      }
      A.advance()
    }
    clearEvents()
    const fx = D.nextFixture()!
    expect(fx.compType).toBe('international')
    expect(fx.daysUntil).toBe(0)
    expect(fx.home.name).not.toMatch(/undefined/)

    A.playMatch()
    expect(match.value).not.toBeNull()
    expect(D.preMatch()!.fixture.compType).toBe('international')
    A.matchSetSpeed(4)
    A.matchPause(false)
    for (let guard = 0; guard < 400 && !match.value!.finished; guard++) {
      if (match.value!.pendingMoment) A.simMoment()
      else if (match.value!.decision) A.matchDecide(match.value!.decision.fallback)
      else vi.advanceTimersByTime(MS_PER_MINUTE[4])
    }
    expect(match.value!.finished).toBe(true)
    const post = D.postMatch()!
    A.finishMatch()
    expect(S().hero.nationalTeam.caps).toBe(caps0 + (post.stats.minutes > 0 ? 1 : 0))
    expect(nationalView()!.log.length).toBe(post.stats.minutes > 0 ? 1 : 0)
  })

  it('cup and award views are populated', () => {
    const c = cupsView()!
    expect(c.domestic).not.toBeNull()
    expect(c.coefficients.length).toBeGreaterThan(0)
    expect(drawView()).not.toBeNull()
    expect(awardsView()).not.toBeNull()
  })
})
