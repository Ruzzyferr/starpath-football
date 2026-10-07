import { Rng } from '../../core/rng'
import type { Calendar, Hero, Life } from '../../core/types'
import { createHero, createLife } from '../career/createHero'
import { followerCeiling, makePost, organicFollowerGrowth, weeklySocialTick, type PostType } from './social'

const APPEAR = { skin: 0, hairStyle: 0, hairColor: 0, beard: 0, eyeColor: 0, face: 0, accessory: 0 }
const cal: Calendar = { season: 2026, week: 1, day: 0, slot: 0 }

function setup(seed = 1, rep = 40): { rng: Rng; hero: Hero; life: Life } {
  const rng = new Rng(seed)
  const hero = createHero(rng, {
    firstName: 'A', lastName: 'B', nickname: 'AB', nationality: 'EN', position: 'LW', foot: 'L',
    appearance: APPEAR, archetype: 'winger', background: 'street', birthYear: 2009,
  })
  hero.reputation = rep
  return { rng, hero, life: createLife(rng, hero, 'street') }
}

describe('social', () => {
  it('ceiling grows exponentially with reputation', () => {
    expect(followerCeiling(0)).toBe(5000)
    expect(followerCeiling(50)).toBeGreaterThan(500_000)
    expect(followerCeiling(100)).toBeGreaterThan(100_000_000)
  })

  it('organic growth is monotone below the ceiling and saturates', () => {
    const { rng, hero, life } = setup(1, 50)
    const ceiling = followerCeiling(50)
    let prev = life.followers
    for (let w = 0; w < 600; w++) {
      weeklySocialTick(rng, hero, life, { calendar: cal, avgRating: 7 })
      expect(life.followers).toBeGreaterThanOrEqual(prev)
      prev = life.followers
    }
    expect(life.followers).toBeGreaterThan(ceiling * 0.8)
    expect(life.followers).toBeLessThanOrEqual(ceiling * 1.01)
    // Growth is small near the ceiling.
    expect(organicFollowerGrowth(hero, life, { avgRating: 7 })).toBeLessThan(ceiling * 0.01)
  })

  it('followers shrink above the ceiling', () => {
    const { hero, life } = setup(1, 10)
    life.followers = followerCeiling(10) * 3
    expect(organicFollowerGrowth(hero, life)).toBeLessThan(0)
  })

  it('perk boosts growth', () => {
    const a = setup(1, 30)
    const b = setup(1, 30)
    b.hero.perks.push('media_darling')
    expect(organicFollowerGrowth(b.hero, b.life)).toBeGreaterThan(organicFollowerGrowth(a.hero, a.life))
  })

  it('viral and controversy frequencies are in expected ranges', () => {
    const count = (type: PostType, n = 4000) => {
      let viral = 0
      let cont = 0
      const rng = new Rng(99)
      for (let i = 0; i < n; i++) {
        const { hero, life } = setup(1, 40)
        const r = makePost(rng, hero, life, type, { calendar: cal })
        if (r.viral) viral++
        if (r.controversy) cont++
        expect(Number.isFinite(life.followers)).toBe(true)
      }
      return { viral: viral / n, cont: cont / n }
    }
    const prov = count('provocation')
    expect(prov.cont).toBeGreaterThan(0.3)
    expect(prov.cont).toBeLessThan(0.4)
    expect(prov.viral).toBeGreaterThan(0.14) // 0.12 × 1.4
    expect(prov.viral).toBeLessThan(0.2)
    const fam = count('family')
    expect(fam.cont).toBeLessThan(0.02)
    expect(fam.viral).toBeGreaterThan(0.03)
    expect(fam.viral).toBeLessThan(0.06)
  })

  it('spamming posts in a week has diminishing reach', () => {
    const { rng, hero, life } = setup(3, 40)
    life.followers = 100000
    const gains: number[] = []
    for (let i = 0; i < 4; i++) {
      const r = makePost(rng, hero, life, 'training', { calendar: cal })
      if (!r.viral) gains.push(r.followersGained)
    }
    expect(gains[gains.length - 1]).toBeLessThan(gains[0])
  })

  it('controversy hurts press and discipline', () => {
    const rng = new Rng(5)
    for (let i = 0; i < 200; i++) {
      const { hero, life } = setup(1, 40)
      const d0 = life.discipline
      const r = makePost(rng, hero, life, 'provocation', { calendar: cal })
      if (r.controversy) {
        expect(life.discipline).toBeLessThan(d0)
        expect(life.relationships.press.value).toBeLessThan(0)
        expect(r.triggerTags).toContain('controversy')
        expect(life.news.length).toBeGreaterThan(0)
        return
      }
    }
    throw new Error('no controversy in 200 provocative posts')
  })
})
