import { MAX_ENTRIES, buildErrorReport, readErrorLog, recordError, setErrorLogEnabled, setErrorLogStore } from './errorLog'

function memStore() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
}

describe('errorLog', () => {
  beforeEach(() => setErrorLogStore(memStore()))

  it('records nothing until the player opts in', () => {
    recordError(new Error('x'))
    expect(readErrorLog()).toEqual([])
    setErrorLogEnabled(true)
    recordError(new Error('boom'))
    expect(readErrorLog()).toHaveLength(1)
    expect(readErrorLog()[0]!.message).toBe('boom')
  })

  it('keeps only the last 20 entries', () => {
    setErrorLogEnabled(true)
    for (let i = 0; i < 30; i++) recordError(new Error('e' + i))
    const log = readErrorLog()
    expect(log).toHaveLength(MAX_ENTRIES)
    expect(log[MAX_ENTRIES - 1]!.message).toBe('e29')
  })

  it('opting out clears the log; report includes the version header', () => {
    setErrorLogEnabled(true)
    recordError('str')
    setErrorLogEnabled(false)
    expect(readErrorLog()).toEqual([])
    expect(buildErrorReport()).toMatch(/Kickborn /)
  })
})
