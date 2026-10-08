import { Rng } from '../../core/rng'
import type { Calendar, Hero, Life } from '../../core/types'
import { createHero, createLife } from '../career/createHero'
import {
  BRANDS, MAX_ACTIVE_SPONSORS, SPONSOR_CATEGORIES, acceptSponsor, checkMoralityClause, heldCategories, sponsorOffers, sponsorShootPay, sponsorWeeklyValue,
  weeklySponsorTick,
} from './sponsors'

const APPEAR = { skin: 0, hairStyle: 0, hairColor: 0, beard: 0, eyeColor: 0, face: 0, accessory: 0 }
const cal: Calendar = { season: 2026, week: 1, day: 0, slot: 0 }

function setup(seed = 1, rep = 60): { rng: Rng; hero: Hero; life: Life } {
  const rng = new Rng(seed)
  const hero = createHero(rng, {
    firstName: 'A', lastName: 'B', nickname: 'AB', nationality: 'EN', position: 'CM', foot: 'R',
    appearance: APPEAR, role: 'playmaker', background: 'academy', birthYear: 2009,
  })
  hero.reputation = rep
  return { rng, hero, life: createLife(rng, hero, 'academy') }
}

describe('sponsors', () => {
  it('value grows with reputation, followers and perks', () => {
    const { hero, life } = setup(1, 10)
    const low = sponsorWeeklyValue(hero, life, 2)
    hero.reputation = 90
    const high = sponsorWeeklyValue(hero, life, 2)
    expect(high).toBeGreaterThan(low * 50)
    life.followers = 10_000_000
    expect(sponsorWeeklyValue(hero, life, 2)).toBeGreaterThan(high)
    hero.perks.push('brand_magnet')
    expect(sponsorWeeklyValue(hero, life, 2)).toBeGreaterThan(high * 1.5)
  })

  it('offers respect reputation and exclusivity', () => {
    const rng = new Rng(4)
    const { hero, life } = setup(1, 30)
    let n = 0
    for (let i = 0; i < 500; i++) {
      for (const o of sponsorOffers(rng, hero, life, { season: 2026 })) {
        n++
        expect(o.deal.minReputation).toBeLessThanOrEqual(30)
        expect(heldCategories(life).has(o.deal.category)).toBe(false)
        expect(o.deal.untilSeason).toBeGreaterThanOrEqual(2026)
        expect(o.deal.weekly).toBeGreaterThan(0)
        const r = acceptSponsor(life, o)
        expect(r.ok).toBe(true)
      }
    }
    expect(n).toBeGreaterThan(0)
    // never two in the same category
    const cats = life.sponsors.map((s) => s.category)
    expect(new Set(cats).size).toBe(cats.length)
  })

  it('acceptSponsor rejects a second deal in the same category', () => {
    const { life } = setup()
    const offer = { deal: { id: 'x', brand: 'Velox Boots', category: 'boots' as const, weekly: 100, untilSeason: 2027, minReputation: 25 }, signingBonus: 400, seasons: 2, strictness: 0.5 }
    expect(acceptSponsor(life, offer).ok).toBe(true)
    const m = life.money
    expect(acceptSponsor(life, { ...offer, deal: { ...offer.deal, id: 'y' } }).ok).toBe(false)
    expect(life.money).toBe(m)
  })

  it('morality clause: severity 3 kills strict brands, severity 1 rarely kills lenient ones', () => {
    let strictKilled = 0
    let lenientKilled = 0
    const rng = new Rng(11)
    for (let i = 0; i < 1000; i++) {
      const { hero, life } = setup(1)
      life.sponsors.push({ id: 'a', brand: 'Orbis Horology', category: 'watch', weekly: 1, untilSeason: 2030, minReputation: 65 })
      life.sponsors.push({ id: 'b', brand: 'Urban Thread', category: 'fashion', weekly: 1, untilSeason: 2030, minReputation: 10 })
      const r3 = checkMoralityClause(rng, life, hero, 3, cal)
      if (r3.terminated.some((d) => d.id === 'a')) strictKilled++
      const { hero: h2, life: l2 } = setup(1)
      l2.sponsors.push({ id: 'b', brand: 'Urban Thread', category: 'fashion', weekly: 1, untilSeason: 2030, minReputation: 10 })
      if (checkMoralityClause(rng, l2, h2, 1, cal).terminated.length) lenientKilled++
    }
    expect(strictKilled / 1000).toBeGreaterThan(0.85) // strictness 0.9
    expect(lenientKilled / 1000).toBeGreaterThan(0.04) // 0.2/3 ≈ 0.067
    expect(lenientKilled / 1000).toBeLessThan(0.1)
  })

  it('termination produces lines and news', () => {
    const { rng, hero, life } = setup(1)
    life.sponsors.push({ id: 'a', brand: 'Hydra Sport', category: 'drink', weekly: 1, untilSeason: 2030, minReputation: 30 })
    for (let i = 0; i < 50 && life.sponsors.length; i++) checkMoralityClause(rng, life, hero, 3, cal)
    expect(life.sponsors.length).toBe(0)
    expect(life.news.some((n) => n.sentiment === -1)).toBe(true)
  })

  it('weekly tick removes expired deals and warns on reputation drop', () => {
    const { hero, life } = setup(1, 10)
    life.sponsors.push({ id: 'old', brand: 'FizzUp', category: 'drink', weekly: 1, untilSeason: 2025, minReputation: 8 })
    life.sponsors.push({ id: 'big', brand: 'Apex Strike', category: 'boots', weekly: 1, untilSeason: 2028, minReputation: 55 })
    const lines = weeklySponsorTick(hero, life, cal)
    expect(life.sponsors.map((s) => s.id)).toEqual(['big'])
    expect(lines.length).toBe(2)
    expect(weeklySponsorTick(hero, life, cal).length).toBe(0) // warns once
  })

  it('shoot pay is half the best weekly deal', () => {
    const { life } = setup()
    expect(sponsorShootPay(life)).toBe(0)
    life.sponsors.push({ id: 'a', brand: 'X', category: 'car', weekly: 3000, untilSeason: 2030, minReputation: 1 })
    expect(sponsorShootPay(life)).toBe(1500)
  })

  it('brand list has all categories and no duplicates', () => {
    expect(new Set(BRANDS.map((b) => b.brand)).size).toBe(BRANDS.length)
    expect(new Set(BRANDS.map((b) => b.category)).size).toBe(10)
  })
})

describe('sponsor slot cap (2.5#54)', () => {
  it('offers nothing once 6 deals are held', () => {
    const rng = new Rng(5)
    const hero = createHero(rng, {
      firstName: 'A', lastName: 'B', nickname: 'A', nationality: 'TR', position: 'ST', foot: 'R',
      appearance: { skin: 0, hairStyle: 0, hairColor: 0, beard: 0, eyeColor: 0, face: 0, accessory: 0 }, role: 'runner', background: 'street', birthYear: 2000,
    })
    hero.reputation = 100
    const life = createLife(rng, hero, 'street')
    life.followers = 1e6
    const cats = SPONSOR_CATEGORIES.slice(0, MAX_ACTIVE_SPONSORS)
    life.sponsors = cats.map((c, i) => ({ id: `s${i}`, brand: 'X', category: c, weekly: 1, untilSeason: 2099, minReputation: 0 }))
    for (let i = 0; i < 50; i++) expect(sponsorOffers(rng, hero, life, { season: 2026 })).toEqual([])
  })
})

describe('sponsor image formula (2.5#60)', () => {
  it('is 70% performance/fame + 30% image; luxury is at most 20% of the image', async () => {
    const { sponsorImage, sponsorImageMult, IMAGE_SHARE, LUXURY_CAP_OF_IMAGE } = await import('./sponsors')
    expect(IMAGE_SHARE).toBe(0.3)
    expect(LUXURY_CAP_OF_IMAGE).toBe(0.2)
    const { life } = setup(1, 40)
    life.assets = []
    life.followers = 1_000_000
    life.discipline = 100
    const noLux = sponsorImage(life)
    expect(noLux).toBeCloseTo(0.8, 5) // everything but luxury
    const lux = ['rolex', 'ferrari', 'yacht', 'jet', 'art1', 'art2']
    life.assets = lux.map((id) => ({ defId: id, boughtSeason: 2026, boughtWeek: 1, pricePaid: 1 })) as never
    // unknown ids are ignored: no luxury credit
    expect(sponsorImage(life)).toBeCloseTo(noLux, 5)
    expect(sponsorImage(life)).toBeLessThanOrEqual(1)
    // even a zero-image hero keeps at least 70% x 1.1 of the performance value
    life.assets = []
    life.followers = 0
    life.discipline = 0
    expect(sponsorImageMult(life)).toBeCloseTo(1.1 * 0.7, 5)
  })

  it('a luxury-free star still gets sponsor value', () => {
    const { hero, life } = setup(1, 70)
    life.assets = []
    expect(sponsorWeeklyValue(hero, life, 2)).toBeGreaterThan(3000)
  })
})

describe('sponsor performance bonus (2.5#55)', () => {
  it('offers carry a per-contribution bonus that the weekly tick pays net of tax', () => {
    const rng = new Rng(9)
    const { hero, life } = setup(1, 60)
    let offer
    for (let i = 0; i < 300 && !offer; i++) offer = sponsorOffers(rng, hero, life, { season: 2026 })[0]
    expect(offer).toBeTruthy()
    expect(offer!.deal.perfBonus).toBeGreaterThan(0)
    acceptSponsor(life, offer!)
    const money0 = life.money
    weeklySponsorTick(hero, life, cal, 0)
    expect(life.money).toBe(money0)
    const lines = weeklySponsorTick(hero, life, cal, 3)
    expect(life.money).toBeGreaterThan(money0)
    expect(life.money - money0).toBeCloseTo(offer!.deal.perfBonus! * 3 * 0.65, -1)
    expect(lines.length).toBeGreaterThan(0)
  })
})
