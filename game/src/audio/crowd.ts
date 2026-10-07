/**
 * Procedural stadium crowd. All voices come from src/audio/voices.ts
 * (formant-synthesised babble, cheers, "ooh", groans, boos, sung chant
 * syllables, claps, whistles), rendered once into small buffers and then
 * layered here:
 *
 *   babble L/R ─ base ─ dip ─┐
 *   roar (pink noise) ───────┤
 *   cheer L/R ─ tension/event┤
 *   boo, whistles, applause ─┼─ pre ─ distance LP ─┬─ dry ──────────┬─ out (crowd bus)
 *   one-shots (yell, ooh…) ──┤                     └─ stadium verb ─┘
 *   away pocket (LP, panned)─┘
 *
 * Size (capacity) and importance scale the bed (a 300-person murmur with
 * single shouts vs. a 60k wash), react() events swell layers, and chants are
 * sequenced on the shared lookahead scheduler so they stay rhythmic. Every
 * method takes an optional `at` time so offline renders are deterministic.
 */
import { AudioRng } from './rng'
import { LookaheadScheduler } from './scheduler'
import { VoicePool, makeReverb, tom } from './synth'
import { TEXTURE_RATE, renderImpulse } from './voices'
import { loadCrowdTextures, type ChantSyl, type CrowdTextures } from './crowdTextures'

export type Side = 'home' | 'away'
export type { ChantSyl, CrowdTextures } from './crowdTextures'
export { CHANT_BASE_HZ, loadCrowdTextures } from './crowdTextures'

// ───────────────────────── Pure helpers (tested) ─────────────────────────

/** Capacity → 0..1 size (300 people = 0, 80k = 1, log scale). */
export function crowdSize(capacity: number): number {
  const c = Math.max(1, Number.isFinite(capacity) ? capacity : 0)
  const k = (Math.log10(c) - Math.log10(300)) / (Math.log10(80000) - Math.log10(300))
  return Math.max(0, Math.min(1, k))
}

/** Estimated capacity from a club reputation (mirrors sim/world/generate stadiumFor). */
export function capacityFromReputation(rep: number): number {
  const r = Math.max(0, Math.min(100, Number.isFinite(rep) ? rep : 50))
  return Math.round(3000 + Math.pow(r / 100, 2.2) * 80000)
}

export interface BedLevels {
  babble: number
  roar: number
  cutoff: number
  wet: number
  chantEvery: number
}

/** Bed mix for a crowd size and match importance (both 0..1). */
export function bedLevels(size: number, importance: number): BedLevels {
  const k = Math.max(0, Math.min(1, size))
  const imp = Math.max(0, Math.min(1, importance))
  return {
    babble: 0.26 + 0.12 * k + 0.05 * imp,
    roar: 0.02 + 0.3 * Math.pow(k, 1.4) + 0.06 * imp * k,
    cutoff: 5200 - 2300 * k,
    wet: 0.12 + 0.38 * k,
    // Seconds between spontaneous chants (big, important games chant more).
    chantEvery: 70 - 35 * k - 15 * imp,
  }
}

/** Reaction loudness of the fans of `side` given the home share. */
export function sideWeight(side: Side, homeShare: number): number {
  const h = Math.max(0, Math.min(1, homeShare))
  return side === 'home' ? h : Math.max(0.12, 1 - h)
}

// ───────────────────────── Chants ─────────────────────────

/** One chant step: syllable (or null = rest), semitones from G3, length in 8ths, clap on this step. */
type ChantStep = readonly [ChantSyl | null, number, number, boolean?]

interface ChantDef {
  bpm: number
  steps: readonly ChantStep[]
  /** Bass drum in the stands on every n-th 8th (0 = none). */
  drumEvery: number
}

/** Original stand chants (procedural melodies; not based on any real song). */
export const CHANTS: readonly ChantDef[] = [
  // "O - e - o, O - e - o - O" call with claps on the rests.
  {
    bpm: 124, drumEvery: 2,
    steps: [['o', 0, 2], ['e', 3, 1], ['o', 0, 1], [null, 0, 1, true], [null, 0, 1, true], ['o', 0, 2], ['e', 3, 1], ['o', 0, 1], ['a', 5, 3], [null, 0, 1, true]],
  },
  // Clap-clap, clap-clap-clap … HEY!
  {
    bpm: 132, drumEvery: 0,
    steps: [[null, 0, 2, true], [null, 0, 2, true], [null, 0, 1, true], [null, 0, 1, true], [null, 0, 2, true], [null, 0, 1, true], [null, 0, 1, true], [null, 0, 1, true], [null, 0, 1, true], ['hey', 0, 4]],
  },
  // Slow rising anthem: "O-le, o-le, o-LE-e" with a drum on every beat.
  {
    bpm: 112, drumEvery: 2,
    steps: [['ole', 0, 2], ['ole', 2, 2], ['ole', 4, 2], ['o', 2, 1], ['e', 0, 1], ['ole', 0, 2], ['ole', 2, 2], ['a', 7, 4]],
  },
]

/** Seconds per pass of a chant. */
export function chantLength(def: ChantDef): number {
  const eighths = def.steps.reduce((s, x) => s + x[2], 0)
  return (eighths * 60) / def.bpm / 2
}

// ───────────────────────── Engine ─────────────────────────

interface Loop {
  src: AudioBufferSourceNode
  gain: GainNode
}

export interface CrowdState {
  active: boolean
  capacity: number
  size: number
  importance: number
  homeShare: number
  heroSide: Side
  tension: number
  ready: boolean
}

export class Crowd {
  readonly ctx: BaseAudioContext
  readonly output: GainNode
  private readonly scheduler: LookaheadScheduler
  private tex: CrowdTextures | null = null
  private bufs = new Map<Float32Array, AudioBuffer>()
  private pre!: GainNode
  private away!: GainNode
  private lp!: BiquadFilterNode
  private wet!: GainNode
  private babble: Loop[] = []
  private babbleDip!: GainNode
  private roar: Loop[] = []
  private roarLp!: BiquadFilterNode
  private cheerT!: GainNode
  private cheerE!: GainNode
  private boo!: Loop
  private whistles!: Loop
  private applause!: Loop
  private readonly pool = new VoicePool(28)
  private rng = new AudioRng(4711)
  private unsub: (() => void) | null = null
  private nextChantAt = Infinity
  private nextShoutAt = Infinity
  private chantUntil = 0
  private pendingChant: { at: number; def: ChantDef; passes: number } | null = null
  private built = false
  /** Extra hook so the engine can duck music on big moments. */
  onBigMoment: ((at: number, size: number) => void) | null = null
  readonly state: CrowdState = { active: false, capacity: 20000, size: crowdSize(20000), importance: 0.4, homeShare: 0.85, heroSide: 'home', tension: 0, ready: false }
  reduced = false

  private readonly quality: 'high' | 'low'

  constructor(ctx: BaseAudioContext, dest: AudioNode, scheduler: LookaheadScheduler, quality: 'high' | 'low' = 'high') {
    this.ctx = ctx
    this.quality = quality
    this.scheduler = scheduler
    this.output = ctx.createGain()
    this.output.gain.value = 0
    this.output.connect(dest)
  }

  /** Loads textures and builds the graph (idempotent). */
  async init(textures?: CrowdTextures): Promise<void> {
    if (this.built) return
    const tex = textures ?? (await loadCrowdTextures())
    if (this.built) return
    this.tex = tex
    this.build(tex)
    this.built = true
    this.state.ready = true
    this.applyBed(this.ctx.currentTime, 0.01)
    if (this.state.active) this.armTimers(this.ctx.currentTime)
  }

  private buf(d: Float32Array): AudioBuffer {
    let b = this.bufs.get(d)
    if (!b) {
      b = this.ctx.createBuffer(1, d.length, TEXTURE_RATE)
      b.getChannelData(0).set(d)
      this.bufs.set(d, b)
    }
    return b
  }

  private loop(d: Float32Array, dest: AudioNode, gain: number, pan: number, rate = 1, offset = 0): Loop {
    const ctx = this.ctx
    const src = ctx.createBufferSource()
    src.buffer = this.buf(d)
    src.loop = true
    src.playbackRate.value = rate
    const g = ctx.createGain()
    g.gain.value = gain
    if (pan !== 0 && typeof ctx.createStereoPanner === 'function') {
      const p = ctx.createStereoPanner()
      p.pan.value = pan
      src.connect(g).connect(p).connect(dest)
    } else src.connect(g).connect(dest)
    src.start(ctx.currentTime, offset % (d.length / TEXTURE_RATE))
    return { src, gain: g }
  }

  private build(tex: CrowdTextures): void {
    const ctx = this.ctx
    this.pre = ctx.createGain()
    this.lp = ctx.createBiquadFilter()
    this.lp.type = 'lowpass'
    this.lp.Q.value = 0.5
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 90
    const dry = ctx.createGain()
    dry.gain.value = 0.85
    this.wet = ctx.createGain()
    const verb = makeReverb(ctx, renderImpulse(this.quality === 'low' ? 1.3 : 2.6, 2.6, 9090, ctx.sampleRate, 0.35), ctx.sampleRate)
    this.pre.connect(hp).connect(this.lp)
    this.lp.connect(dry).connect(this.output)
    this.lp.connect(this.wet).connect(verb).connect(this.output)
    // Away pocket: darker, off to one side, more distant.
    this.away = ctx.createGain()
    const awayLp = ctx.createBiquadFilter()
    awayLp.type = 'lowpass'
    awayLp.frequency.value = 1900
    const awayPan = ctx.createStereoPanner()
    awayPan.pan.value = 0.65
    this.away.connect(awayLp).connect(awayPan).connect(this.pre)
    // Bed.
    this.babbleDip = ctx.createGain()
    this.babbleDip.connect(this.pre)
    this.babble = [this.loop(tex.babble[0], this.babbleDip, 0, -0.55, 1, 0), this.loop(tex.babble[1], this.babbleDip, 0, 0.55, 0.985, 3.1)]
    this.roarLp = ctx.createBiquadFilter()
    this.roarLp.type = 'bandpass'
    this.roarLp.frequency.value = 650
    this.roarLp.Q.value = 0.45
    this.roarLp.connect(this.pre)
    this.roar = this.quality === 'low'
      ? [this.loop(tex.roar, this.roarLp, 0, 0, 1, 0)]
      : [this.loop(tex.roar, this.roarLp, 0, -0.4, 1, 0), this.loop(tex.roar, this.roarLp, 0, 0.4, 1, 1.7)]
    // Cheer layer: tension (slow) + event (swells) share sources.
    this.cheerT = ctx.createGain()
    this.cheerT.gain.value = 0
    this.cheerE = ctx.createGain()
    this.cheerE.gain.value = 0
    const cheerSum = ctx.createGain()
    this.cheerT.connect(this.pre)
    this.cheerE.connect(this.pre)
    tex.cheer.forEach((d, i) => this.loop(d, cheerSum, 1, i === 0 ? -0.6 : 0.6, i === 0 ? 1 : 1.02, i * 2.3))
    cheerSum.connect(this.cheerT)
    cheerSum.connect(this.cheerE)
    this.boo = this.loop(tex.boo, this.pre, 0, 0, 1)
    this.whistles = this.loop(tex.whistles, this.pre, 0, 0.2, 1)
    this.applause = this.loop(tex.applause, this.pre, 0, -0.1, 1)
  }

  // ───────── State ─────────

  setStadium(capacity: number, importance = this.state.importance, at = this.ctx.currentTime): void {
    this.state.capacity = Math.max(50, capacity)
    this.state.size = crowdSize(capacity)
    this.state.importance = Math.max(0, Math.min(1, importance))
    this.applyBed(at, 1.2)
  }

  setAllegiance(heroSide: Side, homeShare = this.state.homeShare): void {
    this.state.heroSide = heroSide
    this.state.homeShare = Math.max(0.05, Math.min(0.98, homeShare))
  }

  /** Fades the whole crowd in or out. */
  setActive(on: boolean, at = this.ctx.currentTime, fade = 1.5): void {
    if (this.state.active === on) return
    this.state.active = on
    const p = this.output.gain
    p.cancelScheduledValues(at)
    p.setTargetAtTime(on ? 1 : 0, at, fade / 3)
    if (on) this.armTimers(at)
    else {
      this.nextChantAt = Infinity
      this.nextShoutAt = Infinity
      this.unsub?.()
      this.unsub = null
    }
  }

  /** 0..1 match tension: the bed thickens and brightens. */
  setTension(v: number, at = this.ctx.currentTime): void {
    this.state.tension = Math.max(0, Math.min(1, v))
    if (!this.built) return
    const k = this.state.size
    this.cheerT.gain.setTargetAtTime(this.state.tension * (0.06 + 0.16 * k), at, 0.6)
    this.lp.frequency.setTargetAtTime(bedLevels(k, this.state.importance).cutoff + this.state.tension * 900, at, 0.6)
  }

  private applyBed(at: number, tc: number): void {
    if (!this.built) return
    const b = bedLevels(this.state.size, this.state.importance)
    for (const l of this.babble) l.gain.gain.setTargetAtTime(b.babble, at, tc / 3)
    for (const l of this.roar) l.gain.gain.setTargetAtTime(b.roar, at, tc / 3)
    this.lp.frequency.setTargetAtTime(b.cutoff + this.state.tension * 900, at, tc / 3)
    this.wet.gain.setTargetAtTime(b.wet, at, tc / 3)
  }

  private armTimers(at: number): void {
    if (!this.built || this.unsub) return
    const b = bedLevels(this.state.size, this.state.importance)
    this.nextChantAt = at + this.rng.range(6, 14) + b.chantEvery * 0.3
    this.nextShoutAt = at + this.rng.range(2, 6)
    this.unsub = this.scheduler.add((until) => this.pump(until))
  }

  // ───────── Primitives ─────────

  private shot(d: Float32Array, dest: AudioNode, at: number, gain: number, opts: { rate?: number; pan?: number; dur?: number; fade?: number } = {}): void {
    if (!this.built || gain <= 0.001) return
    const ctx = this.ctx
    const src = ctx.createBufferSource()
    src.buffer = this.buf(d)
    src.playbackRate.value = opts.rate ?? 1
    const g = ctx.createGain()
    g.gain.value = gain
    let tail: AudioNode = g
    if (opts.pan && typeof ctx.createStereoPanner === 'function') {
      const p = ctx.createStereoPanner()
      p.pan.value = opts.pan
      g.connect(p)
      tail = p
    }
    tail.connect(dest)
    src.connect(g)
    const len = d.length / TEXTURE_RATE / (opts.rate ?? 1)
    const dur = Math.min(len, opts.dur ?? len)
    if (!this.pool.take(at, at + dur)) return
    if (opts.dur !== undefined && opts.dur < len) {
      const f = opts.fade ?? 0.12
      g.gain.setValueAtTime(gain, at + Math.max(0, dur - f))
      g.gain.linearRampToValueAtTime(0, at + dur)
    }
    src.onended = () => {
      try {
        g.disconnect()
        tail.disconnect()
      } catch {
        /* already */
      }
    }
    src.start(at)
    src.stop(at + dur + 0.02)
  }

  /** Event swell on a gain: rise → hold → decay back to `base`. */
  private swell(p: AudioParam, at: number, peak: number, attack: number, hold: number, release: number, base = 0): void {
    p.cancelScheduledValues(at)
    p.setTargetAtTime(peak, at, attack / 3)
    p.setTargetAtTime(base, at + attack + hold, release / 3)
  }

  private fansIn(side: Side): AudioNode {
    return side === 'home' ? this.pre : this.away
  }

  private otherSide(s: Side): Side {
    return s === 'home' ? 'away' : 'home'
  }

  // ───────── Reactions ─────────

  /** A goal for `side`. The scoring side's fans erupt; the others go quiet. */
  goal(side: Side, at = this.ctx.currentTime): void {
    if (!this.built) return
    const k = this.state.size
    const w = sideWeight(side, this.state.homeShare)
    const loud = 0.45 + 0.55 * k
    this.shot(this.tex!.goalYell, this.fansIn(side), at, (0.65 * loud * (0.4 + 0.6 * w)), { rate: this.rng.range(0.97, 1.03) })
    if (side === 'home') {
      this.swell(this.cheerE.gain, at, 0.85 * loud, 0.25, 3.5, 6)
      for (const l of this.roar) this.swell(l.gain.gain, at, bedLevels(k, 1).roar * 2.2 + 0.1, 0.3, 3, 5, bedLevels(k, this.state.importance).roar)
      this.swell(this.applause.gain.gain, at + 2.5, 0.35 * loud, 1, 3, 4)
      this.swell(this.whistles.gain.gain, at + 0.5, 0.06 * loud, 0.5, 2, 3)
      this.queueChant(at + 7)
    } else {
      // Home crowd stunned: babble drops away, a scattered groan.
      this.shot(this.tex!.groan, this.pre, at + 0.25, 0.4 * this.state.homeShare * loud)
      this.swell(this.babbleDip.gain, at + 0.4, 0.35, 0.8, 5, 6, 1)
      this.swell(this.applause.gain.gain, at + 1.5, 0.08, 0.5, 2, 2)
    }
    this.onBigMoment?.(at, w * loud)
  }

  /** A chance building: anticipation from the attacking side's fans. */
  chance(side: Side, intensity = 0.6, at = this.ctx.currentTime): void {
    if (!this.built) return
    const k = this.state.size
    const i = Math.max(0, Math.min(1, intensity))
    if (side === 'home') this.swell(this.cheerE.gain, at, (0.18 + 0.3 * i) * (0.4 + 0.6 * k), 0.6, 1.2, 2.2)
    else this.swell(this.babbleDip.gain, at, 1.25, 0.5, 1, 2, 1)
    for (const l of this.roar) this.swell(l.gain.gain, at, bedLevels(k, this.state.importance).roar * (1 + 0.8 * i), 0.6, 1, 2.5, bedLevels(k, this.state.importance).roar)
  }

  /** Near miss / woodwork / big save: "ooooh" from the attacking side, applause. */
  nearMiss(side: Side, at = this.ctx.currentTime): void {
    if (!this.built) return
    const k = this.state.size
    const w = sideWeight(side, this.state.homeShare)
    this.shot(this.tex!.ooh, this.fansIn(side), at, (0.55 + 0.45 * k) * (0.35 + 0.65 * w), { rate: this.rng.range(0.95, 1.05) })
    this.swell(this.applause.gain.gain, at + 1.4, 0.18 * (0.4 + 0.6 * w), 0.4, 1.2, 2)
    if (side === 'away') this.swell(this.cheerE.gain, at + 0.3, 0.12, 0.3, 0.6, 1.5)
  }

  /** Disappointment from `side`'s fans. */
  groan(side: Side, at = this.ctx.currentTime): void {
    if (!this.built) return
    const w = sideWeight(side, this.state.homeShare)
    this.shot(this.tex!.groan, this.fansIn(side), at, (0.5 + 0.4 * this.state.size) * (0.35 + 0.65 * w), { rate: this.rng.range(0.96, 1.04) })
  }

  /** A good save by `side`'s keeper. */
  save(side: Side, at = this.ctx.currentTime): void {
    this.nearMiss(this.otherSide(side), at)
    this.swell(this.applause.gain.gain, at + 0.6, 0.3 * sideWeight(side, this.state.homeShare), 0.4, 1.5, 2)
  }

  /** A foul by `side` (card: booking shown). Home fans boo the visitors and whistle the referee. */
  foul(side: Side, card: 'yellow' | 'red' | null = null, at = this.ctx.currentTime): void {
    if (!this.built) return
    const k = 0.4 + 0.6 * this.state.size
    if (side === 'away') {
      this.swell(this.boo.gain.gain, at, (card ? 0.4 : 0.22) * k, 0.4, card ? 1.6 : 0.8, 1.6)
      if (card) this.swell(this.cheerE.gain, at + 1.2, 0.2 * k, 0.3, 0.8, 1.5)
    } else {
      this.swell(this.whistles.gain.gain, at, (card ? 0.35 : 0.18) * k, 0.3, card === 'red' ? 2.5 : 1.2, 1.5)
      if (card) this.swell(this.boo.gain.gain, at + 0.3, 0.3 * k, 0.5, 1.5, 2)
    }
  }

  /** Home fans losing patience: visitors wasting time. */
  timeWasting(at = this.ctx.currentTime): void {
    if (!this.built) return
    const k = 0.4 + 0.6 * this.state.size
    this.swell(this.whistles.gain.gain, at, 0.38 * k, 0.6, 3, 2.5)
    this.swell(this.boo.gain.gain, at + 0.4, 0.28 * k, 0.8, 2.5, 2.5)
  }

  /** General applause (kickoff, substitution, final whistle). */
  applaud(level = 0.5, at = this.ctx.currentTime, hold = 2): void {
    if (!this.built) return
    this.swell(this.applause.gain.gain, at, 0.4 * Math.max(0, Math.min(1, level)) * (0.5 + 0.5 * this.state.size), 0.5, hold, 2.5)
  }

  /** Full-time reaction for the home crowd. */
  fullTime(homeGoals: number, awayGoals: number, at = this.ctx.currentTime): void {
    if (!this.built) return
    if (homeGoals > awayGoals) {
      this.swell(this.cheerE.gain, at, 0.5 * (0.4 + 0.6 * this.state.size), 0.6, 3, 4)
      this.applaud(1, at + 0.5, 4)
      this.queueChant(at + 3)
    } else if (homeGoals < awayGoals) {
      this.swell(this.boo.gain.gain, at + 0.4, 0.35, 0.8, 2.5, 3)
      this.applaud(0.3, at + 1, 2)
    } else this.applaud(0.6, at + 0.3, 3)
  }

  // ───────── Chants & spontaneous life ─────────

  /** Starts a chant soon (on the next pump), unless one is running. */
  queueChant(at: number, index?: number): void {
    if (this.reduced || !this.built) return
    const def = CHANTS[index ?? this.rng.int(0, CHANTS.length - 1)]
    this.pendingChant = { at: Math.max(at, this.chantUntil), def, passes: this.rng.int(2, 3) }
    if (!this.unsub && this.state.active) this.armTimers(at)
  }

  /** Schedules a whole chant (n passes) starting at `at`. Returns its end time. */
  chant(def: ChantDef, passes: number, at: number): number {
    if (!this.built || !this.tex) return at
    const eighth = 60 / def.bpm / 2
    const k = this.state.size
    const vol = (0.35 + 0.65 * k) * (0.6 + 0.4 * this.state.importance) * this.state.homeShare
    let t = at
    for (let p = 0; p < passes; p++) {
      // The stand joins in gradually on the first pass.
      const join = p === 0 ? 0.55 : 1
      for (const [syl, semis, len, clapHere] of def.steps) {
        const dur = len * eighth
        if (syl) {
          const buf = this.tex.chant[syl]
          this.shot(buf, this.pre, t, 0.55 * vol * join, { rate: Math.pow(2, semis / 12), dur: dur * 0.98, fade: Math.min(0.12, dur * 0.4) })
        }
        if (clapHere) this.shot(this.tex.clapHit, this.pre, t, 0.5 * vol * join, { rate: this.rng.range(0.97, 1.03) })
        t += dur
      }
      if (def.drumEvery > 0) {
        const total = def.steps.reduce((s, x) => s + x[2], 0)
        for (let e = 0; e < total; e += def.drumEvery) tom(this.ctx, this.pre, at + (p * total + e) * eighth, 62, 0.35 * vol * join)
      }
    }
    this.chantUntil = t + 1
    return t
  }

  private pump(until: number): void {
    if (!this.state.active || !this.built) return
    const b = bedLevels(this.state.size, this.state.importance)
    if (this.pendingChant && this.pendingChant.at < until) {
      const c = this.pendingChant
      this.pendingChant = null
      this.chant(c.def, c.passes, c.at)
      this.nextChantAt = this.chantUntil + b.chantEvery * this.rng.range(0.6, 1.3)
    }
    if (this.nextChantAt < until) {
      if (!this.reduced && this.state.size > 0.15 && this.nextChantAt >= this.chantUntil) {
        const def = CHANTS[this.rng.int(0, CHANTS.length - 1)]
        this.chant(def, this.rng.int(2, 3), this.nextChantAt)
      }
      this.nextChantAt = Math.max(this.nextChantAt, this.chantUntil) + b.chantEvery * this.rng.range(0.6, 1.3)
    }
    if (this.nextShoutAt < until) {
      // Single voices are only audible in small grounds.
      const k = this.state.size
      if (k < 0.75 && this.tex) {
        const d = this.rng.pick(this.tex.shouts)
        this.shot(d, this.pre, this.nextShoutAt, (0.32 - 0.3 * k) * this.rng.range(0.5, 1), { rate: this.rng.range(0.9, 1.1), pan: this.rng.range(-0.8, 0.8) })
      }
      this.nextShoutAt += this.rng.range(3, 9) / Math.max(0.3, 1 - k)
    }
  }

  dispose(): void {
    this.unsub?.()
    this.unsub = null
    for (const l of [...this.babble, ...this.roar, this.boo, this.whistles, this.applause]) {
      try {
        l?.src.stop()
      } catch {
        /* not started */
      }
    }
    try {
      this.output.disconnect()
    } catch {
      /* already */
    }
  }
}
