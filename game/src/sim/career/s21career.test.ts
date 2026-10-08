/** Career sweep S21: transfer windows, interest scale, step-up gate, request, market value. */
import { describe, expect, it } from 'vitest'
import { Rng } from '../../core/rng'
import type { Calendar } from '../../core/types'
import { transferWindow } from '../game/internal'
import { WINTER_WINDOW_WEEK } from '../world/fixtures'
import { absWeek } from './common'
import { heroMarketValue, marketValueBreakdown } from './contract'
import { makeHeroLife } from './testFixtures'
import { heroOvr } from './progression'
import {
  canBid, expireTransferRequest, interestStars, requestTransfer, scoutInterest, transferRequestExpiry, TRANSFER_REQUEST_FLAG,
  type CandidateClub,
} from './transfers'

describe('transfer windows (2.3#70)', () => {
  it('winter window is 4 weeks', () => {
    const winter = Array.from({ length: 44 }, (_, w) => w).filter((w) => transferWindow(w) === 'winter')
    expect(winter.length).toBe(4)
    expect(winter).toContain(WINTER_WINDOW_WEEK)
  })
})

describe('interest scale and reason (2.3#71)', () => {
  it('stars 1..5, bids from 3 (level 55)', () => {
    expect(interestStars(10)).toBe(1)
    expect(interestStars(55)).toBe(3)
    expect(interestStars(100)).toBe(5)
  })
  it('every scouting club carries a reason and a star value', () => {
    const { hero } = makeHeroLife()
    hero.seasonStats.apps = 5
    hero.seasonStats.goals = 4
    hero.form = 95
    const ovr = heroOvr(hero)
    const clubs: CandidateClub[] = Array.from({ length: 6 }, (_, i) => ({ clubId: `x${i}`, name: `X${i}`, reputation: 20 + i * 5, squadAvgOvr: ovr - 2 + i, transferBudget: 1e8 }))
    const list = scoutInterest(new Rng(3), hero, clubs, { season: 2026, currentClubId: 'none' })
    expect(list.length).toBeGreaterThan(0)
    for (const c of list) {
      expect(c.stars).toBe(interestStars(c.level))
      expect(c.reason.tr.length).toBeGreaterThan(5)
      expect(c.reason.en.length).toBeGreaterThan(5)
    }
    expect(list.some((c) => c.reason.en.includes('4 goals'))).toBe(true)
  })
})

describe('realistic step-up gate (2.3#72)', () => {
  it('no bid more than 6 below the squad average', () => {
    expect(canBid(60, 67, 40, 35, 0)).toBe(false)
    expect(canBid(61, 67, 40, 35, 0)).toBe(true)
  })
  it('a giant leap needs OVR at their level or an exceptional season', () => {
    // From a rep-30 club to a rep-90 club, 3 below the average.
    expect(canBid(72, 75, 90, 30, 20)).toBe(false)
    expect(canBid(72, 75, 90, 30, 40)).toBe(true)
    expect(canBid(71, 75, 90, 30, 45)).toBe(false)
    expect(canBid(75, 75, 90, 30, 0)).toBe(true)
  })
})

describe('transfer request (2.3#74)', () => {
  it('costs trust 10 and fans 15, and lapses after one window', () => {
    const { hero, life } = makeHeroLife()
    const cal: Calendar = { season: 2026, week: 10, day: 0, slot: 0 }
    life.relationships.fans = life.relationships.fans ?? { id: 'fans', kind: 'fans', name: 'Fans', value: 0 } as never
    hero.contract = { clubId: 'c1', wage: 1000, untilSeason: 2028, role: 'rotation', releaseClause: null } as never
    hero.managerTrust = 50
    const trust = hero.managerTrust
    const fans = life.relationships.fans!.value
    requestTransfer(hero, life, cal)
    expect(hero.managerTrust).toBe(trust - 10)
    expect(life.relationships.fans!.value).toBe(Math.max(-100, fans - 15))
    const at = life.flags[TRANSFER_REQUEST_FLAG] as number
    expect(transferRequestExpiry(at)).toBe(absWeek({ season: 2026, week: 25 }))
    expect(expireTransferRequest(life, { ...cal, week: 25 })).toBe(false)
    expect(expireTransferRequest(life, { ...cal, week: 26 })).toBe(true)
    expect(life.flags[TRANSFER_REQUEST_FLAG]).toBeUndefined()
  })
  it('a request made after the winter window lasts until the summer window closes', () => {
    const at = absWeek({ season: 2026, week: 30 })
    expect(transferRequestExpiry(at)).toBe(absWeek({ season: 2027, week: 0 }))
  })
})

describe('market value breakdown (2.3#73)', () => {
  it('parts multiply to the total and form moves the value', () => {
    const { hero } = makeHeroLife()
    const b = marketValueBreakdown(hero, 2026)
    expect(b.parts.map((p) => p.key)).toContain('form')
    expect(heroMarketValue(hero, 2026)).toBe(b.total)
    hero.form = 100
    const hi = heroMarketValue(hero, 2026)
    hero.form = 0
    expect(hi).toBeGreaterThan(heroMarketValue(hero, 2026))
  })
})
