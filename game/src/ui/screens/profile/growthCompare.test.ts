import { describe, expect, it } from 'vitest'
import { ATTRIBUTE_KEYS, type Attributes } from '../../../core/types'
import { emptyAttrHistory } from '../../../sim/game/saveHistory'
import { growthCompare } from './growthCompare'

const attrs = (v: number) => Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, v])) as unknown as Attributes
const row = (season: number, week: number, v: number, pace = v) => [season, week, ...ATTRIBUTE_KEYS.map((k) => (k === 'pace' ? pace : v))]

describe('growthCompare', () => {
  it('needs at least two samples', () => {
    expect(growthCompare(undefined, attrs(60), 2)).toBeNull()
    const h = emptyAttrHistory()
    h.rows = [row(2, 3, 60)]
    expect(growthCompare(h, attrs(60), 2)).toBeNull()
  })
  it('compares against the previous season and sorts biggest gain first', () => {
    const h = emptyAttrHistory()
    h.rows = [row(1, 37, 50), row(2, 1, 55), row(2, 10, 60, 70)]
    const now = { ...attrs(60), pace: 70 } as Attributes
    const c = growthCompare(h, now, 2)!
    expect(c.season).toBe(1)
    expect(c.then.pace).toBe(50)
    expect(c.deltas[0]).toEqual({ key: 'pace', delta: 20 })
    expect(c.deltas.at(-1)!.delta).toBe(10)
  })
  it('falls back to the oldest sample in a first season', () => {
    const h = emptyAttrHistory()
    h.rows = [row(1, 1, 50), row(1, 9, 53)]
    expect(growthCompare(h, attrs(53), 1)!.week).toBe(1)
  })
})
