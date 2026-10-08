/**
 * Six-channel mixer: master + music, sfx, crowd, ui and voice (commentary,
 * reserved). Pure gain/ducking math is exported separately from the WebAudio
 * graph so it can be unit-tested without an AudioContext.
 *
 * Graph:
 *   bus(music) ─ duck ─┐
 *   bus(sfx)   ────────┤
 *   bus(crowd) ─ duck ─┼─ master ─ glue compressor ─ limiter ─ trim(-1 dB) ─ out
 *   bus(ui)    ────────┤
 *   bus(voice) ────────┘
 */

export type Bus = 'music' | 'sfx' | 'crowd' | 'ui' | 'voice'
export type Channel = 'master' | Bus
export const BUSES: readonly Bus[] = ['music', 'sfx', 'crowd', 'ui', 'voice']

/** User-facing mix (0..1 sliders) as stored in settings. */
export interface MixSettings {
  master: number
  music: number
  sfx: number
  crowd: number
  ui: number
  voice: number
  muted: boolean
  /** "Reduced sound": essential cues only, no chants, calmer crowd. */
  reduced: boolean
}

export const DEFAULT_MIX: MixSettings = { master: 0.9, music: 0.6, sfx: 0.8, crowd: 0.8, ui: 0.7, voice: 0.8, muted: false, reduced: false }

/** Fixed per-bus headroom so a full-scale slider still leaves room for the other buses. */
export const BUS_TRIM: Record<Bus, number> = { music: 0.3, sfx: 0.6, crowd: 0.28, ui: 0.5, voice: 0.5 }

const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0)

/** Perceptual slider → linear gain (squared law: 50 % ≈ -12 dB). */
export function sliderToGain(v: number): number {
  const x = clamp01(v)
  return x * x
}

export function gainToDb(g: number): number {
  return g <= 0 ? -Infinity : 20 * Math.log10(g)
}

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20)
}

/** Normalises any partial/garbage input into a valid mix. */
export function sanitizeMix(m: Partial<MixSettings> | null | undefined): MixSettings {
  const src = m ?? {}
  const num = (k: Exclude<keyof MixSettings, 'muted' | 'reduced'>) => {
    const v = src[k]
    return typeof v === 'number' && Number.isFinite(v) ? clamp01(v) : DEFAULT_MIX[k]
  }
  return {
    master: num('master'), music: num('music'), sfx: num('sfx'), crowd: num('crowd'), ui: num('ui'), voice: num('voice'),
    muted: src.muted === true, reduced: src.reduced === true,
  }
}

/** Linear gain of the master stage. */
export function masterGain(m: MixSettings): number {
  return m.muted ? 0 : sliderToGain(m.master)
}

/** Linear gain of one bus (excluding master and ducking). */
export function busGain(m: MixSettings, bus: Bus): number {
  const reducedTrim = m.reduced && (bus === 'crowd' || bus === 'music') ? 0.7 : 1
  return sliderToGain(m[bus]) * BUS_TRIM[bus] * reducedTrim
}

/** Effective linear gain a source on `bus` reaches the limiter with (no ducking). */
export function effectiveGain(m: MixSettings, bus: Bus): number {
  return masterGain(m) * busGain(m, bus)
}

export interface Duck {
  /** Attenuation in dB (positive number = how far down). */
  depthDb: number
  start: number
  attack: number
  hold: number
  release: number
}

/** Attenuation (dB, >= 0) of one duck at time t. */
export function duckDbAt(d: Duck, t: number): number {
  const x = t - d.start
  if (x < 0) return 0
  if (x < d.attack) return d.depthDb * (x / Math.max(1e-6, d.attack))
  if (x < d.attack + d.hold) return d.depthDb
  const r = x - d.attack - d.hold
  if (r < d.release) return d.depthDb * (1 - r / Math.max(1e-6, d.release))
  return 0
}

/** Overlapping ducks do not stack: the deepest one wins. */
export function combinedDuckGain(ducks: readonly Duck[], t: number): number {
  let db = 0
  for (const d of ducks) db = Math.max(db, duckDbAt(d, t))
  return dbToGain(-db)
}

/** Drops ducks that are fully released by time t. */
export function pruneDucks(ducks: Duck[], t: number): Duck[] {
  return ducks.filter((d) => t < d.start + d.attack + d.hold + d.release)
}

// ───────────────────────── WebAudio graph ─────────────────────────

const RAMP = 0.06

export class Mixer {
  readonly ctx: BaseAudioContext
  readonly input: Record<Bus, GainNode>
  readonly master: GainNode
  readonly output: GainNode
  private readonly duckNodes: Partial<Record<Bus, GainNode>> = {}
  private ducks: Partial<Record<Bus, Duck[]>> = {}
  private mix: MixSettings

  constructor(ctx: BaseAudioContext, mix: MixSettings, destination: AudioNode = ctx.destination) {
    this.ctx = ctx
    this.mix = sanitizeMix(mix)
    this.master = ctx.createGain()
    this.master.gain.value = masterGain(this.mix)
    // Gentle glue compression, then a fast limiter, then -1 dB of ceiling.
    const glue = ctx.createDynamicsCompressor()
    glue.threshold.value = -18
    glue.knee.value = 10
    glue.ratio.value = 2.5
    glue.attack.value = 0.012
    glue.release.value = 0.25
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -6
    limiter.knee.value = 0
    limiter.ratio.value = 20
    limiter.attack.value = 0.001
    limiter.release.value = 0.12
    this.output = ctx.createGain()
    this.output.gain.value = dbToGain(-1.5)
    this.master.connect(glue).connect(limiter).connect(this.output).connect(destination)
    const input = {} as Record<Bus, GainNode>
    for (const b of BUSES) {
      const g = ctx.createGain()
      g.gain.value = busGain(this.mix, b)
      if (b === 'music' || b === 'crowd') {
        const d = ctx.createGain()
        g.connect(d).connect(this.master)
        this.duckNodes[b] = d
      } else g.connect(this.master)
      input[b] = g
    }
    this.input = input
  }

  get settings(): MixSettings {
    return this.mix
  }

  setMix(m: Partial<MixSettings>): void {
    this.mix = sanitizeMix({ ...this.mix, ...m })
    const t = this.ctx.currentTime
    this.master.gain.setTargetAtTime(masterGain(this.mix), t, RAMP)
    for (const b of BUSES) this.input[b].gain.setTargetAtTime(busGain(this.mix, b), t, RAMP)
  }

  /** Quick fade of the whole output to silence (app backgrounded) and back; the saved mix is untouched. */
  fadeMaster(silent: boolean, tau = 0.05): void {
    this.master.gain.setTargetAtTime(silent ? 0 : masterGain(this.mix), this.ctx.currentTime, tau)
  }

  /** Temporarily pulls a bus down (music under a goal roar, crowd under a sting). */
  duck(bus: 'music' | 'crowd', depthDb: number, opts: { attack?: number; hold?: number; release?: number; at?: number } = {}): void {
    const node = this.duckNodes[bus]
    if (!node) return
    const t = Math.max(this.ctx.currentTime, opts.at ?? this.ctx.currentTime)
    const d: Duck = { depthDb, start: t, attack: opts.attack ?? 0.12, hold: opts.hold ?? 1.5, release: opts.release ?? 1.8 }
    const list = pruneDucks(this.ducks[bus] ?? [], t)
    list.push(d)
    this.ducks[bus] = list
    // Re-plan the gain curve from the combined envelope (sampled; cheap).
    const p = node.gain
    p.cancelScheduledValues(t)
    p.setValueAtTime(combinedDuckGain(list, t), t)
    const end = Math.max(...list.map((x) => x.start + x.attack + x.hold + x.release))
    const step = 0.05
    for (let x = t + step; x <= end + 1e-6; x += step) p.linearRampToValueAtTime(combinedDuckGain(list, x), x)
    p.linearRampToValueAtTime(1, end + step)
  }
}
