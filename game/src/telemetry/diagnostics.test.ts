import { describe, expect, it } from 'vitest'
import { browserVersion, deviceModel, formatDiagnostics, mergeErrors, osVersion, type DiagInput } from './diagnostics'

const A52 = 'Mozilla/5.0 (Linux; Android 14; SM-A525F Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/154.0.8037.106 Mobile Safari/537.36'
const REDUCED = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36'

const base = (over: Partial<DiagInput> = {}): DiagInput => ({
  now: Date.UTC(2026, 9, 13, 12, 0, 0),
  ua: A52,
  appVersion: '0.1.0 (abc1234)',
  lang: 'tr',
  webgl: 'Adreno (TM) 618 · WebGL 1.0',
  quality: { choice: 'auto', auto: 'medium', effective: 'medium' },
  renderer: 'webgl',
  webglBroken: null,
  readbackSlow: false,
  compat: { on: false },
  native: null,
  screen: { w: 412, h: 915, dpr: 2.625 },
  crumbs: [],
  heartbeat: null,
  unfinished: null,
  errors: [],
  ...over,
})

describe('diagnostics', () => {
  it('parses WebView, OS and model from user agents', () => {
    expect(browserVersion(A52)).toBe('Chrome 154.0.8037.106 (WebView)')
    expect(osVersion(A52)).toBe('Android 14')
    expect(deviceModel(A52)).toBe('SM-A525F')
    expect(deviceModel(REDUCED)).toBe('')
    expect(osVersion('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1')).toBe('iOS 17.4')
    expect(browserVersion('')).toBe('?')
  })

  it('formats every section (TR), with none placeholders', () => {
    const t = formatDiagnostics(base())
    expect(t).toContain('WebView: Chrome 154.0.8037.106 (WebView)')
    expect(t).toContain('Sistem: Android 14 · SM-A525F')
    expect(t).toContain('WebGL: Adreno (TM) 618')
    expect(t).toContain('Kalite: auto → medium (ölçülen medium)')
    expect(t).toContain('Uyumluluk modu: kapalı')
    expect(t).toContain('Çizici: webgl')
    expect(t).toMatch(/İzler \(0\):\n {2}\(yok\)/)
    expect(t).toMatch(/Son hatalar \(0\):\n {2}\(yok\)/)
    expect(formatDiagnostics(base({ webgl: '' }))).toContain('WebGL: none')
  })

  it('shows native Android facts, compatibility mode, the unfinished start with its heartbeat, crumbs with gaps and errors (EN)', () => {
    const start = { at: 1000, stage: 'start', info: 'trial · finishing' }
    const last = { at: 1500, stage: 'phaser-built', info: 'webgl · Adreno (TM) 618' }
    const t = formatDiagnostics(base({
      lang: 'en',
      compat: { on: true, auto: 'hung at phaser-built', at: 2000 },
      native: { software: true, active: true, unresponsive: 2, android: '14', sdk: 34, model: 'samsung SM-A525F' },
      crumbs: [start, { at: 1200, stage: 'phaser-build', info: 'drill webgl' }, last],
      heartbeat: { since: 1200, raf: 1500, rafN: 3, timer: 1600, timerN: 2 },
      unfinished: { start, last, stages: ['phaser-build', 'phaser-built'], heartbeat: { since: 1200, raf: 1500, rafN: 3, timer: 1600, timerN: 2 } },
      errors: [{ at: 1400, kind: 'render', message: 'webgl: no frame within 4.5 s' }],
      webglBroken: 'drill: no frame',
    }))
    expect(t).toContain('OS: Android 14 (API 34) · samsung SM-A525F')
    expect(t).toContain('Compatibility mode: on (automatic: hung at phaser-built) · native layer: software · renderer unresponsive ×2')
    expect(t).toContain('WebGL off: drill: no frame')
    expect(t).toContain('Last start did not finish: trial · finishing → phaser-built (webgl · Adreno (TM) 618)')
    expect(t).toContain('main thread hung')
    expect(t).toContain('+300ms phaser-built')
    expect(t).toContain('[render] webgl: no frame within 4.5 s')
  })

  it('merges session and persisted errors without duplicates, oldest first', () => {
    const a = { at: 1, kind: 'error' as const, message: 'a' }
    const b = { at: 2, kind: 'phaser' as const, message: 'b' }
    expect(mergeErrors([b, a], [a])).toEqual([a, b])
  })
})
