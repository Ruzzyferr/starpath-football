import { afterEach, describe, expect, it, vi } from 'vitest'
import { EXIT_TAP_DEDUPE_MS, bindExitTap, exitTapProps } from './exitTap'

type L = (e: unknown) => void
function fakeButton() {
  const ls: Record<string, L[]> = {}
  return {
    addEventListener: (t: string, f: L) => void (ls[t] ??= []).push(f),
    removeEventListener: (t: string, f: L) => void (ls[t] = (ls[t] ?? []).filter((x) => x !== f)),
    fire: (t: string, e: unknown = {}) => { for (const f of ls[t] ?? []) f(e) },
    count: () => Object.values(ls).reduce((n, a) => n + a.length, 0),
  }
}

afterEach(() => vi.useRealTimers())

describe('exit tap', () => {
  it('fires on the first touch (touchstart prevents the ghost click), once per tap', () => {
    vi.useFakeTimers()
    const b = fakeButton()
    const fn = vi.fn()
    const off = bindExitTap(b as unknown as HTMLElement, fn)
    const prevent = vi.fn()
    b.fire('pointerdown', { pointerType: 'touch' })
    b.fire('touchstart', { cancelable: true, preventDefault: prevent })
    b.fire('click')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('pointerdown')
    expect(prevent).toHaveBeenCalled()
    // A second tap later works again (an exit that did not close can be retried).
    vi.advanceTimersByTime(EXIT_TAP_DEDUPE_MS + 1)
    b.fire('click')
    expect(fn).toHaveBeenCalledTimes(2)
    off()
    expect(b.count()).toBe(0)
  })

  it('a mouse pointerdown waits for the click (keyboard / mouse semantics unchanged)', () => {
    const p = exitTapProps(vi.fn())
    const fn = vi.fn()
    const q = exitTapProps(fn)
    q.onPointerDown({ pointerType: 'mouse' } as PointerEvent)
    expect(fn).not.toHaveBeenCalled()
    q.onClick()
    expect(fn).toHaveBeenCalledWith('click')
    expect(typeof p.onTouchStart).toBe('function')
  })
})
