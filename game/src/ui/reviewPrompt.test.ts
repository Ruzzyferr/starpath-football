import { describe, expect, it } from 'vitest'
import { shouldAsk } from './reviewPrompt'

const DAY = 86_400_000

describe('shouldAsk', () => {
  const ready = { matches: 5, lastAsked: null }
  it('asks after a good win once enough matches were played', () => {
    expect(shouldAsk(ready, true, 8.1, 0)).toBe(true)
  })
  it('never after a loss, a draw or a poor rating', () => {
    expect(shouldAsk(ready, false, 9, 0)).toBe(false)
    expect(shouldAsk(ready, true, 6.9, 0)).toBe(false)
  })
  it('waits for the first matches', () => {
    expect(shouldAsk({ matches: 4, lastAsked: null }, true, 9, 0)).toBe(false)
  })
  it('asks again only after 120 days', () => {
    expect(shouldAsk({ matches: 30, lastAsked: 0 }, true, 9, 119 * DAY)).toBe(false)
    expect(shouldAsk({ matches: 30, lastAsked: 0 }, true, 9, 120 * DAY)).toBe(true)
  })
})
