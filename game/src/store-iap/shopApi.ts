/**
 * Client for the shop server (repo `server/`). The server, not this app, holds the diamond balance:
 * every credit needs a store receipt it verified itself, and every spend is priced there. The app
 * keeps only a cached copy of the wallet for display (and offline).
 *
 * Account: an anonymous id + secret created on first use (no personal data). Purchases carry the id
 * as the store's appAccountToken, so a receipt can only ever be credited to the account it was bought for.
 */
import { signal } from '@preact/signals'

export interface ServerGrant {
  nonce: string
  token: string
  /** gear | cash | physio | match_bonus | train_boost | season_x2 */
  k: string
  id?: string
  weeks?: number
  floor?: number
  src?: string
}

export interface ServerWallet {
  accountId: string
  gems: number
  starter: boolean
  pass: { active: boolean; until: number; claimable: boolean }
  entitlements: string[]
  inbox: ServerGrant[]
  ads: Record<string, { used: number; max: number }>
  physioDiscounts: number
  earnedToday: number
  prices: Record<string, number>
  /** Refunds pending or negative balance: spends and ad rewards are paused. */
  refundHold?: boolean
  /** Which stores the server can verify right now (Android needs the Play service account). */
  stores?: { apple: boolean; google: boolean }
  seasonX2Ready?: boolean
  limits?: { gemsToCashLeft: number; cashPerSeason?: number }
}

export type ShopErrorCode =
  | 'offline' | 'unauthorized' | 'insufficient_gems' | 'ad_cap' | 'ad_too_short' | 'ad_not_verified' | 'already_rewarded'
  | 'receipt_used' | 'not_your_receipt' | 'invalid_receipt' | 'revoked' | 'already_claimed' | 'no_pass' | 'rate_limited'
  | 'play_not_configured' | 'no_season_reward' | 'no_discount' | string

export class ShopApiError extends Error {
  readonly code: ShopErrorCode
  readonly status: number
  constructor(code: ShopErrorCode, status = 0) {
    super(code)
    this.code = code
    this.status = status
  }
}

const ACCOUNT_KEY = 'starpath.account.v1'
const WALLET_KEY = 'starpath.walletcache.v1'

declare const __SP_SHOP_API__: string | undefined
/**
 * Shop server hosts, in order. The first one that answers is remembered; a host that stops answering
 * (network error) makes the client try the next, so moving the server to a new name never strands
 * installed apps as long as one listed name still points at it.
 */
export const SHOP_HOSTS: readonly string[] = ['https://206-189-63-64.sslip.io']
const DEFAULT_API = SHOP_HOSTS[0]!
let hostIndex = 0

export function shopBase(): string {
  const env = import.meta.env?.VITE_SHOP_API as string | undefined
  if (env) return env.replace(/\/$/, '')
  if (import.meta.env?.DEV) {
    try {
      const q = new URLSearchParams(globalThis.location?.search ?? '').get('shopApi')
      if (q) return q.replace(/\/$/, '')
    } catch {
      /* no location */
    }
  }
  if (typeof __SP_SHOP_API__ === 'string' && __SP_SHOP_API__) return __SP_SHOP_API__
  return SHOP_HOSTS[hostIndex] ?? DEFAULT_API
}

/** Network failure on the current host: move to the next listed host (if any). */
function nextHost(): boolean {
  if (import.meta.env?.VITE_SHOP_API || hostIndex + 1 >= SHOP_HOSTS.length) return false
  hostIndex++
  return true
}

interface Account {
  accountId: string
  token: string
}

/** In-memory copy for when localStorage is missing or blocked (private mode, tests). */
const mem = new Map<string, string>()
function readJson<T>(key: string): T | null {
  try {
    const raw = globalThis.localStorage ? globalThis.localStorage.getItem(key) : mem.get(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    const raw = mem.get(key)
    return raw ? (JSON.parse(raw) as T) : null
  }
}
function writeJson(key: string, v: unknown): void {
  if (v == null) mem.delete(key)
  else mem.set(key, JSON.stringify(v))
  try {
    if (v == null) globalThis.localStorage?.removeItem(key)
    else globalThis.localStorage?.setItem(key, JSON.stringify(v))
  } catch {
    /* private mode: the memory copy lasts this session */
  }
}

/** Last wallet the server sent (shown offline; never trusted for spending). */
export const serverWallet = signal<ServerWallet | null>(readJson<ServerWallet>(WALLET_KEY))
/** Last request failed for lack of network. */
export const shopOffline = signal(false)

function setWallet(w: ServerWallet): ServerWallet {
  serverWallet.value = w
  writeJson(WALLET_KEY, w)
  return w
}

let accountPromise: Promise<Account> | null = null

async function raw<T>(method: 'GET' | 'POST' | 'DELETE', path: string, bodyIn?: unknown, auth?: Account): Promise<T> {
  // The server takes JSON only: a POST always carries a body.
  const body = method === 'POST' ? bodyIn ?? {} : undefined
  let r: Response
  try {
    r = await fetch(`${shopBase()}${path}`, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(auth ? { Authorization: `Bearer ${auth.token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      // A stalled server reads as offline after 15 s instead of a spinner forever.
      signal: typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(15_000) : undefined,
    })
  } catch {
    if (nextHost()) return raw<T>(method, path, bodyIn, auth)
    shopOffline.value = true
    throw new ShopApiError('offline')
  }
  shopOffline.value = false
  const j = (await r.json().catch(() => ({}))) as { error?: string }
  if (!r.ok) throw new ShopApiError(j.error ?? `http_${r.status}`, r.status)
  return j as T
}

export function currentAccountId(): string | null {
  return readJson<Account>(ACCOUNT_KEY)?.accountId ?? null
}

/** The install's shop account (created on first use). */
export function ensureAccount(platform?: string): Promise<Account> {
  const saved = readJson<Account>(ACCOUNT_KEY)
  if (saved?.accountId && saved.token) return Promise.resolve(saved)
  accountPromise ??= raw<Account>('POST', '/v1/register', { platform: platform ?? 'web' })
    .then((a) => {
      writeJson(ACCOUNT_KEY, a)
      return a
    })
    .finally(() => {
      accountPromise = null
    })
  return accountPromise
}

const LOST_KEY = 'starpath.account.lost.v1'
/** The account was refused (server restore, removed device): set so the UI can offer the recovery code. */
export const accountLost = signal<boolean>(!!readJson<Account>(LOST_KEY))

/**
 * Authenticated call. A refused account is NOT silently replaced while it may hold paid diamonds: its
 * credentials are kept aside (recovery code / Restore purchases can bring it back) and the player is told.
 * An account that never held anything is simply replaced.
 */
async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const acc = await ensureAccount()
  try {
    return await raw<T>(method, path, body, acc)
  } catch (e) {
    if (e instanceof ShopApiError && e.code === 'unauthorized') {
      const hadValue = (serverWallet.peek()?.gems ?? 0) > 0 || (serverWallet.peek()?.entitlements.length ?? 0) > 0
      if (hadValue) {
        writeJson(LOST_KEY, acc)
        accountLost.value = true
      }
      writeJson(ACCOUNT_KEY, null)
      return raw<T>(method, path, body, await ensureAccount())
    }
    throw e
  }
}

const withWallet = async <T extends ServerWallet>(p: Promise<T>): Promise<T> => {
  const w = await p
  setWallet(w)
  return w
}

const EARN_QUEUE_KEY = 'starpath.earnq.v1'
type EarnItem = { source: string; ref: string }

/**
 * Free-diamond claims wait here: a player who never opens the store never contacts the server, and a
 * claim the server could not take today (daily cap, offline, busy) is kept for later instead of lost.
 */
export function queueEarn(source: string, ref: string): void {
  const q = readJson<EarnItem[]>(EARN_QUEUE_KEY) ?? []
  if (!q.some((x) => x.source === source && x.ref === ref)) writeJson(EARN_QUEUE_KEY, [...q, { source, ref }].slice(-500))
}

const EARN_PAUSE_KEY = 'starpath.earnq.pause.v1'
let flushing: Promise<void> | null = null
let again = false
export function flushEarnQueue(): Promise<void> {
  flushing ??= (async () => {
    if (!currentAccountId()) return
    // The server said "capped until tomorrow": do not send anything before then.
    const pause = readJson<number>(EARN_PAUSE_KEY) ?? 0
    if (Date.now() < pause) return
    const q = readJson<EarnItem[]>(EARN_QUEUE_KEY) ?? []
    const keep: EarnItem[] = []
    let stop = false
    // Sources at their own daily cap: their claims wait, the other sources go on.
    const held = new Set<string>()
    for (const x of q) {
      if (stop || held.has(x.source)) {
        keep.push(x)
        continue
      }
      try {
        const r = (await shopApi.earn(x.source, x.ref)) as { capped?: boolean; retryAfter?: number; reason?: string }
        // A lifetime ceiling is final: the claim is dropped.
        if (r.capped && r.reason === 'lifetime') continue
        // Capped today: try again on another day (the server does not burn the reference).
        if (r.capped) {
          keep.push(x)
          if (r.reason === 'source') held.add(x.source)
          else if (typeof r.retryAfter === 'number' && r.retryAfter > 0) {
            writeJson(EARN_PAUSE_KEY, Date.now() + r.retryAfter * 1000)
            stop = true
          }
        }
      } catch (e) {
        const st = e instanceof ShopApiError ? e.status : 0
        // Offline, throttled or a server error: keep this and everything after it for later.
        if (!(e instanceof ShopApiError) || e.code === 'offline' || st === 429 || st >= 500) {
          keep.push(x)
          stop = true
        }
        // Any other 4xx is a permanent refusal (unknown source, malformed): dropped.
      }
    }
    // Claims queued while this ran are kept too.
    const now = readJson<EarnItem[]>(EARN_QUEUE_KEY) ?? []
    const added = now.filter((n) => !q.some((o) => o.source === n.source && o.ref === n.ref))
    writeJson(EARN_QUEUE_KEY, [...keep, ...added].slice(-500))
    again = added.length > 0
  })().finally(() => {
    flushing = null
    // Claims that arrived during this run are sent right after it.
    if (again) {
      again = false
      void flushEarnQueue()
    }
  })
  return flushing
}

/** Account recovery from a store receipt: taken back, refused for good, or worth trying again later. */
export type RecoverResult = 'ok' | 'refused' | 'retry'
async function recoverWith(path: string, body: unknown): Promise<RecoverResult> {
  try {
    const a = await raw<Account>('POST', path, body)
    writeJson(ACCOUNT_KEY, a)
    return 'ok'
  } catch (e) {
    const transient = !(e instanceof ShopApiError) || e.code === 'offline' || e.code === 'rate_limited' || e.code === 'play_unavailable' || e.status >= 500
    return transient ? 'retry' : 'refused'
  }
}

export const shopApi = {
  wallet: () => withWallet(call<ServerWallet>('GET', '/v1/wallet')),
  buyApple: (jws: string) => withWallet(call<ServerWallet & { credited: boolean }>('POST', '/v1/purchase/apple', { jws })),
  buyGoogle: (productId: string, purchaseToken: string) => withWallet(call<ServerWallet & { credited: boolean }>('POST', '/v1/purchase/google', { productId, purchaseToken })),
  buyDev: (productId: string) => withWallet(call<ServerWallet & { credited: boolean }>('POST', '/v1/purchase/dev', { productId })),
  spend: (item: string, idem: string, discount = false, career?: string) => withWallet(call<ServerWallet & { grant: ServerGrant }>('POST', '/v1/spend', { item, idem, discount, ...(career ? { career } : {}) })),
  ack: (nonces: string[]) => withWallet(call<ServerWallet>('POST', '/v1/inbox/ack', { nonces })),
  adStart: (offer: string, ref?: string) => call<{ nonce: string; skipAd: boolean; reused?: boolean }>('POST', '/v1/ads/start', { offer, ...(ref ? { ref } : {}) }),
  /** The ad was closed early or failed: close the session so it does not hold a slot. */
  adAbort: (nonce: string) => call<{ aborted: boolean }>('POST', '/v1/ads/abort', { nonce }),
  /** A spend grant whose career no longer exists: refund its diamonds (once). */
  voidGrant: (nonce: string) => withWallet(call<ServerWallet & { voided: boolean; refunded: number }>('POST', '/v1/inbox/void', { nonce })),
  /** Re-sign grants too old for the device to accept (the server keeps the same nonce). */
  refreshGrants: () => withWallet(call<ServerWallet>('POST', '/v1/inbox/refresh')),
  /** GDPR/KVKK: everything the server holds for this account, as JSON. */
  exportAccount: () => call<unknown>('GET', '/v1/account/export'),
  adComplete: (nonce: string, career?: string) => withWallet(call<ServerWallet & { grant: ServerGrant | null }>('POST', '/v1/ads/complete', { nonce, ...(career ? { career } : {}) })),
  earn: (source: string, ref: string) => withWallet(call<ServerWallet & { earned: number }>('POST', '/v1/earn', { source, ref })),
  passClaim: () => withWallet(call<ServerWallet>('POST', '/v1/pass/claim')),
  /** New install: get the old account back from a restorable Google Play purchase. */
  recoverGoogle: (productId: string, purchaseToken: string): Promise<RecoverResult> => recoverWith('/v1/recover/google', { productId, purchaseToken }),
  /** Recovery code shown in Settings (written down by the player). */
  recoveryCode: () => call<{ code: string }>('POST', '/v1/account/recovery-code'),
  async recoverCode(code: string): Promise<boolean> {
    try {
      const a = await raw<Account>('POST', '/v1/recover/code', { code })
      writeJson(ACCOUNT_KEY, a)
      writeJson(LOST_KEY, null)
      accountLost.value = false
      await shopApi.wallet().catch(() => null)
      return true
    } catch {
      return false
    }
  },
  /** Settings › delete my shop data (server keeps only anonymised store transactions). */
  async deleteAccount(): Promise<void> {
    const acc = readJson<Account>(ACCOUNT_KEY)
    if (acc) await raw<unknown>('DELETE', '/v1/account', undefined, acc)
    writeJson(ACCOUNT_KEY, null)
    writeJson(WALLET_KEY, null)
    serverWallet.value = null
  },
  /** New install: get the old account back from a restorable Apple receipt. */
  recoverApple: (jws: string): Promise<RecoverResult> => recoverWith('/v1/recover/apple', { jws }),
}

/** Tests only. */
export function _resetShopApi(): void {
  writeJson(ACCOUNT_KEY, null)
  writeJson(WALLET_KEY, null)
  writeJson(EARN_QUEUE_KEY, null)
  serverWallet.value = null
  accountPromise = null
}
