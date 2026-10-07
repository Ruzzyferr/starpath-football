/**
 * i18n: Turkish is the source language, English must mirror every key
 * (enforced at compile time via Shape<> and by i18n.test.ts).
 *
 *   t('home.advance')                       → "İlerle"
 *   t('common.money', { amount: '€5' })      → interpolates {amount}
 *   t('x', { n: 2 })  with "{n} {n|match|matches}" → "2 matches"
 */
import { signal } from '@preact/signals'
import type { Lang, LText } from '../core/types'
import { tr } from './tr'
import { en } from './en'

export const currentLang = signal<Lang>('tr')
export const dictionaries = { tr, en } as const
export type Dict = typeof tr

type Leaves<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${Leaves<T[K]>}`
}[keyof T & string]
export type TKey = Leaves<Dict>

export type TVars = Record<string, string | number>

const cache: Record<Lang, Map<string, string | undefined>> = { tr: new Map(), en: new Map() }

function lookup(lang: Lang, key: string): string | undefined {
  const c = cache[lang]
  if (c.has(key)) return c.get(key)
  let node: unknown = dictionaries[lang]
  for (const part of key.split('.')) {
    if (node && typeof node === 'object') node = (node as Record<string, unknown>)[part]
    else {
      node = undefined
      break
    }
  }
  const out = typeof node === 'string' ? node : undefined
  c.set(key, out)
  return out
}

export function format(template: string, vars?: TVars): string {
  if (!vars) return template
  return template
    .replace(/\{(\w+)\|([^|}]*)\|([^}]*)\}/g, (_m, k: string, one: string, many: string) =>
      Number(vars[k]) === 1 ? one : many,
    )
    .replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
}

/** Translate a key. Reads `currentLang` so components re-render on change. */
export function t(key: TKey, vars?: TVars, lang: Lang = currentLang.value): string {
  const s = lookup(lang, key) ?? lookup('tr', key)
  if (s === undefined) {
    if (import.meta.env?.DEV) console.warn('[i18n] missing key', key)
    return key
  }
  return format(s, vars)
}

/** Translate a dynamic key (built at runtime). Falls back to `fallback`. */
export function tx(key: string, vars?: TVars, fallback?: string): string {
  const lang = currentLang.value
  const s = lookup(lang, key) ?? lookup('tr', key)
  return s === undefined ? (fallback ?? key) : format(s, vars)
}

/** Pick the active language from an LText (or pass a plain string through). */
export function lt(text: LText | string | null | undefined, vars?: TVars): string {
  if (text == null) return ''
  const s = typeof text === 'string' ? text : (text[currentLang.value] ?? text.tr)
  return format(s, vars)
}

/** Locale-correct upper-casing (İ/ı in Turkish). */
export function upper(s: string, lang: Lang = currentLang.value): string {
  return s.toLocaleUpperCase(lang === 'tr' ? 'tr-TR' : 'en-US')
}

export function locale(lang: Lang = currentLang.value): string {
  return lang === 'tr' ? 'tr-TR' : 'en-GB'
}
