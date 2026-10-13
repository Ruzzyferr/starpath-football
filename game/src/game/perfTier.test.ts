import { describe, expect, it } from 'vitest'
import { BENCH_MS, FPS_FLOOR, adjustForFps, gpuClass, profileFromProbe, renderScale } from './quality'

/** Performance tier for mid/low-end Android (Galaxy A52 report): GPU class, FPS probe, DPR caps. */
describe('perf tier: GPU class from the WebGL renderer string', () => {
  it('classifies phone and desktop GPUs', () => {
    expect(gpuClass('Adreno (TM) 618')).toBe('mid') // Galaxy A52
    expect(gpuClass('Adreno (TM) 506')).toBe('low')
    expect(gpuClass('Adreno (TM) 660')).toBe('high')
    expect(gpuClass('Mali-G52 MC2')).toBe('low')
    expect(gpuClass('Mali-G57 MC2')).toBe('mid')
    expect(gpuClass('Mali-G710 MC10')).toBe('high')
    expect(gpuClass('Mali-T880')).toBe('low')
    expect(gpuClass('Mali-400 MP')).toBe('low')
    expect(gpuClass('PowerVR Rogue GE8320')).toBe('low')
    expect(gpuClass('Google SwiftShader')).toBe('low')
    expect(gpuClass('ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe('high')
    expect(gpuClass('Apple GPU')).toBe('high')
    expect(gpuClass('ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe('mid')
    expect(gpuClass('')).toBe('unknown')
    expect(gpuClass(undefined)).toBe('unknown')
    expect(gpuClass('Some Future GPU')).toBe('unknown')
  })
})

describe('perf tier: device probe → profile', () => {
  const fast = { benchMs: BENCH_MS.high - 1, cores: 8, memoryGb: 8, coarse: false }
  it('a weak GPU forces Low, a mid GPU caps at Medium, unknown leaves the benchmark in charge', () => {
    expect(profileFromProbe({ ...fast, gpu: 'Google SwiftShader' })).toBe('low')
    expect(profileFromProbe({ ...fast, gpu: 'Mali-G52 MC2' })).toBe('low')
    expect(profileFromProbe({ ...fast, gpu: 'Adreno (TM) 618' })).toBe('medium')
    expect(profileFromProbe({ ...fast, gpu: 'Apple GPU' })).toBe('high')
    expect(profileFromProbe({ ...fast, gpu: '' })).toBe('high')
  })
  it('the Galaxy A52 profile (8 cores, 4-6 GB, touch, Adreno 618) lands on Medium, never High', () => {
    const a52 = { benchMs: BENCH_MS.high + 3, cores: 8, memoryGb: 4, coarse: true, gpu: 'Adreno (TM) 618' }
    expect(profileFromProbe(a52)).toBe('medium')
    expect(profileFromProbe({ ...a52, benchMs: BENCH_MS.medium + 5 })).toBe('low')
  })
})

describe('perf tier: FPS probe', () => {
  it('drops one step below the floor and never below Low', () => {
    expect(adjustForFps('high', 59)).toBe('high')
    expect(adjustForFps('high', FPS_FLOOR - 1)).toBe('medium')
    expect(adjustForFps('medium', 25)).toBe('low')
    expect(adjustForFps('low', 10)).toBe('low')
  })
  it('ignores a probe that did not run (0 / NaN)', () => {
    expect(adjustForFps('medium', 0)).toBe('medium')
    expect(adjustForFps('medium', Number.NaN)).toBe('medium')
  })
})

describe('perf tier: render scale (canvas DPR)', () => {
  const a52 = { dpr: 2.625, cssW: 412, cssH: 915, coarse: true }
  it('caps the A52 at 1.5x on Medium, 1.25x on Low, 2x on High', () => {
    expect(renderScale({ ...a52, profile: 'medium' })).toBe(1.5)
    expect(renderScale({ ...a52, profile: 'low' })).toBe(1.25)
    expect(renderScale({ ...a52, profile: 'high' })).toBe(2)
  })
  it('the Medium cap is for touch devices only', () => {
    expect(renderScale({ dpr: 2, cssW: 1024, cssH: 768, coarse: false, profile: 'medium' })).toBe(2)
  })
})
