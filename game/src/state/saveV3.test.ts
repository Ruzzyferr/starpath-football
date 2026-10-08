/** WP-V: v3 migration, SHA-256 envelope, history/replay bounds, thumbnail, size budget. */
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SAVE_VERSION } from '../core/config'
import type { GameState } from '../core/types'
import type { InputRecording } from '../game/inputReplay'
import { advanceDay } from '../sim/game/calendar'
import { dataPackId, loadGame, packState, saveGame, unpackState } from '../sim/game/persist'
import {
  ATTR_HISTORY_SEASONS, MAX_GOAL_REPLAYS, addGoalReplay, attrSeries, drainGoalReplays, packRecording, queueGoalReplay,
  sampleAttrHistory, thumbSvg, unpackRecording,
} from '../sim/game/saveHistory'
import { saveSummary } from '../sim/game/summary'
import { makeGame } from '../sim/game/testHelpers'
import { MemoryStorage, SaveManager, buildEnvelope, openEnvelope, openEnvelopeVerified, sealEnvelope, sha256Hex, type SaveEnvelope } from './save'

const fixture = (v: number) => readFileSync(new URL(`./fixtures/save-v${v}.json`, import.meta.url), 'utf8')
afterEach(() => vi.unstubAllGlobals())

describe('v2 -> v3 migration', () => {
  it('loads a real v2 envelope with sensible defaults and keeps a pre-migration backup', async () => {
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(3)
    const st = new MemoryStorage()
    await st.set('sp.save.0', fixture(2))
    const mgr = new SaveManager(st)
    const r = await loadGame(mgr, 0)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.state.version).toBe(SAVE_VERSION)
    expect(r.state.replays).toEqual([])
    expect(r.state.dataPack).toMatch(/^sp-data-\d+$/)
    expect(r.state.attrHistory?.rows.length).toBe(1)
    expect(r.state.hero.firstName).toBeTruthy()
    expect(JSON.parse((await st.get('sp.save.0.premigrate'))!).version).toBe(2)
  })
  it('loads a v1 envelope through both migrations', () => {
    const o = openEnvelope(fixture(1))
    expect(o?.state.version).toBe(SAVE_VERSION)
    expect((o!.state as GameState).replays).toEqual([])
  })
  it('loads a real v3 envelope into v4: the goalkeeping pair is filled and tracked in the history', async () => {
    const st = new MemoryStorage()
    await st.set('sp.save.0', fixture(3))
    const r = await loadGame(new SaveManager(st), 0)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    for (const k of ['gkPositioning', 'gkDistribution'] as const) {
      expect(r.state.hero.attrs[k]).toBeGreaterThanOrEqual(1)
      expect(r.state.hero.attrs[k]).toBeLessThanOrEqual(99)
      expect(r.state.attrHistory?.keys).toContain(k)
    }
    expect(JSON.parse((await st.get('sp.save.0.premigrate'))!).version).toBe(3)
  })
})

describe('SHA-256 envelope', () => {
  const state = { version: SAVE_VERSION, hero: { gender: 'male' } } as unknown as GameState
  const sum = { heroName: 'a', clubName: 'b', season: 2026, week: 0, ovr: 1, money: 0, playTimeSec: 0 }
  it('seals, verifies and rejects a wrong hash', async () => {
    const env = await sealEnvelope(buildEnvelope(state, sum, 1))
    expect(env.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(await openEnvelopeVerified(JSON.stringify(env))).not.toBeNull()
    const bad: SaveEnvelope = { ...env, sha256: '0'.repeat(64) }
    expect(await openEnvelopeVerified(JSON.stringify(bad))).toBeNull()
  })
  it('accepts old envelopes that only have the FNV checksum', async () => {
    expect(await openEnvelopeVerified(fixture(2))).not.toBeNull()
  })
  it('falls back to the checksum when crypto.subtle is unavailable', async () => {
    const env = await sealEnvelope(buildEnvelope(state, sum, 1))
    vi.stubGlobal('crypto', {})
    expect(await sha256Hex('x')).toBeNull()
    expect((await sealEnvelope(buildEnvelope(state, sum, 1))).sha256).toBeUndefined()
    expect(await openEnvelopeVerified(JSON.stringify({ ...env, sha256: '0'.repeat(64) }))).not.toBeNull()
  })
  it('SaveManager writes sha256 and records the data pack', async () => {
    const st = new MemoryStorage()
    const mgr = new SaveManager(st)
    await mgr.save(0, { ...state, dataPack: 'sp-data-2' } as GameState, sum)
    const env = JSON.parse((await st.get('sp.save.0'))!) as SaveEnvelope
    expect(env.sha256).toHaveLength(64)
    expect(env.dataPack).toBe('sp-data-2')
    expect((await mgr.load(0)).ok).toBe(true)
  })
})

describe('attribute history', () => {
  it('samples weekly, compacts older seasons, bounded', () => {
    const s = makeGame(11)
    for (let season = 2026; season < 2026 + ATTR_HISTORY_SEASONS + 5; season++) {
      s.calendar.season = season
      for (let w = 0; w < 38; w++) { s.calendar.week = w; s.hero.attrs.pace = 50 + w; sampleAttrHistory(s) }
    }
    const rows = s.attrHistory!.rows
    expect(rows.length).toBeLessThanOrEqual(ATTR_HISTORY_SEASONS + 38)
    expect(rows.filter((r) => r[0] === s.calendar.season).length).toBe(38)
    expect(new Set(rows.map((r) => r[0])).size).toBeLessThanOrEqual(ATTR_HISTORY_SEASONS)
    expect(attrSeries(s.attrHistory, 'pace').at(-1)?.value).toBe(87)
  })
  it('advanceDay records a sample each week', () => {
    const s = makeGame(12)
    for (let i = 0; i < 21; i++) advanceDay(s)
    expect(s.attrHistory!.rows.length).toBe(3)
  })
})

describe('goal replays', () => {
  const rec: InputRecording = {
    version: 1, highlightId: 'h1', opts: { seed: 9, difficulty: 'normal' },
    frames: [
      { dt: 0.016, move: { x: 1, y: 0 }, sprint: true }, { dt: 0.016 }, { dt: 0.016 },
      { dt: 0.02, actions: [{ kind: 'shoot', target: { x: 1, y: 2 }, curl: 0.2, power: 1, chip: false } as never] }, { dt: 0.02, aim: null },
    ],
  }
  it('packs losslessly and compactly', () => {
    const back = unpackRecording(JSON.parse(JSON.stringify(packRecording(rec))))
    expect(back).toEqual(rec)
    const big: InputRecording = { ...rec, frames: Array.from({ length: 900 }, () => ({ dt: 1 / 60 })) }
    expect(JSON.stringify(packRecording(big)).length).toBeLessThan(300)
  })
  it('keeps only the last N', () => {
    const s = makeGame(13)
    for (let i = 0; i < MAX_GOAL_REPLAYS + 5; i++) addGoalReplay(s, { season: 2026, week: i, minute: i, rec: packRecording(rec) })
    expect(s.replays!.length).toBe(MAX_GOAL_REPLAYS)
    expect(s.replays![0]!.week).toBe(5)
  })
  it('queued replays land in the state on save', async () => {
    const s = makeGame(14)
    queueGoalReplay(77, rec)
    await saveGame(new SaveManager(new MemoryStorage()), 0, s, 1)
    expect(s.replays!.at(-1)?.minute).toBe(77)
    expect(drainGoalReplays(s)).toBe(0)
    expect(s.dataPack).toBe(dataPackId())
  })
})

describe('slot thumbnail', () => {
  it('summary carries a procedural thumb that renders safe SVG', () => {
    const s = makeGame(15)
    const t = saveSummary(s).thumb!
    expect(t.v).toBe(1)
    const svg = thumbSvg({ ...t, kit: ['"><script>', '#fff'] })
    expect(svg).toMatch(/^<svg/)
    expect(svg).not.toContain('<script')
  })
})

describe('size budget', () => {
  it('stays under 2.5 MB after 5 seasons with a full replay buffer', async () => {
    const s = makeGame(21)
    const frames = Array.from({ length: 700 }, (_, i) => (i % 40 === 0 ? { dt: 0.016, move: { x: i / 700, y: 0.5 }, sprint: i % 80 === 0 } : { dt: 0.016 }))
    const rec: InputRecording = { version: 1, highlightId: 'h', opts: { seed: 1 }, frames }
    for (let i = 0; i < 5 * 38 * 7; i++) {
      advanceDay(s)
      if (i % 20 === 0) addGoalReplay(s, { season: s.calendar.season, week: s.calendar.week, minute: 10, rec: packRecording(rec) })
    }
    const st = new MemoryStorage()
    await saveGame(new SaveManager(st), 0, s, 1)
    const live = (await st.get('sp.save.0'))!
    expect(live.length).toBeLessThan(2.5 * 1024 * 1024)
    expect(JSON.stringify(s.replays).length).toBeLessThan(60_000)
    const back = unpackState(JSON.parse(JSON.stringify(packState(s)))) as GameState
    expect(back.world.competitions).toEqual(JSON.parse(JSON.stringify(s.world.competitions)))
    expect(back.world.players).toEqual(JSON.parse(JSON.stringify(s.world.players)))
  }, 120_000)
})
