/**
 * Shared helpers for the career & life simulation layers.
 *
 * Kept deliberately tiny and dependency-free so every career/life module can
 * import it without creating cycles. Nothing here touches the RNG except
 * {@link pushNews} (which needs an id).
 */
import { replaceWithSuffix } from './trSuffix'
import type { Calendar, Hero, LText, Life, LogEntry, NewsItem, SeasonStats } from '../../core/types'
import { START_YEAR } from '../../core/config'
import type { Rng } from '../../core/rng'

/** Feedback lines returned by simulation functions for the UI log / toasts. */
export type Lines = LText[]

/** Build a localized text. Turkish first (source language), English second. */
export const lt = (tr: string, en: string): LText => ({ tr, en })

/**
 * Fill `{name}` style placeholders in both languages.
 * Numbers are inserted as-is; format them beforehand with {@link fmtMoney}/{@link fmtNum}.
 */
export function fill(t: LText, vars: Record<string, string | number | LText>): LText {
  const rep = (s: string, lang: 'tr' | 'en') =>
    s.replace(/\{(\w+)\}/g, (m, k: string) => {
      const v = vars[k]
      if (v === undefined) return m
      return typeof v === 'object' ? v[lang] : String(v)
    })
  // Turkish: a case suffix after a name placeholder is re-inflected ({n}'ın → Efe'nin).
  const trText = replaceWithSuffix(t.tr, (k, spec) => {
    const v = vars[k]
    if (v === undefined || spec !== undefined) return undefined
    return typeof v === 'object' ? { text: v.tr, isName: true } : { text: String(v), isName: typeof v === 'string' }
  })
  return { tr: trText, en: rep(t.en, 'en') }
}

/** Currency symbol used in generated text. Change here to rebrand the economy. */
export const CURRENCY = '€'

/** Compact money string in both locales: TR "1,2 Mn €", EN "€1.2M". */
export function fmtMoney(n: number): LText {
  const sign = n < 0 ? '-' : ''
  const a = Math.abs(n)
  let tr: string
  let en: string
  if (a >= 1e9) {
    tr = `${(a / 1e9).toFixed(1).replace('.', ',')} Mr`
    en = `${(a / 1e9).toFixed(1)}B`
  } else if (a >= 1e6) {
    tr = `${(a / 1e6).toFixed(1).replace('.', ',')} Mn`
    en = `${(a / 1e6).toFixed(1)}M`
  } else if (a >= 1e4) {
    tr = `${Math.round(a / 1e3)} Bin`
    en = `${Math.round(a / 1e3)}K`
  } else {
    tr = Math.round(a).toLocaleString('tr-TR')
    en = Math.round(a).toLocaleString('en-US')
  }
  return { tr: `${sign}${tr} ${CURRENCY}`, en: `${sign}${CURRENCY}${en}` }
}

/** Compact count (followers etc.): TR "1,2 Mn", EN "1.2M". */
export function fmtNum(n: number): LText {
  const a = Math.abs(Math.round(n))
  if (a >= 1e6) return { tr: `${(a / 1e6).toFixed(1).replace('.', ',')} Mn`, en: `${(a / 1e6).toFixed(1)}M` }
  if (a >= 1e3) return { tr: `${(a / 1e3).toFixed(1).replace('.', ',')} B`, en: `${(a / 1e3).toFixed(1)}K` }
  return { tr: String(a), en: String(a) }
}

/** Signed delta string "+3" / "-2" (same in both languages). */
export const signed = (n: number): string => (n >= 0 ? `+${Math.round(n)}` : `${Math.round(n)}`)

export const clamp = (v: number, min: number, max: number): number => (v < min ? min : v > max ? max : v)
/** Clamp to a 0..100 meter and drop non-finite values back to `fallback`. */
export const meter = (v: number, fallback = 50): number => (Number.isFinite(v) ? clamp(v, 0, 100) : fallback)

/**
 * Absolute week index on a 52-week-per-year timeline. Independent from the
 * league length (the world module decides how many weeks a season has), so it
 * is safe for cooldowns, "last contact" timestamps and loan schedules.
 */
export const absWeek = (cal: Pick<Calendar, 'season' | 'week'>): number => (cal.season - START_YEAR) * 52 + cal.week

/** Age of the hero during the given season (birthday assumed before season start). */
export const heroAge = (hero: Pick<Hero, 'birthYear'>, season: number): number => season - hero.birthYear

/**
 * Fame saturates: a positive reputation gain is scaled by (1 − rep/100), so
 * the climb from 80 to 90 takes as long as from 20 to 50 (balance pass,
 * docs/BALANCE.md — nearly every career used to hit 100 by 21). Losses apply in full.
 */
export const fameGain = (rep: number, amount: number): number =>
  amount > 0 ? amount * Math.max(0, 1 - clamp(rep, 0, 100) / 100) : amount

/** Legal age for gambling, betting and alcohol-themed nightlife (casino, nightclub, their events). */
export const ADULT_AGE = 18
/** True once the hero may gamble / go clubbing. */
export const isAdult = (hero: Pick<Hero, 'birthYear'>, season: number): boolean => heroAge(hero, season) >= ADULT_AGE

/**
 * Nominal number of weeks in a season used to convert per-season tuning into
 * per-week rates. GDD: 38–46 weeks. Rates are robust to ±15% mismatches.
 */
export const NOMINAL_SEASON_WEEKS = 44

/** Max log entries kept in the save (oldest dropped). */
export const MAX_LOG = 400
/** Max news items kept in the save. */
export const MAX_NEWS = 120

/** Append to the life log (most recent last) and return the text for chaining. */
export function pushLog(life: Life, cal: Calendar, text: LText, kind?: LogEntry['kind'], icon?: string): LText {
  life.log.push({ season: cal.season, week: cal.week, day: cal.day, text, kind, icon })
  if (life.log.length > MAX_LOG) life.log.splice(0, life.log.length - MAX_LOG)
  return text
}

/** Append a headline to the news feed (most recent last). */
export function pushNews(
  life: Life,
  rng: Rng,
  cal: Calendar,
  headline: LText,
  sentiment: NewsItem['sentiment'],
  source = 'StarPath Sport',
  body?: LText,
): NewsItem {
  const item: NewsItem = { id: rng.id('n'), season: cal.season, week: cal.week, headline, sentiment, source, body }
  life.news.push(item)
  if (life.news.length > MAX_NEWS) life.news.splice(0, life.news.length - MAX_NEWS)
  return item
}

/** Fresh zeroed stats block. */
export function emptyStats(): SeasonStats {
  return {
    apps: 0, starts: 0, minutes: 0, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, passes: 0,
    passesCompleted: 0, tackles: 0, dribbles: 0, yellow: 0, red: 0, cleanSheets: 0, saves: 0, ratingSum: 0, motm: 0,
  }
}

/** Fictional newspaper / outlet names used as news sources. */
export const NEWS_SOURCES = ['Gol Postası', 'Tribün Gazetesi', 'Sport Daily Star', 'Futbol Ekspres', 'The Touchline', 'Saha Kenarı'] as const

/** Safe number: replaces NaN/Infinity with a fallback (defensive for save data). */
export const finite = (v: number, fallback = 0): number => (Number.isFinite(v) ? v : fallback)
