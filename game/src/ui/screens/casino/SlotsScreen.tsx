import { useEffect, useRef, useState } from 'preact/hooks'
import { t } from '../../../i18n'
import '../../../styles/screens/casino.css'
import { Button, Money, Page } from '../../components'
import { formatMoney } from '../../format'
import { prefersReducedMotion } from '../../hooks/motion'
import { haptic } from '../../haptics'
import { Icon } from '../../icons'
import { actions, data, type SlotsResult } from '../../store'
import { BetPicker, casinoMoney, SLOT_SYMBOLS, SlotSymbol } from './shared'

const STRIP = 18
const DURATIONS = [1300, 1750, 2200]

/** One reel: a strip from `from` (top) to `to` (bottom) scrolled by translateY. */
function Reel({ from, to, spinId, duration, win }: { from: number; to: number; spinId: number; duration: number; win: boolean }) {
  const [go, setGo] = useState(false)
  useEffect(() => {
    setGo(false)
    if (spinId === 0) return
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setGo(true)))
    return () => cancelAnimationFrame(id)
  }, [spinId])
  const strip: number[] = [from]
  for (let i = 1; i < STRIP - 1; i++) strip.push((from + i * 3 + spinId) % SLOT_SYMBOLS.length)
  strip.push(to)
  const shift = spinId === 0 ? 0 : go ? ((STRIP - 1) / STRIP) * 100 : 0
  return (
    <div class={`slot-reel${win ? ' is-win' : ''}`}>
      <div
        class="slot-strip"
        style={{
          transform: `translateY(-${shift}%)`,
          transition: go ? `transform ${duration}ms cubic-bezier(.2,.75,.25,1.04)` : 'none',
        }}
      >
        {(spinId === 0 ? [to] : strip).map((s, i) => (
          <div key={i} class="slot-cell"><SlotSymbol index={s} size={64} /></div>
        ))}
      </div>
    </div>
  )
}

export function SlotsScreen() {
  const st = data.casinoStatus()
  const [bet, setBet] = useState(st.minBet)
  const [reels, setReels] = useState<number[]>([3, 1, 5])
  const [prev, setPrev] = useState<number[]>([3, 1, 5])
  const [spinId, setSpinId] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<SlotsResult | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  const money = casinoMoney()

  const spin = () => {
    if (spinning) return
    const res = actions.casino.slotsSpin(bet)
    setPrev(reels)
    setReels(res.reels)
    setResult(null)
    setSpinning(true)
    setSpinId((n) => n + 1)
    haptic('heavy')
    timer.current = setTimeout(() => {
      setSpinning(false)
      setResult(res)
      haptic(res.net > 0 ? 'success' : 'tap')
    }, prefersReducedMotion() ? 50 : DURATIONS[2] + 150)
  }
  const win = !!result && result.net > 0

  return (
    <Page title={t('casino.games.slots')} backTo="casino" wide actions={<span class="cas-bar-money"><Icon name="coins" size={16} /><Money value={money} compact /></span>}>
      <div class="slot-layout">
        <div class={`slot-machine${win ? ' is-win' : ''}${spinning ? ' is-spinning' : ''}`}>
          <div class="slot-marquee" aria-hidden="true">
            {Array.from({ length: 14 }, (_, i) => <span key={i} class="slot-bulb" style={{ animationDelay: `${i * 90}ms` }} />)}
          </div>
          <div class="slot-window" role="group" aria-label={t('casino.slot.reels')}>
            {reels.map((r, i) => (
              <Reel key={i} from={prev[i] ?? r} to={r} spinId={spinId} duration={DURATIONS[i]} win={win && !!result?.winLine} />
            ))}
            <div class={`slot-payline${win ? ' is-lit' : ''}`} aria-hidden="true" />
          </div>
          <div class="slot-readout" aria-live="polite">
            {result ? (
              win ? <span class="slot-win t-gold">{t('casino.slot.win', { amount: formatMoney(result.net) })}</span> : <span class="t-mid">{t('casino.slot.noWin')}</span>
            ) : <span class="t-lo">&nbsp;</span>}
          </div>
        </div>

        <div class="slot-side stack">
          <BetPicker bet={bet} setBet={setBet} disabled={spinning} />
          <Button variant="gold" size="lg" block icon="cherries" disabled={spinning || bet < st.minBet || bet > money} onClick={spin}>
            {t('casino.slot.spin')}
          </Button>
          <div class="slot-paytable card card-inset pad-md">
            <h2 class="label t-mid">{t('casino.slot.paytable')}</h2>
            <ul>
              {[3, 6, 5, 2, 1, 4].map((s) => (
                <li key={s} class="row-between">
                  <span class="row">{[0, 1, 2].map((k) => <SlotSymbol key={k} index={s} size={22} />)}</span>
                  <span class="t-sm t-mid">{t('casino.slot.three')}</span>
                </li>
              ))}
              <li class="row-between">
                <span class="row"><SlotSymbol index={0} size={22} /><SlotSymbol index={0} size={22} /></span>
                <span class="t-sm t-mid">{t('casino.slot.two')}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </Page>
  )
}
