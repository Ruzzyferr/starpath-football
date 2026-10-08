/**
 * Undo for asset sales (2.7#48). The sim has no "un-sell"; this records what a
 * sale removed and puts it back, taking the proceeds out again. Valid only
 * until the next sale or a few moments later (the UI shows a 6 s toast).
 */
import type { GameState, OwnedAsset } from '../../core/types'
import { ASSET_BY_ID } from '../../data/assets'
import { resaleValue } from '../life/economy'

export interface SaleReceipt {
  index: number
  asset: OwnedAsset
  amount: number
}

/** Snapshot the sale of `index` (call BEFORE selling). Null when there is nothing to sell. */
export function captureSale(state: Pick<GameState, 'life' | 'calendar'>, index: number): SaleReceipt | null {
  const owned = state.life.assets[index]
  const def = owned ? ASSET_BY_ID[owned.defId] : undefined
  if (!owned || !def) return null
  return { index, asset: { ...owned }, amount: resaleValue(owned, def, state.calendar) }
}

/** Restore a sold asset. False when the proceeds were already spent or the item is back. */
export function undoSale(state: Pick<GameState, 'life'>, r: SaleReceipt): boolean {
  const l = state.life
  if (l.assets.some((o) => o.defId === r.asset.defId)) return false
  if (l.money < r.amount) return false
  l.money -= r.amount
  l.assets.splice(Math.min(r.index, l.assets.length), 0, { ...r.asset })
  return true
}
