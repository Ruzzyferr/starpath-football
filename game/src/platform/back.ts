/**
 * Android hardware/gesture back. Mirrors the desktop Escape key, which the UI
 * already understands (Modal closes, App goes back a screen). On the root
 * screens (title/home) with nothing open it asks before quitting.
 */
import { screen } from '../ui/store'

const ROOTS = new Set(['title', 'home'])

function exitPrompt(): string {
  return (document.documentElement.lang || 'tr').startsWith('tr') ? 'StarPath Football kapatılsın mı?' : 'Quit StarPath Football?'
}

export function handleBack(exit: () => void): void {
  const modalOpen = !!document.querySelector('.modal-root')
  if (!modalOpen && ROOTS.has(screen.value.id)) {
    if (window.confirm(exitPrompt())) exit()
    return
  }
  // Let a focused text field lose focus so the UI's Escape handling is not skipped.
  const active = document.activeElement as HTMLElement | null
  if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) active.blur()
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }))
}
