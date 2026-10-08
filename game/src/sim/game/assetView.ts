/** Collection-shelf numbers for an owned asset (2.7#86): condition and second-hand value. */
import type { AssetDef, Calendar, OwnedAsset } from '../../core/types'
import { absWeek } from '../career/common'
import { resaleValue } from '../life/economy'

/** Condition lost per year of ownership, by category; fixed assets are maintained (0). */
const WEAR_PER_YEAR: Readonly<Record<AssetDef['category'], number>> = {
  car: 9, tech: 22, fashion: 14, watch: 3, pet: 0, boat: 7, jet: 6, house: 0, island: 0, art: 0, business: 0, facility: 2,
}
const FLOOR = 35

export interface ShelfInfo {
  /** 35..100 */
  condition: number
  resale: number
  /** resale / paid, 0..n */
  valueRatio: number
}

export function shelfInfo(o: OwnedAsset, def: AssetDef, cal: Pick<Calendar, 'season' | 'week'>): ShelfInfo {
  const years = Math.max(0, absWeek(cal) - absWeek({ season: o.boughtSeason, week: o.boughtWeek })) / 52
  const condition = Math.round(Math.max(FLOOR, 100 - WEAR_PER_YEAR[def.category] * years))
  const resale = resaleValue(o, def, cal)
  return { condition, resale, valueRatio: o.pricePaid > 0 ? resale / o.pricePaid : 0 }
}
