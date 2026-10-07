/** Form controls: Slider (with ± steppers), Switch, Segmented, TextField. */
import type { ComponentChildren } from 'preact'
import { t } from '../../i18n'
import { Icon } from '../icons'
import { haptic } from '../haptics'

export function Slider({
  label, value, min, max, step = 1, onChange, format, hint, marker, markerLabel, id,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  format?: (v: number) => string
  hint?: ComponentChildren
  /** Optional reference marker (e.g. club offer) drawn on the track. */
  marker?: number
  markerLabel?: string
  id?: string
}) {
  const sid = id ?? `sl-${label.replace(/\W+/g, '').toLowerCase()}`
  const pct = ((value - min) / (max - min || 1)) * 100
  const mpct = marker !== undefined ? ((marker - min) / (max - min || 1)) * 100 : null
  const set = (v: number) => {
    const c = Math.max(min, Math.min(max, Math.round(v / step) * step))
    if (c !== value) {
      haptic('select')
      onChange(c)
    }
  }
  return (
    <div class="slider-field">
      <div class="row-between">
        <label for={sid} class="slider-label">{label}</label>
        <output for={sid} class="slider-value num">{format ? format(value) : value}</output>
      </div>
      <div class="slider-row">
        <button type="button" class="icon-btn icon-btn-solid slider-step" onClick={() => set(value - step)} aria-label={`${t('ui.slider.decrease')} ${label}`} disabled={value <= min}>
          <Icon name="minus" size={18} />
        </button>
        <div class="slider-track-wrap" style={{ ['--pct' as string]: `${pct}%` }}>
          {mpct !== null && <span class="slider-marker" style={{ left: `${mpct}%` }} title={markerLabel} aria-hidden="true" />}
          <input
            id={sid}
            type="range"
            class="slider"
            min={min}
            max={max}
            step={step}
            value={value}
            aria-valuetext={format ? format(value) : String(value)}
            onInput={(e) => set(Number((e.currentTarget as HTMLInputElement).value))}
          />
        </div>
        <button type="button" class="icon-btn icon-btn-solid slider-step" onClick={() => set(value + step)} aria-label={`${t('ui.slider.increase')} ${label}`} disabled={value >= max}>
          <Icon name="plus" size={18} />
        </button>
      </div>
      {hint && <div class="t-xs t-lo">{hint}</div>}
    </div>
  )
}

export function Switch({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <label class="switch-row">
      <span class="grow">
        <span class="switch-label">{label}</span>
        {desc && <span class="t-xs t-lo switch-desc">{desc}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        class="switch"
        checked={checked}
        aria-checked={checked}
        onChange={(e) => {
          haptic('select')
          onChange((e.currentTarget as HTMLInputElement).checked)
        }}
      />
    </label>
  )
}

export function Segmented<K extends string | number>({ options, value, onChange, label }: { options: { id: K; label: string }[]; value: K; onChange: (v: K) => void; label: string }) {
  return (
    <div class="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.id)}
          type="button"
          role="radio"
          aria-checked={o.id === value}
          class={`segmented-opt${o.id === value ? ' is-active' : ''}`}
          onClick={() => {
            haptic('select')
            onChange(o.id)
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function TextField({ label, value, onInput, maxLength = 24, placeholder, id, autoFocus }: { label: string; value: string; onInput: (v: string) => void; maxLength?: number; placeholder?: string; id?: string; autoFocus?: boolean }) {
  const fid = id ?? `tf-${label.replace(/\W+/g, '').toLowerCase()}`
  return (
    <div class="text-field">
      <label for={fid}>{label}</label>
      <input
        id={fid}
        type="text"
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete="off"
        autoFocus={autoFocus}
        spellcheck={false}
        onInput={(e) => onInput((e.currentTarget as HTMLInputElement).value)}
      />
    </div>
  )
}
