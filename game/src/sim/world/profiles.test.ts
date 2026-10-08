import { describe, expect, it } from 'vitest'
import { Rng } from '../../core/rng'
import type { World } from '../../core/types'
import { DATA_VERSION } from '../../data/world/version'
import { applyDataUpdates } from './dataUpdate'
import { WOMEN_BUDGET_SCALE, generateWorld } from './generate'
import { NPC_TRAITS, clubFinanceSheet, managerProfile, npcTraits, shortClubName, traitEffects, youthTrustBonus } from './profiles'

let cached: World | null = null
const world = (): World => (cached ??= generateWorld(new Rng(5), { season: 2026, heroCountryId: 'TR', countryIds: ['TR', 'EN', 'ES'] }))

describe('2.6#36 NPC traits', () => {
  it('every player has 2-4 distinct, non-contradicting traits, stable per player', () => {
    const counts = new Set<number>()
    const seen = new Set<string>()
    for (const p of Object.values(world().players)) {
      const t = npcTraits(p)
      counts.add(t.length)
      t.forEach((x) => seen.add(x))
      expect(t.length).toBeGreaterThanOrEqual(2)
      expect(t.length).toBeLessThanOrEqual(4)
      expect(new Set(t).size).toBe(t.length)
      expect(t.includes('loyal') && t.includes('ambitious')).toBe(false)
      expect(t.includes('lazy') && t.includes('ironman')).toBe(false)
      expect(npcTraits(p)).toEqual(t)
      if (p.personality === 'hothead') expect(t).toContain('brawler')
    }
    expect([...counts].sort()).toEqual([2, 3, 4])
    expect(seen.size).toBe(NPC_TRAITS.length)
  })
  it('traits move cards, injuries and mood in the intended direction', () => {
    const brawler = traitEffects(['brawler'])
    const iron = traitEffects(['ironman'])
    const fragile = traitEffects(['fragile'])
    expect(brawler.cards).toBeGreaterThan(1)
    expect(iron.injury).toBeLessThan(1)
    expect(fragile.injury).toBeGreaterThan(1)
    expect(traitEffects(['leader', 'teamPlayer']).winMorale).toBe(2)
    expect(traitEffects(['lazy', 'selfish']).lossMorale).toBe(-2)
    expect(traitEffects([])).toEqual({ cards: 1, injury: 1, winMorale: 0, lossMorale: 0 })
  })
})

describe('2.6#39 manager profiles', () => {
  it('has age, youth trust and patience; changes with the manager; youth trust helps only the young', () => {
    const clubs = Object.values(world().clubs)
    const trusts = clubs.map((c) => managerProfile(c).youthTrust)
    expect(Math.min(...trusts)).toBeLessThan(30)
    expect(Math.max(...trusts)).toBeGreaterThan(70)
    for (const c of clubs) {
      const m = managerProfile(c)
      expect(m.age).toBeGreaterThanOrEqual(38)
      expect(m.age).toBeLessThan(68)
      expect(m.patience).toBeGreaterThanOrEqual(5)
      expect(m.formation).toBe(c.formation)
    }
    const c = clubs[0]!
    expect(managerProfile(c)).toEqual(managerProfile({ ...c }))
    expect(managerProfile({ ...c, managerName: 'Someone Else' }).youthTrust === managerProfile(c).youthTrust && managerProfile({ ...c, managerName: 'Someone Else' }).age === managerProfile(c).age).toBe(false)
    expect(youthTrustBonus(90, 19)).toBeCloseTo(2)
    expect(youthTrustBonus(10, 19)).toBeCloseTo(-2)
    expect(youthTrustBonus(90, 25)).toBe(0)
    expect(youthTrustBonus(undefined, 19)).toBe(0)
  })
})

describe('2.6#19 club finances', () => {
  it('wages take 55-70 % of income for every club; all lines are positive', () => {
    for (const c of Object.values(world().clubs)) {
      const f = clubFinanceSheet(world(), c)
      expect(f.wageRatio, c.id).toBeGreaterThanOrEqual(0.55)
      expect(f.wageRatio, c.id).toBeLessThanOrEqual(0.7)
      for (const v of [...Object.values(f.income), ...Object.values(f.spending)]) expect(v).toBeGreaterThan(0)
      expect(f.totalIncome).toBe(Object.values(f.income).reduce((s, x) => s + x, 0))
    }
  })
})

describe('2.6#116 women\'s pyramid', () => {
  it('is its own world: separate streams, reputations, budgets and grounds, not the men\'s world flipped', () => {
    const opts = { season: 2026, heroCountryId: 'TR', countryIds: ['TR', 'EN'] }
    const men = generateWorld(new Rng(3), opts)
    const women = generateWorld(new Rng(3), { ...opts, gender: 'female' })
    expect(women.gender).toBe('female')
    expect(Object.keys(women.clubs)).toEqual(Object.keys(men.clubs))
    const same = Object.keys(men.clubs).filter((id) => men.clubs[id]!.name === women.clubs[id]!.name).length
    expect(same).toBeLessThan(Object.keys(men.clubs).length * 0.2)
    const avg = (w: World, f: (c: World['clubs'][string]) => number) => Object.values(w.clubs).reduce((s, c) => s + f(c), 0) / Object.keys(w.clubs).length
    expect(avg(women, (c) => c.reputation)).toBeLessThan(avg(men, (c) => c.reputation))
    expect(avg(women, (c) => c.budget)).toBeLessThan(avg(men, (c) => c.budget) * (WOMEN_BUDGET_SCALE + 0.15))
    expect(avg(women, (c) => c.stadium.capacity)).toBeLessThan(avg(men, (c) => c.stadium.capacity) * 0.6)
    expect(Object.values(women.players).every((p) => p.appearance.gender === 'female')).toBe(true)
  })
})

describe('2.6#127/#128 data version and updates', () => {
  it('new worlds carry the current data version; older careers get the steps once', () => {
    expect(world().dataVersion).toBe(DATA_VERSION)
    const old = generateWorld(new Rng(8), { season: 2026, heroCountryId: 'TR', countryIds: ['TR'] })
    delete old.dataVersion
    delete old.legends
    for (const c of Object.values(old.clubs)) delete c.founded
    expect(applyDataUpdates(old)).toEqual([2])
    expect(old.dataVersion).toBe(DATA_VERSION)
    expect(Object.values(old.clubs).every((c) => typeof c.founded === 'number')).toBe(true)
    expect(old.legends).toEqual([])
    expect(applyDataUpdates(old)).toEqual([])
  })
})

describe('2.6#9 short club names', () => {
  it('every club has a full name, a 3-letter code and a short label of at most 12 characters', () => {
    for (const c of Object.values(world().clubs)) {
      expect(c.shortName).toMatch(/^[A-Z]{3}$/)
      const label = shortClubName(c.name)
      expect(label.length, c.name).toBeLessThanOrEqual(12)
      expect(label.length).toBeGreaterThan(2)
    }
    expect(shortClubName('Real Short')).toBe('Real Short')
    expect(shortClubName('Sporting Moonfield United').length).toBeLessThanOrEqual(12)
  })
})
