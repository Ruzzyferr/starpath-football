import { describe, expect, it } from 'vitest'
import { PERKS, PERK_BRANCH, perkTier, type PerkBranch } from './perks'

describe('perk tree: 3 branches × 3 tiers (2.3#39)', () => {
  it('every non-innate perk has a branch and each branch spans tiers 1–3', () => {
    const grid = new Map<PerkBranch, Set<number>>()
    for (const p of PERKS) {
      const b = PERK_BRANCH[p.group]
      if (p.group === 'innate') { expect(b).toBeNull(); continue }
      expect(b).not.toBeNull()
      if (!grid.has(b!)) grid.set(b!, new Set())
      grid.get(b!)!.add(perkTier(p))
    }
    expect([...grid.keys()].sort()).toEqual(['mental', 'physical', 'technical'])
    for (const tiers of grid.values()) expect([...tiers].sort()).toEqual([1, 2, 3])
  })
})

describe('perk tree gating (2.3#39)', () => {
  it('tier 2 needs one and tier 3 two owned perks of the branch; every position can open each branch', async () => {
    const { perkBlock, branchDepth } = await import('../sim/career/perks')
    const { makeHeroLife } = await import('../sim/career/testFixtures')
    const { ATTRIBUTE_KEYS } = await import('../core/types')
    for (const pos of ['GK', 'CB', 'CM', 'ST'] as const) {
      const { hero } = makeHeroLife({ age: 26 })
      hero.position = pos
      for (const k of ATTRIBUTE_KEYS) hero.attrs[k] = 90
      hero.reputation = 90
      hero.perkPoints = 99
      for (const branch of ['technical', 'physical', 'mental'] as const) {
        const inBranch = PERKS.filter((p) => PERK_BRANCH[p.group] === branch && (!p.requirement.positions || p.requirement.positions.includes(pos)))
        const t1 = inBranch.filter((p) => perkTier(p) === 1)
        expect(t1.length, `${pos}/${branch} tier-1`).toBeGreaterThanOrEqual(2)
        const t2 = inBranch.find((p) => perkTier(p) === 2 && !p.requirement.perks)
        if (t2) expect(perkBlock(hero, t2.id)).toBe('tier')
        for (const p of t1.slice(0, 2)) hero.perks.push(p.id)
        expect(branchDepth(hero, branch, 2)).toBe(2)
        if (t2) expect(perkBlock(hero, t2.id)).toBeNull()
      }
    }
  })
})
