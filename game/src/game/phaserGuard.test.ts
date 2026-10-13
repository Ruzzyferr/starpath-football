import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('phaser', () => ({ default: { Core: { Events: { POST_RENDER: 'postrender' } } } }))

const { guardPhaser } = await import('./phaserGuard')
const { _resetRenderGuard, isWebglBroken, setRenderGuardStore, START_SENTINEL_KEY } = await import('./renderGuard')
const { _resetErrorRing, recentErrors } = await import('../telemetry/errorRing')

// ───────────── Minimal DOM / Phaser fakes (node test environment) ─────────────

type Listener = (...a: unknown[]) => void

class FakeEl {
  children: FakeEl[] = []
  parent: FakeEl | null = null
  attrs: Record<string, string> = {}
  listeners: Record<string, Listener[]> = {}
  textContent = ''
  className = ''
  type = ''
  style: Record<string, string> = {}
  width = 0
  height = 0
  tag: string
  constructor(tag: string) { this.tag = tag }
  setAttribute(k: string, v: string) { this.attrs[k] = v }
  append(...els: FakeEl[]) { for (const e of els) this.appendChild(e) }
  appendChild(e: FakeEl) { e.parent = this; this.children.push(e); return e }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this); this.parent = null }
  addEventListener(ev: string, fn: Listener) { (this.listeners[ev] ??= []).push(fn) }
  removeEventListener(ev: string, fn: Listener) { this.listeners[ev] = (this.listeners[ev] ?? []).filter((f) => f !== fn) }
  dispatch(ev: string, e: unknown = { preventDefault() {} }) { for (const f of this.listeners[ev] ?? []) f(e) }
  click() { this.dispatch('click') }
  getContext() { return blankPixels ? { drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(256) }) } : null }
  find(pred: (e: FakeEl) => boolean): FakeEl | null {
    for (const c of this.children) { if (pred(c)) return c; const d = c.find(pred); if (d) return d }
    return null
  }
}

let blankPixels = false

class FakeGame {
  handlers: Record<string, Listener[]> = {}
  events = {
    on: (ev: string, fn: Listener) => void (this.handlers[ev] ??= []).push(fn),
    off: (ev: string, fn: Listener) => void (this.handlers[ev] = (this.handlers[ev] ?? []).filter((f) => f !== fn)),
  }
  canvas = new FakeEl('canvas')
  renderer = {}
  destroyed = false
  loop = { stop: vi.fn() }
  throwInStep = false
  type: 'webgl' | 'canvas'
  constructor(type: 'webgl' | 'canvas', container: FakeEl) { this.type = type; container.appendChild(this.canvas) }
  step(_t: number, _d: number) { if (this.throwInStep) throw new Error('scene update exploded') }
  destroy() { this.destroyed = true }
  /** One game loop tick: step, then the post-render event. */
  frame() {
    ;(this as unknown as { step: (t: number, d: number) => void }).step(0, 16)
    for (const f of this.handlers.postrender ?? []) f()
  }
}

let now = 0
const store = new Map<string, string>()

beforeEach(() => {
  vi.useFakeTimers()
  now = 0
  blankPixels = false
  store.clear()
  _resetRenderGuard()
  _resetErrorRing()
  setRenderGuardStore({ getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v), removeItem: (k) => void store.delete(k) })
  vi.stubGlobal('document', { createElement: (t: string) => new FakeEl(t), documentElement: { lang: 'tr' }, visibilityState: 'visible' })
  vi.stubGlobal('getComputedStyle', () => ({ position: 'relative' }))
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  delete (globalThis as { __spForceRenderFail?: unknown }).__spForceRenderFail
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  _resetRenderGuard()
})

function host(opts: { lowGraphics?: boolean; failCreate?: ('webgl' | 'canvas')[] } = {}) {
  const container = new FakeEl('div')
  const games: FakeGame[] = []
  const onExit = vi.fn()
  const onRestart = vi.fn()
  const launched: string[] = []
  const h = guardPhaser({
    container: container as unknown as HTMLElement,
    host: 'drill',
    lowGraphics: opts.lowGraphics,
    build: (r, safe) => {
      if (opts.failCreate?.includes(r)) throw new Error(`${r} unsupported`)
      const g = new FakeGame(r, container)
      games.push(g)
      safe(() => launched.push(r))()
      return g as never
    },
    onExit,
    onRestart,
  })
  const last = () => games[games.length - 1]!
  const panel = () => container.find((e) => e.attrs['data-testid'] === 'render-fail')
  return { h, container, games, last, onExit, onRestart, launched, panel }
}

/** Frames until the blank-frame probes are done (WebGL) or the first frame (Canvas). */
function playFrames(g: FakeGame, ms = 4000) {
  for (let t = 0; t <= ms; t += 100) {
    now += 100
    g.frame()
  }
}

describe('render guard: WebGL first, Canvas second, a readable panel last', () => {
  it('a healthy WebGL start stays on WebGL and clears the start sentinel', () => {
    const t = host()
    expect(t.h.renderer).toBe('webgl')
    expect(store.has(START_SENTINEL_KEY)).toBe(true)
    playFrames(t.last())
    vi.advanceTimersByTime(10_000)
    expect(t.games).toHaveLength(1)
    expect(t.h.renderer).toBe('webgl')
    expect(store.has(START_SENTINEL_KEY)).toBe(false)
    expect(isWebglBroken()).toBe(false)
  })

  it('WebGL creation failure restarts the drill on Canvas and remembers it', () => {
    const t = host({ failCreate: ['webgl'] })
    expect(t.h.renderer).toBe('canvas')
    expect(t.launched).toEqual(['canvas'])
    expect(t.onRestart).toHaveBeenCalledTimes(1)
    expect(isWebglBroken()).toBe(true)
    t.last().frame()
    expect(store.has(START_SENTINEL_KEY)).toBe(false)
    expect(t.panel()).toBeNull()
  })

  it('no WebGL frame within the budget (a stalled GPU) falls back to Canvas', () => {
    const t = host()
    const webgl = t.last()
    vi.advanceTimersByTime(3000)
    expect(t.games).toHaveLength(1) // one short second chance
    vi.advanceTimersByTime(1500)
    expect(t.games).toHaveLength(2)
    expect(webgl.destroyed).toBe(true)
    expect(webgl.canvas.parent).toBeNull()
    expect(t.h.renderer).toBe('canvas')
    expect(recentErrors().some((e) => /no frame within 4.5 s/.test(e.message))).toBe(true)
  })

  it('a scene that throws in its update is caught (the loop survives) and restarted on Canvas', () => {
    const t = host()
    const webgl = t.last()
    webgl.throwInStep = true
    expect(() => webgl.frame()).not.toThrow()
    expect(t.h.renderer).toBe('canvas')
    expect(recentErrors().some((e) => e.kind === 'phaser' && /scene update exploded/.test(e.message))).toBe(true)
  })

  it('a lost WebGL context restarts on Canvas', () => {
    const t = host()
    playFrames(t.last())
    t.games[0]!.canvas.dispatch('webglcontextlost')
    expect(t.h.renderer).toBe('canvas')
    expect(t.games).toHaveLength(2)
  })

  it('blank WebGL frames (drawn but empty) restart on Canvas', () => {
    blankPixels = true
    const t = host()
    playFrames(t.games[0]!)
    expect(t.h.renderer).toBe('canvas')
    expect(recentErrors().some((e) => /blank/.test(e.message))).toBe(true)
  })

  it('a blank-frame readback that stalls counts as rendered and is never repeated on this device', () => {
    blankPixels = true
    // Each sample takes 400 ms (an Adreno readback stall).
    const orig = FakeEl.prototype.getContext
    FakeEl.prototype.getContext = function () { return { drawImage() { now += 400 }, getImageData: () => ({ data: new Uint8ClampedArray(256) }) } }
    try {
      const t = host()
      playFrames(t.games[0]!)
      expect(t.h.renderer).toBe('webgl')
      expect(store.get('sp.render.readbackSlow')).toBeDefined()
      expect(store.has(START_SENTINEL_KEY)).toBe(false)
      t.h.stop()
      // Next start: no probe at all (first frame settles it).
      const t2 = host()
      t2.last().frame()
      expect(store.has(START_SENTINEL_KEY)).toBe(false)
    } finally {
      FakeEl.prototype.getContext = orig
    }
  })

  it('context loss never loops: WebGL lost → Canvas once; the Canvas context lost too → panel; losses are counted per device', () => {
    const t = host()
    playFrames(t.last())
    t.games[0]!.canvas.dispatch('webglcontextlost')
    // A restore attempt on the dead WebGL canvas changes nothing.
    t.games[0]!.canvas.dispatch('webglcontextrestored')
    expect(t.h.renderer).toBe('canvas')
    expect(t.games).toHaveLength(2)
    expect(store.get('sp.render.ctxLost')).toBe('1')
    t.games[1]!.canvas.dispatch('contextlost')
    expect(t.panel()).not.toBeNull()
    expect(t.games).toHaveLength(2)
    expect(store.get('sp.render.ctxLost')).toBe('2')
    // Repeated losses after the panel do nothing more.
    for (let i = 0; i < 5; i++) t.games[1]!.canvas.dispatch('contextlost')
    expect(t.games).toHaveLength(2)
    expect(store.get('sp.render.ctxLost')).toBe('2')
  })

  it('compatibility mode (software drawing) starts on Canvas directly', () => {
    store.set('sp.render.software', JSON.stringify({ on: true }))
    const t = host()
    expect(t.h.renderer).toBe('canvas')
  })

  it('Low graphics starts on Canvas directly', () => {
    const t = host({ lowGraphics: true })
    expect(t.h.renderer).toBe('canvas')
    expect(t.games[0]!.type).toBe('canvas')
  })

  it('when Canvas fails too, the TR panel shows the error and its Exit leaves the host', () => {
    const t = host({ failCreate: ['webgl', 'canvas'] })
    const p = t.panel()
    expect(p).not.toBeNull()
    const text = JSON.stringify(p, (k, v) => (k === 'parent' ? undefined : v))
    expect(text).toContain('Oyun ekranı açılamadı')
    expect(text).toContain('canvas unsupported')
    expect(text).toContain('webgl → canvas')
    const exit = p!.find((e) => e.attrs['data-testid'] === 'render-fail-exit')!
    expect(exit.textContent).toBe('Çık')
    expect(exit.attrs['data-back-exit']).toBe('')
    exit.click()
    expect(t.onExit).toHaveBeenCalledTimes(1)
    // A failed Canvas start is no hang: the sentinel is cleared.
    expect(store.has(START_SENTINEL_KEY)).toBe(false)
  })

  it('a failed attempt is reported once: later frames of the dying game add nothing', () => {
    const t = host({ lowGraphics: true })
    const g = t.last()
    g.throwInStep = true
    for (let i = 0; i < 5; i++) g.frame()
    expect(t.container.children.filter((c) => c.attrs['data-testid'] === 'render-fail')).toHaveLength(1)
    expect(recentErrors().filter((e) => e.kind === 'render')).toHaveLength(1)
  })

  it('stop() tears down and clears the sentinel (leaving early is not a GPU hang)', () => {
    const t = host()
    t.h.stop()
    expect(t.last().destroyed).toBe(true)
    expect(store.has(START_SENTINEL_KEY)).toBe(false)
    vi.advanceTimersByTime(10_000)
    expect(t.games).toHaveLength(1)
    expect(isWebglBroken()).toBe(false)
  })

  it('debug hook: forced WebGL failure exercises the Canvas path', () => {
    ;(globalThis as { __spForceRenderFail?: string }).__spForceRenderFail = 'webgl'
    const t = host()
    expect(t.h.renderer).toBe('canvas')
    expect(t.games.map((g) => g.type)).toEqual(['canvas'])
  })
})
