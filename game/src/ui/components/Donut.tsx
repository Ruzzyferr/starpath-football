/** Donut and weekly-bar SVG charts (finance, GAP 2.7#59). Same style as Charts.tsx; no libraries. */
import { t } from '../../i18n'

export interface DonutSlice {
  id: string
  label: string
  value: number
  /** Pre-formatted value for the legend. */
  text: string
}

/** Categorical colours; the legend always carries name, amount and share so colour is never the only cue. */
const DONUT_COLORS = ['var(--brand-pitch)', 'var(--accent-gold)', 'var(--accent-blue)', 'var(--accent-violet)', 'var(--attr-2)', 'var(--tier-silver)']

/**
 * Donut with a tap-to-inspect legend. Selecting a slice (ring or legend row)
 * shows its name and share in the centre.
 */
export function DonutChart({ slices, label, total, size = 148, onSelect, selected }: {
  slices: DonutSlice[]
  label: string
  total: string
  size?: number
  selected?: string | null
  onSelect?: (id: string | null) => void
}) {
  const sum = slices.reduce((s, x) => s + x.value, 0)
  if (sum <= 0) return <span class="t-lo t-sm">{t('common.noData')}</span>
  const stroke = 22
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  let acc = 0
  const sel = slices.find((s) => s.id === selected) ?? null
  const pick = (id: string) => onSelect?.(sel?.id === id ? null : id)
  return (
    <div class="donut">
      <div class="donut-dial" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" stroke-width={stroke} />
          {slices.map((s, i) => {
            const len = (s.value / sum) * c
            const gap = slices.length > 1 ? 2 : 0
            const el = (
              <circle
                key={s.id}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
                stroke-width={sel && sel.id !== s.id ? stroke - 6 : stroke}
                stroke-dasharray={`${Math.max(0, len - gap)} ${c}`}
                stroke-dashoffset={-acc}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                class="donut-arc"
                onClick={() => pick(s.id)}
              />
            )
            acc += len
            return el
          })}
        </svg>
        <div class="donut-center" aria-hidden="true">
          {sel ? (
            <>
              <span class="micro t-lo truncate">{sel.label}</span>
              <b class="score-font num">{Math.round((sel.value / sum) * 100)}%</b>
            </>
          ) : (
            <b class="score-font num">{total}</b>
          )}
        </div>
      </div>
      <ul class="donut-legend">
        {slices.map((s, i) => (
          <li key={s.id}>
            <button type="button" class="donut-row" aria-pressed={sel?.id === s.id} onClick={() => pick(s.id)}>
              <span class="donut-dot" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} aria-hidden="true" />
              <span class="grow truncate">{s.label}</span>
              <span class="num t-sm">{s.text}</span>
              <span class="num t-xs t-lo donut-pct">{Math.round((s.value / sum) * 100)}%</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Weekly +/- bars around a zero line; tap or press a bar to read its value elsewhere. */
export function WeekBars({ values, label, height = 96, format, selected, onSelect }: {
  values: number[]
  label: string
  height?: number
  format: (v: number) => string
  selected?: number | null
  onSelect?: (i: number | null) => void
}) {
  if (!values.length) return <span class="t-lo t-sm">{t('common.noData')}</span>
  const max = Math.max(1, ...values.map((v) => Math.abs(v)))
  const w = 300
  const bw = w / values.length
  const mid = height / 2
  const pick = (i: number) => onSelect?.(selected === i ? null : i)
  return (
    <svg class="weekbars" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" role="group" aria-label={label} style={{ height }}>
      <line x1="0" x2={w} y1={mid} y2={mid} stroke="var(--border-strong)" stroke-width="1" vector-effect="non-scaling-stroke" />
      {values.map((v, i) => {
        const h = Math.max(1.5, (Math.abs(v) / max) * (mid - 4))
        const dim = selected !== null && selected !== undefined && selected !== i
        return (
          <g
            key={i}
            class="weekbars-bar"
            tabIndex={0}
            role="button"
            aria-label={format(v)}
            aria-pressed={selected === i}
            onClick={() => pick(i)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                pick(i)
              }
            }}
          >
            <rect x={i * bw} y={0} width={bw} height={height} fill="transparent" />
            <rect x={i * bw + (bw - Math.min(bw * 0.64, 16)) / 2} y={v >= 0 ? mid - h : mid} width={Math.min(bw * 0.64, 16)} height={h} rx="2" fill={v >= 0 ? 'var(--pos)' : 'var(--neg)'} opacity={dim ? 0.4 : 1} />
          </g>
        )
      })}
    </svg>
  )
}
