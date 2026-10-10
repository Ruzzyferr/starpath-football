/**
 * Odds wheel (tester feedback, TestFlight build 6): after a risky choice the
 * card's exact odds become a wheel — green = it works, amber = it half works,
 * red = it backfires — and the wheel spins to the draw the sim already made.
 *
 * Honesty: the outcome is decided first by the seeded game rng (sim/life/events/odds
 * rollChoice). The wheel only animates to that draw: the arcs are the card's whole
 * percentages and the pointer stops at `roll * 360°`, inside the band that decided
 * the tier. Nothing here is random.
 */
import { useEffect, useRef, useState } from 'preact/hooks'
import { t } from '../../i18n'
import { haptic } from '../haptics'
import type { EventOutcomeView } from '../store'

type Tier = 'success' | 'mixed' | 'fail'

export interface WheelBands {
  success: number // whole percent
  mixed: number
  fail: number
}

export function bandsOf(out: EventOutcomeView): WheelBands | null {
  if (out.pct === undefined || out.roll === undefined) return null
  const success = out.pct
  const mixed = out.mixedPct ?? 0
  return { success, mixed, fail: Math.max(0, 100 - success - mixed) }
}

/** The band a roll lands in (same whole-percent rule as the sim). */
export function tierAt(b: WheelBands, roll: number): Tier {
  const x = roll * 100
  return x < b.success ? 'success' : x < b.success + b.mixed ? 'mixed' : 'fail'
}

const pc = (n: number): string => t('event.pct', { n })

const R = 100 // svg viewBox radius
const RING = 86 // outer edge of the coloured arcs
const HOLE = 40 // hub radius

/** Point on a circle, angle in degrees clockwise from 12 o'clock. */
const at = (deg: number, r: number): [number, number] => {
  const a = ((deg - 90) * Math.PI) / 180
  return [R + r * Math.cos(a), R + r * Math.sin(a)]
}

function arc(a0: number, a1: number, r0: number, r1: number): string {
  const large = a1 - a0 > 180 ? 1 : 0
  const [x0, y0] = at(a0, r1)
  const [x1, y1] = at(a1, r1)
  const [x2, y2] = at(a1, r0)
  const [x3, y3] = at(a0, r0)
  const f = (n: number) => n.toFixed(3)
  return `M${f(x0)} ${f(y0)}A${r1} ${r1} 0 ${large} 1 ${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}A${r0} ${r0} 0 ${large} 0 ${f(x3)} ${f(y3)}Z`
}

const SPIN_MS = 2200
const TURNS = 5
const HOLD_MS = 750
/** Fast start, long gentle stop (like a real wheel bleeding speed). */
const ease = (p: number): number => 1 - Math.pow(1 - p, 4)

/** `upright`: the wheel's final rotation, so the % labels read level once it stops. */
function WheelFace({ bands, upright }: { bands: WheelBands; upright: number }) {
  const segs: { tier: Tier; a0: number; a1: number }[] = []
  let acc = 0
  for (const tier of ['success', 'mixed', 'fail'] as const) {
    const w = bands[tier]
    if (w > 0) segs.push({ tier, a0: acc * 3.6, a1: (acc + w) * 3.6 })
    acc += w
  }
  return (
    <svg viewBox="0 0 200 200" class="ow-face" aria-hidden="true">
      <defs>
        <radialGradient id="ow-g-success" cx="50%" cy="50%" r="50%">
          <stop offset="45%" stop-color="var(--brand-pitch-deep)" />
          <stop offset="100%" stop-color="var(--state-success)" />
        </radialGradient>
        <radialGradient id="ow-g-mixed" cx="50%" cy="50%" r="50%">
          <stop offset="45%" stop-color="var(--accent-gold-deep)" />
          <stop offset="100%" stop-color="var(--state-warning)" />
        </radialGradient>
        <radialGradient id="ow-g-fail" cx="50%" cy="50%" r="50%">
          <stop offset="45%" stop-color="var(--state-danger-deep)" />
          <stop offset="100%" stop-color="var(--state-danger)" />
        </radialGradient>
      </defs>
      <circle cx={R} cy={R} r={R - 1} class="ow-rim" />
      {segs.map((s) => (
        <path key={s.tier} d={arc(s.a0, s.a1, HOLE + 4, RING)} fill={`url(#ow-g-${s.tier})`} class={`ow-seg is-${s.tier}`} />
      ))}
      {segs.map((s) => (
        <line key={`d${s.tier}`} x1={at(s.a0, HOLE + 4)[0]} y1={at(s.a0, HOLE + 4)[1]} x2={at(s.a0, RING)[0]} y2={at(s.a0, RING)[1]} class="ow-divider" />
      ))}
      {Array.from({ length: 20 }, (_, i) => {
        const [x0, y0] = at(i * 18, RING + 3)
        const [x1, y1] = at(i * 18, i % 5 === 0 ? R - 4 : R - 7)
        return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} class={`ow-peg${i % 5 === 0 ? ' is-major' : ''}`} />
      })}
      {segs.map((s) => {
        if (s.a1 - s.a0 < 26) return null
        const mid = (s.a0 + s.a1) / 2
        const [x, y] = at(mid, (RING + HOLE) / 2 + 3)
        return (
          <text key={`t${s.tier}`} x={x} y={y} class="ow-seg-label" text-anchor="middle" dominant-baseline="central" transform={`rotate(${-upright} ${x} ${y})`}>
            {pc(bands[s.tier])}
          </text>
        )
      })}
    </svg>
  )
}

export function OddsWheel({ out, label, onDone }: { out: EventOutcomeView; label?: string; onDone: () => void }) {
  const bands = bandsOf(out)!
  const roll = out.roll ?? 0
  const tier = tierAt(bands, roll)
  const target = TURNS * 360 - roll * 360
  const spinner = useRef<HTMLDivElement>(null)
  const [landed, setLanded] = useState(false)
  const finished = useRef(false)
  const raf = useRef(0)
  const holdTimer = useRef(0)

  const finish = () => {
    if (finished.current) return
    finished.current = true
    cancelAnimationFrame(raf.current)
    clearTimeout(holdTimer.current)
    onDone()
  }

  const land = () => {
    cancelAnimationFrame(raf.current)
    if (spinner.current) spinner.current.style.transform = `rotate(${target}deg)`
    setLanded(true)
    haptic(tier === 'success' ? 'success' : 'warning')
    holdTimer.current = window.setTimeout(finish, HOLD_MS)
  }

  useEffect(() => {
    const t0 = performance.now()
    let lastPeg = 0
    let lastTick = 0
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / SPIN_MS)
      const rot = target * ease(p)
      if (spinner.current) spinner.current.style.transform = `rotate(${rot}deg)`
      // A tick each time a peg passes the pointer (throttled so the fast start is a buzz, not a drone).
      const peg = Math.floor(rot / 18)
      if (peg !== lastPeg && now - lastTick > 55) {
        lastTick = now
        haptic('tap')
      }
      lastPeg = peg
      if (p < 1) raf.current = requestAnimationFrame(step)
      else land()
    }
    raf.current = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf.current)
      clearTimeout(holdTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const skip = () => {
    if (!landed) land()
    else finish()
  }
  const name = (x: Tier) => t(x === 'success' ? 'event.bandSuccess' : x === 'mixed' ? 'event.bandMixed' : 'event.bandFail')

  return (
    <div class={`ow-stage${landed ? ` is-landed is-${tier}` : ''}`} data-testid="odds-wheel" data-tier={landed ? tier : undefined} onClick={skip}>
      <div class="micro t-mid ow-kicker">{t('event.wheelTitle')}</div>
      {label && <div class="ow-choice">{label}</div>}
      <div class="ow-wheel" role="img" aria-label={t('event.wheelAria', { s: bands.success, m: bands.mixed, f: bands.fail })}>
        <div class="ow-glow" aria-hidden="true" />
        <div class="ow-spinner" ref={spinner}>
          <WheelFace bands={bands} upright={target} />
        </div>
        <div class="ow-hub" aria-hidden="true">
          {landed ? <span class="ow-hub-tier">{name(tier)}</span> : <span class="ow-hub-dot" />}
        </div>
        <svg class="ow-pointer" viewBox="0 0 40 48" aria-hidden="true">
          <path d="M20 46 L4 8 Q20 -2 36 8 Z" />
          <circle cx="20" cy="13" r="4.5" />
        </svg>
      </div>
      <div class="ow-legend" aria-hidden="true">
        <span class="ow-key is-success"><i />{name('success')} <b class="num">{pc(bands.success)}</b></span>
        {bands.mixed > 0 && <span class="ow-key is-mixed"><i />{name('mixed')} <b class="num">{pc(bands.mixed)}</b></span>}
        {bands.fail > 0 && <span class="ow-key is-fail"><i />{name('fail')} <b class="num">{pc(bands.fail)}</b></span>}
      </div>
      <button type="button" class="ow-skip t-sm" onClick={(e) => { e.stopPropagation(); skip() }}>
        {landed ? t('event.continue') : t('event.wheelSkip')}
      </button>
      <span class="sr-only" role="status" aria-live="polite">
        {landed ? t('event.wheelLanded', { tier: name(tier) }) : t('event.wheelSpinning')}
      </span>
    </div>
  )
}

/** Static recap under the outcome (and the whole story when motion is reduced): the bands and where the draw fell. */
export function RollStrip({ out }: { out: EventOutcomeView }) {
  const b = bandsOf(out)
  if (!b || out.roll === undefined) return null
  const pos = Math.min(99.5, Math.max(0.5, out.roll * 100))
  return (
    <div class="ow-strip" data-testid="roll-strip" aria-label={t('event.stripAria', { s: b.success, m: b.mixed, f: b.fail, n: Math.floor(out.roll * 100) })} role="img">
      <div class="ow-strip-bar">
        <span class="is-success" style={{ width: `${b.success}%` }} />
        {b.mixed > 0 && <span class="is-mixed" style={{ width: `${b.mixed}%` }} />}
        {b.fail > 0 && <span class="is-fail" style={{ width: `${b.fail}%` }} />}
        <i class="ow-strip-mark" style={{ left: `${pos}%` }} />
      </div>
    </div>
  )
}
