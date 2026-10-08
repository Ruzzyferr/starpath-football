import { useEffect, useRef, useState } from 'preact/hooks'
import { t } from '../../../i18n'
import '../../../styles/screens/casino.css'
import { Button, Money, Page } from '../../components'
import { formatMoney } from '../../format'
import { prefersReducedMotion } from '../../hooks/motion'
import { haptic } from '../../haptics'
import { Icon } from '../../icons'
import { actions, data, type SlotRules, type SlotsResult } from '../../store'
import { BetPicker, CasinoAgeLock, casinoMoney, SLOT_SYMBOLS, SlotSymbol, LimitBand } from './shared'

/** Filler cells scrolled past before the result lands. */
const FILL = 15
const DURATIONS = [1300, 1750, 2200]
const ROWS = 3
const START: number[][] = [[1, 3, 5], [2, 0, 6], [4, 2, 1]]

/** One reel: a strip from the previous column (top) to the new one (bottom), scrolled by translateY. */
function Reel({ from, to, spinId, duration, hits }: { from: number[]; to: number[]; spinId: number; duration: number; hits: boolean[] }) {
  const [go, setGo] = useState(false)
  useEffect(() => {
    setGo(false)
    if (spinId === 0) return
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setGo(true)))
    return () => cancelAnimationFrame(id)
  }, [spinId])
  const strip: number[] = spinId === 0 ? to : [...from]
  if (spinId !== 0) {
    for (let i = 0; i < FILL; i++) strip.push((from[1]! + i * 3 + spinId) % SLOT_SYMBOLS.length)
    strip.push(...to)
  }
  const shift = spinId === 0 ? 0 : go ? ((strip.length - ROWS) / strip.length) * 100 : 0
  const first = strip.length - ROWS
  return (
    <div class="slot-reel">
      <div
        class="slot-strip"
        style={{
          transform: `translateY(-${shift}%)`,
          transition: go ? `transform ${duration}ms cubic-bezier(.2,.75,.25,1.04)` : 'none',
        }}
      >
        {strip.map((s, i) => (
          <div key={i} class={`slot-cell${i >= first && hits[i - first] ? ' is-hit' : ''}`}><SlotSymbol index={s} size={52} /></div>
        ))}
      </div>
    </div>
  )
}

/** Payline overlay: every line faint, paying ones lit in gold. */
function Paylines({ rules, lit }: { rules: SlotRules; lit: Set<number> }) {
  const pt = (reel: number, row: number) => `${(reel + 0.5) * 100},${(row + 0.5) * 100}`
  return (
    <svg class="slot-lines" viewBox="0 0 300 300" preserveAspectRatio="none" aria-hidden="true">
      {rules.lines.map((rows, li) => (
        <polyline
          key={li}
          class={`slot-line${lit.has(li) ? ' is-lit' : ''}`}
          points={rows.map((row, reel) => pt(reel, row)).join(' ')}
          vector-effect="non-scaling-stroke"
        />
      ))}
    </svg>
  )
}

/** Tiny 3×3 diagram of one payline. */
function LineDiagram({ rows, n, lit }: { rows: number[]; n: number; lit: boolean }) {
  return (
    <span class={`slot-linemini${lit ? ' is-lit' : ''}`} title={t('casino.slot.lineN', { n })}>
      {Array.from({ length: 9 }, (_, i) => {
        const reel = i % 3
        const row = Math.floor(i / 3)
        return <span key={i} class={rows[reel] === row ? 'on' : ''} />
      })}
      <b>{n}</b>
    </span>
  )
}

/** Cells of the window that belong to a paying line: hits[reel][row]. */
function hitMap(rules: SlotRules, result: SlotsResult | null): boolean[][] {
  const hits = [0, 1, 2].map(() => [false, false, false])
  for (const w of result?.wins ?? []) {
    const rows = rules.lines[w.line]!
    for (let reel = 0; reel < w.count; reel++) hits[reel]![rows[reel]!] = true
  }
  return hits
}

export function SlotsScreen() {
  return data.casinoStatus().ageLock ? <CasinoAgeLock title={t('casino.games.slots')} /> : <SlotsGame />
}

function SlotsGame() {
  const st = data.casinoStatus()
  const rules = st.slots
  const [bet, setBet] = useState(st.minBet)
  const [win, setWin] = useState<number[][]>(START)
  const [prev, setPrev] = useState<number[][]>(START)
  const [spinId, setSpinId] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<SlotsResult | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  const money = casinoMoney()
  const lineBet = bet / rules.lines.length

  const spin = () => {
    if (spinning) return
    const res = actions.casino.slotsSpin(bet)
    setPrev(win)
    setWin(res.window)
    setResult(null)
    setSpinning(true)
    setSpinId((n) => n + 1)
    haptic('heavy')
    timer.current = setTimeout(() => {
      setSpinning(false)
      setResult(res)
      haptic(res.net > 0 ? 'success' : 'tap')
    }, prefersReducedMotion() ? 50 : DURATIONS[2]! + 150)
  }
  const paid = !!result && result.wins.length > 0
  const lit = new Set((result?.wins ?? []).map((w) => w.line))
  const hits = hitMap(rules, result)
  const returned = result ? result.wins.reduce((s, w) => s + w.amount, 0) : 0

  return (
    <Page title={t('casino.games.slots')} backTo="casino" wide actions={<span class="cas-bar-money"><Icon name="coins" size={16} /><Money value={money} compact /></span>}>
      <LimitBand />
      <div class="slot-layout">
        <div class={`slot-machine${paid ? ' is-win' : ''}${spinning ? ' is-spinning' : ''}`}>
          <div class="slot-marquee" aria-hidden="true">
            {Array.from({ length: 14 }, (_, i) => <span key={i} class="slot-bulb" style={{ animationDelay: `${i * 90}ms` }} />)}
          </div>
          <div class={`slot-window${result ? ' has-result' : ''}`} role="group" aria-label={t('casino.slot.reels')}>
            {win.map((col, i) => (
              <Reel key={i} from={prev[i] ?? col} to={col} spinId={spinId} duration={DURATIONS[i]!} hits={hits[i]!} />
            ))}
            <Paylines rules={rules} lit={lit} />
          </div>
          <div class="slot-readout" aria-live="polite">
            {result ? (
              paid ? (
                <span class={result.net > 0 ? 'slot-win t-gold' : 'slot-win t-mid'}>
                  {result.net > 0 ? t('casino.slot.win', { amount: formatMoney(result.net) }) : t('casino.slot.back', { amount: formatMoney(returned) })}
                </span>
              ) : <span class="t-mid">{t('casino.slot.noWin')}</span>
            ) : <span class="t-lo">&nbsp;</span>}
          </div>
          {paid && (
            <ul class="slot-winlines">
              {result.wins.map((w) => (
                <li key={w.line} class="row">
                  <LineDiagram rows={rules.lines[w.line]!} n={w.line + 1} lit />
                  <span class="row">{Array.from({ length: w.count }, (_, k) => <SlotSymbol key={k} index={w.symbol} size={18} />)}</span>
                  <span class="t-sm">×{w.multiplier}</span>
                  <span class="t-sm t-gold num">+{formatMoney(w.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div class="slot-side stack">
          <BetPicker bet={bet} setBet={setBet} disabled={spinning} />
          <Button variant="gold" size="lg" block icon="cherries" disabled={spinning || bet < st.minBet || bet > money} onClick={spin}>
            {t('casino.slot.spin')}
          </Button>
          <div class="slot-paytable card card-inset pad-md">
            <h2 class="label t-mid">{t('casino.slot.paytable')}</h2>
            <p class="t-xs t-mid">{t('casino.slot.howTo', { n: rules.lines.length, amount: formatMoney(lineBet) })}</p>
            <div class="slot-linelist" aria-label={t('casino.slot.lines', { n: rules.lines.length })}>
              {rules.lines.map((rows, li) => <LineDiagram key={li} rows={rows} n={li + 1} lit={lit.has(li)} />)}
            </div>
            <ul>
              {rules.pays.map((p) => (
                <li key={`${p.symbol}-${p.count}`} class="row-between">
                  <span class="row">
                    {Array.from({ length: p.count }, (_, k) => <SlotSymbol key={k} index={p.symbol} size={22} />)}
                    {p.count === 2 && <span class="slot-any" aria-hidden="true">?</span>}
                  </span>
                  <span class="slot-pay">
                    <span class="t-sm t-mid">×{p.multiplier}</span>
                    <span class="t-sm num">{formatMoney(Math.round(p.multiplier * lineBet))}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p class="t-xs t-lo">{t('casino.slot.note')}</p>
          </div>
        </div>
      </div>
    </Page>
  )
}
