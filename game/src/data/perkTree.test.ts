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
