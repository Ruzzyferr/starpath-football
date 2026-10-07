import type { Archetype, Background, Position } from '../../core/types'
import { ATTRIBUTE_KEYS } from '../../core/types'
import { Rng } from '../../core/rng'
import { BACKGROUNDS, createHero, createLife } from './createHero'
import { earnedPerkPoints, heroOvr } from './progression'
import { TEST_APPEARANCE } from './testFixtures'

const ARCH_POS: [Archetype, Position][] = [
  ['poacher', 'ST'], ['playmaker', 'AM'], ['winger', 'LW'], ['wall', 'CB'], ['boxToBox', 'CM'], ['keeper', 'GK'],
]
const BGS: Background[] = ['street', 'academy', 'footballFamily', 'lateBloomer']

const input = (archetype: Archetype, position: Position, background: Background, foot: 'L' | 'R' | 'B' = 'R') => ({
  firstName: 'Ece', lastName: 'Demir', nickname: 'Ece', nationality: 'TR', position, foot,
  appearance: TEST_APPEARANCE, archetype, background, birthYear: 2009,
})

describe('createHero', () => {
  it('is deterministic for a seed', () => {
    const a = createHero(new Rng(5), input('poacher', 'ST', 'street'))
    const b = createHero(new Rng(5), input('poacher', 'ST', 'street'))
    expect(a).toEqual(b)
  })

  it('every archetype × background starts in a sensible OVR band with growth headroom', () => {
    for (const [arch, pos] of ARCH_POS) {
      for (const bg of BGS) {
        for (let seed = 1; seed <= 5; seed++) {
          const h = createHero(new Rng(seed * 31), input(arch, pos, bg))
          const ovr = heroOvr(h)
          expect(ovr).toBeGreaterThanOrEqual(38)
          expect(ovr).toBeLessThanOrEqual(60)
          expect(h.potential).toBeGreaterThanOrEqual(Math.min(99, ovr + 12))
          expect(h.potential).toBeLessThanOrEqual(99)
          for (const k of ATTRIBUTE_KEYS) {
            expect(h.attrs[k]).toBeGreaterThanOrEqual(5)
            expect(h.attrs[k]).toBeLessThanOrEqual(75)
          }
        }
      }
    }
  })

  it('late bloomers start lower but have a higher ceiling on average', () => {
    let lateOvr = 0, lateP = 0, acaOvr = 0, acaP = 0
    for (let s = 1; s <= 40; s++) {
      const l = createHero(new Rng(s), input('poacher', 'ST', 'lateBloomer'))
      const a = createHero(new Rng(s), input('poacher', 'ST', 'academy'))
      lateOvr += heroOvr(l); lateP += l.potential; acaOvr += heroOvr(a); acaP += a.potential
    }
    expect(lateOvr).toBeLessThan(acaOvr)
    expect(lateP).toBeGreaterThan(acaP)
  })

  it('outfielders have poor goalkeeping, keepers poor finishing', () => {
    const st = createHero(new Rng(1), input('poacher', 'ST', 'academy'))
    const gk = createHero(new Rng(1), input('keeper', 'GK', 'academy'))
    expect(st.attrs.reflexes).toBeLessThan(25)
    expect(gk.attrs.reflexes).toBeGreaterThan(50)
    expect(gk.attrs.finishing).toBeLessThan(st.attrs.finishing)
  })

  it('grants innate perks and starting perk points', () => {
    const h = createHero(new Rng(2), input('winger', 'RW', 'street', 'B'))
    expect(h.perks).toContain('two_footed')
    expect(h.perks).toContain('street_smart')
    expect(h.perkPoints).toBe(earnedPerkPoints(heroOvr(h)))
  })
})

describe('createLife', () => {
  it('builds family relations and background money', () => {
    for (const bg of BGS) {
      const rng = new Rng(3)
      const h = createHero(rng, input('poacher', 'ST', bg))
      const life = createLife(rng, h, bg, { mother: 'Leyla' })
      expect(life.money).toBe(BACKGROUNDS[bg].money)
      expect(life.relationships.mother.name).toBe('Leyla')
      for (const id of ['mother', 'father', 'sibling', 'bestFriend', 'fans', 'press']) expect(life.relationships[id]).toBeDefined()
      expect(life.relationships.mother.value).toBeGreaterThan(40)
      expect(life.energy).toBe(100)
    }
  })
  it('football families are richest, street kids poorest', () => {
    expect(BACKGROUNDS.footballFamily.money).toBeGreaterThan(BACKGROUNDS.academy.money)
    expect(BACKGROUNDS.street.money).toBeLessThan(BACKGROUNDS.lateBloomer.money)
  })
})
