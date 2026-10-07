import { describe, expect, it } from 'vitest'
import {
  BUSES, BUS_TRIM, DEFAULT_MIX, Mixer, busGain, combinedDuckGain, dbToGain, duckDbAt, effectiveGain, gainToDb, masterGain, pruneDucks,
  sanitizeMix, sliderToGain, type Duck,
} from './mixer'
import { FakeParam, fakeCtx } from './testing/fakeContext'

describe('mixer math', () => {
  it('maps sliders perceptually and clamps garbage', () => {
    expect(sliderToGain(0)).toBe(0)
    expect(sliderToGain(1)).toBe(1)
    expect(gainToDb(sliderToGain(0.5))).toBeCloseTo(-12.04, 1)
    expect(sliderToGain(2)).toBe(1)
    expect(sliderToGain(-1)).toBe(0)
    expect(sliderToGain(Number.NaN)).toBe(0)
    expect(dbToGain(gainToDb(0.3))).toBeCloseTo(0.3, 6)
  })

  it('sanitizes partial / invalid settings to defaults', () => {
    expect(sanitizeMix(null)).toEqual(DEFAULT_MIX)
    const m = sanitizeMix({ master: 3, music: Number.NaN, muted: 'yes' as unknown as boolean, crowd: 0.25 })
    expect(m.master).toBe(1)
    expect(m.music).toBe(DEFAULT_MIX.music)
    expect(m.muted).toBe(false)
    expect(m.crowd).toBe(0.25)
  })

  it('mute zeroes master; buses include headroom trim', () => {
    const m = sanitizeMix({ master: 1, music: 1, muted: true })
    expect(masterGain(m)).toBe(0)
    expect(effectiveGain(m, 'music')).toBe(0)
    const loud = sanitizeMix({ master: 1, music: 1, sfx: 1, crowd: 1, ui: 1, voice: 1 })
    for (const b of BUSES) expect(busGain(loud, b)).toBeCloseTo(BUS_TRIM[b], 6)
    // Reduced sound pulls crowd and music down a little, not UI.
    const red = { ...loud, reduced: true }
    expect(busGain(red, 'crowd')).toBeLessThan(busGain(loud, 'crowd'))
    expect(busGain(red, 'ui')).toBe(busGain(loud, 'ui'))
  })

  it('every bus at full scale leaves headroom for the limiter', () => {
    for (const b of BUSES) expect(BUS_TRIM[b]).toBeLessThanOrEqual(0.6)
    const sum = BUSES.reduce((s, b) => s + BUS_TRIM[b], 0)
    expect(gainToDb(sum)).toBeLessThan(8)
  })

  it('duck envelope: attack, hold, release; deepest overlapping duck wins', () => {
    const d: Duck = { depthDb: 12, start: 1, attack: 0.2, hold: 1, release: 2 }
    expect(duckDbAt(d, 0.5)).toBe(0)
    expect(duckDbAt(d, 1.1)).toBeCloseTo(6, 6)
    expect(duckDbAt(d, 1.5)).toBe(12)
    expect(duckDbAt(d, 3.2)).toBeCloseTo(6, 6)
    expect(duckDbAt(d, 5)).toBe(0)
    const shallow: Duck = { depthDb: 4, start: 1, attack: 0.1, hold: 5, release: 1 }
    expect(combinedDuckGain([d, shallow], 1.5)).toBeCloseTo(dbToGain(-12), 6)
    expect(combinedDuckGain([d, shallow], 4)).toBeCloseTo(dbToGain(-4), 6)
    expect(pruneDucks([d, shallow], 4.5)).toEqual([shallow])
  })
})

describe('Mixer graph (fake context)', () => {
  it('builds 5 buses into master → glue → limiter → trim → destination', () => {
    const ctx = fakeCtx()
    const m = new Mixer(ctx, DEFAULT_MIX)
    expect(Object.keys(m.input).sort()).toEqual([...BUSES].sort())
    expect(ctx.created.compressor).toBe(2)
    expect((m.output.gain as unknown as FakeParam).value).toBeLessThan(dbToGain(-1))
    expect((m.master.gain as unknown as FakeParam).value).toBeCloseTo(masterGain(DEFAULT_MIX), 6)
  })

  it('setMix ramps bus and master gains to the new targets', () => {
    const ctx = fakeCtx()
    const m = new Mixer(ctx, DEFAULT_MIX)
    m.setMix({ music: 0.5, muted: true })
    expect((m.input.music.gain as unknown as FakeParam).last).toBeCloseTo(busGain(m.settings, 'music'), 6)
    expect((m.master.gain as unknown as FakeParam).last).toBe(0)
    expect(m.settings.muted).toBe(true)
  })

  it('duck schedules a dip and returns to unity', () => {
    const ctx = fakeCtx()
    const m = new Mixer(ctx, DEFAULT_MIX)
    m.duck('music', 10, { attack: 0.1, hold: 0.5, release: 0.5 })
    // The duck node sits after the bus input.
    const duckNode = (m.input.music as unknown as { connections: { gain: FakeParam }[] }).connections[0]
    const ev = duckNode.gain.events
    const min = Math.min(...ev.map((e) => e.value))
    expect(min).toBeCloseTo(dbToGain(-10), 2)
    expect(ev[ev.length - 1].value).toBe(1)
  })
})
