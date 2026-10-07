import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PITCH_COLORS } from './pitchColors'

describe('pitch colours', () => {
  it('UI tokens mirror the scene turf', () => {
    const css = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8')
    expect(css).toContain(`--pitch-a: ${PITCH_COLORS.clear[0]}`)
    expect(css).toContain(`--pitch-b: ${PITCH_COLORS.clear[1]}`)
  })
})
