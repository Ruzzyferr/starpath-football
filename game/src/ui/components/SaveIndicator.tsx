/**
 * Subtle autosave badge ("Kaydediliyor…" → "Kaydedildi"), bottom-left above the
 * tab bar. Manual saves have their own toast, so only autosaves show here.
 */
import { useEffect, useState } from 'preact/hooks'
import { t } from '../../i18n'
import { saveStatus } from '../backend/persistence'
import { Icon } from '../icons'

/** How long "Kaydedildi" stays up. */
const SHOW_MS = 1800
/** Quick saves never flash "Saving…". */
const SAVING_DELAY_MS = 400

export function SaveIndicator() {
  const st = saveStatus.value
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    // Waiting for the debounced autosave: leave the badge as it is (no flicker on every action).
    if (st.phase === 'pending') return
    if (st.kind !== 'auto' || st.phase === 'idle' || st.phase === 'error') {
      setVisible(false)
      return
    }
    if (st.phase === 'saving') {
      const id = setTimeout(() => setVisible(true), SAVING_DELAY_MS)
      return () => clearTimeout(id)
    }
    setVisible(true)
    const id = setTimeout(() => setVisible(false), SHOW_MS)
    return () => clearTimeout(id)
  }, [st])
  const saving = st.phase === 'saving'
  return (
    <div class={`save-indicator${visible ? ' is-on' : ''}`} data-testid="save-indicator" data-phase={st.phase} role="status" aria-live="polite">
      {visible && (
        <>
          <Icon name="floppy" size={14} />
          <span>{saving ? t('saves.autosaving') : t('saves.autosaved')}</span>
        </>
      )}
    </div>
  )
}
