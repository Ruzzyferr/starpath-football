import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  BOOT_STAGE, MAX_CRUMBS, _resetCrumbs, beginRun, checkLastRunAtBoot, crumb, heartbeatState, heartbeatVerdict, lastIncompleteRun,
  reachedPhaser, readCrumbs, setCrumbStore, unfinishedRun, type Crumb, type Heartbeat,
} from './breadcrumbs'
import { lastRunNoticeText, shouldAutoCompat } from './lastRunNotice'

const mem = new Map<string, string>()

beforeEach(() => {
  mem.clear()
  setCrumbStore({ getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: (k) => void mem.delete(k) })
})
afterEach(() => _resetCrumbs())

const c = (stage: string, at: number, info?: string): Crumb => (info ? { stage, at, info } : { stage, at })

describe('breadcrumbs', () => {
  it('persists stages synchronously, oldest first, capped', () => {
    beginRun('trial', 'finishing', 1000)
    crumb('chunk-loaded', undefined, 1100)
    expect(readCrumbs().map((x) => x.stage)).toEqual(['start', 'chunk-loaded'])
    expect(readCrumbs()[0]!.info).toBe('trial · finishing')
    for (let i = 0; i < MAX_CRUMBS + 10; i++) crumb(`s${i}`, undefined, 2000 + i)
    const all = readCrumbs()
    expect(all).toHaveLength(MAX_CRUMBS)
    expect(all[all.length - 1]!.stage).toBe(`s${MAX_CRUMBS + 9}`)
  })

  it('survives garbage in storage', () => {
    mem.set('sp.diag.crumbs', '{not json')
    expect(readCrumbs()).toEqual([])
    crumb('x', undefined, 1)
    expect(readCrumbs().map((x) => x.stage)).toEqual(['x'])
  })

  it('a start without render-ok / exit / fail-panel / cancel is unfinished; the boot check reports it once', () => {
    beginRun('trial', undefined, 1000)
    crumb('phaser-build', 'drill webgl', 1200)
    crumb('phaser-built', 'webgl · Adreno (TM) 618', 1300)
    crumb('scene-create', 'drill', 1350)
    const r = checkLastRunAtBoot(5000)
    expect(r?.last.stage).toBe('scene-create')
    expect(r?.stages).toEqual(['phaser-build', 'phaser-built', 'scene-create'])
    expect(reachedPhaser(r!)).toBe(true)
    // The boot crumb ends it: no second notice.
    expect(readCrumbs()[readCrumbs().length - 1]!.stage).toBe(BOOT_STAGE)
    expect(checkLastRunAtBoot(6000)).toBeNull()
    // Settings still sees the last incomplete start (stage before the next launch).
    expect(lastIncompleteRun(readCrumbs())?.last.stage).toBe('scene-create')
  })

  it('finished runs and quiet launches are not reported', () => {
    expect(unfinishedRun([])).toBeNull()
    expect(unfinishedRun([c('trial-intro', 1)])).toBeNull()
    for (const end of ['render-ok', 'exit', 'fail-panel', 'cancel']) {
      expect(unfinishedRun([c('start', 1), c('phaser-build', 2), c(end, 3)])).toBeNull()
      expect(lastIncompleteRun([c('start', 1), c(end, 3), c(BOOT_STAGE, 4)])).toBeNull()
    }
    // A run that ended mid-start before Phaser was built (e.g. the chunk never loaded).
    const r = unfinishedRun([c('start', 1), c('chunk-loaded', 2)])!
    expect(reachedPhaser(r)).toBe(false)
  })

  it('heartbeat: hung (both stop with the last stage), frozen (frames stop, timers go on), running', () => {
    const base = { start: c('start', 1000), last: c('scene-create', 2000), stages: ['scene-create'] }
    const hb = (raf: number, timer: number): Heartbeat => ({ since: 1000, raf, rafN: 10, timer, timerN: 10 })
    expect(heartbeatState({ ...base, heartbeat: null })).toBe('none')
    expect(heartbeatState({ ...base, heartbeat: hb(1990, 2100) })).toBe('hung')
    expect(heartbeatState({ ...base, heartbeat: hb(2000, 9000) })).toBe('frozen')
    expect(heartbeatState({ ...base, heartbeat: hb(16000, 16000) })).toBe('running')
    expect(heartbeatVerdict({ ...base, heartbeat: hb(1990, 2100) }, true)).toMatch(/kilitlendi/)
    expect(heartbeatVerdict({ ...base, heartbeat: hb(2000, 9000) }, false)).toMatch(/frozen/)
  })

  it('a heartbeat from an older start is not attached to a newer run', () => {
    mem.set('sp.diag.hb', JSON.stringify({ since: 1, raf: 2, rafN: 1, timer: 2, timerN: 1 }))
    beginRun('drill', undefined, 1_000_000)
    expect(checkLastRunAtBoot(1_000_100)?.heartbeat).toBeNull()
  })
})

describe('last-run notice', () => {
  const run = (stages: string[], hb: Heartbeat | null = null) => ({ start: c('start', 1000, 'trial'), last: c(stages[stages.length - 1]!, 2000), stages, heartbeat: hb })

  it('escalates on observed behaviour only: compatibility mode first, then (Android) the software layer, then nothing', () => {
    const off = { on: false }
    const compat = { on: true }
    const layer = { on: true, layer: true }
    const gpu = run(['chunk-loaded', 'phaser-build'])
    expect(shouldAutoCompat(gpu, 'android', off)).toBe('compat')
    expect(shouldAutoCompat(gpu, 'web', off)).toBe('compat')
    expect(shouldAutoCompat(gpu, 'android', compat)).toBe('layer')
    expect(shouldAutoCompat(gpu, 'web', compat)).toBeNull()
    expect(shouldAutoCompat(gpu, 'android', layer)).toBeNull()
    // Never reached the GPU path, or the page kept running: no change.
    expect(shouldAutoCompat(run(['chunk-loaded']), 'android', off)).toBeNull()
    const running: Heartbeat = { since: 1000, raf: 16000, rafN: 900, timer: 16000, timerN: 60 }
    expect(shouldAutoCompat(run(['phaser-build', 'phaser-built'], running), 'android', off)).toBeNull()
    const hung: Heartbeat = { since: 1000, raf: 2000, rafN: 3, timer: 2000, timerN: 4 }
    expect(shouldAutoCompat(run(['phaser-build', 'phaser-built'], hung), 'android', off)).toBe('compat')
  })

  it('names the last stage in TR and EN and mentions compatibility mode when it was switched on', () => {
    const r = run(['phaser-build', 'scene-create'])
    const tr = lastRunNoticeText(r, 'compat', true)
    expect(tr.body).toContain('scene-create')
    expect(tr.body).toContain('Uyumluluk modu')
    expect(tr.body).toContain('Tanılama')
    const en = lastRunNoticeText(r, null, false)
    expect(en.body).toContain('scene-create')
    expect(en.body).not.toContain('Compatibility')
    expect(lastRunNoticeText(r, 'layer', true).body).toContain('Yazılımsal çizim')
  })
})
