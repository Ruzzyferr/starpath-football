import { describe, expect, it } from 'vitest'
import { firstNameGender } from '../../../data/world/names'
import { makeRelation } from '../../../sim/career/createHero'
import { relAppearance } from './util'

describe('relation faces follow the name', () => {
  it('knows common first names and leaves unisex ones open', () => {
    expect(firstNameGender('Ayşe')).toBe('female')
    expect(firstNameGender('Elena Rossi')).toBe('female')
    expect(firstNameGender('Mehmet')).toBe('male')
    expect(firstNameGender('Pablo')).toBe('male')
    expect(firstNameGender('Deniz')).toBeNull()
    expect(firstNameGender('Xyzzy')).toBeNull()
  })

  it('siblings, partners and friends get a face matching their name', () => {
    for (const kind of ['sibling', 'partner', 'bestFriend'] as const) {
      for (const n of ['Ayşe', 'Fatma', 'Elif', 'Zeynep', 'Maria', 'Anna', 'Sofia', 'Laura', 'Clara', 'Elena']) {
        expect(relAppearance(makeRelation(kind, kind, n, 50), undefined).gender).toBe('female')
      }
      for (const n of ['Mehmet', 'Ahmet', 'Mustafa', 'Hasan', 'Ali', 'Murat', 'Emre', 'Burak', 'David', 'Marco', 'Lukas', 'Daniel', 'Tom', 'Pablo', 'Leo', 'Adam']) {
        expect(relAppearance(makeRelation(kind, kind, n, 50), undefined).gender ?? 'male').toBe('male')
      }
    }
  })

  it('mothers are always drawn as women', () => {
    expect(relAppearance(makeRelation('mother', 'mother', 'Deniz', 50), undefined).gender).toBe('female')
  })
})
