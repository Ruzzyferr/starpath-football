import { Rng } from '../../core/rng'
import type { Calendar, Hero } from '../../core/types'
import { createHero, createLife, type HeroInput } from './createHero'
import { heroOvr } from './progression'
import {
  ARRIVAL_TRUST, TRANSFER_REQUEST_FLAG, acceptTransfer, endLoan, freeAgentOffers, generateLoanOffers,
  generateTransferOffers, requestTransfer, scoutInterest, type CandidateClub,
} from './transfers'

const input: HeroInput = {
  firstName: 'Can', lastName: 'Demir', nickname: 'Can', nationality: 'TR', position: 'LW', foot: 'L',
  appearance: { skin: 0, hairStyle: 0, hairColor: 0, beard: 0, eyeColor: 0, face: 0, accessory: 0 },
  archetype: 'winger', background: 'street', birthYear: 2009,
}
const SEASON = 2026
const cal: Calendar = { season: SEASON, week: 1, day: 0, slot: 0 }

function hero(boost = 0): Hero {
  const h = createHero(new Rng(1), input)
  for (const k of Object.keys(h.attrs) as (keyof Hero['attrs'])[]) h.attrs[k] = Math.min(99, h.attrs[k] + boost)
  return h
}

/** Clubs spanning the pyramid: rep 10..95, squad avg 45..82. */
const clubs: CandidateClub[] = Array.from({ length: 12 }, (_, i) => ({
  clubId: `c${i}`, name: `Club ${i}`, reputation: 10 + i * 7.7, squadAvgOvr: 45 + i * 3.4, transferBudget: 5e6 * (i + 1) ** 2,
}))

describe('scout interest', () => {
  it('is sorted and favours clubs at the hero level over elite clubs', () => {
    const h = hero(10) // OVR ~60
    const list = scoutInterest(new Rng(1), h, clubs, { season: SEASON })
    for (let i = 1; i < list.length; i++) expect(list[i - 1].level).toBeGreaterThanOrEqual(list[i].level)
    const ids = list.map((x) => x.clubId)
    expect(ids).not.toContain('c11') // elite club ignores a 60 OVR
    expect(list.length).toBeGreaterThan(0)
  })

  it('grows with OVR and excludes the current club', () => {
    const weak = scoutInterest(new Rng(2), hero(0), clubs, { season: SEASON })
    const strong = scoutInterest(new Rng(2), hero(25), clubs, { season: SEASON, currentClubId: 'c5' })
    expect(strong.length).toBeGreaterThan(weak.length)
    expect(strong.find((x) => x.clubId === 'c5')).toBeUndefined()
  })
})

describe('transfer offers', () => {
  const contracted = (boost: number, clause: number | null = null) => {
    const h = hero(boost)
    h.contract = { clubId: 'c3', wage: 2000, untilSeason: SEASON + 2, signingBonus: 0, goalBonus: 100, assistBonus: 60, releaseClause: clause, role: 'starter' }
    return h
  }

  it('no offers outside a window or without a contract', () => {
    const h = contracted(20)
    const life = createLife(new Rng(1), h, 'street')
    expect(generateTransferOffers(new Rng(1), h, life, clubs, { window: null, season: SEASON })).toEqual([])
    h.contract = null
    expect(generateTransferOffers(new Rng(1), h, life, clubs, { window: 'summer', season: SEASON })).toEqual([])
  })

  it('a strong hero receives bids within budgets', () => {
    let total = 0
    for (let s = 0; s < 20; s++) {
      const h = contracted(25)
      const life = createLife(new Rng(s), h, 'street')
      const offers = generateTransferOffers(new Rng(s), h, life, clubs, { window: 'summer', season: SEASON, currentClub: { clubId: 'c3', name: 'Club 3', reputation: 33 } })
      for (const o of offers) {
        const c = clubs.find((x) => x.clubId === o.clubId)!
        expect(o.fee).toBeLessThanOrEqual(c.transferBudget!)
        expect(o.contract.clubId).toBe(o.clubId)
      }
      total += offers.length
    }
    expect(total).toBeGreaterThan(10)
  })

  it('release clauses get triggered by bigger clubs', () => {
    let triggered = 0
    for (let s = 0; s < 40; s++) {
      const h = contracted(25, 2_000_000)
      const life = createLife(new Rng(s), h, 'street')
      const offers = generateTransferOffers(new Rng(s), h, life, clubs, { window: 'summer', season: SEASON, currentClub: { clubId: 'c3', name: 'Club 3', reputation: 33 } })
      for (const o of offers) if (o.viaReleaseClause) { triggered++; expect(o.fee).toBe(2_000_000) }
    }
    expect(triggered).toBeGreaterThan(0)
  })

  it('a transfer request costs trust and raises bid frequency', () => {
    let base = 0
    let req = 0
    for (let s = 0; s < 30; s++) {
      const a = contracted(15)
      const la = createLife(new Rng(s), a, 'street')
      base += generateTransferOffers(new Rng(s), a, la, clubs, { window: 'summer', season: SEASON }).length
      const b = contracted(15)
      const lb = createLife(new Rng(s), b, 'street')
      const trust = b.managerTrust
      requestTransfer(b, lb, cal)
      expect(b.managerTrust).toBe(trust - 10)
      expect(lb.flags[TRANSFER_REQUEST_FLAG]).toBeDefined()
      req += generateTransferOffers(new Rng(s), b, lb, clubs, { window: 'summer', season: SEASON }).length
    }
    expect(req).toBeGreaterThan(base)
  })
})

describe('loans & free agency', () => {
  it('young reserves get loan offers from smaller clubs where they would play', () => {
    const h = hero(5)
    h.contract = { clubId: 'c9', wage: 3000, untilSeason: SEASON + 2, signingBonus: 0, goalBonus: 0, assistBonus: 0, releaseClause: null, role: 'reserve' }
    const offers = generateLoanOffers(new Rng(3), h, clubs, { window: 'summer', season: SEASON, currentClub: { clubId: 'c9', name: 'Club 9', reputation: 79 } })
    expect(offers.length).toBeGreaterThan(0)
    for (const o of offers) {
      expect(o.isLoan).toBe(true)
      expect(o.contract.loan).toBe(true)
      expect(o.contract.terms.wage).toBeGreaterThanOrEqual(3000)
      const c = clubs.find((x) => x.clubId === o.clubId)!
      expect(heroOvr(h)).toBeGreaterThanOrEqual(c.squadAvgOvr - 2)
    }
  })

  it('veterans and established starters do not get loan offers', () => {
    const h = hero(5)
    h.contract = { clubId: 'c9', wage: 3000, untilSeason: SEASON + 2, signingBonus: 0, goalBonus: 0, assistBonus: 0, releaseClause: null, role: 'starter' }
    h.managerTrust = 70
    expect(generateLoanOffers(new Rng(3), h, clubs, { window: 'summer', season: SEASON })).toEqual([])
    h.contract.role = 'reserve'
    h.birthYear = 1995
    expect(generateLoanOffers(new Rng(3), h, clubs, { window: 'summer', season: SEASON })).toEqual([])
  })

  it('free agents always get at least one offer, contracted players none', () => {
    for (let s = 0; s < 20; s++) {
      const h = hero(0)
      h.contract = null
      const offers = freeAgentOffers(new Rng(s), h, clubs, { season: SEASON })
      expect(offers.length).toBeGreaterThan(0)
      for (const o of offers) { expect(o.fee).toBe(0); expect(o.contract.kind).toBe('freeAgent') }
    }
    const h = hero(0)
    h.contract = { clubId: 'c1', wage: 500, untilSeason: SEASON, signingBonus: 0, goalBonus: 0, assistBonus: 0, releaseClause: null, role: 'youth' }
    expect(freeAgentOffers(new Rng(1), h, clubs, { season: SEASON })).toEqual([])
    h.contract.untilSeason = SEASON - 1 // expired
    expect(freeAgentOffers(new Rng(1), h, clubs, { season: SEASON }).length).toBeGreaterThan(0)
  })

  it('accepting a transfer signs, resets trust & manager, cools fans, makes news', () => {
    const h = hero(20)
    h.contract = { clubId: 'c3', wage: 2000, untilSeason: SEASON + 2, signingBonus: 0, goalBonus: 0, assistBonus: 0, releaseClause: null, role: 'starter' }
    const life = createLife(new Rng(1), h, 'street')
    life.relationships.fans.value = 60
    life.relationships.manager = { id: 'manager', kind: 'manager', name: 'Old Boss', value: 50, memory: [], lastContactWeek: 0 }
    life.flags[TRANSFER_REQUEST_FLAG] = 3
    const offers = freeAgentOffers(new Rng(1), { ...h, contract: null }, clubs, { season: SEASON })
    const offer = { ...offers[0], fee: 4_000_000 }
    const rep = h.reputation
    const lines = acceptTransfer(new Rng(1), h, life, offer, cal, { managerName: 'Yeni Hoca' })
    expect(h.contract?.clubId).toBe(offer.clubId)
    expect(h.managerTrust).toBe(ARRIVAL_TRUST[offer.contract.terms.role])
    expect(life.relationships.manager.name).toBe('Yeni Hoca')
    expect(life.relationships.manager.value).toBe(0)
    expect(life.relationships.fans.value).toBe(12)
    expect(life.flags[TRANSFER_REQUEST_FLAG]).toBeUndefined()
    expect(life.news.length).toBe(1)
    expect(h.reputation).toBeGreaterThan(rep)
    expect(lines.length).toBeGreaterThan(0)
  })

  it('a loan stashes and restores the parent contract', () => {
    const h = hero(5)
    const parent = { clubId: 'c9', wage: 3000, untilSeason: SEASON + 2, signingBonus: 0, goalBonus: 0, assistBonus: 0, releaseClause: null, role: 'reserve' as const }
    h.contract = { ...parent }
    const life = createLife(new Rng(1), h, 'street')
    const [loan] = generateLoanOffers(new Rng(3), h, clubs, { window: 'summer', season: SEASON, currentClub: { clubId: 'c9', name: 'Club 9', reputation: 79 } })
    acceptTransfer(new Rng(2), h, life, loan, cal)
    expect(h.contract?.loan).toBe(true)
    endLoan(h, life, { ...cal, season: SEASON + 1 })
    expect(h.contract).toEqual(parent)
  })
})
