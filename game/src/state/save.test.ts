import { MemoryStorage, SaveManager, checksum, openEnvelope } from './save'
import type { GameState } from '../core/types'

const summary = { heroName: 'Test', clubName: 'FC', season: 2026, week: 1, ovr: 50, money: 0, playTimeSec: 0 }
const fakeState = (n: number) => ({ version: 1, marker: n }) as unknown as GameState

describe('SaveManager', () => {
  it('round-trips a save', async () => {
    const m = new SaveManager(new MemoryStorage())
    await m.save(0, fakeState(1), summary)
    const r = await m.load(0)
    expect(r.ok && (r.state as any).marker).toBe(1)
  })

  it('reports empty slots', async () => {
    const r = await new SaveManager(new MemoryStorage()).load(2)
    expect(r).toEqual({ ok: false, reason: 'empty' })
  })

  it('falls back to the newest backup when the live save is corrupt', async () => {
    const st = new MemoryStorage()
    const m = new SaveManager(st)
    await m.save(0, fakeState(1), summary)
    await m.save(0, fakeState(2), summary)
    await m.save(0, fakeState(3), summary)
    st.map.set('sp.save.0', st.map.get('sp.save.0')!.slice(0, 50)) // truncated write
    const r = await m.load(0)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect((r.state as any).marker).toBe(2)
      expect(r.recoveredFromBackup).toBe(0)
    }
  })

  it('keeps at most BACKUP_COUNT backups, newest first', async () => {
    const st = new MemoryStorage()
    const m = new SaveManager(st)
    for (let i = 1; i <= 6; i++) await m.save(1, fakeState(i), summary)
    const markers = [0, 1, 2].map((i) => (openEnvelope(st.map.get(`sp.save.1.bak${i}`)!)!.state as any).marker)
    expect(markers).toEqual([5, 4, 3])
    expect(st.map.has('sp.save.1.bak3')).toBe(false)
  })

  it('detects tampering via checksum', () => {
    expect(checksum('abc')).not.toBe(checksum('abd'))
    expect(openEnvelope('{"data":"{}","checksum":"nope","version":1}')).toBeNull()
  })

  it('rejects saves from a newer game version', () => {
    const data = JSON.stringify({ a: 1 })
    expect(openEnvelope(JSON.stringify({ version: 999, data, checksum: checksum(data) }))).toBeNull()
  })

  it('exports and imports a slot', async () => {
    const m = new SaveManager(new MemoryStorage())
    await m.save(0, fakeState(7), summary)
    const raw = await m.exportSlot(0)
    expect(await m.importSlot(2, raw!)).toBe(true)
    expect(await m.importSlot(1, 'garbage')).toBe(false)
    const r = await m.load(2)
    expect(r.ok && (r.state as any).marker).toBe(7)
  })
})
