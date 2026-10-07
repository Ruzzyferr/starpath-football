/**
 * Public audio API (UI + Phaser scenes share this one engine).
 *
 *   import { audio, sfx } from '../audio'
 *   sfx('confirm')                       // UI sound (ui bus, throttled)
 *   audio.playMusic('hub')                // tempo-synced crossfade
 *   audio.sting('victory')
 *   audio.setCrowdSize(42000)             // stadium capacity
 *   audio.crowdEvent('goal', 'home')
 *
 * Everything is procedural WebAudio; there are no audio files.
 */
import { AudioEngine } from './engine'
import type { Side } from './crowd'
import type { UiSound } from './uiSfx'

export type { UiSound } from './uiSfx'
export type { TrackId, StingId } from './music'
export type { MixSettings, Bus } from './mixer'
export type { Side } from './crowd'

export const engine = new AudioEngine()

export type CrowdEvent = 'goal' | 'chance' | 'nearMiss' | 'groan' | 'save' | 'foul' | 'yellow' | 'red' | 'timeWasting' | 'applause' | 'chant'

export const audio = {
  install: () => engine.install(),
  unlock: () => engine.unlock(),
  setMix: engine.setMix.bind(engine),
  playMusic: engine.playMusic.bind(engine),
  stopMusic: engine.stopMusic.bind(engine),
  setMusicIntensity: engine.setMusicIntensity.bind(engine),
  sting: engine.sting.bind(engine),
  setTension: engine.setTension.bind(engine),
  holdCrowd: engine.holdCrowd.bind(engine),
  releaseCrowd: engine.releaseCrowd.bind(engine),
  setAllegiance: engine.setAllegiance.bind(engine),
  /** Stadium capacity (and optionally match importance 0..1). */
  setCrowdSize(capacity: number, importance?: number): void {
    engine.setStadium(capacity, importance)
  },
  /** A crowd reaction from the point of view of `side`'s fans (see Crowd). */
  crowdEvent(kind: CrowdEvent, side: Side = 'home', intensity = 0.6): void {
    engine.withCrowd((c) => {
      switch (kind) {
        case 'goal': return c.goal(side)
        case 'chance': return c.chance(side, intensity)
        case 'nearMiss': return c.nearMiss(side)
        case 'groan': return c.groan(side)
        case 'save': return c.save(side)
        case 'foul': return c.foul(side, null)
        case 'yellow': return c.foul(side, 'yellow')
        case 'red': return c.foul(side, 'red')
        case 'timeWasting': return c.timeWasting()
        case 'applause': return c.applaud(intensity)
        case 'chant': return c.queueChant(c.ctx.currentTime + 0.5)
      }
    })
  },
}

/** Plays a UI sound (respects ui volume, mute and reduced sound). */
export function sfx(name: UiSound): void {
  engine.sfx(name)
}

if (typeof window !== 'undefined' && import.meta.env?.DEV) {
  ;(window as unknown as { __spAudio?: unknown }).__spAudio = { engine, debug: () => engine.debug() }
}
