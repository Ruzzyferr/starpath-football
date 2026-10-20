import { afterEach, describe, expect, it, vi } from 'vitest'

describe('FEATURE_CASINO build flag (2.12#42)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('default builds keep the casino (player can still hide it)', async () => {
    const m = await import('./contentFlags')
    expect(m.CASINO_BUILD).toBe(true)
    expect(m.contentFlags.hideCasino).toBe(false)
  })

  it('VITE_FEATURE_CASINO=0 hides the casino from the start', async () => {
    vi.stubEnv('VITE_FEATURE_CASINO', '0')
    vi.resetModules()
    const m = await import('./contentFlags')
    expect(m.CASINO_BUILD).toBe(false)
    expect(m.contentFlags.hideCasino).toBe(true)
  })
})

describe('casinoHidden(): the single source of truth', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('default build: follows the player setting (argument first, else the store-synced flag)', async () => {
    const m = await import('./contentFlags')
    expect(m.casinoHidden(false)).toBe(false)
    expect(m.casinoHidden(true)).toBe(true)
    expect(m.casinoHidden()).toBe(false)
    m.contentFlags.hideCasino = true
    expect(m.casinoHidden()).toBe(true)
    m.contentFlags.hideCasino = false
  })

  it('no-casino build (iOS): always hidden, whatever the setting says', async () => {
    vi.stubEnv('VITE_FEATURE_CASINO', '0')
    vi.resetModules()
    const m = await import('./contentFlags')
    expect(m.casinoHidden(false)).toBe(true)
    expect(m.casinoHidden(true)).toBe(true)
    expect(m.casinoHidden()).toBe(true)
    // Even a stale sync that flips the flag back cannot reopen it.
    m.contentFlags.hideCasino = false
    expect(m.casinoHidden()).toBe(true)
  })

  it('names every casino screen', async () => {
    const m = await import('./contentFlags')
    expect([...m.CASINO_SCREENS].sort()).toEqual(['blackjack', 'casino', 'horses', 'roulette', 'slots'])
  })
})
