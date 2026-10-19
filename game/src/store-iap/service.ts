/**
 * Purchase flow glue: store payment → shop server verification → local entitlements / inbox.
 * Diamonds are never added here: the server's answer is the balance.
 */
import { detectPlatform, isMobileNative } from '../platform/detect'
import { CapacitorProvider } from './capacitorProvider'
import { PRODUCT_BY_ID } from './catalog'
import { grant, revokeMissing } from './entitlements'
import { DevProvider, UnavailableProvider, type PurchaseProvider, type PurchaseResult, type StoreProduct, type StoreReceipt } from './provider'
import { ShopApiError, currentAccountId, ensureAccount, flushEarnQueue, serverWallet, shopApi, type RecoverResult, type ServerWallet } from './shopApi'

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
  // A refunded / revoked pack disappears from the server list: drop the local copy too.
  revokeMissing(new Set(ids))
}

/** Apply a fresh server wallet: mirror entitlements, hand grants to the career. */
export async function handleWallet(w: ServerWallet): Promise<void> {
  syncEntitlements(w)
  if (w.inbox.length && inboxHandler) await inboxHandler(w)
}

const REDEEMED_KEY = 'starpath.redeemed.v1'
function redeemedIds(): string[] {
  try {
    const v = JSON.parse(globalThis.localStorage?.getItem(REDEEMED_KEY) ?? '[]') as unknown
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}
function markRedeemed(id: string | undefined): void {
  if (!id) return
  try {
    globalThis.localStorage?.setItem(REDEEMED_KEY, JSON.stringify([...redeemedIds(), id].slice(-2000)))
  } catch {
    /* private mode */
  }
}

/** Sends a store receipt to the server; finishes the store transaction only once it is credited. */
async function redeem(r: StoreReceipt): Promise<ServerWallet> {
  let w: ServerWallet
  if (r.dev) w = await shopApi.buyDev(r.productId)
  else if (r.jws) w = await shopApi.buyApple(r.jws)
  else if (r.purchaseToken) w = await shopApi.buyGoogle(r.productId, r.purchaseToken)
  else throw new ShopApiError('invalid_receipt')
  await r.finish().catch(() => {})
  markRedeemed(r.txId)
  return w
}

/** Paid receipts the server has not credited yet (network/server trouble), retried until it does. */
const unredeemed: StoreReceipt[] = []
let retryTimer: ReturnType<typeof setInterval> | null = null

function queueRetry(r: StoreReceipt): void {
  if (!unredeemed.some((x) => x === r || (r.txId && x.txId === r.txId))) unredeemed.push(r)
  retryTimer ??= setInterval(() => void retryUnredeemed(), 60_000)
}

/** Server answers that will never change for this receipt: stop retrying it. Anything else is retried. */
const DEFINITIVE = new Set(['family_shared', 'receipt_used', 'revoked', 'wrong_app', 'unknown_product', 'wrong_product', 'sandbox_receipt', 'sandbox_cap', 'consumed_elsewhere', 'expired'])
const isFinal = (code: string, r: StoreReceipt): boolean => DEFINITIVE.has(code) || (code === 'invalid_receipt' && !r.purchaseToken)
/** Paid, not credited, and worth sending again (network, server, Play hiccup, Play not settled yet). */
const isTransient = (e: unknown, r: StoreReceipt): boolean => {
  const code = e instanceof ShopApiError ? e.code : 'failed'
  return code === 'offline' || (e instanceof ShopApiError && e.status >= 500) || code === 'rate_limited' || code === 'play_unavailable' || code === 'purchase_pending' || (code === 'invalid_receipt' && !!r.purchaseToken)
}

let retryRun: Promise<void> | null = null
/** Retries paid-but-not-credited receipts (timer, reconnect, app resume, store screen). One run at a time. */
export function retryUnredeemed(): Promise<void> {
  retryRun ??= (async () => {
    for (const r of [...unredeemed]) {
      const drop = () => {
        const i = unredeemed.indexOf(r)
        if (i >= 0) unredeemed.splice(i, 1)
      }
      try {
        await handleWallet(await redeem(r))
        drop()
      } catch (e) {
        const code = e instanceof ShopApiError ? e.code : 'failed'
        // Bought for an earlier shop account of this store account (a reinstall): take that account back,
        // then credit the receipt there (idempotent when that account already has it).
        if (code === 'not_your_receipt') {
          const rec = await recoverFrom(r)
          if (rec === 'ok') {
            await refreshWallet(true)
            try {
              await handleWallet(await redeem(r))
              drop()
            } catch (e2) {
              if (isFinal(e2 instanceof ShopApiError ? e2.code : 'failed', r)) {
                drop()
                markRedeemed(r.txId)
              }
            }
          } else if (rec === 'refused') {
            // Another player's receipt (shared device, other account): never ours, stop sending it so it
            // does not use up the recovery rate limit on every launch.
            drop()
            markRedeemed(r.txId)
          }
          continue
        }
        // Only an explicit list of answers is final; transient ones (play_unavailable, 5xx, offline,
        // invalid_receipt on Android right after purchase) keep being retried.
        if (isFinal(code, r)) {
          drop()
          markRedeemed(r.txId)
        }
      }
    }
    if (!unredeemed.length && retryTimer) {
      clearInterval(retryTimer)
      retryTimer = null
    }
  })().finally(() => {
    retryRun = null
  })
  return retryRun
}

/** Android needs the server's Play verification set up; until then nothing is charged there. */
export function storeReady(): boolean {
  if (detectPlatform() !== 'android' || getProvider().id !== 'capacitor') return true
  return serverWallet.peek()?.stores?.google === true
}

export async function purchase(id: string): Promise<PurchaseResult> {
  const def = PRODUCT_BY_ID[id]
  if (!def || def.retired) return { ok: false, error: 'unavailable' }
  const p = getProvider()
  let account: string
  try {
    account = (await ensureAccount(detectPlatform())).accountId
    if (!serverWallet.peek()) await shopApi.wallet()
  } catch {
    return { ok: false, error: 'offline' }
  }
  if (!storeReady()) return { ok: false, error: 'store_not_ready' }
  const r = await p.buy(id, account)
  // Play: paid earlier but never credited (the purchase is still owned): pick it up instead of failing.
  if (r.error === 'already_owned') void resumePending()
  if (!r.ok || !r.receipt) return { ok: false, error: r.error ?? 'failed' }
  try {
    await handleWallet(await redeem(r.receipt))
    return { ok: true }
  } catch (e) {
    // Paid but not credited yet: the store keeps the transaction unfinished and it is retried.
    if (isTransient(e, r.receipt)) {
      queueRetry(r.receipt)
      return { ok: false, error: 'offline' }
    }
    return { ok: false, error: 'rejected' }
  }
}

/** Re-verify everything the store account owns (the Restore button: a full store sync). */
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
      if (e instanceof ShopApiError && e.code === 'not_your_receipt') {
        const rec = await recoverFrom(r)
        if (rec === 'ok') {
          await refreshWallet(true)
          // Credit it there too if that account never got it (a no-op when it did).
          await redeem(r).then(handleWallet).catch((e2: unknown) => { if (isTransient(e2, r)) queueRetry(r) })
          ok.push(r.productId)
        } else if (rec === 'retry') queueRetry(r)
      } else if (isTransient(e, r)) queueRetry(r) // paid, not credited: never dropped by a failed restore
    }
  }
  if (unredeemed.length) void retryUnredeemed()
  return ok
}

async function recoverFrom(r: StoreReceipt): Promise<RecoverResult> {
  if (r.jws) return shopApi.recoverApple(r.jws)
  if (r.purchaseToken) return shopApi.recoverGoogle(r.productId, r.purchaseToken)
  return 'refused'
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

/**
 * Launch / resume: queue what the store still holds that this install has not seen credited. Receipts
 * made for another shop account (iOS Transaction.all lists every purchase on the device) are left to
 * the Restore button, which can take that account back.
 */
export async function resumePending(): Promise<void> {
  const me = currentAccountId()
  if (!storeAvailable() || getProvider().id !== 'capacitor' || !me) return
  const done = redeemedIds()
  for (const r of (await getProvider().pending?.()) ?? []) {
    if (r.txId && done.includes(r.txId)) continue
    if (r.accountToken && r.accountToken.toLowerCase() !== me.toLowerCase()) continue
    queueRetry(r)
  }
  await retryUnredeemed()
}

let listening = false
/** Boot: listen for transactions finishing outside a purchase call, and retry on reconnect / resume. */
export function installPurchaseListeners(): void {
  if (listening || !storeAvailable()) return
  listening = true
  getProvider().listen?.((r) => {
    if (r.txId && redeemedIds().includes(r.txId)) return
    queueRetry(r)
    void retryUnredeemed()
  })
  // Back online / back in the foreground: retry what is queued, and look for purchases that finished
  // meanwhile (Android PENDING → PURCHASED, Ask to Buy) — at most once a minute.
  let lastPending = 0
  const resume = () => {
    void retryUnredeemed()
    if (Date.now() - lastPending > 60_000) {
      lastPending = Date.now()
      void resumePending()
    }
  }
  globalThis.addEventListener?.('online', resume)
  globalThis.document?.addEventListener?.('visibilitychange', () => {
    if (document.visibilityState === 'visible') resume()
  })
}
