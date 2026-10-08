import { describe, expect, it } from 'vitest'
import { advanceDay } from './calendar'
import { financeSummary } from './financeHistory'
import { makeGame } from './testHelpers'

describe('financeHistory', () => {
  it('records weekly statements and summarises categories', () => {
    const s = makeGame(21)
    expect(financeSummary(s)).toBeNull()
    for (let i = 0; i < 40; i++) advanceDay(s)
    const f = financeSummary(s)
    expect(f).not.toBeNull()
    expect(f!.weeks).toBeGreaterThan(0)
    expect(f!.weeks).toBeLessThanOrEqual(12)
    expect(f!.incomeTotal).toBeGreaterThan(0)
    expect(f!.net.length).toBe(f!.weeks)
    expect(f!.income.every((x) => x.value > 0)).toBe(true)
    // Net cash flow equals income minus expenses across the window.
    expect(f!.net.reduce((a, b) => a + b, 0)).toBeCloseTo(f!.incomeTotal - f!.expenseTotal, -1)
  })
})
