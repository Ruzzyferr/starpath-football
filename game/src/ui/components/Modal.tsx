import type { ComponentChildren } from 'preact'
import { createPortal } from 'preact/compat'
import { useEffect, useRef } from 'preact/hooks'
import { t } from '../../i18n'
import { Icon } from '../icons'

let openCount = 0

/**
 * Modal: bottom sheet on phones (slides up from the thumb zone), centred
 * dialog on ≥ 900px. Traps focus, closes on Esc / scrim (unless `persistent`).
 */
export function Modal({
  open, onClose, title, children, footer, size = 'md', persistent, labelledBy, class: cls, hideClose,
}: {
  open: boolean
  onClose?: () => void
  title?: ComponentChildren
  children: ComponentChildren
  footer?: ComponentChildren
  size?: 'sm' | 'md' | 'lg' | 'full'
  persistent?: boolean
  labelledBy?: string
  class?: string
  hideClose?: boolean
}) {
  const panel = useRef<HTMLDivElement>(null)
  const restore = useRef<Element | null>(null)

  useEffect(() => {
    if (!open) return
    openCount++
    restore.current = document.activeElement
    const el = panel.current
    // Focus an explicit [autofocus] target, else the panel itself (avoids a ring on the close button).
    const first = el?.querySelector<HTMLElement>('[autofocus]')
    ;(first ?? el)?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !persistent) {
        e.stopPropagation()
        onClose?.()
      } else if (e.key === 'Tab' && el) {
        const f = Array.from(el.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'))
        if (!f.length) return
        const a = f[0]
        const z = f[f.length - 1]
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault()
          z.focus()
        } else if (!e.shiftKey && document.activeElement === z) {
          e.preventDefault()
          a.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      openCount--
      document.removeEventListener('keydown', onKey, true)
      ;(restore.current as HTMLElement | null)?.focus?.()
    }
  }, [open, persistent])

  if (!open) return null
  const titleId = labelledBy ?? 'modal-title'
  return createPortal(
    <div class={`modal-root ${cls ?? ''}`} data-modal-depth={openCount}>
      <div class="modal-scrim" onClick={() => !persistent && onClose?.()} aria-hidden="true" />
      <div
        ref={panel}
        class={`modal-panel modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : t('ui.dialog')}
        tabIndex={-1}
      >
        <div class="sheet-grabber" aria-hidden="true" />
        {(title || (onClose && !hideClose)) && (
          <div class="modal-head">
            {title && <h2 class="h2 modal-title" id={titleId}>{title}</h2>}
            {onClose && !hideClose && !persistent && (
              <button type="button" class="icon-btn icon-btn-ghost modal-close" onClick={onClose} aria-label={t('common.close')}>
                <Icon name="close" size={20} />
              </button>
            )}
          </div>
        )}
        <div class="modal-body">{children}</div>
        {footer && <div class="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
