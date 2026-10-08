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
