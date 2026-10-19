import { describe, expect, it } from 'vitest'
import { ATTRIBUTE_KEYS, type Attributes } from '../../core/types'
import {
  GEAR, GEAR_BY_ID, GEAR_FLAG, GEAR_STAT_CAP, GEAR_TIERS, addGear, buyGearWithCash, effectiveAttrs, equipGear, gearRecovery, gearStatBonus,
  readGear, rewardGearFor, statBonusOf, unequipGear, wearGear,
} from './gear'
import { makeGame } from '../game/testHelpers'
import { HERO_ID, buildTeam } from '../game/match'
import { heroClub } from '../game/internal'

const life = (flags: Record<string, unknown> = {}) => ({ flags: flags as Record<string, string | number | boolean>, money: 0 })
const sheet = (v = 60): Attributes => Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, v])) as Attributes

describe('stat gear catalogue', () => {
  it('every item: bonuses +1..+4 per stat, tier prices and durations, cheap to elite', () => {
    for (const g of GEAR) {
      for (const v of Object.values(g.stats ?? {})) expect(v).toBeGreaterThanOrEqual(1), expect(v).toBeLessThanOrEqual(4)
      if (g.id !== 'compression') {
        expect(g.price, g.id).toBe(GEAR_TIERS[g.tier].gems)
        expect(g.cash, g.id).toBe(GEAR_TIERS[g.tier].cash)
        expect(g.matches, g.id).toBe(GEAR_TIERS[g.tier].matches)
      }
    }
    const boots = GEAR.filter((g) => g.slot === 'boots')
    expect(boots.length).toBeGreaterThanOrEqual(10)
    expect(boots.length).toBeLessThanOrEqual(14)
    // The Starter Pack grants gold_boots: the id must stay.
    expect(GEAR_BY_ID.gold_boots?.slot).toBe('boots')
  })
})

describe('stat bonus while worn', () => {
  it('adds the equipped items’ points, at most +5 on any stat across all gear', () => {
    const l = life()
    addGear(l, 'legend_maestro') // vision +4
    addGear(l, 'mind_band') // vision +2
    const b = gearStatBonus(l)
    expect(b.vision).toBe(GEAR_STAT_CAP)
    expect(b.passing).toBe(4)
    expect(b.composure).toBe(2)
    expect(statBonusOf([GEAR_BY_ID.legend_striker!, GEAR_BY_ID.striker_boots!]).shooting).toBe(GEAR_STAT_CAP)
  })

  it('effectiveAttrs = base + gear, ≤ 99, and never writes the base', () => {
    const l = life()
    addGear(l, 'striker_boots')
    const base = { ...sheet(70), shooting: 98 }
    const copy = { ...base }
    const eff = effectiveAttrs(base, l)
    expect(base).toEqual(copy)
    expect(eff.shooting).toBe(99)
    expect(eff.finishing).toBe(72)
    expect(eff.curve).toBe(71)
    expect(eff.pace).toBe(70)
    expect(effectiveAttrs(base, life())).toBe(base)
  })

  it('the bonus drops when the item is taken off or wears out', () => {
    const l = life()
    addGear(l, 'sprint_boots')
    expect(gearStatBonus(l).pace).toBe(2)
    unequipGear(l, 'boots')
    expect(gearStatBonus(l).pace).toBeUndefined()
    equipGear(l, 'sprint_boots')
    for (let i = 0; i < GEAR_BY_ID.sprint_boots!.matches - 1; i++) expect(wearGear(l)).toEqual([])
    expect(gearStatBonus(l).pace).toBe(2)
    expect(wearGear(l).map((d) => d.id)).toEqual(['sprint_boots'])
    expect(gearStatBonus(l)).toEqual({})
    expect(l.flags[GEAR_FLAG]).toBeUndefined()
  })
})

describe('getting gear', () => {
  it('career cash buys it for anyone; not enough money buys nothing', () => {
    const l = { ...life(), money: 45_000 }
    expect(buyGearWithCash(l, 'speed_boots').ok).toBe(true)
    expect(l.money).toBe(5_000)
    expect(readGear(l).eq.boots).toBe('speed_boots')
    expect(buyGearWithCash(l, 'gold_boots')).toEqual({ ok: false, why: 'money' })
    expect(l.money).toBe(5_000)
    expect(buyGearWithCash(l, 'nope')).toEqual({ ok: false, why: 'unknown' })
  })

  it('rewards pick an item that suits the position, in the asked tier', () => {
    expect(rewardGearFor('ST', 'pro').id).toBe('striker_boots')
    expect(rewardGearFor('ST', 'legend').id).toBe('legend_striker')
    expect(rewardGearFor('ST', 'elite').id).toBe('gold_boots')
    expect(rewardGearFor('CB', 'elite').id).toBe('sweeper_boots')
    expect(rewardGearFor('CB', 'pro').id).toBe('aerial_boots')
    expect(rewardGearFor('GK', 'standard').id).toBe('training_gloves')
    expect(rewardGearFor('GK', 'legend').id).toBe('legend_gloves')
    expect(rewardGearFor('AM', 'elite').id).toBe('dribbler_boots')
    for (const pos of ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST'] as const) for (const t of ['standard', 'pro', 'elite', 'legend'] as const) expect(rewardGearFor(pos, t).tier).toBe(t)
  })
})

describe('save compatibility', () => {
  it('a save from before the stat redesign loads: same ids, matches kept, now giving stats', () => {
    // Exactly what the old (training-XP) gear wrote into life.flags.
    const old = JSON.stringify({ inv: { gold_boots: 57, mind_band: 12, compression: 40, speed_boots: 40, retired_item: 9 }, eq: { boots: 'gold_boots', accessory: 'mind_band', recovery: 'compression' } })
    const l = life({ [GEAR_FLAG]: old })
    const g = readGear(l)
    expect(g.inv).toEqual({ gold_boots: 57, mind_band: 12, compression: 40, speed_boots: 40 })
    expect(g.eq).toEqual({ boots: 'gold_boots', accessory: 'mind_band', recovery: 'compression' })
    expect(gearStatBonus(l).shooting).toBe(2)
    expect(gearStatBonus(l).composure).toBe(2)
    expect(gearRecovery(l)).toBeCloseTo(0.2)
    // Old saves with every one of the six original ids.
    for (const id of ['gold_boots', 'speed_boots', 'striker_boots', 'mind_band', 'keeper_gloves', 'compression']) {
      expect(readGear(life({ [GEAR_FLAG]: JSON.stringify({ inv: { [id]: 10 }, eq: { [GEAR_BY_ID[id]!.slot]: id } }) })).inv[id], id).toBe(10)
    }
    expect(readGear(life({ [GEAR_FLAG]: '{broken' }))).toEqual({ inv: {}, eq: {} })
  })
})

describe('the match seam', () => {
  it('the hero the match sees carries the gear bonus; the stored base does not', () => {
    const s = makeGame(4242, { position: 'ST' })
    const club = heroClub(s)!
    const before = { ...s.hero.attrs }
    const heroIn = () => buildTeam(s, club, true, true).lineup.find((p) => p.id === HERO_ID)!
    const plain = heroIn().attrs
    addGear(s.life, 'striker_boots')
    const geared = heroIn().attrs
    expect(geared.shooting - plain.shooting).toBe(Math.min(3, 99 - plain.shooting))
    expect(geared.finishing - plain.finishing).toBe(Math.min(2, 99 - plain.finishing))
    expect(geared.pace).toBe(plain.pace)
    expect(s.hero.attrs).toEqual(before)
  })
})
