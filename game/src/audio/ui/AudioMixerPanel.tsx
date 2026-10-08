/**
 * Six-channel mixer controls for the Settings screen: master, music, SFX,
 * crowd, UI and commentary (reserved) sliders, plus mute and reduced sound.
 * Values persist through updateSettings (localStorage) and reach the engine
 * via the audio director. A short preview plays after a slider settles.
 */
import type { LText } from '../../core/types'
import { currentLang, t } from '../../i18n'
import { Slider, Switch } from '../../ui/components'
import { settings, updateSettings } from '../../ui/store'
import { audio, engine, sfx } from '../index'
import type { MixKey } from '../settings'

const L: Record<'master' | 'crowd' | 'ui' | 'voice' | 'voiceHint' | 'matchMusic' | 'matchMusicDesc' | 'mute' | 'muteDesc' | 'reduced' | 'reducedDesc', LText> = {
  master: { tr: 'Ana ses', en: 'Master volume' },
  crowd: { tr: 'Taraftar', en: 'Crowd' },
  ui: { tr: 'Arayüz sesleri', en: 'Interface sounds' },
  voice: { tr: 'Anlatım', en: 'Commentary' },
  voiceHint: { tr: 'Anlatım sesi ileride eklenecek.', en: 'Commentary is coming in a later update.' },
  matchMusic: { tr: 'Maç müziği', en: 'Match music' },
  matchMusicDesc: { tr: 'Kritik anlar beklerken gerilim müziği çalar. Kapalıyken yalnızca taraftar duyulur.', en: 'Tension music plays while a key moment waits. When off, only the crowd is heard.' },
  mute: { tr: 'Tüm sesleri kapat', en: 'Mute all audio' },
  muteDesc: { tr: 'Müzik, efekt ve taraftar dahil.', en: 'Music, effects and crowd included.' },
  reduced: { tr: 'Sade ses', en: 'Reduced sound' },
  reducedDesc: { tr: 'Yalnızca önemli sesler: tık sesleri ve tezahüratlar kapanır, taraftar ve müzik kısılır.', en: 'Essential cues only: no click sounds or chants; crowd and music are softer.' },
}

const tx = (k: keyof typeof L): string => L[k][currentLang.value] ?? L[k].en
const pct = (v: number) => `${Math.round(v)}`

let previewTimer: ReturnType<typeof setTimeout> | null = null
/** Audible feedback for the channel being changed, debounced. */
function preview(key: MixKey): void {
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = setTimeout(() => {
    engine.unlock()
    if (key === 'crowdVolume') {
      // A short swell, only if a crowd is running (no fake stadium in menus).
      audio.crowdEvent('chance', 'home', 0.5)
      sfx('select')
    } else sfx(key === 'uiVolume' ? 'confirm' : 'select')
  }, 220)
}

export function AudioMixerPanel() {
  const s = settings.value
  const row = (key: MixKey, label: string, id: string, hint?: string) => (
    <Slider
      label={label}
      value={Math.round((s[key] as number) * 100)}
      min={0}
      max={100}
      step={5}
      id={id}
      hint={hint}
      format={pct}
      onChange={(v) => {
        updateSettings({ [key]: v / 100 })
        preview(key)
      }}
    />
  )
  return (
    <>
      {row('masterVolume', tx('master'), 'set-master')}
      {row('music', t('settings.music'), 'set-music')}
      {row('sound', t('settings.sound'), 'set-sound')}
      {row('crowdVolume', tx('crowd'), 'set-crowd')}
      {row('uiVolume', tx('ui'), 'set-ui')}
      {row('voiceVolume', tx('voice'), 'set-voice', tx('voiceHint'))}
      <Switch label={tx('mute')} desc={tx('muteDesc')} checked={s.muted} onChange={(muted) => updateSettings({ muted })} />
      <Switch label={tx('matchMusic')} desc={tx('matchMusicDesc')} checked={s.matchMusic !== false} onChange={(matchMusic) => updateSettings({ matchMusic })} />
      <Switch label={tx('reduced')} desc={tx('reducedDesc')} checked={s.reducedSound} onChange={(reducedSound) => updateSettings({ reducedSound })} />
    </>
  )
}
