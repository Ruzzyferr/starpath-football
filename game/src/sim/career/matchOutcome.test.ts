import { Rng } from '../../core/rng'
import { applyMatchToHero, formTarget, type HeroMatchInput } from './matchOutcome'
import { findNonFinite, makeState } from './testFixtures'
import { ensureRelation, ensureTeammates, teammateId } from '../life/relationships'

const base: HeroMatchInput = { rating: 6.5, goals: 0, assists: 0, minutes: 90, started: true, won: false, drew: true, importance: 0.4 }

function state() {
  const s = makeState()
  s.hero.contract = { clubId: 'c1', wage: 1000, untilSeason: 2028, signingBonus: 0, goalBonus: 500, assistBonus: 250, releaseClause: null, role: 'starter' }
  ensureRelation(s.life, 'manager', 'manager', 'Hoca', 10)
  ensureTeammates(s.life, [{ npcId: 'p1', name: 'Arda' }, { npcId: 'p2', name: 'Can' }])
  return s
}

describe('applyMatchToHero', () => {
  it('updates stats and pays goal/assist bonuses', () => {
    const s = state()
    const m0 = s.life.money
    const r = applyMatchToHero(s, { ...base, rating: 8.2, goals: 2, assists: 1, won: true, drew: false, shots: 5, shotsOnTarget: 3 })
    expect(s.hero.seasonStats.apps).toBe(1)
    expect(s.hero.seasonStats.goals).toBe(2)
    expect(s.hero.careerStats.assists).toBe(1)
    expect(s.hero.seasonStats.ratingSum).toBeCloseTo(8.2)
    expect(r.bonusPaid).toBe(1250)
    expect(s.life.money).toBe(m0 + 1250)
  })

  it('great games raise form, morale, reputation, followers, fans and trust', () => {
    const s = state()
    const before = { form: s.hero.form, morale: s.hero.morale, rep: s.hero.reputation, f: s.life.followers, fans: s.life.relationships.fans.value, trust: s.hero.managerTrust }
    const r = applyMatchToHero(s, { ...base, rating: 9, goals: 3, won: true, drew: false, motm: true, importance: 0.8 })
    expect(s.hero.form).toBeGreaterThan(before.form)
    expect(s.hero.morale).toBeGreaterThan(before.morale)
    expect(s.hero.reputation).toBeGreaterThan(before.rep)
    expect(s.life.followers).toBeGreaterThan(before.f)
    expect(s.life.relationships.fans.value).toBeGreaterThan(before.fans)
    expect(s.hero.managerTrust).toBeGreaterThan(before.trust)
    expect(r.headlines.length).toBe(1)
    expect(r.headlines[0].sentiment).toBe(1)
    expect(s.life.news.length).toBe(1)
  })

  it('awful games and red cards hurt and suspend', () => {
    const s = state()
    const rep = s.hero.reputation = 30
    const r = applyMatchToHero(s, { ...base, rating: 3.8, red: true })
    expect(s.hero.suspendedMatches).toBe(1)
    expect(s.hero.reputation).toBeLessThan(rep)
    expect(r.headlines[0].sentiment).toBe(-1)
    expect(s.hero.seasonStats.red).toBe(1)
  })

  it('adds fatigue and sharpness; away trips tire more', () => {
    const a = state(); const b = state()
    a.hero.fatigue = b.hero.fatigue = 10
    applyMatchToHero(a, base)
    applyMatchToHero(b, { ...base, isAway: true })
    expect(a.hero.fatigue).toBeGreaterThan(30)
    expect(b.hero.fatigue).toBeGreaterThan(a.hero.fatigue)
    expect(a.hero.sharpness).toBeGreaterThan(60)
  })

  it('assist links strengthen teammate relationships', () => {
    const s = state()
    const v = s.life.relationships[teammateId('p1')].value
    applyMatchToHero(s, { ...base, goals: 1, assistedBy: ['p1'] })
    expect(s.life.relationships[teammateId('p1')].value).toBeGreaterThan(v)
    expect(s.life.relationships[teammateId('p1')].memory.length).toBe(1)
  })

  it('unused substitute only counts nothing but morale drift', () => {
    const s = state()
    const r = applyMatchToHero(s, { ...base, minutes: 0, started: false })
    expect(s.hero.seasonStats.apps).toBe(0)
    expect(r.headlines.length).toBe(0)
  })

  it('in-match injury applies an injury', () => {
    const s = state()
    applyMatchToHero(s, { ...base, injured: true }, new Rng(4))
    expect(s.hero.injury).not.toBeNull()
  })

  it('advances state.rng when no rng is passed (determinism)', () => {
    const a = state(); const b = state()
    applyMatchToHero(a, { ...base, rating: 9, goals: 3 })
    applyMatchToHero(b, { ...base, rating: 9, goals: 3 })
    expect(a.rng).toEqual(b.rng)
    expect(a.life.news[0].headline).toEqual(b.life.news[0].headline)
    expect(a.rng).not.toEqual(makeState().rng)
  })

  it('produces ≥10 distinct headline templates across situations', () => {
    const scenarios: Partial<HeroMatchInput>[] = [
      { rating: 9.5, goals: 3, won: true }, { rating: 8.5, goals: 2, won: true }, { rating: 7.5, goals: 1, won: true, importance: 0.9 },
      { rating: 8, assists: 2 }, { rating: 8.5 }, { rating: 4 }, { rating: 5, red: true }, { rating: 5, ownGoal: true },
      { rating: 5.5, missedPenalty: true }, { rating: 7, goals: 1, won: false, drew: false },
    ]
    const seen = new Set<string>()
    for (let seed = 0; seed < 30; seed++) {
      for (const sc of scenarios) {
        const s = state()
        const r = applyMatchToHero(s, { ...base, drew: false, ...sc }, new Rng(seed))
        for (const h of r.headlines) {
          seen.add(h.headline.en.replace(/Deniz Kaya/g, '{name}'))
          expect(h.headline.tr).not.toMatch(/\{\w+\}/)
        }
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(10)
  })

  it('never produces NaN even with garbage input', () => {
    const s = state()
    applyMatchToHero(s, { ...base, rating: Number.NaN, minutes: 200, goals: -3, importance: 7 })
    expect(findNonFinite(s.hero)).toEqual([])
    expect(findNonFinite(s.life)).toEqual([])
  })

  it('form target maps ratings to 0..100', () => {
    expect(formTarget(4)).toBe(0)
    expect(formTarget(6.5)).toBe(50)
    expect(formTarget(9)).toBe(100)
  })
})
