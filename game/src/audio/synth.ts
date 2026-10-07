/**
 * WebAudio instrument voices shared by music, UI sounds and match SFX. Every
 * voice is a short-lived node chain scheduled at an exact time `t` into an
 * output node; long-lived resources (noise buffers, waveshaper curves) are
 * cached per context. A {@link VoicePool} caps simultaneous voices so a busy
 * moment cannot pile up hundreds of oscillators on a phone.
 */
import { renderPinkNoise } from './voices'

const noiseCache = new WeakMap<BaseAudioContext, { white: AudioBuffer; pink: AudioBuffer }>()

export function noiseBuffers(ctx: BaseAudioContext): { white: AudioBuffer; pink: AudioBuffer } {
  let c = noiseCache.get(ctx)
  if (!c) {
    const sr = ctx.sampleRate
    const white = ctx.createBuffer(1, Math.round(sr * 2), sr)
    const d = white.getChannelData(0)
    let s = 1234567
    for (let i = 0; i < d.length; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0
      d[i] = (s / 4294967296) * 2 - 1
    }
    const pinkData = renderPinkNoise(3, 77, sr)
    const pink = ctx.createBuffer(1, pinkData.length, sr)
    pink.getChannelData(0).set(pinkData)
    c = { white, pink }
    noiseCache.set(ctx, c)
  }
  return c
}

/** Caps concurrent voices: `take(end)` returns false when the pool is full. */
export class VoicePool {
  private ends: number[] = []
  readonly cap: number
  dropped = 0

  constructor(cap: number) {
    this.cap = cap
  }

  take(now: number, end: number): boolean {
    if (this.ends.length >= this.cap) this.ends = this.ends.filter((e) => e > now)
    if (this.ends.length >= this.cap) {
      this.dropped++
      return false
    }
    this.ends.push(end)
    return true
  }

  active(now: number): number {
    return this.ends.filter((e) => e > now).length
  }
}

export const midiToHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12)

/** Exponential AD envelope on a gain param (exp ramps cannot hit 0). */
export function adEnv(p: AudioParam, t: number, peak: number, attack: number, decay: number, floor = 0.0001): void {
  p.setValueAtTime(floor, t)
  p.exponentialRampToValueAtTime(Math.max(floor * 2, peak), t + Math.max(0.001, attack))
  p.exponentialRampToValueAtTime(floor, t + Math.max(0.001, attack) + Math.max(0.005, decay))
}

/** Attack-sustain-release with linear segments (pads, held notes). */
export function asrEnv(p: AudioParam, t: number, peak: number, attack: number, hold: number, release: number): void {
  p.setValueAtTime(0, t)
  p.linearRampToValueAtTime(peak, t + attack)
  p.setValueAtTime(peak, t + attack + hold)
  p.linearRampToValueAtTime(0, t + attack + hold + release)
}

function noiseSource(ctx: BaseAudioContext, kind: 'white' | 'pink' = 'white'): AudioBufferSourceNode {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffers(ctx)[kind]
  src.loop = true
  return src
}

/** Starts a looping noise source at a pseudo-random offset (so hits differ). */
function startNoise(src: AudioBufferSourceNode, t: number, dur: number, offset: number): void {
  src.start(t, Math.abs(offset) % 1.5)
  src.stop(t + dur)
}

const curveCache = new WeakMap<BaseAudioContext, Float32Array<ArrayBuffer>>()
/** Soft-clip curve (tanh) for drum bus saturation. */
export function softClipCurve(ctx: BaseAudioContext, drive = 2.2): Float32Array<ArrayBuffer> {
  let c = curveCache.get(ctx)
  if (!c) {
    c = new Float32Array(1024)
    const norm = Math.tanh(drive)
    for (let i = 0; i < c.length; i++) {
      const x = (i / (c.length - 1)) * 2 - 1
      c[i] = Math.tanh(x * drive) / norm
    }
    curveCache.set(ctx, c)
  }
  return c
}

// ───────────────────────── Drums ─────────────────────────

export function kickDrum(ctx: BaseAudioContext, out: AudioNode, t: number, vel = 1, tone: { pitch?: number; decay?: number } = {}): void {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  const p0 = tone.pitch ?? 52
  o.frequency.setValueAtTime(p0 * 3.4, t)
  o.frequency.exponentialRampToValueAtTime(p0 * 1.25, t + 0.035)
  o.frequency.exponentialRampToValueAtTime(p0, t + 0.12)
  adEnv(g.gain, t, 0.95 * vel, 0.002, tone.decay ?? 0.34)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + (tone.decay ?? 0.34) + 0.05)
  // Beater click.
  const n = noiseSource(ctx)
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 2500
  const ng = ctx.createGain()
  adEnv(ng.gain, t, 0.22 * vel, 0.001, 0.012)
  n.connect(hp).connect(ng).connect(out)
  startNoise(n, t, 0.03, t * 0.37)
}

export function snareDrum(ctx: BaseAudioContext, out: AudioNode, t: number, vel = 1, opts: { tone?: number; decay?: number } = {}): void {
  const decay = opts.decay ?? 0.19
  const o = ctx.createOscillator()
  o.type = 'triangle'
  o.frequency.setValueAtTime((opts.tone ?? 200) * 1.4, t)
  o.frequency.exponentialRampToValueAtTime(opts.tone ?? 200, t + 0.03)
  const og = ctx.createGain()
  adEnv(og.gain, t, 0.5 * vel, 0.001, 0.09)
  o.connect(og).connect(out)
  o.start(t)
  o.stop(t + 0.14)
  const n = noiseSource(ctx)
  const bp = ctx.createBiquadFilter()
  bp.type = 'highpass'
  bp.frequency.value = 1300
  const pk = ctx.createBiquadFilter()
  pk.type = 'peaking'
  pk.frequency.value = 4200
  pk.gain.value = 5
  const ng = ctx.createGain()
  adEnv(ng.gain, t, 0.55 * vel, 0.001, decay)
  n.connect(bp).connect(pk).connect(ng).connect(out)
  startNoise(n, t, decay + 0.05, t * 0.71)
}

/** Layered hand clap (three quick bursts + tail). */
export function clap(ctx: BaseAudioContext, out: AudioNode, t: number, vel = 1): void {
  const n = noiseSource(ctx)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1150
  bp.Q.value = 1.1
  const g = ctx.createGain()
  const p = g.gain
  p.setValueAtTime(0, t)
  for (let i = 0; i < 3; i++) {
    const s = t + i * 0.011
    p.setValueAtTime(0.75 * vel, s)
    p.exponentialRampToValueAtTime(0.05, s + 0.009)
  }
  p.setValueAtTime(0.6 * vel, t + 0.033)
  p.exponentialRampToValueAtTime(0.0001, t + 0.2)
  n.connect(bp).connect(g).connect(out)
  startNoise(n, t, 0.24, t * 0.53)
}

export function hat(ctx: BaseAudioContext, out: AudioNode, t: number, vel = 1, open = false): void {
  const n = noiseSource(ctx)
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 7200
  const bp = ctx.createBiquadFilter()
  bp.type = 'peaking'
  bp.frequency.value = 10000
  bp.gain.value = 6
  const g = ctx.createGain()
  const d = open ? 0.24 : 0.045
  adEnv(g.gain, t, 0.32 * vel, 0.001, d)
  n.connect(hp).connect(bp).connect(g).connect(out)
  startNoise(n, t, d + 0.03, t * 0.91)
}

export function tom(ctx: BaseAudioContext, out: AudioNode, t: number, hz: number, vel = 1): void {
  const o = ctx.createOscillator()
  o.frequency.setValueAtTime(hz * 1.6, t)
  o.frequency.exponentialRampToValueAtTime(hz, t + 0.06)
  const g = ctx.createGain()
  adEnv(g.gain, t, 0.7 * vel, 0.002, 0.32)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + 0.38)
}

/** Orchestral-ish timpani / boom for fanfares and impacts. */
export function boom(ctx: BaseAudioContext, out: AudioNode, t: number, hz = 55, vel = 1, decay = 1.2): void {
  const o = ctx.createOscillator()
  o.frequency.setValueAtTime(hz * 2, t)
  o.frequency.exponentialRampToValueAtTime(hz, t + 0.08)
  const g = ctx.createGain()
  adEnv(g.gain, t, 0.8 * vel, 0.003, decay)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + decay + 0.05)
  const n = noiseSource(ctx, 'pink')
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 600
  const ng = ctx.createGain()
  adEnv(ng.gain, t, 0.35 * vel, 0.003, decay * 0.4)
  n.connect(lp).connect(ng).connect(out)
  startNoise(n, t, decay * 0.45, t * 0.29)
}

/** Reverse-cymbal style noise riser into time `t + dur`. */
export function riser(ctx: BaseAudioContext, out: AudioNode, t: number, dur: number, vel = 1): void {
  const n = noiseSource(ctx)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 1.4
  bp.frequency.setValueAtTime(400, t)
  bp.frequency.exponentialRampToValueAtTime(7000, t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.35 * vel, t + dur)
  g.gain.linearRampToValueAtTime(0, t + dur + 0.02)
  n.connect(bp).connect(g).connect(out)
  startNoise(n, t, dur + 0.03, t * 0.13)
}

/** Crash cymbal. */
export function crash(ctx: BaseAudioContext, out: AudioNode, t: number, vel = 1): void {
  const n = noiseSource(ctx)
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 4200
  const g = ctx.createGain()
  adEnv(g.gain, t, 0.3 * vel, 0.002, 1.6)
  n.connect(hp).connect(g).connect(out)
  startNoise(n, t, 1.7, t * 0.47)
}

// ───────────────────────── Tonal ─────────────────────────

/** Mono synth bass: saw + sub sine through an enveloped lowpass. */
export function bass(ctx: BaseAudioContext, out: AudioNode, t: number, midi: number, dur: number, vel = 1, opts: { cutoff?: number; env?: number; type?: OscillatorType } = {}): void {
  const hz = midiToHz(midi)
  const o = ctx.createOscillator()
  o.type = opts.type ?? 'sawtooth'
  o.frequency.value = hz
  const sub = ctx.createOscillator()
  sub.frequency.value = hz / 2
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.Q.value = 4
  const cut = opts.cutoff ?? 380
  lp.frequency.setValueAtTime(cut + (opts.env ?? 1400) * vel, t)
  lp.frequency.exponentialRampToValueAtTime(cut, t + Math.min(0.2, dur))
  const g = ctx.createGain()
  const sg = ctx.createGain()
  sg.gain.value = 0.7
  const end = t + dur
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(0.42 * vel, t + 0.005)
  g.gain.setValueAtTime(0.42 * vel * 0.8, Math.max(t + 0.006, end - 0.03))
  g.gain.linearRampToValueAtTime(0, end)
  o.connect(lp).connect(g).connect(out)
  sub.connect(sg).connect(g)
  o.start(t)
  sub.start(t)
  o.stop(end + 0.02)
  sub.stop(end + 0.02)
}

/** Supersaw-ish pad chord (2 detuned saws per note) with slow filter swell. */
export function pad(ctx: BaseAudioContext, out: AudioNode, t: number, notes: readonly number[], dur: number, vel = 1, opts: { cutoff?: number; attack?: number; release?: number; type?: OscillatorType } = {}): void {
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.Q.value = 0.7
  const cutoff = opts.cutoff ?? 1600
  lp.frequency.setValueAtTime(cutoff * 0.5, t)
  lp.frequency.linearRampToValueAtTime(cutoff, t + dur * 0.6)
  const g = ctx.createGain()
  const attack = opts.attack ?? 0.25
  const release = opts.release ?? 0.6
  asrEnv(g.gain, t, (0.14 * vel) / Math.sqrt(notes.length), attack, Math.max(0, dur - attack), release)
  lp.connect(g).connect(out)
  for (const m of notes) {
    for (const det of [-9, 8]) {
      const o = ctx.createOscillator()
      o.type = opts.type ?? 'sawtooth'
      o.frequency.value = midiToHz(m)
      o.detune.value = det
      o.connect(lp)
      o.start(t)
      o.stop(t + dur + release + 0.05)
    }
  }
}

/** Plucky arp note (square/saw with a fast filter decay). */
export function pluck(ctx: BaseAudioContext, out: AudioNode, t: number, midi: number, vel = 1, opts: { decay?: number; type?: OscillatorType; bright?: number } = {}): void {
  const o = ctx.createOscillator()
  o.type = opts.type ?? 'square'
  o.frequency.value = midiToHz(midi)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.Q.value = 3
  const bright = opts.bright ?? 4200
  lp.frequency.setValueAtTime(bright, t)
  lp.frequency.exponentialRampToValueAtTime(400, t + (opts.decay ?? 0.22))
  const g = ctx.createGain()
  adEnv(g.gain, t, 0.22 * vel, 0.002, opts.decay ?? 0.22)
  o.connect(lp).connect(g).connect(out)
  o.start(t)
  o.stop(t + (opts.decay ?? 0.22) + 0.05)
}

/** Brass-like lead (3 detuned saws, filter opens on attack, delayed vibrato). */
export function brass(ctx: BaseAudioContext, out: AudioNode, t: number, midi: number, dur: number, vel = 1): void {
  const hz = midiToHz(midi)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.Q.value = 1.2
  lp.frequency.setValueAtTime(hz * 1.5, t)
  lp.frequency.exponentialRampToValueAtTime(hz * 7, t + 0.08)
  lp.frequency.exponentialRampToValueAtTime(hz * 4, t + Math.max(0.1, dur))
  const g = ctx.createGain()
  asrEnv(g.gain, t, 0.13 * vel, 0.04, Math.max(0, dur - 0.04), 0.18)
  const vib = ctx.createOscillator()
  vib.frequency.value = 5.5
  const vg = ctx.createGain()
  vg.gain.setValueAtTime(0, t)
  vg.gain.linearRampToValueAtTime(9, t + Math.min(0.5, dur))
  vib.connect(vg)
  lp.connect(g).connect(out)
  for (const det of [-7, 0, 7]) {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = hz
    o.detune.value = det
    vg.connect(o.detune)
    o.connect(lp)
    o.start(t)
    o.stop(t + dur + 0.25)
  }
  vib.start(t)
  vib.stop(t + dur + 0.25)
}

/** Bell / chime (inharmonic sine partials). */
export function bell(ctx: BaseAudioContext, out: AudioNode, t: number, midi: number, vel = 1, decay = 0.9): void {
  const hz = midiToHz(midi)
  const partials: readonly (readonly [number, number, number])[] = [[1, 1, 1], [2.0, 0.5, 0.6], [2.76, 0.32, 0.45], [5.4, 0.16, 0.25]]
  for (const [r, a, d] of partials) {
    const o = ctx.createOscillator()
    o.frequency.value = hz * r
    const g = ctx.createGain()
    adEnv(g.gain, t, 0.18 * vel * a, 0.002, decay * d)
    o.connect(g).connect(out)
    o.start(t)
    o.stop(t + decay * d + 0.05)
  }
}

/** Soft sine/triangle blip for UI. */
export function blip(ctx: BaseAudioContext, out: AudioNode, t: number, hz: number, dur: number, vel = 1, opts: { type?: OscillatorType; toHz?: number; attack?: number } = {}): void {
  const o = ctx.createOscillator()
  o.type = opts.type ?? 'sine'
  o.frequency.setValueAtTime(hz, t)
  if (opts.toHz) o.frequency.exponentialRampToValueAtTime(opts.toHz, t + dur)
  const g = ctx.createGain()
  adEnv(g.gain, t, 0.3 * vel, opts.attack ?? 0.003, dur)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + dur + 0.05)
}

/** Filtered noise burst (whooshes, paper, scuffs). */
export function noiseBurst(ctx: BaseAudioContext, out: AudioNode, t: number, dur: number, vel: number, opts: { type?: BiquadFilterType; from: number; to?: number; q?: number; attack?: number; pink?: boolean }): void {
  const n = noiseSource(ctx, opts.pink ? 'pink' : 'white')
  const f = ctx.createBiquadFilter()
  f.type = opts.type ?? 'bandpass'
  f.Q.value = opts.q ?? 1
  f.frequency.setValueAtTime(opts.from, t)
  if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t + dur)
  const g = ctx.createGain()
  adEnv(g.gain, t, vel, opts.attack ?? 0.005, dur)
  n.connect(f).connect(g).connect(out)
  startNoise(n, t, dur + (opts.attack ?? 0.005) + 0.03, t * 0.61 + opts.from * 0.0001)
}

/** Builds a ConvolverNode from a procedural IR. */
export function makeReverb(ctx: BaseAudioContext, ir: [Float32Array, Float32Array], irRate: number): ConvolverNode {
  const buf = ctx.createBuffer(2, ir[0].length, irRate)
  buf.getChannelData(0).set(ir[0])
  buf.getChannelData(1).set(ir[1])
  const c = ctx.createConvolver()
  c.normalize = false
  c.buffer = buf
  return c
}

/** Tempo-synced stereo-ish feedback delay (one tap per side). */
export function makeDelay(ctx: BaseAudioContext, time: number, feedback = 0.32, tone = 2800): { input: GainNode; output: GainNode } {
  const input = ctx.createGain()
  const output = ctx.createGain()
  const d1 = ctx.createDelay(2)
  d1.delayTime.value = time
  const fb = ctx.createGain()
  fb.gain.value = feedback
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = tone
  input.connect(d1)
  d1.connect(lp).connect(fb).connect(d1)
  const panL = ctx.createStereoPanner()
  panL.pan.value = -0.5
  const d2 = ctx.createDelay(2)
  d2.delayTime.value = time * 1.5
  const panR = ctx.createStereoPanner()
  panR.pan.value = 0.5
  lp.connect(panL).connect(output)
  input.connect(d2).connect(panR).connect(output)
  return { input, output }
}
