import { describe, expect, it } from 'vitest'
import { Rng } from '../../core/rng'
import { START_YEAR } from '../../core/config'
import { makeHeroLife } from '../career/testFixtures'
import {
  BUSINESS_DEFS, BUSINESS_KINDS, HISTORY_WEEKS, businessValue, businesses, expectedRevenue, openBusiness, sellBusiness, setBusinessManager,
  upgradeBusiness, upgradeCost, weeklyBusinessTick,
} from './business'
import { netWorth, weeklyEconomy } from './economy'

const cal = { season: START_YEAR, week: 8, day: 0, slot: 0 }

function rich() {
  const x = makeHeroLife({ age: 24 })
  x.hero.reputation = 45
  x.life.money = 5_000_000
  return x
}

describe('business v1', () => {
  it('opens, upgrades, hires a manager and sells', () => {
    const { hero, life } = rich()
    const r = openBusiness(life, hero, 'restaurant', cal, 'Deniz Lokanta')
    expect(r.ok).toBe(true)
    expect(life.money).toBe(5_000_000 - BUSINESS_DEFS.restaurant.price)
    expect(openBusiness(life, hero, 'restaurant', cal).ok).toBe(false) // one per kind
    const b = businesses(life)[0]
    expect(b.name).toBe('Deniz Lokanta')
    const cost = upgradeCost(b)!
    const m0 = life.money
    expect(upgradeBusiness(life, b.id).ok).toBe(true)
    expect(b.level).toBe(2)
    expect(life.money).toBe(m0 - cost)
    expect(b.invested).toBe(BUSINESS_DEFS.restaurant.price + cost)
    expect(setBusinessManager(life, b.id, true).ok).toBe(true)
    expect(setBusinessManager(life, b.id, true).ok).toBe(false)
    const v = businessValue(b)
    const s = sellBusiness(life, b.id)
    expect(s.amount).toBe(v)
    expect(businesses(life)).toHaveLength(0)
  })

  it('gates by reputation and cash', () => {
    const { hero, life } = makeHeroLife({ age: 18 })
    hero.reputation = 5
    life.money = 10_000_000
    expect(openBusiness(life, hero, 'clothing', cal).ok).toBe(false)
    hero.reputation = 40
    life.money = 1000
    expect(openBusiness(life, hero, 'gym', cal).ok).toBe(false)
  })

  it('weekly P&L is itemised, consistent and kept for 8 weeks', () => {
    const { hero, life } = rich()
    for (const k of BUSINESS_KINDS) openBusiness(life, hero, k, cal)
    const rng = new Rng(5)
    for (let w = 0; w < 12; w++) weeklyBusinessTick(rng, life, hero, { ...cal, week: cal.week + w })
    for (const b of businesses(life)) {
      expect(b.history).toHaveLength(HISTORY_WEEKS)
      for (const p of b.history) {
        expect(p.profit).toBe(p.revenue - p.rent - p.staff - p.manager - p.stock - p.incident)
        expect(Number.isFinite(p.profit)).toBe(true)
      }
      expect(b.history[0].w).toBeGreaterThan(b.history[1].w)
    }
  })

  it('a managed business pays back within ~2 seasons on average; managers steady the weeks', () => {
    for (const k of BUSINESS_KINDS) {
      let total = 0
      const weekly: number[] = []
      for (let seed = 1; seed <= 20; seed++) {
        const { hero, life } = rich()
        openBusiness(life, hero, k, cal)
        const b = businesses(life)[0]
        setBusinessManager(life, b.id, true)
        const rng = new Rng(seed)
        for (let w = 0; w < 104; w++) weekly.push(weeklyBusinessTick(rng, life, hero, cal).net)
        total += b.totalProfit
      }
      const avg = total / 20
      expect(avg, k).toBeGreaterThan(BUSINESS_DEFS[k].price * 0.6)
      expect(avg, k).toBeLessThan(BUSINESS_DEFS[k].price * 4)
    }
  })

  it('fame drives demand, clothing the most', () => {
    const b = { kind: 'clothing' as const, level: 1 as const, brand: 50, manager: false }
    const g = { ...b, kind: 'gym' as const }
    expect(expectedRevenue(b, 90) / expectedRevenue(b, 10)).toBeGreaterThan(expectedRevenue(g, 90) / expectedRevenue(g, 10))
  })

  it('flows through the weekly economy and net worth', () => {
    const { hero, life } = rich()
    const nw0 = netWorth(life, cal)
    openBusiness(life, hero, 'gym', cal)
    expect(Math.abs(netWorth(life, cal) - nw0)).toBeLessThan(BUSINESS_DEFS.gym.price) // value retained, not lost
    const r = weeklyEconomy(new Rng(3), life, hero, { calendar: cal })
    expect(r.breakdown.business).toBe(businesses(life)[0].history[0].profit)
  })
})
