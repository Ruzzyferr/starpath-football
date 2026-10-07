/**
 * Procedural sound effects (WebAudio, no assets): kick thump, referee
 * whistle, net swish, post clang, bounces, tackles and a crowd bed that swells
 * into a roar. All sounds route through a master gain set from settings.sound.
 *
 * The AudioContext is created lazily and resumed on the first user gesture
 * (browser autoplay policy). Every method is a safe no-op without WebAudio.
 */

type Ctx = AudioContext

export class Sfx {
  private ctx: Ctx | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null
  private crowdGain: GainNode | null = null
  private crowdFilter: BiquadFilterNode | null = null
  private crowdSrc: AudioBufferSourceNode | null = null
  private cheerGain: GainNode | null = null
  private volume: number
  private disposed = false

  /** @param volume 0..1 master volume (settings.sound) */
  constructor(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume))
  }

  /** Creates/resumes the context; call from a user gesture. */
  unlock(): void {
    if (this.disposed || this.volume <= 0) return
    if (!this.ctx) {
      const AC: typeof AudioContext | undefined =
        typeof window !== 'undefined' ? window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext : undefined
      if (!AC) return
      try {
        this.ctx = new AC()
      } catch {
        return
      }
      this.master = this.ctx.createGain()
      this.master.gain.value = this.volume * 0.9
      // Gentle limiter so roars + kicks never clip.
      const comp = this.ctx.createDynamicsCompressor()
      comp.threshold.value = -10
      comp.ratio.value = 6
      this.master.connect(comp).connect(this.ctx.destination)
      this.noise = this.makeNoise(2)
      this.startCrowd()
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined)
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v))
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.volume * 0.9, this.ctx.currentTime, 0.05)
  }

  dispose(): void {
    this.disposed = true
    try {
      this.crowdSrc?.stop()
    } catch {
      /* already stopped */
    }
    void this.ctx?.close().catch(() => undefined)
    this.ctx = null
  }

  private get ready(): boolean {
    return !!this.ctx && !!this.master && this.ctx.state === 'running' && this.volume > 0
  }

  private makeNoise(seconds: number): AudioBuffer {
    const ctx = this.ctx!
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate)
    const d = buf.getChannelData(0)
    // Deterministic LCG noise (no Math.random needed).
    let s = 1234567
    for (let i = 0; i < d.length; i++) {
      s = (s * 1664525 + 1013904223) >>> 0
      d[i] = (s / 4294967296) * 2 - 1
    }
    return buf
  }

  private noiseSrc(): AudioBufferSourceNode {
    const src = this.ctx!.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    return src
  }

  private env(g: GainNode, t: number, peak: number, attack: number, decay: number): void {
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  }

  // ───────────────────────── Crowd ─────────────────────────

  private startCrowd(): void {
    const ctx = this.ctx!
    // Brown-ish murmur: noise → lowpass → bandpass formant.
    const src = this.noiseSrc()
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 700
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 450
    bp.Q.value = 0.6
    const g = ctx.createGain()
    g.gain.value = 0.13
    src.connect(lp).connect(bp).connect(g).connect(this.master!)
    // Cheer layer (brighter), silent until a roar.
    const src2 = this.noiseSrc()
    const bp2 = ctx.createBiquadFilter()
    bp2.type = 'bandpass'
    bp2.frequency.value = 1300
    bp2.Q.value = 0.8
    const g2 = ctx.createGain()
    g2.gain.value = 0.0001
    src2.connect(bp2).connect(g2).connect(this.master!)
    src.start()
    src2.start(ctx.currentTime + 0.37)
    this.crowdSrc = src
    this.crowdGain = g
    this.crowdFilter = lp
    this.cheerGain = g2
  }

  /** Sets the ambient crowd tension 0..1 (e.g. near goal, bullet time). */
  crowdTension(v: number): void {
    if (!this.ready || !this.crowdGain || !this.crowdFilter) return
    const t = this.ctx!.currentTime
    const k = Math.max(0, Math.min(1, v))
    this.crowdGain.gain.setTargetAtTime(0.1 + k * 0.14, t, 0.4)
    this.crowdFilter.frequency.setTargetAtTime(600 + k * 900, t, 0.4)
  }

  /** Big swell (goal) or smaller "ooh" (near miss). */
  roar(intensity = 1): void {
    if (!this.ready || !this.cheerGain || !this.crowdGain) return
    const t = this.ctx!.currentTime
    const peak = 0.12 + 0.55 * intensity
    this.cheerGain.gain.cancelScheduledValues(t)
    this.cheerGain.gain.setValueAtTime(Math.max(0.0001, this.cheerGain.gain.value), t)
    this.cheerGain.gain.exponentialRampToValueAtTime(peak, t + 0.25)
    this.cheerGain.gain.exponentialRampToValueAtTime(peak * 0.6, t + 1.6)
    this.cheerGain.gain.exponentialRampToValueAtTime(0.0001, t + 4.5)
    this.crowdGain.gain.setTargetAtTime(0.13 + 0.25 * intensity, t, 0.15)
    this.crowdGain.gain.setTargetAtTime(0.13, t + 2.5, 1)
  }

  /** Disappointed groan. */
  groan(): void {
    if (!this.ready) return
    const ctx = this.ctx!
    const t = ctx.currentTime
    const src = this.noiseSrc()
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 1.2
    bp.frequency.setValueAtTime(700, t)
    bp.frequency.exponentialRampToValueAtTime(260, t + 1.2)
    const g = ctx.createGain()
    this.env(g, t, 0.28, 0.12, 1.3)
    src.connect(bp).connect(g).connect(this.master!)
    src.start(t)
    src.stop(t + 1.6)
  }

  // ───────────────────────── One-shots ─────────────────────────

  /** Boot on ball: low sine drop + short noise click. */
  kick(power = 0.7): void {
    if (!this.ready) return
    const ctx = this.ctx!
    const t = ctx.currentTime
    const p = Math.max(0.15, Math.min(1.2, power))
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(170 + p * 60, t)
    o.frequency.exponentialRampToValueAtTime(48, t + 0.13)
    const g = ctx.createGain()
    this.env(g, t, 0.55 * p + 0.15, 0.004, 0.16)
    o.connect(g).connect(this.master!)
    o.start(t)
    o.stop(t + 0.2)
    const n = this.noiseSrc()
    const hp = ctx.createBiquadFilter()
    hp.type = 'bandpass'
    hp.frequency.value = 1800
    hp.Q.value = 0.7
    const g2 = ctx.createGain()
    this.env(g2, t, 0.22 * p, 0.002, 0.045)
    n.connect(hp).connect(g2).connect(this.master!)
    n.start(t)
    n.stop(t + 0.08)
  }

  /** Light dribble touch / bounce. */
  tap(strength = 0.3): void {
    if (!this.ready) return
    const ctx = this.ctx!
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(120, t)
    o.frequency.exponentialRampToValueAtTime(60, t + 0.06)
    const g = ctx.createGain()
    this.env(g, t, 0.18 * strength + 0.02, 0.003, 0.07)
    o.connect(g).connect(this.master!)
    o.start(t)
    o.stop(t + 0.1)
  }

  /** Referee whistle: two detuned square-ish tones with a pea trill. */
  whistle(long = false): void {
    if (!this.ready) return
    const ctx = this.ctx!
    const t = ctx.currentTime
    const dur = long ? 0.85 : 0.28
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.02)
    g.gain.setValueAtTime(0.16, t + dur - 0.06)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 2900
    bp.Q.value = 4
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 32
    const lfoG = ctx.createGain()
    lfoG.gain.value = 140
    lfo.connect(lfoG)
    for (const f of [2860, 3010]) {
      const o = ctx.createOscillator()
      o.type = 'triangle'
      o.frequency.value = f
      lfoG.connect(o.frequency)
      o.connect(bp)
      o.start(t)
      o.stop(t + dur + 0.02)
    }
    bp.connect(g).connect(this.master!)
    lfo.start(t)
    lfo.stop(t + dur + 0.02)
  }

  /** Net ripple swish. */
  net(speed = 15): void {
    if (!this.ready) return
    const ctx = this.ctx!
    const t = ctx.currentTime
    const n = this.noiseSrc()
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 1.5
    bp.frequency.setValueAtTime(4200, t)
    bp.frequency.exponentialRampToValueAtTime(1400, t + 0.35)
    const g = ctx.createGain()
    this.env(g, t, Math.min(0.45, 0.15 + speed * 0.012), 0.01, 0.42)
    n.connect(bp).connect(g).connect(this.master!)
    n.start(t)
    n.stop(t + 0.5)
  }

  /** Metallic post/bar clang (inharmonic partials). */
  clang(speed = 20): void {
    if (!this.ready) return
    const ctx = this.ctx!
    const t = ctx.currentTime
    const amp = Math.min(0.35, 0.12 + speed * 0.008)
    for (const [f, a, d] of [[523, 1, 0.9], [1247, 0.6, 0.6], [2094, 0.4, 0.4], [3301, 0.25, 0.25]] as const) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      const g = ctx.createGain()
      this.env(g, t, amp * a, 0.002, d)
      o.connect(g).connect(this.master!)
      o.start(t)
      o.stop(t + d + 0.05)
    }
    this.kick(0.5)
  }

  /** Slide / body contact scuff. */
  scuff(): void {
    if (!this.ready) return
    const ctx = this.ctx!
    const t = ctx.currentTime
    const n = this.noiseSrc()
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 900
    const g = ctx.createGain()
    this.env(g, t, 0.25, 0.02, 0.3)
    n.connect(lp).connect(g).connect(this.master!)
    n.start(t)
    n.stop(t + 0.4)
  }

  /** Keeper glove catch: soft thud + slap. */
  glove(): void {
    if (!this.ready) return
    this.tap(1)
    const ctx = this.ctx!
    const t = ctx.currentTime
    const n = this.noiseSrc()
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 900
    const g = ctx.createGain()
    this.env(g, t, 0.3, 0.002, 0.09)
    n.connect(bp).connect(g).connect(this.master!)
    n.start(t)
    n.stop(t + 0.12)
  }

  /** Short UI/bullet-time "whoosh" (pitch sweep). */
  whoosh(down = true): void {
    if (!this.ready) return
    const ctx = this.ctx!
    const t = ctx.currentTime
    const n = this.noiseSrc()
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 2
    bp.frequency.setValueAtTime(down ? 1800 : 400, t)
    bp.frequency.exponentialRampToValueAtTime(down ? 300 : 1600, t + 0.3)
    const g = ctx.createGain()
    this.env(g, t, 0.12, 0.05, 0.3)
    n.connect(bp).connect(g).connect(this.master!)
    n.start(t)
    n.stop(t + 0.4)
  }
}
