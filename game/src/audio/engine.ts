/**
 * The one audio engine shared by the Preact UI and the Phaser scenes.
 *
 * Lifecycle: nothing is created until the first user gesture (browser
 * autoplay policy); `install()` adds capture-phase gesture listeners that
 * create/resume the AudioContext (and also recover iOS "interrupted"
 * contexts). The platform layer (src/platform/lifecycle.ts) suspends the
 * context while the app is backgrounded; we additionally stop the scheduler
 * timer on `sp:app-pause` so nothing ticks in the background.
 *
 * Requests made before the unlock (music for the title screen, crowd state)
 * are remembered and applied as soon as the context runs.
 */
import { Crowd, type Side } from './crowd'
import { BUSES, DEFAULT_MIX, Mixer, sanitizeMix, type Bus, type MixSettings } from './mixer'
import { MusicPlayer, type PlayOpts, type StingId, type TrackId } from './music'
import { LookaheadScheduler } from './scheduler'
import { MIN_GAP, NON_ESSENTIAL, playUiSound, type UiSound } from './uiSfx'

export interface Rig {
  ctx: BaseAudioContext
  mixer: Mixer
  scheduler: LookaheadScheduler
  music: MusicPlayer
  crowd: Crowd
}

/** 'low' = phones / low-FX: shorter reverbs, fewer voices. */
export type AudioQuality = 'high' | 'low'

/** Builds the full graph on any context (live or OfflineAudioContext). */
export function buildRig(ctx: BaseAudioContext, mix: MixSettings, opts: { timers?: ConstructorParameters<typeof LookaheadScheduler>[1]; quality?: AudioQuality } = {}): Rig {
  const q = opts.quality ?? 'high'
  const mixer = new Mixer(ctx, mix)
  const scheduler = new LookaheadScheduler(ctx, opts.timers)
  const music = new MusicPlayer(ctx, mixer.input.music, scheduler, q)
  const crowd = new Crowd(ctx, mixer.input.crowd, scheduler, q)
  crowd.reduced = mix.reduced
  crowd.onBigMoment = (at, w) => mixer.duck('music', 6 + 8 * w, { at, attack: 0.15, hold: 2.5, release: 3 })
  return { ctx, mixer, scheduler, music, crowd }
}

type CtxCtor = typeof AudioContext

function audioCtor(): CtxCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as { AudioContext?: CtxCtor; webkitAudioContext?: CtxCtor }
  return w.AudioContext ?? w.webkitAudioContext
}

interface CrowdLease {
  capacity?: number
  importance?: number
}

export type EngineState = 'none' | 'suspended' | 'running' | 'interrupted' | 'closed' | 'unsupported'

export class AudioEngine {
  private rig: (Rig & { ctx: AudioContext }) | null = null
  private mix: MixSettings = { ...DEFAULT_MIX }
  private wantMusic: { id: TrackId; opts: PlayOpts } | null = null
  private musicIntensity = 0.3
  private stadium = { capacity: 20000, importance: 0.4 }
  private allegiance: { heroSide: Side; homeShare: number } = { heroSide: 'home', homeShare: 0.85 }
  private leases = new Map<string, CrowdLease>()
  private tension = 0
  private lastUi = new Map<UiSound, number>()
  private installed = false
  private quality: AudioQuality = 'high'
  private failed = false
  /** Counts audio errors swallowed (exposed for tests). */
  errors = 0

  get state(): EngineState {
    if (this.failed) return 'unsupported'
    return (this.rig?.ctx.state as EngineState | undefined) ?? 'none'
  }

  get context(): AudioContext | null {
    return this.rig?.ctx ?? null
  }

  get settings(): MixSettings {
    return this.mix
  }

  get currentMusic(): TrackId | null {
    return this.rig?.music.current ?? this.wantMusic?.id ?? null
  }

  /** Gesture + lifecycle listeners (idempotent; browser only). */
  install(): void {
    if (this.installed || typeof window === 'undefined') return
    this.installed = true
    const onGesture = () => this.unlock()
    for (const ev of ['pointerdown', 'touchend', 'keydown', 'click']) window.addEventListener(ev, onGesture, { capture: true, passive: true })
    window.addEventListener('sp:app-pause', () => this.rig?.scheduler.stop())
    window.addEventListener('sp:app-resume', () => {
      if (this.rig) {
        this.rig.scheduler.start()
        if (this.rig.ctx.state !== 'running') void this.rig.ctx.resume().catch(() => undefined)
      }
    })
  }

  /** Creates (first call) and resumes the context. Call from a user gesture. */
  unlock(): void {
    if (this.failed) return
    if (!this.rig) {
      const AC = audioCtor()
      if (!AC) {
        this.failed = true
        return
      }
      let ctx: AudioContext
      try {
        ctx = new AC({ latencyHint: 'interactive' })
      } catch {
        this.failed = true
        return
      }
      try {
        // iOS: a silent buffer started inside the gesture fully unlocks output.
        const b = ctx.createBuffer(1, 1, 22050)
        const s = ctx.createBufferSource()
        s.buffer = b
        s.connect(ctx.destination)
        s.start(0)
        this.rig = buildRig(ctx, this.mix, { quality: this.quality }) as Rig & { ctx: AudioContext }
        this.rig.scheduler.start()
      } catch (e) {
        this.fail(e)
        return
      }
      this.applyPending()
      void this.rig.crowd.init().then(() => this.applyCrowd(), (e) => this.fail(e))
    }
    const ctx = this.rig.ctx
    if (ctx.state !== 'running' && ctx.state !== 'closed' && !(typeof document !== 'undefined' && document.visibilityState === 'hidden')) {
      void ctx.resume().catch(() => undefined)
    }
  }

  private fail(e: unknown): void {
    this.errors++
    if (import.meta.env?.DEV) console.warn('[audio]', e)
  }

  private safe(fn: (r: Rig) => void): void {
    if (!this.rig) return
    try {
      fn(this.rig)
    } catch (e) {
      this.fail(e)
    }
  }

  private applyPending(): void {
    if (this.wantMusic) this.safe((r) => r.music.play(this.wantMusic!.id, { ...this.wantMusic!.opts, intensity: this.musicIntensity }))
    this.applyCrowd()
  }

  /** Must be set before the first unlock to take effect (graph is built once). */
  setQuality(q: AudioQuality): void {
    this.quality = q
  }

  // ───────── Mix ─────────

  setMix(m: Partial<MixSettings>): void {
    this.mix = sanitizeMix({ ...this.mix, ...m })
    this.safe((r) => {
      r.mixer.setMix(this.mix)
      r.crowd.reduced = this.mix.reduced
    })
  }

  /** Effective (pre-limiter) gain of a bus, 0 when muted. */
  audible(bus: Bus): boolean {
    return !this.mix.muted && this.mix.master > 0 && this.mix[bus] > 0
  }

  // ───────── Music ─────────

  playMusic(id: TrackId, opts: PlayOpts = {}): void {
    this.wantMusic = { id, opts }
    this.safe((r) => r.music.play(id, { ...opts, intensity: opts.intensity ?? this.musicIntensity }))
  }

  stopMusic(fade = 1.5): void {
    this.wantMusic = null
    this.safe((r) => r.music.stop(fade))
  }

  setMusicIntensity(v: number): void {
    this.musicIntensity = Math.max(0, Math.min(1, v))
    this.safe((r) => r.music.setIntensity(this.musicIntensity))
  }

  sting(id: StingId): void {
    if (!this.audible('music')) return
    this.safe((r) => r.music.sting(id))
  }

  // ───────── UI ─────────

  sfx(name: UiSound): void {
    if (!this.rig || this.rig.ctx.state !== 'running' || !this.audible('ui')) return
    if (this.mix.reduced && NON_ESSENTIAL.has(name)) return
    const now = this.rig.ctx.currentTime
    const last = this.lastUi.get(name) ?? -1
    if (now - last < (MIN_GAP[name] ?? 0.03)) return
    this.lastUi.set(name, now)
    this.safe((r) => playUiSound(r.ctx, r.mixer.input.ui, name, now + 0.005))
  }

  /** Raw access for the game SFX (match/training scenes). */
  sfxBus(): { ctx: AudioContext; out: AudioNode } | null {
    if (!this.rig) return null
    return { ctx: this.rig.ctx, out: this.rig.mixer.input.sfx }
  }

  // ───────── Crowd ─────────

  /** Sets the stadium the director/scene is in (capacity, importance 0..1). */
  setStadium(capacity: number, importance = this.stadium.importance): void {
    this.stadium = { capacity, importance }
    this.applyCrowd()
  }

  setAllegiance(heroSide: Side, homeShare = 0.85): void {
    this.allegiance = { heroSide, homeShare }
    this.safe((r) => r.crowd.setAllegiance(heroSide, homeShare))
  }

  /** Keeps the crowd running while any holder is active (e.g. 'match', 'scene'). */
  holdCrowd(key: string, lease: CrowdLease = {}): void {
    this.leases.set(key, lease)
    this.applyCrowd()
  }

  releaseCrowd(key: string): void {
    if (!this.leases.delete(key)) return
    this.applyCrowd()
  }

  setTension(v: number): void {
    this.tension = Math.max(0, Math.min(1, v))
    this.safe((r) => r.crowd.setTension(this.tension))
  }

  get crowd(): Crowd | null {
    return this.rig && this.rig.crowd.state.ready ? this.rig.crowd : null
  }

  /** Runs `fn` on the crowd if it is live (events before it is ready are dropped). */
  withCrowd(fn: (c: Crowd) => void): void {
    const c = this.crowd
    if (!c || !c.state.active) return
    try {
      fn(c)
    } catch (e) {
      this.fail(e)
    }
  }

  private applyCrowd(): void {
    this.safe((r) => {
      let cap = this.stadium.capacity
      let imp = this.stadium.importance
      for (const l of this.leases.values()) {
        if (l.capacity !== undefined) cap = l.capacity
        if (l.importance !== undefined) imp = l.importance
      }
      r.crowd.setAllegiance(this.allegiance.heroSide, this.allegiance.homeShare)
      r.crowd.setStadium(cap, imp)
      r.crowd.setTension(this.tension)
      r.crowd.setActive(this.leases.size > 0)
    })
  }

  /** Test/debug snapshot. */
  debug(): Record<string, unknown> {
    return {
      state: this.state, music: this.currentMusic, crowdActive: this.rig?.crowd.state.active ?? false, crowdReady: this.rig?.crowd.state.ready ?? false,
      leases: [...this.leases.keys()], mix: this.mix, errors: this.errors, buses: BUSES,
    }
  }
}
