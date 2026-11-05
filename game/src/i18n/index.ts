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
import { pseudoize } from './pseudo'

export const currentLang = signal<Lang>('tr')

/**
 * Display languages. Turkish and English are written in the code (LText, tr.ts/en.ts); every
 * other language is an overlay keyed by the English text (src/i18n/overlay/<code>.json, from
 * scripts/i18n-extract.mjs), applied wherever English would be shown. Missing entries stay English.
 */
export const LOCALES = ['tr', 'en', 'es', 'pt', 'de', 'fr', 'it', 'id'] as const
export type Locale = (typeof LOCALES)[number]
export const LOCALE_NAMES: Record<Locale, string> = {
  tr: 'Türkçe', en: 'English', es: 'Español', pt: 'Português (Brasil)', de: 'Deutsch', fr: 'Français', it: 'Italiano', id: 'Bahasa Indonesia',
}
const INTL: Record<Locale, string> = { tr: 'tr-TR', en: 'en-GB', es: 'es-ES', pt: 'pt-BR', de: 'de-DE', fr: 'fr-FR', it: 'it-IT', id: 'id-ID' }
export const currentLocale = signal<Locale>('tr')
const overlay = signal<Record<string, string> | null>(null)
const overlays = import.meta.glob<Record<string, string>>('./overlay/[a-z][a-z].json', { import: 'default' })

export const isLocale = (v: unknown): v is Locale => (LOCALES as readonly unknown[]).includes(v)
/** The code language under a display language: Turkish for tr, English for every other. */
export const baseLang = (l: Locale): Lang => (l === 'tr' ? 'tr' : 'en')

/** The device's language when the game has it, else English (Turkish only for Turkish devices). */
export function detectLocale(langs: readonly string[] = globalThis.navigator?.languages ?? [globalThis.navigator?.language ?? 'en']): Locale {
  for (const l of langs) {
    const code = String(l).toLowerCase().slice(0, 2)
    if (code === 'in') return 'id' // old Android code for Indonesian
    if (isLocale(code)) return code
  }
  return 'en'
}

/** Switch the display language; an overlay language loads its table lazily (re-renders on arrival). */
let overlayFor: Locale | null = null
export function setLocale(l: Locale): void {
  currentLocale.value = l
  currentLang.value = baseLang(l)
  if (overlayFor === l) return // already loaded or loading: no flash back to English
  overlayFor = l
  if (l === 'tr' || l === 'en') {
    overlay.value = null
    return
  }
  const load = overlays[`./overlay/${l}.json`]
  if (!load) {
    overlay.value = null
    return
  }
  overlay.value = null
  void load().then((o) => {
    if (currentLocale.peek() === l) overlay.value = o
  }).catch(() => {
    overlayFor = null
  })
}

/** An English string table in the display language (leaves through {@link loc}); other values kept. */
export function locTable<T>(table: T): T {
  if (!overlay.value) return table
  const walk = (v: unknown): unknown =>
    typeof v === 'string' ? loc(v) : v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]))
      : Array.isArray(v) ? v.map(walk) : v
  return walk(table) as T
}

/** Overlay keys with {0}, {1}… (English template literals) as regexes, built once per overlay. */
let patterns: { of: Record<string, string>; list: { re: RegExp; to: string; order: number[] }[]; hits: Map<string, string> } | null = null
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
function patternLoc(o: Record<string, string>, en: string): string {
  if (patterns?.of !== o) {
    const list = Object.keys(o)
      .filter((k) => /\{\d+\}/.test(k))
      .map((k) => ({
        re: new RegExp(`^${k.split(/\{\d+\}/).map(escRe).join('(.+?)')}$`, 's'),
        to: o[k]!,
        order: [...k.matchAll(/\{(\d+)\}/g)].map((m) => Number(m[1])),
      }))
    patterns = { of: o, list, hits: new Map() }
  }
  const hit = patterns.hits.get(en)
  if (hit !== undefined) return hit
  let out = en
  for (const p of patterns.list) {
    const m = p.re.exec(en)
    if (m) {
      // Capture groups follow the English order of {n}; the translation may reorder them.
      out = p.to.replace(/\{(\d+)\}/g, (s, i: string) => m[p.order.indexOf(Number(i)) + 1] ?? s)
      break
    }
  }
  if (patterns.hits.size < 5000) patterns.hits.set(en, out)
  return out
}

/** The display-language form of an English string (identity for tr/en or a missing entry). */
export function loc(en: string): string {
  const o = overlay.value
  return o ? (o[en] ?? patternLoc(o, en)) : en
}

/** QA pseudo-locale: accented, ~35% longer strings. Enable with ?pseudo=1 or Settings. */
export const pseudoLocale = signal<boolean>(
  (() => {
    try {
      return new URLSearchParams(globalThis.location?.search ?? '').get('pseudo') === '1'
    } catch {
      return false
    }
  })(),
)
const ps = (s: string): string => (pseudoLocale.value ? pseudoize(s) : s)
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

const pluralRules: Record<string, Intl.PluralRules> = {}
function plural(lang: string, n: number): Intl.LDMLPluralRule {
  return (pluralRules[lang] ??= new Intl.PluralRules(lang === 'tr' ? 'tr-TR' : 'en-GB')).select(n)
}

/** ICU subset: `{n, plural, =0 {none} one {# item} other {# items}}` (flat bodies). */
function icuPlural(template: string, vars: TVars, lang: string): string {
  return template.replace(/\{(\w+),\s*plural,((?:\s*(?:=\d+|zero|one|two|few|many|other)\s*\{[^{}]*\})+)\s*\}/g, (_m, k: string, body: string) => {
    const n = Number(vars[k])
    const cases = new Map<string, string>()
    for (const c of body.matchAll(/(=\d+|zero|one|two|few|many|other)\s*\{([^{}]*)\}/g)) cases.set(c[1]!, c[2]!)
    const pick = cases.get(`=${n}`) ?? cases.get(plural(lang, n)) ?? cases.get('other') ?? ''
    return pick.replace(/#/g, new Intl.NumberFormat(lang === 'tr' ? 'tr-TR' : 'en-GB').format(n))
  })
}

export function format(template: string, vars?: TVars, lang: string = currentLang.value): string {
  if (!vars) return template
  if (template.includes(', plural,')) template = icuPlural(template, vars, lang)
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
  return format(ps(lang === 'en' ? loc(s) : s), vars, lang)
}

/** Translate a dynamic key (built at runtime). Falls back to `fallback`. */
export function tx(key: string, vars?: TVars, fallback?: string): string {
  const lang = currentLang.value
  const s = lookup(lang, key) ?? lookup('tr', key)
  return s === undefined ? (fallback ?? key) : format(ps(lang === 'en' ? loc(s) : s), vars)
}

/** Pick the active language from an LText (or pass a plain string through). */
export function lt(text: LText | string | null | undefined, vars?: TVars): string {
  if (text == null) return ''
  const s = typeof text === 'string' ? text : currentLang.value === 'en' ? loc(text.en) : (text[currentLang.value] ?? text.tr)
  return format(ps(s), vars)
}

/** Locale-correct upper-casing (İ/ı in Turkish). */
export function upper(s: string, lang: Lang = currentLang.value): string {
  return s.toLocaleUpperCase(lang === 'tr' ? 'tr-TR' : 'en-US')
}

/** Intl locale for numbers and dates: the display language's own, when asked for the current one. */
export function locale(lang: Lang = currentLang.value): string {
  if (lang === 'tr') return 'tr-TR'
  return lang === currentLang.value ? INTL[currentLocale.value] : 'en-GB'
}

/** Tests only: install an overlay table directly. */
export function __setOverlayForTest(o: Record<string, string> | null): void {
  overlay.value = o
}
