/**
 * Purchase retry (M7) and watched-ad reward queue (M8), with a fake store, a fake ad network and the
 * shop API stubbed: a payment or a watched ad is never lost to a network drop, and never paid twice.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ShopApiError, shopApi, type ServerWallet } from './shopApi'
import { _resetShopApi, flushEarnQueue, queueEarn } from './shopApi'
import { purchase, restorePurchases, resumePending, retryUnredeemed, setProvider } from './service'
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

describe('account recovery after a reinstall', () => {
  // A reinstall makes a fresh shop account; the store still holds receipts made for the old one.
  const oldReceipt = (finish: () => Promise<void>, txId = 'tx-old'): StoreReceipt => ({ productId: 'pack_avatar', txId, jws: `jws-${txId}`, accountToken: 'old-acc', finish })

  it('restore: not_your_receipt → old account recovered → credited there and finished once', async () => {
    const finish = vi.fn(async () => {})
    setProvider({ id: 'fake', real: true, products: async () => [], buy: async () => ({ ok: false }), restore: async () => [oldReceipt(finish)] })
    const recover = vi.spyOn(shopApi, 'recoverApple').mockImplementation(async () => {
      store.set('starpath.account.v1', JSON.stringify({ accountId: 'old-acc', token: 'old-acc.x' }))
      return 'ok'
    })
    vi.spyOn(shopApi, 'wallet').mockResolvedValue(wallet(900))
    const buy = vi.spyOn(shopApi, 'buyApple').mockRejectedValueOnce(new ShopApiError('not_your_receipt', 403)).mockResolvedValue({ ...wallet(900), credited: true })
    expect(await restorePurchases()).toEqual(['pack_avatar'])
    expect(recover).toHaveBeenCalledTimes(1)
    expect(buy).toHaveBeenCalledTimes(2)
    expect(finish).toHaveBeenCalledTimes(1)
    expect(JSON.parse(store.get('starpath.account.v1')!).accountId).toBe('old-acc')
  })
  it('restore: recovery refused (another player’s receipt) → nothing credited, nothing finished, no retry', async () => {
    const finish = vi.fn(async () => {})
    setProvider({ id: 'fake', real: true, products: async () => [], buy: async () => ({ ok: false }), restore: async () => [oldReceipt(finish)] })
    vi.spyOn(shopApi, 'recoverApple').mockResolvedValue('refused')
    const buy = vi.spyOn(shopApi, 'buyApple').mockRejectedValue(new ShopApiError('not_your_receipt', 403))
    expect(await restorePurchases()).toEqual([])
    await retryUnredeemed()
    expect(buy).toHaveBeenCalledTimes(1)
    expect(finish).not.toHaveBeenCalled()
    expect(JSON.parse(store.get('starpath.account.v1')!).accountId).toBe('acc')
  })
  it('retry queue: a refused recovery drops the receipt for good (no endless recover calls)', async () => {
    const finish = vi.fn(async () => {})
    const r = oldReceipt(finish, 'tx-q')
    setProvider({ id: 'fake', real: true, products: async () => [], buy: async () => ({ ok: true, receipt: r }), restore: async () => [] })
    const buy = vi.spyOn(shopApi, 'buyApple').mockRejectedValueOnce(new ShopApiError('offline')).mockRejectedValue(new ShopApiError('not_your_receipt', 403))
    const recover = vi.spyOn(shopApi, 'recoverApple').mockResolvedValue('refused')
    await purchase('gems_m')
    await retryUnredeemed()
    await retryUnredeemed()
    expect(buy).toHaveBeenCalledTimes(2)
    expect(recover).toHaveBeenCalledTimes(1)
    expect(JSON.parse(store.get('starpath.redeemed.v1') ?? '[]')).toContain('tx-q')
  })
  it('retry queue: a recovery that could not reach the server is tried again later', async () => {
    const r = oldReceipt(vi.fn(async () => {}), 'tx-r')
    setProvider({ id: 'fake', real: true, products: async () => [], buy: async () => ({ ok: true, receipt: r }), restore: async () => [] })
    vi.spyOn(shopApi, 'buyApple').mockRejectedValueOnce(new ShopApiError('offline')).mockRejectedValue(new ShopApiError('not_your_receipt', 403))
    const recover = vi.spyOn(shopApi, 'recoverApple').mockResolvedValue('retry')
    await purchase('gems_m')
    await retryUnredeemed()
    await retryUnredeemed()
    expect(recover).toHaveBeenCalledTimes(2)
    recover.mockResolvedValue('refused') // empty the queue for the next test
    await retryUnredeemed()
  })
  it('launch: receipts made for another shop account are not sent automatically', async () => {
    const mine: StoreReceipt = { productId: 'gems_m', txId: 'tx-mine', jws: 'jws-mine', accountToken: 'ACC', finish: vi.fn(async () => {}) }
    setProvider({ id: 'capacitor', real: true, products: async () => [], buy: async () => ({ ok: false }), restore: async () => [], pending: async () => [oldReceipt(vi.fn(async () => {}), 'tx-other'), mine] })
    const buy = vi.spyOn(shopApi, 'buyApple').mockResolvedValue({ ...wallet(600), credited: true })
    await resumePending()
    expect(buy).toHaveBeenCalledWith('jws-mine')
    expect(buy).not.toHaveBeenCalledWith('jws-tx-other')
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

describe('free-diamond queue', () => {
  it('one source at its daily cap holds only its own claims; the others are still sent', async () => {
    queueEarn('motm', 'm1')
    queueEarn('motm', 'm2')
    queueEarn('objective', 'o1')
    const earn = vi.spyOn(shopApi, 'earn').mockImplementation(async (source) =>
      source === 'motm' ? { ...wallet(), earned: 0, capped: true, reason: 'source', retryAfter: 3600 } as never : { ...wallet(8), earned: 8 })
    await flushEarnQueue()
    expect(earn.mock.calls.map((c) => c[1])).toEqual(['m1', 'o1'])
    expect(JSON.parse(store.get('starpath.earnq.v1') ?? '[]').map((x: { ref: string }) => x.ref)).toEqual(['m1', 'm2'])
    expect(store.get('starpath.earnq.pause.v1')).toBeUndefined()
  })
})
