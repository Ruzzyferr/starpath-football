import { describe, expect, it } from 'vitest'
import { Rng } from '../../core/rng'
import { generateWorld } from './generate'
import { SHAPE_POINTS, abilityShape, anchorAbility, anchorShape, recordAbilityReference } from './anchor'

const club = (w: ReturnType<typeof generateWorld>) => Object.values(w.players).filter((p) => p.clubId)

describe('ability shape anchor (playtest Tur 2: world top tail)', () => {
  it('records the quantile shape once, sorted, on the 0.5% grid', () => {
    const w = generateWorld(new Rng(5), { season: 2026, heroCountryId: 'TR', countryIds: ['TR'] })
    delete w.abilityShape
    recordAbilityReference(w)
    const shape = w.abilityShape!
    expect(shape).toHaveLength(SHAPE_POINTS)
    expect(shape.every((v, i) => i === 0 || v >= shape[i - 1])).toBe(true)
    const before = [...shape]
    for (const p of club(w)) p.ovr += 3
    recordAbilityReference(w)
    expect(w.abilityShape).toEqual(before)
  })

  it('pulls a stretched top end back without reordering or touching the middle much', () => {
    const w = generateWorld(new Rng(6), { season: 2026, heroCountryId: 'TR', countryIds: ['TR'] })
    recordAbilityReference(w)
    const top0 = abilityShape(w)[SHAPE_POINTS - 3]
    // Stretch: the best 3% gain +6 (and their ceilings), as an unchecked youth wave would.
    const ps = club(w).sort((a, b) => b.ovr - a.ovr)
    const n = Math.ceil(ps.length * 0.03)
    for (const p of ps.slice(0, n)) { p.ovr = Math.min(95, p.ovr + 6); p.potential = Math.max(p.potential, p.ovr) }
    const rng = new Rng(7)
    for (let i = 0; i < 4; i++) anchorShape(w, rng, 2027 + i)
    expect(abilityShape(w)[SHAPE_POINTS - 3]).toBeLessThanOrEqual(top0 + 1)
    for (const p of ps.slice(0, n)) expect(p.potential).toBeGreaterThanOrEqual(p.ovr)
  })

  it('is a no-op on the first call of a fresh world and deterministic per rng', () => {
    const mk = () => generateWorld(new Rng(8), { season: 2026, heroCountryId: 'TR', countryIds: ['TR'] })
    const a = mk(), b = mk()
    for (const w of [a, b]) { delete w.abilityAnchor; delete w.abilityShape }
    expect(anchorAbility(a, new Rng(1), 2027)).toBe(0)
    expect(a.abilityShape).toBeDefined()
    for (const p of club(a)) p.ovr += 2
    for (const p of club(b)) p.ovr += 2
    recordAbilityReference(b)
    b.abilityShape = a.abilityShape
    b.abilityAnchor = a.abilityAnchor
    anchorAbility(a, new Rng(2), 2028)
    anchorAbility(b, new Rng(2), 2028)
    expect(club(a).map((p) => p.ovr)).toEqual(club(b).map((p) => p.ovr))
  })
})
