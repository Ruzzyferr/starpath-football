/**
 * Formatters. Pure functions; language comes from i18n's currentLang unless
 * passed explicitly (tests pass it).
 *
 * CURRENCY DECISION: the game world is fictional but money uses the euro sign
 * (€) — universally understood, no exchange-rate confusion, and no fictional
 * symbol to learn. Change CURRENCY below to re-skin (e.g. 'SP$').
 *   tr: "12.500 €", "1,2 Mn €", "850 B €"
 *   en: "€12,500", "€1.2M", "€850K"
 */
import type { Calendar, Lang } from '../core/types'
import { signal } from '@preact/signals'
import { currentLang } from '../i18n'
import type { StatKey } from './store'

export const CURRENCY = { symbol: '€', trailingInTr: true }

/** 2.5#1: how money is written. 'symbol' = €, 'code' = EUR, 'star' = the fictional Star unit. UI amounts only. */
export type MoneyStyle = 'symbol' | 'code' | 'star'
export const MONEY_SYMBOLS: Record<MoneyStyle, string> = { symbol: '€', code: 'EUR', star: '✦' }
export const moneyStyle = signal<MoneyStyle>('symbol')
export function setMoneyStyle(s: MoneyStyle): void {
  moneyStyle.value = s
}

const nf = (lang: Lang, opts?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat(lang === 'tr' ? 'tr-TR' : 'en-GB', opts)

export function formatNumber(n: number, lang: Lang = currentLang.value, digits = 0): string {
  return nf(lang, { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(n)
}

/** 1234 → "1,2 B" (tr) / "1.2K" (en). Below 10k returns full number. */
export function formatCompact(n: number, lang: Lang = currentLang.value, threshold = 10_000): string {
  const abs = Math.abs(n)
  if (abs < threshold) return formatNumber(n, lang)
  const units = lang === 'tr' ? ['', ' B', ' Mn', ' Mr'] : ['', 'K', 'M', 'B']
  let i = 0
  let v = abs
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000
    i++
  }
  const digits = v < 10 ? 1 : 0
  const s = nf(lang, { maximumFractionDigits: digits }).format(v) + units[i]
  return n < 0 ? '−' + s : s
}

export interface MoneyOpts {
  compact?: boolean
  /** Show + for positive values (delta). */
  sign?: boolean
  lang?: Lang
}

export function formatMoney(n: number, opts: MoneyOpts = {}): string {
  const lang = opts.lang ?? currentLang.value
  const abs = Math.abs(Math.round(n))
  const body = opts.compact ? formatCompact(abs, lang, 100_000) : formatNumber(abs, lang)
  const sign = n < 0 ? '−' : opts.sign && n > 0 ? '+' : ''
  const st = moneyStyle.value
  const symbol = st === 'symbol' ? CURRENCY.symbol : MONEY_SYMBOLS[st]
  if (st === 'code') return `${sign}${body} ${symbol}`
  if (lang === 'tr' && CURRENCY.trailingInTr && st === 'symbol') return `${sign}${body} ${symbol}`
  return `${sign}${symbol}${body}`
}

export function formatSigned(n: number, lang: Lang = currentLang.value, digits = 0): string {
  if (n === 0) return '0'
  const s = formatNumber(Math.abs(n), lang, digits)
  return (n > 0 ? '+' : '−') + s
}

export function formatPercent(fraction: number, lang: Lang = currentLang.value, digits = 0): string {
  const v = digits > 0 ? formatNumber(fraction * 100, lang, digits) : String(Math.round(fraction * 100))
  return lang === 'tr' ? `%${v}` : `${v}%`
}

export function formatRating(r: number, lang: Lang = currentLang.value): string {
  return nf(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(r)
}

export function seasonLabel(season: number): string {
  return `${season}/${String((season + 1) % 100).padStart(2, '0')}`
}

export function ageOf(birthYear: number, cal: Calendar): number {
  // Season runs Aug→May; birthdays assumed Jan 1 → after week ~20 we're in season+1.
  const year = cal.week >= 20 ? cal.season + 1 : cal.season
  return year - birthYear
}

export function formatDuration(sec: number, lang: Lang = currentLang.value): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return lang === 'tr' ? `${h} sa ${m} dk` : `${h}h ${m}m`
}

export function formatTimestamp(ms: number, lang: Lang = currentLang.value): string {
  return new Intl.DateTimeFormat(lang === 'tr' ? 'tr-TR' : 'en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(ms))
}

/** Format a Delta value for chips: money as currency, others as signed ints. */
export function formatDelta(key: StatKey, value: number, lang: Lang = currentLang.value): string {
  if (key === 'money') return formatMoney(value, { sign: true, compact: Math.abs(value) >= 100_000, lang })
  if (key === 'followers') return (value > 0 ? '+' : value < 0 ? '−' : '') + formatCompact(Math.abs(value), lang)
  return formatSigned(value, lang)
}

/** Stats where an increase is BAD (stress, fatigue, addiction). */
export const NEGATIVE_STATS: ReadonlySet<StatKey> = new Set<StatKey>(['stress', 'fatigue', 'addiction'])
export function deltaTone(key: StatKey, value: number): 'pos' | 'neg' | 'neutral' {
  if (value === 0) return 'neutral'
  const good = NEGATIVE_STATS.has(key) ? value < 0 : value > 0
  return good ? 'pos' : 'neg'
}

// ── Scales ──────────────────────────────────────────────────────────────
export type Tier = 'bronze' | 'silver' | 'gold' | 'elite' | 'legend'
export function tierOf(ovr: number): Tier {
  if (ovr >= 92) return 'legend'
  if (ovr >= 85) return 'elite'
  if (ovr >= 75) return 'gold'
  if (ovr >= 65) return 'silver'
  return 'bronze'
}

/** 1..6 bucket for the attribute colour scale (--attr-N). */
export function attrBucket(v: number): 1 | 2 | 3 | 4 | 5 | 6 {
  if (v >= 90) return 6
  if (v >= 80) return 5
  if (v >= 70) return 4
  if (v >= 55) return 3
  if (v >= 40) return 2
  return 1
}
export function attrColor(v: number): string {
  return `var(--attr-${attrBucket(v)})`
}

/** Match rating 0..10 → colour variable. */
export function ratingColor(r: number): string {
  if (r >= 8.5) return 'var(--attr-6)'
  if (r >= 7.5) return 'var(--attr-5)'
  if (r >= 6.8) return 'var(--attr-4)'
  if (r >= 6.0) return 'var(--attr-3)'
  if (r >= 5.0) return 'var(--attr-2)'
  return 'var(--attr-1)'
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/** "Mehmet Yılmazoğlu" → "M. Yılmazoğlu" */
export function shortName(first: string, last: string): string {
  return first ? `${first[0]}. ${last}` : last
}

export function initials(name: string, lang: Lang = currentLang.value): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toLocaleUpperCase(lang === 'tr' ? 'tr-TR' : 'en-US'))
    .join('')
}
