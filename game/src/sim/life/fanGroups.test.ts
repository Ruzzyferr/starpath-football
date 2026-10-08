import { describe, expect, it } from 'vitest'
import { makeHeroLife } from '../career/testFixtures'
import { FAN_GROUP_IDS, applyFanGroupsMatch, fanGroupValue, fanGroupsAverage, weeklyFanGroups } from './fanGroups'
import { applyMatchRelations } from './relationships'

describe('supporter groups (2.4#79)', () => {
  it('start mildly warm and expect different things', () => {
    const { life } = makeHeroLife()
    for (const id of FAN_GROUP_IDS) expect(fanGroupValue(life, id)).toBe(10)
    expect(fanGroupsAverage(life)).toBe(10)
  })

  it('ultras love a big effort and hate a red card; the family stand cares about conduct', () => {
    const { life } = makeHeroLife()
    life.discipline = 90
    applyFanGroupsMatch(life, { rating: 8.5, goals: 2, won: true, red: false })
    expect(fanGroupValue(life, 'ultras')).toBeGreaterThan(12)
    expect(fanGroupValue(life, 'family')).toBeGreaterThan(10)
    const u = fanGroupValue(life, 'ultras')
    applyFanGroupsMatch(life, { rating: 5, goals: 0, won: false, red: true })
    expect(fanGroupValue(life, 'ultras')).toBeLessThan(u - 7)
    life.discipline = 20
    const f = fanGroupValue(life, 'family')
    applyFanGroupsMatch(life, { rating: 6.5, goals: 0, won: false, red: false })
    expect(fanGroupValue(life, 'family')).toBeLessThan(f)
  })

  it('drifts toward neutral weekly and is fed by real match results', () => {
    const { life, hero } = makeHeroLife()
    life.flags.fg_ultras = 50
    weeklyFanGroups(life)
    expect(fanGroupValue(life, 'ultras')).toBeCloseTo(49, 0)
    const before = fanGroupValue(life, 'ultras')
    applyMatchRelations(life, hero, { rating: 9, goals: 3, assists: 0, won: true, drew: false }, 5)
    expect(fanGroupValue(life, 'ultras')).toBeGreaterThan(before)
  })
})
