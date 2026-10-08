import { describe, expect, it } from 'vitest'
import { POSITIONS, type Position } from './types'
import {
  HEIGHT_ADJUST, POSITION_ROLES, ROLES, ROLE_PERK, clampHeight, defaultRole, heightAerialBonus, heightRange, normalizeRole, npcRole,
  roleFits, roleFromArchetype, withHeight,
} from './roles'
import { PERK_BY_ID } from '../data/perks'
import { flatAttrs } from '../game/setup'

describe('position roles table', () => {
  it('every position offers 2–4 roles and its default first', () => {
    for (const pos of POSITIONS) {
      expect(POSITION_ROLES[pos].length).toBeGreaterThanOrEqual(2)
      expect(POSITION_ROLES[pos].length).toBeLessThanOrEqual(4)
      expect(roleFits(pos, defaultRole(pos))).toBe(true)
    }
    expect(normalizeRole('CB', 'pivot')).toBe('stopper')
    expect(normalizeRole('ST', 'pivot')).toBe('pivot')
    expect(normalizeRole('GK', 'nonsense')).toBe('reflexKeeper')
  })
  it('suggested perks exist', () => {
    for (const r of ROLES) expect(PERK_BY_ID[ROLE_PERK[r]], r).toBeDefined()
  })
  it('NPC roles are deterministic, fit the position and cover every role', () => {
    const seen = new Set<string>()
    for (const pos of POSITIONS) {
      for (let seed = 0; seed < 60; seed++) {
        const r = npcRole({ position: pos, styleSeed: seed * 7919 })
        expect(roleFits(pos, r)).toBe(true)
        expect(npcRole({ position: pos, styleSeed: seed * 7919 })).toBe(r)
        seen.add(r)
      }
    }
    expect(seen.size).toBe(ROLES.length)
  })
  it('old archetypes map to the closest role at the position (frozen v4 → v5)', () => {
    const cases: [string, Position, string][] = [
      ['poacher', 'ST', 'runner'], ['wall', 'ST', 'pivot'], ['playmaker', 'ST', 'targetForward'],
      ['wall', 'CB', 'aerialDefender'], ['playmaker', 'CB', 'ballPlayingDefender'], ['poacher', 'CB', 'stopper'],
      ['winger', 'LW', 'touchlineWinger'], ['poacher', 'RW', 'invertedWinger'], ['playmaker', 'LW', 'freeWinger'],
      ['wall', 'DM', 'anchor'], ['boxToBox', 'CM', 'boxToBox'], ['playmaker', 'AM', 'playmaker'],
      ['winger', 'LB', 'attackingFullBack'], ['wall', 'RB', 'defensiveFullBack'], ['keeper', 'GK', 'shotStopper'], ['poacher', 'GK', 'shotStopper'],
    ]
    for (const [a, pos, r] of cases) expect(roleFromArchetype(a, pos), `${a}@${pos}`).toBe(r)
    for (const pos of POSITIONS) expect(roleFits(pos, roleFromArchetype(undefined, pos))).toBe(true)
  })
})

describe('height', () => {
  it('tall roles default taller; women −12 cm; the wizard range is ±5', () => {
    expect(heightRange('pivot').def).toBeGreaterThan(heightRange('runner').def + 10)
    expect(heightRange('aerialDefender', 'female').def).toBe(heightRange('aerialDefender').def - 12)
    expect(heightRange('dribbler').max - heightRange('dribbler').min).toBe(2 * HEIGHT_ADJUST)
    expect(clampHeight('runner', 'male', 300)).toBe(heightRange('runner').max)
    expect(clampHeight('runner', 'male', undefined)).toBe(heightRange('runner').def)
  })
  it('a tall player wins more in the air and gives up a little agility', () => {
    expect(heightAerialBonus(194)).toBeGreaterThan(0)
    expect(heightAerialBonus(168)).toBeLessThan(0)
    expect(heightAerialBonus(181)).toBe(0)
    const a = flatAttrs(60, false)
    const tall = withHeight(a, 194)
    expect(tall.heading).toBeGreaterThan(a.heading)
    expect(tall.jumping).toBeGreaterThan(a.jumping)
    expect(tall.agility).toBeLessThan(a.agility)
    expect(withHeight(a, 181)).toBe(a)
  })
})
