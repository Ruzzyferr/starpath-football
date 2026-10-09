import { useEffect, useRef, useState } from 'preact/hooks'
import { t } from '../../../i18n'
import '../../../styles/screens/casino.css'
import { Button, Money, Page } from '../../components'
import { formatMoney } from '../../format'
import { prefersReducedMotion } from '../../hooks/motion'
import { haptic } from '../../haptics'
import { Icon } from '../../icons'
import { actions, data, type RouletteBet, type RouletteResult } from '../../store'
import { casinoMoney, chipValues, ChipToken, CasinoAgeLock, LimitBand } from './shared'

export const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])
const STEP = 360 / 37
const colorOf = (n: number) => (n === 0 ? 'green' : RED.has(n) ? 'red' : 'black')

function keyOf(b: Omit<RouletteBet, 'amount'>): string {
  return b.value !== undefined ? `${b.kind}:${b.value}` : b.kind
}

function Wheel({ rotation }: { rotation: number }) {
  const cx = 110
  const pt = (a: number, r: number) => `${(cx + Math.sin((a * Math.PI) / 180) * r).toFixed(2)} ${(cx - Math.cos((a * Math.PI) / 180) * r).toFixed(2)}`
  return (
    <div class="rl-wheel-wrap">
      <svg class="rl-wheel-static" viewBox="0 0 220 220" aria-hidden="true">
        <circle cx={cx} cy={cx} r="108" fill="var(--cas-wood)" />
        <circle cx={cx} cy={cx} r="100" fill="var(--cas-wood-deep)" />
      </svg>
      <svg class="rl-wheel" viewBox="0 0 220 220" style={{ transform: `rotate(${rotation}deg)` }} aria-hidden="true">
        {WHEEL.map((n, i) => {
          const a0 = i * STEP - STEP / 2
          const a1 = a0 + STEP
          const c = colorOf(n)
          return (
            <g key={n}>
              <path
                d={`M${pt(a0, 98)}A98 98 0 0 1 ${pt(a1, 98)}L${pt(a1, 70)}A70 70 0 0 0 ${pt(a0, 70)}Z`}
                fill={c === 'green' ? 'var(--brand-pitch-deep)' : c === 'red' ? 'var(--cas-red)' : 'var(--cas-black)'}
                stroke="var(--accent-gold-deep)"
                stroke-width=".6"
              />
              <text x={cx} y={cx - 84} transform={`rotate(${i * STEP} ${cx} ${cx})`} text-anchor="middle" dominant-baseline="middle" class="rl-num">{n}</text>
            </g>
          )
        })}
        <circle cx={cx} cy={cx} r="70" fill="var(--cas-wood)" />
        <circle cx={cx} cy={cx} r="56" fill="var(--cas-wood-deep)" />
        {[0, 45, 90, 135].map((a) => (
          <path key={a} d={`M${pt(a, 50)}L${pt(a + 180, 50)}`} stroke="var(--accent-gold)" stroke-width="3" stroke-linecap="round" />
        ))}
        <circle cx={cx} cy={cx} r="12" fill="var(--accent-gold)" />
        <circle cx={cx} cy={cx} r="5" fill="var(--accent-gold-deep)" />
      </svg>
      <div class="rl-pointer" aria-hidden="true" />
      <div class="rl-ball" aria-hidden="true" />
    </div>
  )
}

function RlCell({ label, cls, amt, hit, disabled, isNumber, onPlace }: { label: string; cls: string; amt: number; hit: boolean; disabled: boolean; isNumber: boolean; onPlace: () => void }) {
  return (
    <button
      type="button"
      class={`rl-cell ${cls}${hit ? ' is-hit' : ''}`}
      onClick={onPlace}
      disabled={disabled}
      aria-label={isNumber ? t('casino.rl.numberBet', { n: label }) : label}
    >
      <span>{label}</span>
      {amt > 0 && <span class="rl-placed num">{formatMoney(amt, { compact: true }).replace(/\s?€\s?/, '')}</span>}
    </button>
  )
}

export function RouletteScreen() {
  return data.casinoStatus().ageLock ? <CasinoAgeLock title={t('casino.games.roulette')} /> : <RouletteMain />
}

function RouletteMain() {
  const st = data.casinoStatus()
  const chips = chipValues(st.minBet, st.maxBet)
  const [chip, setChip] = useState(chips[0] ?? st.minBet)
  const [bets, setBets] = useState<Record<string, RouletteBet>>({})
  const [lastBets, setLastBets] = useState<Record<string, RouletteBet> | null>(null)
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<RouletteResult | null>(null)
  const [history, setHistory] = useState<number[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const total = Object.values(bets).reduce((a, b) => a + b.amount, 0)
  const money = casinoMoney()

  const place = (b: Omit<RouletteBet, 'amount'>) => {
    if (spinning) return
    if (total + chip > Math.min(st.maxBet, money)) {
      haptic('error')
      return
    }
    haptic('select')
    const k = keyOf(b)
    setResult(null)
    setBets((cur) => ({ ...cur, [k]: { ...b, amount: (cur[k]?.amount ?? 0) + chip } }))
  }
  const amountAt = (b: Omit<RouletteBet, 'amount'>) => bets[keyOf(b)]?.amount ?? 0

  const spin = () => {
    const list = Object.values(bets)
    if (!list.length || spinning) return
    const res = actions.casino.rouletteSpin(list)
    if (res.rejected) return
    const idx = WHEEL.indexOf(res.number)
    const desired = (360 - idx * STEP) % 360
    const current = ((rotation % 360) + 360) % 360
    const delta = (desired - current + 360) % 360
    setRotation(rotation + 360 * 5 + delta)
    setSpinning(true)
    setResult(null)
    setLastBets(bets)
    haptic('heavy')
    timer.current = setTimeout(() => {
      setSpinning(false)
      setResult(res)
      setHistory((h) => [res.number, ...h].slice(0, 10))
      setBets({})
      haptic(res.net > 0 ? 'success' : 'warning')
    }, prefersReducedMotion() ? 50 : 3400)
  }

  const cell = (b: Omit<RouletteBet, 'amount'>, label: string, cls: string) => (
    <RlCell key={keyOf(b)} label={label} cls={cls} amt={amountAt(b)} hit={!!result && b.kind === 'number' && b.value === result.number} disabled={spinning} isNumber={b.kind === 'number'} onPlace={() => place(b)} />
  )

  return (
    <Page title={t('casino.games.roulette')} backTo="casino" wide actions={<span class="cas-bar-money"><Icon name="coins" size={16} /><Money value={money} compact /></span>}>
      <LimitBand />
      <div class="rl-layout">
        <div class="rl-stage cas-felt">
          <Wheel rotation={rotation} />
          <div class="rl-readout" aria-live="polite">
            {spinning && <span class="t-mid">{t('casino.rl.spinning')}</span>}
            {result && !spinning && (
              <>
                <span class={`rl-result-num rl-${result.color}`}>{result.number}</span>
                <span class={`num ${result.net > 0 ? 't-pos' : 't-neg'}`}>{t('casino.net', { amount: formatMoney(result.net, { sign: true }) })}</span>
              </>
            )}
            {!spinning && !result && <span class="t-mid t-sm">{t('casino.rl.noBets')}</span>}
          </div>
          {history.length > 0 && (
            <div class="rl-history" aria-label={t('casino.rl.history')}>
              {history.map((n, i) => <span key={i} class={`rl-hist rl-${colorOf(n)}`}>{n}</span>)}
            </div>
          )}
        </div>

        <div class="rl-side">
          <div class="rl-chips" role="radiogroup" aria-label={t('casino.rl.chip')}>
            {chips.map((v) => <ChipToken key={v} value={v} selected={v === chip} onClick={() => setChip(v)} />)}
          </div>
          <div class="rl-board" role="group" aria-label={t('casino.rl.board')}>
            {cell({ kind: 'number', value: 0 }, '0', 'rl-zero rl-green')}
            {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => cell({ kind: 'number', value: n }, String(n), `rl-${colorOf(n)}`))}
          </div>
          <div class="rl-outside">
            {[1, 2, 3].map((d) => cell({ kind: 'dozen', value: d }, t('casino.rl.dozen', { n: d }), 'rl-out'))}
          </div>
          <div class="rl-outside rl-outside-6">
            {cell({ kind: 'low' }, t('casino.rl.low'), "rl-out")}
            {cell({ kind: 'even' }, t('casino.rl.even'), "rl-out")}
            {cell({ kind: 'red' }, t('casino.rl.red'), "rl-out rl-red")}
            {cell({ kind: 'black' }, t('casino.rl.black'), "rl-out rl-black")}
            {cell({ kind: 'odd' }, t('casino.rl.odd'), "rl-out")}
            {cell({ kind: 'high' }, t('casino.rl.high'), "rl-out")}
          </div>
          <div class="row-between rl-total">
            <span class="label t-mid">{t('casino.rl.totalBet')}</span>
            <span class="score-font num">{formatMoney(total)}</span>
          </div>
          <div class="rl-actions">
            <Button variant="ghost" icon="trash" disabled={spinning || total === 0} onClick={() => setBets({})}>{t('casino.rl.clear')}</Button>
            <Button
              variant="ghost"
              icon="history"
              disabled={spinning || !lastBets || Object.values(lastBets).reduce((a, b) => a + b.amount, 0) > money}
              onClick={() => lastBets && setBets(lastBets)}
            >
              {t('casino.rl.rebet')}
            </Button>
            <Button variant="primary" size="lg" icon="roulette" disabled={spinning || total === 0 || total > money} onClick={spin} class="grow">
              {t('casino.rl.spin')}
            </Button>
          </div>
        </div>
      </div>
    </Page>
  )
}
