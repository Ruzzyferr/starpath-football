/**
 * Android hardware/gesture back. Mirrors the desktop Escape key, which the UI
 * already understands (Modal closes, App goes back a screen). On the root
 * screens (title/home) with nothing open it asks before quitting.
 */
import { actions, match, screen } from '../ui/store'
import { toast } from '../ui/components'

const ROOTS = new Set(['title', 'home'])

function exitPrompt(): string {
  return (document.documentElement.lang || 'tr').startsWith('tr') ? 'StarPath Football kapatılsın mı?' : 'Quit StarPath Football?'
}

/**
 * Back during a running live match must never abandon it (2.9#76): it pauses (the Resume button and the
 * normal match controls remain), and only a second press while paused is handled like any other screen.
 * Returns true when the press was consumed.
 */
export function pauseLiveMatchOnBack(): boolean {
  if (screen.value.id !== 'liveMatch') return false
  const m = match.value
  if (!m || m.finished) return false
  if (!m.paused) {
    actions.matchPause(true)
    const tr = (document.documentElement.lang || 'tr').startsWith('tr')
    toast(tr ? 'Maç duraklatıldı. Devam etmek için oynat tuşuna bas.' : 'Match paused. Press play to resume.', 'info')
  }
  return true
}

export function handleBack(exit: () => void): void {
  const modalOpen = !!document.querySelector('.modal-root')
  if (!modalOpen && pauseLiveMatchOnBack()) return
  if (!modalOpen && ROOTS.has(screen.value.id)) {
    if (window.confirm(exitPrompt())) exit()
    return
  }
  // Let a focused text field lose focus so the UI's Escape handling is not skipped.
  const active = document.activeElement as HTMLElement | null
  if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) active.blur()
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }))
}
