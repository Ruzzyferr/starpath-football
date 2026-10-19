// HTTP layer: tiny router, strict JSON parsing, size limits, per-IP and per-account rate limits,
// CORS limited to the app's own origins, no stack traces to clients.
import { createServer } from 'node:http'
import { createHash, timingSafeEqual } from 'node:crypto'
import { ShopError, codeBucket } from './shop.mjs'
import { safeJson } from './google.mjs'
import { ipKey } from './net.mjs'

export { ipKey }

const MAX_BODY = 16 * 1024
/** App Store Server Notifications nest signed JWS inside a signed JWS (three x5c chains). */
const MAX_NOTIFICATION = 128 * 1024

/** Token bucket per key. At `maxKeys` the least recently used keys are evicted (never a full clear). */
export class RateLimiter {
  constructor(perMinute, burst = perMinute, maxKeys = 50_000) {
    this.rate = perMinute / 60_000
    this.burst = burst
    this.max = maxKeys
    this.b = new Map()
  }
  take(key, now = Date.now()) {
    let s = this.b.get(key)
    if (s) this.b.delete(key) // re-inserted below: Map order = least recently used first
    else s = { t: this.burst, at: now }
    this.b.set(key, s)
    if (this.b.size > this.max) {
      let drop = Math.ceil(this.max / 10)
      for (const k of this.b.keys()) { if (drop-- <= 0 || k === key) break; this.b.delete(k) }
    }
    s.t = Math.min(this.burst, s.t + (now - s.at) * this.rate)
    s.at = now
    if (s.t < 1) return false
    s.t -= 1
    return true
  }
}

function readBody(req, max = MAX_BODY) {
  return new Promise((resolve, reject) => {
    let size = 0
    let over = false
    const chunks = []
    req.on('data', (c) => {
      if (over) return
      size += c.length
      if (size > max) {
        // Stop buffering; the 413 is sent and the socket destroyed after it.
        over = true
        chunks.length = 0
        reject(new ShopError(413, 'too_large'))
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

const sameSecret = (a, b) => timingSafeEqual(createHash('sha256').update(String(a)).digest(), createHash('sha256').update(String(b)).digest())

export function createApp({ shop, admob, origins, trustProxy = true, log = () => {}, limits = {}, rtdnToken = '', opsToken = '' }) {
  // Per-IP limits stay generous: mobile carriers put many players behind one address (CGNAT).
  const ipLimit = new RateLimiter(limits.ipPerMin ?? 600, limits.ipBurst ?? 200)
  const regLimit = new RateLimiter(limits.regPerMin ?? 30, limits.regBurst ?? 30)
  // All registrations together (a botnet across many addresses); also the recovery-code total.
  const regGlobal = new RateLimiter(limits.regGlobalPerMin ?? 120, limits.regGlobalPerMin ?? 120)
  // Recovery-code guesses: per address, and per code-hash prefix (spread guesses from many addresses).
  const codeLimit = new RateLimiter(limits.codePerMin ?? 5, limits.codePerMin ?? 5)
  const codeBucketLimit = new RateLimiter(limits.codeBucketPerMin ?? 5, limits.codeBucketPerMin ?? 5)
  // Failed sign-ins per account id prefix (many addresses hammering one account): 60 per 10 minutes.
  const authFailAcc = new RateLimiter(limits.authFailPerMin ?? 6, limits.authFailBurst ?? 60)
  const accLimit = new RateLimiter(90, 40)
  // Store callbacks (signature- or token-checked) get their own bucket, apart from app traffic.
  const cbLimit = new RateLimiter(1200, 300)

  const str = (v) => (typeof v === 'string' ? v : '')
  const routes = {
    'POST /v1/register': async ({ body, ip }) => {
      if (!regLimit.take(ipKey(ip)) || !regGlobal.take('all')) throw new ShopError(429, 'rate_limited')
      return shop.register(ip, body.platform)
    },
    'GET /v1/wallet': async ({ acc }) => shop.wallet(acc),
    'POST /v1/purchase/apple': async ({ acc, body }) => shop.applePurchase(acc, body.jws),
    'POST /v1/purchase/google': async ({ acc, body }) => shop.googlePurchase(acc, { productId: body.productId, purchaseToken: body.purchaseToken }),
    'POST /v1/purchase/dev': async ({ acc, body }) => shop.devPurchase(acc, str(body.productId)),
    'POST /v1/recover/apple': async ({ body, ip }) => {
      if (!regLimit.take(`rec:${ipKey(ip)}`)) throw new ShopError(429, 'rate_limited')
      return shop.recover(body.jws, ip)
    },
    'POST /v1/recover/google': async ({ body, ip }) => {
      if (!regLimit.take(`rec:${ipKey(ip)}`)) throw new ShopError(429, 'rate_limited')
      return shop.recoverGoogle({ productId: body.productId, purchaseToken: body.purchaseToken }, ip)
    },
    'POST /v1/recover/code': async ({ body, ip }) => {
      const bucket = codeBucket(body.code)
      if (!codeLimit.take(ipKey(ip)) || (bucket && !codeBucketLimit.take(bucket)) || !regGlobal.take('code')) throw new ShopError(429, 'rate_limited')
      return shop.recoverCode(body.code, ip)
    },
    'POST /v1/account/recovery-code': async ({ acc, ip }) => shop.recoveryCode(acc, ip),
    'GET /v1/account/export': async ({ acc }) => shop.exportAccount(acc),
    'DELETE /v1/account': async ({ acc, ip }) => shop.deleteAccount(acc, ip),
    'POST /v1/spend': async ({ acc, body }) => shop.spend(acc, { item: str(body.item), idem: body.idem, discount: body.discount === true, career: body.career }),
    'POST /v1/inbox/ack': async ({ acc, body }) => shop.ack(acc, body.nonces),
    'POST /v1/inbox/void': async ({ acc, body }) => shop.voidGrant(acc, body.nonce),
    'POST /v1/ads/start': async ({ acc, body, ip }) => shop.adStart(acc, str(body.offer), body.ref, ip),
    'POST /v1/ads/complete': async ({ acc, body, ip }) => shop.adComplete(acc, body.nonce, body.career, ip),
    'POST /v1/ads/abort': async ({ acc, body }) => shop.adAbort(acc, body.nonce),
    'POST /v1/earn': async ({ acc, body, ip }) => {
      if (typeof body.source !== 'string' || typeof body.ref !== 'string') throw new ShopError(400, 'bad_request')
      return shop.earn(acc, { source: body.source, ref: body.ref }, ip)
    },
    'POST /v1/pass/claim': async ({ acc }) => shop.passClaim(acc),
    // Operator details (row counts, disk) only with the OPS_TOKEN in X-Ops-Token.
    'GET /v1/health': async ({ headers }) => shop.health({ ops: !!opsToken && sameSecret(String(headers['x-ops-token'] ?? ''), opsToken) }),
  }
  const open = new Set(['POST /v1/register', 'POST /v1/recover/apple', 'POST /v1/recover/google', 'POST /v1/recover/code', 'GET /v1/health'])

  return createServer(async (req, res) => {
    const ip = (trustProxy && String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim()) || req.socket.remoteAddress || '?'
    const origin = req.headers.origin
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Strict-Transport-Security': 'max-age=31536000',
    }
    if (origin && origins.includes(origin)) {
      headers['Access-Control-Allow-Origin'] = origin
      headers['Vary'] = 'Origin'
      headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type'
      headers['Access-Control-Allow-Methods'] = 'GET, POST, DELETE'
      headers['Access-Control-Max-Age'] = '600'
    }
    const send = (status, obj) => {
      if (status === 413) {
        headers.Connection = 'close'
        res.on('finish', () => req.destroy())
      }
      res.writeHead(status, headers)
      res.end(JSON.stringify(obj))
    }
    let key = '?'
    try {
      const url = new URL(req.url ?? '/', 'http://x')
      if (req.method === 'OPTIONS') { res.writeHead(204, headers); res.end(); return }

      // Google AdMob SSV callback: signed GET from Google, no app auth.
      if (req.method === 'GET' && url.pathname === '/v1/admob/ssv') {
        if (!cbLimit.take(ipKey(ip))) throw new ShopError(429, 'rate_limited')
        const raw = (req.url ?? '').split('?')[1] ?? ''
        const fields = admob ? await admob.verify(raw) : null
        if (!fields) throw new ShopError(400, 'bad_signature')
        shop.adSsv(fields)
        send(200, { ok: true })
        return
      }
      // App Store Server Notifications v2 (signed by Apple).
      if (req.method === 'POST' && url.pathname === '/v1/apple/notifications') {
        if (!cbLimit.take(ipKey(ip))) throw new ShopError(429, 'rate_limited')
        const body = safeJson((await readBody(req, MAX_NOTIFICATION)) || '{}')
        send(200, shop.appleNotification(body.signedPayload))
        return
      }
      // Google Play RTDN (Pub/Sub push): secret in the X-RTDN-Token header (preferred) or ?token=
      // (Pub/Sub push cannot set headers; Caddy drops query strings from its access log).
      // Body {message: {data: base64 JSON}}.
      if (req.method === 'POST' && url.pathname === '/v1/google/rtdn') {
        if (!cbLimit.take(ipKey(ip))) throw new ShopError(429, 'rate_limited')
        if (!rtdnToken) throw new ShopError(404, 'not_found')
        const given = String(req.headers['x-rtdn-token'] ?? '') || url.searchParams.get('token') || ''
        if (!sameSecret(given, rtdnToken)) throw new ShopError(403, 'forbidden')
        const body = safeJson((await readBody(req)) || '{}')
        const data = typeof body.message?.data === 'string' ? body.message.data : ''
        if (!data) throw new ShopError(400, 'bad_request')
        send(200, await shop.googleRtdn(safeJson(Buffer.from(data, 'base64').toString('utf8'))))
        return
      }

      if (!ipLimit.take(ipKey(ip))) throw new ShopError(429, 'rate_limited')
      key = `${req.method} ${url.pathname}`
      const handler = routes[key]
      if (!handler) throw new ShopError(404, 'not_found')
      if (req.method === 'POST' && !String(req.headers['content-type'] ?? '').startsWith('application/json')) throw new ShopError(415, 'json_only')
      const raw = req.method === 'POST' ? await readBody(req) : ''
      let body = {}
      if (raw) {
        try { body = JSON.parse(raw) } catch { throw new ShopError(400, 'bad_json') }
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ShopError(400, 'bad_json')
      }
      let acc = null
      if (!open.has(key)) {
        acc = shop.auth(req.headers.authorization)
        if (!accLimit.take(acc.id)) throw new ShopError(429, 'rate_limited')
      }
      const out = await handler({ body, acc, ip, headers: req.headers })
      send(key === 'GET /v1/health' && !out.ok ? 503 : 200, out)
    } catch (e) {
      if (e instanceof ShopError) {
        if (e.status === 401) {
          // One line per failed sign-in, for fail2ban (filter: "auth_fail ip=<HOST>"), with the
          // claimed account id prefix; too many failures for one prefix answer 429 for a while.
          const acct = (/^Bearer ([0-9a-f]{8})/.exec(String(req.headers.authorization ?? '')) ?? [])[1] ?? '-'
          log('auth_fail', `ip=${ip}`, `acct=${acct}`, key)
          if (acct !== '-' && !authFailAcc.take(acct)) {
            log('auth_flood', `acct=${acct}`)
            send(429, { error: 'rate_limited' })
            return
          }
        }
        send(e.status, { error: e.code })
      } else {
        log('error', e)
        send(500, { error: 'server_error' })
      }
    }
  })
}
