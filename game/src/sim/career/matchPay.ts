/**
 * What one match earns the hero (WP-16 post-match earnings step).
 *
 * `matchBonuses` is the single source of the per-match contract bonuses that
 * `applyMatchToHero` pays out (goal, assist, appearance, keeper clean sheet).
 * `matchEarnings` adds this match's share of the weekly wage and sponsor income
 * (paid by `weeklyEconomy` at the end of the week) with the same tax / agent
 * rules, so the breakdown shows real money, not an estimate model of its own.
 */
import type { Contract } from '../../core/types'
import { IMAGE_RIGHTS_BONUS, INCOME_TAX } from '../life/economy'

export interface MatchBonusInput {
  goals: number
  assists: number
  minutes: number
  cleanSheet: boolean
  isKeeper: boolean
}

export interface MatchBonuses {
  goal: number
  assist: number
  appearance: number
  cleanSheet: number
  total: number
}

export const NO_BONUSES: MatchBonuses = { goal: 0, assist: 0, appearance: 0, cleanSheet: 0, total: 0 }

/** Contract bonuses for one match (nothing when the hero did not play or has no contract). */
export function matchBonuses(c: Contract | null | undefined, m: MatchBonusInput): MatchBonuses {
  if (!c || m.minutes <= 0) return NO_BONUSES
  const goal = m.goals * c.goalBonus
  const assist = m.assists * c.assistBonus
  const appearance = c.appearanceBonus ?? 0
  // Goalkeeper clean-sheet bonus (2.5#4): the goal bonus (min 10% of the weekly wage) per shutout of 60'+.
  const cleanSheet = m.isKeeper && m.cleanSheet && m.minutes >= 60 ? Math.max(c.goalBonus, Math.round(c.wage * 0.1)) : 0
  return { goal, assist, appearance, cleanSheet, total: goal + assist + appearance + cleanSheet }
}

export type EarningsKey = 'wage' | 'goal' | 'assist' | 'appearance' | 'cleanSheet' | 'sponsor' | 'imageRights' | 'tax' | 'agent'

export interface EarningsLine {
  key: EarningsKey
  amount: number
  /** Bonuses are paid right after the match; wage and sponsor money at the end of the week. */
  when: 'now' | 'week'
}

export interface MatchEarnings {
  lines: EarningsLine[]
  /** Paid right after the match. */
  paidNow: number
  /** This match's share of the end-of-week payout, after tax and agent fee. */
  weekShare: number
  net: number
}

export interface MatchEarningsInput {
  contract: Contract | null | undefined
  bonuses: MatchBonuses
  /** Weekly sponsor income before the image-rights uplift. */
  sponsorsWeekly: number
  /** Agent commission (0..0.3) or 0 without an agent. */
  agentCommission: number
  /** Income-tax rate of the club's country (default flat rate). */
  taxRate?: number
  /** Matches played this week (the weekly wage/sponsor money is shared between them). */
  matchesThisWeek: number
  retired?: boolean
}

export function matchEarnings(x: MatchEarningsInput): MatchEarnings {
  const lines: EarningsLine[] = []
  const share = 1 / Math.max(1, Math.round(x.matchesThisWeek))
  const wage = !x.retired && x.contract ? Math.round(Math.max(0, x.contract.wage) * share) : 0
  const sponsor = !x.retired ? Math.round(Math.max(0, x.sponsorsWeekly) * share) : 0
  const image = x.contract?.imageRights && !x.retired ? Math.round(sponsor * (IMAGE_RIGHTS_BONUS - 1)) : 0
  if (wage > 0) lines.push({ key: 'wage', amount: wage, when: 'week' })
  const b = x.bonuses
  if (b.goal > 0) lines.push({ key: 'goal', amount: b.goal, when: 'now' })
  if (b.assist > 0) lines.push({ key: 'assist', amount: b.assist, when: 'now' })
  if (b.appearance > 0) lines.push({ key: 'appearance', amount: b.appearance, when: 'now' })
  if (b.cleanSheet > 0) lines.push({ key: 'cleanSheet', amount: b.cleanSheet, when: 'now' })
  if (sponsor > 0) lines.push({ key: 'sponsor', amount: sponsor, when: 'week' })
  if (image > 0) lines.push({ key: 'imageRights', amount: image, when: 'week' })
  const tax = -Math.round((wage + sponsor + image) * (x.taxRate ?? INCOME_TAX))
  const agent = -Math.round((wage + sponsor) * Math.min(0.3, Math.max(0, x.agentCommission)))
  if (tax < 0) lines.push({ key: 'tax', amount: tax, when: 'week' })
  if (agent < 0) lines.push({ key: 'agent', amount: agent, when: 'week' })
  const paidNow = b.total
  const weekShare = wage + sponsor + image + tax + agent
  return { lines, paidNow, weekShare, net: paidNow + weekShare }
}
