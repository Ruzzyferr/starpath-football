import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

class FakeCtx {
  state = 'running'
  suspends = 0
  resumes = 0
  async suspend() { this.suspends++; this.state = 'suspended' }
  async resume() { this.resumes++; this.state = 'running' }
}

describe('lifecycle: fade-then-suspend (2.8#4)', () => {
  const events: string[] = []
  beforeEach(() => {
    vi.useFakeTimers()
    events.length = 0
    vi.stubGlobal('window', { AudioContext: FakeCtx, dispatchEvent: (e: Event) => events.push(e.type) })
    vi.resetModules()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('announces pause first, suspends only after the fade window, resumes at once', async () => {
    const lc = await import('./lifecycle')
    lc.trackAudioContexts()
    const ctx = new (window as unknown as { AudioContext: new () => FakeCtx }).AudioContext()
    lc.setBackgrounded(true)
    expect(events).toEqual(['sp:app-pause'])
    expect(ctx.suspends).toBe(0)
    await vi.advanceTimersByTimeAsync(lc.SUSPEND_FADE_MS + 5)
    expect(ctx.suspends).toBe(1)
    lc.setBackgrounded(false)
    expect(events.at(-1)).toBe('sp:app-resume')
    expect(ctx.resumes).toBe(1)
  })

  it('a quick return cancels the pending suspension', async () => {
    const lc = await import('./lifecycle')
    lc.trackAudioContexts()
    const ctx = new (window as unknown as { AudioContext: new () => FakeCtx }).AudioContext()
    lc.setBackgrounded(true)
    lc.setBackgrounded(false)
    await vi.advanceTimersByTimeAsync(lc.SUSPEND_FADE_MS * 2)
    expect(ctx.suspends).toBe(0)
  })
})
