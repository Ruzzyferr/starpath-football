import { describe, expect, it } from 'vitest'
import {
  attrBucket, deltaTone, formatCompact, formatDelta, formatMoney, formatPercent, formatRating, formatSigned,
  initials, seasonLabel, shortName, tierOf,
} from './format'

// Intl may use U+00A0 / U+202F spaces in some locales; normalise for assertions.
const n = (s: string) => s.replace(/[  ]/g, ' ')

describe('money', () => {
  it('formats euros per locale', () => {
    expect(n(formatMoney(12500, { lang: 'tr' }))).toBe('12.500 €')
    expect(n(formatMoney(12500, { lang: 'en' }))).toBe('€12,500')
  })
  it('compacts large values', () => {
    expect(n(formatMoney(1_250_000, { lang: 'en', compact: true }))).toBe('€1.3M')
    expect(n(formatMoney(1_250_000, { lang: 'tr', compact: true }))).toBe('1,3 Mn €')
    expect(n(formatMoney(85_000, { lang: 'en', compact: true }))).toBe('€85,000')
  })
  it('signs deltas with a real minus', () => {
    expect(n(formatMoney(-2000, { lang: 'en' }))).toBe('−€2,000')
    expect(n(formatMoney(2000, { lang: 'en', sign: true }))).toBe('+€2,000')
  })
})

describe('numbers', () => {
  it('compact', () => {
    expect(formatCompact(9500, 'en')).toBe('9,500')
    expect(formatCompact(12_400, 'en')).toBe('12K')
    expect(formatCompact(2_400_000, 'en')).toBe('2.4M')
    expect(n(formatCompact(2_400_000, 'tr'))).toBe('2,4 Mn')
  })
  it('signed / percent / rating', () => {
    expect(formatSigned(5, 'en')).toBe('+5')
    expect(formatSigned(-5, 'en')).toBe('−5')
    expect(formatSigned(0, 'en')).toBe('0')
    expect(formatPercent(0.42, 'tr')).toBe('%42')
    expect(formatPercent(0.42, 'en')).toBe('42%')
    expect(formatRating(7, 'en')).toBe('7.0')
    expect(formatRating(7.25, 'tr')).toBe('7,3')
  })
  it('season label', () => {
    expect(seasonLabel(2026)).toBe('2026/27')
    expect(seasonLabel(2099)).toBe('2099/00')
  })
})

describe('deltas & scales', () => {
  it('formats deltas by key', () => {
    expect(formatDelta('happiness', 5, 'en')).toBe('+5')
    expect(n(formatDelta('money', -2000, 'en'))).toBe('−€2,000')
    expect(formatDelta('followers', 15_000, 'en')).toBe('+15K')
  })
  it('knows stats where up is bad', () => {
    expect(deltaTone('stress', 5)).toBe('neg')
    expect(deltaTone('stress', -5)).toBe('pos')
    expect(deltaTone('money', 10)).toBe('pos')
    expect(deltaTone('energy', 0)).toBe('neutral')
  })
  it('tiers and attribute buckets', () => {
    expect(tierOf(60)).toBe('bronze')
    expect(tierOf(70)).toBe('silver')
    expect(tierOf(80)).toBe('gold')
    expect(tierOf(88)).toBe('elite')
    expect(tierOf(95)).toBe('legend')
    expect(attrBucket(30)).toBe(1)
    expect(attrBucket(95)).toBe(6)
  })
  it('names', () => {
    expect(shortName('Mehmet', 'Yılmazoğlu')).toBe('M. Yılmazoğlu')
    expect(initials('ilkay ışık', 'tr')).toBe('İI')
  })
})
