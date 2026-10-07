import { attrCardsFor, GK_GROUP_IDS } from './attrs'

describe('goalkeeper attribute groups', () => {
  it('keepers get more than two goalkeeping specialism groups, outfielders none', () => {
    const gk = attrCardsFor('GK')
    expect(GK_GROUP_IDS.length).toBeGreaterThan(2)
    expect(gk.filter((g) => g.gk).length).toBe(3)
    expect(gk.every((g) => g.keys.length >= 3)).toBe(true)
    expect(attrCardsFor('ST').some((g) => g.gk)).toBe(false)
  })
})
