import { describe, expect, it } from 'vitest'
import { MemoryStorage } from '../state/save'
import { FallbackStorage } from './storage'

class BrokenWrites extends MemoryStorage {
  broken = true
  override async set(key: string, value: string) {
    if (this.broken) throw new Error('native write refused')
    return super.set(key, value)
  }
}

describe('FallbackStorage (native files + browser safety net)', () => {
  it('keeps saving when every native write fails', async () => {
    const native = new BrokenWrites()
    const idb = new MemoryStorage()
    const fb = new FallbackStorage(native, idb)
    const failed: string[] = []
    fb.onFallback = (k) => failed.push(k)
    await fb.set('sp.save.0', 'A')
    expect(await fb.get('sp.save.0')).toBe('A')
    expect(await idb.get('sp.save.0')).toBe('A')
    expect(failed).toEqual(['sp.save.0'])
  })

  it('a later successful native write wins and clears the fallback copy', async () => {
    const native = new BrokenWrites()
    const idb = new MemoryStorage()
    const fb = new FallbackStorage(native, idb)
    await fb.set('k', 'old')
    native.broken = false
    await fb.set('k', 'new')
    expect(await idb.get('k')).toBeNull()
    expect(await fb.get('k')).toBe('new')
    await fb.remove('k')
    expect(await fb.get('k')).toBeNull()
  })
})
