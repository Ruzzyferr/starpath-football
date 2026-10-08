import { describe, expect, it } from 'vitest'
import { BULLET_IN_TIME, BULLET_OUT_TIME, stepTimeScale, type ScaleRamp } from './bulletTime'

const run = (r: ScaleRamp, from: number, target: number, secs: number, dt = 1 / 60): number[] => {
  let s = from
  const out: number[] = []
  for (let t = 0; t < secs - 1e-9; t += dt) out.push((s = stepTimeScale(r, s, target, dt)))
  return out
}

describe('bullet-time ramps (2.2#14, #15)', () => {
  it('slows 1.0x -> 0.25x in 150 ms with an ease-out', () => {
    const r: ScaleRamp = { from: 1, to: 1, t: 0 }
    const s = run(r, 1, 0.25, BULLET_IN_TIME)
    expect(s[s.length - 1]).toBeCloseTo(0.25, 6)
    // Ease-out: more than half the drop in the first half of the ramp.
    expect(s[Math.floor(s.length / 2) - 1]).toBeLessThan(0.625)
    for (let i = 1; i < s.length; i++) expect(s[i]).toBeLessThanOrEqual(s[i - 1]!)
  })
  it('returns to 1.0x in 120 ms once the window runs out', () => {
    const r: ScaleRamp = { from: 1, to: 0.25, t: 1 }
    const s = run(r, 0.25, 1, BULLET_OUT_TIME)
    expect(s[s.length - 1]).toBeCloseTo(1, 6)
    expect(s[0]).toBeGreaterThan(0.25)
  })
  it('is frame-rate independent at the end of the ramp', () => {
    const a = run({ from: 1, to: 1, t: 0 }, 1, 0.25, 0.3, 1 / 30)
    const b = run({ from: 1, to: 1, t: 0 }, 1, 0.25, 0.3, 1 / 144)
    expect(a[a.length - 1]).toBeCloseTo(b[b.length - 1]!, 6)
  })
})

describe('bullet-time look (2.2#14)', () => {
  it('adds at most 15 % vignette and a slight desaturation', async () => {
    const { bulletVignette, bulletDesaturation } = await import('./bulletTime')
    expect(bulletVignette(0)).toBe(0)
    expect(bulletVignette(0.75)).toBeCloseTo(0.15, 6)
    expect(bulletVignette(5)).toBeCloseTo(0.15, 6)
    expect(bulletDesaturation(0.75)).toBeGreaterThan(0)
    expect(bulletDesaturation(0.75)).toBeLessThan(0.5)
  })
})

describe('composure ring (2.2#15)', () => {
  it('shrinks with the remaining window', async () => {
    const { composureRingRadius } = await import('./bulletTime')
    expect(composureRingRadius(1)).toBeCloseTo(3, 6)
    expect(composureRingRadius(0.5)).toBeLessThan(composureRingRadius(0.9))
    expect(composureRingRadius(0)).toBeCloseTo(0.6, 6)
  })
})
