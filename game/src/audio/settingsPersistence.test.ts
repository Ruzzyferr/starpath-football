import { afterEach, describe, expect, it, vi } from 'vitest'

function memoryStorage(seed: Record<string, string> = {}) {
  const m = new Map(Object.entries(seed))
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() {
      return m.size
    },
    dump: m,
  }
}

const KEY = 'starpath.settings.v1'

describe('audio settings persistence (ui/store)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('old saves without mixer fields load with audio defaults', async () => {
    vi.stubGlobal('localStorage', memoryStorage({ [KEY]: JSON.stringify({ lang: 'en', sound: 0.3, music: 0.1 }) }))
    vi.resetModules()
    const store = await import('../ui/store')
    const s = store.settings.value
    expect(s.sound).toBe(0.3)
    expect(s.music).toBe(0.1)
    expect(s.masterVolume).toBe(0.9)
    expect(s.crowdVolume).toBe(0.8)
    expect(s.muted).toBe(false)
    expect(s.reducedSound).toBe(false)
  })

  it('mixer changes persist and survive a reload', async () => {
    const ls = memoryStorage()
    vi.stubGlobal('localStorage', ls)
    vi.resetModules()
    let store = await import('../ui/store')
    store.updateSettings({ masterVolume: 0.35, crowdVolume: 0.2, uiVolume: 0, muted: true, reducedSound: true })
    const saved = JSON.parse(ls.getItem(KEY)!)
    expect(saved).toMatchObject({ masterVolume: 0.35, crowdVolume: 0.2, uiVolume: 0, muted: true, reducedSound: true })
    vi.resetModules()
    store = await import('../ui/store')
    expect(store.settings.value).toMatchObject({ masterVolume: 0.35, crowdVolume: 0.2, uiVolume: 0, muted: true, reducedSound: true })
    const { mixFromSettings } = await import('./settings')
    const mix = mixFromSettings(store.settings.value)
    expect(mix.master).toBe(0.35)
    expect(mix.ui).toBe(0)
    expect(mix.muted).toBe(true)
  })
})

describe('director mapping', () => {
  it('maps screens to tracks', async () => {
    const { trackForScreen } = await import('./director')
    expect(trackForScreen('title', false)).toBe('menu')
    expect(trackForScreen('settings', false)).toBe('menu')
    expect(trackForScreen('settings', true)).toBe('keep')
    expect(trackForScreen('home', true)).toBe('hub')
    expect(trackForScreen('seasonEnd', true)).toBe('awards')
    expect(trackForScreen('preMatch', true)).toBe('tension')
    expect(trackForScreen('liveMatch', true)).toBeNull()
    expect(trackForScreen('some-future-screen', true)).toBe('hub')
  })

  it('tension rises late in close games', async () => {
    const { matchTension } = await import('./director')
    expect(matchTension(10, [0, 0])).toBeLessThan(0.2)
    expect(matchTension(88, [1, 1])).toBeGreaterThan(0.75)
    expect(matchTension(88, [4, 0])).toBeLessThan(matchTension(88, [1, 0]))
  })
})
