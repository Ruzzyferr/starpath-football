/**
 * Global meta storage (WP-7): achievements and the Hall of Fame live OUTSIDE
 * the save slots under one key, so deleting / overwriting a career never
 * erases them. Backed by localStorage (web, Electron and Capacitor web views)
 * with an in-memory fallback (tests, private mode, quota errors).
 */
import { emptyAchStore, type AchStore } from '../sim/game/achievements'
import type { HallOfFameEntry } from '../sim/game/hallOfFame'
import { emptyLocalMeta, type LocalMeta } from '../sim/game/localMeta'

export const META_KEY = 'starpath.meta.v1'
/** Hall of Fame cap (oldest low scores are dropped first). */
export const HOF_MAX = 50

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

  constructor(kv: KeyValue = defaultKV()) {
    this.kv = kv
  }

  read(): MetaData {
    if (this.cache) return this.cache
    let data = emptyMeta()
    try {
      const raw = this.kv.getItem(META_KEY)
      if (raw) {
        const p = JSON.parse(raw) as Partial<MetaData>
        data = {
          version: 1,
          achievements: { ...emptyAchStore(), ...(p.achievements ?? {}) },
          hallOfFame: Array.isArray(p.hallOfFame) ? p.hallOfFame : [],
          local: { ...emptyLocalMeta(), ...(p.local ?? {}), bests: { ...emptyLocalMeta().bests, ...(p.local?.bests ?? {}) } },
        }
        data.achievements.counters = { ...emptyAchStore().counters, ...(p.achievements?.counters ?? {}) }
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
      this.kv.setItem(META_KEY, JSON.stringify(data))
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
    try {
      this.kv.removeItem(META_KEY)
    } catch {
      /* ignore */
    }
  }
}

export { MemoryKV }
