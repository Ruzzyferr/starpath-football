import { describe, expect, it } from 'vitest'
import { makeHeroLife } from '../career/testFixtures'
import { CASINO_FLAGS, VIP_TURNOVER, canBet, casinoCareerCost, casinoVipTier, maxStakeFor, settleBet, stakeShareFor, weeklyCasinoTick } from './casino'

describe('casino VIP tiers and career cost', () => {
  it('turnover raises the VIP tier, the table limit and the share it accepts', () => {
    const { life } = makeHeroLife({ age: 27 })
    life.money = 1_000_000
    expect(casinoVipTier(life)).toBe(0)
    expect(maxStakeFor(life)).toBe(15_000)
    life.flags[CASINO_FLAGS.turnover] = VIP_TURNOVER[2]!
    expect(casinoVipTier(life)).toBe(2)
    expect(stakeShareFor(life)).toBeCloseTo(0.025)
    expect(maxStakeFor(life)).toBe(25_000)
    life.flags[CASINO_FLAGS.vipRoom] = true
    expect(maxStakeFor(life)).toBe(30_000)
    expect(canBet(life, 29_000).ok).toBe(true)
    expect(canBet(life, 31_000).ok).toBe(false)
  })

  it('settleBet tracks turnover, hot streaks and a VIP promotion line', () => {
    const { hero, life } = makeHeroLife({ age: 27 })
    life.money = 10_000_000
    life.flags[CASINO_FLAGS.turnover] = VIP_TURNOVER[1]! - 1_000
    const lines = settleBet(life, hero, 5_000, 10_000).lines.map((l) => l.en).join(' ')
    expect(casinoVipTier(life)).toBe(1)
    expect(lines).toMatch(/VIP tier 1/)
    settleBet(life, hero, 1_000, 2_000)
    const third = settleBet(life, hero, 1_000, 2_000).lines.map((l) => l.en).join(' ')
    expect(third).toMatch(/3 wins in a row/)
  })

  it('light play costs nothing; heavy play drains happiness, form and relationships, and says so', () => {
    const { hero, life } = makeHeroLife({ age: 27 })
    life.casino.addiction = 10
    expect(casinoCareerCost(life, hero, true)).toEqual([])
    const form0 = hero.form
    const hap0 = life.happiness
    life.casino.addiction = 62
    const rel0 = Object.values(life.relationships).map((r) => r.value)
    const lines = casinoCareerCost(life, hero, true)
    expect(lines).toHaveLength(1)
    expect(lines[0]!.en).toMatch(/cost of gambling/)
    expect(hero.form).toBeLessThan(form0)
    expect(life.happiness).toBeLessThan(hap0)
    const rel1 = Object.values(life.relationships).map((r) => r.value)
    expect(rel1.some((v, i) => v < rel0[i]!)).toBe(true)
  })

  it('weeklyCasinoTick applies the cost for heavy gamblers when given the hero', () => {
    const { hero, life } = makeHeroLife({ age: 27 })
    life.casino.addiction = 66
    life.casino.visitsThisWeek = 2
    const form0 = hero.form
    const lines = weeklyCasinoTick(life, hero).map((l) => l.en).join(' ')
    expect(lines).toMatch(/cost of gambling/)
    expect(hero.form).toBeLessThan(form0)
  })
})
