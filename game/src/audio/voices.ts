/**
 * Pure-DSP texture renderer for the procedural crowd (no WebAudio needed, so
 * it is unit-testable). Every human-ish sound in the stadium is built here
 * from a source-filter voice model: a glottal pulse train (Rosenberg-style
 * pulse, differentiated for lip radiation) plus breath noise, shaped by three
 * parallel formant resonators. Summing many detuned, time-jittered voices gives
 * babble, cheers, "ooh"s, groans, boos and sung chant syllables; finger
 * whistles, claps and applause are synthesised alongside.
 *
 * Buffers are rendered at a low sample rate (22.05 kHz by default: the crowd
 * is distant and lowpassed anyway) which keeps generation cheap on phones.
 * "Circular" textures wrap around their end so they loop without a seam.
 */
import { AudioRng } from './rng'

export const TEXTURE_RATE = 22050

export type Vowel = 'a' | 'e' | 'i' | 'o' | 'u' | 'aw' | 'eh'

/** F1..F3 (Hz) for an adult voice; scaled per voice by `fScale`. */
export const FORMANTS: Record<Vowel, readonly [number, number, number]> = {
  a: [730, 1090, 2440],
  e: [530, 1840, 2480],
  i: [300, 2200, 2950],
  o: [570, 840, 2410],
  u: [320, 800, 2240],
  aw: [640, 920, 2380],
  eh: [660, 1700, 2400],
}
const FORMANT_GAIN = [1, 0.55, 0.22] as const
const FORMANT_BW = [90, 120, 170] as const

export interface VoiceNote {
  /** Seconds from the buffer start. */
  start: number
  dur: number
  f0: number
  /** Pitch contour as [fraction 0..1, semitones] points (linear in between). */
  contour?: readonly (readonly [number, number])[]
  vowel: Vowel
  /** Morph target over the note (e.g. 'o' → 'e' for "o-LE"). */
  vowelTo?: Vowel
  amp: number
  attack?: number
  release?: number
  /** Vibrato rate (Hz) and depth (semitones). */
  vibHz?: number
  vibDepth?: number
  /** 0..1 aspiration noise. */
  breath?: number
  /** Formant scale (≈1 adult male, ≈1.18 female/young). */
  fScale?: number
}

class Biquad {
  b0 = 0
  b2 = 0
  a1 = 0
  a2 = 0
  x1 = 0
  x2 = 0
  y1 = 0
  y2 = 0

  /** Constant 0 dB peak gain bandpass. */
  setBandpass(f: number, bw: number, sr: number): void {
    const w0 = (2 * Math.PI * Math.min(f, sr * 0.45)) / sr
    const q = Math.max(0.3, f / bw)
    const alpha = Math.sin(w0) / (2 * q)
    const a0 = 1 + alpha
    this.b0 = alpha / a0
    this.b2 = -alpha / a0
    this.a1 = (-2 * Math.cos(w0)) / a0
    this.a2 = (1 - alpha) / a0
  }

  run(x: number): number {
    const y = this.b0 * x + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2
    this.x2 = this.x1
    this.x1 = x
    this.y2 = this.y1
    this.y1 = y
    return y
  }
}

function contourAt(c: VoiceNote['contour'], frac: number): number {
  if (!c || c.length === 0) return 0
  if (frac <= c[0]![0]) return c[0]![1]
  for (let i = 1; i < c.length; i++) {
    if (frac <= c[i]![0]) {
      const [x0, y0] = c[i - 1]!
      const [x1, y1] = c[i]!
      return y0 + ((y1 - y0) * (frac - x0)) / Math.max(1e-6, x1 - x0)
    }
  }
  return c[c.length - 1]![1]
}

const BLOCK = 32

/**
 * Adds one voice note into `out`. With `circular`, samples past the end wrap
 * to the start (seamless loops).
 */
export function renderVoice(out: Float32Array, sr: number, n: VoiceNote, rng: AudioRng, circular = false): void {
  const len = out.length
  const start = Math.round(n.start * sr)
  const total = Math.max(1, Math.round(n.dur * sr))
  const attack = Math.max(1, Math.round((n.attack ?? 0.06) * sr))
  const release = Math.max(1, Math.round((n.release ?? 0.12) * sr))
  const vibHz = n.vibHz ?? 5.2
  const vibDepth = n.vibDepth ?? 0.12
  const breath = n.breath ?? 0.15
  const fScale = n.fScale ?? 1
  const filters = [new Biquad(), new Biquad(), new Biquad()]
  const fa = FORMANTS[n.vowel]
  const fb = FORMANTS[n.vowelTo ?? n.vowel]
  const vibPhase0 = rng.next() * Math.PI * 2
  let phase = rng.next()
  let prevPulse = 0
  let drift = 0
  let tilt = 0
  const oq = 0.55 + rng.next() * 0.15
  for (let b = 0; b < total; b += BLOCK) {
    const frac = b / total
    // Formants for this block (vowel morph eases in the middle of the note).
    const m = n.vowelTo ? Math.min(1, Math.max(0, (frac - 0.25) / 0.5)) : 0
    for (let k = 0; k < 3; k++) {
      const f = (fa[k]! + (fb[k]! - fa[k]!) * m) * fScale
      filters[k]!.setBandpass(f, FORMANT_BW[k]! * (1 + 0.15 * k), sr)
    }
    drift += (rng.next() - 0.5) * 0.02
    drift *= 0.97
    const semis = contourAt(n.contour, frac) + drift + vibDepth * Math.sin(vibPhase0 + (2 * Math.PI * vibHz * b) / sr)
    const f0 = n.f0 * Math.pow(2, semis / 12)
    const inc = f0 / sr
    const end = Math.min(total, b + BLOCK)
    for (let i = b; i < end; i++) {
      // Glottal source: raised-cosine open phase, differentiated.
      phase += inc
      if (phase >= 1) phase -= 1
      const pulse = phase < oq ? 0.5 - 0.5 * Math.cos((2 * Math.PI * phase) / oq) : 0
      let src = (pulse - prevPulse) * 6
      prevPulse = pulse
      src += (rng.next() * 2 - 1) * breath * 0.35
      tilt += (src - tilt) * 0.55
      const s = filters[0]!.run(tilt) * FORMANT_GAIN[0] + filters[1]!.run(tilt) * FORMANT_GAIN[1] + filters[2]!.run(tilt) * FORMANT_GAIN[2]
      const env = Math.min(1, i / attack, (total - i) / release)
      let idx = start + i
      if (circular) idx = ((idx % len) + len) % len
      else if (idx >= len) return
      if (idx >= 0) out[idx]! += s * env * n.amp
    }
  }
}

/** Finger whistle / referee-ish pea-less whistle from the stands. */
export function renderWhistle(out: Float32Array, sr: number, start: number, dur: number, f: number, glide: number, amp: number, rng: AudioRng, circular = false): void {
  const len = out.length
  const s0 = Math.round(start * sr)
  const total = Math.round(dur * sr)
  let ph = 0
  const vib = 6 + rng.next() * 4
  for (let i = 0; i < total; i++) {
    const frac = i / total
    // Rise, hold, fall (a typical "wolf whistle" shape uses positive glide).
    const g = glide * (frac < 0.3 ? frac / 0.3 : 1 - (frac - 0.3) * 0.6)
    const fi = Math.min(sr * 0.45, f * Math.pow(2, g / 12) * (1 + 0.004 * Math.sin((2 * Math.PI * vib * i) / sr)))
    ph += fi / sr
    const env = Math.min(1, i / (0.03 * sr), (total - i) / (0.05 * sr))
    const v = (Math.sin(2 * Math.PI * ph) + (rng.next() - 0.5) * 0.08) * env * amp
    let idx = s0 + i
    if (circular) idx %= len
    else if (idx >= len) return
    out[idx]! += v
  }
}

/** One hand clap: two bandpassed noise micro-bursts. */
export function renderClap(out: Float32Array, sr: number, start: number, amp: number, rng: AudioRng, circular = false): void {
  const len = out.length
  const f = new Biquad()
  f.setBandpass(900 + rng.next() * 1300, 700 + rng.next() * 600, sr)
  const s0 = Math.round(start * sr)
  const total = Math.round(0.045 * sr)
  const gap = Math.round((0.004 + rng.next() * 0.006) * sr)
  for (let i = 0; i < total; i++) {
    const t = i / sr
    const e1 = Math.exp(-t / 0.006)
    const e2 = i >= gap ? Math.exp(-(i - gap) / sr / 0.011) : 0
    const v = f.run((rng.next() * 2 - 1) * (e1 * 0.7 + e2)) * amp * 2.2
    let idx = s0 + i
    if (circular) idx = ((idx % len) + len) % len
    else if (idx < 0) continue
    else if (idx >= len) return
    out[idx]! += v
  }
}

export function peakOf(buf: Float32Array): number {
  let p = 0
  for (let i = 0; i < buf.length; i++) {
    const a = Math.abs(buf[i]!)
    if (a > p) p = a
  }
  return p
}

export function rmsOf(buf: Float32Array): number {
  let s = 0
  for (let i = 0; i < buf.length; i++) s += buf[i]! * buf[i]!
  return Math.sqrt(s / Math.max(1, buf.length))
}

/** Scales so the peak is `target` (no-op on silence). Returns the buffer. */
export function normalize(buf: Float32Array, target = 0.9): Float32Array {
  const p = peakOf(buf)
  if (p > 1e-9) {
    const k = target / p
    for (let i = 0; i < buf.length; i++) buf[i]! *= k
  }
  return buf
}

/** Removes DC with a one-pole highpass (~25 Hz). */
export function dcBlock(buf: Float32Array, sr: number): Float32Array {
  const r = 1 - (2 * Math.PI * 25) / sr
  let x1 = 0
  let y1 = 0
  for (let i = 0; i < buf.length; i++) {
    const y = buf[i]! - x1 + r * y1
    x1 = buf[i]!
    y1 = y
    buf[i] = y
  }
  return buf
}

// ───────────────────────── Crowd textures ─────────────────────────

const ALL_VOWELS: Vowel[] = ['a', 'e', 'i', 'o', 'u', 'aw', 'eh']

function voiceBase(rng: AudioRng): { f0: number; fScale: number } {
  const female = rng.chance(0.3)
  return female ? { f0: rng.range(170, 250), fScale: rng.range(1.12, 1.22) } : { f0: rng.range(92, 150), fScale: rng.range(0.94, 1.06) }
}

/** Conversational murmur: many voices talking over each other (loops). */
export function renderBabble(seconds: number, voices: number, seed: number, sr = TEXTURE_RATE): Float32Array {
  const out = new Float32Array(Math.round(seconds * sr))
  const rng = new AudioRng(seed)
  for (let v = 0; v < voices; v++) {
    const base = voiceBase(rng)
    const amp = rng.range(0.25, 1)
    let t = rng.range(0, seconds)
    let spoken = 0
    while (spoken < seconds * 0.8) {
      const dur = rng.range(0.07, 0.26)
      const up = rng.range(-2, 3)
      renderVoice(out, sr, {
        start: t, dur, f0: base.f0, contour: [[0, up], [1, up - rng.range(0, 3)]],
        vowel: rng.pick(ALL_VOWELS), vowelTo: rng.pick(ALL_VOWELS), amp, attack: 0.02, release: 0.04,
        vibDepth: 0, breath: 0.25, fScale: base.fScale,
      }, rng, true)
      const gap = rng.chance(0.15) ? rng.range(0.4, 1.4) : rng.range(0.01, 0.12)
      t += dur + gap
      spoken += dur + gap
    }
  }
  return normalize(dcBlock(out, sr), 0.9)
}

/** Excited sustained shouting with whistles (loops): the goal / big-chance layer. */
export function renderCheer(seconds: number, voices: number, seed: number, sr = TEXTURE_RATE): Float32Array {
  const out = new Float32Array(Math.round(seconds * sr))
  const rng = new AudioRng(seed)
  for (let v = 0; v < voices; v++) {
    const base = voiceBase(rng)
    let t = rng.range(0, seconds)
    let used = 0
    while (used < seconds) {
      const dur = rng.range(0.5, 1.8)
      const g = rng.range(-2, 4)
      renderVoice(out, sr, {
        start: t, dur, f0: base.f0 * rng.range(1.6, 2.3), contour: [[0, g - 2], [0.2, g + 1], [1, g - rng.range(1, 4)]],
        vowel: rng.pick(['a', 'e', 'eh', 'o'] as const), vowelTo: rng.pick(['a', 'eh', 'e'] as const), amp: rng.range(0.35, 1),
        attack: 0.05, release: 0.25, vibHz: rng.range(4.5, 7), vibDepth: 0.25, breath: 0.4, fScale: base.fScale * 1.04,
      }, rng, true)
      const gap = rng.range(0.03, 0.3)
      t += dur + gap
      used += dur + gap
    }
  }
  for (let w = 0; w < Math.max(2, Math.round(voices / 6)); w++) {
    renderWhistle(out, sr, rng.range(0, seconds), rng.range(0.25, 0.9), rng.range(2100, 3300), rng.range(-1, 5), rng.range(0.08, 0.18), rng, true)
  }
  return normalize(dcBlock(out, sr), 0.9)
}

/** Shared shape for one-shot crowd reactions where everyone reacts together. */
function renderReaction(
  seconds: number, voices: number, seed: number, sr: number,
  spec: { vowel: Vowel; vowelTo?: Vowel; f0Mul: [number, number]; contour: readonly (readonly [number, number])[]; onset: number; dur: [number, number]; breath: number; release: number },
): Float32Array {
  const out = new Float32Array(Math.round(seconds * sr))
  const rng = new AudioRng(seed)
  for (let v = 0; v < voices; v++) {
    const base = voiceBase(rng)
    const jitter = rng.range(-1, 1)
    renderVoice(out, sr, {
      start: Math.abs(rng.gauss()) * spec.onset, dur: rng.range(spec.dur[0], spec.dur[1]),
      f0: base.f0 * rng.range(spec.f0Mul[0], spec.f0Mul[1]), contour: spec.contour.map(([x, y]) => [x, y + jitter] as const),
      vowel: spec.vowel, vowelTo: spec.vowelTo, amp: rng.range(0.4, 1), attack: 0.08, release: spec.release,
      vibHz: rng.range(4, 6.5), vibDepth: 0.18, breath: spec.breath, fScale: base.fScale,
    }, rng)
  }
  return normalize(dcBlock(out, sr), 0.9)
}

/** Near miss: rising-then-falling "ooooh". */
export function renderOoh(voices: number, seed: number, sr = TEXTURE_RATE): Float32Array {
  return renderReaction(2.6, voices, seed, sr, {
    vowel: 'u', vowelTo: 'o', f0Mul: [1.3, 1.7], contour: [[0, -2], [0.28, 3.5], [0.55, 2], [1, -5]],
    onset: 0.06, dur: [1.3, 2.1], breath: 0.3, release: 0.6,
  })
}

/** Disappointment: falling "awww". */
export function renderGroan(voices: number, seed: number, sr = TEXTURE_RATE): Float32Array {
  return renderReaction(2.4, voices, seed, sr, {
    vowel: 'aw', vowelTo: 'o', f0Mul: [1.05, 1.4], contour: [[0, 2], [0.2, 2.5], [1, -7]],
    onset: 0.1, dur: [1.0, 1.9], breath: 0.4, release: 0.7,
  })
}

/** Goal explosion: everyone yells at once, pitch jumping up. */
export function renderGoalYell(voices: number, seed: number, sr = TEXTURE_RATE): Float32Array {
  const out = renderReaction(3.6, voices, seed, sr, {
    vowel: 'eh', vowelTo: 'a', f0Mul: [1.8, 2.5], contour: [[0, -3], [0.08, 3], [0.5, 2], [1, -1]],
    onset: 0.08, dur: [2.0, 3.4], breath: 0.5, release: 0.9,
  })
  const rng = new AudioRng(seed ^ 0x5151)
  for (let w = 0; w < Math.max(3, Math.round(voices / 5)); w++) {
    renderWhistle(out, sr, rng.range(0.1, 2.2), rng.range(0.3, 1.1), rng.range(2200, 3400), rng.range(0, 5), rng.range(0.06, 0.14), rng)
  }
  return normalize(out, 0.9)
}

/** Booing (loops): low sustained "boooo". */
export function renderBoo(seconds: number, voices: number, seed: number, sr = TEXTURE_RATE): Float32Array {
  const out = new Float32Array(Math.round(seconds * sr))
  const rng = new AudioRng(seed)
  for (let v = 0; v < voices; v++) {
    const base = voiceBase(rng)
    let t = rng.range(0, seconds)
    let used = 0
    while (used < seconds) {
      const dur = rng.range(0.9, 2.2)
      renderVoice(out, sr, {
        start: t, dur, f0: base.f0 * rng.range(0.85, 1.1), contour: [[0, 0], [0.7, -0.5], [1, -3]],
        vowel: 'u', amp: rng.range(0.4, 1), attack: 0.12, release: 0.3, vibDepth: 0.1, breath: 0.35, fScale: base.fScale * 0.95,
      }, rng, true)
      t += dur + rng.range(0.05, 0.4)
      used += dur + 0.2
    }
  }
  return normalize(dcBlock(out, sr), 0.9)
}

/** Derisive whistling from the stands (loops). */
export function renderWhistles(seconds: number, count: number, seed: number, sr = TEXTURE_RATE): Float32Array {
  const out = new Float32Array(Math.round(seconds * sr))
  const rng = new AudioRng(seed)
  for (let i = 0; i < count; i++) {
    renderWhistle(out, sr, rng.range(0, seconds), rng.range(0.4, 1.6), rng.range(2000, 3600), rng.range(-2, 2), rng.range(0.5, 1), rng, true)
  }
  return normalize(out, 0.9)
}

/** One sung chant syllable by a whole stand (one-shot, base pitch `f0`). */
export function renderChantSyllable(vowel: Vowel, vowelTo: Vowel | undefined, f0: number, dur: number, voices: number, seed: number, sr = TEXTURE_RATE): Float32Array {
  const out = new Float32Array(Math.round((dur + 0.25) * sr))
  const rng = new AudioRng(seed)
  for (let v = 0; v < voices; v++) {
    const female = rng.chance(0.25)
    // Everyone sings the same note; women and kids an octave up.
    const pitch = f0 * (female ? 2 : 1) * Math.pow(2, (rng.gauss() * 22) / 1200)
    renderVoice(out, sr, {
      start: Math.abs(rng.gauss()) * 0.03, dur: dur * rng.range(0.9, 1.08), f0: pitch,
      contour: [[0, -0.6], [0.15, 0], [1, -0.3]], vowel, vowelTo, amp: rng.range(0.5, 1), attack: 0.04, release: Math.min(0.15, dur * 0.35),
      vibHz: rng.range(4.5, 6), vibDepth: 0.08, breath: 0.3, fScale: female ? 1.17 : rng.range(0.95, 1.05),
    }, rng)
  }
  return normalize(dcBlock(out, sr), 0.9)
}

/** A whole stand clapping once, with human timing spread. */
export function renderClapHit(claps: number, spreadSec: number, seed: number, sr = TEXTURE_RATE): Float32Array {
  const out = new Float32Array(Math.round(0.4 * sr))
  const rng = new AudioRng(seed)
  for (let i = 0; i < claps; i++) renderClap(out, sr, 0.08 + rng.gauss() * spreadSec * 0.5, rng.range(0.4, 1), rng)
  return normalize(out, 0.9)
}

/** Free applause (loops); `rate` claps per second in total. */
export function renderApplause(seconds: number, rate: number, seed: number, sr = TEXTURE_RATE): Float32Array {
  const out = new Float32Array(Math.round(seconds * sr))
  const rng = new AudioRng(seed)
  const n = Math.round(seconds * rate)
  for (let i = 0; i < n; i++) renderClap(out, sr, rng.range(0, seconds), rng.range(0.3, 1), rng, true)
  return normalize(out, 0.9)
}

/** A single loud fan shout (small grounds). */
export function renderShout(seed: number, sr = TEXTURE_RATE): Float32Array {
  const rng = new AudioRng(seed)
  const out = new Float32Array(Math.round(1.1 * sr))
  const base = voiceBase(rng)
  const syl = rng.int(1, 3)
  let t = 0.02
  for (let s = 0; s < syl; s++) {
    const dur = s === syl - 1 ? rng.range(0.3, 0.55) : rng.range(0.12, 0.2)
    renderVoice(out, sr, {
      start: t, dur, f0: base.f0 * rng.range(1.5, 2.1), contour: [[0, 1], [1, s === syl - 1 ? -4 : 0]],
      vowel: rng.pick(['a', 'e', 'o', 'eh'] as const), vowelTo: rng.pick(['a', 'eh', 'aw'] as const), amp: 1,
      attack: 0.015, release: 0.08, vibDepth: 0.1, breath: 0.45, fScale: base.fScale,
    }, rng)
    t += dur + 0.03
  }
  return normalize(dcBlock(out, sr), 0.9)
}

/**
 * Stereo impulse response for a procedural reverb: decaying noise whose tail
 * darkens over time (high frequencies die first, like a real space).
 */
export function renderImpulse(seconds: number, decay: number, seed: number, sr: number, brightness = 0.6): [Float32Array, Float32Array] {
  const n = Math.max(1, Math.round(seconds * sr))
  const out: [Float32Array, Float32Array] = [new Float32Array(n), new Float32Array(n)]
  for (let ch = 0; ch < 2; ch++) {
    const rng = new AudioRng(seed + ch * 7919)
    const d = out[ch]!
    let lp = 0
    for (let i = 0; i < n; i++) {
      const frac = i / n
      const env = Math.pow(1 - frac, decay) * (i < sr * 0.004 ? i / (sr * 0.004) : 1)
      const k = brightness * (1 - frac * 0.85) + 0.03
      lp += ((rng.next() * 2 - 1) - lp) * k
      d[i] = lp * env
    }
  }
  // Unit energy: a noise-like input comes out of the convolver at about the same RMS.
  let e = 0
  for (const d of out) for (let i = 0; i < d.length; i++) e += d[i]! * d[i]!
  const k = e > 0 ? 1 / Math.sqrt(e / 2) : 0
  for (const d of out) for (let i = 0; i < d.length; i++) d[i]! *= k
  return out
}

/** Seamlessly loopable stereo pink-ish noise (Paul Kellet's economy filter). */
export function renderPinkNoise(seconds: number, seed: number, sr: number): Float32Array {
  const n = Math.round(seconds * sr)
  const out = new Float32Array(n)
  const rng = new AudioRng(seed)
  let b0 = 0
  let b1 = 0
  let b2 = 0
  for (let i = 0; i < n; i++) {
    const w = rng.next() * 2 - 1
    b0 = 0.99765 * b0 + w * 0.099046
    b1 = 0.963 * b1 + w * 0.2965164
    b2 = 0.57 * b2 + w * 1.0526913
    out[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2
  }
  // Crossfade the tail into the head so the loop has no click.
  const xf = Math.min(Math.round(0.05 * sr), Math.floor(n / 4))
  for (let i = 0; i < xf; i++) {
    const a = i / xf
    out[i] = out[i]! * a + out[n - xf + i]! * (1 - a)
  }
  return normalize(out.subarray(0, n - xf).slice(), 0.9)
}
