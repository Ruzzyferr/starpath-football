import { makeHeroLife } from '../career/testFixtures'
import {
  BURNOUT_WEEKS, addStress, energyCap, happinessTarget, injuryProneness, isBurnedOut, mentalMatchModifier,
  weeklyWellbeing,
} from './wellbeing'

describe('wellbeing', () => {
  it('meters converge toward targets and stay in range', () => {
    const { hero, life } = makeHeroLife()
    life.happiness = 5
    life.stress = 95
    for (let w = 0; w < 30; w++) weeklyWellbeing(life, hero)
    expect(life.happiness).toBeGreaterThan(40)
    expect(life.stress).toBeLessThan(45)
    for (const v of [life.happiness, life.stress, life.health]) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(100)
    }
  })

  it('burnout triggers after sustained stress and lifts after recovery', () => {
    const { hero, life } = makeHeroLife()
    life.casino.addiction = 100
    life.money = -5000
    hero.managerTrust = 0
    for (let w = 0; w < BURNOUT_WEEKS + 2 && !isBurnedOut(life); w++) {
      life.stress = 95
      weeklyWellbeing(life, hero)
    }
    expect(isBurnedOut(life)).toBe(true)
    expect(energyCap(life)).toBeLessThan(100)
    life.casino.addiction = 0
    life.money = 1000
    hero.managerTrust = 60
    for (let w = 0; w < 20; w++) weeklyWellbeing(life, hero, { offSeason: true })
    expect(isBurnedOut(life)).toBe(false)
  })

  it('stress perks soften stress gains', () => {
    const a = makeHeroLife()
    const b = makeHeroLife()
    b.hero.perks.push('cool_head')
    a.life.stress = b.life.stress = 20
    addStress(a.life, a.hero, 20)
    addStress(b.life, b.hero, 20)
    expect(b.life.stress).toBeLessThan(a.life.stress)
  })

  it('mental match modifier is bounded and ordered', () => {
    const { life } = makeHeroLife()
    life.happiness = 100; life.stress = 0
    const best = mentalMatchModifier(life)
    life.happiness = 0; life.stress = 100; life.flags.burnout = true
    const worst = mentalMatchModifier(life)
    expect(best).toBeLessThanOrEqual(1.12)
    expect(worst).toBeGreaterThanOrEqual(0.75)
    expect(best).toBeGreaterThan(1)
    expect(worst).toBeLessThan(1)
  })

  it('injury proneness increases with fatigue and is cut by perks', () => {
    const { hero, life } = makeHeroLife()
    hero.fatigue = 0
    const fresh = injuryProneness(life, hero)
    hero.fatigue = 100
    const tired = injuryProneness(life, hero)
    expect(tired).toBeGreaterThan(fresh)
    hero.perks.push('iron_body')
    expect(injuryProneness(life, hero)).toBeLessThan(tired)
  })

  it('injuries and debt lower the happiness target', () => {
    const { hero, life } = makeHeroLife()
    const base = happinessTarget(life, hero)
    hero.injury = { name: { tr: 'x', en: 'x' }, weeksLeft: 4, severity: 2 }
    life.money = -100
    expect(happinessTarget(life, hero)).toBeLessThan(base - 10)
  })
})
