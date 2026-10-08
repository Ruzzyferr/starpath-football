import { describe, expect, it } from 'vitest'
import { LookaheadScheduler, Sequence, nextBarTime, stepDuration, stepIndexAtOrAfter, stepTime, swingOffset } from './scheduler'

describe('scheduler timing math', () => {
  it('16th-note duration and step times', () => {
    expect(stepDuration(120)).toBeCloseTo(0.125, 9)
    expect(stepDuration(60, 2)).toBeCloseTo(0.5, 9)
    expect(stepTime(10, 8, 120)).toBeCloseTo(11, 9)
    expect(stepIndexAtOrAfter(10, 11, 120)).toBe(8)
    expect(stepIndexAtOrAfter(10, 11.01, 120)).toBe(9)
    expect(stepIndexAtOrAfter(10, 5, 120)).toBe(0)
  })

  it('next bar line', () => {
    // 120 BPM 4/4: bars are 2 s long.
    expect(nextBarTime(0, 0.5, 120)).toBeCloseTo(2, 9)
    expect(nextBarTime(0, 2, 120)).toBeCloseTo(4, 9)
    expect(nextBarTime(0, 2, 120, 4, true)).toBeCloseTo(2, 9)
    expect(nextBarTime(5, 1, 120)).toBe(5)
    expect(nextBarTime(1, 6.9, 118)).toBeCloseTo(1 + 3 * (240 / 118), 6)
  })

  it('swing only delays odd steps', () => {
    expect(swingOffset(0, 120, 0.5)).toBe(0)
    expect(swingOffset(1, 120, 0.5)).toBeCloseTo(0.03125, 9)
    expect(swingOffset(3, 120, 2)).toBeCloseTo(0.0625, 9)
  })
})

describe('Sequence', () => {
  it('emits each step exactly once across overlapping windows', () => {
    const s = new Sequence(0, 120)
    const a = s.collect(0.3, 0)
    const b = s.collect(0.6, 0.2)
    const idx = [...a, ...b].map((e) => e.index)
    expect(idx).toEqual([0, 1, 2, 3, 4])
    expect(a.map((e) => e.time)).toEqual([0, 0.125, 0.25])
  })

  it('skips a backlog instead of bursting late notes', () => {
    const s = new Sequence(0, 120)
    s.collect(0.1, 0)
    // The tab was throttled for 2 s.
    const late = s.collect(2.2, 2.05)
    expect(late[0]!.time).toBeGreaterThanOrEqual(2.0 - 1e-9)
    expect(s.skipped).toBeGreaterThan(10)
  })
})

describe('LookaheadScheduler', () => {
  function rig() {
    const clock = { currentTime: 0 }
    let fn: (() => void) | null = null
    const timers = {
      setInterval: (f: () => void) => {
        fn = f
        return 1
      },
      clearInterval: () => {
        fn = null
      },
    }
    const s = new LookaheadScheduler(clock, { lookahead: 0.1, intervalMs: 25, timers })
    return { clock, s, tick: () => fn?.(), isRunning: () => fn !== null }
  }

  it('pumps clients up to now + lookahead on every tick', () => {
    const { clock, s, tick } = rig()
    const seq = new Sequence(0, 120)
    const times: number[] = []
    s.add((until, now) => {
      for (const e of seq.collect(until, now)) times.push(e.time)
    })
    s.start()
    expect(times).toEqual([0])
    clock.currentTime = 0.05
    tick()
    expect(times).toEqual([0, 0.125])
    clock.currentTime = 0.3
    tick()
    expect(times).toEqual([0, 0.125, 0.25, 0.375])
  })

  it('start/stop is idempotent and removal works', () => {
    const { s, isRunning } = rig()
    let calls = 0
    const off = s.add(() => calls++)
    s.start()
    s.start()
    expect(isRunning()).toBe(true)
    off()
    s.pump(1)
    expect(calls).toBe(1)
    s.stop()
    expect(s.running).toBe(false)
  })

  it('a failing client does not stop the others', () => {
    const { s } = rig()
    let ok = 0
    s.add(() => {
      throw new Error('boom')
    })
    s.add(() => ok++)
    s.pump(1)
    expect(ok).toBe(1)
  })
})
