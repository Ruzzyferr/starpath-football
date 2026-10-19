import type { ComponentChildren } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { Icon, type IconName } from '../icons'
import { haptic } from '../haptics'

export interface TabItem<K extends string = string> {
  id: K
  label: string
  icon?: IconName
  badge?: number
  /** Extra trailing element (e.g. a "New!" tag or a lock icon). */
  extra?: ComponentChildren
}

/**
 * Accessible tablist (roving tabindex, arrow keys). `variant="pill"` for
 * segmented controls, `"line"` for page-level tabs.
 */
export function Tabs<K extends string>({
  items, value, onChange, variant = 'line', label, scroll = true, idPrefix = 'tab', panels = false,
}: {
  items: TabItem<K>[]
  value: K
  onChange: (id: K) => void
  variant?: 'line' | 'pill'
  label?: string
  scroll?: boolean
  idPrefix?: string
  /** The page renders `role=tabpanel` with id `${idPrefix}-${id}-panel` for each tab. */
  panels?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  // Keep the active tab visible in a scrolling strip (deep links open e.g.
  // Life → Sponsors, which sits off-screen on a phone). Scrolls the strip only.
  useEffect(() => {
    const el = ref.current
    const btn = el?.querySelector<HTMLElement>('[aria-selected=true]')
    if (!el || !btn || el.scrollWidth <= el.clientWidth + 1) return
    const a = el.getBoundingClientRect()
    const b = btn.getBoundingClientRect()
    el.scrollLeft += b.left - a.left - (a.width - b.width) / 2
  }, [value])
  const onKey = (e: KeyboardEvent) => {
    const idx = items.findIndex((i) => i.id === value)
    let next = idx
    if (e.key === 'ArrowRight') next = (idx + 1) % items.length
    else if (e.key === 'ArrowLeft') next = (idx - 1 + items.length) % items.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = items.length - 1
    else return
    e.preventDefault()
    onChange(items[next]!.id)
    const btn = ref.current?.querySelectorAll<HTMLButtonElement>('[role=tab]')[next]
    btn?.focus()
    btn?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }
  return (
    <div ref={ref} class={`tabs tabs-${variant}${scroll ? ' tabs-scroll' : ''}`} role="tablist" aria-label={label} onKeyDown={onKey}>
      {items.map((it) => {
        const sel = it.id === value
        return (
          <button
            key={it.id}
            type="button"
            role="tab"
            id={`${idPrefix}-${it.id}`}
            aria-selected={sel}
            aria-controls={panels ? `${idPrefix}-${it.id}-panel` : undefined}
            tabIndex={sel ? 0 : -1}
            class={`tab${sel ? ' is-active' : ''}`}
            onClick={() => {
              if (!sel) haptic('select')
              onChange(it.id)
            }}
          >
            {it.icon && <Icon name={it.icon} size={18} />}
            <span>{it.label}</span>
            {it.badge ? <span class="tab-badge">{it.badge}</span> : null}
            {it.extra}
          </button>
        )
      })}
    </div>
  )
}

export function TabPanel({ id, idPrefix = 'tab', children }: { id: string; idPrefix?: string; children: ComponentChildren }) {
  return (
    <div role="tabpanel" aria-labelledby={`${idPrefix}-${id}`} class="tab-panel" key={id}>
      {children}
    </div>
  )
}
