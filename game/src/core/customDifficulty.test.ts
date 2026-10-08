import { describe, expect, it } from 'vitest'
import { customAimAssist, customMomentOverrides, DEFAULT_CUSTOM, normalizeCustom } from './customDifficulty'

describe('custom difficulty (2.1#128)', () => {
  it('maps arc / magnet to the assist levels', () => {
    expect(customAimAssist({ ...DEFAULT_CUSTOM })).toBe('full')
    expect(customAimAssist({ ...DEFAULT_CUSTOM, magnet: false })).toBe('half')
    expect(customAimAssist({ ...DEFAULT_CUSTOM, arc: false })).toBe('manual')
  })

  it('bullet time, AI reaction and wind reach the live-moment options', () => {
    const o = customMomentOverrides({ bulletTime: false, arc: true, magnet: false, aiReaction: 1.2, wind: false })
    expect(o).toMatchObject({ aimAssist: 'half', slowMoAim: false, difficulty: 1.2 })
    expect(o.weather('wind')).toBe('clear')
    expect(o.weather('rain')).toBe('rain')
    expect(customMomentOverrides({ wind: true }).weather('wind')).toBe('wind')
  })

  it('normalizes old or hand-edited blocks', () => {
    expect(normalizeCustom(undefined)).toEqual(DEFAULT_CUSTOM)
    expect(normalizeCustom({ aiReaction: 9 }).aiReaction).toBe(1.3)
    expect(normalizeCustom({ aiReaction: 0.2 }).aiReaction).toBe(0.8)
    expect(normalizeCustom({ aiReaction: 0.8500000001 }).aiReaction).toBe(0.85)
  })
})
