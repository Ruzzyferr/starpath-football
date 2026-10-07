import type { Fixture } from '../../core/types'
import {
  FORM_LENGTH, applyResultToTable, computeTable, createTable, formPoints, formString, goalDifference, sortTable, tablePosition,
} from './table'

let n = 0
function fx(homeId: string, awayId: string, home: number, away: number, week = n): Fixture {
  n++
  return { id: `f${n}`, compId: 'L', round: week, week, day: 5, homeId, awayId, result: { home, away, scorers: [] } }
}

describe('table', () => {
  it('applies wins, draws and losses', () => {
    const rows = createTable(['a', 'b'])
    applyResultToTable(rows, 'a', 'b', 3, 1)
    applyResultToTable(rows, 'b', 'a', 2, 2)
    const [a, b] = rows
    expect(a).toMatchObject({ p: 2, w: 1, d: 1, l: 0, gf: 5, ga: 3, pts: 4 })
    expect(b).toMatchObject({ p: 2, w: 0, d: 1, l: 1, gf: 3, ga: 5, pts: 1 })
    expect(goalDifference(a)).toBe(2)
    expect(formString(a)).toBe('WD')
    expect(formPoints(b)).toBe(1)
  })

  it('keeps only the last FORM_LENGTH results, newest last', () => {
    const rows = createTable(['a', 'b'])
    for (let i = 0; i < 7; i++) applyResultToTable(rows, 'a', 'b', i % 2, 0)
    expect(rows[0].form.length).toBe(FORM_LENGTH)
    expect(rows[0].form[FORM_LENGTH - 1]).toBe('D') // i = 6 → 0-0
  })

  it('sorts by points, goal difference, goals for', () => {
    const rows = computeTable(['a', 'b', 'c', 'd'], [
      fx('a', 'b', 1, 0), // a 3
      fx('c', 'd', 3, 1), // c 3, gd +2
      fx('b', 'd', 4, 0), // b 3, gd +3 (4-1)
      fx('a', 'c', 0, 0),
    ])
    const sorted = sortTable(rows).map((r) => r.clubId)
    // a: 4 pts (gd +1), c: 4 pts (gd +2), b: 3 pts, d: 0
    expect(sorted).toEqual(['c', 'a', 'b', 'd'])
    expect(tablePosition(sortTable(rows), 'b')).toBe(3)
    expect(tablePosition(sortTable(rows), 'zz')).toBe(0)
  })

  it('breaks full ties with head-to-head when fixtures are given', () => {
    const fixtures = [
      fx('x', 'a', 1, 0), // x beats a head-to-head
      fx('a', 'p', 1, 0), // a: 3 pts, 1-1
      fx('q', 'x', 1, 0), // x: 3 pts, 1-1 ; q: 3 pts, 1-0
    ]
    const rows = computeTable(['a', 'p', 'q', 'x'], fixtures)
    expect(sortTable(rows).map((r) => r.clubId)).toEqual(['q', 'a', 'x', 'p']) // id fallback
    expect(sortTable(rows, fixtures).map((r) => r.clubId)).toEqual(['q', 'x', 'a', 'p']) // h2h
  })

  it('computeTable ignores unplayed fixtures and matches incremental updates', () => {
    const fixtures = [fx('a', 'b', 2, 1), fx('b', 'a', 0, 0)]
    fixtures.push({ ...fx('a', 'b', 0, 0), result: null })
    const inc = createTable(['a', 'b'])
    applyResultToTable(inc, 'a', 'b', 2, 1)
    applyResultToTable(inc, 'b', 'a', 0, 0)
    expect(computeTable(['a', 'b'], fixtures)).toEqual(inc)
  })
})
