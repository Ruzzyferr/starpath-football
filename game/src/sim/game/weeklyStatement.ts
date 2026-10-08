/** Itemised weekly statement (2.5#3 "Kazanç Dökümü"): one week of `life.flags['g:eco']`, line by line. */
import type { GameState, LText } from '../../core/types'
import { CAT_LABEL, ECO_FLAG, EXPENSE_CATS, INCOME_CATS } from './financeHistory'
import { readJson } from './internal'

export interface StatementLine {
  key: string
  label: LText
  /** Positive = income, negative = expense. */
  amount: number
}
export interface WeeklyStatement {
  /** Absolute week of the statement. */
  week: number
  income: StatementLine[]
  expense: StatementLine[]
  net: number
}

interface Entry {
  wk: number
  b: Record<string, number>
}

/** Statement `index` of the stored history (oldest first); default = the latest. Null when none exists. */
export function weeklyStatement(state: Pick<GameState, 'life'>, index?: number): WeeklyStatement | null {
  const hist = readJson<Entry[]>(state.life, ECO_FLAG, [])
  const e = index === undefined ? hist[hist.length - 1] : hist[index]
  if (!e) return null
  const lines = (cats: readonly string[]): StatementLine[] =>
    cats
      .map((k) => ({ key: k, label: CAT_LABEL[k as keyof typeof CAT_LABEL], amount: Math.round(e.b[k] ?? 0) }))
      .filter((l) => l.amount !== 0)
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
  const income = lines(INCOME_CATS).filter((l) => l.amount > 0)
  const expense = lines(EXPENSE_CATS).filter((l) => l.amount < 0)
  const net = [...income, ...expense].reduce((s, l) => s + l.amount, 0)
  return { week: e.wk, income, expense, net }
}
