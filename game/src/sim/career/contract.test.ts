import { Rng } from '../../core/rng'
import type { Hero } from '../../core/types'
import { createHero, createLife, type HeroInput } from './createHero'
import {
  acceptOffer, applyContract, clubStarWage, counterOffer, evaluateOffer, fairWage, generateContractOffer,
  heroMarketValue, rejectOffer, renewalOffer, startNegotiation, toContract, type ClubContext, type NegotiationState,
} from './contract'

const input: HeroInput = {
  firstName: 'Arda', lastName: 'Yıldız', nickname: 'Arda', nationality: 'TR', position: 'ST', foot: 'R',
  appearance: { skin: 0, hairStyle: 0, hairColor: 0, beard: 0, eyeColor: 0, face: 0, accessory: 0 },
  archetype: 'poacher', background: 'academy', birthYear: 2009,
}
const SEASON = 2026

function hero(seed = 1, boost = 0): Hero {
  const h = createHero(new Rng(seed), input)
  for (const k of Object.keys(h.attrs) as (keyof Hero['attrs'])[]) h.attrs[k] = Math.min(99, h.attrs[k] + boost)
  return h
}
const small: ClubContext = { clubId: 'small', clubName: 'Küçükköy SK', reputation: 20, squadAvgOvr: 55 }
const big: ClubContext = { clubId: 'big', clubName: 'Metropol FC', reputation: 92, squadAvgOvr: 80 }

describe('contract offers', () => {
  it('youth at a small club earns a few hundred, star at a top club hundreds of thousands', () => {
    const youth = generateContractOffer(new Rng(3), hero(), { club: small, season: SEASON })
    expect(youth.terms.wage).toBeGreaterThanOrEqual(300)
    expect(youth.terms.wage).toBeLessThan(1500)
    const star = hero(1, 40)
    star.birthYear = 1999
    star.reputation = 80
    const top = generateContractOffer(new Rng(3), star, { club: big, season: SEASON })
    expect(top.terms.wage).toBeGreaterThan(150_000)
    expect(top.terms.wage).toBeLessThanOrEqual(clubStarWage(92) * 1.3 * 1.2)
  })

  it('bigger club and better hero both mean more money', () => {
    const h = hero()
    const mid: ClubContext = { ...small, clubId: 'mid', reputation: 55 }
    expect(fairWage(h, mid, SEASON)).toBeGreaterThan(fairWage(h, small, SEASON))
    expect(fairWage(hero(1, 15), small, SEASON)).toBeGreaterThan(fairWage(h, small, SEASON))
    expect(heroMarketValue(hero(1, 15), SEASON)).toBeGreaterThan(heroMarketValue(h, SEASON))
  })

  it('respects the wage budget cap and produces sane fields', () => {
    const h = hero(1, 30)
    const o = generateContractOffer(new Rng(9), h, { club: { ...small, wageBudget: 10_000 }, season: SEASON })
    expect(o.terms.wage).toBeLessThanOrEqual(3_000 * 1.15 + 50)
    expect(o.terms.years).toBeGreaterThanOrEqual(1)
    expect(o.terms.years).toBeLessThanOrEqual(5)
    const c = toContract(o)
    expect(c.untilSeason).toBe(SEASON + o.terms.years - 1)
  })

  it('loan offers are one season with the loan flag', () => {
    const o = generateContractOffer(new Rng(2), hero(), { club: small, season: SEASON, kind: 'loan' })
    expect(o.loan).toBe(true)
    expect(o.terms.years).toBe(1)
    expect(toContract(o).loan).toBe(true)
  })

  it('evaluateOffer prefers generous offers', () => {
    const h = hero()
    const o = generateContractOffer(new Rng(4), h, { club: small, season: SEASON })
    const rich = { ...o, terms: { ...o.terms, wage: o.terms.wage * 2 } }
    const poor = { ...o, terms: { ...o.terms, wage: Math.round(o.terms.wage * 0.5) } }
    const e = (x: typeof o) => evaluateOffer(x, h, { club: small, season: SEASON }).score
    expect(e(rich)).toBeGreaterThan(e(o))
    expect(e(o)).toBeGreaterThan(e(poor))
    expect(evaluateOffer(o, h, { club: small, season: SEASON }).reasons.length).toBeGreaterThan(0)
  })
})

describe('negotiation', () => {
  const setup = (seed: number, agentQ = 1, perks: string[] = []) => {
    const h = hero()
    h.perks.push(...perks)
    const rng = new Rng(seed)
    const offer = generateContractOffer(rng, h, { club: small, season: SEASON })
    const agent = { name: 'X', quality: agentQ, commission: 0.08 }
    return { h, rng, offer, state: startNegotiation(rng, offer, h, { agent, season: SEASON }) }
  }

  it('asking for less than offered is accepted instantly', () => {
    const { rng, state } = setup(1)
    const r = counterOffer(rng, state, { wage: state.offer.terms.wage - 50 })
    expect(r.state.status).toBe('agreed')
    expect(r.state.offer.terms.wage).toBe(state.offer.terms.wage - 50)
    expect(r.state.round).toBe(1)
  })

  it('an absurd ask makes the club walk away immediately', () => {
    const { rng, state } = setup(2)
    const r = counterOffer(rng, state, { wage: state.offer.terms.wage * 3 })
    expect(r.state.status).toBe('walkedAway')
    expect(r.state.patience).toBe(0)
    // Further actions are no-ops.
    expect(counterOffer(rng, r.state, { wage: 1 }).state.status).toBe('walkedAway')
    expect(acceptOffer(r.state).state.status).toBe('walkedAway')
  })

  it('reasonable asks converge to a deal within the round limit', () => {
    let agreed = 0
    for (let seed = 0; seed < 100; seed++) {
      const { rng, state, offer } = setup(seed)
      let s: NegotiationState = state
      const ask = { wage: Math.round(offer.terms.wage * 1.08) }
      while (s.status === 'open') s = counterOffer(rng, s, ask).state
      if (s.status === 'agreed') agreed++
      expect(s.round).toBeLessThanOrEqual(6)
    }
    expect(agreed).toBeGreaterThanOrEqual(90)
  })

  it('agent quality and the negotiator perk soften patience loss', () => {
    const plain = setup(5, 1)
    const pro = setup(5, 5, ['negotiator'])
    expect(pro.state.hidden.maxWage).toBeGreaterThan(plain.state.hidden.maxWage)
    expect(pro.state.drainDivisor).toBeGreaterThan(plain.state.drainDivisor)
    // Same relative over-ask beyond each one's hidden max.
    const a = counterOffer(plain.rng, plain.state, { wage: Math.round(plain.state.hidden.maxWage * 1.2) })
    const b = counterOffer(pro.rng, pro.state, { wage: Math.round(pro.state.hidden.maxWage * 1.2) })
    expect(pro.state.patience - b.state.patience).toBeLessThan(plain.state.patience - a.state.patience)
  })

  it('club concessions never exceed hidden limits', () => {
    const { rng, state } = setup(7)
    const r = counterOffer(rng, state, { wage: Math.round(state.hidden.maxWage * 1.1) })
    if (r.state.status === 'open') expect(r.state.offer.terms.wage).toBeLessThanOrEqual(state.hidden.maxWage)
  })

  it('after max rounds the offer becomes final and can still be accepted', () => {
    const { rng, state } = setup(11)
    let s: NegotiationState = { ...state, patience: 100, drainDivisor: 1000 } // infinitely patient club
    const ask = { wage: Math.round(state.hidden.maxWage * 1.05) }
    while (s.status === 'open') s = counterOffer(rng, s, ask).state
    expect(s.status).toBe('expired')
    expect(acceptOffer(s).state.status).toBe('agreed')
  })

  it('is deterministic for the same seed', () => {
    const run = () => {
      const { rng, state, offer } = setup(42)
      let s = state
      const ask = { wage: Math.round(offer.terms.wage * 1.18), signingBonus: offer.terms.signingBonus * 2 }
      while (s.status === 'open') s = counterOffer(rng, s, ask).state
      return JSON.stringify(s)
    }
    expect(run()).toBe(run())
  })

  it('rejecting ends talks', () => {
    const { state } = setup(3)
    expect(rejectOffer(state).state.status).toBe('rejected')
  })

  it('asking to remove a release clause or an out-of-range length drains patience', () => {
    const { rng, state } = setup(13)
    const r = counterOffer(rng, state, { years: 9 })
    expect(r.state.patience).toBeLessThan(state.patience)
  })
})

describe('renewal & signing', () => {
  it('offers a raise to a trusted player whose deal expires', () => {
    const h = hero()
    h.contract = { clubId: 'small', wage: 400, untilSeason: SEASON, signingBonus: 0, goalBonus: 0, assistBonus: 0, releaseClause: null, role: 'reserve' }
    h.managerTrust = 60
    const r = renewalOffer(new Rng(1), h, { club: small, season: SEASON })
    expect(r.offer).not.toBeNull()
    expect(r.offer!.terms.wage).toBeGreaterThanOrEqual(420)
    expect(r.offer!.startSeason).toBe(SEASON + 1)
  })

  it('does not renew an untrusted player, nor a long, fair deal', () => {
    const h = hero()
    h.contract = { clubId: 'small', wage: 400, untilSeason: SEASON, signingBonus: 0, goalBonus: 0, assistBonus: 0, releaseClause: null, role: 'reserve' }
    h.managerTrust = 10
    expect(renewalOffer(new Rng(1), h, { club: small, season: SEASON }).offer).toBeNull()
    h.managerTrust = 60
    h.contract.untilSeason = SEASON + 4
    h.contract.wage = fairWage(h, small, SEASON)
    expect(renewalOffer(new Rng(1), h, { club: small, season: SEASON }).offer).toBeNull()
  })

  it('applyContract sets the contract and pays the bonus minus commission', () => {
    const h = hero()
    const life = createLife(new Rng(1), h, 'academy')
    life.agent = { name: 'Ajan', quality: 3, commission: 0.1 }
    const money = life.money
    const o = generateContractOffer(new Rng(5), h, { club: small, season: SEASON, kind: 'freeAgent' })
    const lines = applyContract(h, life, o, { season: SEASON, week: 0, day: 0, slot: 0 })
    expect(h.contract?.clubId).toBe('small')
    expect(life.money).toBe(money + o.terms.signingBonus - Math.round(o.terms.signingBonus * 0.1))
    expect(lines.length).toBeGreaterThan(0)
    expect(lines[0]!.tr.length).toBeGreaterThan(0)
  })
})
