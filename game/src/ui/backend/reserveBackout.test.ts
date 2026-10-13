/**
 * Backing out of an unplayed U21 / training match must not lock the day
 * ("Önce maçını tamamla" with the next league game days away).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { MemoryStorage } from '../../state/save'
import { gameState, installBackend } from '../store'
import { DEFAULT_CAREER } from './index'
import { liveActive } from './liveMatch'
import { useStorage } from './persistence'
import { quickResolveAll, reserveBlock, startReserveMatch } from './benchPath'
import { realActions as A } from './realActions'
import { realData as D } from './realData'

describe('reserve match left at the pre-match screen', () => {
  beforeAll(() => {
    vi.useFakeTimers()
    useStorage(new MemoryStorage())
    installBackend({ actions: A, data: D })
  })
  afterAll(() => {
    vi.useRealTimers()
  })

  it('does not block advancing the day', () => {
    const clear = () => {
      quickResolveAll()
      for (let n = 0; n < 20 && (gameState.value?.pendingEvents.length ?? 0) > 0; n++) {
        const v = D.eventView(0)
        const pick = v ? Math.max(0, v.choices.findIndex((c) => !c.requirement || c.requirement.met)) : 0
        A.resolveEvent(0, pick)
      }
    }
    let tested = false
    for (const seed of [777, 4242, 31]) {
      A.newGame({ ...DEFAULT_CAREER, birthYear: 2000, seed })
      for (let i = 0; i < 80 && reserveBlock('scrimmage'); i++) {
        clear()
        const s = gameState.value!
        s.life.energy = 100
        s.hero.injury = null
        if (D.nextFixture()?.daysUntil === 0) {
          A.playMatch()
          A.matchSimToEnd()
          A.finishMatch()
        }
        A.advance()
      }
      if (reserveBlock('scrimmage')) continue
      clear()
      expect(startReserveMatch('scrimmage')).toBe(true)
      expect(liveActive()).toBe(true)
      const slot = gameState.value!.calendar.slot
      const day = gameState.value!.calendar.day
      A.advance() // player pressed Back on the pre-match screen, then Advance
      expect(liveActive()).toBe(false)
      expect(gameState.value!.activeMatchId).toBeNull()
      const c = gameState.value!.calendar
      expect(c.slot !== slot || c.day !== day).toBe(true)
      tested = true
      break
    }
    expect(tested).toBe(true)
  })
})
