/**
 * Sponsorship (GDD 4.7): offers by reputation/followers, one deal per
 * category (exclusivity), morality clauses that can terminate deals after a
 * scandal, and contract expiry. Weekly sponsor *income* is paid by the
 * economy tick (it sums `life.sponsors[].weekly`); this module only manages
 * the deals themselves.
 */
import type { Calendar, Hero, LText, Life, SponsorDeal } from '../../core/types'
import type { Rng } from '../../core/rng'
import { NEWS_SOURCES, clamp, fill, fmtMoney, lt, pushNews, type Lines } from '../career/common'
import { perkValue } from '../career/perks'
import { addStress } from './wellbeing'

export type SponsorCategory = SponsorDeal['category']

export const SPONSOR_CATEGORIES: readonly SponsorCategory[] = ['boots', 'watch', 'drink', 'fashion', 'gaming', 'car', 'cosmetics', 'food', 'jewelry', 'finance']
/** Concurrent sponsor deals are capped so the wider category list does not inflate income. */
export const MAX_ACTIVE_SPONSORS = 6

/** Localized category names. */
export const SPONSOR_CATEGORY_NAMES: Readonly<Record<SponsorCategory, LText>> = {
  boots: lt('Krampon', 'Boots'), watch: lt('Saat', 'Watch'), drink: lt('İçecek', 'Drinks'),
  fashion: lt('Moda', 'Fashion'), gaming: lt('Oyun', 'Gaming'), car: lt('Otomobil', 'Cars'),
  cosmetics: lt('Kozmetik', 'Cosmetics'), food: lt('Yiyecek', 'Food'), jewelry: lt('Takı', 'Jewelry'), finance: lt('Finans', 'Finance'),
}

export interface BrandDef {
  brand: string
  category: SponsorCategory
  /** 1 local, 2 national, 3 global: value multiplier 0.7 / 1 / 1.5. */
  tier: 1 | 2 | 3
  minReputation: number
  /** Morality clause strictness 0..1 (family brands are strict, edgy brands lenient). */
  strictness: number
}

/** Fictional brands (no real trademarks). */
export const BRANDS: readonly BrandDef[] = [
  { brand: 'Strada Kicks', category: 'boots', tier: 1, minReputation: 5, strictness: 0.3 },
  { brand: 'Velox Boots', category: 'boots', tier: 2, minReputation: 25, strictness: 0.5 },
  { brand: 'Apex Strike', category: 'boots', tier: 3, minReputation: 55, strictness: 0.6 },
  { brand: 'Kronos Time', category: 'watch', tier: 1, minReputation: 15, strictness: 0.4 },
  { brand: 'Valmont Genève', category: 'watch', tier: 2, minReputation: 40, strictness: 0.7 },
  { brand: 'Orbis Horology', category: 'watch', tier: 3, minReputation: 65, strictness: 0.9 },
  { brand: 'FizzUp', category: 'drink', tier: 1, minReputation: 8, strictness: 0.6 },
  { brand: 'Hydra Sport', category: 'drink', tier: 2, minReputation: 30, strictness: 0.8 },
  { brand: 'Volt Energy', category: 'drink', tier: 3, minReputation: 50, strictness: 0.3 },
  { brand: 'Urban Thread', category: 'fashion', tier: 1, minReputation: 10, strictness: 0.2 },
  { brand: 'Atelier Nero', category: 'fashion', tier: 2, minReputation: 35, strictness: 0.4 },
  { brand: 'Maison Lumière', category: 'fashion', tier: 3, minReputation: 60, strictness: 0.6 },
  { brand: 'PixelForge', category: 'gaming', tier: 1, minReputation: 10, strictness: 0.2 },
  { brand: 'Nexus Play', category: 'gaming', tier: 2, minReputation: 30, strictness: 0.4 },
  { brand: 'Titan Arena', category: 'gaming', tier: 3, minReputation: 55, strictness: 0.5 },
  { brand: 'Volta Motors', category: 'car', tier: 1, minReputation: 20, strictness: 0.5 },
  { brand: 'Kestrel Auto', category: 'car', tier: 2, minReputation: 40, strictness: 0.6 },
  { brand: 'Furia Automobili', category: 'car', tier: 3, minReputation: 70, strictness: 0.7 },
  { brand: 'Glimmer Lab', category: 'cosmetics', tier: 1, minReputation: 12, strictness: 0.3 },
  { brand: 'Aurelle Paris', category: 'cosmetics', tier: 2, minReputation: 38, strictness: 0.5 },
  { brand: 'Sofra Kitchen', category: 'food', tier: 1, minReputation: 6, strictness: 0.7 },
  { brand: 'Harvest Bowl', category: 'food', tier: 2, minReputation: 28, strictness: 0.8 },
  { brand: 'Lumen Gems', category: 'jewelry', tier: 2, minReputation: 36, strictness: 0.5 },
  { brand: 'Oro Regale', category: 'jewelry', tier: 3, minReputation: 62, strictness: 0.6 },
  { brand: 'Nimbus Bank', category: 'finance', tier: 2, minReputation: 32, strictness: 0.9 },
  { brand: 'Zenit Capital', category: 'finance', tier: 3, minReputation: 58, strictness: 0.9 },
]

export const BRAND_BY_NAME: Readonly<Record<string, BrandDef>> = Object.fromEntries(BRANDS.map((b) => [b.brand, b]))

const TIER_MULT = { 1: 0.7, 2: 1, 3: 1.5 } as const

/**
 * Weekly sponsor value. 150 × e^(0.055·rep): rep 10 → ~260, rep 50 → ~2.3K,
 * rep 80 → ~12K, rep 100 → ~37K per week before multipliers — a global
 * superstar's portfolio (6 categories × tier 3 × followers) lands near
 * 0.4–0.6M/week, on par with a top wage. (Balance pass: was 200·e^(0.065·rep),
 * i.e. 2M+/week at rep 100 — sponsors out-earned football ten to one.) Followers add up to +75% (log scale above
 * 10K), perks `sponsor_value` stack on top.
 */
export function sponsorWeeklyValue(hero: Pick<Hero, 'reputation' | 'perks'>, life: Pick<Life, 'followers'>, tier: 1 | 2 | 3): number {
  const base = 150 * Math.exp(0.055 * clamp(hero.reputation, 0, 100))
  const fol = 1 + clamp(Math.log10(Math.max(1, life.followers) / 10000), 0, 3) * 0.25
  const v = base * TIER_MULT[tier] * fol * (1 + perkValue(hero, 'sponsor_value'))
  return Math.round(v / 10) * 10
}

export interface SponsorOffer {
  deal: SponsorDeal
  /** One-off payment on signing (4 weeks of value). */
  signingBonus: number
  seasons: number
  strictness: number
}

/** Categories the hero already has a deal in. */
export const heldCategories = (life: Life): Set<SponsorCategory> => new Set(life.sponsors.map((s) => s.category))

/**
 * Generate 0–3 sponsor offers (call weekly or after big matches).
 * Chance of any offer: 8% + rep/250 (+5% if followers ≥ 100K) → ~10% for a
 * nobody, ~35% for a star. Only brands whose `minReputation` the hero meets and
 * whose category is free; the best affordable tier is favoured.
 */
export function sponsorOffers(rng: Rng, hero: Hero, life: Life, ctx: { season: number }): SponsorOffer[] {
  let p = 0.08 + hero.reputation / 250
  if (life.followers >= 100000) p += 0.05
  if (!rng.chance(p)) return []
  if (life.sponsors.length >= MAX_ACTIVE_SPONSORS) return []
  const held = heldCategories(life)
  const eligible = BRANDS.filter((b) => !held.has(b.category) && b.minReputation <= hero.reputation)
  if (eligible.length === 0) return []
  const n = Math.min(eligible.length, rng.weighted([1, 2, 3], (k) => (k === 1 ? 6 : k === 2 ? 3 : 1)))
  const pool = [...eligible]
  const out: SponsorOffer[] = []
  const usedCats = new Set<SponsorCategory>()
  while (out.length < n && pool.length > 0) {
    const b = rng.weighted(pool, (x) => x.tier * x.tier)
    pool.splice(pool.indexOf(b), 1)
    if (usedCats.has(b.category)) continue
    usedCats.add(b.category)
    const seasons = rng.int(1, 3)
    // ±15% haggling noise so two offers from the same tier differ.
    const weekly = Math.round((sponsorWeeklyValue(hero, life, b.tier) * rng.range(0.85, 1.15)) / 10) * 10
    out.push({
      deal: { id: rng.id('sp'), brand: b.brand, category: b.category, weekly, untilSeason: ctx.season + seasons - 1, minReputation: b.minReputation },
      signingBonus: weekly * 4,
      seasons,
      strictness: b.strictness,
    })
  }
  return out
}

/** Accept an offer: enforces exclusivity, pays the signing bonus. */
export function acceptSponsor(life: Life, offer: SponsorOffer): { ok: boolean; lines: Lines } {
  if (heldCategories(life).has(offer.deal.category)) {
    return { ok: false, lines: [fill(lt('Zaten bir {c} sponsorun var; münhasırlık maddesi buna izin vermiyor.', 'You already have a {c} sponsor; exclusivity forbids another.'), { c: SPONSOR_CATEGORY_NAMES[offer.deal.category] })] }
  }
  if (life.sponsors.length >= MAX_ACTIVE_SPONSORS) {
    return { ok: false, lines: [lt('Sponsor kotan dolu (en fazla 6 anlaşma).', 'Your sponsor slots are full (max 6 deals).')] }
  }
  life.sponsors.push({ ...offer.deal })
  life.money += offer.signingBonus
  return {
    ok: true,
    lines: [fill(lt('✍️ {b} ile anlaştın: haftalık {w}, imza bonusu {s}.', '✍️ Signed with {b}: {w}/week, signing bonus {s}.'), { b: offer.deal.brand, w: fmtMoney(offer.deal.weekly), s: fmtMoney(offer.signingBonus) })],
  }
}

/** Strictness of a deal's brand (0.5 for unknown brands). */
export const dealStrictness = (deal: SponsorDeal): number => BRAND_BY_NAME[deal.brand]?.strictness ?? 0.5

/** Four-level scandal scale (2.4#85). Level 4 ends every deal and costs reputation. */
export type ScandalLevel = 1 | 2 | 3 | 4
export const SCANDAL_LEVELS: Readonly<Record<ScandalLevel, LText>> = {
  1: lt('Gaf', 'Gaffe'),
  2: lt('Tartışma', 'Controversy'),
  3: lt('Skandal', 'Scandal'),
  4: lt('Rezalet', 'Disgrace'),
}

/**
 * Morality clause check after a scandal of severity 1 (minor: nightclub photo),
 * 2 (public fight, gambling leak) or 3 (betting scandal, arrest).
 * Termination chance per deal = strictness × severity / 3 → severity 3 always
 * ends strict brands (strictness 1) and ends ~30% of lenient ones.
 * Severity 4 (disgrace: criminal case, match-fixing) terminates every deal.
 */
export function checkMoralityClause(rng: Rng, life: Life, hero: Hero, severity: ScandalLevel, calendar: Calendar): { terminated: SponsorDeal[]; lines: Lines } {
  const terminated: SponsorDeal[] = []
  const lines: Lines = []
  life.sponsors = life.sponsors.filter((d) => {
    if (severity >= 4 || rng.chance(clamp((dealStrictness(d) * severity) / 3, 0, 1))) {
      terminated.push(d)
      return false
    }
    return true
  })
  for (const d of terminated) {
    lines.push(fill(lt('❌ {b} davranış maddesi gerekçesiyle sponsorluğu feshetti.', '❌ {b} terminated your deal citing the morality clause.'), { b: d.brand }))
    pushNews(life, rng, calendar, fill(lt('{b}, {n} ile yollarını ayırdı', '{b} drops {n} after scandal'), { b: d.brand, n: hero.nickname }), -1, rng.pick(NEWS_SOURCES))
  }
  if (terminated.length > 0) addStress(life, hero, 4 * terminated.length)
  return { terminated, lines }
}

/**
 * Weekly upkeep of deals: removes expired contracts (untilSeason < season) and
 * warns once per deal when reputation sinks 15+ below the brand's threshold
 * (the brand will not renew; events may terminate early).
 */
export function weeklySponsorTick(hero: Hero, life: Life, calendar: Calendar): Lines {
  const lines: Lines = []
  life.sponsors = life.sponsors.filter((d) => {
    if (d.untilSeason < calendar.season) {
      lines.push(fill(lt('{b} sponsorluk sözleşmen sona erdi.', 'Your {b} sponsorship has expired.'), { b: d.brand }))
      return false
    }
    const key = `sponsor_warned_${d.id}`
    if (hero.reputation < d.minReputation - 15 && !life.flags[key]) {
      life.flags[key] = true
      lines.push(fill(lt('{b}, düşen popülerliğinden rahatsız.', '{b} is unhappy with your falling profile.'), { b: d.brand }))
    }
    return true
  })
  return lines
}

/**
 * Fee for a sponsor photo/ad shoot: half a week of the best deal's value
 * (shoots are occasional extras, not a second salary). 0 without deals.
 */
export function sponsorShootPay(life: Life): number {
  let best = 0
  for (const d of life.sponsors) best = Math.max(best, d.weekly)
  return Math.round(best * 0.5)
}
