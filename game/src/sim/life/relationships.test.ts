import { lt } from '../career/common'
import { makeHeroLife } from '../career/testFixtures'
import {
  MEMORY_SIZE, changeRelation, closeCircleMood, ensureRelation, ensureTeammates, passFactor, relationLabel,
  teammateId, teammatePassFactor, weeklyRelationDecay,
} from './relationships'

describe('relationships', () => {
  it('diminishing returns near the top, full damage on the way down', () => {
    const { life } = makeHeroLife()
    life.relationships.mother.value = 90
    const up = changeRelation(life, 'mother', 10)
    expect(up).toBeGreaterThan(0)
    expect(up).toBeLessThan(6)
    const down = changeRelation(life, 'mother', -10)
    expect(down).toBe(-10)
  })

  it('keeps at most 5 memories, most recent first', () => {
    const { life } = makeHeroLife()
    for (let i = 0; i < 8; i++) changeRelation(life, 'father', 1, { memory: lt(`a${i}`, `a${i}`) })
    expect(life.relationships.father.memory.length).toBe(MEMORY_SIZE)
    expect(life.relationships.father.memory[0].en).toBe('a7')
  })

  it('values stay within −100..100', () => {
    const { life } = makeHeroLife()
    for (let i = 0; i < 50; i++) changeRelation(life, 'sibling', 50)
    expect(life.relationships.sibling.value).toBeLessThanOrEqual(100)
    for (let i = 0; i < 50; i++) changeRelation(life, 'sibling', -80)
    expect(life.relationships.sibling.value).toBe(-100)
  })

  it('neglected close relations decay toward neutral after a grace period', () => {
    const { life } = makeHeroLife()
    life.relationships.mother.value = 60
    life.relationships.mother.lastContactWeek = 0
    weeklyRelationDecay(life, 2)
    expect(life.relationships.mother.value).toBe(60) // grace
    for (let w = 4; w < 40; w++) weeklyRelationDecay(life, w)
    expect(life.relationships.mother.value).toBeLessThan(20)
    expect(life.relationships.mother.value).toBeGreaterThanOrEqual(0)
  })

  it('family_bond perk slows decay', () => {
    const a = makeHeroLife()
    const b = makeHeroLife()
    b.hero.perks.push('family_first')
    for (const x of [a, b]) { x.life.relationships.mother.value = 60; x.life.relationships.mother.lastContactWeek = 0 }
    for (let w = 4; w < 20; w++) { weeklyRelationDecay(a.life, w, a.hero); weeklyRelationDecay(b.life, w, b.hero) }
    expect(b.life.relationships.mother.value).toBeGreaterThan(a.life.relationships.mother.value)
  })

  it('fans/press drift toward neutral both ways', () => {
    const { life } = makeHeroLife()
    life.relationships.fans.value = 80
    life.relationships.press.value = -50
    for (let w = 0; w < 20; w++) weeklyRelationDecay(life, w)
    expect(life.relationships.fans.value).toBeLessThan(80)
    expect(life.relationships.press.value).toBeGreaterThan(-50)
  })

  it('ensureTeammates adds and removes', () => {
    const { life } = makeHeroLife()
    ensureTeammates(life, [{ npcId: 'p1', name: 'Arda' }, { npcId: 'p2', name: 'Can' }])
    expect(life.relationships[teammateId('p1')].kind).toBe('teammate')
    life.relationships[teammateId('p1')].value = 50
    const r = ensureTeammates(life, [{ npcId: 'p1', name: 'Arda' }, { npcId: 'p3', name: 'Efe' }])
    expect(r.removed).toEqual([teammateId('p2')])
    expect(r.added).toEqual([teammateId('p3')])
    expect(life.relationships[teammateId('p1')].value).toBe(50) // kept
  })

  it('ensureRelation resets when the person changes', () => {
    const { life } = makeHeroLife()
    ensureRelation(life, 'manager', 'manager', 'Hoca A', 10)
    life.relationships.manager.value = 70
    ensureRelation(life, 'manager', 'manager', 'Hoca A', 10)
    expect(life.relationships.manager.value).toBe(70)
    ensureRelation(life, 'manager', 'manager', 'Hoca B', 5)
    expect(life.relationships.manager.value).toBe(5)
  })

  it('passFactor maps −100..100 to 0.6..1.3', () => {
    expect(passFactor(-100)).toBeCloseTo(0.6)
    expect(passFactor(0)).toBe(1)
    expect(passFactor(100)).toBeCloseTo(1.3)
    expect(passFactor(500)).toBeCloseTo(1.3)
    const { life } = makeHeroLife()
    expect(teammatePassFactor(life, 'nobody')).toBe(1)
  })

  it('labels and close-circle mood are bounded', () => {
    expect(relationLabel(-90).en).toBe('Enemy')
    expect(relationLabel(90).en).toBe('Inseparable')
    const { life } = makeHeroLife()
    for (const id of ['mother', 'father', 'sibling', 'bestFriend']) life.relationships[id].value = 100
    expect(closeCircleMood(life)).toBe(15)
  })
})
