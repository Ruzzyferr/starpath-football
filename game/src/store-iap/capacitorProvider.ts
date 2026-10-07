/**
 * Google Play Billing / StoreKit through @capgo/native-purchases (Capacitor 8,
 * verified with `npx cap sync`). Loaded with a dynamic import on native shells
 * only. Products are non-consumable ("inapp") with ids from catalog.ts.
 * TODO(server): send the receipt / purchaseToken to a validation endpoint
 * before granting (see docs/PLATFORM.md).
 */
import { PRODUCT_IDS } from './catalog'
import type { PurchaseProvider, PurchaseResult, StoreProduct } from './provider'

async function plugin() {
  const m = await import('@capgo/native-purchases')
  return { NativePurchases: m.NativePurchases, INAPP: m.PURCHASE_TYPE.INAPP }
}

export class CapacitorProvider implements PurchaseProvider {
  readonly id = 'capacitor'
  readonly real = true
  async products(): Promise<StoreProduct[]> {
    try {
      const { NativePurchases, INAPP } = await plugin()
      const { products } = await NativePurchases.getProducts({ productIdentifiers: [...PRODUCT_IDS], productType: INAPP })
      return products.map((p) => ({ id: p.identifier, priceString: p.priceString }))
    } catch {
      return []
    }
  }
  async buy(id: string): Promise<PurchaseResult> {
    try {
      const { NativePurchases, INAPP } = await plugin()
      await NativePurchases.purchaseProduct({ productIdentifier: id, productType: INAPP })
      return { ok: true }
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? e).toLowerCase()
      return { ok: false, error: /cancel/.test(msg) ? 'cancelled' : 'failed' }
    }
  }
  async restore(): Promise<string[]> {
    try {
      const { NativePurchases, INAPP } = await plugin()
      await NativePurchases.restorePurchases().catch(() => undefined)
      const { purchases } = await NativePurchases.getPurchases({ productType: INAPP })
      return purchases.map((p) => p.productIdentifier).filter((id) => PRODUCT_IDS.includes(id))
    } catch {
      return []
    }
  }
}
