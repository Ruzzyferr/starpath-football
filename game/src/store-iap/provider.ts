/**
 * Purchase adapter interface. Steam/desktop is premium (no IAP, no provider).
 */
import { PRODUCTS, PRODUCT_BY_ID } from './catalog'

export interface StoreProduct {
  id: string
  /** Localised, store-formatted price ("€7,99", "₺149,99"). Shown as is. */
  priceString: string
}

export type PurchaseError = 'cancelled' | 'unavailable' | 'failed'
export interface PurchaseResult {
  ok: boolean
  error?: PurchaseError
}

export interface PurchaseProvider {
  readonly id: string
  /** Real money moves through this provider. */
  readonly real: boolean
  products(): Promise<StoreProduct[]>
  buy(id: string): Promise<PurchaseResult>
  /** Product ids the store account already owns (non-consumables). */
  restore(): Promise<string[]>
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
  async buy(id: string): Promise<PurchaseResult> {
    if (!PRODUCT_BY_ID[id]) return { ok: false, error: 'unavailable' }
    try {
      globalThis.localStorage?.setItem(DEV_STORE_KEY, JSON.stringify([...new Set([...this.read(), id])]))
    } catch {
      /* ignore */
    }
    return { ok: true }
  }
  async restore(): Promise<string[]> {
    return this.read()
  }
}

/** No store reachable (web trial build without dev flag, or plugin failed to load). */
export class UnavailableProvider implements PurchaseProvider {
  readonly id = 'none'
  readonly real = false
  async products(): Promise<StoreProduct[]> {
    return []
  }
  async buy(): Promise<PurchaseResult> {
    return { ok: false, error: 'unavailable' }
  }
  async restore(): Promise<string[]> {
    return []
  }
}
