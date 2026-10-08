import { describe, expect, it } from 'vitest'
import { FrameStats } from './frameStats'

describe('FrameStats (2.12#117)', () => {
  it('needs a minimum sample before reporting', () => {
    const f = new FrameStats()
    for (let i = 0; i < 29; i++) f.push(16.7)
    expect(f.summary()).toBeNull()
  })

  it('p5 FPS reflects stutter that the average hides', () => {
    const f = new FrameStats()
    for (let i = 0; i < 100; i++) f.push(i % 10 === 0 ? 50 : 16.67) // 10% slow frames
    const s = f.summary()!
    expect(s.avgFps).toBeGreaterThan(45)
    expect(s.p5Fps).toBeCloseTo(20, 0)
    expect(s.worstMs).toBe(50)
  })

  it('ignores hidden-tab gaps and keeps a bounded window', () => {
    const f = new FrameStats(100)
    f.push(5000)
    f.push(-1)
    f.push(Number.NaN)
    expect(f.samples).toBe(0)
    for (let i = 0; i < 500; i++) f.push(16)
    expect(f.samples).toBe(100)
  })
})
