import { signal } from '@preact/signals'
import { currentLang, t } from '../../i18n'
import { Modal } from '../components'

/** "?" opens the keyboard shortcut list (GAP 2.7#31). */
export const shortcutsOpen = signal(false)

const ROWS: { keys: string; label: 'tabs' | 'advance' | 'match' | 'training' | 'inbox' | 'back' | 'help' }[] = [
  { keys: '1 – 5', label: 'tabs' },
  { keys: 'Space', label: 'advance' },
  { keys: 'M', label: 'match' },
  { keys: 'T', label: 'training' },
  { keys: 'I', label: 'inbox' },
  { keys: 'Esc', label: 'back' },
  { keys: '?', label: 'help' },
]

export function ShortcutsModal() {
  void currentLang.value
  return (
    <Modal open={shortcutsOpen.value} onClose={() => (shortcutsOpen.value = false)} title={t('board.shortcuts.title')} size="sm">
      <dl class="kbd-list" data-testid="shortcuts-list">
        {ROWS.map((r) => (
          <div key={r.label} class="kbd-row">
            <dt><kbd>{r.keys}</kbd></dt>
            <dd>{t(`board.shortcuts.${r.label}`)}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  )
}
