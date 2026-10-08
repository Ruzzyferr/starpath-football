import { Rng } from '../../core/rng'
import { createHero, createLife } from '../career/createHero'
import { formTerm, pushRecentRating, ratingTerm, startProbability, trustTerm } from '../career/squadRole'
import { COUNTRY_TAX, INCOME_TAX, TRAINER_CONTRACT_WEEKS, incomeTaxRate, tickTrainerContract, weeklyEconomy } from './economy'
import { POST_TYPES, makePost } from './social'

const APPEARANCE = { skin: 0, hairStyle: 0, hairColor: 0, beard: 0, eyeColor: 0, face: 0, accessory: 0 }
function setup(seed = 1) {
  const rng = new Rng(seed)
  const hero = createHero(rng, {
    firstName: 'A', lastName: 'B', nickname: 'A', nationality: 'TR', position: 'ST', foot: 'R',
    appearance: APPEARANCE, archetype: 'poacher', background: 'street', birthYear: 2009,
  })
  return { rng, hero, life: createLife(rng, hero, 'street') }
}

describe('country tax (2.5#8)', () => {
  it('rates are 15-45% and average near the flat default', () => {
    const v = Object.values(COUNTRY_TAX)
    expect(Math.min(...v)).toBeGreaterThanOrEqual(0.15)
    expect(Math.max(...v)).toBeLessThanOrEqual(0.45)
    expect(Math.abs(v.reduce((a, b) => a + b, 0) / v.length - INCOME_TAX)).toBeLessThan(0.03)
    expect(incomeTaxRate('XX')).toBe(INCOME_TAX)
  })
  it('weeklyEconomy taxes at the given rate', () => {
    const { rng, hero, life } = setup()
    hero.contract = { clubId: 'c', wage: 10000, untilSeason: 2040, signingBonus: 0, goalBonus: 0, assistBonus: 0, releaseClause: null, role: 'starter' }
    life.sponsors = []
    const r = weeklyEconomy(rng, life, hero, { calendar: { season: 2026, week: 1, day: 0, slot: 0 }, taxRate: 0.2 })
    expect(r.breakdown.tax).toBe(-2000)
  })
})

describe('agent commission covers sponsors (2.5#10)', () => {
  it('charges wage + sponsor income', () => {
    const { rng, hero, life } = setup()
    hero.contract = { clubId: 'c', wage: 10000, untilSeason: 2040, signingBonus: 0, goalBonus: 0, assistBonus: 0, releaseClause: null, role: 'starter' }
    life.agent = { name: 'Ag', commission: 0.1, quality: 1 } as never
    life.sponsors = [{ id: 's', name: 'S', weekly: 2000, untilSeason: 2040 } as never]
    const r = weeklyEconomy(rng, life, hero, { calendar: { season: 2026, week: 1, day: 0, slot: 0 } })
    expect(r.breakdown.agentFee).toBe(-(r.breakdown.wage + r.breakdown.sponsors) * 0.1)
    expect(r.breakdown.sponsors).toBeGreaterThan(0)
  })
})

describe('trainer contract (2.5#11)', () => {
  it('warns 4 weeks before the end, then releases the trainer', () => {
    const { life } = setup()
    life.trainer = { name: 'Coach', group: 'technical', weeklyFee: 100, weeksLeft: TRAINER_CONTRACT_WEEKS }
    let warned = 0
    let ended = false
    for (let i = 0; i < TRAINER_CONTRACT_WEEKS; i++) {
      const l = tickTrainerContract(life)
      if (l.some((x) => x.en.includes('ends in 4'))) warned++
      if (l.some((x) => x.en.includes('has ended'))) ended = true
    }
    expect(warned).toBe(1)
    expect(ended).toBe(true)
    expect(life.trainer).toBeNull()
  })
  it('old saves without weeksLeft stay open-ended', () => {
    const { life } = setup()
    life.trainer = { name: 'Coach', group: 'technical', weeklyFee: 100 }
    tickTrainerContract(life)
    expect(life.trainer).not.toBeNull()
  })
})

describe('selection weights (2.4#46)', () => {
  it('form+rating swing is at least 60% (trust at most 25%)', () => {
    const { hero, life } = setup()
    hero.form = 100
    hero.managerTrust = 100
    ;[9, 9, 9].forEach((r) => pushRecentRating(life, r))
    const f = formTerm(hero) + ratingTerm(life)
    const t = trustTerm(hero)
    expect(t / (f + t)).toBeLessThanOrEqual(0.25)
    expect(f / (f + t)).toBeGreaterThanOrEqual(0.6)
  })
  it('good recent ratings raise the start chance', () => {
    const { hero, life } = setup()
    hero.contract = { clubId: 'c', wage: 1, untilSeason: 2040, signingBonus: 0, goalBonus: 0, assistBonus: 0, releaseClause: null, role: 'rotation' }
    hero.fatigue = 0
    hero.sharpness = 80
    const base = startProbability(hero, life)
    ;[8.5, 8.5, 8.5].forEach((r) => pushRecentRating(life, r))
    expect(startProbability(hero, life)).toBeGreaterThan(base)
  })
})

describe('new post types (2.4#70)', () => {
  it('thanks and rival exist and post without error', () => {
    expect(POST_TYPES.thanks.fans).toBeGreaterThan(POST_TYPES.training.fans)
    expect(POST_TYPES.rival.controversy).toBeGreaterThan(POST_TYPES.training.controversy)
    const { rng, hero, life } = setup()
    life.followers = 5000
    expect(() => makePost(rng, hero, life, 'rival', { calendar: { season: 2026, week: 1, day: 0, slot: 0 } })).not.toThrow()
  })
})
