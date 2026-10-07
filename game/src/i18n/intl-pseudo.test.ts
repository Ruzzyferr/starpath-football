import { afterEach, describe, expect, it } from 'vitest'
import { currentLang, format, pseudoLocale, t } from './index'
import { pseudoize } from './pseudo'
import { formatCompact, formatMoney, formatNumber, formatTimestamp } from '../ui/format'

afterEach(() => {
  pseudoLocale.value = false
  currentLang.value = 'tr'
})

describe('pseudo-locale', () => {
  it('accents letters and is at least 30% longer', () => {
    const src = 'Advance to the next week'
    const out = pseudoize(src)
    expect(out).not.toBe(src)
    expect(out.length).toBeGreaterThanOrEqual(Math.floor(src.length * 1.3))
    expect(/[a-z]/.test(out.split(' ')[0]!)).toBe(false)
  })
  it('keeps placeholders and plural groups intact', () => {
    const out = pseudoize('Hello {name}, {n|match|matches} left')
    expect(out).toContain('{name}')
    expect(out).toContain('{n|match|matches}')
    expect(format(out, { name: 'Ali', n: 2 })).toContain('Ali')
  })
  it('t() applies it only when enabled', () => {
    currentLang.value = 'en'
    const plain = t('common.close')
    pseudoLocale.value = true
    expect(t('common.close')).not.toBe(plain)
    pseudoLocale.value = false
    expect(t('common.close')).toBe(plain)
  })
})

describe('ICU plural', () => {
  const tpl = '{n, plural, =0 {no goals} one {# goal} other {# goals}}'
  it('en', () => {
    expect(format(tpl, { n: 0 }, 'en')).toBe('no goals')
    expect(format(tpl, { n: 1 }, 'en')).toBe('1 goal')
    expect(format(tpl, { n: 1500 }, 'en')).toBe('1,500 goals')
  })
  it('tr uses tr-TR number grouping', () => {
    expect(format('{n, plural, one {# gol} other {# gol}}', { n: 1500 }, 'tr')).toBe('1.500 gol')
  })
})

describe('Intl formatting', () => {
  it('numbers, compact, money and dates follow the language', () => {
    expect(formatNumber(12500, 'tr')).toBe('12.500')
    expect(formatNumber(12500, 'en')).toBe('12,500')
    expect(formatCompact(1_200_000, 'tr')).toContain('Mn')
    expect(formatMoney(12500, { lang: 'en' })).toBe('€12,500')
    expect(formatMoney(12500, { lang: 'tr' })).toMatch(/12\.500\s?€/)
    const ts = Date.UTC(2026, 2, 5, 12)
    expect(formatTimestamp(ts, 'tr')).not.toBe(formatTimestamp(ts, 'en'))
  })
})
