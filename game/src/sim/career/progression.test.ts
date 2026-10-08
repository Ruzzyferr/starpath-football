import type { AttributeKey, Hero, Position } from '../../core/types'
import { ATTRIBUTE_KEYS } from '../../core/types'
import {
  POSITION_WEIGHTS, addAttributeXp, applyXpBundle, checkPerkUnlock, earnedPerkPoints, grantedPerkPoints, heroOvr,
  ovrFor, physicalDeclinePerSeason, weeklyAging, xpCostForNextPoint,
} from './progression'
import { runTraining, type TrainingType } from './training'
import { makeHeroLife } from './testFixtures'

/** Simulate a diligent career: 5 auto sessions + one 70-minute match per week, 44 weeks per season. */
function simulateCareer(seed: number, position: Position, plan: TrainingType[], performance = 0.6): { potential: number; byAge: Record<number, number> } {
  const role = position === 'GK' ? 'shotStopper' : position === 'CB' ? 'aerialDefender' : position === 'CM' ? 'playmaker' : 'runner'
  const { rng, hero, life } = makeHeroLife({ seed, position, role })
  const byAge: Record<number, number> = { 17: heroOvr(hero) }
  const w = POSITION_WEIGHTS[hero.position]
  const wsum = Object.values(w).reduce((a, b) => a + (b ?? 0), 0)
  for (let season = 2026; season < 2026 + 19; season++) {
    for (let week = 0; week < 44; week++) {
      for (let s = 0; s < 5; s++) {
        life.energy = 100
        hero.fatigue = 25
        hero.injury = null
        runTraining(rng, hero, life, { type: plan[(week * 5 + s) % plan.length]!, performance, season })
      }
      const bundle: Partial<Record<AttributeKey, number>> = {}
      for (const k in w) bundle[k as AttributeKey] = (16 * 0.8 * 1.28 * (w[k as AttributeKey] ?? 0)) / wsum
      applyXpBundle(hero, bundle, season)
      weeklyAging(hero, season)
    }
    byAge[season - hero.birthYear + 1] = heroOvr(hero)
  }
  return { potential: hero.potential, byAge }
}

describe('OVR formula', () => {
  it('weights are positive for every position and OVR is a weighted mean', () => {
    for (const pos of Object.keys(POSITION_WEIGHTS) as Position[]) {
      const attrs = Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, 70])) as Hero['attrs']
      expect(ovrFor(attrs, pos)).toBe(70)
      for (const v of Object.values(POSITION_WEIGHTS[pos])) expect(v).toBeGreaterThan(0)
    }
  })
  it('a striker’s OVR ignores goalkeeping', () => {
    const { hero } = makeHeroLife()
    const before = heroOvr(hero)
    hero.attrs.reflexes = 99
    expect(heroOvr(hero)).toBe(before)
    hero.attrs.finishing += 20
    expect(heroOvr(hero)).toBeGreaterThan(before)
  })
})

describe('XP economics', () => {
  it('cost rises with attribute level and near/over potential', () => {
    expect(xpCostForNextPoint(70, 60, 80)).toBeGreaterThan(xpCostForNextPoint(40, 60, 80))
    expect(xpCostForNextPoint(60, 75, 80)).toBeGreaterThan(xpCostForNextPoint(60, 60, 80))
    expect(xpCostForNextPoint(60, 85, 80)).toBeGreaterThan(xpCostForNextPoint(60, 80, 80))
  })
  it('stores fractional progress and gains points', () => {
    const { hero } = makeHeroLife()
    const start = hero.attrs.shooting
    expect(addAttributeXp(hero, 'shooting', 10, 2026)).toBe(0)
    expect(hero.attrXp.shooting).toBeGreaterThan(0)
    expect(hero.attrXp.shooting).toBeLessThan(1)
    const g = addAttributeXp(hero, 'shooting', 400, 2026)
    expect(g).toBeGreaterThan(0)
    expect(hero.attrs.shooting).toBe(start + g)
  })
  it('ignores NaN / negative XP', () => {
    const { hero } = makeHeroLife()
    expect(addAttributeXp(hero, 'pace', Number.NaN, 2026)).toBe(0)
    expect(addAttributeXp(hero, 'pace', -50, 2026)).toBe(0)
    expect(Number.isFinite(hero.attrXp.pace ?? 0)).toBe(true)
  })
  it('young players learn faster than veterans', () => {
    const a = makeHeroLife({ age: 18 }).hero
    const b = makeHeroLife({ age: 31 }).hero
    for (let i = 0; i < 20; i++) { addAttributeXp(a, 'passing', 30, 2026); addAttributeXp(b, 'passing', 30, 2026) }
    expect(a.attrs.passing - makeHeroLife({ age: 18 }).hero.attrs.passing).toBeGreaterThan(b.attrs.passing - makeHeroLife({ age: 31 }).hero.attrs.passing)
  })
})

describe('Perk points', () => {
  it('awards one point per 5 OVR above 40 and never double-awards', () => {
    expect(earnedPerkPoints(39)).toBe(0)
    expect(earnedPerkPoints(50)).toBe(2)
    expect(earnedPerkPoints(77)).toBe(7)
    const { hero } = makeHeroLife()
    const granted = grantedPerkPoints(hero)
    expect(granted).toBe(earnedPerkPoints(heroOvr(hero)))
    for (const k of ATTRIBUTE_KEYS) hero.attrs[k] += 10
    expect(checkPerkUnlock(hero).length).toBe(1)
    const after = grantedPerkPoints(hero)
    expect(after).toBe(earnedPerkPoints(heroOvr(hero)))
    for (const k of ATTRIBUTE_KEYS) hero.attrs[k] -= 10
    checkPerkUnlock(hero)
    for (const k of ATTRIBUTE_KEYS) hero.attrs[k] += 10
    expect(checkPerkUnlock(hero)).toEqual([])
    expect(grantedPerkPoints(hero)).toBe(after)
  })
})

describe('Ageing', () => {
  it('no physical decline before 30, accelerating after', () => {
    expect(physicalDeclinePerSeason(29)).toBe(0)
    expect(physicalDeclinePerSeason(32)).toBeGreaterThan(physicalDeclinePerSeason(30))
    expect(physicalDeclinePerSeason(40)).toBeLessThanOrEqual(9)
  })
  it('a 33-year-old loses pace over a season without training', () => {
    const { hero } = makeHeroLife({ age: 33 })
    hero.attrs.pace = 80
    for (let w = 0; w < 44; w++) weeklyAging(hero, 2026)
    expect(hero.attrs.pace).toBeLessThan(76)
    expect(hero.attrs.pace).toBeGreaterThan(65)
  })
  it('teenagers grow physically even without training', () => {
    const { hero } = makeHeroLife({ age: 17 })
    const before = hero.attrs.strength
    for (let w = 0; w < 44; w++) weeklyAging(hero, 2026)
    expect(hero.attrs.strength).toBeGreaterThan(before)
  })
})

describe('Career curve 17 → 35', () => {
  const cases: [number, Position, TrainingType[]][] = [
    [1, 'ST', ['shooting', 'shooting', 'dribbling', 'physical', 'tactical']],
    [2, 'CM', ['passing', 'passing', 'tactical', 'physical', 'dribbling']],
    [3, 'CB', ['tactical', 'physical', 'physical', 'passing', 'tactical']],
    [4, 'GK', ['goalkeeping', 'goalkeeping', 'goalkeeping', 'physical', 'tactical']],
  ]
  for (const [seed, pos, plan] of cases) {
    it(`${pos}: plausible growth, peak near potential, decline in the 30s`, () => {
      const { potential, byAge } = simulateCareer(seed, pos, plan)
      const peak = Math.max(...Object.values(byAge))
      expect(byAge[17]).toBeGreaterThanOrEqual(40)
      expect(byAge[17]).toBeLessThanOrEqual(60)
      // Fast growth phase: at least +3 OVR per season on average through 21.
      expect(byAge[21]! - byAge[17]!).toBeGreaterThanOrEqual(12)
      // Reaches the neighbourhood of potential by 25 with diligent training…
      expect(byAge[25]).toBeGreaterThanOrEqual(potential - 8)
      // …and potential is a soft ceiling.
      expect(peak).toBeLessThanOrEqual(potential + 5)
      // Peak lands in the 24–31 window and the 35-year-old is clearly past it.
      const peakAge = Number(Object.entries(byAge).find(([, v]) => v === peak)?.[0])
      expect(peakAge).toBeGreaterThanOrEqual(23)
      expect(peakAge).toBeLessThanOrEqual(32)
      expect(byAge[35]).toBeLessThanOrEqual(peak - 4)
      // Monotone-ish: never drops more than 1 OVR in a season before 30.
      for (let a = 18; a < 30; a++) expect(byAge[a]).toBeGreaterThanOrEqual(byAge[a - 1]! - 1)
    })
  }

  it('better mini-game performance yields a better career', () => {
    const plan: TrainingType[] = ['shooting', 'shooting', 'dribbling', 'physical', 'tactical']
    const good = simulateCareer(9, 'ST', plan, 0.95)
    const poor = simulateCareer(9, 'ST', plan, 0.2)
    expect(good.byAge[22]).toBeGreaterThan(poor.byAge[22]!)
  })
})
