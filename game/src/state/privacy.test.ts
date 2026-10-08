import { describe, expect, it } from 'vitest'
import { buildDataExport, localKeys, wipeKeys, type KvLike } from './privacy'

function kv(init: Record<string, string>): KvLike & { dump(): Record<string, string> } {
  const m = new Map(Object.entries(init))
  return {
    get length() { return m.size },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => m.get(k) ?? null,
    removeItem: (k) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  }
}

describe('local data export / delete', () => {
  const seed = { 'starpath.settings.v1': '{"lang":"en"}', 'starpath.meta.v1': '{}', 'sp.errorlog': '[]', 'other.app': 'keep' }

  it('finds only game-owned keys', () => {
    expect(localKeys(kv(seed)).sort()).toEqual(['sp.errorlog', 'starpath.meta.v1', 'starpath.settings.v1'])
  })

  it('exports keys and saves in one document, leaving foreign keys out', () => {
    const e = buildDataExport(kv(seed), { slot1: '{"v":1}' }, new Date('2026-01-02T03:04:05Z'))
    expect(e.exportedAt).toBe('2026-01-02T03:04:05.000Z')
    expect(Object.keys(e.keys).sort()).toEqual(['sp.errorlog', 'starpath.meta.v1', 'starpath.settings.v1'])
    expect(e.saves.slot1).toBe('{"v":1}')
    expect(JSON.parse(JSON.stringify(e)).app).toBe('starpath-football')
  })

  it('deletes everything the game owns and nothing else', () => {
    const s = kv(seed)
    expect(wipeKeys(s)).toBe(3)
    expect(s.dump()).toEqual({ 'other.app': 'keep' })
    expect(wipeKeys(s)).toBe(0)
  })
})
