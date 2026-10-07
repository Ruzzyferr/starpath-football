/**
 * Data-driven product catalogue. Product id === entitlement id === store SKU
 * (create the same ids in Play Console / App Store Connect as non-consumable
 * in-app products). Nothing here can affect stats or match outcomes: the only
 * non-cosmetic product is the one-time "Full Career" unlock, which gates the
 * calendar (never the simulation).
 */
export const FULL_CAREER = 'full_career' as const

export type CosmeticKind = 'celebration' | 'accessory' | 'bootColor' | 'kitTrim'

export interface ProductDef {
  id: string
  kind: 'unlock' | 'cosmetic'
  name: { tr: string; en: string }
  desc: { tr: string; en: string }
  icon: string
  /** Shown when the store cannot report a localised price (never charged from this). */
  fallbackPrice: string
  /** Cosmetic options this pack unlocks (ids understood by the owning feature). */
  cosmetics?: Partial<Record<CosmeticKind, readonly (string | number)[]>>
}

export const PRODUCTS: readonly ProductDef[] = [
  {
    id: FULL_CAREER,
    kind: 'unlock',
    name: { tr: 'Tam Kariyer', en: 'Full Career' },
    desc: {
      tr: 'Tek seferlik satın alma: kariyerini sınırsız sezon boyunca sürdür. Abonelik yok, reklam yok.',
      en: 'One-time purchase: play your career for as many seasons as you like. No subscription, no ads.',
    },
    icon: '🏆',
    fallbackPrice: '€7.99',
  },
  {
    id: 'pack_celebrations',
    kind: 'cosmetic',
    name: { tr: 'Gol Sevinci Paketi', en: 'Celebration Pack' },
    desc: {
      tr: 'Beş gol sevincini hemen aç. Yalnızca görünüm: maç sonuçlarını etkilemez.',
      en: 'Unlock five goal celebrations right away. Cosmetic only: never affects results.',
    },
    icon: '🎉',
    fallbackPrice: '€1.99',
    cosmetics: { celebration: ['shush', 'corner_flag', 'backflip', 'heart_hands', 'cartwheel'] },
  },
  {
    id: 'pack_avatar',
    kind: 'cosmetic',
    name: { tr: 'Avatar Ekstraları', en: 'Avatar Extras' },
    desc: {
      tr: 'Ek avatar aksesuarları. Yalnızca görünüm.',
      en: 'Extra avatar accessories. Cosmetic only.',
    },
    icon: '🕶️',
    fallbackPrice: '€1.99',
    cosmetics: { accessory: [4, 5] },
  },
]

export const PRODUCT_BY_ID: Readonly<Record<string, ProductDef>> = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]))
export const COSMETIC_PRODUCTS = PRODUCTS.filter((p) => p.kind === 'cosmetic')
export const PRODUCT_IDS: readonly string[] = PRODUCTS.map((p) => p.id)

/** Pack that gates a cosmetic option, if any (options no pack lists are free). */
export function packFor(kind: CosmeticKind, option: string | number): ProductDef | undefined {
  return COSMETIC_PRODUCTS.find((p) => p.cosmetics?.[kind]?.includes(option))
}
