/**
 * Purchase flow glue: store payment → shop server verification → local entitlements / inbox.
 * Diamonds are never added here: the server's answer is the balance.
 */
import { detectPlatform, isMobileNative } from '../platform/detect'
import { CapacitorProvider } from './capacitorProvider'
import { PRODUCT_BY_ID } from './catalog'
import { grant } from './entitlements'
import { DevProvider, UnavailableProvider, type PurchaseProvider, type PurchaseResult, type StoreProduct, type StoreReceipt } from './provider'
import { ShopApiError, currentAccountId, ensureAccount, flushEarnQueue, serverWallet, shopApi, type ServerWallet } from './shopApi'

let provider: PurchaseProvider | null = null

/** Native shells use the real store; dev builds use the instant fake; production web has no store. */
export function getProvider(): PurchaseProvider {
  if (provider) return provider
  if (isMobileNative(detectPlatform())) provider = new CapacitorProvider()
  else if (import.meta.env?.DEV) provider = new DevProvider()
  else provider = new UnavailableProvider()
  return provider
}

/** Tests only (or a future Steam/other adapter). */
export function setProvider(p: PurchaseProvider | null): void {
  provider = p
}

/** Show store UI at all? Builds with no provider have nothing to sell. */
export function storeAvailable(): boolean {
  return getProvider().id !== 'none'
}

export async function loadProducts(): Promise<Record<string, StoreProduct>> {
  const list = await getProvider().products()
  return Object.fromEntries(list.map((p) => [p.id, p]))
}

/** Called after every wallet change that may carry grants (set by the UI backend: applies them to the career). */
let inboxHandler: ((w: ServerWallet) => void | Promise<void>) | null = null
export function setInboxHandler(fn: ((w: ServerWallet) => void | Promise<void>) | null): void {
  inboxHandler = fn
}

/** Mirror the server's non-consumable entitlements locally (cosmetic gates read them offline). */
function syncEntitlements(w: ServerWallet): void {
  const ids = w.entitlements.filter((id) => PRODUCT_BY_ID[id])
  if (ids.length) grant(ids, 'server')
}

/** Apply a fresh server wallet: mirror entitlements, hand grants to the career. */
export async function handleWallet(w: ServerWallet): Promise<void> {
  syncEntitlements(w)
  if (w.inbox.length && inboxHandler) await inboxHandler(w)
}

/** Sends a store receipt to the server; finishes the store transaction only once it is credited. */
async function redeem(r: StoreReceipt): Promise<ServerWallet> {
  let w: ServerWallet
  if (r.dev) w = await shopApi.buyDev(r.productId)
  else if (r.jws) w = await shopApi.buyApple(r.jws)
  else if (r.purchaseToken) w = await shopApi.buyGoogle(r.productId, r.purchaseToken)
  else throw new ShopApiError('invalid_receipt')
  await r.finish().catch(() => {})
  return w
}

export async function purchase(id: string): Promise<PurchaseResult> {
  const def = PRODUCT_BY_ID[id]
  if (!def || def.retired) return { ok: false, error: 'unavailable' }
  const p = getProvider()
  let account: string
  try {
    account = (await ensureAccount(detectPlatform())).accountId
  } catch {
    return { ok: false, error: 'offline' }
  }
  const r = await p.buy(id, account)
  if (!r.ok || !r.receipt) return { ok: false, error: r.error ?? 'failed' }
  try {
    await handleWallet(await redeem(r.receipt))
    return { ok: true }
  } catch (e) {
    // Paid but not credited yet (network): the store keeps the transaction unfinished and
    // `resumePending()` redeems it on the next launch.
    const code = e instanceof ShopApiError ? e.code : 'failed'
    return { ok: false, error: code === 'offline' ? 'offline' : 'rejected' }
  }
}

/** Re-verify everything the store account owns (Restore purchases). Returns product ids confirmed. */
export async function restorePurchases(): Promise<string[]> {
  const p = getProvider()
  const receipts = await p.restore()
  const ok: string[] = []
  for (const r of receipts) {
    try {
      await handleWallet(await redeem(r))
      ok.push(r.productId)
    } catch (e) {
      // A new install: the receipt belongs to this player's earlier account; take it back.
      if (e instanceof ShopApiError && e.code === 'not_your_receipt' && r.jws && (await shopApi.recoverApple(r.jws))) {
        await refreshWallet()
        ok.push(r.productId)
      }
    }
  }
  return ok
}

/**
 * Fetch the wallet and apply inbox grants. Without `userAction` nothing is sent unless this install
 * already has a shop account (privacy: a player who never uses the shop never contacts the server).
 */
export async function refreshWallet(userAction = false): Promise<ServerWallet | null> {
  if (!storeAvailable()) return null
  if (!userAction && !currentAccountId()) return null
  try {
    const w = await shopApi.wallet()
    await handleWallet(w)
    void flushEarnQueue()
    return w
  } catch {
    return serverWallet.peek()
  }
}

export async function resumePending(): Promise<void> {
  if (!storeAvailable() || getProvider().id !== 'capacitor' || !currentAccountId()) return
  await restorePurchases().catch(() => [])
}
