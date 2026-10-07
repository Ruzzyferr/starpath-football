import { describe, expect, it } from 'vitest'
import { tr } from './tr'
import { en } from './en'
import { currentLang, format, t, upper } from './index'

function leaves(obj: unknown, prefix = ''): Map<string, string> {
  const out = new Map<string, string>()
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const key = prefix ? `${prefix}.${k}` : k
      if (typeof v === 'string') out.set(key, v)
      else for (const [kk, vv] of leaves(v, key)) out.set(kk, vv)
    }
  }
  return out
}

const placeholders = (s: string) =>
  [...s.matchAll(/\{(\w+)(?:\|[^}]*)?\}/g)]
    .map((m) => m[1])
    .sort()
    .filter((v, i, a) => a.indexOf(v) === i)

describe('i18n dictionaries', () => {
  const trL = leaves(tr)
  const enL = leaves(en)

  it('tr and en have exactly the same keys', () => {
    const missingInEn = [...trL.keys()].filter((k) => !enL.has(k))
    const extraInEn = [...enL.keys()].filter((k) => !trL.has(k))
    expect(missingInEn).toEqual([])
    expect(extraInEn).toEqual([])
  })

  it('has no empty strings', () => {
    const empty = [...trL, ...enL].filter(([, v]) => v.trim() === '').map(([k]) => k)
    expect(empty).toEqual([])
  })

  it('uses the same placeholders in both languages', () => {
    const bad: string[] = []
    for (const [k, v] of trL) {
      const e = enL.get(k)
      if (e !== undefined && placeholders(v).join() !== placeholders(e).join()) bad.push(k)
    }
    expect(bad).toEqual([])
  })

  it('is reasonably large (screens are localised)', () => {
    expect(trL.size).toBeGreaterThan(300)
  })
})

describe('t()', () => {
  it('translates by current language and interpolates', () => {
    currentLang.value = 'tr'
    expect(t('common.back')).toBe('Geri')
    expect(t('common.week', { n: 3 })).toBe('Hafta 3')
    currentLang.value = 'en'
    expect(t('common.back')).toBe('Back')
    expect(t('common.matchesN', { n: 1 })).toBe('1 match')
    expect(t('common.matchesN', { n: 4 })).toBe('4 matches')
    currentLang.value = 'tr'
  })

  it('format handles plural syntax and leaves unknown vars intact', () => {
    expect(format('{n} {n|gol|gol}', { n: 2 })).toBe('2 gol')
    expect(format('Hi {name}', {})).toBe('Hi {name}')
  })

  it('upper() is Turkish-aware', () => {
    expect(upper('istanbul', 'tr')).toBe('İSTANBUL')
    expect(upper('istanbul', 'en')).toBe('ISTANBUL')
    expect(upper('ılık', 'tr')).toBe('ILIK')
  })
})
