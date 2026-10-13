import { beforeEach, describe, expect, it } from 'vitest'
import { RING_SIZE, _resetErrorRing, describeError, installErrorRing, pushError, recentErrors } from './errorRing'

describe('in-memory error ring', () => {
  beforeEach(() => _resetErrorRing())

  it('keeps the last RING_SIZE entries, oldest first', () => {
    for (let i = 0; i < RING_SIZE + 3; i++) pushError('error', new Error(`e${i}`), i)
    const r = recentErrors()
    expect(r).toHaveLength(RING_SIZE)
    expect(r[0]!.message).toMatch(/^e3\b/)
    expect(r[r.length - 1]!.message).toMatch(new RegExp(`^e${RING_SIZE + 2}\\b`))
  })

  it('describes any thrown value on one short line', () => {
    expect(describeError('plain')).toBe('plain')
    expect(describeError({ message: 'm', stack: 'Error: m\n    at fn (a.js:1:2)' })).toBe('m (at fn (a.js:1:2))')
    expect(describeError('x'.repeat(500)).length).toBeLessThanOrEqual(301)
  })

  it('captures window errors and unhandled rejections', () => {
    const handlers: Record<string, (e: Event) => void> = {}
    installErrorRing({ addEventListener: ((ev: string, fn: (e: Event) => void) => { handlers[ev] = fn }) as never })
    handlers.error!({ error: new Error('boom'), message: 'boom' } as unknown as Event)
    handlers.unhandledrejection!({ reason: 'nope' } as unknown as Event)
    expect(recentErrors().map((e) => [e.kind, e.message.split(' ')[0]])).toEqual([['error', 'boom'], ['rejection', 'nope']])
  })
})
