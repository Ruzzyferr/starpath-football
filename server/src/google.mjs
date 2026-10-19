// Google Play purchase verification through the Play Developer API (service account, no SDK).
// Configured with GOOGLE_SA_FILE (service-account JSON with Play Console "View financial data" +
// "Manage orders") and ANDROID_PACKAGE. Without them Android purchases are refused (never trusted blind).
import { readFileSync } from 'node:fs'
import { createSign } from 'node:crypto'

const b64u = (b) => Buffer.from(b).toString('base64url')

export class GooglePlay {
  constructor({ saFile, packageName, fetchImpl = fetch }) {
    this.pkg = packageName
    this.fetch = fetchImpl
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
    const j = await r.json()
    this.token = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 }
    return this.token.value
  }

  async api(path, init = {}) {
    const r = await this.fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(this.pkg)}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${await this.accessToken()}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    })
    const text = await r.text()
    return { status: r.status, body: text ? JSON.parse(text) : {} }
  }

  /** One-time product: purchased (0), not cancelled, for this account (obfuscatedExternalAccountId). */
  async verifyProduct(productId, token) {
    const { status, body } = await this.api(`/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}`)
    if (status !== 200) return { ok: false, why: `play ${status}` }
    return { ok: body.purchaseState === 0, orderId: body.orderId, account: body.obfuscatedExternalAccountId, consumed: body.consumptionState === 1, acknowledged: body.acknowledgementState === 1, test: body.purchaseType === 0, why: body.purchaseState === 0 ? null : 'not purchased' }
  }

  /** Subscription v2: active state and expiry. */
  async verifySubscription(token) {
    const { status, body } = await this.api(`/purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}`)
    if (status !== 200) return { ok: false, why: `play ${status}` }
    const line = body.lineItems?.[0]
    const active = ['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'].includes(body.subscriptionState)
    return { ok: active, productId: line?.productId, expires: line?.expiryTime ? Date.parse(line.expiryTime) : 0, orderId: body.latestOrderId, account: body.externalAccountIdentifiers?.obfuscatedExternalAccountId, why: active ? null : body.subscriptionState }
  }
}
