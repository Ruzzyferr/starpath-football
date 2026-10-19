// AdMob rewarded-ad server-side verification (SSV): Google calls our callback URL with a signed
// query string after the user really finished the ad. Keys: https://www.gstatic.com/admob/reward/verifier-keys.json
import { createPublicKey, verify } from 'node:crypto'

export const ADMOB_KEYS_URL = 'https://www.gstatic.com/admob/reward/verifier-keys.json'

export class AdMobVerifier {
  constructor({ fetchImpl = fetch, keysUrl = ADMOB_KEYS_URL } = {}) {
    this.fetch = fetchImpl
    this.url = keysUrl
    this.keys = new Map()
    this.loadedAt = 0
  }

  async key(id) {
    if (!this.keys.has(id) || Date.now() - this.loadedAt > 24 * 3600_000) {
      const r = await this.fetch(this.url)
      if (!r.ok) throw new Error(`admob keys ${r.status}`)
      const j = await r.json()
      this.keys = new Map(j.keys.map((k) => [String(k.keyId), createPublicKey(k.pem)]))
      this.loadedAt = Date.now()
    }
    return this.keys.get(id)
  }

  /** `rawQuery` = the callback's query string exactly as received (without the leading '?'). */
  async verify(rawQuery) {
    const i = rawQuery.indexOf('&signature=')
    if (i < 0) return null
    const message = rawQuery.slice(0, i)
    const params = new URLSearchParams(rawQuery)
    const sig = params.get('signature')
    const keyId = params.get('key_id')
    if (!sig || !keyId) return null
    const key = await this.key(keyId)
    if (!key) return null
    const ok = verify('sha256', Buffer.from(message), key, Buffer.from(sig, 'base64url'))
    if (!ok) return null
    return Object.fromEntries(new URLSearchParams(message))
  }
}
