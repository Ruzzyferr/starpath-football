/** In-match decision window over the real backend (GAP 2.4#36/#52/#99). */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { MemoryStorage } from '../../state/save'
import { gameState, installBackend, match } from '../store'
import { DEFAULT_CAREER } from './index'
import { debugOpenDecision, recentEvents } from './liveMatch'
import { pickDecision } from '../../sim/match/decisions'
import { useStorage } from './persistence'
import { realActions as A } from './realActions'
import { realData as D } from './realData'
import { pendingDecisions } from '../../sim/game/matchDecisions'

describe('in-match decision window', () => {
  beforeAll(() => {
    vi.useFakeTimers()
    useStorage(new MemoryStorage())
    installBackend({ actions: A, data: D })
  })
  afterAll(() => {
    vi.useRealTimers()
  })

  it('pauses the match, applies the choice at full time and shows it in the rating log', () => {
    A.newGame({ ...DEFAULT_CAREER, birthYear: 2000, seed: 4242 })
    for (let i = 0; i < 20; i++) {
      // Resolve pending cards with the first choice that is open (a gated choice 0 would leave the card pending).
      for (let n = 0; n < 20 && (gameState.value?.pendingEvents.length ?? 0) > 0; n++) {
        const before = gameState.value!.pendingEvents.length
        for (let c = 0; c < 4 && gameState.value!.pendingEvents.length === before; c++) A.resolveEvent(0, c)
      }
      const fx = D.nextFixture()
      if (fx?.daysUntil === 0 && (gameState.value?.calendar.slot ?? 0) >= 1) break
      A.advanceToMatch()
    }
    const s = gameState.value!
    s.hero.contract!.role = 'captain'
    s.hero.managerTrust = 100
    s.hero.form = 90
    s.hero.fatigue = 0
    s.hero.sharpness = 100
    A.playMatch()
    A.matchPause(false)
    // Run a few minutes so the hero is on the pitch, then force a window.
    for (let i = 0; i < 12 && !match.value!.pendingMoment; i++) vi.advanceTimersByTime(700)
    if (match.value!.pendingMoment) A.simMoment()
    expect(debugOpenDecision('provocation')).toBe(true)
    const frozen = match.value!.minute
    expect(match.value!.decision?.options.length).toBeGreaterThanOrEqual(2)
    vi.advanceTimersByTime(5000)
    expect(match.value!.minute).toBe(frozen) // the sim waits for the player
    A.matchDecide('ignore')
    expect(match.value!.decision).toBeNull()
    expect(pendingDecisions(gameState.value!)).toHaveLength(1)
    A.matchSimToEnd()
    expect(match.value!.finished).toBe(true)
    expect(pendingDecisions(gameState.value!)).toHaveLength(0)
    const post = D.postMatch()
    expect(post?.ratingLog?.some((l) => l.key === 'decision')).toBe(true)
    A.finishMatch()
  })

  it('feeds recent events so an own penalty can open the penalty window, never for keepers', () => {
    const snap = { minute: 30, events: [{ type: 'penalty', side: 'away' as const, minute: 30 }] }
    const recent = recentEvents(snap, 'away')
    expect(recent).toEqual([{ type: 'penalty', own: true, minute: 30 }])
    const base = { minute: 30, shown: 0, lastMinute: -99, heroOnPitch: true, diff: 0, last: null, isCaptain: false, heroOvr: 70, heroYellow: 0, recent }
    let taker = 0
    let keeperTaker = 0
    for (let k = 0; k < 400; k++) {
      if (pickDecision({ ...base, seed: `p${k}` }) === 'penaltyTaker') taker++
      if (pickDecision({ ...base, seed: `p${k}`, isKeeper: true }) === 'penaltyTaker') keeperTaker++
    }
    expect(taker).toBeGreaterThan(0)
    expect(keeperTaker).toBe(0)
  })
})
