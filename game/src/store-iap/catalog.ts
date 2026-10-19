/**
 * Data-driven product catalogue (docs/MONETIZASYON.md §5). Product id === store SKU.
 * Free to play: the whole career is open. Nothing sold changes a match result or an in-match stat:
 * diamonds buy training-speed gear and cosmetics, cash packs top up the career wallet.
 * `storeType` / `consumable` must match how each id is created in Play Console / App Store Connect.
 */
export const FULL_CAREER = 'full_career' as const

export type CosmeticKind = 'celebration' | 'accessory' | 'bootColor' | 'kitTrim'

export type ProductKind = 'unlock' | 'cosmetic' | 'gems' | 'cash' | 'pass' | 'starter'

export interface ProductDef {
  id: string
  kind: ProductKind
  /** inapp (one-time / consumable) or subs (auto-renewing subscription). */
  storeType: 'inapp' | 'subs'
  /** Consumable: can be bought again and is not restored (diamonds, cash). */
  consumable: boolean
  /** Diamonds granted (gems, starter). */
  gems?: number
  /** Cash pack: weeks of the hero's current gross wage, at least `cashFloor`. */
  cashWeeks?: number
  cashFloor?: number
  /** Gear given to the active career (starter pack). */
  gear?: string
  /** Shown as the store's highlighted pack. */
  badge?: 'popular' | 'best'
  /** No longer sold; kept so old purchase records still parse. */
  retired?: boolean
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
    storeType: 'inapp',
    consumable: false,
    retired: true,
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
    storeType: 'inapp',
    consumable: false,
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
    storeType: 'inapp',
    consumable: false,
    name: { tr: 'Avatar Ekstraları', en: 'Avatar Extras' },
    desc: {
      tr: 'Ek avatar aksesuarları. Yalnızca görünüm.',
      en: 'Extra avatar accessories. Cosmetic only.',
    },
    icon: '🕶️',
    fallbackPrice: '€1.99',
    cosmetics: { accessory: [4, 5] },
  },
  {
    id: 'starter_pack',
    kind: 'starter',
    storeType: 'inapp',
    consumable: false,
    gems: 300,
    gear: 'gold_boots',
    name: { tr: 'Başlangıç Paketi', en: 'Starter Pack' },
    desc: {
      tr: '300💎 + Altın Krampon (60 maç, antrenman XP’si +%15). Hesap başına bir kez.',
      en: '300💎 + Golden Boots (60 matches, training XP +15%). Once per account.',
    },
    icon: '🎁',
    fallbackPrice: '€0.99',
  },
  ...([
    ['gems_s', 220, '€1.99', undefined],
    ['gems_m', 600, '€4.99', 'popular'],
    ['gems_l', 1300, '€9.99', undefined],
    ['gems_xl', 2800, '€19.99', undefined],
    ['gems_xxl', 7500, '€49.99', 'best'],
  ] as const).map(([id, gems, price, badge]): ProductDef => ({
    id,
    kind: 'gems',
    storeType: 'inapp',
    consumable: true,
    gems,
    badge,
    name: { tr: `${gems.toLocaleString('tr-TR')} Elmas`, en: `${gems.toLocaleString('en-GB')} Diamonds` },
    desc: { tr: 'Ekipman, fizyoterapi ve kozmetik için.', en: 'For gear, physio and cosmetics.' },
    icon: '💎',
    fallbackPrice: price,
  })),
  ...([
    ['cash_s', 4, 5_000, '€1.99'],
    ['cash_m', 12, 15_000, '€4.99'],
    ['cash_l', 30, 40_000, '€9.99'],
  ] as const).map(([id, weeks, floor, price]): ProductDef => ({
    id,
    kind: 'cash',
    storeType: 'inapp',
    consumable: true,
    cashWeeks: weeks,
    cashFloor: floor,
    name: { tr: `${weeks} Haftalık Maaş`, en: `${weeks} Weeks’ Wages` },
    desc: {
      tr: `Kariyer cüzdanına ${weeks} haftalık brüt maaşın (en az €${floor.toLocaleString('tr-TR')}). Gerçek paraya çevrilemez.`,
      en: `${weeks} weeks of your gross wage into your career wallet (at least €${floor.toLocaleString('en-GB')}). Cannot be turned back into real money.`,
    },
    icon: '💶',
    fallbackPrice: price,
  })),
  {
    id: 'pro_contract',
    kind: 'pass',
    storeType: 'subs',
    consumable: false,
    gems: 50,
    name: { tr: 'Pro Sözleşme', en: 'Pro Contract' },
    desc: {
      tr: 'Aylık abonelik: her gün 50💎 (o gün açınca), ödüllü reklamların ödülü reklamsız, Pro rozeti. Maç veya XP avantajı yok. İstediğin an iptal.',
      en: 'Monthly subscription: 50💎 every day (claimed when you open the game that day), rewarded-ad rewards without the ad, a Pro badge. No match or XP advantage. Cancel any time.',
    },
    icon: '⭐',
    fallbackPrice: '€4.99',
  },
]

export const PRODUCT_BY_ID: Readonly<Record<string, ProductDef>> = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]))
export const COSMETIC_PRODUCTS = PRODUCTS.filter((p) => p.kind === 'cosmetic')
export const PRODUCT_IDS: readonly string[] = PRODUCTS.map((p) => p.id)
/** Products on sale (retired ones are kept only for old records). */
export const SALE_PRODUCTS = PRODUCTS.filter((p) => !p.retired)
export const productsOfKind = (...kinds: ProductKind[]): ProductDef[] => SALE_PRODUCTS.filter((p) => kinds.includes(p.kind))

/** Pack that gates a cosmetic option, if any (options no pack lists are free). */
export function packFor(kind: CosmeticKind, option: string | number): ProductDef | undefined {
  return COSMETIC_PRODUCTS.find((p) => p.cosmetics?.[kind]?.includes(option))
}
