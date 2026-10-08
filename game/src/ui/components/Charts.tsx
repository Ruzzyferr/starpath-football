/** Tiny SVG charts: Sparkline, LineChart, FormDots, Hearts. No libraries. */
import { useState } from 'preact/hooks'
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

export function Sparkline({ values, width = 120, height = 36, color = 'var(--brand-pitch)', min, max, fill = true, label, format }: { values: number[]; width?: number; height?: number; color?: string; min?: number; max?: number; fill?: boolean; label?: string; format?: (v: number) => string }) {
  const { d, pts } = path(values, width, height, 3, min, max)
  const [sel, setSel] = useState<number | null>(null)
  if (!pts.length) return <span class="t-lo t-sm">{t('ui.noForm')}</span>
  const last = pts[pts.length - 1]!
  const area = `${d}L${last[0].toFixed(1)} ${height}L${pts[0]![0].toFixed(1)} ${height}Z`
  const gid = `sg${Math.round(width)}${values.length}${Math.round(values[0]! * 10)}`
  const fmt = format ?? ((v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1)))
  // Tap / hover / arrow keys pick the nearest point and read its value (GAP 2.7#56).
  const pick = (clientX: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect()
    const x = ((clientX - r.left) / (r.width || 1)) * width
    let best = 0
    pts.forEach(([px], i) => { if (Math.abs(px - x) < Math.abs(pts[best]![0] - x)) best = i })
    setSel(best)
  }
  const shown = sel ?? values.length - 1
  return (
    <span class="sparkline-wrap" style={{ width }}>
      <svg
        class="sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" tabIndex={0}
        aria-label={`${label ?? t('ui.sparkline', { n: values.length })}: ${fmt(values[shown]!)}`}
        onPointerDown={(e) => pick(e.clientX, e.currentTarget as SVGSVGElement)}
        onPointerMove={(e) => { if (e.pointerType === 'mouse' || e.buttons) pick(e.clientX, e.currentTarget as SVGSVGElement) }}
        onPointerLeave={() => setSel(null)}
        onBlur={() => setSel(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') { e.preventDefault(); setSel(Math.max(0, shown - 1)) }
          else if (e.key === 'ArrowRight') { e.preventDefault(); setSel(Math.min(values.length - 1, shown + 1)) }
          else if (e.key === 'Escape') setSel(null)
        }}
      >
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
        <circle cx={pts[shown]![0]} cy={pts[shown]![1]} r={sel === null ? 3 : 4.5} fill={color} stroke={sel === null ? 'none' : 'var(--surface-1)'} stroke-width="2" />
      </svg>
      {sel !== null && (
        <output class="sparkline-read num" style={{ left: `${Math.min(Math.max(pts[sel]![0], 18), width - 18)}px` }}>{fmt(values[sel]!)}</output>
      )}
    </span>
  )
}

/** Responsive line chart with light gridlines (fills its container width). */
export function LineChart({ values, height = 120, color = 'var(--accent-blue)', label, min, max }: { values: number[]; height?: number; color?: string; label?: string; min?: number; max?: number }) {
  const w = 300
  const { d, pts } = path(values, w, height, 8, min, max)
  if (!pts.length) return <span class="t-lo t-sm">{t('common.noData')}</span>
  const last = pts[pts.length - 1]!
  const gid = `lc${values.length}${Math.round(values[values.length - 1]!)}`
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
      <path d={`${d}L${last[0]} ${height}L${pts[0]![0]} ${height}Z`} fill={`url(#${gid})`} />
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

// ───────────────────────── Pitch maps (post-match) ─────────────────────────

/** Horizontal pitch markings in a 105 × 68 viewBox (hero attacks left → right). */
function PitchMarks() {
  return (
    <g class="pmap-lines" fill="none" stroke="currentColor" stroke-width=".55">
      <rect x=".5" y=".5" width="104" height="67" rx=".8" />
      <path d="M52.5 .5v67" />
      <circle cx="52.5" cy="34" r="9.15" />
      <rect x=".5" y="13.85" width="16.5" height="40.3" />
      <rect x="88" y="13.85" width="16.5" height="40.3" />
      <rect x=".5" y="24.84" width="5.5" height="18.32" />
      <rect x="99" y="24.84" width="5.5" height="18.32" />
      <path d="M104.5 30.34v7.32" stroke-width="1.6" />
    </g>
  )
}

/**
 * Heat map: `heat` is cols × rows (row-major, row = y band). Cells are drawn
 * as soft blobs whose opacity follows the normalised weight.
 */
export function HeatMap({ heat, cols, rows, label }: { heat: readonly number[]; cols: number; rows: number; label: string }) {
  const max = Math.max(0, ...heat)
  const cw = 105 / cols
  const ch = 68 / rows
  const cells: { x: number; y: number; v: number }[] = []
  if (max > 0) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = (heat[r * cols + c] ?? 0) / max
        if (v > 0.02) cells.push({ x: c * cw + cw / 2, y: r * ch + ch / 2, v })
      }
    }
  }
  const rad = Math.max(cw, ch) * 0.95
  return (
    <svg class="pmap pmap-heat" viewBox="0 0 105 68" role="img" aria-label={label}>
      <defs>
        <radialGradient id="pmapBlob">
          <stop offset="0" stop-color="var(--heat-hot, #ff5a36)" stop-opacity="1" />
          <stop offset=".55" stop-color="var(--heat-mid, #ffb020)" stop-opacity=".55" />
          <stop offset="1" stop-color="var(--heat-mid, #ffb020)" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect class="pmap-grass" x="0" y="0" width="105" height="68" />
      {cells.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={rad * (0.7 + p.v * 0.5)} fill="url(#pmapBlob)" opacity={0.18 + p.v * 0.7} />
      ))}
      <PitchMarks />
    </svg>
  )
}

export type ShotOutcome = 'goal' | 'saved' | 'missed' | 'blocked' | 'woodwork'
export interface ShotPoint { x: number; y: number; outcome: ShotOutcome; header?: boolean; xg: number; minute: number }

/** Shot marker shape by outcome (not colour alone). */
export function ShotMarker({ outcome, x, y, r }: { outcome: ShotOutcome; x: number; y: number; r: number }) {
  switch (outcome) {
    case 'goal':
      return <circle class="shot-m shot-goal" cx={x} cy={y} r={r} />
    case 'saved':
      return <rect class="shot-m shot-saved" x={x - r * 0.85} y={y - r * 0.85} width={r * 1.7} height={r * 1.7} rx={r * 0.3} />
    case 'woodwork':
      return <path class="shot-m shot-woodwork" d={`M${x} ${y - r}L${x + r} ${y + r * 0.8}L${x - r} ${y + r * 0.8}Z`} />
    case 'blocked':
      return <path class="shot-m shot-blocked" d={`M${x - r} ${y - r}L${x + r} ${y + r}M${x + r} ${y - r}L${x - r} ${y + r}`} />
    default:
      return <circle class="shot-m shot-missed" cx={x} cy={y} r={r} />
  }
}

/** Shot map: positions normalised 0..1 (x toward the opponent goal). Marker size grows with xG. */
export function ShotMap({ shots, label }: { shots: readonly ShotPoint[]; label: string }) {
  const goal = { x: 105, y: 34 }
  return (
    <svg class="pmap pmap-shots" viewBox="0 0 105 68" role="img" aria-label={label}>
      <rect class="pmap-grass" x="0" y="0" width="105" height="68" />
      <PitchMarks />
      {shots.map((s, i) => {
        const x = Math.max(1, Math.min(104, s.x * 105))
        const y = Math.max(1, Math.min(67, s.y * 68))
        const r = 1.1 + Math.sqrt(Math.max(0, Math.min(1, s.xg))) * 2.2
        return (
          <g key={i} class={`shot shot-${s.outcome}`}>
            <line class="shot-line" x1={x} y1={y} x2={goal.x} y2={goal.y} />
            <ShotMarker outcome={s.outcome} x={x} y={y} r={r} />
            {s.header && <circle class="shot-header" cx={x} cy={y} r={r + 1} />}
            <title>{`${s.minute}' · xG ${s.xg.toFixed(2)}`}</title>
          </g>
        )
      })}
    </svg>
  )
}
