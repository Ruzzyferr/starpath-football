import { describe, expect, it } from 'vitest'
import type { Contract } from '../../core/types'
import { IMAGE_RIGHTS_BONUS, INCOME_TAX } from '../life/economy'
import { NO_BONUSES, matchBonuses, matchEarnings } from './matchPay'

const contract: Contract = { clubId: 'c', wage: 1000, untilSeason: 3, signingBonus: 0, goalBonus: 200, assistBonus: 120, releaseClause: null, role: 'starter', appearanceBonus: 50 }
const played = { goals: 2, assists: 1, minutes: 90, cleanSheet: false, isKeeper: false }

describe('matchBonuses', () => {
  it('itemises goal / assist / appearance bonuses', () => {
    expect(matchBonuses(contract, played)).toEqual({ goal: 400, assist: 120, appearance: 50, cleanSheet: 0, total: 570 })
  })
  it('pays nothing without minutes or a contract', () => {
    expect(matchBonuses(contract, { ...played, minutes: 0 })).toEqual(NO_BONUSES)
    expect(matchBonuses(null, played)).toEqual(NO_BONUSES)
  })
  it('keepers earn a clean-sheet bonus for 60+ minutes (goal bonus, at least 10% of the wage)', () => {
    const gk = { goals: 0, assists: 0, minutes: 90, cleanSheet: true, isKeeper: true }
    expect(matchBonuses(contract, gk).cleanSheet).toBe(200)
    expect(matchBonuses({ ...contract, goalBonus: 10 }, gk).cleanSheet).toBe(100)
    expect(matchBonuses(contract, { ...gk, minutes: 45 }).cleanSheet).toBe(0)
    expect(matchBonuses(contract, { ...gk, isKeeper: false }).cleanSheet).toBe(0)
  })
})

describe('matchEarnings', () => {
  it('adds the wage and sponsor share with the weekly tax, image rights and agent rules', () => {
    const bonuses = matchBonuses({ ...contract, imageRights: true }, played)
    const e = matchEarnings({ contract: { ...contract, imageRights: true }, bonuses, sponsorsWeekly: 400, agentCommission: 0.1, matchesThisWeek: 2 })
    const by = Object.fromEntries(e.lines.map((l) => [l.key, l.amount]))
    expect(by.wage).toBe(500)
    expect(by.sponsor).toBe(200)
    expect(by.imageRights).toBe(Math.round(200 * (IMAGE_RIGHTS_BONUS - 1)))
    expect(by.tax).toBe(-Math.round((500 + 200 + by.imageRights) * INCOME_TAX))
    expect(by.agent).toBe(-70)
    expect(by.goal).toBe(400)
    expect(e.paidNow).toBe(570)
    expect(e.net).toBe(e.lines.reduce((a, l) => a + l.amount, 0))
    expect(e.lines.filter((l) => l.when === 'now').map((l) => l.key)).toEqual(['goal', 'assist', 'appearance'])
  })
  it('omits zero lines (no sponsors, no agent, no image rights)', () => {
    const e = matchEarnings({ contract, bonuses: NO_BONUSES, sponsorsWeekly: 0, agentCommission: 0, matchesThisWeek: 1 })
    expect(e.lines.map((l) => l.key)).toEqual(['wage', 'tax'])
  })
})
