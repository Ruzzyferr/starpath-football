import { describe, expect, it } from 'vitest'
import { BENCH_MS, ParticleBudget, QUALITY, QUALITY_PROFILES, profileFromProbe, resolveQuality } from './quality'
import { stadiumLook } from './presentation'

describe('quality profiles', () => {
  it('are ordered: each step up spends more on particles and crowd', () => {
    const [lo, mid, hi] = QUALITY_PROFILES.map((p) => QUALITY[p])
    expect(lo.particleBudget).toBeLessThan(mid.particleBudget)
    expect(mid.particleBudget).toBeLessThan(hi.particleBudget)
    expect(lo.particleScale).toBeLessThan(mid.particleScale)
    expect(lo.crowdScale).toBeLessThan(mid.crowdScale)
    expect(mid.crowdScale).toBeLessThanOrEqual(hi.crowdScale)
  })

  it('resolves auto to the benchmark result, falling back to medium', () => {
    expect(resolveQuality('high', 'low')).toBe('high')
    expect(resolveQuality('auto', 'low')).toBe('low')
    expect(resolveQuality('auto', null)).toBe('medium')
    expect(resolveQuality(undefined, undefined)).toBe('medium')
  })

  it('maps a device probe to a profile; phones and weak hardware are capped', () => {
    const fast = { benchMs: BENCH_MS.high - 1, cores: 8, memoryGb: 8, coarse: false }
    expect(profileFromProbe(fast)).toBe('high')
    expect(profileFromProbe({ ...fast, coarse: true })).toBe('medium')
    expect(profileFromProbe({ ...fast, cores: 4 })).toBe('medium')
    expect(profileFromProbe({ ...fast, memoryGb: 2 })).toBe('low')
    expect(profileFromProbe({ ...fast, benchMs: BENCH_MS.medium - 1 })).toBe('medium')
    expect(profileFromProbe({ ...fast, benchMs: BENCH_MS.medium + 1 })).toBe('low')
    // Unknown hints (0) do not cap.
    expect(profileFromProbe({ ...fast, cores: 0, memoryGb: 0 })).toBe('high')
  })

  it('crowd density follows the profile (legacy lowFx = low)', () => {
    const cap = 60_000
    const hi = stadiumLook(cap, 'high')
    const mid = stadiumLook(cap, 'medium')
    const lo = stadiumLook(cap, 'low')
    expect(hi.density).toBeGreaterThan(mid.density)
    expect(mid.density).toBeGreaterThan(lo.density)
    expect(lo.tifo).toBe(false)
    expect(mid.tifo).toBe(true)
    expect(stadiumLook(cap, true)).toEqual(lo)
    expect(stadiumLook(cap)).toEqual(hi)
  })
})

describe('particle budget', () => {
  it('scales bursts by the profile', () => {
    expect(new ParticleBudget(QUALITY.high).take(100, 1000, 0)).toBe(100)
    expect(new ParticleBudget(QUALITY.low).take(100, 1000, 0)).toBe(40)
  })

  it('never lets live particles exceed the budget, and frees them when they expire', () => {
    for (const p of QUALITY_PROFILES) {
      const b = new ParticleBudget(QUALITY[p])
      let t = 0
      for (let i = 0; i < 40; i++) {
        b.take(90, 2600, t)
        expect(b.alive(t)).toBeLessThanOrEqual(QUALITY[p].particleBudget)
        t += 50
      }
      expect(b.take(90, 2600, t)).toBe(0)
      expect(b.alive(t + 5000)).toBe(0)
      expect(b.take(10, 600, t + 5000)).toBeGreaterThan(0)
    }
  })
})
