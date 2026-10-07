import { useEffect, useState } from 'preact/hooks'
import { t, type TKey } from '../../i18n'
import { settings } from '../store'

/** Match event types that carry an audible cue, and the caption that describes it. */
const CAPTION: Record<string, TKey> = {
  kickoff: 'settings.capWhistle',
  halftime: 'settings.capWhistle',
  fulltime: 'settings.capWhistle',
  goal: 'settings.capRoar',
  yellow: 'settings.capCards',
  red: 'settings.capCards',
  miss: 'settings.capGroan',
  woodwork: 'settings.capGroan',
}

export function captionKeyFor(type: string): TKey | null {
  return CAPTION[type] ?? null
}

/** Visual sound cue (2.11#29): shows `[Crowd roars]` style captions when enabled. */
export function SoundCaption({ eventType, stamp }: { eventType: string | null; stamp: number }) {
  const [text, setText] = useState('')
  const on = settings.value.soundCaptions
  useEffect(() => {
    const k = on && eventType ? captionKeyFor(eventType) : null
    if (!k) return
    setText(t(k))
    const id = setTimeout(() => setText(''), 2600)
    return () => clearTimeout(id)
  }, [on, eventType, stamp])
  if (!on) return null
  return (
    <div class="sound-caption" role="status" aria-live="polite" data-testid="sound-caption">
      {text && <span class="sound-caption-text">{text}</span>}
    </div>
  )
}
