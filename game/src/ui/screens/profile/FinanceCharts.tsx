import '../../../styles/screens/board.css'
import { useState } from 'preact/hooks'
import { currentLang, lt, t } from '../../../i18n'
import { financeSummary } from '../../../sim/game/financeHistory'
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
    </Card>
  )
}
