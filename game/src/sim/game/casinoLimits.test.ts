import { describe, expect, it } from 'vitest'
import { canBet, CASINO_FLAGS, maxStakeFor } from '../life/casino'
import { casinoLimits } from './casinoLimits'

const life = (money: number, flags: Record<string, number> = {}) => ({ money, flags, casino: undefined }) as never

describe('casinoLimits mirrors canBet', () => {
  it('no limit: table cap or cash', () => {
    const l = life(100_000)
    expect(casinoLimits(l).maxStake).toBe(maxStakeFor(l))
    expect(casinoLimits(l).remaining).toBe(Infinity)
    expect(canBet(l, casinoLimits(l).maxStake).ok).toBe(true)
    expect(canBet(l, casinoLimits(l).maxStake + 1).ok).toBe(false)
  })
  it('loss limit shrinks the offer and is enforced at the boundary', () => {
    const l = life(1_000_000, { [CASINO_FLAGS.lossLimit]: 1000, [CASINO_FLAGS.lostToday]: 700 })
    const c = casinoLimits(l)
    expect(c.remaining).toBe(300)
    expect(c.maxStake).toBe(300)
    expect(canBet(l, 300).ok).toBe(true)
    expect(canBet(l, 301).ok).toBe(false)
  })
  it('limit fully used leaves nothing', () => {
    const l = life(50_000, { [CASINO_FLAGS.lossLimit]: 500, [CASINO_FLAGS.lostToday]: 900 })
    expect(casinoLimits(l).maxStake).toBe(0)
  })
})
