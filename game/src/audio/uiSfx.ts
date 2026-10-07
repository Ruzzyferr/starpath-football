/**
 * UI sound designs. Each is a tiny synth patch tuned to C major so menu
 * clicks sit in key with the music. `playUiSound` schedules one at time t into
 * the UI bus; the public `sfx()` wrapper (src/audio/index.ts) adds volume,
 * reduced-sound filtering and throttling.
 */
import { adEnv, bell, blip, noiseBurst } from './synth'

export type UiSound =
  | 'tap' | 'back' | 'toggle' | 'select' | 'confirm' | 'success' | 'error' | 'moneyIn' | 'moneyOut'
  | 'levelUp' | 'perk' | 'card' | 'notify' | 'whoosh'

export const UI_SOUNDS: readonly UiSound[] = ['tap', 'back', 'toggle', 'select', 'confirm', 'success', 'error', 'moneyIn', 'moneyOut', 'levelUp', 'perk', 'card', 'notify', 'whoosh']

/** Sounds dropped in "reduced sound" mode (pure interaction feedback). */
export const NON_ESSENTIAL: ReadonlySet<UiSound> = new Set<UiSound>(['tap', 'back', 'toggle', 'select', 'whoosh', 'card'])

/** Minimum gap between two plays of the same sound (seconds). */
export const MIN_GAP: Partial<Record<UiSound, number>> = { tap: 0.045, select: 0.045, toggle: 0.05, back: 0.06, moneyIn: 0.25, moneyOut: 0.25, notify: 0.4, card: 0.3 }

const hz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12)

export function playUiSound(ctx: BaseAudioContext, out: AudioNode, name: UiSound, t: number): number {
  switch (name) {
    case 'tap':
      // Soft wooden "tok": short sine drop + a click of filtered noise.
      blip(ctx, out, t, 1150, 0.05, 0.55, { toHz: 520 })
      noiseBurst(ctx, out, t, 0.012, 0.12, { type: 'bandpass', from: 3800, q: 2 })
      return 0.08
    case 'back':
      blip(ctx, out, t, 820, 0.07, 0.5, { toHz: 380 })
      noiseBurst(ctx, out, t, 0.08, 0.05, { type: 'bandpass', from: 2500, to: 700, q: 1.5, attack: 0.01 })
      return 0.1
    case 'toggle':
      blip(ctx, out, t, hz(84), 0.035, 0.4, { type: 'triangle' })
      blip(ctx, out, t + 0.04, hz(91), 0.05, 0.4, { type: 'triangle' })
      return 0.1
    case 'select':
      blip(ctx, out, t, hz(88), 0.05, 0.4, { type: 'triangle' })
      return 0.06
    case 'confirm':
      blip(ctx, out, t, hz(79), 0.08, 0.55, { type: 'triangle' })
      blip(ctx, out, t + 0.07, hz(84), 0.16, 0.6, { type: 'triangle' })
      bell(ctx, out, t + 0.07, 96, 0.25, 0.3)
      return 0.25
    case 'success':
      ;[72, 76, 79, 84].forEach((m, i) => blip(ctx, out, t + i * 0.055, hz(m), 0.18, 0.5 - i * 0.04, { type: 'triangle' }))
      bell(ctx, out, t + 0.17, 96, 0.35, 0.6)
      return 0.6
    case 'error': {
      // Low two-step buzz (minor second down), muffled.
      for (const [i, m] of [[0, 52], [1, 51]] as const) {
        const o = ctx.createOscillator()
        o.type = 'square'
        o.frequency.value = hz(m)
        const lp = ctx.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.value = 900
        const g = ctx.createGain()
        adEnv(g.gain, t + i * 0.11, 0.22, 0.004, 0.1)
        o.connect(lp).connect(g).connect(out)
        o.start(t + i * 0.11)
        o.stop(t + i * 0.11 + 0.14)
      }
      return 0.3
    }
    case 'moneyIn': {
      // Cash register: drawer thunk, bell "ching", a shower of coins.
      noiseBurst(ctx, out, t, 0.06, 0.35, { type: 'lowpass', from: 500, pink: true })
      blip(ctx, out, t, 140, 0.08, 0.5, { toHz: 70 })
      const c = t + 0.07
      for (const [f, a] of [[2637, 1], [3951, 0.6], [5274, 0.35]] as const) {
        const o = ctx.createOscillator()
        o.frequency.value = f
        const g = ctx.createGain()
        adEnv(g.gain, c, 0.16 * a, 0.002, 0.55)
        o.connect(g).connect(out)
        o.start(c)
        o.stop(c + 0.6)
      }
      for (let i = 0; i < 5; i++) {
        const ct = c + 0.1 + i * 0.045 + (i % 2) * 0.012
        blip(ctx, out, ct, 4200 + ((i * 733) % 1600), 0.06, 0.18, { type: 'triangle' })
      }
      return 0.7
    }
    case 'moneyOut':
      // Coins sliding away: descending pings + paper swish.
      for (let i = 0; i < 4; i++) blip(ctx, out, t + i * 0.06, 3600 - i * 520, 0.06, 0.2 - i * 0.03, { type: 'triangle' })
      noiseBurst(ctx, out, t, 0.22, 0.08, { type: 'bandpass', from: 3000, to: 900, q: 1, attack: 0.03 })
      blip(ctx, out, t + 0.22, 330, 0.12, 0.3, { toHz: 220, type: 'triangle' })
      return 0.4
    case 'levelUp': {
      // Fast rising arpeggio, then a sparkling chord.
      const notes = [60, 64, 67, 72, 76, 79, 84]
      notes.forEach((m, i) => blip(ctx, out, t + i * 0.045, hz(m), 0.14, 0.42, { type: 'square', attack: 0.002 }))
      const top = t + notes.length * 0.045
      for (const m of [72, 76, 79, 84]) bell(ctx, out, top, m + 12, 0.32, 1.1)
      noiseBurst(ctx, out, top, 0.5, 0.06, { type: 'highpass', from: 7000, attack: 0.05 })
      return 1.5
    }
    case 'perk':
      // Magical unlock: shimmer sweep into a bell dyad.
      noiseBurst(ctx, out, t, 0.35, 0.08, { type: 'bandpass', from: 1500, to: 9000, q: 3, attack: 0.25 })
      bell(ctx, out, t + 0.3, 91, 0.45, 1.2)
      bell(ctx, out, t + 0.38, 96, 0.4, 1.2)
      blip(ctx, out, t + 0.3, hz(67), 0.4, 0.3, { type: 'triangle' })
      return 1.5
    case 'card':
      // Card slides in: paper swish + soft landing.
      noiseBurst(ctx, out, t, 0.16, 0.16, { type: 'bandpass', from: 1200, to: 4200, q: 0.9, attack: 0.07 })
      blip(ctx, out, t + 0.15, 220, 0.09, 0.4, { toHz: 120 })
      bell(ctx, out, t + 0.16, 84, 0.18, 0.4)
      return 0.4
    case 'notify':
      bell(ctx, out, t, 88, 0.45, 0.6)
      bell(ctx, out, t + 0.12, 95, 0.4, 0.8)
      return 0.9
    case 'whoosh':
      noiseBurst(ctx, out, t, 0.25, 0.15, { type: 'bandpass', from: 500, to: 3000, q: 1.3, attack: 0.1 })
      return 0.35
  }
}
