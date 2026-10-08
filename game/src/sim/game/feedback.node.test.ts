import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { addFeedback, buildFeedback, FEEDBACK_MAX_SAVED, FEEDBACK_MAX_TEXT, feedbackExport, onlineAllowed, shouldAskNotifications } from './feedback'
import { emptyLocalMeta } from './localMeta'

const env = { version: '1.2.3', now: 1_700_000_000_000, ua: 'UA', lang: 'tr', screen: '800x600' }

describe('feedback form', () => {
  it('rejects empty text, clamps long text and only attaches what was ticked', () => {
    const m = { seen: ['a', 'b', 'c', 'd'] }
    expect(buildFeedback('bug', '  hi ', { device: true, recentMatches: true }, m, env)).toBeNull()
    const e = buildFeedback('bug', 'x'.repeat(5000), { device: false, recentMatches: false }, m, env)!
    expect(e.text).toHaveLength(FEEDBACK_MAX_TEXT)
    expect(e.device).toBeUndefined()
    expect(e.recentMatches).toBeUndefined()
    const f = buildFeedback('idea', 'please add more', { device: true, recentMatches: true }, m, env)!
    expect(f.device?.screen).toBe('800x600')
    expect(f.recentMatches).toEqual(['b', 'c', 'd'])
  })
  it('keeps a bounded local list and exports parseable JSON', () => {
    let list = [] as ReturnType<typeof addFeedback>
    for (let i = 0; i < FEEDBACK_MAX_SAVED + 5; i++) list = addFeedback(list, buildFeedback('other', `report number ${i}`, { device: false, recentMatches: false }, { seen: [] }, { ...env, now: env.now + i })!)
    expect(list).toHaveLength(FEEDBACK_MAX_SAVED)
    const parsed = JSON.parse(feedbackExport(list)) as { format: string; entries: unknown[] }
    expect(parsed.format).toBe('starpath-feedback')
    expect(parsed.entries).toHaveLength(FEEDBACK_MAX_SAVED)
  })
})

describe('online switch and notification prompt', () => {
  it('is off by default and the prompt waits for the first cleared challenge', () => {
    const m = emptyLocalMeta()
    expect(onlineAllowed(m)).toBe(false)
    expect(shouldAskNotifications(m)).toBe(false)
    m.challenges['2026:1'] = { id: 'win', rating: 7, opponent: 'X' }
    expect(shouldAskNotifications(m)).toBe(true)
    m.notify = 'declined'
    expect(shouldAskNotifications(m)).toBe(false)
  })
  it('the app source contains no network primitives (nothing can send while the switch is off)', () => {
    const bad = /\bfetch\(|XMLHttpRequest|new WebSocket|sendBeacon|new EventSource|https?:\/\/(?!www\.w3\.org)/
    const hits: string[] = []
    const walk = (dir: string): void => {
      for (const n of readdirSync(dir)) {
        const p = join(dir, n)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.(ts|tsx|css)$/.test(n) && !/\.test\./.test(n) && bad.test(readFileSync(p, 'utf8'))) hits.push(p)
      }
    }
    walk(join(process.cwd(), 'src'))
    expect(hits).toEqual([])
  })
})
