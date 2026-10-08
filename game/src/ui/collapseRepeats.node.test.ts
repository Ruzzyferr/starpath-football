import { describe, expect, it } from 'vitest'
import { collapseRepeats } from './collapseRepeats'

describe('collapseRepeats', () => {
  it('merges only consecutive duplicates', () => {
    const r = collapseRepeats(['a', 'a', 'a', 'b', 'a'], (x) => x)
    expect(r.map((x) => [x.item, x.count])).toEqual([['a', 3], ['b', 1], ['a', 1]])
  })
  it('handles empty', () => expect(collapseRepeats([], (x) => String(x))).toEqual([]))
})
