/**
 * Crash-safe save system.
 *
 * NSS players frequently lost careers to corrupted saves. Every write here is:
 *  1. serialized + checksummed into an envelope,
 *  2. written to a staging key, read back and verified,
 *  3. only then promoted to the live key, while the previous live save is
 *     rotated into a ring of backups.
 * Loading verifies the checksum and falls back to the newest valid backup.
 * Envelopes carry a schema version and run through `migrate()` on load.
 */
import { SAVE_VERSION } from '../core/config'
import type { GameState } from '../core/types'

export const SLOT_COUNT = 3
export const BACKUP_COUNT = 3

/** Minimal async key-value store. Implemented by IndexedDB, Capacitor Filesystem, or memory (tests). */
export interface SaveStorage {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}

export interface SaveEnvelope {
  version: number
  savedAt: number
  checksum: string
  summary: SaveSummary
  data: string
}

/** Lightweight info shown on the save-slot screen without parsing the whole state. */
export interface SaveSummary {
  heroName: string
  clubName: string
  season: number
  week: number
  ovr: number
  money: number
  playTimeSec: number
}

export type LoadResult =
  | { ok: true; state: GameState; recoveredFromBackup: number | null }
  | { ok: false; reason: 'empty' | 'corrupt' }

const liveKey = (slot: number) => `sp.save.${slot}`
const stagingKey = (slot: number) => `sp.save.${slot}.staging`
const backupKey = (slot: number, i: number) => `sp.save.${slot}.bak${i}`

/** FNV-1a 32-bit over the UTF-16 code units, hex encoded. Detects truncation / bit rot. */
export function checksum(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0') + ':' + text.length.toString(36)
}

export function buildEnvelope(state: GameState, summary: SaveSummary, now = Date.now()): SaveEnvelope {
  const data = JSON.stringify(state)
  return { version: SAVE_VERSION, savedAt: now, checksum: checksum(data), summary, data }
}

/** Parse + verify an envelope. Returns null when anything is off. */
export function openEnvelope(raw: string | null): { env: SaveEnvelope; state: GameState } | null {
  if (!raw) return null
  try {
    const env = JSON.parse(raw) as SaveEnvelope
    if (typeof env.data !== 'string' || checksum(env.data) !== env.checksum) return null
    const state = migrate(JSON.parse(env.data), env.version)
    return state ? { env, state } : null
  } catch {
    return null
  }
}

type Migration = (s: any) => any
/** MIGRATIONS[v] upgrades a save from version v to v+1. */
const MIGRATIONS: Record<number, Migration> = {}

export function migrate(raw: any, fromVersion: number): GameState | null {
  if (!raw || typeof raw !== 'object') return null
  if (fromVersion > SAVE_VERSION) return null // save from a newer build
  let s = raw
  for (let v = fromVersion; v < SAVE_VERSION; v++) {
    const m = MIGRATIONS[v]
    if (!m) return null
    s = m(s)
  }
  s.version = SAVE_VERSION
  return s as GameState
}

export class SaveManager {
  constructor(private readonly storage: SaveStorage) {}

  /** Atomically write a slot, rotating the previous live save into backups. */
  async save(slot: number, state: GameState, summary: SaveSummary): Promise<void> {
    const env = buildEnvelope(state, summary)
    const raw = JSON.stringify(env)
    await this.storage.set(stagingKey(slot), raw)
    const verify = await this.storage.get(stagingKey(slot))
    if (verify !== raw || !openEnvelope(verify)) throw new Error('Save verification failed')

    const previous = await this.storage.get(liveKey(slot))
    if (previous && openEnvelope(previous)) {
      for (let i = BACKUP_COUNT - 1; i > 0; i--) {
        const older = await this.storage.get(backupKey(slot, i - 1))
        if (older) await this.storage.set(backupKey(slot, i), older)
      }
      await this.storage.set(backupKey(slot, 0), previous)
    }
    await this.storage.set(liveKey(slot), raw)
    await this.storage.remove(stagingKey(slot))
  }

  /** Load a slot, falling back through backups (and an interrupted staging write) if needed. */
  async load(slot: number): Promise<LoadResult> {
    const live = await this.storage.get(liveKey(slot))
    const opened = openEnvelope(live)
    if (opened) return { ok: true, state: opened.state, recoveredFromBackup: null }

    // A crash between staging and promotion leaves a valid staging copy.
    const staged = openEnvelope(await this.storage.get(stagingKey(slot)))
    if (staged) return { ok: true, state: staged.state, recoveredFromBackup: -1 }

    for (let i = 0; i < BACKUP_COUNT; i++) {
      const b = openEnvelope(await this.storage.get(backupKey(slot, i)))
      if (b) return { ok: true, state: b.state, recoveredFromBackup: i }
    }
    return { ok: false, reason: live ? 'corrupt' : 'empty' }
  }

  async summaries(): Promise<(SaveSummary & { savedAt: number } | null)[]> {
    const out: (SaveSummary & { savedAt: number } | null)[] = []
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      const o = openEnvelope(await this.storage.get(liveKey(slot)))
      out.push(o ? { ...o.env.summary, savedAt: o.env.savedAt } : null)
    }
    return out
  }

  async remove(slot: number): Promise<void> {
    await this.storage.remove(liveKey(slot))
    await this.storage.remove(stagingKey(slot))
    for (let i = 0; i < BACKUP_COUNT; i++) await this.storage.remove(backupKey(slot, i))
  }

  /** Portable export (the raw envelope) for manual backup / moving devices. */
  async exportSlot(slot: number): Promise<string | null> {
    const live = await this.storage.get(liveKey(slot))
    return openEnvelope(live) ? live : null
  }

  async importSlot(slot: number, raw: string): Promise<boolean> {
    const o = openEnvelope(raw)
    if (!o) return false
    await this.save(slot, o.state, o.env.summary)
    return true
  }
}

/** In-memory storage for tests and as a last-resort fallback. */
export class MemoryStorage implements SaveStorage {
  readonly map = new Map<string, string>()
  async get(key: string) {
    return this.map.get(key) ?? null
  }
  async set(key: string, value: string) {
    this.map.set(key, value)
  }
  async remove(key: string) {
    this.map.delete(key)
  }
}

/** IndexedDB-backed storage (browser, Capacitor WebView, Electron). Falls back to localStorage. */
export class IdbStorage implements SaveStorage {
  private dbp: Promise<IDBDatabase> | null = null

  private db(): Promise<IDBDatabase> {
    this.dbp ??= new Promise((resolve, reject) => {
      const req = indexedDB.open('starpath', 1)
      req.onupgradeneeded = () => req.result.createObjectStore('kv')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    return this.dbp
  }

  private async tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
    const db = await this.db()
    return new Promise<T>((resolve, reject) => {
      const t = db.transaction('kv', mode)
      const req = fn(t.objectStore('kv'))
      t.oncomplete = () => resolve(req.result as T)
      t.onerror = () => reject(t.error)
      t.onabort = () => reject(t.error)
    })
  }

  async get(key: string) {
    try {
      return ((await this.tx<string | undefined>('readonly', (s) => s.get(key))) ?? null)
    } catch {
      return localStorage.getItem(key)
    }
  }
  async set(key: string, value: string) {
    try {
      await this.tx('readwrite', (s) => s.put(value, key))
    } catch {
      localStorage.setItem(key, value)
    }
  }
  async remove(key: string) {
    try {
      await this.tx('readwrite', (s) => s.delete(key))
    } catch {
      localStorage.removeItem(key)
    }
  }
}

export function defaultStorage(): SaveStorage {
  return typeof indexedDB !== 'undefined' ? new IdbStorage() : new MemoryStorage()
}
