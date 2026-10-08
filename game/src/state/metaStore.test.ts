import { describe, expect, it } from 'vitest'
import { META_KEY, META_QUARANTINE_KEY, MemoryKV, MetaStore, sanitizeRecords } from './metaStore'
import type { HallOfFameEntry } from '../sim/game/hallOfFame'

const entry = (id: string, score: number) => ({ careerId: id, legacyScore: score }) as unknown as HallOfFameEntry

describe('MetaStore tamper protection (local records)', () => {
  it('seals on write and reads back clean', () => {
    const kv = new MemoryKV()
    const a = new MetaStore(kv)
    a.addHallOfFame(entry('c1', 120))
    a.update((d) => { d.local.bests.goalsMatch = 4 })
    const b = new MetaStore(kv)
    expect(b.read().hallOfFame).toHaveLength(1)
    expect(b.integrity).toBe('ok')
    expect(JSON.parse(kv.getItem(META_KEY)!).seal).toMatch(/^[0-9a-f]{8}:/)
  })

  it('a hand-edited blob (score changed, seal kept) resets the records and is quarantined', () => {
    const kv = new MemoryKV()
    const a = new MetaStore(kv)
    a.addHallOfFame(entry('c1', 120))
    a.update((d) => { d.achievements.counters = { ...d.achievements.counters } })
    const raw = JSON.parse(kv.getItem(META_KEY)!)
    raw.hallOfFame[0].legacyScore = 99999
    kv.setItem(META_KEY, JSON.stringify(raw))
    const b = new MetaStore(kv)
    const d = b.read()
    expect(b.integrity).toBe('tampered')
    expect(d.hallOfFame).toEqual([])
    expect(d.local.bests.matches).toBe(0)
    expect(kv.getItem(META_QUARANTINE_KEY)).toContain('99999')
    // The next write re-seals a clean store.
    b.write(d)
    expect(new MetaStore(kv).integrity).toBe('ok')
  })

  it('legacy unsealed blobs are accepted and get sealed on the next write', () => {
    const kv = new MemoryKV()
    kv.setItem(META_KEY, JSON.stringify({ version: 1, hallOfFame: [entry('old', 50)] }))
    const s = new MetaStore(kv)
    expect(s.read().hallOfFame).toHaveLength(1)
    expect(s.integrity).toBe('unsealed')
    s.update(() => undefined)
    expect(new MetaStore(kv).integrity).toBe('ok')
  })

  it('implausible records are dropped even in an unsealed blob', () => {
    const kv = new MemoryKV()
    kv.setItem(META_KEY, JSON.stringify({ version: 1, hallOfFame: [entry('x', 1e12), entry('ok', 80), null], local: { bests: { goalsMatch: 400, bestRating: -3 } } }))
    const s = new MetaStore(kv)
    const d = s.read()
    expect(d.hallOfFame.map((e) => e.careerId)).toEqual(['ok'])
    expect(d.local.bests.goalsMatch).toBe(30)
    expect(d.local.bests.bestRating).toBe(0)
    expect(s.integrity).toBe('implausible')
  })

  it('garbage JSON starts fresh without throwing', () => {
    const kv = new MemoryKV()
    kv.setItem(META_KEY, '{not json')
    expect(new MetaStore(kv).read().hallOfFame).toEqual([])
  })

  it('sanitizeRecords reports false for clean data', () => {
    const s = new MetaStore(new MemoryKV())
    expect(sanitizeRecords(s.read())).toBe(false)
  })
})
