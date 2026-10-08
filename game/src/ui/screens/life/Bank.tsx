import { useState } from 'preact/hooks'
import type { Investment } from '../../../core/types'
import { lt, t } from '../../../i18n'
import { Button, Card, CardHeader, Chip, LineChart, MeterRing, Money, Segmented, Slider, Sparkline, toast } from '../../components'
import { formatMoney, formatPercent } from '../../format'
import { actions, data, gameState, type InvestKind } from '../../store'
import { UnlockGate } from '../../tutorial/UnlockGate'
import { absWeek } from '../../../sim/career/common'
import { TERM_OPTIONS, termInterest } from '../../../sim/life/economy'

const KINDS: InvestKind[] = ['index', 'bonds', 'property', 'startup', 'crypto']
const step = (max: number) => (max > 1_000_000 ? 10_000 : max > 100_000 ? 1_000 : 100)

function InvestmentRow({ inv }: { inv: Investment }) {
  const hist = data.investmentHistory(inv.id)
  const pl = inv.value - inv.amount
  const pct = inv.amount ? pl / inv.amount : 0
  return (
    <div class="bank-inv">
      <div class="grow">
        <div class="bank-inv-name truncate">{lt(inv.name)}</div>
        <div class="t-xs t-lo">{t(`data.invest.${inv.kind}`)} · {t('life.bank.invested')} {formatMoney(inv.amount, { compact: true })}</div>
      </div>
      <Sparkline values={hist.length ? hist : [inv.amount, inv.value]} width={84} height={30} color={pl >= 0 ? 'var(--pos)' : 'var(--neg)'} fill={false} />
      <div class="bank-inv-val">
        <div class="num">{formatMoney(inv.value, { compact: true })}</div>
        <Chip tone={pl >= 0 ? 'pos' : 'neg'}>{pl >= 0 ? '▲' : '▼'} {formatPercent(Math.abs(pct))}</Chip>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          const got = actions.divest(inv.id)
          toast(t('life.bank.divestedToast', { amount: formatMoney(got) }), 'success', 'coins')
        }}
      >
        {t('life.bank.divest')}
      </Button>
    </div>
  )
}

export function Bank() {
  const s = gameState.value
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit')
  const [amt, setAmt] = useState(0)
  const [loanAmt, setLoanAmt] = useState(50_000)
  const [loanWeeks, setLoanWeeks] = useState(52)
  const [repayAmt, setRepayAmt] = useState(0)
  const [kind, setKind] = useState<InvestKind>('index')
  const [invAmt, setInvAmt] = useState(0)
  const [termWeeks, setTermWeeks] = useState(26)
  const [termAmt, setTermAmt] = useState(0)
  if (!s) return null
  const { money, bank } = s.life
  const maxMove = Math.max(0, Math.floor(mode === 'deposit' ? money : bank.savings))
  const move = Math.min(amt, maxMove)
  const scoreMax = bank.creditScore > 100 ? 850 : 100
  const scorePct = bank.creditScore / scoreMax
  const loanMax = Math.max(10_000, Math.round((scorePct * 2_000_000) / 10_000) * 10_000)
  const invMax = Math.max(0, Math.floor(money))
  const inv = Math.min(invAmt, invMax)
  const netWorth = data.netWorthHistory()

  return (
    <div class="bank-grid">
      <Card variant="raised" class="bank-hero">
        <div class="bank-hero-row">
          <div>
            <div class="micro t-mid">{t('life.bank.cash')}</div>
            <div class="bank-big score-font"><Money value={money} /></div>
          </div>
          <div>
            <div class="micro t-mid">{t('life.bank.savings')}</div>
            <div class="bank-big score-font t-gold"><Money value={bank.savings} /></div>
          </div>
          <MeterRing
            value={bank.creditScore}
            max={scoreMax}
            size={76}
            label={t('life.bank.creditScore')}
            color={scorePct > 0.66 ? 'var(--pos)' : scorePct > 0.4 ? 'var(--accent-gold)' : 'var(--neg)'}
          />
        </div>
        {netWorth.length > 1 && (
          <div class="bank-networth">
            <div class="row-between">
              <span class="micro t-mid">{t('life.bank.netWorth')}</span>
              <span class="num">{formatMoney(netWorth[netWorth.length - 1]!, { compact: true })}</span>
            </div>
            <LineChart values={netWorth} height={96} color="var(--accent-gold)" label={t('life.bank.netWorth')} />
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title={t('life.bank.savings')} icon="piggy" sub={t('life.bank.savingsHint')} />
        <div class="stack">
          <Segmented
            label={t('life.bank.savings')}
            value={mode}
            onChange={(m) => { setMode(m); setAmt(0) }}
            options={[{ id: 'deposit', label: t('life.bank.deposit') }, { id: 'withdraw', label: t('life.bank.withdraw') }]}
          />
          <Slider label={t('life.bank.amount')} value={move} min={0} max={maxMove || 1} step={step(maxMove)} onChange={setAmt} format={(v) => formatMoney(v)} />
          <Button
            variant="secondary"
            block
            icon={mode === 'deposit' ? 'download' : 'upload'}
            disabled={move <= 0}
            onClick={() => {
              if (mode === 'deposit') {
                actions.bankDeposit(move)
                toast(t('life.bank.deposited', { amount: formatMoney(move) }), 'success', 'piggy')
              } else {
                actions.bankWithdraw(move)
                toast(t('life.bank.withdrawn', { amount: formatMoney(move) }), 'success', 'coins')
              }
              setAmt(0)
            }}
          >
            {mode === 'deposit' ? t('life.bank.deposit') : t('life.bank.withdraw')}
          </Button>
        </div>
      </Card>

      <Card data-testid="bank-term">
        <CardHeader title={t('life.bank.term.title')} icon="lock" sub={t('life.bank.term.hint')} />
        <div class="stack">
          <Segmented
            label={t('life.bank.term.title')}
            value={termWeeks}
            onChange={setTermWeeks}
            options={TERM_OPTIONS.map((o) => ({ id: o.weeks, label: t('life.bank.term.weeks', { w: o.weeks, r: +(o.rate * 100).toFixed(1) }) }))}
          />
          <Slider label={t('life.bank.amount')} value={Math.min(termAmt, Math.floor(money))} min={0} max={Math.max(1, Math.floor(money))} step={step(money)} onChange={setTermAmt} format={(v) => formatMoney(v)} />
          <Button
            variant="secondary"
            block
            icon="lock"
            data-testid="bank-term-open"
            disabled={Math.min(termAmt, Math.floor(money)) < 1000}
            onClick={() => {
              const a = Math.min(termAmt, Math.floor(money))
              actions.bankTermDeposit(a, termWeeks)
              toast(t('life.bank.term.opened', { amount: formatMoney(a) }), 'success', 'piggy')
              setTermAmt(0)
            }}
          >
            {t('life.bank.term.open')}
          </Button>
          {(bank.termDeposits ?? []).length === 0 ? (
            <p class="t-sm t-lo">{t('life.bank.term.empty')}</p>
          ) : (
            (bank.termDeposits ?? []).map((d) => (
              <div class="bank-inv" key={d.id} data-testid="bank-term-row">
                <div class="grow">
                  <div class="num">{formatMoney(d.amount)} · {formatPercent(d.rate)}</div>
                  <div class="t-xs t-lo">{t('life.bank.term.matures', { n: Math.max(0, d.maturesAt - absWeek(s.calendar)), i: formatMoney(Math.round(termInterest(d))) })}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => { actions.bankBreakTerm(d.id); toast(t('life.bank.term.broken'), 'info', 'coins') }}>{t('life.bank.term.break')}</Button>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title={t('life.bank.loan')} icon="bank" />
        {bank.loan ? (
          <div class="stack">
            <dl class="bank-loan-specs">
              <div><dt>{t('life.bank.remaining')}</dt><dd class="num t-neg">{formatMoney(bank.loan.remaining)}</dd></div>
              <div><dt>{t('life.bank.weeklyPayment')}</dt><dd class="num">{formatMoney(bank.loan.weeklyPayment)}</dd></div>
              <div><dt>{t('life.bank.rate')}</dt><dd class="num">{formatPercent(bank.loan.rate)}</dd></div>
            </dl>
            <div class="bank-loan-bar" aria-hidden="true">
              <span style={{ transform: `scaleX(${1 - bank.loan.remaining / (bank.loan.principal || 1)})` }} />
            </div>
            <Slider
              label={t('life.bank.repayAmount')}
              value={Math.min(repayAmt, Math.min(money, bank.loan.remaining))}
              min={0}
              max={Math.max(1, Math.floor(Math.min(money, bank.loan.remaining)))}
              step={step(bank.loan.remaining)}
              onChange={setRepayAmt}
              format={(v) => formatMoney(v)}
            />
            <div class="row">
              <Button
                variant="secondary"
                class="grow"
                disabled={repayAmt <= 0}
                onClick={() => {
                  const v = Math.min(repayAmt, money, bank.loan?.remaining ?? 0)
                  actions.repayLoan(v)
                  toast(t('life.bank.repaid', { amount: formatMoney(v) }), 'success')
                  setRepayAmt(0)
                }}
              >
                {t('life.bank.repay')}
              </Button>
              <Button
                variant="ghost"
                disabled={money < bank.loan.remaining}
                onClick={() => {
                  const v = bank.loan?.remaining ?? 0
                  actions.repayLoan(v)
                  toast(t('life.bank.repaid', { amount: formatMoney(v) }), 'success')
                }}
              >
                {t('life.bank.repayAll')}
              </Button>
            </div>
          </div>
        ) : (
          <div class="stack">
            <p class="t-sm t-lo">{t('life.bank.noLoan')}</p>
            <Slider label={t('life.bank.loanAmount')} value={Math.min(loanAmt, loanMax)} min={10_000} max={loanMax} step={10_000} onChange={setLoanAmt} format={(v) => formatMoney(v)} />
            <Segmented
              label={t('life.bank.loanWeeks')}
              value={loanWeeks}
              onChange={setLoanWeeks}
              options={[26, 52, 104].map((w) => ({ id: w, label: t('life.bank.weeksN', { n: w }) }))}
            />
            <Button
              variant="secondary"
              block
              icon="bank"
              onClick={() => {
                const v = Math.min(loanAmt, loanMax)
                const ok = actions.takeLoan(v, loanWeeks)
                toast(ok ? t('life.bank.loanTaken', { amount: formatMoney(v) }) : t('life.bank.loanRejected'), ok ? 'success' : 'error')
              }}
            >
              {t('life.bank.takeLoan')}
            </Button>
          </div>
        )}
      </Card>

      <UnlockGate feature="investments">
      <Card class="bank-invest">
        <CardHeader title={t('life.bank.investments')} icon="chart-line" />
        {bank.investments.length === 0 ? (
          <p class="t-sm t-lo">{t('life.bank.noInvestments')}</p>
        ) : (
          <div class="bank-inv-list">{bank.investments.map((i) => <InvestmentRow key={i.id} inv={i} />)}</div>
        )}
        <div class="bank-newinv stack">
          <h4 class="label t-mid">{t('life.bank.newInvestment')}</h4>
          <div class="bank-kinds" role="radiogroup" aria-label={t('life.bank.investKind')}>
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={k === kind}
                class={`bank-kind${k === kind ? ' is-active' : ''}`}
                onClick={() => setKind(k)}
              >
                <span class="bank-kind-name">{t(`data.invest.${k}`)}</span>
                <span class="t-xs t-lo">{t(`life.bank.riskHint.${k}`)}</span>
              </button>
            ))}
          </div>
          <Slider label={t('life.bank.amount')} value={inv} min={0} max={invMax || 1} step={step(invMax)} onChange={setInvAmt} format={(v) => formatMoney(v)} />
          <Button
            variant="primary"
            block
            icon="trend-up"
            disabled={inv <= 0}
            onClick={() => {
              actions.invest(kind, inv)
              toast(t('life.bank.investedToast', { amount: formatMoney(inv) }), 'success', 'chart-line')
              setInvAmt(0)
            }}
          >
            {t('life.bank.invest')}
          </Button>
        </div>
      </Card>
      </UnlockGate>
    </div>
  )
}
