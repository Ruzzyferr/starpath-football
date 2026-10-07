import { useEffect, useRef, useState } from 'preact/hooks'
import { t } from '../../../i18n'
import '../../../styles/screens/casino.css'
import { Button, Chip, EmptyState, Money, Page } from '../../components'
import { formatMoney, formatNumber } from '../../format'
import { prefersReducedMotion } from '../../hooks/motion'
import { haptic } from '../../haptics'
import { Icon } from '../../icons'
import { actions, data, type HorseRaceResult, type HorseView } from '../../store'
import { BetPicker, casinoMoney } from './shared'

const RACE_MS = 6500

function HorseSvg({ silk }: { silk: string }) {
  return (
    <svg viewBox="0 0 44 28" class="hr-horse-svg" aria-hidden="true">
      <path d="M8 13Q3 13 2 19" stroke="#3a2618" stroke-width="2.5" fill="none" stroke-linecap="round" />
      <ellipse cx="19" cy="15" rx="12" ry="5.5" fill="#6b4226" />
      <path d="M28 12L35 5L40 6.5L38.5 10L33 15Z" fill="#6b4226" />
      <path d="M35 5l1-3 1.5 3" fill="#6b4226" />
      <g stroke="#4a2e1a" stroke-width="2.2" stroke-linecap="round" class="hr-legs">
        <path d="M11 19L8 26" /><path d="M15 19L17 26" /><path d="M24 19L22 26" /><path d="M28 18L31 26" />
      </g>
      <path d="M17 10L22 3.5L26 5.5L22 11Z" fill={silk} stroke="#0b1220" stroke-width=".8" />
      <circle cx="24.5" cy="3.2" r="2.4" fill={silk} stroke="#0b1220" stroke-width=".8" />
    </svg>
  )
}

function interp(timeline: number[][], p: number): number[] {
  if (!timeline.length) return []
  const f = p * (timeline.length - 1)
  const i = Math.floor(f)
  const k = f - i
  const a = timeline[i]
  const b = timeline[Math.min(timeline.length - 1, i + 1)]
  return a.map((v, j) => v + (b[j] - v) * k)
}

export function HorsesScreen() {
  const st = data.casinoStatus()
  const horses: HorseView[] = data.horses()
  const [pick, setPick] = useState<number | null>(null)
  const [bet, setBet] = useState(st.minBet)
  const [result, setResult] = useState<HorseRaceResult | null>(null)
  const [racing, setRacing] = useState(false)
  const [done, setDone] = useState(false)
  const [order, setOrder] = useState<number[]>([])
  const slides = useRef<(HTMLDivElement | null)[]>([])
  const raf = useRef(0)
  useEffect(() => () => cancelAnimationFrame(raf.current), [])
  const money = casinoMoney()

  const place = (positions: number[]) => {
    positions.forEach((v, i) => {
      const el = slides.current[i]
      if (el) el.style.transform = `translateX(${(Math.min(1, v) * 100).toFixed(2)}%)`
    })
  }

  const start = () => {
    if (pick === null || racing) return
    const res = actions.casino.horseRace(bet, pick)
    setResult(res)
    setDone(false)
    setRacing(true)
    haptic('heavy')
    const finish = () => {
      place(res.timeline[res.timeline.length - 1] ?? [])
      setOrder(res.order)
      setRacing(false)
      setDone(true)
      haptic(res.net > 0 ? 'success' : 'warning')
    }
    if (prefersReducedMotion()) {
      finish()
      return
    }
    place(res.timeline[0] ?? [])
    const t0 = performance.now()
    let lastOrder = 0
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / RACE_MS)
      const pos = interp(res.timeline, p)
      place(pos)
      if (now - lastOrder > 200) {
        lastOrder = now
        setOrder(pos.map((v, i) => [v, i] as const).sort((a, b) => b[0] - a[0]).map(([, i]) => i))
      }
      if (p < 1) raf.current = requestAnimationFrame(step)
      else finish()
    }
    raf.current = requestAnimationFrame(step)
  }

  const reset = () => {
    setResult(null)
    setDone(false)
    setOrder([])
    place(horses.map(() => 0))
  }

  if (!horses.length) return <Page title={t('casino.games.horses')} backTo="casino"><EmptyState icon="horse" /></Page>
  const mine = pick !== null ? horses[pick] : null
  const myPlace = result && pick !== null ? result.order.indexOf(pick) + 1 : 0

  return (
    <Page title={t('casino.games.horses')} backTo="casino" wide actions={<span class="cas-bar-money"><Icon name="coins" size={16} /><Money value={money} compact /></span>}>
      <div class="hr-layout">
        <div class="hr-track" role="img" aria-label={t('casino.games.horses')}>
          <div class="hr-finish" aria-hidden="true"><span>{t('casino.hr.finish')}</span></div>
          {horses.map((h, i) => (
            <div key={h.index} class={`hr-lane${pick === i ? ' is-mine' : ''}`}>
              <span class="hr-lane-no num">{i + 1}</span>
              <div class="hr-rail">
                <div class="hr-slide" ref={(el) => { slides.current[i] = el }}>
                  <div class={`hr-horse${racing ? ' is-running' : ''}`} style={{ animationDelay: `${i * 37}ms` }}>
                    <HorseSvg silk={h.color} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {(racing || done) && order.length > 0 && (
          <div class="hr-order" aria-live="polite">
            <span class="micro t-mid">{done ? t('casino.hr.photo') : t('casino.hr.standings')}</span>
            <ol>
              {order.slice(0, done ? 3 : 8).map((idx, p) => (
                <li key={idx} class={`hr-order-item${idx === pick ? ' is-mine' : ''}${done ? ` podium-${p + 1}` : ''}`}>
                  <span class="num hr-order-pos">{p + 1}</span>
                  <span class="hr-silk" style={{ background: horses[idx]?.color }} aria-hidden="true" />
                  <span class="truncate">{horses[idx]?.name}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {done && result && mine && (
          <div class={`hr-result card card-raised pad-md ${result.net > 0 ? 'is-win' : 'is-loss'}`} aria-live="assertive">
            <div class="hr-result-place score-font">{t('casino.hr.placing', { n: myPlace })}</div>
            <div class="grow">
              <div class="h3">{t('casino.hr.youFinished', { name: mine.name, n: myPlace })}</div>
              <div class="t-sm t-mid">{t('casino.hr.winner', { name: horses[result.order[0]]?.name ?? '' })}</div>
            </div>
            <div class={`score-font num ${result.net > 0 ? 't-pos' : 't-neg'}`}>{formatMoney(result.net, { sign: true })}</div>
          </div>
        )}

        <div class="hr-bottom">
          <div class="hr-list" role="radiogroup" aria-label={t('casino.hr.pick')}>
            {horses.map((h, i) => (
              <button
                key={h.index}
                type="button"
                role="radio"
                aria-checked={pick === i}
                disabled={racing}
                class={`hr-pick${pick === i ? ' is-active' : ''}`}
                onClick={() => {
                  haptic('select')
                  setPick(i)
                  if (done) reset()
                }}
              >
                <span class="hr-silk" style={{ background: h.color }} aria-hidden="true"><span class="num">{i + 1}</span></span>
                <span class="grow hr-pick-text">
                  <span class="hr-pick-name truncate">{h.name}</span>
                  <span class="t-xs t-lo">{t('casino.hr.form')} {h.form}</span>
                </span>
                <Chip tone="gold">{formatNumber(h.odds, undefined, 1)}</Chip>
              </button>
            ))}
          </div>
          <div class="stack hr-betbox">
            <BetPicker bet={bet} setBet={setBet} disabled={racing} />
            {mine && (
              <div class="row-between t-sm">
                <span class="t-mid">{t('casino.hr.potential')}</span>
                <span class="num t-gold">{formatMoney(Math.round(bet * mine.odds))}</span>
              </div>
            )}
            {done ? (
              <Button variant="secondary" size="lg" block icon="shuffle" onClick={reset}>{t('casino.hr.again')}</Button>
            ) : (
              <Button variant="primary" size="lg" block icon="flag" loading={racing} disabled={pick === null || bet < st.minBet || bet > money} onClick={start}>
                {racing ? t('casino.hr.racing') : t('casino.hr.race')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Page>
  )
}
