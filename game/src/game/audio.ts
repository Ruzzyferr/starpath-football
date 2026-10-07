/**
 * Match/training sound effects (procedural WebAudio, no assets), routed
 * through the shared audio engine (src/audio): every one-shot goes to the SFX
 * bus, and the crowd methods drive the shared stadium crowd, so the crowd bed
 * of a live match carries on seamlessly into a highlight scene.
 *
 * The API is unchanged from the scene's point of view. The constructor's
 * `volume` is kept for compatibility but the level now comes from the mixer
 * (Settings → SFX / Crowd / Master). Every method is a safe no-op until the
 * audio context is unlocked by a user gesture.
 */
import { engine } from '../audio'
import type { Crowd, Side } from '../audio/crowd'
import { VoicePool, adEnv, noiseBuffers } from '../audio/synth'

export type WhistlePattern = 'start' | 'foul' | 'end' | 'half' | 'full'
export type KickSound = 'pass' | 'lofted' | 'through' | 'shot' | 'chip' | 'cross' | 'header' | 'clear' | 'penalty' | 'freekick' | 'volley'

let leaseSeq = 0

export class Sfx {
  private out: GainNode | null = null
  private ctx: AudioContext | null = null
  private trim: number
  private disposed = false
  private readonly lease = `scene-${++leaseSeq}`
  private leaseCap: number | undefined
  private held = false
  private readonly pool = new VoicePool(28)

  /** @param volume kept for API compatibility; the mixer owns levels now. */
  constructor(volume = 1) {
    this.trim = volume > 0 ? 1 : 0
    // Standalone pages (match demo) have no director: make sure gestures unlock.
    engine.install()
  }

  /** Creates/resumes the shared context; call from a user gesture. */
  unlock(): void {
    if (this.disposed) return
    engine.unlock()
    const bus = engine.sfxBus()
    if (bus && !this.out) {
      this.ctx = bus.ctx
      this.out = bus.ctx.createGain()
      this.out.gain.value = this.trim
      this.out.connect(bus.out)
    }
    if (!this.held) {
      this.held = true
      engine.holdCrowd(this.lease, this.leaseCap !== undefined ? { capacity: this.leaseCap } : {})
    }
  }

  /** Local trim on top of the mixer (0 silences this scene only). */
  setVolume(v: number): void {
    this.trim = Math.max(0, Math.min(1, v)) > 0 ? 1 : 0
    if (this.out && this.ctx) this.out.gain.setTargetAtTime(this.trim, this.ctx.currentTime, 0.05)
  }

  dispose(): void {
    this.disposed = true
    if (this.held) engine.releaseCrowd(this.lease)
    this.held = false
    try {
      this.out?.disconnect()
    } catch {
      /* already */
    }
    this.out = null
  }

  private get ready(): boolean {
    return !this.disposed && !!this.ctx && !!this.out && this.ctx.state === 'running' && this.trim > 0
  }

  private voice(dur: number): boolean {
    return this.pool.take(this.ctx!.currentTime, this.ctx!.currentTime + dur)
  }

  private noise(): AudioBufferSourceNode {
    const src = this.ctx!.createBufferSource()
    src.buffer = noiseBuffers(this.ctx!).white
    src.loop = true
    return src
  }

  private startNoise(src: AudioBufferSourceNode, t: number, dur: number): void {
    src.start(t, (t * 0.731) % 1.5)
    src.stop(t + dur)
  }

  private env(g: GainNode, t: number, peak: number, attack: number, decay: number): void {
    adEnv(g.gain, t, peak, attack, decay)
  }

  // ───────────────────────── Crowd ─────────────────────────

  private crowd(fn: (c: Crowd, hero: Side) => void): void {
    engine.withCrowd((c) => fn(c, c.state.heroSide))
  }

  /** Sets the ambient crowd tension 0..1 (e.g. near goal, bullet time). */
  crowdTension(v: number): void {
    engine.setTension(v)
  }

  /** Big eruption (≥ 0.9: the hero's team scored) or a smaller excited swell. */
  roar(intensity = 1): void {
    this.crowd((c, hero) => {
      if (intensity >= 0.9) c.goal(hero)
      else c.chance(hero, Math.min(1, intensity * 1.6))
    })
  }

  /** Disappointed groan from the hero's fans (the other end cheers a goal). */
  groan(): void {
    this.crowd((c, hero) => c.groan(hero))
  }

  /** Explicit, side-aware crowd reactions for the scene (team relative to the hero). */
  crowdGoal(team: 'hero' | 'opp'): void {
    this.crowd((c, hero) => c.goal(team === 'hero' ? hero : hero === 'home' ? 'away' : 'home'))
  }

  crowdOoh(team: 'hero' | 'opp' = 'hero'): void {
    this.crowd((c, hero) => c.nearMiss(team === 'hero' ? hero : hero === 'home' ? 'away' : 'home'))
  }

  crowdFoul(team: 'hero' | 'opp', card: 'yellow' | 'red' | null = null): void {
    this.crowd((c, hero) => c.foul(team === 'hero' ? hero : hero === 'home' ? 'away' : 'home', card))
  }

  /** Sets the crowd bed directly (0 = silent training ground, 1 = full stadium). */
  ambience(level: number): void {
    const k = Math.max(0, Math.min(1, level))
    // Training ground: a handful of onlookers; full = a big stadium.
    this.leaseCap = Math.round(40 + Math.pow(k, 2) * 60000)
    if (this.held) {
      if (k <= 0.001) engine.releaseCrowd(this.lease)
      else engine.holdCrowd(this.lease, { capacity: this.leaseCap })
    }
  }

  // ───────────────────────── One-shots ─────────────────────────

  /** Boot on ball; `kind` shapes the contact (driven shot vs. soft pass vs. scooped chip). */
  kick(power = 0.7, kind: KickSound = 'shot'): void {
    if (!this.ready || !this.voice(0.25)) return
    const ctx = this.ctx!
    const t = ctx.currentTime
    const p = Math.max(0.15, Math.min(1.2, power))
    const shot = kind === 'shot' || kind === 'penalty' || kind === 'freekick' || kind === 'volley' || kind === 'clear'
    const soft = kind === 'pass' || kind === 'through'
    const chip = kind === 'chip' || kind === 'lofted' || kind === 'cross'
    // Body: low sine drop (deeper and longer for driven shots).
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime((shot ? 150 : chip ? 210 : 190) + p * 60, t)
    o.frequency.exponentialRampToValueAtTime(shot ? 44 : 60, t + (shot ? 0.14 : 0.09))
    const g = ctx.createGain()
    this.env(g, t, (shot ? 0.65 : soft ? 0.38 : 0.45) * p + 0.12, 0.003, shot ? 0.2 : 0.12)
    o.connect(g).connect(this.out!)
    o.start(t)
    o.stop(t + 0.25)
    // Leather slap: brighter and sharper on a strike, a soft brush for chips.
    const n = this.noise()
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = shot ? 2300 : chip ? 1100 : 1700
    bp.Q.value = chip ? 0.9 : 0.7
    const g2 = ctx.createGain()
    this.env(g2, t, (shot ? 0.34 : chip ? 0.14 : 0.2) * p, chip ? 0.006 : 0.0015, shot ? 0.05 : chip ? 0.07 : 0.04)
    n.connect(bp).connect(g2).connect(this.out!)
    this.startNoise(n, t, 0.12)
    // A driven shot has a crack of air behind it.
    if (shot && p > 0.6) {
      const n2 = this.noise()
      const hp = ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.setValueAtTime(5000, t)
      const g3 = ctx.createGain()
      this.env(g3, t + 0.01, 0.06 * p, 0.01, 0.18)
      n2.connect(hp).connect(g3).connect(this.out!)
      this.startNoise(n2, t, 0.25)
    }
  }

  /** Electronic fitness-test beep (higher pitch on later levels). */
  beep(level = 1): void {
    if (!this.ready || !this.voice(0.2)) return
    const ctx = this.ctx!
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'square'
    o.frequency.value = 880 + Math.min(8, Math.max(0, level - 1)) * 40
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 2400
    const g = ctx.createGain()
    this.env(g, t, 0.12, 0.005, 0.16)
    o.connect(lp).connect(g).connect(this.out!)
    o.start(t)
    o.stop(t + 0.2)
  }

  /** Light dribble touch / bounce. */
  tap(strength = 0.3): void {
    if (!this.ready || !this.voice(0.1)) return
    const ctx = this.ctx!
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(120, t)
    o.frequency.exponentialRampToValueAtTime(60, t + 0.06)
    const g = ctx.createGain()
    this.env(g, t, 0.18 * strength + 0.02, 0.003, 0.07)
    o.connect(g).connect(this.out!)
    o.start(t)
    o.stop(t + 0.1)
  }

  /** Referee whistle: `long` = end of play. */
  whistle(long = false): void {
    this.whistlePattern(long ? 'end' : 'start')
  }

  /**
   * Referee whistle patterns: start (one pip), foul (sharp double chirp),
   * end (one long), half (two long), full (short-short-long).
   */
  whistlePattern(p: WhistlePattern): void {
    const blasts: Record<WhistlePattern, readonly (readonly [number, number])[]> = {
      start: [[0, 0.28]],
      foul: [[0, 0.12], [0.16, 0.22]],
      end: [[0, 0.85]],
      half: [[0, 0.55], [0.7, 0.75]],
      full: [[0, 0.3], [0.42, 0.3], [0.84, 1.1]],
    }
    for (const [at, dur] of blasts[p]) this.blast(at, dur)
  }

  private blast(at: number, dur: number): void {
    if (!this.ready || !this.voice(dur + 0.05)) return
    const ctx = this.ctx!
    const t = ctx.currentTime + at
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.02)
    g.gain.setValueAtTime(0.16, t + Math.max(0.03, dur - 0.06))
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 2900
    bp.Q.value = 4
    // Pea rattle: a fast frequency wobble.
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
    bp.connect(g).connect(this.out!)
    lfo.start(t)
    lfo.stop(t + dur + 0.02)
  }

  /** Net ripple swish. */
  net(speed = 15): void {
    if (!this.ready || !this.voice(0.5)) return
    const ctx = this.ctx!
    const t = ctx.currentTime
    const n = this.noise()
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 1.5
    bp.frequency.setValueAtTime(4200, t)
    bp.frequency.exponentialRampToValueAtTime(1400, t + 0.35)
    const g = ctx.createGain()
    this.env(g, t, Math.min(0.45, 0.15 + speed * 0.012), 0.01, 0.42)
    n.connect(bp).connect(g).connect(this.out!)
    this.startNoise(n, t, 0.5)
  }

  /**
   * Post/bar: a glancing touch is a dull "tonk"; a full strike rings the
   * frame (inharmonic partials, long decay). The crowd goes "ooh".
   */
  clang(speed = 20): void {
    if (this.ready && this.voice(1.6)) {
      const ctx = this.ctx!
      const t = ctx.currentTime
      const full = speed >= 16
      const amp = Math.min(0.35, 0.12 + speed * 0.008)
      const partials: readonly (readonly [number, number, number])[] = full
        ? [[523, 1, 1.4], [1247, 0.6, 0.9], [2094, 0.45, 0.6], [3301, 0.3, 0.35], [4410, 0.15, 0.2]]
        : [[412, 1, 0.35], [1010, 0.4, 0.2], [1880, 0.15, 0.1]]
      for (const [f, a, d] of partials) {
        const o = ctx.createOscillator()
        o.type = 'sine'
        o.frequency.value = f
        const g = ctx.createGain()
        this.env(g, t, amp * a, 0.002, d)
        o.connect(g).connect(this.out!)
        o.start(t)
        o.stop(t + d + 0.05)
      }
      this.kick(full ? 0.6 : 0.35, 'pass')
    }
    this.crowd((c, hero) => c.nearMiss(hero))
  }

  /** Slide / body contact scuff. */
  scuff(): void {
    if (!this.ready || !this.voice(0.4)) return
    const ctx = this.ctx!
    const t = ctx.currentTime
    const n = this.noise()
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 900
    const g = ctx.createGain()
    this.env(g, t, 0.25, 0.02, 0.3)
    n.connect(lp).connect(g).connect(this.out!)
    this.startNoise(n, t, 0.4)
  }

  /** Keeper glove catch: soft thud + slap. */
  glove(): void {
    if (!this.ready) return
    this.tap(1)
    if (!this.voice(0.12)) return
    const ctx = this.ctx!
    const t = ctx.currentTime
    const n = this.noise()
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 900
    const g = ctx.createGain()
    this.env(g, t, 0.3, 0.002, 0.09)
    n.connect(bp).connect(g).connect(this.out!)
    this.startNoise(n, t, 0.12)
  }

  /** Short bullet-time "whoosh" (pitch sweep). */
  whoosh(down = true): void {
    if (!this.ready || !this.voice(0.4)) return
    const ctx = this.ctx!
    const t = ctx.currentTime
    const n = this.noise()
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 2
    bp.frequency.setValueAtTime(down ? 1800 : 400, t)
    bp.frequency.exponentialRampToValueAtTime(down ? 300 : 1600, t + 0.3)
    const g = ctx.createGain()
    this.env(g, t, 0.12, 0.05, 0.3)
    n.connect(bp).connect(g).connect(this.out!)
    this.startNoise(n, t, 0.4)
  }
}
