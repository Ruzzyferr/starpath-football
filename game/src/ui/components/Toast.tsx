import { signal } from '@preact/signals'
import { t } from '../../i18n'
import { Icon, type IconName } from '../icons'
import { haptic } from '../haptics'
import { sfx } from '../../audio'

export type ToastKind = 'info' | 'success' | 'warning' | 'error' | 'reward'
export interface ToastItem {
  id: number
  kind: ToastKind
  text: string
  icon?: IconName
}

export const toasts = signal<ToastItem[]>([])
let nextId = 1

const ICONS: Record<ToastKind, IconName> = { info: 'info', success: 'check', warning: 'warning', error: 'warning', reward: 'trophy' }

/** "Match simmed: 2-1" and "Match simmed: 1-3" are one family: the newer replaces the older. */
const family = (kind: ToastKind, text: string): string => `${kind}|${text.split(/[:：]/)[0]}`

export function toast(text: string, kind: ToastKind = 'info', icon?: IconName, ms = 3200): void {
  const id = nextId++
  const fam = family(kind, text)
  // At most three on screen; a same-family toast replaces its older sibling
  // so fast-forwards don't stack a wall of near-identical cards.
  const rest = toasts.value.filter((x) => family(x.kind, x.text) !== fam)
  toasts.value = [...rest.slice(-2), { id, kind, text, icon }]
  if (kind === 'success' || kind === 'reward') haptic('success')
  else if (kind === 'error') haptic('error')
  sfx(kind === 'success' ? 'success' : kind === 'error' ? 'error' : kind === 'reward' ? 'perk' : 'notify')
  setTimeout(() => dismiss(id), ms)
}

export function dismiss(id: number): void {
  toasts.value = toasts.value.filter((x) => x.id !== id)
}

/** Top on mobile, top-right on desktop. aria-live polite. */
export function ToastHost() {
  return (
    <div class="toast-host" aria-live="polite" aria-atomic="false">
      {toasts.value.map((x) => (
        <div key={x.id} class={`toast toast-${x.kind}`} aria-live={x.kind === 'error' ? 'assertive' : undefined} role={x.kind === 'error' ? 'alert' : 'status'}>
          <span class="toast-icon"><Icon name={x.icon ?? ICONS[x.kind]} size={18} /></span>
          <span class="grow">{x.text}</span>
          <button type="button" class="toast-close" onClick={() => dismiss(x.id)} aria-label={t('ui.toastClose')}>
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
