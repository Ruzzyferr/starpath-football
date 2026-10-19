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

/** Real unit ids come from the build environment (VITE_ADMOB_UNIT_ANDROID / _IOS); without them, Google's test units. */
function unitFor(ios: boolean): string {
  const env = import.meta.env ?? {}
  const real = (ios ? env.VITE_ADMOB_UNIT_IOS : env.VITE_ADMOB_UNIT_ANDROID) as string | undefined
  return real || (ios ? ADMOB_TEST_UNITS.ios : ADMOB_TEST_UNITS.android)
}

/** Longest a rewarded ad may take before we give up waiting (the reward is then simply not granted). */
const AD_TIMEOUT_MS = 120_000

class AdMobProvider implements AdProvider {
  readonly id = 'admob'
  private ready: Promise<{ ok: boolean; npa: boolean }> | null = null
  available(): boolean {
    return true
  }
  private init(): Promise<{ ok: boolean; npa: boolean }> {
    this.ready ??= (async () => {
      try {
        const { AdMob, MaxAdContentRating } = await import('@capacitor-community/admob')
        // Consent first (EU/UK/TR: Google's UMP form when required), then iOS tracking permission.
        let canRequest = true
        let npa = false
        try {
          let info = await AdMob.requestConsentInfo()
          if (info.isConsentFormAvailable && info.status === 'REQUIRED') info = await AdMob.showConsentForm()
          canRequest = info.canRequestAds
          npa = info.status !== 'OBTAINED' && info.status !== 'NOT_REQUIRED'
        } catch {
          // Consent service unreachable: only non-personalised ads.
          npa = true
        }
        if (!canRequest) return { ok: false, npa: true }
        if (detectPlatform() === 'ios') {
          try {
            const st = await AdMob.trackingAuthorizationStatus()
            if (st.status === 'notDetermined') await AdMob.requestTrackingAuthorization()
            const after = await AdMob.trackingAuthorizationStatus()
            if (after.status !== 'authorized') npa = true
          } catch {
            npa = true
          }
        }
        // Teen ceiling; under-18 or unknown age (ui/ageGate) → treated as under the age of consent: no personalisation.
        const adult = playerIsAdult?.() ?? false
        if (!adult) npa = true
        await AdMob.initialize({ maxAdContentRating: MaxAdContentRating.Teen, tagForUnderAgeOfConsent: !adult })
        return { ok: true, npa }
      } catch {
        return { ok: false, npa: true }
      }
    })()
    return this.ready.then((r) => {
      if (!r.ok) this.ready = null // try again next time (offline at first launch, consent later)
      return r
    })
  }
  async show({ accountId, nonce }: { offer: AdOffer; accountId: string; nonce: string }): Promise<AdOutcome> {
    const init = await this.init()
    if (!init.ok) return 'failed'
    const { AdMob, RewardAdPluginEvents } = await import('@capacitor-community/admob')
    const ios = detectPlatform() === 'ios'
    const adId = unitFor(ios)
    const testing = adId === ADMOB_TEST_UNITS.ios || adId === ADMOB_TEST_UNITS.android
    const handles: { remove(): Promise<void> }[] = []
    try {
      await AdMob.prepareRewardVideoAd({ adId, isTesting: testing, npa: init.npa, ssv: { userId: accountId, customData: `${accountId}:${nonce}` } })
      // The reward and the close are separate events: listen to both, so closing early never hangs.
      let rewarded = false
      const outcome = new Promise<AdOutcome>((resolve) => {
        const timer = setTimeout(() => resolve(rewarded ? 'rewarded' : 'failed'), AD_TIMEOUT_MS)
        const done = (o: AdOutcome) => {
          clearTimeout(timer)
          resolve(o)
        }
        void AdMob.addListener(RewardAdPluginEvents.Rewarded, () => { rewarded = true }).then((h) => handles.push(h))
        void AdMob.addListener(RewardAdPluginEvents.Dismissed, () => done(rewarded ? 'rewarded' : 'dismissed')).then((h) => handles.push(h))
        void AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => done('failed')).then((h) => handles.push(h))
      })
      const shown = AdMob.showRewardVideoAd().then((r) => {
        if (r && typeof r.amount === 'number') rewarded = true
        return null
      })
      shown.catch(() => {})
      return await outcome
    } catch {
      return 'failed'
    } finally {
      for (const h of handles) void h.remove().catch(() => {})
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
/** Set by the UI (ui/ageGate): whether the player said they are 18+. The store layer never imports the UI. */
let playerIsAdult: (() => boolean) | null = null
export function setPlayerAgeCheck(fn: () => boolean): void {
  playerIsAdult = fn
}

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

export async function watchAd(offer: AdOffer, ctx: { ref?: string; career?: string } = {}): Promise<AdResult> {
  const p = getAdProvider()
  if (!p || !storeAvailable()) return { ok: false, reason: 'failed' }
  try {
    const acc = await ensureAccount(detectPlatform())
    const start = await shopApi.adStart(offer, ctx.ref)
    if (!start.skipAd) {
      const outcome = await p.show({ offer, accountId: acc.accountId, nonce: start.nonce })
      if (outcome !== 'rewarded') return { ok: false, reason: outcome }
    }
    // SSV can arrive a moment after the ad closes: retry briefly while the server waits for it.
    for (let i = 0; ; i++) {
      try {
        const w = await shopApi.adComplete(start.nonce, ctx.career)
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
