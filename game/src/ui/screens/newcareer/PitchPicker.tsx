import type { Position } from '../../../core/types'
import { t } from '../../../i18n'
import { haptic } from '../../haptics'

/** Vertical pitch, own goal at the bottom. Coordinates in metres (68 × 105). */
export const POS_XY: Record<Position, [number, number]> = {
  GK: [34, 97],
  CB: [34, 84],
  LB: [9, 77],
  RB: [59, 77],
  DM: [34, 70],
  CM: [34, 57],
  AM: [34, 43],
  LW: [10, 34],
  RW: [58, 34],
  ST: [34, 20],
}
const ORDER: Position[] = ['ST', 'LW', 'RW', 'AM', 'CM', 'DM', 'LB', 'RB', 'CB', 'GK']

export function PitchPicker({ value, onChange }: { value: Position; onChange: (p: Position) => void }) {
  const onKey = (e: KeyboardEvent) => {
    const i = ORDER.indexOf(value)
    let n = i
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') n = Math.min(ORDER.length - 1, i + 1)
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') n = Math.max(0, i - 1)
    else return
    e.preventDefault()
    onChange(ORDER[n])
    const el = (e.currentTarget as HTMLElement).querySelector<HTMLButtonElement>(`[data-pos="${ORDER[n]}"]`)
    el?.focus()
  }
  return (
    <div class="wiz-pitch" role="radiogroup" aria-label={t('wizard.pickPosition')} onKeyDown={onKey}>
      <svg class="wiz-pitch-svg" viewBox="0 0 68 105" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <pattern id="wiz-mow" width="68" height="15" patternUnits="userSpaceOnUse">
            <rect width="68" height="7.5" fill="var(--pitch-a)" />
            <rect y="7.5" width="68" height="7.5" fill="var(--pitch-b)" />
          </pattern>
        </defs>
        <rect width="68" height="105" fill="url(#wiz-mow)" />
        <g fill="none" stroke="var(--pitch-line)" stroke-width="0.5">
          <rect x="1.5" y="1.5" width="65" height="102" />
          <path d="M1.5 52.5H66.5" />
          <circle cx="34" cy="52.5" r="9.15" />
          <rect x="13.85" y="1.5" width="40.3" height="16.5" />
          <rect x="24.84" y="1.5" width="18.32" height="5.5" />
          <rect x="13.85" y="87" width="40.3" height="16.5" />
          <rect x="24.84" y="98" width="18.32" height="5.5" />
          <path d="M26.7 18a9.15 9.15 0 0 0 14.6 0M26.7 87a9.15 9.15 0 0 1 14.6 0" />
        </g>
      </svg>
      <div class="wiz-pitch-shade" aria-hidden="true" />
      {ORDER.map((p) => {
        const [x, y] = POS_XY[p]
        const sel = p === value
        return (
          <button
            key={p}
            type="button"
            role="radio"
            data-pos={p}
            aria-checked={sel}
            aria-label={t(`data.posLong.${p}`)}
            tabIndex={sel ? 0 : -1}
            class={`wiz-pos${sel ? ' is-active' : ''}`}
            style={{ left: `${(x / 68) * 100}%`, top: `${(y / 105) * 100}%` }}
            onClick={() => {
              haptic('select')
              onChange(p)
            }}
          >
            <span class="wiz-pos-dot">{t(`data.pos.${p}`)}</span>
          </button>
        )
      })}
    </div>
  )
}
