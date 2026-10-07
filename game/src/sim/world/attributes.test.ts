import { ATTRIBUTE_KEYS, POSITIONS } from '../../core/types'
import type { Position } from '../../core/types'
import { Rng } from '../../core/rng'
import { POSITION_WEIGHTS, computeOvr, deriveAttributes, positionGroup } from './attributes'

describe('attributes', () => {
  it('position weights sum to 1', () => {
    for (const pos of POSITIONS) {
      const sum = Object.values(POSITION_WEIGHTS[pos]).reduce((s, w) => s + (w ?? 0), 0)
      expect(sum).toBeCloseTo(1, 6)
    }
  })

  it('derived attributes reproduce the OVR (±1) for every position and level', () => {
    const rng = new Rng(3)
    for (const pos of POSITIONS) {
      for (let i = 0; i < 60; i++) {
        const ovr = rng.int(35, 94)
        const attrs = deriveAttributes({ ovr, position: pos, styleSeed: rng.nextUint() })
        expect(Math.abs(computeOvr(attrs, pos) - ovr)).toBeLessThanOrEqual(1)
        for (const k of ATTRIBUTE_KEYS) {
          expect(attrs[k]).toBeGreaterThanOrEqual(1)
          expect(attrs[k]).toBeLessThanOrEqual(99)
          expect(Number.isInteger(attrs[k])).toBe(true)
        }
      }
    }
  })

  it('is deterministic for the same seed and varies with the seed', () => {
    const a = deriveAttributes({ ovr: 75, position: 'CM', styleSeed: 123 })
    const b = deriveAttributes({ ovr: 75, position: 'CM', styleSeed: 123 })
    const c = deriveAttributes({ ovr: 75, position: 'CM', styleSeed: 124 })
    expect(a).toEqual(b)
    expect(a).not.toEqual(c)
  })

  it('produces recognisable position profiles', () => {
    const avg = (pos: Position, key: (typeof ATTRIBUTE_KEYS)[number]) => {
      let s = 0
      for (let i = 0; i < 50; i++) s += deriveAttributes({ ovr: 75, position: pos, styleSeed: i * 7919 })[key]
      return s / 50
    }
    expect(avg('ST', 'finishing')).toBeGreaterThan(avg('ST', 'tackling') + 25)
    expect(avg('GK', 'reflexes')).toBeGreaterThan(70)
    expect(avg('GK', 'finishing')).toBeLessThan(40)
    expect(avg('CB', 'tackling')).toBeGreaterThan(avg('CB', 'dribbling') + 10)
    expect(avg('LW', 'pace')).toBeGreaterThan(avg('CB', 'pace'))
    expect(avg('CM', 'passing')).toBeGreaterThan(avg('ST', 'passing'))
  })

  it('a striker sheet rates lower when played as a centre-back', () => {
    const attrs = deriveAttributes({ ovr: 80, position: 'ST', styleSeed: 99 })
    expect(computeOvr(attrs, 'CB')).toBeLessThan(computeOvr(attrs, 'ST') - 5)
    expect(computeOvr(attrs, 'GK')).toBeLessThan(50)
  })

  it('groups positions', () => {
    expect(positionGroup('GK')).toBe('GK')
    expect(positionGroup('LB')).toBe('DEF')
    expect(positionGroup('DM')).toBe('MID')
    expect(positionGroup('AM')).toBe('MID')
    expect(positionGroup('RW')).toBe('FWD')
  })
})
