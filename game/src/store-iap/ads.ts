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
        // Consent first (EU/UK/TR: Google's UMP form when required).
        let canRequest = true
        let npa = false
        try {
          let info = await AdMob.requestConsentInfo({ tagForUnderAgeOfConsent: !(playerIsAdult?.() ?? false) })
          if (info.isConsentFormAvailable && info.status === 'REQUIRED') info = await AdMob.showConsentForm()
          canRequest = info.canRequestAds
          npa = info.status !== 'OBTAINED' && info.status !== 'NOT_REQUIRED'
        } catch {
          // Consent service unreachable: only non-personalised ads.
          npa = true
        }
        if (!canRequest) return { ok: false, npa: true }
        // Teen ceiling; under-18 or unknown age (ui/ageGate) → treated as under the age of consent: no personalisation.
        const adult = playerIsAdult?.() ?? false
        // iOS does not track (no ATT prompt, App Privacy says no tracking): non-personalised ads only.
        if (!adult || detectPlatform() === 'ios') npa = true
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
    // Test ads until the store release sets VITE_ADS_LIVE=1 (real taps in TestFlight / dev break AdMob policy).
    const testing = adId === ADMOB_TEST_UNITS.ios || adId === ADMOB_TEST_UNITS.android || import.meta.env?.VITE_ADS_LIVE !== '1'
    const handles: { remove(): Promise<void> }[] = []
    try {
      await AdMob.prepareRewardVideoAd({ adId, isTesting: testing, npa: init.npa, ssv: { userId: accountId, customData: `${accountId}:${nonce}` } })
      // The reward and the close are separate events: listen to both, so closing early never hangs.
      let rewarded = false
      let fail: () => void = () => {}
      const outcome = new Promise<AdOutcome>((resolve) => {
        const timer = setTimeout(() => resolve(rewarded ? 'rewarded' : 'failed'), AD_TIMEOUT_MS)
        const done = (o: AdOutcome) => {
          clearTimeout(timer)
          resolve(o)
        }
        void AdMob.addListener(RewardAdPluginEvents.Rewarded, () => { rewarded = true }).then((h) => handles.push(h))
        // Some SDK versions deliver Rewarded just AFTER Dismissed: give it a moment before deciding.
        void AdMob.addListener(RewardAdPluginEvents.Dismissed, () => { setTimeout(() => done(rewarded ? 'rewarded' : 'dismissed'), 700) }).then((h) => handles.push(h))
        void AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => done('failed')).then((h) => handles.push(h))
        fail = () => done(rewarded ? 'rewarded' : 'failed')
      })
      const shown = AdMob.showRewardVideoAd().then((r) => {
        if (r && typeof r.amount === 'number') rewarded = true
        return null
      })
      // A rejected show (no fill, activity gone) ends the wait now instead of after the 120 s timeout.
      shown.catch(() => fail())
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
      el.setAttribute('aria-modal', 'true')
      el.setAttribute('aria-label', 'Test reklam / Test ad')
      el.dataset.testid = 'dev-ad'
      el.dataset.offer = offer
      let left = DEV_AD_SECONDS
      el.innerHTML = `<div class="dev-ad-box"><div class="dev-ad-tag">TEST AD</div><div class="dev-ad-count" data-testid="dev-ad-count">${left}</div><button type="button" class="dev-ad-close" data-testid="dev-ad-close" aria-label="Kapat / Close">✕</button></div>`
      document.body.appendChild(el)
      el.querySelector<HTMLButtonElement>('button')?.focus()
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

/** EU/UK: the player can reopen Google's consent form (Settings › Ad privacy choices). */
export async function adPrivacyOptionsRequired(): Promise<boolean> {
  if (!isMobileNative(detectPlatform())) return false
  try {
    const { AdMob } = await import('@capacitor-community/admob')
    const info = await AdMob.requestConsentInfo()
    return String(info.privacyOptionsRequirementStatus) === 'REQUIRED'
  } catch {
    return false
  }
}
export async function showAdPrivacyOptions(): Promise<boolean> {
  try {
    const { AdMob } = await import('@capacitor-community/admob')
    await AdMob.showPrivacyOptionsForm()
    return true
  } catch {
    return false
  }
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

/**
 * Ads that were watched to the end but whose reward the server has not confirmed yet (offline, slow
 * SSV, server down). Kept on the device and retried until the server answers or the 30-minute ad
 * session expires: a watched ad is never silently lost.
 */
const PENDING_KEY = 'starpath.adpending.v1'
type PendingAd = { nonce: string; offer: AdOffer; career?: string; at: number }
function pendingAds(): PendingAd[] {
  try {
    const v = JSON.parse(globalThis.localStorage?.getItem(PENDING_KEY) ?? '[]') as unknown
    return Array.isArray(v) ? (v as PendingAd[]).filter((x) => x && typeof x.nonce === 'string') : []
  } catch {
    return []
  }
}
function setPendingAds(list: PendingAd[]): void {
  try {
    globalThis.localStorage?.setItem(PENDING_KEY, JSON.stringify(list.slice(-20)))
  } catch {
    /* private mode */
  }
}
/** Ad sessions older than this are expired on the server (no reward any more). */
const AD_SESSION_MS = 30 * 60_000

/** Nonces whose adComplete is running (watchAd or the retry), so the two never send the same one at once. */
const inFlight = new Set<string>()

async function completeAd(a: PendingAd): Promise<AdResult> {
  inFlight.add(a.nonce)
  try {
    return await completeAdOnce(a)
  } finally {
    inFlight.delete(a.nonce)
  }
}

async function completeAdOnce(a: PendingAd): Promise<AdResult> {
  // SSV can arrive a moment after the ad closes: retry briefly while the server waits for it.
  for (let i = 0; ; i++) {
    try {
      const w = await shopApi.adComplete(a.nonce, a.career)
      await handleWallet(w)
      setPendingAds(pendingAds().filter((x) => x.nonce !== a.nonce))
      return { ok: true, grant: w.grant, gems: w.gems }
    } catch (e) {
      const code = e instanceof ShopApiError ? e.code : 'failed'
      if ((code === 'ad_not_verified' || code === 'ad_too_short') && i < 8) {
        await wait(1500)
        continue
      }
      const st = e instanceof ShopApiError ? e.status : 0
      // ad_cap_reached / refund_hold / already_rewarded / ad_expired / ad_aborted are final answers.
      const transient = code === 'offline' || code === 'ad_not_verified' || code === 'rate_limited' || st >= 500
      // Definitive answers (already rewarded, expired, aborted, unknown) end the wait.
      if (!transient || Date.now() - a.at > AD_SESSION_MS) setPendingAds(pendingAds().filter((x) => x.nonce !== a.nonce))
      return { ok: false, reason: transient ? 'pending_reward' : code }
    }
  }
}

/** Is a watched ad for this offer still waiting for its reward? (The offer stays closed meanwhile.) */
export function hasPendingAd(offer: AdOffer): boolean {
  return pendingAds().some((a) => a.offer === offer)
}

let retrying: Promise<void> | null = null
/** Retry watched-but-unconfirmed ads (launch, reconnect, app resume). */
export function retryPendingAds(): Promise<void> {
  retrying ??= (async () => {
    // A nonce that watchAd is completing right now is left to it (no double adComplete).
    for (const a of pendingAds()) if (!inFlight.has(a.nonce)) await completeAd(a)
  })().finally(() => {
    retrying = null
  })
  return retrying
}

export async function watchAd(offer: AdOffer, ctx: { ref?: string; career?: string } = {}): Promise<AdResult> {
  const p = getAdProvider()
  if (!p || !storeAvailable()) return { ok: false, reason: 'failed' }
  try {
    const acc = await ensureAccount(detectPlatform())
    const start = await shopApi.adStart(offer, ctx.ref)
    if (!start.skipAd) {
      const outcome = await p.show({ offer, accountId: acc.accountId, nonce: start.nonce })
      if (outcome !== 'rewarded') {
        // Closed early or failed to show: release the session (nothing is used up).
        void shopApi.adAbort(start.nonce).catch(() => {})
        return { ok: false, reason: outcome }
      }
    }
    // Watched: remember it before asking for the reward, so a network drop cannot lose it.
    const pending: PendingAd = { nonce: start.nonce, offer, career: ctx.career, at: Date.now() }
    setPendingAds([...pendingAds().filter((x) => x.nonce !== pending.nonce), pending])
    return await completeAd(pending)
  } catch (e) {
    return { ok: false, reason: e instanceof ShopApiError ? e.code : 'failed' }
  }
}

let listening = false
/** Boot: retry pending ad rewards now and whenever the app comes back online / to the foreground. */
export function installAdRetry(): void {
  if (listening) return
  listening = true
  void retryPendingAds()
  globalThis.addEventListener?.('online', () => void retryPendingAds())
  globalThis.document?.addEventListener?.('visibilitychange', () => {
    if (document.visibilityState === 'visible') void retryPendingAds()
  })
}
