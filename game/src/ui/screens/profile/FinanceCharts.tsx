import '../../../styles/screens/board.css'
import { useState } from 'preact/hooks'
import { currentLang, lt, t } from '../../../i18n'
import { financeSummary } from '../../../sim/game/financeHistory'
import { weeklyStatement } from '../../../sim/game/weeklyStatement'
import { Card, CardHeader, DonutChart, WeekBars } from '../../components'
import { formatMoney } from '../../format'
import { gameState } from '../../store'

type Sel = { kind: 'in' | 'out'; id: string } | null

/** Income and expense by category (donuts) plus the last weeks' net cash flow. */
export function FinanceCharts() {
  void currentLang.value
  const s = gameState.value
  const [sel, setSel] = useState<Sel>(null)
  const [bar, setBar] = useState<number | null>(null)
  const f = s ? financeSummary(s) : null
  if (!f) return null
  const mk = (list: typeof f.income) => list.map((x) => ({ id: x.key, label: lt(x.label), value: x.value, text: formatMoney(x.value, { compact: true }) }))
  const selFor = (kind: 'in' | 'out') => (sel?.kind === kind ? sel.id : null)
  const net = bar !== null ? f.net[bar] ?? 0 : f.net.reduce((a, b) => a + b, 0)
  const st = s ? weeklyStatement(s, bar ?? f.net.length - 1) : null
  return (
    <Card pad="md" data-testid="finance-charts">
      <CardHeader title={t('board.finance.title')} icon="chart-bar" sub={t('board.finance.sub', { n: f.weeks })} />
      <div class="fin-grid">
        <section aria-label={t('board.finance.income')}>
          <h4 class="micro t-mid">{t('board.finance.income')}</h4>
          <DonutChart slices={mk(f.income)} label={t('board.finance.income')} total={formatMoney(f.incomeTotal, { compact: true })} selected={selFor('in')} onSelect={(id) => setSel(id ? { kind: 'in', id } : null)} />
        </section>
        <section aria-label={t('board.finance.expense')}>
          <h4 class="micro t-mid">{t('board.finance.expense')}</h4>
          <DonutChart slices={mk(f.expense)} label={t('board.finance.expense')} total={formatMoney(f.expenseTotal, { compact: true })} selected={selFor('out')} onSelect={(id) => setSel(id ? { kind: 'out', id } : null)} />
        </section>
      </div>
      <div class="fin-net">
        <div class="row-between">
          <h4 class="micro t-mid">{t('board.finance.net')}</h4>
          <span class="num t-sm" aria-live="polite">{formatMoney(net, { compact: true })}</span>
        </div>
        <WeekBars values={f.net} label={t('board.finance.net')} format={(v) => formatMoney(v, { compact: true })} selected={bar} onSelect={setBar} />
      </div>
      {st && (
        <section class="fin-statement" aria-label={t('board.finance.statement')} data-testid="finance-statement">
          <div class="row-between">
            <h4 class="micro t-mid">{t('board.finance.statement')}</h4>
            <span class="t-xs t-lo">{t('board.finance.statementWeek', { w: st.week + 1 })}</span>
          </div>
          <ul class="fin-statement-list">
            {[...st.income, ...st.expense].map((l) => (
              <li key={l.key} class={l.amount >= 0 ? 't-pos' : 't-neg'} data-testid={`stmt-${l.key}`}>
                <span class="t-hi">{lt(l.label)}</span>
                <b class="num">{formatMoney(l.amount, { sign: true })}</b>
              </li>
            ))}
            <li class="fin-statement-net">
              <span>{t('board.finance.statementNet')}</span>
              <b class="num" data-testid="stmt-net">{formatMoney(st.net, { sign: true })}</b>
            </li>
          </ul>
          <p class="t-xs t-lo">{t('board.finance.statementHint')}</p>
        </section>
      )}
    </Card>
  )
}
