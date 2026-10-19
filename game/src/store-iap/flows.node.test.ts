/**
 * Purchase retry (M7) and watched-ad reward queue (M8), with a fake store, a fake ad network and the
 * shop API stubbed: a payment or a watched ad is never lost to a network drop, and never paid twice.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ShopApiError, shopApi, type ServerWallet } from './shopApi'
import { _resetShopApi } from './shopApi'
import { purchase, retryUnredeemed, setProvider } from './service'
import { retryPendingAds, setAdProvider, watchAd, type AdProvider } from './ads'
import type { PurchaseProvider, StoreReceipt } from './provider'

const store = new Map<string, string>()
const wallet = (gems = 0): ServerWallet => ({ accountId: 'acc', gems, starter: false, pass: { active: false, until: 0, claimable: false }, entitlements: [], inbox: [], ads: {}, physioDiscounts: 0, earnedToday: 0, prices: {}, stores: { apple: true, google: true } })

beforeAll(() => {
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) })
})
afterAll(() => vi.unstubAllGlobals())
beforeEach(() => {
  store.clear()
  _resetShopApi()
  store.set('starpath.account.v1', JSON.stringify({ accountId: 'acc', token: 'acc.x' }))
  store.set('starpath.walletcache.v1', JSON.stringify(wallet()))
  vi.restoreAllMocks()
})

function fakeStore(): { p: PurchaseProvider; finish: ReturnType<typeof vi.fn> } {
  const finish = vi.fn(async () => {})
  const receipt = (): StoreReceipt => ({ productId: 'gems_m', txId: 'tx-1', jws: 'jws-1', finish })
  return { finish, p: { id: 'fake', real: true, products: async () => [], buy: async () => ({ ok: true, receipt: receipt() }), restore: async () => [receipt()] } }
}

describe('purchase retry', () => {
  it('offline after paying: reported, queued, credited exactly once on retry, store transaction finished once', async () => {
    const { p, finish } = fakeStore()
    setProvider(p)
    const buy = vi.spyOn(shopApi, 'buyApple').mockRejectedValueOnce(new ShopApiError('offline')).mockResolvedValue({ ...wallet(600), credited: true })
    expect(await purchase('gems_m')).toEqual({ ok: false, error: 'offline' })
    expect(finish).not.toHaveBeenCalled()
    await retryUnredeemed()
    await retryUnredeemed()
    expect(buy).toHaveBeenCalledTimes(2)
    expect(finish).toHaveBeenCalledTimes(1)
  })
  it('a definitive refusal is dropped and never re-sent; a transient one keeps being retried', async () => {
    const { p } = fakeStore()
    setProvider(p)
    const buy = vi.spyOn(shopApi, 'buyApple').mockRejectedValueOnce(new ShopApiError('offline')).mockRejectedValue(new ShopApiError('receipt_used', 409))
    await purchase('gems_m')
    await retryUnredeemed()
    await retryUnredeemed()
    expect(buy).toHaveBeenCalledTimes(2)
  })
})

describe('watched-ad reward queue', () => {
  const okAd: AdProvider = { id: 'fake', available: () => true, show: async () => 'rewarded' }
  it('watched but the server is unreachable: kept, paid once when it comes back', async () => {
    setAdProvider(okAd)
    vi.spyOn(shopApi, 'adStart').mockResolvedValue({ nonce: 'a'.repeat(32), skipAd: false })
    const complete = vi.spyOn(shopApi, 'adComplete').mockRejectedValueOnce(new ShopApiError('offline')).mockResolvedValue({ ...wallet(10), grant: null })
    expect(await watchAd('gems')).toMatchObject({ ok: false, reason: 'pending_reward' })
    await retryPendingAds()
    await retryPendingAds()
    expect(complete).toHaveBeenCalledTimes(2)
    expect(JSON.parse(store.get('starpath.adpending.v1') ?? '[]')).toEqual([])
  })
  it('a final answer (already rewarded / cap) clears the queue instead of retrying', async () => {
    setAdProvider(okAd)
    vi.spyOn(shopApi, 'adStart').mockResolvedValue({ nonce: 'b'.repeat(32), skipAd: false })
    const complete = vi.spyOn(shopApi, 'adComplete').mockRejectedValue(new ShopApiError('ad_cap_reached', 409))
    expect((await watchAd('gems')).ok).toBe(false)
    await retryPendingAds()
    expect(complete).toHaveBeenCalledTimes(1)
  })
  it('closing the ad early releases the session once and pays nothing', async () => {
    setAdProvider({ id: 'fake', available: () => true, show: async () => 'dismissed' })
    vi.spyOn(shopApi, 'adStart').mockResolvedValue({ nonce: 'c'.repeat(32), skipAd: false })
    const abort = vi.spyOn(shopApi, 'adAbort').mockResolvedValue({ aborted: true })
    const complete = vi.spyOn(shopApi, 'adComplete')
    expect(await watchAd('gems')).toMatchObject({ ok: false, reason: 'dismissed' })
    expect(abort).toHaveBeenCalledTimes(1)
    expect(complete).not.toHaveBeenCalled()
  })
  it('an ad watched more than 30 minutes ago with no answer is given up', async () => {
    store.set('starpath.adpending.v1', JSON.stringify([{ nonce: 'd'.repeat(32), offer: 'gems', at: Date.now() - 31 * 60_000 }]))
    vi.spyOn(shopApi, 'adComplete').mockRejectedValue(new ShopApiError('offline'))
    await retryPendingAds()
    expect(JSON.parse(store.get('starpath.adpending.v1') ?? '[]')).toEqual([])
  })
})
