import { signal } from '@preact/signals'
import { t } from '../../i18n'
import { Icon, type IconName } from '../icons'
import { haptic } from '../haptics'
import { sfx } from '../../audio'
import { screen, type ScreenId } from '../store'

export type ToastKind = 'info' | 'success' | 'warning' | 'error' | 'reward'
export interface ToastItem {
  id: number
  kind: ToastKind
  text: string
  icon?: IconName
  /** Optional inline action (e.g. Undo). */
  action?: { label: string; onClick: () => void }
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

/** 6-second "Undo" toast instead of a confirm dialog (GAP 2.7#48). The action runs once and closes the toast. */
export function toastUndo(text: string, onUndo: () => void, ms = 6000): void {
  const id = nextId++
  const item: ToastItem = {
    id, kind: 'info', text, icon: 'history',
    action: { label: t('board.undo.action'), onClick: () => { dismiss(id); onUndo() } },
  }
  toasts.value = [...toasts.value.slice(-2), item]
  setTimeout(() => dismiss(id), ms)
}

export function dismiss(id: number): void {
  toasts.value = toasts.value.filter((x) => x.id !== id)
}

/** Full-bleed "hero moment" screens: one toast at a time so the scoreboard / ceremony stays visible. */
const IMMERSIVE = new Set<ScreenId>(['preMatch', 'liveMatch', 'postMatch', 'seasonEnd', 'awards', 'cupDraw'])

/** Top on mobile, top-right on desktop. aria-live polite. */
export function ToastHost() {
  const list = IMMERSIVE.has(screen.value.id) ? toasts.value.slice(-1) : toasts.value
  return (
    <div class="toast-host" aria-live="polite" aria-atomic="false">
      {list.map((x) => (
        <div key={x.id} class={`toast toast-${x.kind}`} aria-live={x.kind === 'error' ? 'assertive' : undefined} role={x.kind === 'error' ? 'alert' : 'status'}>
          <span class="toast-icon"><Icon name={x.icon ?? ICONS[x.kind]} size={18} /></span>
          <span class="grow">{x.text}</span>
          {x.action && <button type="button" class="toast-action" onClick={x.action.onClick} data-testid="toast-action">{x.action.label}</button>}
          <button type="button" class="toast-close" onClick={() => dismiss(x.id)} aria-label={t('ui.toastClose')}>
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
