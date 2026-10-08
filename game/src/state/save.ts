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
import type { CrestSpec, GameState } from '../core/types'

export const SLOT_COUNT = 3
export const BACKUP_COUNT = 3
/** Season-start milestone copies kept per slot (2.9#42). */
export const MILESTONE_COUNT = 3

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
  /** Club crest for the slot card (optional, newer saves). */
  crest?: CrestSpec
}

export type LoadResult =
  | { ok: true; state: GameState; recoveredFromBackup: number | null }
  | { ok: false; reason: 'empty' | 'corrupt' | 'newer' }

/** Non-fatal conditions the UI should tell the player about. */
export type SaveNotice =
  | { kind: 'backups-skipped'; slot: number }
  | { kind: 'premigrate-backup'; slot: number; fromVersion: number }
  | { kind: 'integrity'; slot: number; problem: 'live-invalid-recovered' | 'live-invalid' | 'newer-version' }

const liveKey = (slot: number) => `sp.save.${slot}`
const stagingKey = (slot: number) => `sp.save.${slot}.staging`
const backupKey = (slot: number, i: number) => `sp.save.${slot}.bak${i}`
/** Verbatim copy of the envelope as it was before an older-schema save was migrated. */
const premigrateKey = (slot: number) => `sp.save.${slot}.premigrate`
/** One verified copy per season (the first save seen in that season); the manifest lists the seasons held. */
const milestoneKey = (slot: number, season: number) => `sp.save.${slot}.ms.${season}`
const milestoneManifestKey = (slot: number) => `sp.save.${slot}.ms`

/** Envelope whose checksum is valid but which was written by a newer build (cannot be read here). */
export function isNewerEnvelope(raw: string | null): boolean {
  if (!raw) return false
  try {
    const env = JSON.parse(raw) as SaveEnvelope
    return typeof env.data === 'string' && checksum(env.data) === env.checksum && env.version > SAVE_VERSION
  } catch {
    return false
  }
}

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
const MIGRATIONS: Record<number, Migration> = {
  /** v1 → v2: hero gender (old careers are male heroes in men's leagues). */
  1: (s) => {
    if (s.hero && typeof s.hero === 'object' && s.hero.gender !== 'female' && s.hero.gender !== 'male') s.hero.gender = 'male'
    return s
  },
}

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
  private readonly storage: SaveStorage
  /** Set by the UI layer to surface notices (toasts). */
  onNotice: ((n: SaveNotice) => void) | null = null
  /** True after a save had to skip backup rotation because storage is full. */
  degraded = false

  constructor(storage: SaveStorage) {
    this.storage = storage
  }

  private notice(n: SaveNotice): void {
    try { this.onNotice?.(n) } catch { /* ignore */ }
  }

  /** Atomically write a slot, rotating the previous live save into backups. */
  async save(slot: number, state: GameState, summary: SaveSummary): Promise<void> {
    const env = buildEnvelope(state, summary)
    const raw = JSON.stringify(env)
    await this.storage.set(stagingKey(slot), raw)
    const verify = await this.storage.get(stagingKey(slot))
    if (verify !== raw || !openEnvelope(verify)) throw new Error('Save verification failed')

    // Backup rotation is best-effort: when storage is full we skip it (never deleting
    // existing backups) and keep going, so the newest data still reaches the live key.
    const previous = await this.storage.get(liveKey(slot))
    let skipped = false
    if (previous && openEnvelope(previous)) {
      try {
        // Rotate oldest-first; a failure part-way leaves a duplicate, never a hole.
        for (let i = BACKUP_COUNT - 1; i > 0; i--) {
          const older = await this.storage.get(backupKey(slot, i - 1))
          if (older) await this.storage.set(backupKey(slot, i), older)
        }
        await this.storage.set(backupKey(slot, 0), previous)
      } catch {
        skipped = true
      }
    }
    // If this throws, the verified staging copy (newer than live) remains and load() prefers it.
    await this.storage.set(liveKey(slot), raw)
    await this.storage.remove(stagingKey(slot)).catch(() => {})
    await this.recordMilestone(slot, summary.season, raw)
    if (skipped && !this.degraded) this.notice({ kind: 'backups-skipped', slot })
    this.degraded = skipped
  }

  /** Load a slot, falling back through backups (and an interrupted staging write) if needed. */
  async load(slot: number): Promise<LoadResult> {
    const live = await this.storage.get(liveKey(slot))
    if (isNewerEnvelope(live)) return { ok: false, reason: 'newer' }
    const opened = openEnvelope(live)
    // A crash (or full storage) between staging and promotion leaves a valid, newer staging copy.
    const staged = openEnvelope(await this.storage.get(stagingKey(slot)))
    if (staged && (!opened || staged.env.savedAt >= opened.env.savedAt)) {
      return { ok: true, state: staged.state, recoveredFromBackup: -1 }
    }
    if (opened) {
      if (opened.env.version < SAVE_VERSION) await this.backupBeforeMigration(slot, live as string, opened.env.version)
      return { ok: true, state: opened.state, recoveredFromBackup: null }
    }

    for (let i = 0; i < BACKUP_COUNT; i++) {
      const b = openEnvelope(await this.storage.get(backupKey(slot, i)))
      if (b) return { ok: true, state: b.state, recoveredFromBackup: i }
    }
    // Last resort: the newest intact season milestone (loses at most a season, beats losing the career).
    for (const season of await this.listMilestones(slot)) {
      const m = openEnvelope(await this.storage.get(milestoneKey(slot, season)))
      if (m) return { ok: true, state: m.state, recoveredFromBackup: BACKUP_COUNT }
    }
    return { ok: false, reason: live ? 'corrupt' : 'empty' }
  }

  private async milestones(slot: number): Promise<number[]> {
    try {
      const a = JSON.parse((await this.storage.get(milestoneManifestKey(slot))) ?? '[]') as unknown
      return Array.isArray(a) ? a.filter((n): n is number => Number.isInteger(n)) : []
    } catch {
      return []
    }
  }

  /** Seasons for which a milestone copy exists, newest first. */
  async listMilestones(slot: number): Promise<number[]> {
    return (await this.milestones(slot)).sort((a, b) => b - a)
  }

  /**
   * First verified save of a season is kept as a milestone, the oldest beyond {@link MILESTONE_COUNT}
   * is pruned. Best-effort: when storage is full the milestone is simply skipped (live save wins).
   */
  private async recordMilestone(slot: number, season: number, raw: string): Promise<void> {
    if (!Number.isInteger(season)) return
    try {
      const seasons = await this.milestones(slot)
      if (seasons.includes(season)) return
      await this.storage.set(milestoneKey(slot, season), raw)
      const next = [...seasons, season].sort((a, b) => a - b)
      const drop = next.splice(0, Math.max(0, next.length - MILESTONE_COUNT))
      await this.storage.set(milestoneManifestKey(slot), JSON.stringify(next))
      for (const s of drop) await this.storage.remove(milestoneKey(slot, s))
    } catch { /* quota: skip */ }
  }

  /** Restore a milestone copy into the live slot (returns false when it is missing or damaged). */
  async restoreMilestone(slot: number, season: number): Promise<boolean> {
    const raw = await this.storage.get(milestoneKey(slot, season))
    if (!raw || !openEnvelope(raw)) return false
    await this.storage.set(liveKey(slot), raw)
    return true
  }

  /** Keep the untouched pre-migration envelope under its own key (first one per version wins). Best-effort. */
  private async backupBeforeMigration(slot: number, raw: string, fromVersion: number): Promise<void> {
    try {
      const existing = await this.storage.get(premigrateKey(slot))
      if (existing) {
        const e = JSON.parse(existing) as SaveEnvelope
        if (e.version <= fromVersion && checksum(e.data) === e.checksum) return
      }
      await this.storage.set(premigrateKey(slot), raw)
      this.notice({ kind: 'premigrate-backup', slot, fromVersion })
    } catch { /* storage full: the original live envelope is untouched anyway */ }
  }

  /** Restore the pre-migration backup into the live slot (returns false when none). */
  async restorePremigrate(slot: number): Promise<boolean> {
    const raw = await this.storage.get(premigrateKey(slot))
    if (!raw || !openEnvelope(raw)) return false
    await this.storage.set(liveKey(slot), raw)
    return true
  }

  /**
   * Check every slot: live must verify, or a backup must. Emits notices for problems and returns them.
   * Meant to run once per launch (and occasionally while idle).
   */
  async checkIntegrity(): Promise<Extract<SaveNotice, { kind: 'integrity' }>[]> {
    const out: Extract<SaveNotice, { kind: 'integrity' }>[] = []
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      const live = await this.storage.get(liveKey(slot))
      if (!live || openEnvelope(live)) continue
      let problem: 'live-invalid-recovered' | 'live-invalid' | 'newer-version' = 'live-invalid'
      if (isNewerEnvelope(live)) problem = 'newer-version'
      else {
        for (let i = 0; i < BACKUP_COUNT && problem === 'live-invalid'; i++) {
          if (openEnvelope(await this.storage.get(backupKey(slot, i)))) problem = 'live-invalid-recovered'
        }
      }
      out.push({ kind: 'integrity', slot, problem })
    }
    for (const n of out) this.notice(n)
    return out
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
    await this.storage.remove(premigrateKey(slot))
    for (let i = 0; i < BACKUP_COUNT; i++) await this.storage.remove(backupKey(slot, i))
    for (const season of await this.milestones(slot)) await this.storage.remove(milestoneKey(slot, season))
    await this.storage.remove(milestoneManifestKey(slot))
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

// ── localStorage fallback ──
// A career save is ~2 MB of JSON and the manager keeps live + staging + backups,
// which overflows the ~5 M-char localStorage quota after the second save. The
// fallback therefore gzips values (CompressionStream, ~10x smaller) and, if the
// quota is still hit the write fails and SaveManager skips extra backups (it never deletes them).

const GZ = 'gz1:'

async function gzipB64(text: string): Promise<string | null> {
  if (typeof CompressionStream === 'undefined') return null
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer())
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return GZ + btoa(bin)
}

async function gunzipB64(packed: string): Promise<string> {
  const bin = atob(packed.slice(GZ.length))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).text()
}

async function lsGet(key: string): Promise<string | null> {
  const v = localStorage.getItem(key)
  if (v === null || !v.startsWith(GZ)) return v
  try {
    return await gunzipB64(v)
  } catch {
    return null
  }
}

async function lsSet(key: string, value: string): Promise<void> {
  const v = (await gzipB64(value).catch(() => null)) ?? value
  // Quota errors propagate: SaveManager degrades (skips backup rotation) but never deletes existing backups.
  localStorage.setItem(key, v)
}

/** IndexedDB-backed storage (browser, Capacitor WebView, Electron). Falls back to (compressed) localStorage. */
export class IdbStorage implements SaveStorage {
  private dbp: Promise<IDBDatabase> | null = null

  private db(): Promise<IDBDatabase> {
    this.dbp ??= new Promise<IDBDatabase>((resolve, reject) => {
      // Some WebViews / headless shells never answer the open request: give up after 4 s
      // so callers fall back to localStorage instead of hanging forever.
      const timer = setTimeout(() => {
        this.dbp = null // retry on the next call
        reject(new Error('IndexedDB open timed out'))
      }, 4000)
      const req = indexedDB.open('starpath', 1)
      req.onupgradeneeded = () => req.result.createObjectStore('kv')
      req.onsuccess = () => { clearTimeout(timer); resolve(req.result) }
      req.onerror = () => { clearTimeout(timer); reject(req.error) }
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
      return lsGet(key)
    }
  }
  async set(key: string, value: string) {
    try {
      await this.tx('readwrite', (s) => s.put(value, key))
    } catch {
      await lsSet(key, value)
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
