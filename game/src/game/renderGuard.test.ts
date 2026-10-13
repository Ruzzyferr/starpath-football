import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  START_SENTINEL_KEY,
  WEBGL_BROKEN_KEY,
  _resetRenderGuard,
  beginStart,
  clearWebglBroken,
  createWatchdog,
  endStart,
  isBlankFrame,
  isWebglBroken,
  markWebglBroken,
  pickRenderer,
  recoverStaleStart,
  setRenderGuardStore,
  type Timers,
} from './renderGuard'

function memStore() {
  const m = new Map<string, string>()
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  }
}

function fakeTimers() {
  let seq = 0
  const pending = new Map<number, { fn: () => void; at: number }>()
  let now = 0
  const timers: Timers = {
    setTimeout: (fn, ms) => {
      const id = ++seq
      pending.set(id, { fn, at: now + ms })
      return id
    },
    clearTimeout: (id) => void pending.delete(id as number),
  }
  const advance = (ms: number) => {
    now += ms
    for (const [id, t] of [...pending]) if (t.at <= now) {
      pending.delete(id)
      t.fn()
    }
  }
  return { timers, advance, pending }
}

describe('renderer choice and the remembered WebGL failure', () => {
  let store: ReturnType<typeof memStore>
  beforeEach(() => {
    _resetRenderGuard()
    store = memStore()
    setRenderGuardStore(store)
  })
  afterEach(() => _resetRenderGuard())

  it('starts on WebGL by default, Canvas for Low graphics or a forced retry', () => {
    expect(pickRenderer({})).toBe('webgl')
    expect(pickRenderer({ lowGraphics: true })).toBe('canvas')
    expect(pickRenderer({ force: 'canvas' })).toBe('canvas')
  })

  it('a WebGL failure is persisted: the next start (and the next session) goes straight to Canvas', () => {
    markWebglBroken('drill: no frame within 4.5 s')
    expect(pickRenderer({})).toBe('canvas')
    expect(store.m.get(WEBGL_BROKEN_KEY)).toContain('no frame')
    // New session: only the stored flag is left.
    _resetRenderGuard()
    setRenderGuardStore(store)
    expect(isWebglBroken()).toBe(true)
    expect(pickRenderer({})).toBe('canvas')
    clearWebglBroken()
    expect(pickRenderer({})).toBe('webgl')
  })

  it('works without storage (private mode): the failure holds for this session', () => {
    setRenderGuardStore({ getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') }, removeItem: () => { throw new Error('denied') } })
    expect(pickRenderer({})).toBe('webgl')
    markWebglBroken('x')
    expect(pickRenderer({})).toBe('canvas')
  })
})

describe('start sentinel (a WebGL start that hung the app)', () => {
  let store: ReturnType<typeof memStore>
  beforeEach(() => {
    _resetRenderGuard()
    store = memStore()
    setRenderGuardStore(store)
  })
  afterEach(() => _resetRenderGuard())

  it('a WebGL start left unfinished marks WebGL broken at the next boot', () => {
    beginStart('webgl', 'drill')
    expect(store.m.has(START_SENTINEL_KEY)).toBe(true)
    _resetRenderGuard()
    setRenderGuardStore(store)
    expect(recoverStaleStart()).toBe('drill')
    expect(isWebglBroken()).toBe(true)
    expect(store.m.has(START_SENTINEL_KEY)).toBe(false)
  })

  it('a finished start, or an unfinished Canvas start, changes nothing', () => {
    beginStart('webgl', 'match')
    endStart()
    expect(recoverStaleStart()).toBeNull()
    beginStart('canvas', 'drill')
    expect(recoverStaleStart()).toBeNull()
    expect(isWebglBroken()).toBe(false)
  })

  it('ignores a corrupt sentinel', () => {
    store.m.set(START_SENTINEL_KEY, '{nope')
    expect(recoverStaleStart()).toBeNull()
    expect(isWebglBroken()).toBe(false)
  })
})

describe('first-frame watchdog', () => {
  it('fails when no frame arrives in time', () => {
    const t = fakeTimers()
    const onFail = vi.fn()
    createWatchdog(onFail, 3000, t.timers)
    t.advance(2999)
    expect(onFail).not.toHaveBeenCalled()
    t.advance(1)
    expect(onFail).toHaveBeenCalledTimes(1)
    expect(onFail.mock.calls[0]![0]).toMatch(/no frame within 3 s/)
  })

  it('a frame in time settles it; a later scene error still fails (once)', () => {
    const t = fakeTimers()
    const onFail = vi.fn()
    const wd = createWatchdog(onFail, 3000, t.timers)
    wd.ok()
    expect(wd.settled).toBe(true)
    t.advance(10_000)
    expect(onFail).not.toHaveBeenCalled()
    wd.fail('scene error: boom')
    wd.fail('WebGL context lost')
    expect(onFail).toHaveBeenCalledTimes(1)
    expect(onFail).toHaveBeenCalledWith('scene error: boom')
  })

  it('dispose (the player left) never reports', () => {
    const t = fakeTimers()
    const onFail = vi.fn()
    const wd = createWatchdog(onFail, 3000, t.timers)
    wd.dispose()
    wd.fail('late')
    t.advance(5000)
    expect(onFail).not.toHaveBeenCalled()
    expect(t.pending.size).toBe(0)
  })
})

describe('blank frame check', () => {
  const clear = [0x0b, 0x14, 0x10] as const
  it('all transparent, all black or only the clear colour is blank', () => {
    expect(isBlankFrame(new Uint8ClampedArray(16), clear)).toBe(true)
    expect(isBlankFrame([0, 0, 0, 255, 0, 0, 0, 255], clear)).toBe(true)
    expect(isBlankFrame([11, 20, 16, 255, 12, 21, 15, 255], clear)).toBe(true)
  })
  it('any drawn pixel (the green pitch) is not', () => {
    expect(isBlankFrame([11, 20, 16, 255, 40, 120, 60, 255], clear)).toBe(false)
    expect(isBlankFrame([], clear)).toBe(false)
  })
})
