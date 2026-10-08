/**
 * Live text feed controls (GAP 2.2#106): 0.5x speed and "skip to next moment"
 * over the real backend.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { MemoryStorage } from '../../state/save'
import { gameState, installBackend, match } from '../store'
import { DEFAULT_CAREER } from './index'
import { MS_PER_MINUTE } from './liveMatch'
import { useStorage } from './persistence'
import { realActions as A } from './realActions'
import { realData as D } from './realData'

describe('live match feed controls', () => {
  beforeAll(() => {
    vi.useFakeTimers()
    useStorage(new MemoryStorage())
    installBackend({ actions: A, data: D })
  })
  afterAll(() => {
    vi.useRealTimers()
  })

  it('0.5x is twice as slow as 1x', () => {
    expect(MS_PER_MINUTE[0.5]).toBe(MS_PER_MINUTE[1] * 2)
  })

  it('skip to next moment runs straight to the hero moment, then to full time', () => {
    const clear = () => {
      for (let n = 0; n < 20 && (gameState.value?.pendingEvents.length ?? 0) > 0; n++) {
        const v = D.eventView(0)
        const pick = v ? Math.max(0, v.choices.findIndex((c) => !c.requirement || c.requirement.met)) : 0
        A.resolveEvent(0, pick)
      }
    }
    let best = 0
    for (const seed of [777, 4242, 31, 99, 5]) {
      A.newGame({ ...DEFAULT_CAREER, birthYear: 2000, seed })
      for (let i = 0; i < 20; i++) {
        clear()
        const fx = D.nextFixture()
        if (fx?.daysUntil === 0 && (gameState.value?.calendar.slot ?? 0) >= 1) break
        A.advanceToMatch()
      }
      clear()
      A.playMatch()
      expect(match.value).not.toBeNull()
      A.matchSetSpeed(0.5)
      expect(match.value!.speed).toBe(0.5)
      let moments = 0
      for (let guard = 0; guard < 40 && !match.value!.finished; guard++) {
        const before = match.value!.minute
        A.matchSkipToMoment()
        const m = match.value!
        if (m.finished) break
        // Each skip stops exactly at a hero moment (never mid-way without one).
        expect(m.pendingMoment).not.toBeNull()
        expect(m.minute).toBeGreaterThanOrEqual(before)
        moments++
        A.simMoment()
      }
      expect(match.value!.finished).toBe(true)
      expect(match.value!.minute).toBeGreaterThanOrEqual(90)
      best = Math.max(best, moments)
      if (best > 0) break
      A.finishMatch()
    }
    expect(best).toBeGreaterThan(0)
  })
})
