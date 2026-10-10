/**
 * Blackjack split through the real backend: GameActions.casino → façade →
 * casino sim, with the view exposing both hands and per-hand settlement.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { GameState } from '../../core/types'
import type { BlackjackRound } from '../../sim/life/casino'
import { GFLAG, absDayOf, readJson, writeJson } from '../../sim/game/internal'
import { MemoryStorage } from '../../state/save'
import { blackjack, gameState, installBackend } from '../store'
import { DEFAULT_CAREER } from './index'
import { useStorage } from './persistence'
import { realActions as A } from './realActions'
import { realData as D } from './realData'

const S = (): GameState => {
  const s = gameState.value
  if (!s) throw new Error('no state')
  return s
}

/** Deal until the round stays open (no naturals), then rig the player's hand to a pair of eights. */
function dealPairOfEights(bet: number): void {
  for (let i = 0; i < 40; i++) {
    const v = A.casino.blackjackDeal(bet)
    if (v.phase === 'player') break
  }
  const s = S()
  const round = readJson<BlackjackRound | null>(s.life, GFLAG.blackjack, null)
  if (!round) throw new Error('no open round')
  round.hands[0]!.cards = [7, 20] // 8♠-ish, 8♥-ish (rank 8 in two suits)
  round.dealer = [5, 9] // dealer shows 6, holds 10 → 16, must draw
  writeJson(s.life, GFLAG.blackjack, round)
}

describe('blackjack split via real backend', () => {
  beforeAll(() => {
    vi.useFakeTimers()
    useStorage(new MemoryStorage())
    installBackend({ actions: A, data: D })
    A.newGame({ ...DEFAULT_CAREER, birthYear: 2005, seed: 4242 }) // 21: casino is 21+
    const s = S()
    s.calendar.slot = 2
    s.life.flags[GFLAG.casinoDay] = absDayOf(s)
    s.life.energy = 100
  })
  afterAll(() => {
    vi.useRealTimers()
  })

  it('splits a pair into two hands and settles each one', () => {
    const s = S()
    s.life.money = 5000
    dealPairOfEights(100)
    const money0 = S().life.money
    let v = A.casino.blackjackSplit()
    expect(v.hands).toHaveLength(2)
    expect(v.bet).toBe(200)
    expect(v.canSplit).toBe(false)
    expect(v.hands.every((h) => h.stake === 100 && h.cards[0]!.rank === '8')).toBe(true)
    expect(blackjack.value?.hands).toHaveLength(2)
    if (v.phase === 'player') expect(v.active).toBe(0)
    for (let i = 0; i < 6 && v.phase === 'player'; i++) v = A.casino.blackjackStand()
    expect(v.phase).toBe('done')
    expect(v.active).toBe(2)
    expect(v.hands.every((h) => h.result !== null)).toBe(true)
    const perHand = v.hands.reduce((a, h) => a + h.payout, 0)
    expect(v.payout).toBe(perHand)
    expect(Math.round(S().life.money - money0)).toBe(v.payout)
    expect(v.result).not.toBeNull()
  })

  it('refuses to split without cash for the second stake', () => {
    const s = S()
    s.life.money = 5000
    dealPairOfEights(100)
    S().life.money = 150 // can't cover another 100 on top of the 100 in play
    const v = A.casino.blackjackSplit()
    expect(v.hands.length).toBeLessThanOrEqual(1)
    const round = readJson<BlackjackRound | null>(S().life, GFLAG.blackjack, null)
    expect(round?.hands).toHaveLength(1)
    // Clean up: finish the hand.
    let w = A.casino.blackjackStand()
    for (let i = 0; i < 3 && w.phase === 'player'; i++) w = A.casino.blackjackStand()
    expect(w.phase).toBe('done')
  })
})
