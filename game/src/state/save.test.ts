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

describe('save migrations', () => {
  it('v1 saves get a male hero (gender added in v2)', async () => {
    const { migrate } = await import('./save')
    const { SAVE_VERSION } = await import('../core/config')
    const old = { version: 1, hero: { firstName: 'Ali' }, life: {}, world: {}, calendar: {}, meta: {} }
    const s = migrate(JSON.parse(JSON.stringify(old)), 1) as unknown as { version: number; hero: { gender: string } }
    expect(s.version).toBe(SAVE_VERSION)
    expect(s.hero.gender).toBe('male')
  })

  it('keeps a female hero through save → load', async () => {
    const m = new SaveManager(new MemoryStorage())
    const st = { version: 2, hero: { firstName: 'Ece', gender: 'female' } } as unknown as GameState
    await m.save(0, st, summary)
    const r = await m.load(0)
    expect(r.ok && r.state.hero.gender).toBe('female')
  })

  it('an old envelope (v1) loads and migrates', () => {
    const data = JSON.stringify({ version: 1, hero: { firstName: 'Ali' } })
    const r = openEnvelope(JSON.stringify({ version: 1, savedAt: 0, summary, data, checksum: checksum(data) }))
    expect(r?.state.hero.gender).toBe('male')
  })
})

describe('SaveManager hardening', () => {
  const legacyEnvelope = (version: number, state: object) => {
    const data = JSON.stringify(state)
    return JSON.stringify({ version, savedAt: 1, checksum: checksum(data), summary, data })
  }

  it('keeps the original envelope under a premigrate key when migrating an old save', async () => {
    const st = new MemoryStorage()
    const raw = legacyEnvelope(1, { version: 1, hero: { name: 'x' } })
    st.map.set('sp.save.0', raw)
    const notices: string[] = []
    const m = new SaveManager(st)
    m.onNotice = (n) => notices.push(n.kind)
    const r = await m.load(0)
    expect(r.ok).toBe(true)
    expect(st.map.get('sp.save.0.premigrate')).toBe(raw)
    expect(notices).toContain('premigrate-backup')
    expect(await m.restorePremigrate(0)).toBe(true)
  })

  it('reports a save from a newer version instead of loading an older backup', async () => {
    const st = new MemoryStorage()
    st.map.set('sp.save.1', legacyEnvelope(999, { version: 999 }))
    const m = new SaveManager(st)
    expect(await m.load(1)).toEqual({ ok: false, reason: 'newer' })
    const issues = await m.checkIntegrity()
    expect(issues).toEqual([{ kind: 'integrity', slot: 1, problem: 'newer-version' }])
  })

  it('never deletes backups and keeps a valid copy when storage is full', async () => {
    const st = new MemoryStorage()
    const m = new SaveManager(st)
    await m.save(0, fakeState(1), summary)
    await m.save(0, fakeState(2), summary)
    const bak0 = st.map.get('sp.save.0.bak0')
    expect(bak0).toBeTruthy()
    const realSet = st.set.bind(st)
    st.set = async (key, value) => {
      if (/\.bak\d$/.test(key)) throw new DOMException('full', 'QuotaExceededError')
      return realSet(key, value)
    }
    const notices: string[] = []
    m.onNotice = (n) => notices.push(n.kind)
    await m.save(0, fakeState(3), summary)
    expect(st.map.get('sp.save.0.bak0')).toBe(bak0)
    expect(notices).toEqual(['backups-skipped'])
    const r = await m.load(0)
    expect(r.ok && (r.state as any).marker).toBe(3)
  })

  it('falls back to the verified staging copy when the live write hits the quota', async () => {
    const st = new MemoryStorage()
    const m = new SaveManager(st)
    await m.save(0, fakeState(1), summary)
    const realSet = st.set.bind(st)
    st.set = async (key, value) => {
      if (key === 'sp.save.0') throw new DOMException('full', 'QuotaExceededError')
      return realSet(key, value)
    }
    await expect(m.save(0, fakeState(2), summary)).rejects.toThrow()
    const r = await m.load(0)
    expect(r.ok && (r.state as any).marker).toBe(2)
  })

  it('integrity check flags a damaged live save and notes the backup', async () => {
    const st = new MemoryStorage()
    const m = new SaveManager(st)
    await m.save(0, fakeState(1), summary)
    await m.save(0, fakeState(2), summary)
    st.map.set('sp.save.0', 'garbage')
    expect(await m.checkIntegrity()).toEqual([{ kind: 'integrity', slot: 0, problem: 'live-invalid-recovered' }])
  })
})
