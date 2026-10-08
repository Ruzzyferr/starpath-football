/**
 * Global meta storage (WP-7): achievements and the Hall of Fame live OUTSIDE
 * the save slots under one key, so deleting / overwriting a career never
 * erases them. Backed by localStorage (web, Electron and Capacitor web views)
 * with an in-memory fallback (tests, private mode, quota errors).
 */
import { emptyAchStore, type AchStore } from '../sim/game/achievements'
import type { HallOfFameEntry } from '../sim/game/hallOfFame'
import { emptyLocalMeta, type LocalMeta } from '../sim/game/localMeta'
import { checksum } from './save'

export const META_KEY = 'starpath.meta.v1'
/** Hall of Fame cap (oldest low scores are dropped first). */
export const HOF_MAX = 50
const SEAL_SALT = 'starpath.meta.seal.v1'
/** Where a blob that failed its seal is parked for inspection (never read back by the game). */
export const META_QUARANTINE_KEY = 'starpath.meta.v1.quarantine'

/** Result of the last {@link MetaStore.read} integrity check. */
export type MetaIntegrity = 'ok' | 'unsealed' | 'tampered' | 'implausible'

/** Plausibility bounds for local records: a hand-edited Hall of Fame can't show absurd numbers. */
const BEST_LIMITS = { bestRating: 10, goalsMatch: 30, assistsMatch: 30, biggestWin: 30, matches: 100_000 } as const
const MAX_LEGACY = 100_000

export function sealOf(payload: unknown): string {
  return checksum(JSON.stringify(payload) + SEAL_SALT)
}

/** Drop implausible local records in place; returns true when anything had to be fixed. */
export function sanitizeRecords(d: MetaData): boolean {
  let fixed = false
  const hof = d.hallOfFame.filter((e) => {
    const ok = !!e && typeof e === 'object' && Number.isFinite(e.legacyScore) && e.legacyScore >= 0 && e.legacyScore <= MAX_LEGACY && typeof e.careerId === 'string'
    if (!ok) fixed = true
    return ok
  })
  d.hallOfFame = hof
  const b = d.local.bests as unknown as Record<string, number>
  for (const [k, max] of Object.entries(BEST_LIMITS)) {
    const v = b[k]
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > max) {
      b[k] = typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : 0
      fixed = true
    }
  }
  return fixed
}

export interface MetaData {
  version: 1
  achievements: AchStore
  hallOfFame: HallOfFameEntry[]
  /** Weekly challenges, personal bests, What's New marker (local-first, GAP 2.10). */
  local: LocalMeta
}

export interface KeyValue {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

class MemoryKV implements KeyValue {
  private m = new Map<string, string>()
  getItem(k: string): string | null {
    return this.m.get(k) ?? null
  }
  setItem(k: string, v: string): void {
    this.m.set(k, v)
  }
  removeItem(k: string): void {
    this.m.delete(k)
  }
}

const emptyMeta = (): MetaData => ({ version: 1, achievements: emptyAchStore(), hallOfFame: [], local: emptyLocalMeta() })

function defaultKV(): KeyValue {
  try {
    const ls = globalThis.localStorage
    if (ls) {
      const probe = '__sp_probe__'
      ls.setItem(probe, '1')
      ls.removeItem(probe)
      return ls
    }
  } catch {
    /* unavailable */
  }
  return new MemoryKV()
}

export class MetaStore {
  private kv: KeyValue
  private cache: MetaData | null = null
  /** Outcome of the last integrity check on the persisted blob. */
  integrity: MetaIntegrity = 'ok'

  constructor(kv: KeyValue = defaultKV()) {
    this.kv = kv
  }

  read(): MetaData {
    if (this.cache) return this.cache
    let data = emptyMeta()
    try {
      const raw = this.kv.getItem(META_KEY)
      if (raw) {
        const p = JSON.parse(raw) as Partial<MetaData> & { seal?: string }
        const { seal, ...payload } = p
        this.integrity = seal === undefined ? 'unsealed' : seal === sealOf(payload) ? 'ok' : 'tampered'
        data = {
          version: 1,
          achievements: { ...emptyAchStore(), ...(p.achievements ?? {}) },
          hallOfFame: Array.isArray(p.hallOfFame) ? p.hallOfFame : [],
          local: { ...emptyLocalMeta(), ...(p.local ?? {}), bests: { ...emptyLocalMeta().bests, ...(p.local?.bests ?? {}) } },
        }
        data.achievements.counters = { ...emptyAchStore().counters, ...(p.achievements?.counters ?? {}) }
        if (this.integrity === 'tampered') {
          // Records (Hall of Fame, personal bests, streaks) restart from scratch; achievements are cosmetic and kept.
          try { this.kv.setItem(META_QUARANTINE_KEY, raw) } catch { /* ignore */ }
          data.hallOfFame = []
          data.local = { ...emptyLocalMeta(), seenVersion: data.local.seenVersion }
        } else if (sanitizeRecords(data)) this.integrity = 'implausible'
      }
    } catch {
      /* corrupt → start fresh */
    }
    this.cache = data
    return data
  }

  write(data: MetaData): void {
    this.cache = data
    try {
      this.kv.setItem(META_KEY, JSON.stringify({ ...data, seal: sealOf(data) }))
    } catch (e) {
      console.warn('[StarPath] could not persist meta data', e)
    }
  }

  update(fn: (d: MetaData) => void): MetaData {
    const d = this.read()
    fn(d)
    this.write(d)
    return d
  }

  /** Add (or replace by careerId) a Hall of Fame entry; keeps the best {@link HOF_MAX}. */
  addHallOfFame(entry: HallOfFameEntry): MetaData {
    return this.update((d) => {
      const rest = d.hallOfFame.filter((e) => e.careerId !== entry.careerId)
      d.hallOfFame = [...rest, entry].sort((a, b) => b.legacyScore - a.legacyScore).slice(0, HOF_MAX)
    })
  }

  /** Wipe everything (Settings → reset meta; tests). */
  clear(): void {
    this.cache = null
    this.integrity = 'ok'
    try {
      this.kv.removeItem(META_QUARANTINE_KEY)
      this.kv.removeItem(META_KEY)
    } catch {
      /* ignore */
    }
  }
}

export { MemoryKV }
