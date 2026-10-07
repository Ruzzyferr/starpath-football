import { describe, expect, it } from 'vitest'
import { Rng } from '../../core/rng'
import type { NpcPlayer } from '../../core/types'
import { makeHeroLife } from './testFixtures'
import { DECAY_GRACE_WEEKS, weeklySkillDecay, weeksUntilDecay } from './decay'
import { weeklyInjuryTick } from './condition'
import { potentialView, scoutConfidence } from './scouting'
import { marketReference } from './market'
import { FORM_GUARANTEE_START, ROLE_EXPECTED_MINUTES, formGuaranteeActive, pushRecentRating, recentRatings, startProbability } from './squadRole'
import { counterOffer, generateContractOffer, startNegotiation, toContract } from './contract'

describe('skill decay', () => {
  it('warns a week before decay, then decays physical attributes while inactive', () => {
    const { hero } = makeHeroLife({ age: 24 })
    hero.sharpness = 10
    const before = { ...hero.attrs }
    const lines: string[] = []
    for (let w = 0; w < DECAY_GRACE_WEEKS - 1; w++) lines.push(...weeklySkillDecay(hero).map((l) => l.en))
    expect(lines.some((l) => l.includes('7 days'))).toBe(true)
    expect(hero.attrs).toEqual(before)
    expect(weeksUntilDecay(hero)).toBe(1)
    for (let w = 0; w < 4; w++) weeklySkillDecay(hero)
    const lost = (Object.keys(before) as (keyof typeof before)[]).reduce((s, k) => s + before[k] - hero.attrs[k], 0)
    expect(lost).toBeGreaterThanOrEqual(3)
  })

  it('an active week resets the counter', () => {
    const { hero } = makeHeroLife()
    hero.sharpness = 10
    weeklySkillDecay(hero)
    hero.sharpness = 70
    weeklySkillDecay(hero)
    expect(hero.inactiveWeeks).toBe(0)
  })

  it('long injuries count as inactive and run from the weekly injury tick', () => {
    const { hero } = makeHeroLife()
    hero.sharpness = 80
    hero.injury = { name: { tr: 'x', en: 'x' }, weeksLeft: 20, severity: 3 }
    for (let i = 0; i < 3; i++) weeklyInjuryTick(hero)
    expect(hero.inactiveWeeks).toBe(3)
  })
})

describe('potential stars', () => {
  it('band narrows with a track record', () => {
    const { hero } = makeHeroLife({ age: 17 })
    const young = potentialView(hero, 2026)
    hero.careerStats.apps = 300
    hero.reputation = 60
    const vet = potentialView(hero, 2034)
    expect(scoutConfidence(hero, 2034)).toBeGreaterThan(scoutConfidence({ ...hero, careerStats: { ...hero.careerStats, apps: 0 }, reputation: 0 }, 2026))
    expect(vet.high - vet.low).toBeLessThan(young.high - young.low)
    expect(young.low).toBeLessThanOrEqual(young.stars)
    expect(young.high).toBeGreaterThanOrEqual(young.stars)
  })
  it('is deterministic per season', () => {
    const { hero } = makeHeroLife()
    expect(potentialView(hero, 2027)).toEqual(potentialView(hero, 2027))
  })
})

describe('market reference', () => {
  it('picks 5 similar players and rates the offer', () => {
    const { hero } = makeHeroLife({ age: 22 })
    const players: Record<string, NpcPlayer> = {}
    for (let i = 0; i < 40; i++) {
      players[`p${i}`] = {
        id: `p${i}`, firstName: 'A', lastName: `B${i}`, nationality: 'TR', birthYear: 2026 - 18 - (i % 15), position: i % 2 ? 'ST' : 'CB',
        foot: 'R', ovr: 40 + i, potential: 80, styleSeed: 1, clubId: 'c1', value: 1, wage: 1000 + i * 100, contractUntil: 2028,
        morale: 50, form: 50, personality: 'quiet', appearance: hero.appearance, injuredWeeks: 0, stats: hero.seasonStats,
      }
    }
    const m = marketReference({ countries: {}, leagues: {}, clubs: {}, players, competitions: {}, honours: [] }, hero, 2026, 3000)
    expect(m.samples).toHaveLength(5)
    expect(m.min).toBeLessThanOrEqual(m.median)
    expect(m.max).toBeGreaterThanOrEqual(m.median)
    expect(m.pctOfMarket).toBe(Math.round((3000 / m.median) * 100))
  })
})

describe('form guarantee clause', () => {
  it('guarantees a start after 3 matches averaging 7.5+', () => {
    const { hero, life } = makeHeroLife()
    hero.contract = { clubId: 'c', wage: 1, untilSeason: 2030, signingBonus: 0, goalBonus: 0, assistBonus: 0, releaseClause: null, role: 'reserve', formGuarantee: true }
    const base = startProbability(hero, life)
    for (const r of [7.2, 7.8, 8.0]) pushRecentRating(life, r)
    expect(recentRatings(life)).toEqual([7.2, 7.8, 8])
    expect(formGuaranteeActive(hero, life)).toBe(true)
    expect(startProbability(hero, life)).toBeGreaterThanOrEqual(FORM_GUARANTEE_START - 1e-9)
    expect(base).toBeLessThan(0.5)
    pushRecentRating(life, 5)
    expect(formGuaranteeActive(hero, life)).toBe(false)
  })

  it('is negotiable and carried into the contract', () => {
    const rng = new Rng(3)
    const { hero } = makeHeroLife({ age: 24 })
    const offer = generateContractOffer(rng, hero, { club: { clubId: 'c', clubName: 'C', reputation: 30, squadAvgOvr: 40 }, season: 2026 })
    offer.terms.role = 'starter'
    const st = startNegotiation(rng, offer, hero, { season: 2026 })
    let res = counterOffer(rng, st, { formGuarantee: true })
    for (let i = 0; i < 5 && res.state.status === 'open' && !res.state.offer.terms.formGuarantee; i++) res = counterOffer(rng, res.state, { formGuarantee: true })
    expect(res.state.offer.terms.formGuarantee).toBe(true)
    expect(toContract(res.state.offer).formGuarantee).toBe(true)
  })

  it('every role has an expected-minutes range', () => {
    for (const [lo, hi] of Object.values(ROLE_EXPECTED_MINUTES)) expect(hi).toBeGreaterThanOrEqual(lo)
  })
})
