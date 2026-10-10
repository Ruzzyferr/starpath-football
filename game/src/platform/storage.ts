/**
 * Platform SaveStorage helpers. SaveManager (src/state/save.ts) adds checksums,
 * staging + verify and rotating backups on top; the native storages add an
 * atomic single-key write on platforms that have a real filesystem.
 */
import type { SaveStorage } from '../state/save'
import { assertKey } from './keys'
import type { StarpathNativeBridge } from './native.d'

/** Electron: files in app.getPath('userData')/saves, written tmp → fsync → rename by the main process. */
export class ElectronFileStorage implements SaveStorage {
  private readonly bridge: StarpathNativeBridge
  constructor(bridge: StarpathNativeBridge) {
    this.bridge = bridge
  }
  get(key: string) {
    return this.bridge.saves.get(assertKey(key))
  }
  set(key: string, value: string) {
    return this.bridge.saves.set(assertKey(key), value)
  }
  remove(key: string) {
    return this.bridge.saves.remove(assertKey(key))
  }
}

/** Copy saves that exist in `from` but not in `to` (e.g. IndexedDB saves from an earlier build). Never overwrites. */
export async function migrateMissing(from: SaveStorage, to: SaveStorage, keys: string[]): Promise<number> {
  let n = 0
  for (const k of keys) {
    try {
      if ((await to.get(k)) !== null) continue
      const v = await from.get(k)
      if (v === null) continue
      await to.set(k, v)
      n++
    } catch {
      /* best effort */
    }
  }
  return n
}

/**
 * Native file storage with a browser-storage safety net: when a native write
 * fails (plugin bug, permissions, full disk) the value goes to `fallback`
 * instead of the save failing. Invariant: `fallback` holds a key only while its
 * newest write went there, so get() reads the fallback first and a successful
 * native write clears the fallback copy.
 */
export class FallbackStorage implements SaveStorage {
  /** Called once per key the first time a native write falls back (diagnostics). */
  onFallback: ((key: string, error: unknown) => void) | null = null

  private readonly primary: SaveStorage
  private readonly fallback: SaveStorage

  constructor(primary: SaveStorage, fallback: SaveStorage) {
    this.primary = primary
    this.fallback = fallback
  }

  async get(key: string): Promise<string | null> {
    const f = await this.fallback.get(key).catch(() => null)
    if (f !== null) return f
    return this.primary.get(key)
  }

  async set(key: string, value: string): Promise<void> {
    try {
      await this.primary.set(key, value)
    } catch (e) {
      await this.fallback.set(key, value)
      try { this.onFallback?.(key, e) } catch { /* ignore */ }
      return
    }
    await this.fallback.remove(key).catch(() => undefined)
  }

  async remove(key: string): Promise<void> {
    await this.fallback.remove(key).catch(() => undefined)
    await this.primary.remove(key)
  }
}
