/**
 * Save manager + autosave scheduling (TestFlight build 4: "autosave must work, manual save is broken").
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryStorage, type SaveStorage } from '../../state/save'
import { installBackend } from '../store'
import { DEFAULT_CAREER } from './index'
import {
  autosaveEnabled, flushAutosave, installAutosaveTriggers, isDirty, markDirty, refreshSlots, saveStatus,
  scheduleAutosave, setAutosaveSource, slotInfos, useStorage,
} from './persistence'
import { quickResolveAll } from './benchPath'
import { realActions as A } from './realActions'
import { realData as D } from './realData'

/** MemoryStorage that counts live-slot writes and can be told to fail. */
class CountingStorage extends MemoryStorage {
  liveWrites = 0
  failNext = 0
  override async set(key: string, value: string) {
    if (this.failNext > 0) {
      this.failNext--
      throw new Error('disk busy')
    }
    if (/^sp\.save\.\d$/.test(key)) this.liveWrites++
    return super.set(key, value)
  }
}

class FakeWindow extends EventTarget {}

let store: CountingStorage
let autosaveOn = true

describe('autosave scheduling', () => {
  beforeAll(() => {
    vi.useFakeTimers()
    ;(globalThis as { window?: unknown }).window = new FakeWindow()
    installBackend({ actions: A, data: D })
    setAutosaveSource(() => autosaveOn)
    installAutosaveTriggers()
  })
  afterAll(() => {
    vi.useRealTimers()
    delete (globalThis as { window?: unknown }).window
  })
  beforeEach(async () => {
    autosaveOn = true
    store = new CountingStorage()
    useStorage(store)
    await refreshSlots()
    A.newGame({ ...DEFAULT_CAREER, seed: 99 })
    await flushAutosave()
    await vi.runAllTimersAsync()
    store.liveWrites = 0
  })

  it('debounces bursts into one save of the active slot', async () => {
    scheduleAutosave()
    scheduleAutosave()
    scheduleAutosave()
    expect(store.liveWrites).toBe(0)
    await vi.advanceTimersByTimeAsync(1300)
    await flushAutosave()
    expect(store.liveWrites).toBe(1)
    expect(saveStatus.value).toMatchObject({ phase: 'saved', kind: 'auto' })
    expect(isDirty()).toBe(false)
  })

  it('advancing time autosaves without any manual action', async () => {
    expect(D.saveSlots()[0]!.empty).toBe(false)
    quickResolveAll()
    A.advance()
    await vi.advanceTimersByTimeAsync(5000)
    await flushAutosave()
    expect(store.liveWrites).toBeGreaterThanOrEqual(1)
  })

  it('respects the Settings toggle (off = no autosave, manual save still works)', async () => {
    autosaveOn = false
    expect(autosaveEnabled()).toBe(false)
    scheduleAutosave()
    await vi.advanceTimersByTimeAsync(5000)
    await flushAutosave(true)
    expect(store.liveWrites).toBe(0)
    await A.save(1)
    expect(store.liveWrites).toBe(1)
  })

  it('app background (sp:app-pause) saves unsaved changes at once', async () => {
    markDirty()
    window.dispatchEvent(new Event('sp:app-pause'))
    await vi.advanceTimersByTimeAsync(0)
    await flushAutosave()
    expect(store.liveWrites).toBe(1)
    // Nothing new: a second background event does not write again.
    window.dispatchEvent(new Event('sp:app-pause'))
    await flushAutosave()
    expect(store.liveWrites).toBe(1)
  })

  it('pagehide flushes a pending debounced autosave immediately', async () => {
    scheduleAutosave(60_000)
    window.dispatchEvent(new Event('pagehide'))
    await flushAutosave()
    expect(store.liveWrites).toBe(1)
  })

  it('retries a failed autosave with backoff', async () => {
    store.failNext = 1
    scheduleAutosave()
    await vi.advanceTimersByTimeAsync(1300)
    await flushAutosave() // the failing attempt (WebCrypto hashing runs on the real clock)
    expect(store.liveWrites).toBe(0)
    expect(store.failNext).toBe(0)
    // The retry fires on its own after the backoff.
    await vi.waitFor(async () => {
      await vi.advanceTimersByTimeAsync(1000)
      await flushAutosave()
      expect(store.liveWrites).toBe(1)
    }, { timeout: 10_000, interval: 20 })
    expect(saveStatus.value.phase).toBe('saved')
  })

  it('a failed manual save rejects (the UI shows the reason) and reports an error status', async () => {
    store.failNext = 1
    await expect(A.save(2)).rejects.toThrow('disk busy')
    expect(saveStatus.value).toMatchObject({ phase: 'error', kind: 'manual', error: 'disk busy' })
    await A.save(2)
    await refreshSlots()
    expect(slotInfos.value[1]!.empty).toBe(false)
  })

  it('manual save → load restores the saved state', async () => {
    quickResolveAll()
    A.advance()
    await A.save(3)
    const saved = D.saveSlots()[2]!
    expect(saved.empty).toBe(false)
    A.advance()
    expect(await A.load(3)).toBe(true)
    await refreshSlots()
    expect(slotInfos.value[2]!.heroName).toBe(saved.heroName)
    expect(slotInfos.value[2]!.week).toBe(saved.week)
  })

  it('a slot listing from a replaced storage never overwrites the new one', async () => {
    const slow: SaveStorage = { get: () => new Promise(() => {}), set: async () => {}, remove: async () => {} }
    useStorage(slow)
    void refreshSlots() // hangs forever on the old storage
    useStorage(store)
    const infos = await refreshSlots()
    expect(infos[0]!.empty).toBe(false)
  })
})
