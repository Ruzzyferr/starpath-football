/**
 * Purchase adapter interface. Steam/desktop is premium (no IAP, no provider).
 */
import { PRODUCTS, PRODUCT_BY_ID } from './catalog'

export interface StoreProduct {
  id: string
  /** Localised, store-formatted price ("€7,99", "₺149,99"). Shown as is. */
  priceString: string
}

export type PurchaseError = 'cancelled' | 'unavailable' | 'failed' | 'offline' | 'rejected'
export interface PurchaseResult {
  ok: boolean
  error?: PurchaseError
}

/** What the store hands back after a payment, for the shop server to verify. */
export interface StoreReceipt {
  productId: string
  /** iOS StoreKit 2 signed transaction. */
  jws?: string
  /** Android Play Billing token. */
  purchaseToken?: string
  /** Dev store (no money, accepted only by a dev server). */
  dev?: boolean
  /** Acknowledge / consume / finish once the server has credited it. */
  finish(): Promise<void>
}

export interface BuyResult extends PurchaseResult {
  receipt?: StoreReceipt
}

export interface PurchaseProvider {
  readonly id: string
  /** Real money moves through this provider. */
  readonly real: boolean
  products(): Promise<StoreProduct[]>
  /** `accountId` (UUID) is attached to the purchase (appAccountToken) so only this account can redeem it. */
  buy(id: string, accountId: string): Promise<BuyResult>
  /** Receipts for what the store account owns (non-consumables, active subscriptions), to re-verify. */
  restore(): Promise<StoreReceipt[]>
}

const DEV_STORE_KEY = 'starpath.devstore.v1'

/** Instant-success fake store for web / dev. Remembers "purchases" like a store account would. */
export class DevProvider implements PurchaseProvider {
  readonly id = 'dev'
  readonly real = false
  async products(): Promise<StoreProduct[]> {
    return PRODUCTS.map((p) => ({ id: p.id, priceString: p.fallbackPrice }))
  }
  private read(): string[] {
    try {
      const a = JSON.parse(globalThis.localStorage?.getItem(DEV_STORE_KEY) ?? '[]') as unknown
      return Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string') : []
    } catch {
      return []
    }
  }
  async buy(id: string): Promise<BuyResult> {
    const def = PRODUCT_BY_ID[id]
    if (!def) return { ok: false, error: 'unavailable' }
    if (!def.consumable) {
      try {
        globalThis.localStorage?.setItem(DEV_STORE_KEY, JSON.stringify([...new Set([...this.read(), id])]))
      } catch {
        /* ignore */
      }
    }
    return { ok: true, receipt: { productId: id, dev: true, finish: async () => {} } }
  }
  async restore(): Promise<StoreReceipt[]> {
    return this.read().map((id) => ({ productId: id, dev: true, finish: async () => {} }))
  }
}

/** No store reachable (web trial build without dev flag, or plugin failed to load). */
export class UnavailableProvider implements PurchaseProvider {
  readonly id = 'none'
  readonly real = false
  async products(): Promise<StoreProduct[]> {
    return []
  }
  async buy(): Promise<BuyResult> {
    return { ok: false, error: 'unavailable' }
  }
  async restore(): Promise<StoreReceipt[]> {
    return []
  }
}
