/** Tiny SVG charts: Sparkline, LineChart, FormDots, Hearts. No libraries. */
import { t } from '../../i18n'
import { Icon } from '../icons'

function path(values: number[], w: number, h: number, pad: number, min?: number, max?: number): { d: string; pts: [number, number][] } {
  if (values.length === 0) return { d: '', pts: [] }
  const lo = min ?? Math.min(...values)
  const hi = max ?? Math.max(...values)
  const span = hi - lo || 1
  const pts: [number, number][] = values.map((v, i) => [
    pad + (values.length === 1 ? (w - pad * 2) / 2 : (i * (w - pad * 2)) / (values.length - 1)),
    pad + (1 - (v - lo) / span) * (h - pad * 2),
  ])
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('')
  return { d, pts }
}

export function Sparkline({ values, width = 120, height = 36, color = 'var(--brand-pitch)', min, max, fill = true, label }: { values: number[]; width?: number; height?: number; color?: string; min?: number; max?: number; fill?: boolean; label?: string }) {
  const { d, pts } = path(values, width, height, 3, min, max)
  if (!pts.length) return <span class="t-lo t-sm">{t('ui.noForm')}</span>
  const last = pts[pts.length - 1]
  const area = `${d}L${last[0].toFixed(1)} ${height}L${pts[0][0].toFixed(1)} ${height}Z`
  const gid = `sg${Math.round(width)}${values.length}${Math.round(values[0] * 10)}`
  return (
    <svg class="sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label ?? t('ui.sparkline', { n: values.length })}>
      {fill && (
        <>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color={color} stop-opacity=".35" />
              <stop offset="1" stop-color={color} stop-opacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gid})`} />
        </>
      )}
      <path d={d} fill="none" stroke={color} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
      <circle cx={last[0]} cy={last[1]} r="3" fill={color} />
    </svg>
  )
}

/** Responsive line chart with light gridlines (fills its container width). */
export function LineChart({ values, height = 120, color = 'var(--accent-blue)', label, min, max }: { values: number[]; height?: number; color?: string; label?: string; min?: number; max?: number }) {
  const w = 300
  const { d, pts } = path(values, w, height, 8, min, max)
  if (!pts.length) return <span class="t-lo t-sm">{t('common.noData')}</span>
  const last = pts[pts.length - 1]
  const gid = `lc${values.length}${Math.round(values[values.length - 1])}`
  return (
    <svg class="linechart" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" role="img" aria-label={label} style={{ height }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color={color} stop-opacity=".28" />
          <stop offset="1" stop-color={color} stop-opacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1="0" x2={w} y1={height * g} y2={height * g} stroke="var(--border)" stroke-width="1" stroke-dasharray="3 5" vector-effect="non-scaling-stroke" />
      ))}
      <path d={`${d}L${last[0]} ${height}L${pts[0][0]} ${height}Z`} fill={`url(#${gid})`} />
      <path d={d} fill="none" stroke={color} stroke-width="2.2" vector-effect="non-scaling-stroke" stroke-linejoin="round" />
    </svg>
  )
}

/** W/D/L dots with letters (not colour alone). */
export function FormDots({ form }: { form: ('W' | 'D' | 'L')[] }) {
  if (!form.length) return <span class="t-lo t-sm">{t('ui.noForm')}</span>
  return (
    <span class="form-dots">
      {form.map((r, i) => (
        <span key={i} class={`form-dot form-${r}`}>{t(`data.result.${r}`)}</span>
      ))}
    </span>
  )
}

/** −100..100 relationship as 5 hearts (half steps). */
export function Hearts({ value, size = 14 }: { value: number; size?: number }) {
  const n = Math.max(0, Math.min(10, Math.round(((value + 100) / 200) * 10)))
  const label = value >= 60 ? 'great' : value >= 20 ? 'good' : value > -20 ? 'neutral' : value > -60 ? 'poor' : 'hostile'
  return (
    <span class={`hearts hearts-${label}`} role="img" aria-label={`${t(`ui.relation.${label}`)} (${value})`} title={t(`ui.relation.${label}`)}>
      {[0, 1, 2, 3, 4].map((i) => {
        const full = n >= (i + 1) * 2
        const half = !full && n === i * 2 + 1
        return (
          <span key={i} class={`heart ${full ? 'is-full' : half ? 'is-half' : ''}`}>
            <Icon name={full || half ? 'heart-fill' : 'heart'} size={size} weight={2.2} />
          </span>
        )
      })}
    </span>
  )
}
