// HTTP layer: tiny router, strict JSON parsing, size limits, per-IP and per-account rate limits,
// CORS limited to the app's own origins, no stack traces to clients.
import { createServer } from 'node:http'
import { ShopError } from './shop.mjs'

const MAX_BODY = 16 * 1024

/** Token bucket per key. */
export class RateLimiter {
  constructor(perMinute, burst = perMinute) {
    this.rate = perMinute / 60_000
    this.burst = burst
    this.b = new Map()
  }
  take(key, now = Date.now()) {
    let s = this.b.get(key)
    if (!s) { s = { t: this.burst, at: now }; this.b.set(key, s) }
    s.t = Math.min(this.burst, s.t + (now - s.at) * this.rate)
    s.at = now
    if (this.b.size > 50_000) this.b.clear()
    if (s.t < 1) return false
    s.t -= 1
    return true
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > MAX_BODY) {
        // Stop buffering; the 413 is sent and the connection closed after it.
        if (chunks.length) chunks.length = 0
        reject(new ShopError(413, 'too_large'))
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

export function createApp({ shop, admob, origins, trustProxy = true, log = () => {}, limits = {} }) {
  // Per-IP limits stay generous: mobile carriers put many players behind one address (CGNAT).
  const ipLimit = new RateLimiter(limits.ipPerMin ?? 600, limits.ipBurst ?? 200)
  const regLimit = new RateLimiter(limits.regPerMin ?? 30, limits.regBurst ?? 30)
  const accLimit = new RateLimiter(90, 40)

  const routes = {
    'POST /v1/register': async ({ body, ip }) => {
      if (!regLimit.take(ip)) throw new ShopError(429, 'rate_limited')
      return shop.register(ip, body.platform)
    },
    'GET /v1/wallet': async ({ acc }) => shop.wallet(acc),
    'POST /v1/purchase/apple': async ({ acc, body }) => shop.applePurchase(acc, body.jws),
    'POST /v1/purchase/google': async ({ acc, body }) => shop.googlePurchase(acc, body),
    'POST /v1/purchase/dev': async ({ acc, body }) => shop.devPurchase(acc, String(body.productId ?? '')),
    'POST /v1/recover/apple': async ({ body, ip }) => {
      if (!regLimit.take(`rec:${ip}`)) throw new ShopError(429, 'rate_limited')
      return shop.recover(body.jws, ip)
    },
    'POST /v1/spend': async ({ acc, body }) => shop.spend(acc, { item: String(body.item ?? ''), idem: body.idem, discount: body.discount === true }),
    'POST /v1/inbox/ack': async ({ acc, body }) => shop.ack(acc, body.nonces),
    'POST /v1/ads/start': async ({ acc, body }) => shop.adStart(acc, String(body.offer ?? '')),
    'POST /v1/ads/complete': async ({ acc, body }) => shop.adComplete(acc, body.nonce),
    'POST /v1/earn': async ({ acc, body }) => shop.earn(acc, { source: String(body.source ?? ''), ref: body.ref }),
    'POST /v1/pass/claim': async ({ acc }) => shop.passClaim(acc),
    'GET /v1/health': async () => ({ ok: true }),
  }
  const open = new Set(['POST /v1/register', 'POST /v1/recover/apple', 'GET /v1/health'])

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
      headers['Access-Control-Allow-Methods'] = 'GET, POST'
      headers['Access-Control-Max-Age'] = '600'
    }
    const send = (status, obj) => {
      if (status === 413) headers.Connection = 'close'
      res.writeHead(status, headers)
      res.end(JSON.stringify(obj))
    }
    try {
      const url = new URL(req.url ?? '/', 'http://x')
      if (req.method === 'OPTIONS') { res.writeHead(204, headers); res.end(); return }
      if (!ipLimit.take(ip)) throw new ShopError(429, 'rate_limited')

      // Google AdMob SSV callback: signed GET from Google, no app auth.
      if (req.method === 'GET' && url.pathname === '/v1/admob/ssv') {
        const raw = (req.url ?? '').split('?')[1] ?? ''
        const fields = admob ? await admob.verify(raw) : null
        if (!fields) throw new ShopError(400, 'bad_signature')
        shop.adSsv(fields)
        send(200, { ok: true })
        return
      }
      // App Store Server Notifications v2 (signed by Apple).
      if (req.method === 'POST' && url.pathname === '/v1/apple/notifications') {
        const body = JSON.parse((await readBody(req)) || '{}')
        send(200, shop.appleNotification(body.signedPayload))
        return
      }

      const key = `${req.method} ${url.pathname}`
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
      if (e instanceof ShopError) send(e.status, { error: e.code })
      else {
        log('error', e)
        send(500, { error: 'server_error' })
      }
    }
  })
}
