import { describe, expect, it } from 'vitest'
import { BAND_COLOR, BAND_PATTERN, firstLanding, landingErrorRadius, powerBand, previewFraction, previewVisible, speedLabel } from './aimView'
import { DIFFICULTY_SCALE } from './runtime'

describe('power colours (2.1#19, 2.2#17)', () => {
  it('green 0–60, yellow 60–85, red 85–100, overhit beyond', () => {
    expect(powerBand(0.3)).toBe('green')
    expect(powerBand(0.6)).toBe('green')
    expect(powerBand(0.7)).toBe('yellow')
    expect(powerBand(0.9)).toBe('red')
    expect(powerBand(1)).toBe('red')
    expect(powerBand(1.1)).toBe('overhit')
  })
  it('four distinct colours and a distinct colour-blind pattern per band', () => {
    expect(new Set(Object.values(BAND_COLOR)).size).toBe(4)
    expect(new Set(Object.values(BAND_PATTERN)).size).toBe(4)
  })
})

describe('preview (2.1#20, 2.2#16)', () => {
  it('Vision 40 shows 35 %, 80 shows 70 %, clamped 30–70 %', () => {
    expect(previewFraction(40, 40)).toBeCloseTo(0.35, 6)
    expect(previewFraction(80, 80)).toBeCloseTo(0.7, 6)
    expect(previewFraction(10, 10)).toBe(0.3)
    expect(previewFraction(99, 99)).toBe(0.7)
    expect(previewFraction(80, 40)).toBeGreaterThan(previewFraction(40, 80))
  })
  it('is hidden on Hard/Legend and on manual assist', () => {
    expect(previewVisible(DIFFICULTY_SCALE.normal, 'full')).toBe(true)
    expect(previewVisible(DIFFICULTY_SCALE.easy, 'half')).toBe(true)
    expect(previewVisible(DIFFICULTY_SCALE.hard, 'full')).toBe(false)
    expect(previewVisible(DIFFICULTY_SCALE.legend, 'full')).toBe(false)
    expect(previewVisible(DIFFICULTY_SCALE.normal, 'manual')).toBe(false)
  })
})

describe('landing X (2.2#18)', () => {
  it('finds the first ground contact after the ball was in the air', () => {
    expect(firstLanding([{ z: 0 }, { z: 1 }, { z: 3 }, { z: 0.8 }, { z: 0.05 }, { z: 0.3 }])).toBe(4)
    expect(firstLanding([{ z: 0 }, { z: 0.1 }])).toBe(-1)
  })
  it('error ellipse grows as Technique drops', () => {
    expect(landingErrorRadius(90)).toBeLessThan(landingErrorRadius(50))
    expect(landingErrorRadius(100)).toBeCloseTo(0.8, 6)
  })
})

describe('speed label (2.1#21)', () => {
  it('is absolute km/h', () => {
    expect(speedLabel(26.7)).toBe('96 km/h')
  })
})
