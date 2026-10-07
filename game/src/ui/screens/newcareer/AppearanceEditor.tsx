import type { ComponentChildren } from 'preact'
import type { Appearance } from '../../../core/types'
import { Rng } from '../../../core/rng'
import { t, type TKey } from '../../../i18n'
import {
  ACCESSORY_COUNT, BEARD_COUNT, EYE_COLORS, FACE_COUNT, HAIR_COLORS, HAIR_STYLE_COUNT, SKIN_TONES,
} from '../../art/avatar'
import { Avatar, Button } from '../../components'
import { Icon } from '../../icons'
import { haptic } from '../../haptics'

export function randomAppearance(seed: number = Date.now()): Appearance {
  const r = new Rng(seed)
  return {
    skin: r.int(0, SKIN_TONES.length - 1),
    hairStyle: r.int(0, HAIR_STYLE_COUNT - 1),
    hairColor: r.weighted([0, 1, 2, 3, 4, 5, 6, 7, 8], (i) => (i <= 3 ? 4 : 1)),
    beard: r.chance(0.55) ? 0 : r.int(1, BEARD_COUNT - 1),
    eyeColor: r.int(0, EYE_COLORS.length - 1),
    face: r.int(0, FACE_COUNT - 1),
    accessory: r.chance(0.6) ? 0 : r.int(1, ACCESSORY_COUNT - 2),
  }
}

type Key = keyof Appearance

function OptionGroup({ label, count, value, onChange, render, swatch }: {
  label: string
  count: number
  value: number
  onChange: (v: number) => void
  render: (i: number) => ComponentChildren
  swatch?: boolean
}) {
  const set = (v: number) => {
    haptic('select')
    onChange(((v % count) + count) % count)
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') set(value + 1)
    else if (e.key === 'ArrowLeft') set(value - 1)
    else return
    e.preventDefault()
    const wrap = e.currentTarget as HTMLElement
    requestAnimationFrame(() => wrap.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus())
  }
  return (
    <fieldset class="wiz-opt">
      <legend class="wiz-opt-head">
        <span class="label">{label}</span>
        <span class="wiz-opt-nav">
          <button type="button" class="icon-btn icon-btn-solid" aria-label={t('wizard.look.prev', { what: label })} onClick={() => set(value - 1)}>
            <Icon name="chevron-left" size={18} />
          </button>
          <span class="num t-mid wiz-opt-count">{value + 1}/{count}</span>
          <button type="button" class="icon-btn icon-btn-solid" aria-label={t('wizard.look.next', { what: label })} onClick={() => set(value + 1)}>
            <Icon name="chevron-right" size={18} />
          </button>
        </span>
      </legend>
      <div class={`wiz-opt-row${swatch ? ' is-swatch' : ''}`} role="radiogroup" aria-label={label} onKeyDown={onKey}>
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={i === value}
            aria-label={t('wizard.look.option', { what: label, n: i + 1 })}
            tabIndex={i === value ? 0 : -1}
            class={`wiz-thumb${i === value ? ' is-active' : ''}`}
            onClick={() => set(i)}
          >
            {render(i)}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function AppearanceEditor({ value, onChange, shirt, trim }: { value: Appearance; onChange: (a: Appearance) => void; shirt: string; trim: string }) {
  const patch = (k: Key, v: number) => onChange({ ...value, [k]: v })
  const thumb = (k: Key, i: number) => (
    <Avatar appearance={{ ...value, [k]: i }} size={48} shirt={shirt} shirtTrim={trim} background="#1b2740" />
  )
  const swatch = (color: string) => <span class="wiz-swatch" style={{ background: color }} />
  const groups: { k: Key; label: TKey; count: number; render: (i: number) => ComponentChildren; swatch?: boolean }[] = [
    { k: 'skin', label: 'wizard.look.skin', count: SKIN_TONES.length, render: (i) => swatch(SKIN_TONES[i]), swatch: true },
    { k: 'hairStyle', label: 'wizard.look.hairStyle', count: HAIR_STYLE_COUNT, render: (i) => thumb('hairStyle', i) },
    { k: 'hairColor', label: 'wizard.look.hairColor', count: HAIR_COLORS.length, render: (i) => swatch(HAIR_COLORS[i]), swatch: true },
    { k: 'beard', label: 'wizard.look.beard', count: BEARD_COUNT, render: (i) => thumb('beard', i) },
    { k: 'eyeColor', label: 'wizard.look.eyes', count: EYE_COLORS.length, render: (i) => swatch(EYE_COLORS[i]), swatch: true },
    { k: 'face', label: 'wizard.look.face', count: FACE_COUNT, render: (i) => thumb('face', i) },
    { k: 'accessory', label: 'wizard.look.accessory', count: ACCESSORY_COUNT, render: (i) => thumb('accessory', i) },
  ]
  return (
    <div class="wiz-look">
      <div class="wiz-look-preview">
        <div class="wiz-look-stage">
          <Avatar appearance={value} size="100%" shirt={shirt} shirtTrim={trim} background="#1b2740" mood={0.5} />
        </div>
        <Button variant="secondary" icon="shuffle" onClick={() => onChange(randomAppearance(Date.now()))} haptic="select">
          {t('common.randomize')}
        </Button>
      </div>
      <div class="wiz-look-controls">
        {groups.map((g) => (
          <OptionGroup
            key={g.k}
            label={t(g.label)}
            count={g.count}
            value={value[g.k]}
            onChange={(v) => patch(g.k, v)}
            render={g.render}
            swatch={g.swatch}
          />
        ))}
      </div>
    </div>
  )
}
