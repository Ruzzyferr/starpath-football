/**
 * Weekly finance history (GAP 2.7#59): the last 12 itemised economy statements
 * kept in `life.flags['g:eco']`, summarised per category for the income /
 * expense donut charts and the weekly net bars. Pure; no UI.
 */
import type { Calendar, GameState, LText, Life } from '../../core/types'
import { absWeek, lt } from '../career/common'
import type { EconomyBreakdown } from '../life/economy'
import { readJson, writeJson } from './internal'

export const ECO_FLAG = 'g:eco'
export const ECO_WEEKS = 12

type Cat = Exclude<keyof EconomyBreakdown, 'investmentChange' | 'forcedSales'>
interface Entry {
  wk: number
  b: Record<Cat, number>
}

export const INCOME_CATS: readonly Cat[] = ['wage', 'sponsors', 'business', 'rent', 'investmentYield', 'savingsInterest']
export const EXPENSE_CATS: readonly Cat[] = ['tax', 'agentFee', 'trainer', 'upkeep', 'living', 'loanPayment']

export const CAT_LABEL: Readonly<Record<Cat, LText>> = {
  wage: lt('Maaş', 'Wage'),
  sponsors: lt('Sponsor', 'Sponsors'),
  business: lt('İşletme', 'Business'),
  rent: lt('Kira geliri', 'Rent income'),
  investmentYield: lt('Yatırım getirisi', 'Investment yield'),
  savingsInterest: lt('Mevduat faizi', 'Savings interest'),
  tax: lt('Vergi', 'Tax'),
  agentFee: lt('Menajer', 'Agent'),
  trainer: lt('Özel antrenör', 'Trainer'),
  upkeep: lt('Bakım giderleri', 'Upkeep'),
  living: lt('Yaşam giderleri', 'Living costs'),
  loanPayment: lt('Kredi taksiti', 'Loan payment'),
}

export function recordEconomy(life: Life, cal: Pick<Calendar, 'season' | 'week' | 'day'>, b: EconomyBreakdown): void {
  const hist = readJson<Entry[]>(life, ECO_FLAG, [])
  const wk = absWeek(cal as Calendar)
  const entry: Entry = { wk, b: {} as Entry['b'] }
  for (const k of [...INCOME_CATS, ...EXPENSE_CATS]) entry.b[k] = Math.round(b[k] ?? 0)
  const rest = hist.filter((e) => e.wk !== wk)
  writeJson(life, ECO_FLAG, [...rest, entry].slice(-ECO_WEEKS))
}

export interface FinanceSlice {
  key: Cat
  label: LText
  value: number
}

export interface FinanceSummary {
  weeks: number
  income: FinanceSlice[]
  expense: FinanceSlice[]
  incomeTotal: number
  expenseTotal: number
  /** Net cash flow per week, oldest first. */
  net: number[]
}

export function financeSummary(state: GameState): FinanceSummary | null {
  const hist = readJson<Entry[]>(state.life, ECO_FLAG, [])
  if (hist.length === 0) return null
  const sum = (cats: readonly Cat[], sign: 1 | -1): FinanceSlice[] =>
    cats
      .map((key) => ({ key, label: CAT_LABEL[key], value: hist.reduce((s, e) => s + Math.max(0, sign * (e.b[key] ?? 0)), 0) }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value)
  const income = sum(INCOME_CATS, 1)
  const expense = sum(EXPENSE_CATS, -1)
  return {
    weeks: hist.length,
    income,
    expense,
    incomeTotal: income.reduce((s, x) => s + x.value, 0),
    expenseTotal: expense.reduce((s, x) => s + x.value, 0),
    net: hist.map((e) => Object.values(e.b).reduce((s, v) => s + v, 0)),
  }
}
