import { describe, expect, it } from 'vitest'
import { nameStyleOf } from './players'
import { virtualSquad } from './national'

describe('national-only nations', () => {
  it('use their own name style (Belgium: Dutch names, not English)', () => {
    expect(nameStyleOf('BE')).toBe('dutch')
    expect(nameStyleOf('TR')).toBe('turkish')
    expect(virtualSquad('BE', 2026).length).toBeGreaterThan(0)
  })
})
