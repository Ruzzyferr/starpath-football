/**
 * Mapping between the persisted UI settings (src/ui/store.ts) and the mixer.
 * Kept structural so the audio core never imports the UI store.
 *
 * Legacy fields keep their meaning: `sound` is the SFX channel and `music` the
 * music channel (both existed before the mixer); the rest are new.
 */
import { sanitizeMix, type MixSettings } from './mixer'

export interface AudioSettingsFields {
  sound: number
  music: number
  masterVolume: number
  crowdVolume: number
  uiVolume: number
  voiceVolume: number
  muted: boolean
  reducedSound: boolean
}

export const DEFAULT_AUDIO_SETTINGS: Omit<AudioSettingsFields, 'sound' | 'music'> = {
  masterVolume: 0.9,
  crowdVolume: 0.8,
  uiVolume: 0.7,
  voiceVolume: 0.8,
  muted: false,
  reducedSound: false,
}

export function mixFromSettings(s: Partial<AudioSettingsFields>): MixSettings {
  return sanitizeMix({
    master: s.masterVolume,
    music: s.music,
    sfx: s.sound,
    crowd: s.crowdVolume,
    ui: s.uiVolume,
    voice: s.voiceVolume,
    muted: s.muted,
    reduced: s.reducedSound,
  })
}

export type MixKey = 'masterVolume' | 'music' | 'sound' | 'crowdVolume' | 'uiVolume' | 'voiceVolume'

/** Slider order shown in Settings. */
export const MIX_SLIDERS: readonly MixKey[] = ['masterVolume', 'music', 'sound', 'crowdVolume', 'uiVolume', 'voiceVolume']
