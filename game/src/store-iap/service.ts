/**
 * Purchase flow glue: store payment → shop server verification → local entitlements / inbox.
 * Diamonds are never added here: the server's answer is the balance.
 */
import { detectPlatform, isMobileNative } from '../platform/detect'
import { CapacitorProvider } from './capacitorProvider'
import { PRODUCT_BY_ID } from './catalog'
import { grant, revokeMissing } from './entitlements'
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
    globalThis.localStorage?.setItem(REDEEMED_KEY, JSON.stringify([...redeemedIds(), id].slice(-300)))
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
        // A definitive refusal (forged, someone else's, revoked, sandbox) is not retried forever, and not
        // re-sent on every launch either.
        if (e instanceof ShopApiError && e.code !== 'offline' && e.status >= 400 && e.status < 500 && e.status !== 429) {
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
  if (!r.ok || !r.receipt) return { ok: false, error: r.error ?? 'failed' }
  try {
    await handleWallet(await redeem(r.receipt))
    return { ok: true }
  } catch (e) {
    // Paid but not credited yet: the store keeps the transaction unfinished and it is retried.
    const code = e instanceof ShopApiError ? e.code : 'failed'
    if (code === 'offline' || (e instanceof ShopApiError && e.status >= 500) || code === 'rate_limited') {
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
      if (e instanceof ShopApiError && e.code === 'not_your_receipt' && (await recoverFrom(r))) {
        await refreshWallet(true)
        ok.push(r.productId)
      }
    }
  }
  return ok
}

async function recoverFrom(r: StoreReceipt): Promise<boolean> {
  if (r.jws) return shopApi.recoverApple(r.jws)
  if (r.purchaseToken) return shopApi.recoverGoogle(r.productId, r.purchaseToken)
  return false
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
  const done = redeemedIds()
  for (const r of (await getProvider().pending?.()) ?? []) if (!r.txId || !done.includes(r.txId)) queueRetry(r)
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
