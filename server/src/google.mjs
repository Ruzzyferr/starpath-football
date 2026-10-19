// Google Play purchase verification through the Play Developer API (service account, no SDK).
// Configured with GOOGLE_SA_FILE (service-account JSON with Play Console "View financial data" +
// "Manage orders") and ANDROID_PACKAGE. Without them Android purchases are refused (never trusted blind).
import { readFileSync } from 'node:fs'
import { createSign } from 'node:crypto'

const b64u = (b) => Buffer.from(b).toString('base64url')
const enc = encodeURIComponent

/** JSON.parse that never throws (Google error pages can be HTML). */
export function safeJson(text) {
  try {
    const v = JSON.parse(text)
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}

/**
 * How a non-200 Play answer is to be read. Transient: no answer (0), server errors, rate limiting,
 * and our own credentials failing (401/403 is a server configuration problem, not a bad receipt).
 * 404 / 410 / 400 say the token is unknown, which right after a purchase can still be propagation:
 * the caller decides with the purchase time it knows.
 */
export function failure(status) {
  if (status === 0 || status >= 500 || status === 429 || status === 401 || status === 403) return { transient: true }
  return { transient: false, notFound: status === 404 || status === 410 }
}

export class GooglePlay {
  constructor({ saFile, packageName, fetchImpl = fetch, now = () => Date.now() }) {
    this.pkg = packageName
    this.fetch = fetchImpl
    this.now = now
    this.sa = saFile ? JSON.parse(readFileSync(saFile, 'utf8')) : null
    this.token = null
  }

  get configured() {
    return !!(this.sa && this.pkg)
  }

  async accessToken() {
    if (this.token && this.token.exp > Date.now() + 60_000) return this.token.value
    const now = Math.floor(Date.now() / 1000)
    const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    const claims = b64u(JSON.stringify({ iss: this.sa.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }))
    const sig = createSign('RSA-SHA256').update(`${head}.${claims}`).sign(this.sa.private_key).toString('base64url')
    const r = await this.fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claims}.${sig}` }),
    })
    if (!r.ok) throw new Error(`google token ${r.status}`)
    const j = safeJson(await r.text())
    if (!j.access_token) throw new Error('google token: no access_token')
    this.token = { value: j.access_token, exp: Date.now() + (Number(j.expires_in) || 600) * 1000 }
    return this.token.value
  }

  /**
   * One API call. A transport failure (network, DNS, token endpoint down) comes back as status 0, so
   * callers can tell "Google did not answer" from "Google said no".
   */
  async api(path, init = {}) {
    try {
      return await this.apiRaw(path, init)
    } catch (e) {
      return { status: 0, body: {}, error: String(e?.message ?? e) }
    }
  }

  async apiRaw(path, init = {}) {
    const r = await this.fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${enc(this.pkg)}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${await this.accessToken()}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    })
    const text = await r.text()
    return { status: r.status, body: text ? safeJson(text) : {} }
  }

  /** One-time product: purchased (0), not cancelled, for this account (obfuscatedExternalAccountId). */
  async verifyProduct(productId, token) {
    const { status, body } = await this.api(`/purchases/products/${enc(productId)}/tokens/${enc(token)}`)
    if (status !== 200) return { ok: false, why: `play ${status}`, ...failure(status) }
    return {
      ok: body.purchaseState === 0,
      // 2 = pending (paid later in cash, for example): not definitive, the app asks again later.
      pending: body.purchaseState === 2,
      purchaseTime: Number(body.purchaseTimeMillis) || null,
      productId: body.productId ?? productId, // the path already names the product
      orderId: body.orderId,
      account: body.obfuscatedExternalAccountId,
      consumed: body.consumptionState === 1,
      acknowledged: body.acknowledgementState === 1,
      test: body.purchaseType === 0, // 0 = test (licence tester); 1 promo and 2 rewarded are real
      why: body.purchaseState === 0 ? null : 'not purchased',
    }
  }

  /** Subscription v2: active state, product and expiry. */
  async verifySubscription(token) {
    const { status, body } = await this.api(`/purchases/subscriptionsv2/tokens/${enc(token)}`)
    if (status !== 200) return { ok: false, why: `play ${status}`, ...failure(status) }
    const line = body.lineItems?.[0]
    const expires = line?.expiryTime ? Date.parse(line.expiryTime) || 0 : 0
    // CANCELED = auto-renew turned off: the paid period still runs until its expiry.
    const active = ['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'].includes(body.subscriptionState) ||
      (body.subscriptionState === 'SUBSCRIPTION_STATE_CANCELED' && expires > this.now())
    return {
      ok: active,
      pending: body.subscriptionState === 'SUBSCRIPTION_STATE_PENDING',
      purchaseTime: body.startTime ? Date.parse(body.startTime) || null : null,
      productId: line?.productId,
      expires,
      orderId: body.latestOrderId,
      account: body.externalAccountIdentifiers?.obfuscatedExternalAccountId,
      acknowledged: body.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
      test: body.testPurchase != null,
      why: active ? null : body.subscriptionState,
    }
  }

  /** Server-side finish after crediting: consume a consumable, acknowledge anything else. */
  async consumeProduct(productId, token) {
    return (await this.api(`/purchases/products/${enc(productId)}/tokens/${enc(token)}:consume`, { method: 'POST' })).status
  }

  async acknowledgeProduct(productId, token) {
    return (await this.api(`/purchases/products/${enc(productId)}/tokens/${enc(token)}:acknowledge`, { method: 'POST', body: '{}' })).status
  }

  async acknowledgeSubscription(subscriptionId, token) {
    return (await this.api(`/purchases/subscriptions/${enc(subscriptionId)}/tokens/${enc(token)}:acknowledge`, { method: 'POST', body: '{}' })).status
  }

  /** Is this purchase token in Play's voided purchases since `startTime` (ms)? Throws when Play does not answer. */
  async isVoided(token, startTime) {
    return (await this.voidedPurchases(startTime)).some((vp) => vp.purchaseToken === token)
  }

  /** Refunded / charged-back / revoked purchases since `startTime` (ms), products and subscriptions. */
  async voidedPurchases(startTime) {
    const out = []
    let page = ''
    for (let i = 0; i < 20; i++) {
      const q = new URLSearchParams({ startTime: String(startTime), type: '1', maxResults: '1000' })
      if (page) q.set('token', page)
      const { status, body } = await this.api(`/purchases/voidedpurchases?${q}`)
      if (status !== 200) throw new Error(`voidedpurchases ${status}`)
      out.push(...(body.voidedPurchases ?? []))
      page = body.tokenPagination?.nextPageToken
      if (!page) break
    }
    return out
  }
}
