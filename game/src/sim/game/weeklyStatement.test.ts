import { describe, expect, it } from 'vitest'
import { writeJson } from './internal'
import { ECO_FLAG } from './financeHistory'
import { weeklyStatement } from './weeklyStatement'

describe('weeklyStatement', () => {
  it('itemises income and expense and sums to net', () => {
    const life = { flags: {} } as never
    writeJson(life, ECO_FLAG, [
      { wk: 5, b: { wage: 1000, sponsors: 0, tax: -300, upkeep: -50 } },
      { wk: 6, b: { wage: 2000, sponsors: 500, tax: -600, agentFee: -100, upkeep: -50 } },
    ])
    const s = weeklyStatement({ life }, undefined)!
    expect(s.week).toBe(6)
    expect(s.income.map((l) => l.key)).toEqual(['wage', 'sponsors'])
    expect(s.expense.map((l) => l.key)).toEqual(['tax', 'agentFee', 'upkeep'])
    expect(s.net).toBe(2000 + 500 - 600 - 100 - 50)
    expect(weeklyStatement({ life }, 0)!.net).toBe(650)
    expect(weeklyStatement({ life }, 9)).toBeNull()
    expect(weeklyStatement({ life: { flags: {} } as never })).toBeNull()
  })
})
