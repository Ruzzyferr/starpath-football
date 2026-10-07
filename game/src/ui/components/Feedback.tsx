/** EmptyState, Skeleton, Tooltip, Spinner. */
import type { ComponentChildren } from 'preact'
import { useState } from 'preact/hooks'
import { t } from '../../i18n'
import { Icon, type IconName } from '../icons'

export function EmptyState({ icon = 'ball', title, text, action, compact }: { icon?: IconName; title?: string; text?: ComponentChildren; action?: ComponentChildren; compact?: boolean }) {
  // Compact: an inline row for "nothing here yet" inside a section.
  if (compact) {
    return (
      <div class="empty-inline">
        <span class="empty-inline-icon" aria-hidden="true"><Icon name={icon} size={20} /></span>
        <div class="empty-inline-body">
          {title && <span class="empty-inline-title">{title}</span>}
          {text && <span class="t-sm t-mid">{text}</span>}
        </div>
        {action}
      </div>
    )
  }
  return (
    <div class="empty-state">
      <div class="empty-state-art" aria-hidden="true">
        <span class="empty-state-beam" />
        <svg viewBox="0 0 160 84" class="empty-state-pitch">
          <path d="M22 70 44 22h72l22 48Z" class="empty-state-grass" />
          <path d="M22 70 44 22h72l22 48Z M80 22v48 M33 46h94" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />
          <ellipse cx="80" cy="46" rx="14" ry="6" fill="none" stroke="currentColor" stroke-width="1.4" />
        </svg>
        <span class="empty-state-icon"><Icon name={icon} size={28} /></span>
      </div>
      <h3 class="h3">{title ?? t('common.emptyTitle')}</h3>
      {text && <p class="t-mid t-sm">{text}</p>}
      {action}
    </div>
  )
}

export function Skeleton({ lines = 3, height, circle, width }: { lines?: number; height?: number; circle?: boolean; width?: string }) {
  if (circle) return <span class="skeleton skeleton-circle" style={{ width: height ?? 40, height: height ?? 40 }} aria-hidden="true" />
  if (height) return <span class="skeleton skeleton-block" style={{ height, width: width ?? '100%' }} aria-hidden="true" />
  return (
    <div class="skeleton-lines" role="status" aria-label={t('ui.skeleton')}>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} class="skeleton skeleton-line" style={{ width: i === lines - 1 ? '62%' : '100%' }} />
      ))}
    </div>
  )
}

export function Spinner({ size = 28 }: { size?: number }) {
  return (
    <span class="spinner-ball" style={{ width: size, height: size }} role="status" aria-label={t('common.loading')}>
      <Icon name="ball" size={size} />
    </span>
  )
}

/** Tooltip: hover/focus on desktop, tap toggles on touch. */
export function Tooltip({ text, children, side = 'top' }: { text: string; children: ComponentChildren; side?: 'top' | 'bottom' }) {
  const [open, setOpen] = useState(false)
  const id = `tt-${text.length}-${text.charCodeAt(0) || 0}`
  return (
    <span
      class="tooltip-anchor"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusIn={() => setOpen(true)}
      onFocusOut={() => setOpen(false)}
      onClick={() => setOpen((o) => !o)}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {open && (
        <span role="tooltip" id={id} class={`tooltip tooltip-${side}`}>
          {text}
        </span>
      )}
    </span>
  )
}
