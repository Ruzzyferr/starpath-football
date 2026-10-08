import { describe, expect, it } from 'vitest'
import { Rng } from '../../core/rng'
import { createHero, createLife, rollFamily } from './createHero'
import type { Background } from '../../core/types'

const APPEAR = { skin: 0, hairStyle: 0, hairColor: 0, beard: 0, eyeColor: 0, face: 0, accessory: 0 }
const mk = (i: number, background: Background) => {
  const rng = new Rng(i)
  const hero = createHero(rng, { firstName: `N${i}`, lastName: `L${i * 7}`, nickname: 'x', nationality: 'TR', position: 'CM', foot: 'R', appearance: APPEAR, archetype: 'playmaker', background, birthYear: 2008 })
  return createLife(rng, hero, background)
}

describe('starting family (2.4#14)', () => {
  it('is deterministic per hero and varies: single parents, foster care, 0-2 siblings', () => {
    const seen = new Set<string>()
    const sibs = new Set<number>()
    for (let i = 1; i <= 200; i++) {
      const life = mk(i, 'street')
      seen.add(String(life.flags.family_structure))
      sibs.add(Object.values(life.relationships).filter((r) => r.kind === 'sibling').length)
      if (life.flags.family_structure === 'foster') {
        expect(life.relationships.mother).toBeUndefined()
        expect(life.relationships.father).toBeUndefined()
      }
      if (life.flags.family_structure === 'single_mother') expect(life.relationships.father).toBeUndefined()
      expect(life.relationships.bestFriend).toBeDefined()
    }
    expect([...seen].sort()).toEqual(['both', 'foster', 'single_father', 'single_mother'])
    expect([...sibs].sort()).toEqual([0, 1, 2])
    expect(rollFamily({ firstName: 'A', lastName: 'B', birthYear: 2008 }, 'street')).toEqual(rollFamily({ firstName: 'A', lastName: 'B', birthYear: 2008 }, 'street'))
  })

  it('academy and football families keep both parents and at least one sibling', () => {
    for (let i = 1; i <= 100; i++) {
      for (const bg of ['academy', 'footballFamily'] as const) {
        const life = mk(i, bg)
        expect(life.relationships.mother && life.relationships.father && life.relationships.sibling).toBeTruthy()
      }
    }
  })
})
