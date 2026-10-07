import type { ComponentChildren } from 'preact'
import { clamp01 } from '../format'
import { useMounted } from '../hooks/motion'
import { t } from '../../i18n'
import { Icon, type IconName } from '../icons'

export interface MeterRingProps {
  value: number
  max?: number
  size?: number
  stroke?: number
  color?: string
  track?: string
  label?: string
  icon?: IconName
  children?: ComponentChildren
  ariaLabel?: string
  /** Trailing element after the label (e.g. an info tooltip). */
  info?: ComponentChildren
  /** Show a warning badge and pulse when the value falls below this share of max (default 0.2). Pass 0 to disable. */
  lowAt?: number
}

export function MeterRing({ value, max = 100, size = 72, stroke = 7, color = 'var(--brand-pitch)', track = 'var(--surface-3)', label, icon, children, ariaLabel, info, lowAt = 0.2 }: MeterRingProps) {
  const mounted = useMounted()
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const p = clamp01(value / max)
  const low = lowAt > 0 && p < lowAt
  return (
    <div class={`meter-ring${low ? ' is-low' : ''}`} style={{ minWidth: size }}>
      <div
        class="meter-ring-dial"
        style={{ width: size, height: size }}
        role="meter"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={`${ariaLabel ?? `${label ?? ''} ${Math.round(value)}`}${low ? `, ${t('ui.meterLow')}` : ''}`}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} stroke-width={stroke} />
          <circle
            class="meter-ring-arc"
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            stroke-width={stroke}
            stroke-linecap="round"
            stroke-dasharray={c}
            stroke-dashoffset={mounted ? c * (1 - p) : c}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        <div class="meter-ring-center">
          {children ?? (icon
            ? <Icon name={icon} size={size * 0.32} style={{ color }} />
            : <span class="score-font" style={{ fontSize: `${size * 0.34}px` }}>{Math.round(value)}</span>)}
        </div>
        {low && <span class="meter-ring-low" aria-hidden="true"><Icon name="warning" size={12} weight={2.6} /></span>}
      </div>
      {label && <div class="meter-ring-label micro t-mid" aria-hidden={info ? undefined : 'true'}>{label}{info}</div>}
    </div>
  )
}
