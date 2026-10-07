import { Rng } from '../../core/rng'
import { ASSETS } from '../../data/assets'
import { INTENSITY, TRAINING_TYPES, qualityFactor, runTraining, trainingEnergyCost, trainingInjuryChance } from './training'
import { makeHeroLife } from './testFixtures'

const sumXp = (xp: Partial<Record<string, number>>): number => Object.values(xp).reduce<number>((a, b) => a + (b ?? 0), 0)

describe('training', () => {
  it('performance scales XP (mini-game skill matters)', () => {
    expect(qualityFactor(1)).toBeGreaterThan(qualityFactor(0.6))
    expect(qualityFactor(0.6)).toBeCloseTo(1.02, 2)
    const a = makeHeroLife()
    const b = makeHeroLife()
    const ra = runTraining(a.rng, a.hero, a.life, { type: 'shooting', performance: 1, season: 2026 })
    const rb = runTraining(b.rng, b.hero, b.life, { type: 'shooting', performance: 0.2, season: 2026 })
    expect(sumXp(ra.xp)).toBeGreaterThan(sumXp(rb.xp) * 2)
  })

  it('spends energy, adds fatigue, and refuses when exhausted or injured', () => {
    const { rng, hero, life } = makeHeroLife()
    const f0 = hero.fatigue
    const r = runTraining(rng, hero, life, { type: 'physical', season: 2026 })
    expect(r.ok).toBe(true)
    expect(life.energy).toBe(100 - trainingEnergyCost('physical'))
    expect(hero.fatigue).toBeGreaterThan(f0)
    life.energy = 5
    expect(runTraining(rng, hero, life, { type: 'physical', season: 2026 }).ok).toBe(false)
    life.energy = 100
    hero.injury = { name: { tr: 'x', en: 'x' }, weeksLeft: 2, severity: 1 }
    expect(runTraining(rng, hero, life, { type: 'shooting', season: 2026 }).ok).toBe(false)
    expect(runTraining(rng, hero, life, { type: 'recovery', season: 2026 }).ok).toBe(true)
  })

  it('recovery sessions reduce fatigue and stress', () => {
    const { rng, hero, life } = makeHeroLife()
    hero.fatigue = 60
    life.stress = 50
    runTraining(rng, hero, life, { type: 'recovery', season: 2026 })
    expect(hero.fatigue).toBeLessThan(60)
    expect(life.stress).toBeLessThan(50)
  })

  it('injury risk rises with fatigue and intensity', () => {
    const { hero, life } = makeHeroLife()
    hero.fatigue = 0
    const fresh = trainingInjuryChance(hero, life, 'physical')
    hero.fatigue = 90
    const tired = trainingInjuryChance(hero, life, 'physical')
    expect(tired).toBeGreaterThan(fresh * 2)
    expect(trainingInjuryChance(hero, life, 'physical', 'hard')).toBeGreaterThan(tired)
    expect(INTENSITY.hard.xp).toBeGreaterThan(1)
  })

  it('empirical injury rate over many sessions matches the tuning target', () => {
    let injuries = 0
    const N = 4000
    for (let i = 0; i < N; i++) {
      const { hero, life } = makeHeroLife({ seed: 1 })
      hero.fatigue = 20
      if (runTraining(new Rng(i + 100), hero, life, { type: 'physical', season: 2026 }).injured) injuries++
    }
    // ~0.8% × ~1.6 proneness at fatigue ~34 → ≈1.3%
    expect(injuries / N).toBeGreaterThan(0.005)
    expect(injuries / N).toBeLessThan(0.03)
  })

  it('a hired trainer boosts XP in his group', () => {
    const a = makeHeroLife()
    const b = makeHeroLife()
    b.life.trainer = { name: 'Hoca', group: 'technical', weeklyFee: 1000 }
    const ra = runTraining(a.rng, a.hero, a.life, { type: 'shooting', season: 2026 })
    const rb = runTraining(b.rng, b.hero, b.life, { type: 'shooting', season: 2026 })
    expect(rb.xp.shooting ?? 0).toBeCloseTo((ra.xp.shooting ?? 0) * 1.25, 5)
    expect(rb.xp.composure ?? 0).toBeCloseTo(ra.xp.composure ?? 0, 5) // mental: no bonus
  })

  it('xp_bonus facilities boost XP', () => {
    const facility = ASSETS.find((x) => x.effect?.key === 'xp_bonus')
    if (!facility) return
    const a = makeHeroLife()
    const b = makeHeroLife()
    b.life.assets.push({ defId: facility.id, boughtSeason: 2026, boughtWeek: 0, pricePaid: facility.price })
    const ra = runTraining(a.rng, a.hero, a.life, { type: 'passing', season: 2026 })
    const rb = runTraining(b.rng, b.hero, b.life, { type: 'passing', season: 2026 })
    expect(sumXp(rb.xp)).toBeGreaterThan(sumXp(ra.xp))
  })

  it('every training type has sane numbers and bilingual names', () => {
    for (const def of Object.values(TRAINING_TYPES)) {
      expect(def.name.tr.length).toBeGreaterThan(0)
      expect(def.name.en.length).toBeGreaterThan(0)
      expect(def.energy).toBeGreaterThan(0)
      expect(def.injuryRisk).toBeLessThan(0.02)
    }
  })
})
