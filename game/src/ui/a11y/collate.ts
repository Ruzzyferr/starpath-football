import { currentLang } from '../../i18n'

const cache = new Map<string, Intl.Collator>()

/** Locale-aware collator (Turkish dotted/dotless i, ç ğ ö ş ü order). */
export function collator(lang: string = currentLang.value): Intl.Collator {
  const loc = lang === 'tr' ? 'tr' : 'en'
  let c = cache.get(loc)
  if (!c) {
    c = new Intl.Collator(loc, { sensitivity: 'base', numeric: true })
    cache.set(loc, c)
  }
  return c
}

/** Compare two display strings using the active language. */
export const compareText = (a: string, b: string, lang?: string): number => collator(lang).compare(a, b)

/**
 * Accent- and case-insensitive key for search boxes: "tur" finds "Türkiye",
 * "istanbul" finds "İstanbul", "cagla" finds "Çağla" — players often type
 * without Turkish letters on a foreign keyboard.
 */
export function foldSearch(text: string): string {
  return text
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}
