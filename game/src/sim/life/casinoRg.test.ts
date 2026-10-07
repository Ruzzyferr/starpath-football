import { describe, expect, it } from 'vitest'
import { Rng } from '../../core/rng'
import { makeHeroLife } from '../career/testFixtures'
import { START_YEAR } from '../../core/config'
import {
  CASINO_FLAGS, CASINO_SEEN_FLAG, HELPLINE_MESSAGE, canBet, casinoExclusion, casinoHeadlineWorthy, selfExclude, visitCasino, weeklyCasinoTick,
} from './casino'

const cal = { season: START_YEAR, week: 10, day: 3, slot: 2 }

describe('casino headlines (GAP 2.4#65)', () => {
  it('a single isolated visit never makes the papers', () => {
    let spottedOnce = 0
    for (let seed = 1; seed <= 300; seed++) {
      const { hero, life } = makeHeroLife({ seed, age: 22 })
      hero.reputation = 90
      const news0 = life.news.length
      const v = visitCasino(new Rng(seed), life, hero, { calendar: cal, inSeason: true })
      if (v.spotted) spottedOnce++
      expect(v.headline).toBe(false)
      expect(life.news.length).toBe(news0)
    }
    expect(spottedOnce).toBeGreaterThan(10)
  })

  it('a pattern does: night before a match, repeat visits, or a second sighting', () => {
    const { life } = makeHeroLife({ age: 22 })
    expect(casinoHeadlineWorthy(life, { calendar: cal, matchTomorrow: true })).toBe(true)
    life.casino.visitsThisWeek = 2
    expect(casinoHeadlineWorthy(life, { calendar: cal })).toBe(true)
    life.casino.visitsThisWeek = 1
    life.flags[CASINO_SEEN_FLAG] = 0 // 10 weeks ago
    expect(casinoHeadlineWorthy(life, { calendar: cal })).toBe(false)
    life.flags[CASINO_SEEN_FLAG] = 6
    expect(casinoHeadlineWorthy(life, { calendar: cal })).toBe(true)
  })

  it('headlines do not invent a roulette table and name the hero', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { hero, life } = makeHeroLife({ seed, age: 22 })
      hero.reputation = 90
      visitCasino(new Rng(seed), life, hero, { calendar: cal, inSeason: true, matchTomorrow: true })
      for (const n of life.news) {
        expect(n.headline.en).not.toMatch(/roulette/i)
        expect(n.headline.en).toContain(hero.lastName)
      }
    }
  })
})

describe('responsible gaming', () => {
  it('self-exclusion locks betting, counts down weekly and cannot be shortened', () => {
    const { life } = makeHeroLife({ age: 22 })
    life.money = 10_000
    expect(canBet(life, 100).ok).toBe(true)
    expect(selfExclude(life, 4).ok).toBe(true)
    expect(casinoExclusion(life)).toBe(4)
    expect(canBet(life, 100).ok).toBe(false)
    expect(selfExclude(life, 1).ok).toBe(false)
    expect(selfExclude(life, 12).ok).toBe(true)
    for (let i = 0; i < 11; i++) weeklyCasinoTick(life)
    expect(canBet(life, 100).ok).toBe(false)
    const lines = weeklyCasinoTick(life)
    expect(casinoExclusion(life)).toBe(0)
    expect(lines.length).toBeGreaterThan(0)
    expect(canBet(life, 100).ok).toBe(true)
  })

  it('high addiction surfaces the generic helpline message (no phone numbers)', () => {
    const { life } = makeHeroLife({ age: 22 })
    life.casino.addiction = 85
    expect(weeklyCasinoTick(life)).toContainEqual(HELPLINE_MESSAGE)
    expect(HELPLINE_MESSAGE.en).not.toMatch(/\d{3}/)
    expect(HELPLINE_MESSAGE.tr).not.toMatch(/\d{3}/)
  })

  it('loss limit flag is respected', () => {
    const { life } = makeHeroLife({ age: 22 })
    life.money = 10_000
    life.flags[CASINO_FLAGS.lossLimit] = 500
    life.flags[CASINO_FLAGS.lostToday] = 450
    expect(canBet(life, 100).ok).toBe(false)
    expect(canBet(life, 50).ok).toBe(true)
  })
})
