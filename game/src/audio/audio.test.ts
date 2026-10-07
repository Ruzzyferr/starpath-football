import { afterEach, describe, expect, it, vi } from 'vitest'
import { analyze, encodeWav } from './analysis'
import { CHANTS, Crowd, bedLevels, capacityFromReputation, chantLength, crowdSize, sideWeight } from './crowd'
import { buildCrowdTexturesSync } from './crowdTextures'
import { AudioEngine, buildRig } from './engine'
import { DEFAULT_MIX } from './mixer'
import { MusicPlayer, STINGS, TRACKS, TRACK_DEFS, playSting } from './music'
import { LookaheadScheduler, nextBarTime } from './scheduler'
import { mixFromSettings } from './settings'
import { VoicePool } from './synth'
import { FakeAudioContext, fakeCtx, type FakeNode } from './testing/fakeContext'
import { UI_SOUNDS, playUiSound } from './uiSfx'
import {
  FORMANTS, TEXTURE_RATE, normalize, peakOf, renderBabble, renderChantSyllable, renderImpulse, renderOoh, renderPinkNoise, renderVoice, rmsOf,
} from './voices'
import { AudioRng } from './rng'

const noTimers = { timers: { setInterval: () => 0, clearInterval: () => undefined } }

describe('voice DSP', () => {
  it('renders a finite, non-silent vowel', () => {
    const out = new Float32Array(TEXTURE_RATE)
    renderVoice(out, TEXTURE_RATE, { start: 0.1, dur: 0.5, f0: 140, vowel: 'a', amp: 1 }, new AudioRng(1))
    expect(out.every(Number.isFinite)).toBe(true)
    expect(rmsOf(out.subarray(Math.round(0.2 * TEXTURE_RATE), Math.round(0.5 * TEXTURE_RATE)))).toBeGreaterThan(0.001)
    // Nothing before the note starts.
    expect(peakOf(out.subarray(0, Math.round(0.09 * TEXTURE_RATE)))).toBe(0)
  })

  it('circular rendering wraps instead of truncating', () => {
    const out = new Float32Array(TEXTURE_RATE / 2)
    renderVoice(out, TEXTURE_RATE, { start: 0.4, dur: 0.3, f0: 120, vowel: 'o', amp: 1 }, new AudioRng(2), true)
    expect(peakOf(out.subarray(0, Math.round(0.1 * TEXTURE_RATE)))).toBeGreaterThan(0)
  })

  it('crowd textures are normalised, finite and deterministic', () => {
    const a = renderBabble(1, 4, 7)
    const b = renderBabble(1, 4, 7)
    expect(a).toEqual(b)
    expect(peakOf(a)).toBeCloseTo(0.9, 5)
    expect(a.every(Number.isFinite)).toBe(true)
    const ooh = renderOoh(6, 3)
    expect(peakOf(ooh)).toBeCloseTo(0.9, 5)
    const chant = renderChantSyllable('o', 'e', 196, 0.4, 5, 9)
    expect(rmsOf(chant)).toBeGreaterThan(0.02)
  })

  it('all formant tables are ordered F1 < F2 < F3', () => {
    for (const f of Object.values(FORMANTS)) expect(f[0] < f[1] && f[1] < f[2]).toBe(true)
  })

  it('reverb impulse has unit energy and decays', () => {
    const [l, r] = renderImpulse(0.5, 3, 1, 8000)
    const e = l.reduce((s, x) => s + x * x, 0) + r.reduce((s, x) => s + x * x, 0)
    expect(e / 2).toBeCloseTo(1, 1)
    expect(rmsOf(l.subarray(0, 400))).toBeGreaterThan(rmsOf(l.subarray(3600, 4000)) * 5)
  })

  it('pink noise loop is click-free at the seam and normalised', () => {
    const n = renderPinkNoise(1, 5, 8000)
    expect(peakOf(n)).toBeCloseTo(0.9, 5)
    expect(Math.abs(n[0] - n[n.length - 1])).toBeLessThan(0.5)
    expect(normalize(new Float32Array(4))).toEqual(new Float32Array(4))
  })
})

describe('crowd helpers', () => {
  it('size scales with capacity on a log scale', () => {
    expect(crowdSize(300)).toBe(0)
    expect(crowdSize(80000)).toBe(1)
    expect(crowdSize(5000)).toBeGreaterThan(0.4)
    expect(crowdSize(5000)).toBeLessThan(0.6)
    expect(crowdSize(Number.NaN)).toBe(0)
  })

  it('capacity estimate mirrors the world generator range', () => {
    expect(capacityFromReputation(0)).toBe(3000)
    expect(capacityFromReputation(100)).toBe(83000)
    expect(capacityFromReputation(50)).toBeGreaterThan(15000)
  })

  it('bigger and more important crowds are louder, darker and chant more', () => {
    const small = bedLevels(0.1, 0.2)
    const big = bedLevels(0.95, 0.9)
    expect(big.roar).toBeGreaterThan(small.roar * 5)
    expect(big.babble).toBeGreaterThan(small.babble)
    expect(big.cutoff).toBeLessThan(small.cutoff)
    expect(big.wet).toBeGreaterThan(small.wet)
    expect(big.chantEvery).toBeLessThan(small.chantEvery)
  })

  it('away fans are a minority but never silent', () => {
    expect(sideWeight('home', 0.85)).toBe(0.85)
    expect(sideWeight('away', 0.85)).toBeCloseTo(0.15, 6)
    expect(sideWeight('away', 0.99)).toBe(0.12)
  })

  it('chants have sane lengths', () => {
    for (const c of CHANTS) {
      const len = chantLength(c)
      expect(len).toBeGreaterThan(2)
      expect(len).toBeLessThan(8)
    }
  })
})

describe('music sequencing (fake context)', () => {
  it('every track schedules notes and respects the voice cap', () => {
    for (const id of TRACKS) {
      const ctx = fakeCtx()
      const s = new LookaheadScheduler(ctx, noTimers)
      const m = new MusicPlayer(ctx, ctx.createGain(), s)
      m.play(id, { now: true, intensity: 1 })
      s.pump(8, 0)
      expect(ctx.created.oscillator ?? 0, id).toBeGreaterThan(20)
      expect(m.current).toBe(id)
    }
  })

  it('crossfades on the outgoing track\'s next bar line', () => {
    const ctx = fakeCtx()
    const s = new LookaheadScheduler(ctx, noTimers)
    const m = new MusicPlayer(ctx, ctx.createGain(), s)
    m.play('menu', { now: true })
    s.pump(1, 0)
    ;(ctx as unknown as FakeAudioContext).currentTime = 2.9
    m.play('hub')
    const bpm = TRACK_DEFS.menu.bpm
    const expected = nextBarTime(0.08, 2.9 + 0.12, bpm)
    // Bars at 118 BPM are ~2.03 s long: the switch lands on bar 2.
    expect(expected).toBeCloseTo(0.08 + 2 * (240 / bpm), 6)
    expect(m.current).toBe('hub')
    // Same track again is a no-op.
    m.play('hub')
    expect(m.current).toBe('hub')
  })

  it('stings and UI sounds schedule without throwing and report durations', () => {
    const ctx = fakeCtx()
    for (const st of STINGS) expect(playSting(ctx, ctx.createGain(), ctx.createGain(), st, 0)).toBeGreaterThan(1)
    for (const u of UI_SOUNDS) expect(playUiSound(ctx, ctx.createGain(), u, 0)).toBeGreaterThan(0)
  })

  it('voice pool caps concurrent voices and frees ended ones', () => {
    const p = new VoicePool(2)
    expect(p.take(0, 1)).toBe(true)
    expect(p.take(0, 1)).toBe(true)
    expect(p.take(0.5, 2)).toBe(false)
    expect(p.dropped).toBe(1)
    expect(p.take(1.5, 2)).toBe(true)
  })
})

describe('crowd engine (fake context)', () => {
  const tex = buildCrowdTexturesSync()

  it('builds loops, reacts to events and chants on the scheduler', async () => {
    const ctx = fakeCtx()
    const s = new LookaheadScheduler(ctx, noTimers)
    const c = new Crowd(ctx, ctx.createGain(), s)
    await c.init(tex)
    expect(c.state.ready).toBe(true)
    c.setStadium(60000, 0.8)
    c.setActive(true)
    const before = ctx.created.bufferSource ?? 0
    c.goal('home', 1)
    c.nearMiss('away', 3)
    c.foul('away', 'yellow', 4)
    c.timeWasting(5)
    c.fullTime(2, 1, 6)
    expect((ctx.created.bufferSource ?? 0) - before).toBeGreaterThanOrEqual(2)
    const end = c.chant(CHANTS[0], 2, 7)
    expect(end).toBeCloseTo(7 + 2 * chantLength(CHANTS[0]), 6)
    s.pump(120, 0)
    expect(c.state.active).toBe(true)
    c.setActive(false)
    expect(c.state.active).toBe(false)
  })

  it('reduced sound suppresses chants', async () => {
    const ctx = fakeCtx()
    const s = new LookaheadScheduler(ctx, noTimers)
    const c = new Crowd(ctx, ctx.createGain(), s)
    await c.init(tex)
    c.reduced = true
    c.setActive(true)
    const before = ctx.created.bufferSource ?? 0
    c.queueChant(0.5)
    s.pump(5, 0)
    expect(ctx.created.bufferSource ?? 0).toBe(before)
  })
})

describe('AudioEngine lifecycle (mock AudioContext)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('is inert before a gesture, unlocks once and applies pending requests', () => {
    const made: FakeAudioContext[] = []
    class Ctx extends FakeAudioContext {
      constructor() {
        super()
        made.push(this)
      }
    }
    vi.stubGlobal('window', { AudioContext: Ctx, addEventListener: () => undefined })
    const e = new AudioEngine()
    expect(e.state).toBe('none')
    e.playMusic('menu')
    e.sfx('tap') // dropped silently before unlock
    expect(made.length).toBe(0)
    e.unlock()
    e.unlock()
    expect(made.length).toBe(1)
    expect(made[0].resumes).toBe(1)
    expect(e.state).toBe('running')
    expect(e.currentMusic).toBe('menu')
    e.setMix({ muted: true })
    expect(e.audible('ui')).toBe(false)
    expect(e.errors).toBe(0)
  })

  it('reports unsupported without WebAudio', () => {
    vi.stubGlobal('window', {})
    const e = new AudioEngine()
    e.unlock()
    expect(e.state).toBe('unsupported')
    e.playMusic('hub')
    e.sfx('confirm')
  })

  it('crowd leases: active while any holder remains', async () => {
    vi.stubGlobal('window', { AudioContext: FakeAudioContext, addEventListener: () => undefined })
    const e = new AudioEngine()
    e.unlock()
    e.holdCrowd('match')
    e.holdCrowd('scene', { capacity: 100 })
    await vi.waitFor(() => expect(e.crowd).not.toBeNull(), { timeout: 10000 })
    expect(e.crowd!.state.active).toBe(true)
    expect(e.crowd!.state.capacity).toBe(100)
    e.releaseCrowd('scene')
    expect(e.crowd!.state.capacity).toBe(20000)
    e.releaseCrowd('match')
    expect(e.crowd!.state.active).toBe(false)
  })
})

describe('settings → mix', () => {
  it('maps persisted fields onto mixer channels', () => {
    const m = mixFromSettings({ sound: 0.4, music: 0.2, masterVolume: 0.7, crowdVolume: 0.9, uiVolume: 0.1, voiceVolume: 0.5, muted: true, reducedSound: true })
    expect(m).toEqual({ master: 0.7, music: 0.2, sfx: 0.4, crowd: 0.9, ui: 0.1, voice: 0.5, muted: true, reduced: true })
    expect(mixFromSettings({})).toEqual(DEFAULT_MIX)
  })
})

describe('analysis', () => {
  it('measures peak/RMS/silence and encodes a valid WAV header', () => {
    const sr = 8000
    const sine = new Float32Array(sr).map((_, i) => 0.5 * Math.sin((2 * Math.PI * 440 * i) / sr))
    const st = analyze([sine, sine], sr)
    expect(st.peakDb).toBeCloseTo(-6.02, 1)
    expect(st.rmsDb).toBeCloseTo(-9.03, 1)
    expect(st.silentRatio).toBe(0)
    expect(st.nan).toBe(0)
    const silent = analyze([new Float32Array(sr)], sr)
    expect(silent.silentRatio).toBe(1)
    const wav = encodeWav([sine, sine], sr)
    expect(String.fromCharCode(...wav.subarray(0, 4))).toBe('RIFF')
    expect(wav.length).toBe(44 + sr * 2 * 2)
  })
})

describe('rig', () => {
  it('builds on any context; big moments duck the music bus', async () => {
    const ctx = fakeCtx()
    const r = buildRig(ctx, DEFAULT_MIX, { timers: noTimers })
    await r.crowd.init(buildCrowdTexturesSync())
    r.crowd.setActive(true)
    r.crowd.goal('home', 1)
    const duck = (r.mixer.input.music as unknown as FakeNode).connections[0] as unknown as { gain: { events: { value: number }[] } }
    expect(Math.min(...duck.gain.events.map((x) => x.value))).toBeLessThan(0.5)
  })
})
