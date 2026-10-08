/**
 * Floating "sound is off, tap to turn on" chip (2.8#5). Visible only while audio is
 * muted (or the master slider is at zero), so a player who silenced the game and
 * forgot is never left wondering why a menu is quiet. One tap restores sound.
 */
import { currentLang } from '../../i18n'
import { Icon } from '../../ui/icons'
import { settings, updateSettings } from '../../ui/store'
import { engine, sfx } from '../index'

export function QuickMute() {
  const s = settings.value
  if (!s.muted && s.masterVolume > 0) return null
  const label = currentLang.value === 'tr' ? 'Sesi aç' : 'Turn sound on'
  return (
    <button
      type="button"
      class="quick-mute"
      aria-label={label}
      title={label}
      data-testid="quick-mute"
      style={{
        position: 'fixed',
        left: 'calc(env(safe-area-inset-left, 0px) + 12px)',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)',
        zIndex: 40,
        width: '44px',
        height: '44px',
        borderRadius: '22px',
        border: '1px solid var(--surface-3)',
        background: 'var(--surface-2)',
        color: 'var(--accent-gold)',
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer',
      }}
      onClick={() => {
        updateSettings({ muted: false, ...(s.masterVolume <= 0 ? { masterVolume: 0.9 } : {}) })
        engine.unlock()
        sfx('confirm')
      }}
    >
      <Icon name="speaker-off" />
    </button>
  )
}
