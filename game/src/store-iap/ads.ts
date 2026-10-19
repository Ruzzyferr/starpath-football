/**
 * Rewarded ads (docs/MONETIZASYON.md §6.7): opt-in "watch, earn", never inside a match or minigame,
 * no interstitials. The reward is decided by the shop server: an ad session is opened there (daily cap),
 * the ad is shown, and only the server's "complete" grants the reward (with AdMob server-side
 * verification when the server requires it). An ad that fails to load or is closed early uses up nothing.
 *
 * Native: Google AdMob (@capacitor-community/admob). Until the owner's AdMob account exists the build uses
 * Google's official TEST ad units, which never pay out. Dev web builds use a simulated ad.
 */
import { detectPlatform, isMobileNative } from '../platform/detect'
import { ShopApiError, ensureAccount, shopApi, type ServerGrant } from './shopApi'
import { handleWallet, storeAvailable } from './service'

export type AdOffer = 'gems' | 'match_bonus' | 'train_boost' | 'physio_disc' | 'season_x2'
export type AdOutcome = 'rewarded' | 'dismissed' | 'failed'

export interface AdProvider {
  readonly id: string
  available(): boolean
  show(o: { offer: AdOffer; accountId: string; nonce: string }): Promise<AdOutcome>
}

/** Google's public test units (no revenue). Replace with real unit ids once AdMob is set up. */
export const ADMOB_TEST_UNITS = {
  android: 'ca-app-pub-3940256099942544/5224354917',
  ios: 'ca-app-pub-3940256099942544/1712485313',
} as const

declare const __SP_ADMOB_UNITS__: { android?: string; ios?: string } | undefined

class AdMobProvider implements AdProvider {
  readonly id = 'admob'
  private ready: Promise<boolean> | null = null
  available(): boolean {
    return true
  }
  private init(): Promise<boolean> {
    this.ready ??= (async () => {
      try {
        const { AdMob, MaxAdContentRating } = await import('@capacitor-community/admob')
        // Consent first (EU/UK/TR: UMP form when required), then iOS tracking permission.
        try {
          const info = await AdMob.requestConsentInfo()
          if (info.isConsentFormAvailable && info.status === 'REQUIRED') await AdMob.showConsentForm()
        } catch {
          /* consent service unreachable: non-personalised ads below */
        }
        if (detectPlatform() === 'ios') {
          try {
            const st = await AdMob.trackingAuthorizationStatus()
            if (st.status === 'notDetermined') await AdMob.requestTrackingAuthorization()
          } catch {
            /* older iOS */
          }
        }
        await AdMob.initialize({ maxAdContentRating: MaxAdContentRating.Teen })
        return true
      } catch {
        return false
      }
    })()
    return this.ready
  }
  async show({ accountId, nonce }: { offer: AdOffer; accountId: string; nonce: string }): Promise<AdOutcome> {
    if (!(await this.init())) return 'failed'
    try {
      const { AdMob } = await import('@capacitor-community/admob')
      const units = typeof __SP_ADMOB_UNITS__ === 'object' && __SP_ADMOB_UNITS__ ? __SP_ADMOB_UNITS__ : {}
      const ios = detectPlatform() === 'ios'
      const adId = (ios ? units.ios : units.android) || (ios ? ADMOB_TEST_UNITS.ios : ADMOB_TEST_UNITS.android)
      const testing = adId === ADMOB_TEST_UNITS.ios || adId === ADMOB_TEST_UNITS.android
      await AdMob.prepareRewardVideoAd({ adId, isTesting: testing, ssv: { userId: accountId, customData: `${accountId}:${nonce}` } })
      const reward = await AdMob.showRewardVideoAd()
      return reward && typeof reward.amount === 'number' ? 'rewarded' : 'dismissed'
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? e).toLowerCase()
      return /dismiss|cancel|close/.test(msg) ? 'dismissed' : 'failed'
    }
  }
}

/** Dev / web test build: a 6-second full-screen stand-in with a close button. */
export const DEV_AD_SECONDS = 6
class DevAdProvider implements AdProvider {
  readonly id = 'dev'
  available(): boolean {
    return typeof document !== 'undefined'
  }
  show({ offer }: { offer: AdOffer }): Promise<AdOutcome> {
    return new Promise((resolve) => {
      const el = document.createElement('div')
      el.className = 'dev-ad'
      el.setAttribute('role', 'dialog')
      el.setAttribute('aria-label', 'Test ad')
      el.dataset.testid = 'dev-ad'
      el.dataset.offer = offer
      let left = DEV_AD_SECONDS
      el.innerHTML = `<div class="dev-ad-box"><div class="dev-ad-tag">TEST AD</div><div class="dev-ad-count" data-testid="dev-ad-count">${left}</div><button type="button" class="dev-ad-close" data-testid="dev-ad-close" aria-label="Close">✕</button></div>`
      document.body.appendChild(el)
      const finish = (o: AdOutcome) => {
        clearInterval(iv)
        el.remove()
        resolve(o)
      }
      const iv = setInterval(() => {
        left -= 1
        const c = el.querySelector('.dev-ad-count')
        if (c) c.textContent = String(Math.max(0, left))
        if (left <= 0) finish('rewarded')
      }, 1000)
      el.querySelector('button')?.addEventListener('click', () => finish(left <= 0 ? 'rewarded' : 'dismissed'))
    })
  }
}

let adProvider: AdProvider | null = null
export function getAdProvider(): AdProvider | null {
  if (adProvider) return adProvider
  if (isMobileNative(detectPlatform())) adProvider = new AdMobProvider()
  else if (import.meta.env?.DEV) adProvider = new DevAdProvider()
  return adProvider
}
/** Tests only. */
export function setAdProvider(p: AdProvider | null): void {
  adProvider = p
}

export function adsAvailable(): boolean {
  return storeAvailable() && !!getAdProvider()?.available()
}

export interface AdResult {
  ok: boolean
  /** Why nothing was granted: 'dismissed' | 'failed' | 'offline' | 'ad_cap' | server code. Nothing is used up on failure. */
  reason?: string
  grant?: ServerGrant | null
  gems?: number
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function watchAd(offer: AdOffer): Promise<AdResult> {
  const p = getAdProvider()
  if (!p || !storeAvailable()) return { ok: false, reason: 'failed' }
  try {
    const acc = await ensureAccount(detectPlatform())
    const start = await shopApi.adStart(offer)
    if (!start.skipAd) {
      const outcome = await p.show({ offer, accountId: acc.accountId, nonce: start.nonce })
      if (outcome !== 'rewarded') return { ok: false, reason: outcome }
    }
    // SSV can arrive a moment after the ad closes: retry briefly while the server waits for it.
    for (let i = 0; ; i++) {
      try {
        const w = await shopApi.adComplete(start.nonce)
        await handleWallet(w)
        return { ok: true, grant: w.grant, gems: w.gems }
      } catch (e) {
        const code = e instanceof ShopApiError ? e.code : 'failed'
        if ((code === 'ad_not_verified' || code === 'ad_too_short') && i < 8) {
          await wait(1500)
          continue
        }
        throw e
      }
    }
  } catch (e) {
    return { ok: false, reason: e instanceof ShopApiError ? e.code : 'failed' }
  }
}
