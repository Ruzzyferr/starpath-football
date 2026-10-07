import type { ComponentChildren } from 'preact'
import { attrColor, clamp01 } from '../format'
import { useMounted } from '../hooks/motion'

export interface StatBarProps {
  label?: string
  value: number
  max?: number
  /** Optional XP sliver (progress toward next point, 0..1). */
  progress?: number
  /** Preview delta (+/−) drawn as a ghost extension or loss segment. */
  preview?: number
  color?: string
  /** Use the attribute colour scale for value 0..100. */
  scale?: boolean
  showValue?: boolean
  size?: 'sm' | 'md' | 'lg'
  suffix?: string
  /** Trailing element after the label (e.g. an info tooltip). */
  info?: ComponentChildren
}

export function StatBar({ label, value, max = 100, progress, preview, color, scale, showValue = true, size = 'md', suffix, info }: StatBarProps) {
  const mounted = useMounted()
  const p = clamp01(value / max)
  const fill = color ?? (scale ? attrColor((value / max) * 100) : 'var(--brand-pitch)')
  const pv = preview ? clamp01((value + preview) / max) : null
  return (
    <div class={`statbar statbar-${size}`}>
      {(label || showValue) && (
        <div class="statbar-top">
          {label && (info ? <span class="label-with-tip"><span class="statbar-label truncate">{label}</span>{info}</span> : <span class="statbar-label truncate">{label}</span>)}
          {showValue && (
            <span class="statbar-value num" style={{ color: scale ? fill : undefined }}>
              {Math.round(value)}
              {suffix}
              {preview ? <span class={preview > 0 ? 't-pos' : 't-neg'}> {preview > 0 ? '+' : '−'}{Math.abs(preview)}</span> : null}
            </span>
          )}
        </div>
      )}
      <div class="statbar-track" role="meter" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max}>
        {pv !== null && pv > p && <div class="statbar-preview" style={{ transform: `scaleX(${pv})`, background: fill }} />}
        <div class="statbar-fill" style={{ transform: `scaleX(${mounted ? p : 0})`, background: fill }} />
        {pv !== null && pv < p && <div class="statbar-loss" style={{ left: `${pv * 100}%`, width: `${(p - pv) * 100}%` }} />}
        {progress !== undefined && <div class="statbar-xp" style={{ transform: `scaleX(${mounted ? clamp01(progress) : 0})` }} />}
      </div>
    </div>
  )
}
