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
