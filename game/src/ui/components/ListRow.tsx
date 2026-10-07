import type { ComponentChildren } from 'preact'
import { Icon, type IconName } from '../icons'
import { haptic } from '../haptics'

export interface ListRowProps {
  leading?: ComponentChildren
  icon?: IconName
  title: ComponentChildren
  sub?: ComponentChildren
  trailing?: ComponentChildren
  onClick?: () => void
  chevron?: boolean
  active?: boolean
  disabled?: boolean
  class?: string
}

/** 56px+ list row; becomes a button when clickable. */
export function ListRow({ leading, icon, title, sub, trailing, onClick, chevron, active, disabled, class: cls }: ListRowProps) {
  const inner = (
    <>
      {leading ?? (icon ? <span class="list-row-icon"><Icon name={icon} size={20} /></span> : null)}
      <span class="list-row-main">
        <span class="list-row-title">{title}</span>
        {sub && <span class="list-row-sub">{sub}</span>}
      </span>
      {trailing && <span class="list-row-trail">{trailing}</span>}
      {chevron && <Icon name="chevron-right" size={18} class="list-row-chev" />}
    </>
  )
  const classes = `list-row${active ? ' is-active' : ''}${onClick ? ' is-clickable' : ''} ${cls ?? ''}`
  if (onClick)
    return (
      <button
        type="button"
        class={classes}
        disabled={disabled}
        onClick={() => {
          haptic('tap')
          onClick()
        }}
      >
        {inner}
      </button>
    )
  return <div class={classes}>{inner}</div>
}

export function List({ children, label }: { children: ComponentChildren; label?: string }) {
  return (
    <div class="list" role="list" aria-label={label}>
      {children}
    </div>
  )
}
