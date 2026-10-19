// HTTP layer: tiny router, strict JSON parsing, size limits, per-IP and per-account rate limits,
// CORS limited to the app's own origins, no stack traces to clients.
import { createServer } from 'node:http'
import { createHash, timingSafeEqual } from 'node:crypto'
import { ShopError } from './shop.mjs'
import { safeJson } from './google.mjs'

const MAX_BODY = 16 * 1024
/** App Store Server Notifications nest signed JWS inside a signed JWS (three x5c chains). */
const MAX_NOTIFICATION = 128 * 1024

/** Rate-limit key for an address: IPv4 as is, IPv6 by its /64 (one subscriber's whole prefix). */
export function ipKey(ip) {
  ip = String(ip ?? '?').split('%')[0]
  if (!ip.includes(':')) return ip
  const v4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip)
  if (v4) return v4[1]
  let groups
  if (ip.includes('::')) {
    const [head, tail] = ip.split('::')
    const h = head ? head.split(':') : []
    const t = tail ? tail.split(':') : []
    groups = [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t]
  } else groups = ip.split(':')
  return `${groups.slice(0, 4).map((g) => (parseInt(g, 16) || 0).toString(16)).join(':')}::/64`
}

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

export function createApp({ shop, admob, origins, trustProxy = true, log = () => {}, limits = {}, rtdnToken = '' }) {
  // Per-IP limits stay generous: mobile carriers put many players behind one address (CGNAT).
  const ipLimit = new RateLimiter(limits.ipPerMin ?? 600, limits.ipBurst ?? 200)
  const regLimit = new RateLimiter(limits.regPerMin ?? 30, limits.regBurst ?? 30)
  // All registrations together (a botnet across many addresses).
  const regGlobal = new RateLimiter(limits.regGlobalPerMin ?? 600, limits.regGlobalPerMin ?? 600)
  const codeLimit = new RateLimiter(limits.codePerMin ?? 5, limits.codePerMin ?? 5)
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
      if (!codeLimit.take(ipKey(ip)) || !regGlobal.take('code')) throw new ShopError(429, 'rate_limited')
      return shop.recoverCode(body.code, ip)
    },
    'POST /v1/account/recovery-code': async ({ acc, ip }) => shop.recoveryCode(acc, ip),
    'GET /v1/account/export': async ({ acc }) => shop.exportAccount(acc),
    'DELETE /v1/account': async ({ acc, ip }) => shop.deleteAccount(acc, ip),
    'POST /v1/spend': async ({ acc, body }) => shop.spend(acc, { item: str(body.item), idem: body.idem, discount: body.discount === true, career: body.career }),
    'POST /v1/inbox/ack': async ({ acc, body }) => shop.ack(acc, body.nonces),
    'POST /v1/ads/start': async ({ acc, body }) => shop.adStart(acc, str(body.offer), body.ref),
    'POST /v1/ads/complete': async ({ acc, body }) => shop.adComplete(acc, body.nonce, body.career),
    'POST /v1/earn': async ({ acc, body }) => {
      if (typeof body.source !== 'string' || typeof body.ref !== 'string') throw new ShopError(400, 'bad_request')
      return shop.earn(acc, { source: body.source, ref: body.ref })
    },
    'POST /v1/pass/claim': async ({ acc }) => shop.passClaim(acc),
    'GET /v1/health': async () => shop.health(),
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
      // Google Play RTDN (Pub/Sub push): ?token=<RTDN_TOKEN>, body {message: {data: base64 JSON}}.
      if (req.method === 'POST' && url.pathname === '/v1/google/rtdn') {
        if (!cbLimit.take(ipKey(ip))) throw new ShopError(429, 'rate_limited')
        if (!rtdnToken) throw new ShopError(404, 'not_found')
        if (!sameSecret(url.searchParams.get('token') ?? '', rtdnToken)) throw new ShopError(403, 'forbidden')
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
      send(200, await handler({ body, acc, ip }))
    } catch (e) {
      if (e instanceof ShopError) {
        // One line per failed sign-in, for fail2ban (filter: "auth_fail ip=<HOST>").
        if (e.status === 401) log('auth_fail', `ip=${ip}`, key)
        send(e.status, { error: e.code })
      } else {
        log('error', e)
        send(500, { error: 'server_error' })
      }
    }
  })
}
