import { describe, expect, it, vi } from 'vitest'
import { BEAT_S, COUNTDOWN_S, PauseGate, wireAppPause } from './pauseGate'

/** Run the gate for `s` seconds of 60 fps frames; returns how many frames were allowed to step. */
function run(g: PauseGate, s: number): number {
  let n = 0
  for (let t = 0; t < s - 1e-9; t += 1 / 60) if (g.tick(1 / 60)) n++
  return n
}

describe('pause gate (TestFlight build 5: moment ran behind the hint card)', () => {
  it('runs freely with no holds', () => {
    const g = new PauseGate()
    g.attach()
    expect(g.running()).toBe(true)
    expect(run(g, 1)).toBe(60)
  })

  it('a hint taken before the scene loads freezes the moment from its first frame, for any length', () => {
    const g = new PauseGate()
    g.hold('hint:match')
    g.attach()
    expect(run(g, 10)).toBe(0)
    expect(g.beat()).toBeNull()
    expect(g.held()).toBe(true)
  })

  it('dismissing starts a 3-2-1 beat in scene time, then play resumes', () => {
    const g = new PauseGate()
    g.attach()
    g.hold('hint:match')
    run(g, 3)
    g.release('hint:match')
    expect(g.held()).toBe(false)
    expect(g.running()).toBe(false)
    expect(g.beat()).toBe('3')
    g.tick(BEAT_S + 0.01)
    expect(g.beat()).toBe('2')
    g.tick(BEAT_S)
    expect(g.beat()).toBe('1')
    expect(g.tick(BEAT_S)).toBe(false) // the frame that ends the countdown does not step yet
    expect(g.beat()).toBeNull()
    expect(g.tick(1 / 60)).toBe(true)
    expect(g.running()).toBe(true)
  })

  it('the countdown only advances through tick (no wall clock), and a new hold cancels it', () => {
    const g = new PauseGate()
    g.attach()
    g.hold('app')
    g.release('app')
    expect(g.countdown()).toBeCloseTo(COUNTDOWN_S)
    g.tick(0.4)
    g.hold('app')
    expect(g.countdown()).toBe(0)
    expect(run(g, 5)).toBe(0)
    g.release('app')
    expect(g.countdown()).toBeCloseTo(COUNTDOWN_S)
  })

  it('stays frozen until every reason is released', () => {
    const g = new PauseGate()
    g.attach()
    g.hold('hint:match')
    g.hold('app')
    g.release('hint:match')
    expect(run(g, 3)).toBe(0)
    g.release('app')
    expect(run(g, COUNTDOWN_S + 0.1)).toBeGreaterThan(0)
  })

  it('releasing before a scene is attached needs no countdown; attach clears the pause key and stale beats', () => {
    const g = new PauseGate()
    g.hold('hint:drill')
    g.release('hint:drill')
    expect(g.countdown()).toBe(0)
    const tok = g.attach()
    expect(g.toggle('user')).toBe(true)
    expect(g.tick(0.1)).toBe(false)
    g.detach(tok)
    g.attach()
    expect(g.has('user')).toBe(false)
    expect(g.running()).toBe(true)
  })

  it('a stale scene detaching does not unhook the live one', () => {
    const g = new PauseGate()
    const a = g.attach()
    g.attach()
    g.detach(a)
    expect(g.isAttached()).toBe(true)
  })

  it('notifies subscribers on hold / release / attach', () => {
    const g = new PauseGate()
    const fn = vi.fn()
    const off = g.subscribe(fn)
    g.hold('x')
    g.release('x')
    g.attach()
    expect(fn).toHaveBeenCalledTimes(3)
    off()
    g.hold('y')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('app background / resume events hold and release the gate', () => {
    const g = new PauseGate()
    const target = new EventTarget()
    wireAppPause(g, target as unknown as Window)
    g.attach()
    target.dispatchEvent(new Event('sp:app-pause'))
    expect(g.has('app')).toBe(true)
    expect(run(g, 2)).toBe(0)
    target.dispatchEvent(new Event('sp:app-resume'))
    expect(g.held()).toBe(false)
    expect(g.beat()).toBe('3')
  })
})
