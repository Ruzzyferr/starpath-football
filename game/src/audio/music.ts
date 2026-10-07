/**
 * Procedural, sequenced music: four looping tracks (main menu anthem, hub
 * groove, live-match tension, awards fanfare) and one-shot stings (victory,
 * defeat, draw, fanfare). Everything is synthesised (src/audio/synth.ts) and
 * scheduled ahead on the audio clock by the shared lookahead scheduler.
 *
 * - Seeded: per-bar variations (fills, hat accents, melodic noodles) come
 *   from a deterministic RNG, so a track sounds the same every time for the
 *   same seed but never like a 2-bar loop.
 * - Tempo-synced crossfades: a new track starts on the next bar line of the
 *   outgoing one; the old one fades out from there.
 * - Cheap: one-shot nodes per note, shared reverb, a voice cap per track.
 */
import { AudioRng, seedOf } from './rng'
import { LookaheadScheduler, Sequence, nextBarTime, stepDuration, swingOffset } from './scheduler'
import {
  VoicePool, bass, bell, boom, brass, clap, crash, hat, kickDrum, makeDelay, makeReverb, pad, pluck, riser, snareDrum, softClipCurve, tom,
} from './synth'
import { renderImpulse } from './voices'

export type TrackId = 'menu' | 'hub' | 'tension' | 'awards'
export type StingId = 'victory' | 'defeat' | 'draw' | 'fanfare'
export const TRACKS: readonly TrackId[] = ['menu', 'hub', 'tension', 'awards']
export const STINGS: readonly StingId[] = ['victory', 'defeat', 'draw', 'fanfare']

export interface TrackOuts {
  drums: AudioNode
  bass: AudioNode
  /** Pads go through the sidechain gain (ducks on every kick). */
  pad: AudioNode
  lead: AudioNode
  /** Delay send (tempo-synced). */
  delay: AudioNode
  /** Reverb send (shared). */
  verb: AudioNode
}

export interface StepCtx {
  ctx: BaseAudioContext
  t: number
  step: number
  bar: number
  /** 16th inside the bar (0..15). */
  s: number
  /** Bar inside the arrangement loop. */
  loopBar: number
  /** True during the very first pass of the loop. */
  firstPass: boolean
  rng: AudioRng
  out: TrackOuts
  intensity: number
  /** Seconds per 16th. */
  sd: number
  pool: VoicePool
  /** Duck the pad bus (sidechain) at t. */
  pump(t: number): void
}

export interface TrackDef {
  id: TrackId
  bpm: number
  swing: number
  loopBars: number
  gain: number
  onStep(c: StepCtx): void
}

// ───────────────────────── Helpers ─────────────────────────

/** Voice cap check in schedule time (steps arrive in time order, offline too). */
const can = (c: StepCtx, dur: number): boolean => c.pool.take(c.t, c.t + dur)

function arp(c: StepCtx, chord: readonly number[], pattern: readonly number[], vel: number, opts: { octave?: number; every?: number; decay?: number; type?: OscillatorType; bright?: number } = {}): void {
  const every = opts.every ?? 1
  if (c.s % every !== 0) return
  const i = pattern[(c.s / every) % pattern.length]
  const note = chord[i % chord.length] + 12 * (opts.octave ?? 1) + 12 * Math.floor(i / chord.length)
  if (!can(c, 0.3)) return
  pluck(c.ctx, c.out.lead, c.t, note, vel, { decay: opts.decay ?? 0.18, type: opts.type, bright: opts.bright })
  pluck(c.ctx, c.out.delay, c.t, note, vel * 0.5, { decay: opts.decay ?? 0.18, type: opts.type, bright: opts.bright })
}

/** A melodic line: steps → [semitone midi, length in 16ths]. */
type Line = Readonly<Record<number, readonly [number, number]>>

function playLine(c: StepCtx, line: Line | undefined, vel: number, voice: 'pluck' | 'brass' | 'bell'): void {
  const n = line?.[c.s]
  if (!n) return
  const dur = n[1] * c.sd
  if (!can(c, dur + 0.3)) return
  if (voice === 'brass') brass(c.ctx, c.out.lead, c.t, n[0], dur * 0.95, vel)
  else if (voice === 'bell') bell(c.ctx, c.out.lead, c.t, n[0], vel, 0.6 + dur)
  else {
    pluck(c.ctx, c.out.lead, c.t, n[0], vel, { type: 'sawtooth', decay: Math.min(0.9, 0.15 + dur), bright: 3200 })
    pluck(c.ctx, c.out.lead, c.t, n[0] + 12, vel * 0.25, { type: 'square', decay: Math.min(0.6, 0.1 + dur), bright: 5000 })
  }
  // Echo + space on every lead note.
  pluck(c.ctx, c.out.delay, c.t, n[0], vel * 0.35, { type: 'triangle', decay: Math.min(0.8, 0.2 + dur) })
}

function four(c: StepCtx, vel = 1, tone?: { pitch?: number; decay?: number }): void {
  if (c.s % 4 !== 0) return
  kickDrum(c.ctx, c.out.drums, c.t, vel, tone)
  c.pump(c.t)
}

// ───────────────────────── Track: menu ─────────────────────────
// A minor / C major, 118 BPM. vi–IV–I–V. A: groove, B: hook, C: breakdown, build.

const MENU_CHORDS = [[57, 60, 64], [57, 60, 65], [55, 60, 64], [55, 59, 62]] as const
const MENU_ROOTS = [45, 41, 48, 43] as const
const MENU_HOOK: readonly Line[] = [
  { 0: [76, 2], 3: [74, 1], 4: [76, 2], 6: [79, 2], 8: [81, 4], 14: [79, 2] },
  { 0: [81, 3], 3: [79, 1], 4: [77, 2], 6: [76, 2], 8: [72, 6] },
  { 0: [76, 2], 3: [74, 1], 4: [76, 2], 6: [79, 2], 8: [84, 4], 12: [83, 2], 14: [79, 2] },
  { 0: [83, 3], 4: [81, 2], 6: [79, 2], 8: [74, 6] },
]

const menu: TrackDef = {
  id: 'menu', bpm: 118, swing: 0, loopBars: 16, gain: 0.9,
  onStep(c) {
    const ci = c.loopBar % 4
    const chord = MENU_CHORDS[ci]
    const section = c.loopBar < 8 ? 'A' : c.loopBar < 12 ? 'B' : c.loopBar < 15 ? 'C' : 'build'
    const intro = c.firstPass && c.loopBar < 4
    // Pads: one chord per bar.
    if (c.s === 0 && can(c, 2.6)) {
      pad(c.ctx, c.out.pad, c.t, chord, c.sd * 16, section === 'C' ? 1.2 : 1, { cutoff: section === 'C' ? 1100 : 2200, attack: 0.04, release: 0.5 })
      pad(c.ctx, c.out.verb, c.t, chord.map((n) => n + 12), c.sd * 16, 0.4, { cutoff: 2600, attack: 0.3, release: 0.8, type: 'triangle' })
    }
    // Arp everywhere except the build bar.
    if (section !== 'build') arp(c, chord, [0, 1, 2, 1, 0, 2, 1, 2], intro ? 0.45 : 0.55, { every: 2, octave: 1, bright: section === 'C' ? 1800 : 3800 })
    if (intro) {
      if (c.s === 0 && c.loopBar === 3) riser(c.ctx, c.out.drums, c.t, c.sd * 16, 0.7)
      if (c.s % 2 === 1) hat(c.ctx, c.out.drums, c.t, 0.3)
      return
    }
    if (section === 'C') {
      if (c.s % 4 === 2) hat(c.ctx, c.out.drums, c.t, 0.35)
      if (c.s === 0 && c.loopBar === 14) riser(c.ctx, c.out.drums, c.t, c.sd * 32, 0.8)
      if (c.s === 0) bass(c.ctx, c.out.bass, c.t, MENU_ROOTS[ci], c.sd * 15, 0.6, { cutoff: 250, env: 300 })
      return
    }
    if (section === 'build') {
      // Snare roll that accelerates into the downbeat.
      const roll = c.s < 8 ? c.s % 2 === 0 : true
      if (roll) snareDrum(c.ctx, c.out.drums, c.t, 0.25 + (c.s / 16) * 0.6, { decay: 0.1 })
      if (c.s === 0) bass(c.ctx, c.out.bass, c.t, MENU_ROOTS[ci], c.sd * 8, 0.8)
      if (c.s === 15) tom(c.ctx, c.out.drums, c.t, 98, 0.8)
      return
    }
    // Groove (A and B).
    four(c, 1)
    if (c.loopBar % 4 === 0 && c.s === 0) crash(c.ctx, c.out.drums, c.t, c.loopBar === 0 ? 0.9 : 0.5)
    if (c.s === 4 || c.s === 12) {
      clap(c.ctx, c.out.drums, c.t, 0.85)
      snareDrum(c.ctx, c.out.drums, c.t, 0.45)
    }
    if (c.s % 4 === 2) hat(c.ctx, c.out.drums, c.t, 0.55, true)
    else hat(c.ctx, c.out.drums, c.t, c.s % 2 === 0 ? 0.42 : 0.22 + c.rng.next() * 0.12)
    // Fill on the last beat of every 4th bar.
    if (c.loopBar % 4 === 3 && c.s >= 12) {
      if (c.s === 13 || c.s === 15) snareDrum(c.ctx, c.out.drums, c.t, 0.5)
      if (c.s === 14) tom(c.ctx, c.out.drums, c.t, 130, 0.6)
    }
    // Off-beat pumping bass with an octave pop.
    if (c.s % 4 === 2 || (c.s === 14 && c.rng.chance(0.5))) {
      const oct = c.s === 14 ? 12 : 0
      if (can(c, c.sd * 2)) bass(c.ctx, c.out.bass, c.t, MENU_ROOTS[ci] + oct, c.sd * 1.8, 0.9)
    }
    if (section === 'B') playLine(c, MENU_HOOK[ci], 0.85, 'pluck')
  },
}

// ───────────────────────── Track: hub ─────────────────────────
// F major, 96 BPM, light swing. Laid-back keys groove for the career hub.

const HUB_CHORDS = [[53, 57, 60, 64], [53, 57, 60, 62], [53, 57, 58, 62], [53, 55, 58, 60]] as const
const HUB_ROOTS = [41, 38, 46, 48] as const
const HUB_SCALE = [65, 67, 69, 72, 74, 77, 79, 81] as const

const hub: TrackDef = {
  id: 'hub', bpm: 96, swing: 0.28, loopBars: 16, gain: 0.95,
  onStep(c) {
    const ci = c.loopBar % 4
    const chord = HUB_CHORDS[ci]
    const sparse = c.loopBar >= 12 && c.loopBar < 14
    // Keys: soft stabs on the "and" of 1 and on 3, plus a held pad underneath.
    if (c.s === 0 && can(c, 2.8)) pad(c.ctx, c.out.pad, c.t, chord, c.sd * 16, 0.75, { cutoff: 1300, attack: 0.15, release: 0.9, type: 'triangle' })
    if ((c.s === 2 || c.s === 8 || (c.s === 11 && c.rng.chance(0.5))) && can(c, 0.5)) {
      pad(c.ctx, c.out.lead, c.t, chord.map((n) => n + 12), c.sd * 1.5, 0.75, { cutoff: 2600, attack: 0.005, release: 0.25, type: 'triangle' })
    }
    // Drums.
    if (!sparse) {
      if (c.s === 0 || c.s === 10 || (c.s === 7 && c.rng.chance(0.35))) {
        kickDrum(c.ctx, c.out.drums, c.t, 0.8, { pitch: 50, decay: 0.28 })
        c.pump(c.t)
      }
      if (c.s === 4 || c.s === 12) snareDrum(c.ctx, c.out.drums, c.t, 0.5, { tone: 240, decay: 0.12 })
    }
    if (c.s % 2 === 0) hat(c.ctx, c.out.drums, c.t, c.s % 4 === 2 ? 0.38 : 0.24)
    else if (c.rng.chance(0.3)) hat(c.ctx, c.out.drums, c.t, 0.14)
    // Round bass.
    const bassHits: Record<number, number> = { 0: 0, 6: 0, 10: 7, 14: 12 }
    if (c.s in bassHits && can(c, 0.4)) bass(c.ctx, c.out.bass, c.t, HUB_ROOTS[ci] + bassHits[c.s], c.sd * (c.s === 0 ? 5 : 3), 0.8, { type: 'triangle', cutoff: 600, env: 400 })
    // Generative bell noodle in the second half.
    if (c.loopBar >= 4 && c.loopBar < 12 && c.s % 2 === 0 && c.rng.chance(0.2) && can(c, 1)) {
      const n = HUB_SCALE[c.rng.int(0, HUB_SCALE.length - 1)]
      bell(c.ctx, c.out.lead, c.t, n, 0.55, 0.7)
      bell(c.ctx, c.out.delay, c.t, n, 0.3, 0.6)
    }
  },
}

// ───────────────────────── Track: tension ─────────────────────────
// D minor, 128 BPM. Intensity (0..1) adds layers: pulse → kick → snare → arp.

const TEN_CHORDS = [[50, 53, 57], [50, 53, 58], [50, 55, 58], [49, 52, 57]] as const
const TEN_ROOTS = [38, 46, 43, 45] as const

const tension: TrackDef = {
  id: 'tension', bpm: 128, swing: 0, loopBars: 8, gain: 0.9,
  onStep(c) {
    const ci = Math.floor(c.loopBar / 2) % 4
    const chord = TEN_CHORDS[ci]
    const k = c.intensity
    if (c.s === 0 && c.loopBar % 2 === 0 && can(c, 4)) pad(c.ctx, c.out.pad, c.t, chord.map((n) => n - 12), c.sd * 32, 0.9, { cutoff: 700 + k * 900, attack: 0.6, release: 0.8 })
    // 16th pulse bass, accents on beats.
    if (can(c, 0.2)) bass(c.ctx, c.out.bass, c.t, TEN_ROOTS[ci], c.sd * 0.8, c.s % 4 === 0 ? 0.85 : 0.5, { cutoff: 300 + k * 300, env: 900 })
    // Ticking clock.
    hat(c.ctx, c.out.drums, c.t, c.s % 4 === 0 ? 0.35 : 0.16)
    if (k > 0.25 && c.s % 4 === 0) {
      kickDrum(c.ctx, c.out.drums, c.t, 0.9, { pitch: 48, decay: 0.3 })
      c.pump(c.t)
    } else if (c.s === 0 || c.s === 6) {
      // Heartbeat.
      kickDrum(c.ctx, c.out.drums, c.t, c.s === 0 ? 0.8 : 0.55, { pitch: 44, decay: 0.22 })
    }
    if (k > 0.5 && (c.s === 4 || c.s === 12)) snareDrum(c.ctx, c.out.drums, c.t, 0.6)
    if (k > 0.5 && c.loopBar % 4 === 3 && c.s >= 8 && c.s % 2 === 0) tom(c.ctx, c.out.drums, c.t, 90 + c.s * 4, 0.6)
    if (k > 0.7) arp(c, chord, [0, 2, 1, 2], 0.45, { octave: 1, decay: 0.12, type: 'sawtooth', bright: 2600 })
    if (c.loopBar === 7 && c.s === 0) riser(c.ctx, c.out.drums, c.t, c.sd * 16, 0.4 + k * 0.5)
  },
}

// ───────────────────────── Track: awards ─────────────────────────
// C major, 100 BPM. Brass fanfare, timpani, marching snare.

const AW_CHORDS = [[60, 64, 67], [60, 65, 69], [59, 62, 67], [60, 64, 67], [57, 60, 64], [57, 60, 65], [55, 62, 67], [55, 59, 62]] as const
const AW_ROOTS = [36, 41, 43, 36, 45, 41, 43, 43] as const
const AW_THEME: readonly Line[] = [
  { 0: [67, 3], 3: [67, 1], 4: [72, 4], 8: [76, 3], 11: [74, 1], 12: [72, 4] },
  { 0: [77, 6], 6: [76, 2], 8: [74, 4], 12: [72, 4] },
  { 0: [74, 3], 3: [76, 1], 4: [77, 4], 8: [79, 8] },
  { 0: [84, 8], 8: [79, 4], 12: [76, 4] },
  { 0: [76, 3], 3: [76, 1], 4: [81, 4], 8: [79, 4], 12: [76, 4] },
  { 0: [77, 4], 4: [81, 4], 8: [84, 8] },
  { 0: [83, 4], 4: [81, 4], 8: [79, 4], 12: [74, 4] },
  { 0: [79, 12] },
]

const awards: TrackDef = {
  id: 'awards', bpm: 100, swing: 0, loopBars: 8, gain: 0.85,
  onStep(c) {
    const chord = AW_CHORDS[c.loopBar]
    if (c.s === 0 && can(c, 3)) {
      pad(c.ctx, c.out.pad, c.t, [...chord, chord[0] + 12], c.sd * 16, 1, { cutoff: 2400, attack: 0.08, release: 0.6 })
      boom(c.ctx, c.out.drums, c.t, 45 + (AW_ROOTS[c.loopBar] - 36) * 0.5, 0.75, 1.1)
      if (c.loopBar % 4 === 0) crash(c.ctx, c.out.drums, c.t, 0.6)
    }
    if (c.s === 8) boom(c.ctx, c.out.drums, c.t, 41, 0.5, 0.8)
    // Marching snare: accents on 2/4 and a light 16th skip.
    if (c.s === 4 || c.s === 12) snareDrum(c.ctx, c.out.drums, c.t, 0.7, { decay: 0.16 })
    else if (c.s % 2 === 1 && c.rng.chance(0.35)) snareDrum(c.ctx, c.out.drums, c.t, 0.18, { decay: 0.07 })
    if (c.s === 15 && c.loopBar % 2 === 1) snareDrum(c.ctx, c.out.drums, c.t, 0.4, { decay: 0.08 })
    if (c.s % 4 === 0 && c.s !== 8) kickDrum(c.ctx, c.out.drums, c.t, 0.55, { pitch: 50, decay: 0.25 })
    if ((c.s === 0 || c.s === 8) && can(c, 1)) bass(c.ctx, c.out.bass, c.t, AW_ROOTS[c.loopBar], c.sd * 7, 0.65, { cutoff: 420, env: 500 })
    playLine(c, AW_THEME[c.loopBar], 0.95, 'brass')
    if (c.s % 2 === 0) arp(c, chord, [0, 1, 2, 3, 2, 1], 0.28, { octave: 1, decay: 0.12, type: 'triangle', bright: 3000 })
  },
}

export const TRACK_DEFS: Record<TrackId, TrackDef> = { menu, hub, tension, awards }

// ───────────────────────── Player ─────────────────────────

class TrackInstance {
  readonly def: TrackDef
  readonly seq: Sequence
  readonly gain: GainNode
  private readonly sc: GainNode
  private readonly nodes: AudioNode[] = []
  private readonly ctx: BaseAudioContext
  private readonly out: TrackOuts
  private readonly seed: number
  private readonly pool: VoicePool
  private rng: AudioRng
  private rngBar = -1
  intensity = 0
  stopAt = Infinity
  private unsubscribe: (() => void) | null = null

  constructor(ctx: BaseAudioContext, def: TrackDef, dest: AudioNode, verb: AudioNode, anchor: number, seed: number, voices = 36) {
    this.ctx = ctx
    this.pool = new VoicePool(voices)
    this.def = def
    this.seed = seed
    this.rng = new AudioRng(seed)
    this.seq = new Sequence(anchor, def.bpm)
    this.gain = ctx.createGain()
    this.gain.gain.value = 0
    this.gain.connect(dest)
    const drumBus = ctx.createGain()
    const shaper = ctx.createWaveShaper()
    shaper.curve = softClipCurve(ctx)
    const drumOut = ctx.createGain()
    drumOut.gain.value = 0.8
    drumBus.connect(shaper).connect(drumOut).connect(this.gain)
    const bassBus = ctx.createGain()
    bassBus.gain.value = 0.85
    this.sc = ctx.createGain()
    const padBus = ctx.createGain()
    padBus.gain.value = 0.9
    padBus.connect(this.sc).connect(this.gain)
    bassBus.connect(this.gain)
    const leadBus = ctx.createGain()
    leadBus.gain.value = 0.8
    leadBus.connect(this.gain)
    const verbSend = ctx.createGain()
    verbSend.gain.value = 0.9
    verbSend.connect(verb)
    leadBus.connect(verbSend)
    padBus.connect(verbSend)
    const delay = makeDelay(ctx, stepDuration(def.bpm) * 3, 0.3)
    const delayIn = ctx.createGain()
    delayIn.connect(delay.input)
    delay.output.connect(this.gain)
    delay.output.connect(verbSend)
    this.nodes.push(drumBus, shaper, drumOut, bassBus, this.sc, padBus, leadBus, verbSend, delay.input, delay.output, delayIn)
    this.out = { drums: drumBus, bass: bassBus, pad: padBus, lead: leadBus, delay: delayIn, verb: verbSend }
  }

  attach(s: LookaheadScheduler): void {
    this.unsubscribe = s.add((until, now) => this.pump(until, now))
  }

  pump(until: number, now: number): void {
    const def = this.def
    for (const ev of this.seq.collect(Math.min(until, this.stopAt), now)) {
      const bar = Math.floor(ev.index / 16)
      if (bar !== this.rngBar) {
        this.rngBar = bar
        this.rng = new AudioRng(this.seed ^ Math.imul(bar + 1, 2654435761))
      }
      const t = ev.time + swingOffset(ev.index, def.bpm, def.swing)
      const loopBar = bar % def.loopBars
      def.onStep({
        ctx: this.ctx, t, step: ev.index, bar, s: ev.index % 16, loopBar, firstPass: bar < def.loopBars,
        rng: this.rng, out: this.out, intensity: this.intensity, sd: stepDuration(def.bpm), pool: this.pool,
        pump: (at) => {
          const p = this.sc.gain
          p.setValueAtTime(0.4, at)
          p.linearRampToValueAtTime(1, at + stepDuration(def.bpm) * 2.6)
        },
      })
    }
  }

  fadeTo(level: number, at: number, dur: number): void {
    const p = this.gain.gain
    p.cancelScheduledValues(at)
    p.setValueAtTime(p.value, at)
    p.linearRampToValueAtTime(level, at + Math.max(0.01, dur))
  }

  dispose(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
    try {
      this.gain.disconnect()
    } catch {
      /* already */
    }
    for (const n of this.nodes) {
      try {
        n.disconnect()
      } catch {
        /* already */
      }
    }
  }
}

export interface PlayOpts {
  fade?: number
  seed?: number
  intensity?: number
  /** Start immediately instead of on the outgoing track's next bar. */
  now?: boolean
}

export class MusicPlayer {
  private readonly ctx: BaseAudioContext
  private readonly scheduler: LookaheadScheduler
  private readonly input: GainNode
  private readonly stingBus: GainNode
  private readonly verb: ConvolverNode
  private readonly verbIn: GainNode
  private cur: TrackInstance | null = null
  private old: TrackInstance[] = []
  private timers: ReturnType<typeof setTimeout>[] = []
  private readonly voices: number

  constructor(ctx: BaseAudioContext, dest: AudioNode, scheduler: LookaheadScheduler, quality: 'high' | 'low' = 'high') {
    this.voices = quality === 'low' ? 22 : 36
    this.ctx = ctx
    this.scheduler = scheduler
    this.input = ctx.createGain()
    this.input.connect(dest)
    this.stingBus = ctx.createGain()
    this.stingBus.gain.value = 0.45
    this.stingBus.connect(dest)
    this.verb = makeReverb(ctx, renderImpulse(quality === 'low' ? 0.9 : 1.8, 3.2, 4242, ctx.sampleRate, 0.5), ctx.sampleRate)
    this.verbIn = ctx.createGain()
    this.verbIn.gain.value = 0.32
    const verbOut = ctx.createGain()
    verbOut.gain.value = 0.6
    this.verbIn.connect(this.verb).connect(verbOut).connect(dest)
  }

  get current(): TrackId | null {
    return this.cur?.def.id ?? null
  }

  play(id: TrackId, opts: PlayOpts = {}): void {
    if (this.cur?.def.id === id) {
      if (opts.intensity !== undefined) this.setIntensity(opts.intensity)
      return
    }
    const now = this.ctx.currentTime
    const fade = opts.fade ?? 2
    const prev = this.cur
    const anchor = prev && !opts.now ? nextBarTime(prev.seq.anchor, now + 0.12, prev.def.bpm) : now + 0.08
    const def = TRACK_DEFS[id]
    const inst = new TrackInstance(this.ctx, def, this.input, this.verbIn, anchor, opts.seed ?? seedOf(id), this.voices)
    inst.intensity = opts.intensity ?? 0.3
    inst.fadeTo(def.gain, anchor, prev ? fade * 0.6 : 0.4)
    inst.attach(this.scheduler)
    this.cur = inst
    if (prev) this.retire(prev, anchor, fade)
  }

  stop(fade = 1.5): void {
    if (!this.cur) return
    this.retire(this.cur, this.ctx.currentTime, fade)
    this.cur = null
  }

  setIntensity(v: number): void {
    if (this.cur) this.cur.intensity = Math.max(0, Math.min(1, v))
  }

  /** One-shot sting; returns its length in seconds. The loop dips under it. */
  sting(id: StingId, at = this.ctx.currentTime + 0.05): number {
    const len = playSting(this.ctx, this.stingBus, this.verbIn, id, at)
    if (this.cur) {
      const g = this.cur.gain.gain
      const lvl = this.cur.def.gain
      g.cancelScheduledValues(at)
      g.setValueAtTime(g.value, at)
      g.linearRampToValueAtTime(lvl * 0.2, at + 0.15)
      g.setValueAtTime(lvl * 0.2, at + len * 0.8)
      g.linearRampToValueAtTime(lvl, at + len + 1.2)
    }
    return len
  }

  /** Schedules everything up to `until` (offline rendering). */
  renderTo(until: number): void {
    this.scheduler.pump(until, this.ctx.currentTime)
  }

  dispose(): void {
    for (const t of this.timers) clearTimeout(t)
    this.cur?.dispose()
    for (const o of this.old) o.dispose()
    this.cur = null
    this.old = []
  }

  private retire(inst: TrackInstance, at: number, fade: number): void {
    inst.fadeTo(0, at, fade)
    inst.stopAt = at + fade
    this.old.push(inst)
    const ms = Math.max(0, (at + fade - this.ctx.currentTime) * 1000) + 600
    const id = setTimeout(() => {
      inst.dispose()
      this.old = this.old.filter((x) => x !== inst)
    }, ms)
    this.timers.push(id)
  }
}

// ───────────────────────── Stings ─────────────────────────

const STING_TRIM: Record<StingId, number> = { victory: 1, defeat: 2.4, draw: 3, fanfare: 1 }

/** Plays a sting into `out` at `t`; returns its duration. */
export function playSting(ctx: BaseAudioContext, dest: AudioNode, verb: AudioNode, id: StingId, t: number): number {
  // Per-sting trim so the soft ones (defeat, draw) land at a similar loudness.
  const out = ctx.createGain()
  out.gain.value = STING_TRIM[id]
  out.connect(dest)
  const both = (fn: (o: AudioNode) => void) => {
    fn(out)
    fn(verb)
  }
  switch (id) {
    case 'victory': {
      // Rising brass arpeggio into a big major chord.
      const notes = [60, 64, 67, 72]
      notes.forEach((n, i) => brass(ctx, out, t + i * 0.11, n, 0.18, 0.9))
      const hit = t + 0.5
      for (const n of [60, 64, 67, 72, 76]) brass(ctx, out, hit, n, 1.4, 0.75)
      both((o) => pad(ctx, o, hit, [48, 55, 64, 72], 1.6, 0.9, { cutoff: 3000, attack: 0.02, release: 1 }))
      boom(ctx, out, hit, 48, 1, 1.4)
      crash(ctx, out, hit, 0.8)
      kickDrum(ctx, out, hit, 1)
      for (let i = 0; i < 6; i++) bell(ctx, verb, hit + 0.1 + i * 0.09, 84 + [0, 4, 7, 12, 7, 12][i], 0.5, 0.8)
      return 3
    }
    case 'defeat': {
      // Falling minor line over a dark pad and a distant boom.
      both((o) => pad(ctx, o, t, [45, 52, 57, 60], 2.6, 0.9, { cutoff: 900, attack: 0.3, release: 1.2 }))
      ;[69, 67, 64, 62, 57].forEach((n, i) => pluck(ctx, out, t + 0.2 + i * 0.32, n, 0.6, { type: 'triangle', decay: 0.7, bright: 1500 }))
      boom(ctx, out, t + 0.05, 41, 0.8, 2)
      bass(ctx, out, t + 1.7, 33 + 12, 1.4, 0.6, { cutoff: 200, env: 150, type: 'triangle' })
      return 3.6
    }
    case 'draw': {
      both((o) => pad(ctx, o, t, [53, 57, 60, 65], 0.9, 0.8, { cutoff: 1800, attack: 0.02, release: 0.6 }))
      both((o) => pad(ctx, o, t + 0.9, [55, 59, 62, 67], 1.2, 0.8, { cutoff: 1600, attack: 0.02, release: 0.9 }))
      pluck(ctx, out, t + 0.9, 74, 0.5, { type: 'triangle', decay: 0.9 })
      kickDrum(ctx, out, t, 0.6)
      return 2.6
    }
    case 'fanfare': {
      // Timpani roll → three-note call → full chord.
      for (let i = 0; i < 14; i++) boom(ctx, out, t + i * 0.055, 49, 0.18 + i * 0.03, 0.4)
      const c0 = t + 0.8
      brass(ctx, out, c0, 67, 0.22, 0.95)
      brass(ctx, out, c0 + 0.25, 67, 0.12, 0.85)
      brass(ctx, out, c0 + 0.4, 72, 0.6, 1)
      const c1 = c0 + 1.05
      for (const n of [55, 60, 64, 67, 72, 76]) brass(ctx, out, c1, n, 1.8, 0.7)
      both((o) => pad(ctx, o, c1, [48, 55, 60, 64, 67], 2.2, 0.9, { cutoff: 2800, attack: 0.02, release: 1.4 }))
      boom(ctx, out, c1, 43, 1, 1.8)
      crash(ctx, out, c1, 0.9)
      return 4.6
    }
  }
}
