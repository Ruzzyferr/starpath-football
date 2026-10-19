/**
 * Google Play Billing / StoreKit 2 through @capgo/native-purchases (Capacitor 8). Loaded with a
 * dynamic import on native shells only.
 *
 * Purchases are NOT auto-acknowledged: the receipt (iOS signed JWS / Android purchase token) goes
 * to the shop server first, and only after the server has verified and credited it is the
 * transaction finished (iOS: finished here; Android: acknowledged or consumed by the server itself). A payment the
 * server has not credited yet is retried by store-iap/service (timer, reconnect, app resume, next
 * launch via `pending()`); transactions that finish outside a purchase call (Ask to Buy, renewals)
 * arrive through `listen()`.
 */
import { detectPlatform } from '../platform/detect'
import { PRODUCTS, PRODUCT_BY_ID } from './catalog'
import type { BuyResult, PurchaseProvider, StoreProduct, StoreReceipt } from './provider'

async function plugin() {
  const m = await import('@capgo/native-purchases')
  return { NativePurchases: m.NativePurchases, INAPP: m.PURCHASE_TYPE.INAPP, SUBS: m.PURCHASE_TYPE.SUBS }
}

type Tx = { transactionId: string; productIdentifier: string; jwsRepresentation?: string; purchaseToken?: string; isAcknowledged?: boolean; isActive?: boolean; revocationDate?: string }

function receiptOf(tx: Tx): StoreReceipt {
  const ios = detectPlatform() === 'ios'
  return {
    productId: tx.productIdentifier,
    txId: tx.transactionId,
    jws: ios ? tx.jwsRepresentation : undefined,
    purchaseToken: ios ? undefined : tx.purchaseToken,
    async finish() {
      // iOS: finish the StoreKit transaction once credited. Android: the SERVER acknowledges / consumes
      // the Play purchase after crediting it (a token consumed on the device first would be refused).
      if (!ios) return
      const { NativePurchases } = await plugin()
      await NativePurchases.acknowledgePurchase({ purchaseToken: tx.transactionId })
    },
  }
}

export class CapacitorProvider implements PurchaseProvider {
  readonly id = 'capacitor'
  readonly real = true
  async products(): Promise<StoreProduct[]> {
    try {
      const { NativePurchases, INAPP, SUBS } = await plugin()
      const ids = (t: 'inapp' | 'subs') => PRODUCTS.filter((p) => !p.retired && p.storeType === t).map((p) => p.id)
      const [a, b] = await Promise.all([
        NativePurchases.getProducts({ productIdentifiers: ids('inapp'), productType: INAPP }).catch(() => ({ products: [] })),
        NativePurchases.getProducts({ productIdentifiers: ids('subs'), productType: SUBS }).catch(() => ({ products: [] })),
      ])
      return [...a.products, ...b.products].map((p) => ({ id: p.identifier, priceString: p.priceString }))
    } catch {
      return []
    }
  }
  async buy(id: string, accountId: string): Promise<BuyResult> {
    const def = PRODUCT_BY_ID[id]
    if (!def || def.retired) return { ok: false, error: 'unavailable' }
    try {
      const { NativePurchases, INAPP, SUBS } = await plugin()
      const tx = (await NativePurchases.purchaseProduct({
        productIdentifier: id,
        productType: def.storeType === 'subs' ? SUBS : INAPP,
        planIdentifier: def.storeType === 'subs' ? 'monthly' : undefined,
        appAccountToken: accountId,
        autoAcknowledgePurchases: false,
      })) as Tx
      return { ok: true, receipt: receiptOf(tx) }
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? e).toLowerCase()
      return { ok: false, error: /cancel/.test(msg) ? 'cancelled' : /pending|deferred|approval/.test(msg) ? 'pending' : 'failed' }
    }
  }
  /** Launch: only what is still unfinished, no AppStore.sync (that runs from the Restore button only). */
  async pending(): Promise<StoreReceipt[]> {
    try {
      const { NativePurchases } = await plugin()
      const { purchases } = (await NativePurchases.getPurchases({})) as { purchases: Tx[] }
      const ios = detectPlatform() === 'ios'
      return purchases
        .filter((t) => PRODUCT_BY_ID[t.productIdentifier] && !t.revocationDate && (ios || !t.isAcknowledged))
        .map(receiptOf)
    } catch {
      return []
    }
  }
  listen(cb: (r: StoreReceipt) => void): void {
    void plugin()
      .then(({ NativePurchases }) => NativePurchases.addListener('transactionUpdated', (tx: Tx) => { if (PRODUCT_BY_ID[tx.productIdentifier]) cb(receiptOf(tx)) }))
      .catch(() => {})
  }
  async restore(): Promise<StoreReceipt[]> {
    try {
      const { NativePurchases } = await plugin()
      await NativePurchases.restorePurchases().catch(() => undefined)
      const { purchases } = (await NativePurchases.getPurchases({})) as { purchases: Tx[] }
      return purchases.filter((t) => PRODUCT_BY_ID[t.productIdentifier] && !t.revocationDate).map(receiptOf)
    } catch {
      return []
    }
  }
}
