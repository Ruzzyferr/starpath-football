import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { _resetGlRecovery, glLostCount, installGlRecovery } from './glRecovery'
import { setErrorLogEnabled, setErrorLogStore, readErrorLog, clearErrorLog } from '../telemetry/errorLog'

describe('WebGL context loss (2.9#17)', () => {
  const handlers: Record<string, (e: unknown) => void> = {}
  const dispatched: string[] = []
  beforeEach(() => {
    _resetGlRecovery()
    const mem = new Map<string, string>()
    setErrorLogStore({ getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: (k) => void mem.delete(k) })
    setErrorLogEnabled(true)
    vi.stubGlobal('window', { dispatchEvent: (e: Event) => dispatched.push(e.type) })
  })
  afterEach(() => {
    clearErrorLog()
    setErrorLogStore(null)
    vi.unstubAllGlobals()
    dispatched.length = 0
  })

  it('prevents default (so restore is possible), logs and broadcasts', () => {
    installGlRecovery({ addEventListener: (n: string, fn: (e: unknown) => void) => void (handlers[n] = fn) } as never)
    const ev = { preventDefault: vi.fn() }
    handlers.webglcontextlost!(ev)
    expect(ev.preventDefault).toHaveBeenCalled()
    expect(glLostCount()).toBe(1)
    expect(readErrorLog()[0]?.kind).toBe('webgl-lost')
    handlers.webglcontextrestored!({})
    expect(dispatched).toEqual(['sp:gl-lost', 'sp:gl-restored'])
  })
})
