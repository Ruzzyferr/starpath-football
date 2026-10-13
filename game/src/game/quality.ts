/**
 * Graphics quality profiles (WP-16): Low / Medium / High, or Auto from a short
 * device benchmark. A profile sets the particle budget (how many effect
 * particles may be alive at once), a per-burst particle scale, crowd density,
 * weather particle rate and a few glow extras.
 *
 * "Flashes off" is NOT part of a profile: it is an accessibility setting that
 * applies on every profile (see ui/store.ts `reduceFlashes`).
 *
 * Pure TS apart from `runDeviceBenchmark` (reads `performance` / `navigator`).
 */

export type QualityProfile = 'low' | 'medium' | 'high'
export type QualityChoice = QualityProfile | 'auto'
export const QUALITY_PROFILES: readonly QualityProfile[] = ['low', 'medium', 'high']

export interface QualitySpec {
  profile: QualityProfile
  /** Multiplier on every burst (grass kicks, confetti). */
  particleScale: number
  /** Hard cap on effect particles alive at the same time (all bursts together). */
  particleBudget: number
  /** Multiplier on the stadium's crowd density (seats filled with sprites). */
  crowdScale: number
  /** Tifo / fan flag blocks in mega stadiums. */
  tifo: boolean
  /** Weather particle emission rate multiplier (1 = full). */
  weatherRate: number
  /** Every n-th floodlight lamp gets a glow sprite. */
  lampStep: number
  /** LED ad glow and celebration confetti. */
  glow: boolean
  /** Bullet-time desaturation (a full-screen colour-matrix pass while slowed; 2.2#14). */
  desaturate: boolean
}

export const QUALITY: Readonly<Record<QualityProfile, QualitySpec>> = {
  low: { profile: 'low', particleScale: 0.4, particleBudget: 120, crowdScale: 0.6, tifo: false, weatherRate: 0.5, lampStep: 2, glow: false, desaturate: false },
  medium: { profile: 'medium', particleScale: 0.7, particleBudget: 260, crowdScale: 0.82, tifo: true, weatherRate: 0.75, lampStep: 1, glow: true, desaturate: true },
  high: { profile: 'high', particleScale: 1, particleBudget: 480, crowdScale: 1, tifo: true, weatherRate: 1, lampStep: 1, glow: true, desaturate: true },
}

export const isQualityChoice = (v: unknown): v is QualityChoice => v === 'auto' || v === 'low' || v === 'medium' || v === 'high'

/** The profile in effect: an explicit choice, else the benchmark result, else medium. */
export function resolveQuality(choice: QualityChoice | undefined, auto: QualityProfile | null | undefined): QualityProfile {
  if (choice && choice !== 'auto') return choice
  return auto ?? 'medium'
}

// ───────────────────────── Device benchmark ─────────────────────────

export interface DeviceProbe {
  /** Median time (ms) for the fixed benchmark workload. */
  benchMs: number
  cores: number
  /** navigator.deviceMemory (GB), 0 when unknown. */
  memoryGb: number
  /** Touch-first device (phones / tablets). */
  coarse: boolean
  /** Unmasked WebGL renderer string ('' when unknown or WebGL is unavailable). */
  gpu?: string
}

export type GpuClass = 'low' | 'mid' | 'high' | 'unknown'

/**
 * Coarse GPU class from the WebGL renderer string. Software rasterisers and old mobile parts are
 * Low; mid-range phone GPUs (e.g. the Galaxy A52's Adreno 618, Mali-G52/G57/G68) are Mid; flagship
 * and desktop parts are High. Anything unrecognised is 'unknown' (the benchmark alone decides).
 */
export function gpuClass(renderer: string | undefined): GpuClass {
  const r = (renderer ?? '').toLowerCase()
  if (!r) return 'unknown'
  if (/swiftshader|llvmpipe|softpipe|software|microsoft basic render/.test(r)) return 'low'
  const adreno = /adreno[^0-9]*(\d{3})/.exec(r)
  if (adreno) {
    const n = Number(adreno[1])
    return n < 600 ? 'low' : n < 640 ? 'mid' : 'high'
  }
  const mali = /mali-?([a-z]?)(\d+)/.exec(r)
  if (mali) {
    const series = mali[1]
    const n = Number(mali[2])
    if (series !== 'g') return 'low' // Mali-400 / T-series
    return n < 57 ? 'low' : n < 710 ? 'mid' : 'high' // G52 low … G78 mid … G710+ high
  }
  if (/powervr|vivante|videocore/.test(r)) return 'low'
  if (/apple|nvidia|geforce|radeon|amd|xclipse|immortalis/.test(r)) return 'high'
  if (/intel/.test(r)) return 'mid'
  return 'unknown'
}

/** Benchmark time thresholds (ms) for the reference workload. A 2020 laptop runs it in ~4 ms. */
export const BENCH_MS = { high: 9, medium: 22 } as const

/**
 * Map a probe to a profile. The timing decides; very few cores or little memory
 * caps the result one step lower, and phones never start on High (heat/battery).
 */
export function profileFromProbe(p: DeviceProbe): QualityProfile {
  let rank = p.benchMs <= BENCH_MS.high ? 2 : p.benchMs <= BENCH_MS.medium ? 1 : 0
  if ((p.cores > 0 && p.cores <= 2) || (p.memoryGb > 0 && p.memoryGb <= 2)) rank = Math.min(rank, 0)
  else if ((p.cores > 0 && p.cores <= 4) || (p.memoryGb > 0 && p.memoryGb <= 4)) rank = Math.min(rank, 1)
  if (p.coarse) rank = Math.min(rank, 1)
  const gpu = gpuClass(p.gpu)
  if (gpu === 'low') rank = 0
  else if (gpu === 'mid') rank = Math.min(rank, 1)
  return QUALITY_PROFILES[rank]!
}

/** Frame rate (fps) under which a measured Auto profile drops one step. */
export const FPS_FLOOR = 40

/** The Auto profile after a short frame-rate probe: a device that cannot hold {@link FPS_FLOOR} drops a step. */
export function adjustForFps(profile: QualityProfile, fps: number): QualityProfile {
  if (!Number.isFinite(fps) || fps <= 0 || fps >= FPS_FLOOR) return profile
  const rank = QUALITY_PROFILES.indexOf(profile)
  return QUALITY_PROFILES[Math.max(0, rank - 1)]!
}

/** Unmasked GPU renderer string via a throw-away WebGL context ('' if unavailable). Browser only. */
export function readGpuRenderer(): string {
  try {
    if (typeof document === 'undefined') return ''
    const c = document.createElement('canvas')
    const gl = (c.getContext('webgl') ?? c.getContext('experimental-webgl')) as WebGLRenderingContext | null
    if (!gl) return ''
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '')
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return name
  } catch {
    return ''
  }
}

/** Average frame rate over `ms` of requestAnimationFrame (resolves 0 without rAF). Browser only. */
export function measureFps(ms = 1000): Promise<number> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== 'function' || typeof performance === 'undefined') return resolve(0)
    let frames = 0
    let t0 = 0
    const tick = (t: number) => {
      if (!t0) t0 = t
      else frames++
      if (t - t0 >= ms) resolve((frames * 1000) / (t - t0))
      else requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

/** The fixed workload: particle-style float integration over typed arrays. */
function workload(): number {
  const n = 4000
  const x = new Float32Array(n)
  const v = new Float32Array(n)
  for (let i = 0; i < n; i++) v[i] = (i % 17) - 8
  let acc = 0
  for (let step = 0; step < 60; step++) {
    for (let i = 0; i < n; i++) {
      v[i] = v[i]! * 0.98 + Math.sin(i + step) * 0.1
      x[i]! += v[i]! * 0.016
      acc += x[i]!
    }
  }
  return acc
}

let benchSink = 0
/** Last benchmark checksum (debug). */
export const lastBenchSink = (): number => benchSink

/** Runs the benchmark (~3 × a few ms) and reads device hints. Browser only. */
export function runDeviceBenchmark(): DeviceProbe {
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
  workload() // warm-up (JIT)
  const times: number[] = []
  let sink = 0
  for (let i = 0; i < 3; i++) {
    const t0 = now()
    sink += workload()
    times.push(now() - t0)
  }
  times.sort((a, b) => a - b)
  const nav = (typeof navigator !== 'undefined' ? navigator : {}) as { hardwareConcurrency?: number; deviceMemory?: number }
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  benchSink = sink // keeps the workload observable (no dead-code elimination)
  // No GPU readout here: it creates a WebGL context, which stays off the boot path (see detectQuality).
  return { benchMs: times[1]!, cores: nav.hardwareConcurrency ?? 0, memoryGb: nav.deviceMemory ?? 0, coarse }
}

// ───────────────────────── Particle budget ─────────────────────────

/**
 * Fixed particle budget shared by every burst in a scene. A burst asks for n
 * particles that live up to `lifeMs`; it is scaled by the profile and clamped
 * to what is left of the budget, so stacked goals / tackles never exceed it.
 */
export class ParticleBudget {
  private live: { until: number; n: number }[] = []
  readonly spec: QualitySpec
  constructor(spec: QualitySpec) {
    this.spec = spec
  }

  /** Particles alive at `now` (ms). */
  alive(now: number): number {
    this.live = this.live.filter((b) => b.until > now)
    return this.live.reduce((s, b) => s + b.n, 0)
  }

  /** How many of `n` requested particles may be emitted now (0 when the budget is spent). */
  take(n: number, lifeMs: number, now: number): number {
    const want = Math.max(1, Math.round(n * this.spec.particleScale))
    const grant = Math.max(0, Math.min(want, this.spec.particleBudget - this.alive(now)))
    if (grant > 0) this.live.push({ until: now + lifeMs, n: grant })
    return grant
  }
}

// ───────────────────────── Render resolution (DPR profile) ─────────────────────────

/** Backing-store pixel budget per device class (width × height, in device px). */
export const PIXEL_BUDGET = { desktop: 5_200_000, coarse: 1_900_000 } as const
/** Highest device-pixel ratio ever rendered at (a 3x store costs ~2.25x fill for no visible gain). */
export const DPR_CAP = 2

/**
 * Render scale for the match canvas (WP-P, 2.9#13). Starts from the device
 * ratio (capped at {@link DPR_CAP}), then lowers it so the backing store stays
 * inside a pixel budget: far tighter on touch-first devices (heat, battery,
 * mid-range GPUs), the Low profile never renders above 1.25x and Medium on touch devices
 * never above 1.5x. Never below
 * 1, never above the device ratio. Result is rounded to 0.05 steps.
 */
export function renderScale(opts: { dpr: number; cssW: number; cssH: number; coarse: boolean; profile?: QualityProfile }): number {
  let s = Math.min(DPR_CAP, Math.max(1, Number.isFinite(opts.dpr) ? opts.dpr : 1))
  if (opts.profile === 'low') s = Math.min(s, 1.25)
  // Mid-range phones are fill-rate bound: Medium renders touch devices at no more than 1.5x.
  else if (opts.profile === 'medium' && opts.coarse) s = Math.min(s, 1.5)
  const area = Math.max(1, opts.cssW) * Math.max(1, opts.cssH)
  const budget = opts.coarse ? PIXEL_BUDGET.coarse : PIXEL_BUDGET.desktop
  s = Math.min(s, Math.sqrt(budget / area))
  return Math.max(1, Math.floor(s * 20) / 20)
}

/** The quality profile a highlight's settings ask for (explicit profile, else the legacy low-effects flag). */
export function profileOfSettings(s: { quality?: QualityProfile; lowFx?: boolean }): QualityProfile | undefined {
  return s.quality ?? (s.lowFx ? 'low' : undefined)
}
