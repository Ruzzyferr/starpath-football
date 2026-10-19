/**
 * Local data rights (GDPR-style, 2.12 privacy): "export everything I have stored" and
 * "delete everything". The career never leaves the device; the optional anonymous shop account lives on our server (delete it with DELETE /v1/account). Local data is:
 * save slots (IndexedDB / files), settings, key bindings, achievements and Hall of Fame,
 * entitlements cache, the opt-in error log and the offline cache.
 */
export const LOCAL_KEY_PREFIXES = ['starpath.', 'sp.'] as const

export interface KvLike {
  readonly length: number
  key(i: number): string | null
  getItem(k: string): string | null
  removeItem(k: string): void
}

/** Every game-owned key currently present in the key-value store. */
export function localKeys(kv: KvLike): string[] {
  const out: string[] = []
  for (let i = 0; i < kv.length; i++) {
    const k = kv.key(i)
    if (k && LOCAL_KEY_PREFIXES.some((p) => k.startsWith(p))) out.push(k)
  }
  return out
}

export interface DataExport {
  app: 'starpath-football'
  exportedAt: string
  note: string
  keys: Record<string, string>
  saves: Record<string, string>
}

/** One JSON document with all stored data. `saves` maps a slot name to its raw save envelope. */
export function buildDataExport(kv: KvLike, saves: Record<string, string>, now = new Date()): DataExport {
  const keys: Record<string, string> = {}
  for (const k of localKeys(kv)) {
    const v = kv.getItem(k)
    if (v !== null) keys[k] = v
  }
  return { app: 'starpath-football', exportedAt: now.toISOString(), note: 'All data the game stores on this device. The career is never sent to a server.', keys, saves }
}

/** Remove every game-owned key; returns how many were removed. */
export function wipeKeys(kv: KvLike): number {
  const keys = localKeys(kv)
  for (const k of keys) kv.removeItem(k)
  return keys.length
}

/** Browser-side wipe: key-value store, Cache Storage (offline copy) and service worker registrations. */
export async function wipeLocalData(): Promise<{ keys: number; caches: number }> {
  let keys = 0
  let cacheCount = 0
  try {
    if (typeof localStorage !== 'undefined') keys = wipeKeys(localStorage)
  } catch { /* storage unavailable */ }
  try {
    if (typeof caches !== 'undefined') {
      for (const name of await caches.keys()) if (await caches.delete(name)) cacheCount++
    }
    if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
      for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister()
    }
  } catch { /* best effort */ }
  return { keys, caches: cacheCount }
}
