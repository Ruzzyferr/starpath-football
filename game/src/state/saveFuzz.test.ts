/**
 * Save robustness (2.12#88, 2.9#47/#130, 2.9#42, crash-safe autosave).
 *
 * Fixture policy: whenever SAVE_VERSION is bumped, the PREVIOUS build's real envelope is committed as
 * `fixtures/save-v<N>.json` before the migration is written; the test below fails until it exists and
 * loads through every migration up to the current version.
 */
import { readFileSync, existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SAVE_VERSION } from '../core/config'
import { Rng } from '../core/rng'
import type { GameState } from '../core/types'
import { BACKUP_COUNT, MILESTONE_COUNT, MemoryStorage, SaveManager, buildEnvelope, openEnvelope } from './save'

const summary = (season = 2026) => ({ heroName: 'Test', clubName: 'FC', season, week: 1, ovr: 50, money: 0, playTimeSec: 0 })
const fakeState = (n: number) => ({ version: SAVE_VERSION, marker: n, hero: { gender: 'male' } }) as unknown as GameState
const marker = (r: Awaited<ReturnType<SaveManager['load']>>) => (r.ok ? (r.state as unknown as { marker: number }).marker : null)

describe('migration fixtures', () => {
  it('has a committed envelope for every older save version, and each one loads to the current schema', () => {
    for (let v = 1; v < SAVE_VERSION; v++) {
      const url = new URL(`./fixtures/save-v${v}.json`, import.meta.url)
      expect(existsSync(url), `fixtures/save-v${v}.json (policy: commit the old envelope before migrating)`).toBe(true)
      const opened = openEnvelope(readFileSync(url, 'utf8'))
      expect(opened, `v${v} fixture opens`).not.toBeNull()
      expect(opened!.state.version).toBe(SAVE_VERSION)
    }
  })
})

describe('envelope fuzzing', () => {
  const valid = JSON.stringify(buildEnvelope(fakeState(1), summary(), 1))

  it('never throws and rarely yields a state from a damaged envelope (2000 mutations)', () => {
    const rng = new Rng(20261008)
    let accepted = 0
    for (let i = 0; i < 2000; i++) {
      let s = valid
      const ops = rng.int(1, 3)
      for (let o = 0; o < ops; o++) {
        const at = rng.int(0, s.length - 1)
        switch (rng.int(0, 5)) {
          case 0: s = s.slice(0, at); break // truncate
          case 1: s = s.slice(0, at) + s.slice(at + rng.int(1, 8)); break // delete a run
          case 2: s = s.slice(0, at) + String.fromCharCode(32 + rng.int(0, 94)) + s.slice(at + 1); break // flip a char
          case 3: s = s.slice(0, at) + '"__proto__":{"polluted":1},' + s.slice(at); break
          case 4: s = s.slice(0, at) + '\u0000\ud800' + s.slice(at); break
          default: s = s.slice(at) + s.slice(0, at) // rotate
        }
      }
      let r: ReturnType<typeof openEnvelope> = null
      expect(() => { r = openEnvelope(s) }).not.toThrow()
      if (r) accepted++
    }
    // Damage that leaves data + checksum intact (e.g. in the summary or the key names) may still verify; most must not.
    expect(accepted).toBeLessThan(700)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('rejects non-string / structurally wrong input', () => {
    for (const bad of [null, '', '[]', '{}', '{"version":2}', '{"data":5,"checksum":"x"}', 'null', '123']) {
      expect(() => openEnvelope(bad)).not.toThrow()
      expect(openEnvelope(bad)).toBeNull()
    }
  })

  it('any single changed character inside the state payload is caught by the checksum', () => {
    const env = JSON.parse(valid) as { data: string }
    for (let i = 0; i < env.data.length; i++) {
      const changed = { ...env, data: env.data.slice(0, i) + (env.data[i] === 'x' ? 'y' : 'x') + env.data.slice(i + 1) }
      expect(openEnvelope(JSON.stringify(changed)), `char ${i}`).toBeNull()
    }
  })
})

describe('crash-safe saving: a failure at any single write leaves a loadable career', () => {
  it('fails the k-th storage write for every k and still loads the old or the new state', async () => {
    const probe = new MemoryStorage()
    const pm = new SaveManager(probe)
    await pm.save(0, fakeState(1), summary())
    await pm.save(0, fakeState(2), summary())
    let writes = 0
    const origSet = probe.set.bind(probe)
    probe.set = async (k, v) => { writes++; return origSet(k, v) }
    await pm.save(0, fakeState(3), summary())
    expect(writes).toBeGreaterThan(3)

    for (let k = 1; k <= writes; k++) {
      const st = new MemoryStorage()
      const m = new SaveManager(st)
      await m.save(0, fakeState(1), summary())
      await m.save(0, fakeState(2), summary())
      let n = 0
      const set = st.set.bind(st)
      st.set = async (key, value) => {
        if (++n === k) throw new Error('simulated crash / quota')
        return set(key, value)
      }
      await m.save(0, fakeState(3), summary()).catch(() => undefined)
      st.set = set
      const r = await new SaveManager(st).load(0)
      expect(r.ok, `write #${k} failed`).toBe(true)
      expect([2, 3], `write #${k} failed`).toContain(marker(r))
    }
  })

  it('a torn (truncated) live value falls back to the previous generation', async () => {
    const st = new MemoryStorage()
    const m = new SaveManager(st)
    await m.save(0, fakeState(1), summary())
    await m.save(0, fakeState(2), summary())
    st.map.set('sp.save.0', st.map.get('sp.save.0')!.slice(0, 200))
    expect(marker(await m.load(0))).toBe(1)
  })
})

describe('season milestone backups (2.9#42)', () => {
  it('keeps the first save of each season, prunes beyond the cap, and restores the newest on total loss', async () => {
    const st = new MemoryStorage()
    const m = new SaveManager(st)
    const last = 2026 + MILESTONE_COUNT + 1
    for (let season = 2026; season <= last; season++) {
      await m.save(0, fakeState(season), summary(season))
      await m.save(0, fakeState(season + 0.5), summary(season)) // same season again: no second milestone
    }
    const kept = await m.listMilestones(0)
    expect(kept).toHaveLength(MILESTONE_COUNT)
    expect(kept[0]).toBe(last)
    expect([...st.map.keys()].filter((k) => k.includes('.ms.'))).toHaveLength(MILESTONE_COUNT)

    // Destroy live + all rolling backups: the milestone still brings the career back.
    for (const k of [...st.map.keys()]) if (/^sp\.save\.0(\.bak\d|\.staging)?$/.test(k)) st.map.delete(k)
    const r = await m.load(0)
    expect(r.ok && r.recoveredFromBackup).toBe(BACKUP_COUNT)
    expect(marker(r)).toBe(last)
    expect(await m.restoreMilestone(0, last)).toBe(true)

    await m.remove(0)
    expect([...st.map.keys()].filter((k) => k.startsWith('sp.save.0'))).toEqual([])
  })

  it('a full storage skips the milestone without failing the save', async () => {
    const st = new MemoryStorage()
    const m = new SaveManager(st)
    const set = st.set.bind(st)
    st.set = async (k, v) => {
      if (k.includes('.ms')) throw new DOMException('full', 'QuotaExceededError')
      return set(k, v)
    }
    await expect(m.save(0, fakeState(1), summary())).resolves.toBeUndefined()
    expect(marker(await m.load(0))).toBe(1)
  })
})
