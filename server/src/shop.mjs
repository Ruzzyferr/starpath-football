// Shop rules, independent of HTTP. The server is the only place diamonds are created or spent:
// the app shows a cached balance, but every credit needs a verified store receipt, a capped ad
// reward or a capped free-diamond claim, and every spend is checked here against server prices.
import { createHash, createHmac, randomBytes, randomInt, randomUUID, sign, timingSafeEqual } from 'node:crypto'
import { statfsSync } from 'node:fs'
import { tx } from './db.mjs'
import { JwsError, verifyAppleJws } from './apple.mjs'
import { ipKey } from './net.mjs'

export class ShopError extends Error {
  constructor(status, code, msg) {
    super(msg ?? code)
    this.status = status
    this.code = code
  }
}

const sha256 = (s) => createHash('sha256').update(s).digest('hex')
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const ID = /^[a-z0-9_]{1,40}$/
const REF = /^[A-Za-z0-9:_.-]{1,80}$/
const CAREER = /^[A-Za-z0-9:_.-]{1,64}$/
const DAY = 86400_000
/** Readable recovery-code alphabet (no I, O, 0, 1): 16 symbols = 80 bits. */
const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ2-9]{16}$/
export const SANDBOX_POLICIES = ['off', 'testers', 'capped', 'on']

/** Catalog lookup that ignores inherited keys ('constructor', '__proto__') and non-strings. */
const own = (obj, k) => (typeof k === 'string' && Object.hasOwn(obj, k) ? obj[k] : undefined)
/** Optional client label (career id, fixture ref): absent, or a short safe string. */
function optLabel(v, re) {
  if (v === undefined || v === null) return undefined
  if (typeof v !== 'string' || !re.test(v)) throw new ShopError(400, 'bad_request')
  return v
}
const notProduction = (env) => env !== 'Production'
/** Normalised recovery code, or '' when it cannot be one. */
const normCode = (code) => (typeof code === 'string' && code.length < 64 ? code.toUpperCase().replace(/[\s-]/g, '') : '')
/** Rate-limit bucket for a recovery-code attempt: a short prefix of the code's hash (or null). */
export function codeBucket(code) {
  const n = normCode(code)
  return CODE_RE.test(n) ? sha256(n).slice(0, 2) : null
}
const YEAR = 365 * DAY
/** Tables whose sizes /v1/health reports to the operator (OPS_TOKEN). */
const OPS_TABLES = ['accounts', 'account_tokens', 'txns', 'tombstones', 'ledger', 'grants', 'daily', 'counters', 'ads', 'earn_refs', 'idem', 'audit', 'ip_daily']

export class Shop {
  /**
   * @param {object} o
   * @param {import('node:sqlite').DatabaseSync} o.db
   * @param {object} o.catalog catalog.json
   * @param {import('node:crypto').KeyObject} o.signKey Ed25519 private key for grants
   * @param {{ bundleId: string, allowSandbox?: boolean, rootFingerprint?: string, skipOids?: boolean }} o.apple
   * @param {{ policy: 'off'|'testers'|'capped'|'on', testers?: string[], cap?: number }} [o.sandbox]
   *   Store test purchases (Apple Sandbox/Xcode, Google licence testers). Default: 'on' if
   *   apple.allowSandbox, else 'off'. 'capped' records them with env Sandbox and caps them per account.
   * @param {import('./google.mjs').GooglePlay} [o.google]
   * @param {{ requireSsv: boolean }} [o.ads]
   * @param {boolean} [o.devPurchases] test-only purchases without a store (never in production)
   * @param {string|Buffer} [o.ipSalt] secret for hashing old audit IPs
   * @param {string} [o.dataDir] directory of the database (health: free disk space)
   * @param {(...a: any[]) => void} [o.log]
   * @param {() => number} [o.now]
   */
  constructor(o) {
    this.db = o.db
    this.dataDir = o.dataDir ?? null
    this.cat = o.catalog
    this.signKey = o.signKey
    this.apple = o.apple
    this.google = o.google
    this.requireSsv = !!o.ads?.requireSsv
    this.devPurchases = !!o.devPurchases
    this.now = o.now ?? (() => Date.now())
    this.log = o.log ?? (() => {})
    this.ipSalt = o.ipSalt ?? randomBytes(32)
    const policy = o.sandbox?.policy ?? (o.apple?.allowSandbox ? 'on' : 'off')
    if (!SANDBOX_POLICIES.includes(policy)) throw new Error(`bad sandbox policy ${policy}`)
    this.sandbox = {
      policy,
      testers: new Set((o.sandbox?.testers ?? []).map((s) => s.trim().toLowerCase()).filter(Boolean)),
      cap: o.sandbox?.cap ?? this.cat.limits.sandboxGemsCap ?? 3000,
      txnCap: this.cat.limits.sandboxTxnCap ?? 30,
      // All accounts together, per UTC day (TestFlight receipts are free to make).
      globalDaily: o.sandbox?.globalDaily ?? this.cat.limits.sandboxGlobalDaily ?? 200,
    }
    this.passProducts = Object.entries(this.cat.products).filter(([, p]) => p.kind === 'pass').map(([k]) => k)
  }

  day(t = this.now()) {
    return new Date(t).toISOString().slice(0, 10)
  }

  audit(account, ip, event, detail) {
    this.db.prepare('INSERT INTO audit (at, account, ip, event, detail) VALUES (?, ?, ?, ?, ?)').run(this.now(), account ?? null, ip ?? null, event, detail ? JSON.stringify(detail).slice(0, 500) : null)
  }

  /** What the server can take right now (the app hides a store that is not ready). */
  stores() {
    return { apple: true, google: !!this.google?.configured }
  }

  /** Free space on the data directory's file system, or null when unknown. */
  disk() {
    if (!this.dataDir) return null
    try {
      const s = statfsSync(this.dataDir)
      const total = s.blocks * s.bsize
      const free = s.bavail * s.bsize
      return { freeBytes: free, totalBytes: total, freePct: total ? Math.round((free / total) * 1000) / 10 : 0 }
    } catch {
      return null
    }
  }

  /**
   * Liveness: the database answers and the disk is not (nearly) full. `ops` (row counts, disk,
   * database size) only for the operator (a valid OPS_TOKEN, checked by the HTTP layer).
   */
  health({ ops = false } = {}) {
    let dbOk = false
    try {
      dbOk = this.db.prepare('SELECT 1 AS one').get()?.one === 1
    } catch {
      dbOk = false
    }
    const disk = this.disk()
    const diskOk = !disk || (disk.freePct >= 5 && disk.freeBytes >= 100 * 1024 * 1024)
    const out = { ok: dbOk && diskOk, ...this.stores(), sandbox: this.sandbox.policy }
    if (ops) {
      const rows = {}
      if (dbOk) for (const t of OPS_TABLES) rows[t] = this.db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n
      let dbBytes = null
      try {
        dbBytes = this.db.prepare('SELECT page_count * page_size AS n FROM pragma_page_count(), pragma_page_size()').get().n
      } catch {}
      out.ops = { db: dbOk, disk, dbBytes, rows, sandboxToday: dbOk ? this.sandboxToday() : null }
    }
    return out
  }

  // ───────── Accounts and device tokens ─────────

  register(ip, platform) {
    const id = randomUUID()
    const token = tx(this.db, () => {
      this.db.prepare("INSERT INTO accounts (id, secret_hash, created, platform) VALUES (?, '', ?, ?)").run(id, this.now(), ['ios', 'android', 'web'].includes(platform) ? platform : null)
      return this.issueToken(id)
    })
    this.audit(id, ip, 'register')
    return { accountId: id, token }
  }

  /** A new device token; the account keeps its newest `limits.maxDevices` tokens. */
  issueToken(id) {
    const secret = randomBytes(32).toString('base64url')
    this.db.prepare('INSERT INTO account_tokens (hash, account, created) VALUES (?, ?, ?)').run(sha256(secret), id, this.now())
    this.db.prepare('DELETE FROM account_tokens WHERE account = ? AND rowid NOT IN (SELECT rowid FROM account_tokens WHERE account = ? ORDER BY created DESC, rowid DESC LIMIT ?)').run(id, id, this.cat.limits.maxDevices ?? 5)
    return `${id}.${secret}`
  }

  /** Bearer `<accountId>.<secret>` → account row. Every stored token is compared in constant time. */
  auth(header) {
    const m = /^Bearer ([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/.exec(header ?? '')
    if (!m || !UUID.test(m[1])) throw new ShopError(401, 'unauthorized')
    const hashes = this.db.prepare('SELECT hash FROM account_tokens WHERE account = ?').all(m[1]).map((r) => r.hash)
    const got = Buffer.from(sha256(m[2]), 'hex')
    let ok = false
    for (const h of hashes.length ? hashes : [sha256('x')]) ok = timingSafeEqual(Buffer.from(h, 'hex'), got) || ok
    const acc = ok && hashes.length ? this.account(m[1]) : null
    if (!acc || acc.deleted) throw new ShopError(401, 'unauthorized')
    if (acc.banned) throw new ShopError(403, 'banned')
    // Activity mark for the retention job, written at most every 6 hours.
    const now = this.now()
    if (!(acc.seen > now - 6 * 3600_000)) this.db.prepare('UPDATE accounts SET seen = ? WHERE id = ?').run(now, acc.id)
    return acc
  }

  /** Accounts younger than `limits.newAccountMs` get half the free-diamond caps (fresh-account farming). */
  isNew(acc) {
    return this.now() - (acc.created ?? 0) < (this.cat.limits.newAccountMs ?? DAY)
  }

  /** A daily cap, halved (rounded up) for a new account. */
  ramp(acc, n) {
    return this.isNew(acc) ? Math.ceil(n / 2) : n
  }

  /** Daily cap of an ad offer for this account (diamond-paying offers ramp with account age). */
  adCap(acc, offer) {
    const def = this.cat.ads[offer]
    return def.reward.gems ? this.ramp(acc, def.perDay) : def.perDay
  }

  /** Refunds pile up or the balance is negative: no spending and no ad rewards (purchases stay open). */
  refundHold(accountId) {
    const a = this.account(accountId)
    return a.gems < 0 || this.counter(accountId, 'refunds') >= (this.cat.limits.refundHoldAfter ?? 3)
  }

  checkHold(accountId) {
    if (this.refundHold(accountId)) throw new ShopError(403, 'refund_hold')
  }

  // ───────── Per-address free-diamond ceiling (across accounts) ─────────

  ipBucket(ip) {
    return ip ? this.hashIp(ipKey(ip)) : null
  }

  ipCount(bucket) {
    return bucket ? this.db.prepare('SELECT n FROM ip_daily WHERE key = ? AND day = ?').get(bucket, this.day())?.n ?? 0 : 0
  }

  ipBump(bucket, by) {
    if (bucket && by > 0) this.db.prepare('INSERT INTO ip_daily (key, day, n) VALUES (?, ?, ?) ON CONFLICT(key, day) DO UPDATE SET n = n + excluded.n').run(bucket, this.day(), by)
  }

  get ipCap() {
    return this.cat.limits.ipEarnPerDay ?? 600
  }

  account(id) {
    return this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(id)
  }

  /** A live account by id (for recovery and store callbacks), or null. */
  liveAccount(id) {
    id = String(id ?? '').toLowerCase()
    const acc = UUID.test(id) ? this.account(id) : null
    return acc && !acc.deleted && !acc.banned ? acc : null
  }

  // ───────── Ledger and counters ─────────

  /** Adds (or removes) diamonds inside the caller's transaction. Spends never go below zero. */
  moveGems(accountId, delta, why, ref) {
    const acc = this.account(accountId)
    const balance = acc.gems + delta
    if (delta < 0 && balance < 0 && why !== 'refund') throw new ShopError(402, 'insufficient_gems')
    this.db.prepare('UPDATE accounts SET gems = ? WHERE id = ?').run(balance, accountId)
    this.db.prepare('INSERT INTO ledger (account, delta, balance, why, ref, at) VALUES (?, ?, ?, ?, ?, ?)').run(accountId, delta, balance, why, ref ?? null, this.now())
    return balance
  }

  /** Per-UTC-day counter (caps only). */
  bump(accountId, key, by = 1) {
    this.db.prepare('INSERT INTO daily (account, day, key, n) VALUES (?, ?, ?, ?) ON CONFLICT(account, day, key) DO UPDATE SET n = n + excluded.n').run(accountId, this.day(), key, by)
  }

  count(accountId, key) {
    return this.db.prepare('SELECT n FROM daily WHERE account = ? AND day = ? AND key = ?').get(accountId, this.day(), key)?.n ?? 0
  }

  /** Durable per-account counter (does not reset at midnight). */
  addCounter(accountId, key, by = 1) {
    this.db.prepare('INSERT INTO counters (account, key, n) VALUES (?, ?, ?) ON CONFLICT(account, key) DO UPDATE SET n = n + excluded.n').run(accountId, key, by)
  }

  setCounter(accountId, key, n) {
    this.db.prepare('INSERT INTO counters (account, key, n) VALUES (?, ?, ?) ON CONFLICT(account, key) DO UPDATE SET n = excluded.n').run(accountId, key, n)
  }

  counter(accountId, key) {
    return this.db.prepare('SELECT n FROM counters WHERE account = ? AND key = ?').get(accountId, key)?.n ?? 0
  }

  // ───────── Grants (signed coupons the app applies to the career) ─────────

  /** Payload fields {v, n, a, t, k, ...}; token = base64url(payload) '.' Ed25519(base64url string). */
  /** `price`: diamonds paid for it (spend grants only), which makes the grant voidable. */
  grant(accountId, payload, ref, price = null) {
    const nonce = randomBytes(16).toString('base64url')
    const body = { v: 1, n: nonce, a: accountId, t: this.now(), ...payload }
    const b = Buffer.from(JSON.stringify(body)).toString('base64url')
    const token = `${b}.${sign(null, Buffer.from(b), this.signKey).toString('base64url')}`
    this.db.prepare('INSERT INTO grants (nonce, account, payload, token, at, ref, price) VALUES (?, ?, ?, ?, ?, ?, ?)').run(nonce, accountId, JSON.stringify(body), token, this.now(), ref ?? null, price)
    return { nonce, token, ...payload }
  }

  ack(acc, nonces) {
    if (!Array.isArray(nonces) || nonces.length > 50) throw new ShopError(400, 'bad_request')
    const st = this.db.prepare('UPDATE grants SET acked = 1 WHERE nonce = ? AND account = ? AND acked = 0')
    tx(this.db, () => { for (const n of nonces) if (typeof n === 'string' && n.length < 40) st.run(n, acc.id) })
    return this.wallet(this.account(acc.id))
  }

  /**
   * The app cannot apply an unacked spend grant (the career it was bought for no longer exists):
   * the diamonds paid come back once and the grant leaves the inbox. Purchase and ad grants are not
   * voidable. A retry of the same void answers again with voided:true.
   */
  voidGrant(acc, nonce) {
    if (typeof nonce !== 'string' || !nonce || nonce.length >= 40) throw new ShopError(400, 'bad_request')
    return tx(this.db, () => {
      const g = this.db.prepare('SELECT * FROM grants WHERE nonce = ? AND account = ?').get(nonce, acc.id)
      if (!g) throw new ShopError(404, 'no_grant')
      if (g.acked === 3) return { ...this.wallet(this.account(acc.id)), voided: true, refunded: 0, replay: true }
      if (g.price == null) throw new ShopError(400, 'not_voidable')
      if (g.acked !== 0) throw new ShopError(409, 'already_acked')
      this.db.prepare('UPDATE grants SET acked = 3 WHERE nonce = ?').run(nonce)
      const body = JSON.parse(g.payload)
      if (g.price > 0) this.moveGems(acc.id, g.price, `void:${body.src ?? body.k}`, `void:${nonce}`)
      // A cosmetic is an account entitlement: it goes with the refund.
      if (body.k === 'cosmetic' && body.id) this.db.prepare('DELETE FROM entitlements WHERE account = ? AND product = ?').run(acc.id, body.id)
      this.audit(acc.id, null, 'grant_void', { nonce, src: body.src, price: g.price })
      return { ...this.wallet(this.account(acc.id)), voided: true, refunded: g.price }
    })
  }

  // ───────── Wallet view ─────────

  wallet(accIn) {
    const acc = this.account(accIn.id)
    const now = this.now()
    const passActive = acc.pass_until > now
    // The Pro entitlement lapses with the pass (also when no EXPIRED notification ever arrives).
    const ents = this.db.prepare('SELECT product FROM entitlements WHERE account = ?').all(acc.id).map((r) => r.product).filter((p) => p !== 'pro_contract' || passActive)
    const inbox = this.db.prepare('SELECT nonce, token, payload FROM grants WHERE account = ? AND acked = 0 ORDER BY at').all(acc.id)
      .map((g) => ({ nonce: g.nonce, token: g.token, ...JSON.parse(g.payload) }))
    const ads = Object.fromEntries(Object.keys(this.cat.ads).map((k) => [k, { used: this.count(acc.id, `ad:${k}`), max: this.adCap(acc, k) }]))
    const g2c = this.cat.spend.gems_to_cash
    return {
      accountId: acc.id,
      gems: acc.gems,
      starter: !!acc.starter,
      pass: { active: passActive, until: acc.pass_until, claimable: passActive && acc.pass_claim_day !== this.day() },
      entitlements: ents,
      inbox,
      ads,
      physioDiscounts: this.counter(acc.id, 'disc:physio'),
      seasonX2Ready: this.counter(acc.id, 'season:ready') > 0 && ads.season_x2.used < ads.season_x2.max,
      earnedToday: this.count(acc.id, 'earn:total'),
      limits: {
        gemsToCashLeft: g2c?.perDay ? Math.max(0, g2c.perDay - this.count(acc.id, 'spend:gems_to_cash')) : 0,
        // Bought cash per career season; the app enforces it (the career runs on the device).
        cashPerSeason: this.cat.limits.cashPerSeason ?? 0,
      },
      refundHold: this.refundHold(acc.id),
      stores: this.stores(),
      prices: Object.fromEntries(Object.entries(this.cat.spend).map(([k, v]) => [k, v.price])),
    }
  }

  // ───────── Store test purchases (sandbox policy) ─────────

  /** May this account have a non-production (sandbox / test) receipt honoured? */
  sandboxAllowed(accountId) {
    const p = this.sandbox.policy
    return p === 'on' || p === 'capped' || (p === 'testers' && this.sandbox.testers.has(accountId))
  }

  /** Account recovery from a sandbox receipt: only where sandbox is fully open, or for listed testers. */
  sandboxRecoverAllowed(accountId) {
    const p = this.sandbox.policy
    return p === 'on' || (p === 'testers' && this.sandbox.testers.has(accountId))
  }

  /** Sandbox (non-production) store transactions recorded since the start of today (UTC). */
  sandboxToday() {
    const start = Date.parse(`${this.day()}T00:00:00Z`)
    return this.db.prepare("SELECT COUNT(*) AS n FROM txns WHERE store != 'dev' AND env IS NOT NULL AND env != 'Production' AND at >= ?").get(start).n
  }

  /**
   * Inside credit(): refuse, or ('capped') count against the per-account lifetime caps — every
   * product kind (diamonds, cash, pass, cosmetics) counts as a transaction, diamonds also by
   * amount — and against a global daily budget across all accounts.
   */
  sandboxGate(accountId, p) {
    if (!this.sandboxAllowed(accountId)) throw new ShopError(400, 'sandbox_receipt')
    if (this.sandbox.policy !== 'capped') return
    const gems = p.kind === 'gems' || p.kind === 'starter' ? p.gems : 0
    if (this.counter(accountId, 'sandbox:gems') + gems > this.sandbox.cap || this.counter(accountId, 'sandbox:txns') >= this.sandbox.txnCap) throw new ShopError(403, 'sandbox_cap')
    if (this.sandboxToday() >= this.sandbox.globalDaily) {
      this.log('sandbox_global_cap', this.sandbox.globalDaily) // (an audit row would roll back with the refusal)
      throw new ShopError(403, 'sandbox_cap')
    }
    this.addCounter(accountId, 'sandbox:gems', gems)
    this.addCounter(accountId, 'sandbox:txns')
  }

  // ───────── Purchases ─────────

  /**
   * Refunded / revoked before or after we saw it: tombstone (txn or original id) or a revoked row.
   * Callers pass `originalId` only for one-time products: a subscription's periods share their
   * original id, and a refund of one period must not block the others.
   */
  isRevoked(store, txnId, originalId) {
    const keys = [`t:${txnId}`, originalId ? `o:${originalId}` : `t:${txnId}`]
    if (this.db.prepare('SELECT 1 FROM tombstones WHERE store = ? AND key IN (?, ?)').get(store, ...keys)) return true
    return !!this.db.prepare('SELECT 1 FROM txns WHERE store = ? AND txn_id = ? AND revoked = 1').get(store, txnId)
  }

  /** Credits one verified store transaction exactly once. */
  credit(acc, { store, txnId, originalId, productId, env, expires }) {
    const p = own(this.cat.products, productId)
    if (!p) throw new ShopError(400, 'unknown_product')
    return tx(this.db, () => {
      const seen = this.db.prepare('SELECT * FROM txns WHERE store = ? AND txn_id = ?').get(store, txnId)
      if (seen) {
        if (seen.account !== acc.id) {
          this.audit(acc.id, null, 'receipt_reuse', { store, txnId, owner: seen.account })
          throw new ShopError(409, 'receipt_used')
        }
        if (seen.revoked) throw new ShopError(410, 'revoked')
        // Same transaction again (retry / restore; a Play subscription keeps one token across
        // renewals): refresh a subscription's expiry, never credit twice.
        if (p.kind === 'pass' && expires) {
          this.db.prepare('UPDATE txns SET expires = MAX(COALESCE(expires, 0), ?) WHERE store = ? AND txn_id = ?').run(expires, store, txnId)
          this.db.prepare('UPDATE accounts SET pass_until = MAX(pass_until, ?) WHERE id = ?').run(expires, acc.id)
        }
        return { credited: false }
      }
      // A refund notice that arrived before the purchase was redeemed.
      if (this.isRevoked(store, txnId, p.kind === 'pass' ? null : originalId)) throw new ShopError(410, 'revoked')
      if (store !== 'dev' && notProduction(env)) this.sandboxGate(acc.id, p)
      const until = p.kind === 'pass' ? (expires ?? this.now() + 31 * DAY) : null
      this.db.prepare('INSERT INTO txns (store, txn_id, original_id, account, product, env, at, expires) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(store, txnId, originalId ?? null, acc.id, productId, env ?? null, this.now(), until)
      const ref = `${store}:${txnId}`
      let out = { credited: true }
      if (p.kind === 'gems') this.moveGems(acc.id, p.gems, `buy:${productId}`, ref)
      else if (p.kind === 'cash') this.grant(acc.id, { k: 'cash', weeks: p.cashWeeks, floor: p.cashFloor, cap: p.cashCap, src: productId }, ref)
      else if (p.kind === 'starter') {
        const fresh = this.db.prepare('UPDATE accounts SET starter = 1 WHERE id = ? AND starter = 0').run(acc.id).changes === 1
        if (fresh) {
          this.moveGems(acc.id, p.gems, 'buy:starter_pack', ref)
          this.grant(acc.id, { k: 'gear', id: p.gear, src: productId }, ref)
        } else {
          // Once per account: a second Starter Pack credits nothing (the store refund is the remedy).
          this.audit(acc.id, null, 'starter_repeat', { store, txnId })
          out = { credited: false, reason: 'already_owned' }
        }
      } else if (p.kind === 'pass') {
        this.db.prepare('UPDATE accounts SET pass_until = MAX(pass_until, ?) WHERE id = ?').run(until, acc.id)
      }
      if (!p.consumable) this.db.prepare('INSERT OR IGNORE INTO entitlements (account, product, at) VALUES (?, ?, ?)').run(acc.id, productId, this.now())
      this.audit(acc.id, null, 'purchase', { store, txnId, productId, env })
      return out
    })
  }

  /** pass_until = the latest expiry over the account's live (not refunded) subscription periods. */
  syncPass(accountId) {
    const ph = this.passProducts.map(() => '?').join(',') || "''"
    const q = (sql) => this.db.prepare(sql).get(accountId, ...this.passProducts)
    const until = q(`SELECT MAX(expires) AS m FROM txns WHERE account = ? AND revoked = 0 AND product IN (${ph})`).m ?? 0
    this.db.prepare('UPDATE accounts SET pass_until = ? WHERE id = ?').run(until, accountId)
    const live = q(`SELECT COUNT(*) AS n FROM txns WHERE account = ? AND revoked = 0 AND product IN (${ph})`).n
    for (const product of this.passProducts) {
      if (live) this.db.prepare('INSERT OR IGNORE INTO entitlements (account, product, at) VALUES (?, ?, ?)').run(accountId, product, this.now())
      else this.db.prepare('DELETE FROM entitlements WHERE account = ? AND product = ?').run(accountId, product)
    }
    return until
  }

  verifyApple(jws) {
    return verifyAppleJws(jws, { rootFingerprint: this.apple.rootFingerprint, skipOids: this.apple.skipOids })
  }

  /** StoreKit 2 transaction JWS from the device. */
  applePurchase(acc, jws) {
    let t
    try {
      t = this.verifyApple(jws)
    } catch (e) {
      this.audit(acc.id, null, 'apple_bad_jws', { why: e instanceof JwsError ? e.message : 'error' })
      throw new ShopError(400, 'invalid_receipt')
    }
    if (t.bundleId !== this.apple.bundleId) throw new ShopError(400, 'wrong_app')
    if (notProduction(t.environment) && !this.sandboxAllowed(acc.id)) throw new ShopError(400, 'sandbox_receipt')
    if (t.revocationDate) throw new ShopError(410, 'revoked')
    // The purchase was made for THIS account (appAccountToken set at purchase time): a receipt
    // copied from someone else's device cannot be credited here.
    if (!t.appAccountToken || String(t.appAccountToken).toLowerCase() !== acc.id) throw new ShopError(403, 'not_your_receipt')
    if (t.expiresDate && t.expiresDate < this.now()) {
      // An expired subscription period: record nothing new.
      return { ...this.wallet(this.account(acc.id)), credited: false }
    }
    const r = this.credit(acc, { store: 'apple', txnId: String(t.transactionId), originalId: t.originalTransactionId ? String(t.originalTransactionId) : null, productId: t.productId, env: t.environment, expires: t.expiresDate })
    return { ...this.wallet(this.account(acc.id)), ...r }
  }

  /** Verifies a Play purchase token for `productId` (the product must match the token). */
  async googleVerify(productId, purchaseToken) {
    if (!this.google?.configured) throw new ShopError(503, 'play_not_configured')
    if (typeof productId !== 'string' || !ID.test(productId) || typeof purchaseToken !== 'string' || !purchaseToken || purchaseToken.length > 4096) throw new ShopError(400, 'bad_request')
    const p = own(this.cat.products, productId)
    if (!p) throw new ShopError(400, 'unknown_product')
    const v = p.kind === 'pass' ? await this.google.verifySubscription(purchaseToken) : await this.google.verifyProduct(productId, purchaseToken)
    if (!v.ok) throw new ShopError(400, 'invalid_receipt', v.why)
    if (v.productId !== productId) throw new ShopError(400, 'wrong_product')
    return { p, v }
  }

  async googlePurchase(acc, { productId, purchaseToken } = {}) {
    const { p, v } = await this.googleVerify(productId, purchaseToken)
    if (v.account !== acc.id) throw new ShopError(403, 'not_your_receipt')
    return this.googleCredit(acc, productId, purchaseToken, p, v)
  }

  /** Credit, then consume / acknowledge on Play (the app never finishes a purchase itself). */
  async googleCredit(acc, productId, purchaseToken, p, v) {
    const txnId = sha256(purchaseToken)
    // Consumed on Play but never credited here: someone else finished it (or a client bug) — refuse.
    if (v.consumed && !this.db.prepare("SELECT 1 FROM txns WHERE store = 'google' AND txn_id = ?").get(txnId)) {
      this.audit(acc.id, null, 'google_consumed_uncredited', { productId })
      throw new ShopError(409, 'consumed_elsewhere')
    }
    if (v.test && !this.sandboxAllowed(acc.id)) throw new ShopError(400, 'sandbox_receipt')
    const r = this.credit(acc, { store: 'google', txnId, originalId: v.orderId ?? null, productId, env: v.test ? 'Sandbox' : 'Production', expires: v.expires })
    const finalized = await this.googleFinish(productId, purchaseToken, p, v)
    return { ...this.wallet(this.account(acc.id)), ...r, finalized }
  }

  async googleFinish(productId, token, p, v) {
    try {
      let status = 200
      if (p.consumable) { if (!v.consumed) status = await this.google.consumeProduct(productId, token) }
      else if (!v.acknowledged) status = p.kind === 'pass' ? await this.google.acknowledgeSubscription(productId, token) : await this.google.acknowledgeProduct(productId, token)
      if (status >= 300) this.log('google finish', productId, status)
      return status < 300
    } catch (e) {
      this.log('google finish', productId, e)
      return false
    }
  }

  /** Credit a Play purchase announced by RTDN to the account it was bought for. Never throws ShopError. */
  async googleServerRedeem(productId, token) {
    try {
      const { p, v } = await this.googleVerify(productId, token)
      const acc = this.liveAccount(v.account)
      if (!acc) return { handled: false, why: 'no_account' }
      const r = await this.googleCredit(acc, productId, token, p, v)
      return { handled: true, credited: r.credited }
    } catch (e) {
      if (e instanceof ShopError) return { handled: false, why: e.code }
      throw e
    }
  }

  /** Test builds only (DEV_PURCHASES=1 on a non-production server). */
  devPurchase(acc, productId) {
    if (!this.devPurchases) throw new ShopError(404, 'not_found')
    const r = this.credit(acc, { store: 'dev', txnId: randomUUID(), productId, env: 'Dev', expires: own(this.cat.products, productId)?.kind === 'pass' ? this.now() + 30 * DAY : undefined })
    return { ...this.wallet(this.account(acc.id)), ...r }
  }

  // ───────── Account recovery (new install / new phone) ─────────

  /** Recover from a verified Apple non-consumable / live subscription receipt: adds a device token. */
  recover(jws, ip) {
    let t
    try {
      t = this.verifyApple(jws)
    } catch {
      throw new ShopError(400, 'invalid_receipt')
    }
    if (t.bundleId !== this.apple.bundleId) throw new ShopError(400, 'wrong_app')
    const acc = this.liveAccount(t.appAccountToken)
    if (!acc) throw new ShopError(404, 'no_account')
    const p = own(this.cat.products, t.productId)
    if (!p || p.consumable) throw new ShopError(400, 'not_restorable')
    const txnId = String(t.transactionId)
    const originalId = t.originalTransactionId ? String(t.originalTransactionId) : null
    if (t.revocationDate || this.isRevoked('apple', txnId, p.kind === 'pass' ? null : originalId)) throw new ShopError(410, 'revoked')
    if (t.expiresDate && t.expiresDate < this.now()) throw new ShopError(410, 'expired')
    if (notProduction(t.environment) && !this.sandboxRecoverAllowed(acc.id)) throw new ShopError(400, 'sandbox_receipt')
    // The account id alone is not the secret: the receipt must be (a period of) a purchase this
    // account already redeemed.
    const known = this.db.prepare("SELECT 1 FROM txns WHERE store = 'apple' AND account = ? AND revoked = 0 AND (txn_id = ? OR (? IS NOT NULL AND (original_id = ? OR txn_id = ?)))").get(acc.id, txnId, originalId, originalId, originalId)
    if (!known) {
      this.audit(acc.id, ip, 'recover_unknown_receipt', { store: 'apple' })
      throw new ShopError(403, 'unknown_receipt')
    }
    this.audit(acc.id, ip, 'recover', { store: 'apple', txn: t.transactionId })
    return { accountId: acc.id, token: this.issueToken(acc.id) }
  }

  /** Recover from a Play purchase (obfuscatedExternalAccountId = account id): adds a device token. */
  async recoverGoogle({ productId, purchaseToken } = {}, ip) {
    const { p, v } = await this.googleVerify(productId, purchaseToken)
    const acc = this.liveAccount(v.account)
    if (!acc) throw new ShopError(404, 'no_account')
    if (p.consumable) throw new ShopError(400, 'not_restorable')
    const txnId = sha256(purchaseToken)
    if (this.isRevoked('google', txnId, p.kind === 'pass' ? null : v.orderId)) throw new ShopError(410, 'revoked')
    if (v.expires && v.expires < this.now()) throw new ShopError(410, 'expired')
    if (v.test && !this.sandboxRecoverAllowed(acc.id)) throw new ShopError(400, 'sandbox_receipt')
    // Only a purchase (token or order id) this account already redeemed.
    const known = this.db.prepare("SELECT 1 FROM txns WHERE store = 'google' AND account = ? AND revoked = 0 AND (txn_id = ? OR (? IS NOT NULL AND original_id = ?))").get(acc.id, txnId, v.orderId ?? null, v.orderId ?? null)
    if (!known) {
      this.audit(acc.id, ip, 'recover_unknown_receipt', { store: 'google' })
      throw new ShopError(403, 'unknown_receipt')
    }
    this.audit(acc.id, ip, 'recover', { store: 'google', productId })
    return { accountId: acc.id, token: this.issueToken(acc.id) }
  }

  /** A new one-time recovery code (replaces the previous one). Shown once; only its hash is kept. */
  recoveryCode(acc, ip) {
    const raw = Array.from({ length: 16 }, () => CODE_ABC[randomInt(CODE_ABC.length)]).join('')
    this.db.prepare('INSERT INTO recovery (account, hash, created) VALUES (?, ?, ?) ON CONFLICT(account) DO UPDATE SET hash = excluded.hash, created = excluded.created').run(acc.id, sha256(raw), this.now())
    this.audit(acc.id, ip, 'recovery_code')
    return { code: raw.match(/.{4}/g).join('-') }
  }

  /** Redeems a recovery code (case, spaces and dashes ignored): adds a device token, burns the code. */
  recoverCode(code, ip) {
    const norm = normCode(code)
    if (!CODE_RE.test(norm)) throw new ShopError(400, 'bad_code')
    const h = sha256(norm)
    const row = this.db.prepare('SELECT * FROM recovery WHERE hash = ?').get(h)
    const ok = !!row && timingSafeEqual(Buffer.from(row.hash, 'hex'), Buffer.from(h, 'hex'))
    const acc = ok ? this.liveAccount(row.account) : null
    if (!acc) {
      this.audit(null, ip, 'recover_code_fail')
      throw new ShopError(404, 'bad_code')
    }
    return tx(this.db, () => {
      if (this.db.prepare('DELETE FROM recovery WHERE hash = ?').run(h).changes !== 1) throw new ShopError(404, 'bad_code')
      this.audit(acc.id, ip, 'recover', { store: 'code' })
      return { accountId: acc.id, token: this.issueToken(acc.id) }
    })
  }

  // ───────── Spending ─────────

  /** body: { item, idem, discount?, career? } — `career` is copied into the grant as `c`. */
  spend(acc, { item, idem, discount, career } = {}) {
    const def = own(this.cat.spend, item)
    if (!def) throw new ShopError(400, 'unknown_item')
    if (typeof idem !== 'string' || !REF.test(idem)) throw new ShopError(400, 'bad_request')
    const c = optLabel(career, CAREER)
    return tx(this.db, () => {
      const prev = this.db.prepare('SELECT response, item FROM idem WHERE account = ? AND key = ?').get(acc.id, idem)
      if (prev) {
        // A retry: the first grant with today's wallet. The same key for another item is a client bug.
        if (prev.item && prev.item !== item) throw new ShopError(409, 'idem_mismatch')
        const grant = JSON.parse(prev.response).grant ?? null
        if (grant && this.db.prepare('SELECT 1 FROM grants WHERE nonce = ? AND acked = 3').get(grant.nonce)) throw new ShopError(409, 'grant_voided')
        return { ...this.wallet(this.account(acc.id)), grant, replay: true }
      }
      this.checkHold(acc.id)
      const cosmetic = def.grant.k === 'cosmetic' ? def.grant.id : null
      if (cosmetic && this.db.prepare('SELECT 1 FROM entitlements WHERE account = ? AND product = ?').get(acc.id, cosmetic)) throw new ShopError(409, 'owned')
      if (def.perDay && this.count(acc.id, `spend:${item}`) >= def.perDay) throw new ShopError(429, 'spend_cap')
      let price = def.price
      if (discount && item === 'physio') {
        if (this.counter(acc.id, 'disc:physio') < 1) throw new ShopError(400, 'no_discount')
        this.addCounter(acc.id, 'disc:physio', -1)
        price = def.discounted
      }
      this.moveGems(acc.id, -price, `spend:${item}`, idem)
      if (def.perDay) this.bump(acc.id, `spend:${item}`)
      if (cosmetic) this.db.prepare('INSERT INTO entitlements (account, product, at) VALUES (?, ?, ?)').run(acc.id, cosmetic, this.now())
      const g = this.grant(acc.id, { ...def.grant, src: item, ...(c ? { c } : {}) }, `spend:${idem}`, price)
      this.db.prepare('INSERT INTO idem (account, key, response, at, item) VALUES (?, ?, ?, ?, ?)').run(acc.id, idem, JSON.stringify({ grant: g }), this.now(), item)
      return { ...this.wallet(this.account(acc.id)), grant: g }
    })
  }

  // ───────── Rewarded ads ─────────

  /** `ref` (optional, e.g. a fixture id) is kept on the session and copied into the grant. */
  /** Does this offer pay diamonds (counts toward the per-address ceiling)? */
  adPaysGems(offer) {
    return !!this.cat.ads[offer]?.reward.gems || offer === 'season_x2'
  }

  /**
   * Ad session states (ads.done): 0 open, 1 rewarded, 2 aborted (dismissed / failed to show).
   * Starting the same offer again reuses the newest open session (its watch timer restarts).
   */
  adStart(acc, offer, ref, ip) {
    const def = own(this.cat.ads, offer)
    if (!def) throw new ShopError(400, 'unknown_offer')
    const r = optLabel(ref, REF)
    this.checkHold(acc.id)
    if (this.count(acc.id, `ad:${offer}`) >= this.adCap(acc, offer)) throw new ShopError(429, 'ad_cap')
    if (offer === 'season_x2' && this.counter(acc.id, 'season:ready') < 1) throw new ShopError(400, 'no_season_reward')
    if (this.adPaysGems(offer) && this.ipCount(this.ipBucket(ip)) >= this.ipCap) throw new ShopError(429, 'ad_cap')
    const now = this.now()
    const skipAd = acc.pass_until > now // Pro Contract: the reward without the ad.
    const prev = this.db.prepare('SELECT nonce FROM ads WHERE account = ? AND offer = ? AND done = 0 AND started > ? ORDER BY started DESC LIMIT 1').get(acc.id, offer, now - 30 * 60_000)
    if (prev) {
      this.db.prepare('UPDATE ads SET started = ?, ref = ? WHERE nonce = ?').run(now, r ?? null, prev.nonce)
      return { nonce: prev.nonce, skipAd, reused: true }
    }
    const open = this.db.prepare('SELECT COUNT(*) AS n FROM ads WHERE account = ? AND done = 0 AND started > ?').get(acc.id, now - 30 * 60_000).n
    if (open >= (this.cat.limits.maxOpenAds ?? 3)) throw new ShopError(429, 'too_many_open_ads')
    const nonce = randomBytes(16).toString('hex')
    this.db.prepare('INSERT INTO ads (nonce, account, offer, started, ref) VALUES (?, ?, ?, ?, ?)').run(nonce, acc.id, offer, now, r ?? null)
    return { nonce, skipAd }
  }

  /** The ad was dismissed or failed to show: close the session (it stops counting as open). */
  adAbort(acc, nonce) {
    if (typeof nonce !== 'string' || !/^[0-9a-f]{32}$/.test(nonce)) throw new ShopError(400, 'bad_request')
    const s = this.db.prepare('SELECT done FROM ads WHERE nonce = ? AND account = ?').get(nonce, acc.id)
    if (!s) throw new ShopError(404, 'no_ad_session')
    if (s.done === 1) throw new ShopError(409, 'already_rewarded')
    this.db.prepare('UPDATE ads SET done = 2 WHERE nonce = ? AND done = 0').run(nonce)
    return { aborted: true }
  }

  /** Google's SSV callback (already signature-checked): marks the ad session as really watched. */
  adSsv(fields) {
    const [accountId, nonce] = String(fields.custom_data ?? '').split(':')
    const r = this.db.prepare('UPDATE ads SET ssv = 1 WHERE nonce = ? AND account = ?').run(nonce ?? '', accountId ?? '')
    this.audit(UUID.test(accountId ?? '') ? accountId : null, null, 'ad_ssv', { nonce, ok: r.changes === 1, tx: fields.transaction_id })
    return r.changes === 1
  }

  adComplete(acc, nonce, career, ip) {
    if (typeof nonce !== 'string' || !/^[0-9a-f]{32}$/.test(nonce)) throw new ShopError(400, 'bad_request')
    const c = optLabel(career, CAREER)
    return tx(this.db, () => {
      const s = this.db.prepare('SELECT * FROM ads WHERE nonce = ? AND account = ?').get(nonce, acc.id)
      if (!s) throw new ShopError(404, 'no_ad_session')
      if (s.done === 1) throw new ShopError(409, 'already_rewarded')
      // Aborted by the app, unless Google's SSV says the ad was in fact watched.
      if (s.done === 2 && !s.ssv) throw new ShopError(409, 'ad_aborted')
      this.checkHold(acc.id)
      const pass = acc.pass_until > this.now()
      if (!pass && this.requireSsv && !s.ssv) throw new ShopError(425, 'ad_not_verified')
      if (!pass && !this.requireSsv && this.now() - s.started < 5000) throw new ShopError(425, 'ad_too_short')
      if (this.now() - s.started > 30 * 60_000) throw new ShopError(410, 'ad_expired')
      const def = this.cat.ads[s.offer]
      if (this.count(acc.id, `ad:${s.offer}`) >= this.adCap(acc, s.offer)) throw new ShopError(429, 'ad_cap')
      if (s.offer === 'season_x2') {
        if (this.counter(acc.id, 'season:ready') < 1) throw new ShopError(409, 'no_season_reward')
        this.setCounter(acc.id, 'season:ready', 0)
      }
      this.db.prepare('UPDATE ads SET done = 1 WHERE nonce = ?').run(nonce)
      this.bump(acc.id, `ad:${s.offer}`)
      let grant = null
      const bucket = this.ipBucket(ip)
      if (def.reward.gems) {
        this.moveGems(acc.id, def.reward.gems, `ad:${s.offer}`, nonce)
        this.ipBump(bucket, def.reward.gems)
      }
      if (s.offer === 'season_x2') {
        this.moveGems(acc.id, this.cat.earn.season.gems, 'ad:season_x2', nonce)
        this.ipBump(bucket, this.cat.earn.season.gems)
      }
      if (def.reward.grant) grant = this.grant(acc.id, { ...def.reward.grant, src: `ad:${s.offer}`, ...(c ? { c } : {}), ...(s.ref ? { ref: s.ref } : {}) }, `ad:${nonce}`)
      if (def.reward.discount === 'physio') this.addCounter(acc.id, 'disc:physio')
      return { ...this.wallet(this.account(acc.id)), grant }
    })
  }

  // ───────── Free diamonds (earned in the career) ─────────

  /**
   * The career runs on the device, so the server cannot prove a Man of the Match happened: free
   * diamonds are therefore deduplicated by reference and hard-capped per source and per day, which
   * bounds what a modified client can farm to a small, free-player amount. A claim refused by a cap
   * does not use up its reference (it can be claimed another day).
   */
  earn(acc, { source, ref } = {}, ip) {
    const def = own(this.cat.earn, source)
    if (!def) throw new ShopError(400, 'unknown_source')
    if (typeof ref !== 'string' || !REF.test(ref)) throw new ShopError(400, 'bad_request')
    const key = `${source}:${ref}`
    return tx(this.db, () => {
      if (this.db.prepare('SELECT 1 FROM earn_refs WHERE account = ? AND ref = ?').get(acc.id, key)) return { ...this.wallet(this.account(acc.id)), earned: 0 }
      // Per source and per day (halved for an account younger than a day), and per client address
      // across accounts (fresh-account farming).
      const bucket = this.ipBucket(ip)
      const capped = this.count(acc.id, `earn:${source}`) >= this.ramp(acc, def.perDay) ||
        this.count(acc.id, 'earn:total') + def.gems > this.ramp(acc, this.cat.limits.earnPerDay) ||
        (bucket && this.ipCount(bucket) + def.gems > this.ipCap)
      if (capped) return { ...this.wallet(this.account(acc.id)), earned: 0, capped: true }
      this.db.prepare('INSERT INTO earn_refs (account, ref, at) VALUES (?, ?, ?)').run(acc.id, key, this.now())
      this.bump(acc.id, `earn:${source}`)
      this.bump(acc.id, 'earn:total', def.gems)
      this.ipBump(bucket, def.gems)
      this.moveGems(acc.id, def.gems, `earn:${source}`, ref)
      // A season reward makes the season x2 ad available until it is used (not just today).
      if (source === 'season') this.setCounter(acc.id, 'season:ready', 1)
      return { ...this.wallet(this.account(acc.id)), earned: def.gems }
    })
  }

  // ───────── Pro Contract daily diamonds ─────────

  passClaim(acc) {
    return tx(this.db, () => {
      const a = this.account(acc.id)
      if (!(a.pass_until > this.now())) throw new ShopError(402, 'no_pass')
      const r = this.db.prepare('UPDATE accounts SET pass_claim_day = ? WHERE id = ? AND (pass_claim_day IS NULL OR pass_claim_day != ?)').run(this.day(), acc.id, this.day())
      if (r.changes !== 1) throw new ShopError(409, 'already_claimed')
      this.moveGems(acc.id, this.cat.limits.passDaily, 'pass:daily', this.day())
      return this.wallet(this.account(acc.id))
    })
  }

  // ───────── Refunds / revocations (both stores) ─────────

  /**
   * Claws back a refunded / revoked store transaction. Unknown transaction → tombstone, so the
   * receipt can never be credited or used for recovery later. Withdraws grants from that purchase
   * that the app has not applied yet; a Starter Pack whose boots were already applied keeps
   * starter=1 (it cannot be bought again for a second pair).
   */
  revokeTxn(store, txnId, originalId, { sub = false } = {}) {
    return tx(this.db, () => {
      const row = this.db.prepare('SELECT * FROM txns WHERE store = ? AND txn_id = ?').get(store, txnId)
      if (!row) {
        const st = this.db.prepare('INSERT OR IGNORE INTO tombstones (store, key, at) VALUES (?, ?, ?)')
        let fresh = st.run(store, `t:${txnId}`, this.now()).changes
        // A subscription period: only that transaction (its renewals share the original id).
        if (originalId && !sub) fresh += st.run(store, `o:${originalId}`, this.now()).changes
        if (!fresh) return { handled: false }
        this.audit(null, null, 'tombstone', { store, txnId, originalId: sub ? null : originalId })
        return { handled: true, tombstone: true }
      }
      if (row.revoked) return { handled: false }
      this.db.prepare('UPDATE txns SET revoked = 1 WHERE store = ? AND txn_id = ?').run(store, txnId)
      const p = own(this.cat.products, row.product)
      const ref = `${store}:${row.txn_id}`
      // Unapplied grants from this purchase are withdrawn (kept as state 2 so a reversal can restore them).
      const withdrawn = this.db.prepare('UPDATE grants SET acked = 2 WHERE account = ? AND ref = ? AND acked = 0').run(row.account, ref).changes
      const applied = !!this.db.prepare('SELECT 1 FROM grants WHERE account = ? AND ref = ? AND acked = 1').get(row.account, ref)
      // Take back exactly the diamonds this transaction credited (a repeat Starter Pack credited none).
      const credited = this.db.prepare("SELECT COALESCE(SUM(delta), 0) AS n FROM ledger WHERE account = ? AND ref = ? AND why LIKE 'buy:%'").get(row.account, ref).n
      if (credited > 0) this.moveGems(row.account, -credited, 'refund', ref)
      if (p?.kind === 'starter' && credited > 0 && !applied) this.db.prepare('UPDATE accounts SET starter = 0 WHERE id = ?').run(row.account)
      // A refunded subscription period: the pass runs to the latest remaining paid period.
      if (p?.kind === 'pass') this.syncPass(row.account)
      else if (p && !p.consumable) this.db.prepare('DELETE FROM entitlements WHERE account = ? AND product = ?').run(row.account, row.product)
      this.addCounter(row.account, 'refunds')
      this.audit(row.account, null, 'refund', { store, txn: row.txn_id, product: row.product, withdrawn })
      if (this.account(row.account).gems < 0) this.audit(row.account, null, 'negative_balance', { gems: this.account(row.account).gems })
      return { handled: true }
    })
  }

  /**
   * A refund reversed by the store (Apple REFUND_REVERSED): clears the tombstone, or un-revokes the
   * transaction and gives back exactly what the refund took (diamonds once, withdrawn grants, the
   * Starter flag, the pass expiry and entitlement).
   */
  restoreTxn(store, txnId, originalId, { sub = false } = {}) {
    return tx(this.db, () => {
      const row = this.db.prepare('SELECT * FROM txns WHERE store = ? AND txn_id = ?').get(store, txnId)
      if (!row) {
        const del = this.db.prepare('DELETE FROM tombstones WHERE store = ? AND key = ?')
        let n = del.run(store, `t:${txnId}`).changes
        if (originalId && !sub) n += del.run(store, `o:${originalId}`).changes
        if (n) this.audit(null, null, 'tombstone_cleared', { store, txnId })
        return { handled: n > 0 }
      }
      if (!row.revoked) return { handled: false }
      this.db.prepare('UPDATE txns SET revoked = 0 WHERE store = ? AND txn_id = ?').run(store, txnId)
      const p = own(this.cat.products, row.product)
      const ref = `${store}:${row.txn_id}`
      // What the refunds of this transaction took, net of earlier reversals.
      const taken = -this.db.prepare("SELECT COALESCE(SUM(delta), 0) AS n FROM ledger WHERE account = ? AND ref = ? AND why IN ('refund', 'refund_reversed')").get(row.account, ref).n
      let regems = taken > 0 ? taken : 0
      let regrant = true
      if (p?.kind === 'starter' && this.db.prepare('SELECT 1 FROM grants WHERE account = ? AND ref = ? AND acked = 2').get(row.account, ref)) {
        // The refund had reset the pack. If another Starter Pack was bought since, that one stands.
        if (this.account(row.account).starter) {
          regems = 0
          regrant = false
          this.audit(row.account, null, 'refund_reversed_starter_owned', { store, txn: row.txn_id })
        } else this.db.prepare('UPDATE accounts SET starter = 1 WHERE id = ?').run(row.account)
      }
      if (regems > 0) this.moveGems(row.account, regems, 'refund_reversed', ref)
      if (regrant) this.db.prepare('UPDATE grants SET acked = 0 WHERE account = ? AND ref = ? AND acked = 2').run(row.account, ref)
      if (p?.kind === 'pass') this.syncPass(row.account)
      else if (p && !p.consumable) this.db.prepare('INSERT OR IGNORE INTO entitlements (account, product, at) VALUES (?, ?, ?)').run(row.account, row.product, this.now())
      if (this.counter(row.account, 'refunds') > 0) this.addCounter(row.account, 'refunds', -1)
      this.audit(row.account, null, 'refund_reversed', { store, txn: row.txn_id, product: row.product, gems: regems })
      return { handled: true }
    })
  }

  /** Ends a pass now and drops the Pro entitlement (expired / on hold / paused). */
  endPass(accountId) {
    this.db.prepare('UPDATE accounts SET pass_until = MIN(pass_until, ?) WHERE id = ?').run(this.now(), accountId)
    this.db.prepare("DELETE FROM entitlements WHERE account = ? AND product = 'pro_contract'").run(accountId)
  }

  /** App Store Server Notifications v2. A bad signature or payload is a 400; otherwise 200 + handled. */
  appleNotification(signedPayload) {
    let n, info
    try {
      n = this.verifyApple(signedPayload)
      info = n.data?.signedTransactionInfo ? this.verifyApple(n.data.signedTransactionInfo) : null
    } catch {
      throw new ShopError(400, 'invalid_notification')
    }
    if (!info) return { handled: false }
    if (n.data?.bundleId !== this.apple.bundleId || info.bundleId !== this.apple.bundleId) return { handled: false, why: 'wrong_app' }
    const uuid = typeof n.notificationUUID === 'string' ? n.notificationUUID.slice(0, 64) : null
    if (uuid && this.db.prepare('SELECT 1 FROM notes WHERE id = ?').get(uuid)) return { handled: false, duplicate: true }
    const out = this.appleNote(n.notificationType, info)
    if (uuid) this.db.prepare('INSERT OR IGNORE INTO notes (id, at) VALUES (?, ?)').run(uuid, this.now())
    return out
  }

  appleNote(type, info) {
    const txnId = String(info.transactionId)
    const originalId = info.originalTransactionId ? String(info.originalTransactionId) : null
    const sub = own(this.cat.products, info.productId)?.kind === 'pass' || info.type === 'Auto-Renewable Subscription'
    if (type === 'REFUND' || type === 'REVOKE') return this.revokeTxn('apple', txnId, originalId, { sub })
    if (type === 'REFUND_REVERSED') return this.restoreTxn('apple', txnId, originalId, { sub })
    if (type === 'DID_RENEW' || type === 'SUBSCRIBED') {
      // A renewal is a new transaction: credit() applies tombstones, revocations and the sandbox policy.
      const acc = this.liveAccount(info.appAccountToken)
      if (!acc || info.revocationDate || !info.expiresDate) return { handled: false }
      try {
        this.credit(acc, { store: 'apple', txnId, originalId, productId: info.productId, env: info.environment, expires: info.expiresDate })
        return { handled: true }
      } catch (e) {
        if (e instanceof ShopError) return { handled: false, why: e.code }
        throw e
      }
    }
    if (type === 'EXPIRED' || type === 'GRACE_PERIOD_EXPIRED') {
      const acc = this.liveAccount(info.appAccountToken)
      // Out of order: an EXPIRED for an older period must not end a pass that has since renewed.
      if (!acc || !((info.expiresDate ?? 0) >= acc.pass_until)) return { handled: false }
      this.endPass(acc.id)
      return { handled: true }
    }
    return { handled: false }
  }

  /** Google Play Real-time developer notification (already authenticated by the push token). */
  async googleRtdn(msg) {
    if (!this.google?.configured || !msg || msg.packageName !== this.google.pkg) return { handled: false }
    const tokenOf = (o) => (typeof o?.purchaseToken === 'string' && o.purchaseToken.length <= 4096 ? o.purchaseToken : null)
    if (msg.voidedPurchaseNotification) {
      const t = tokenOf(msg.voidedPurchaseNotification)
      // productType 1 = subscription, 2 = one-time product.
      return t ? this.revokeTxn('google', sha256(t), msg.voidedPurchaseNotification.orderId ?? null, { sub: msg.voidedPurchaseNotification.productType === 1 }) : { handled: false }
    }
    if (msg.oneTimeProductNotification) {
      const o = msg.oneTimeProductNotification
      const t = tokenOf(o)
      if (!t) return { handled: false }
      if (o.notificationType === 2) return this.revokeTxn('google', sha256(t), null) // ONE_TIME_PRODUCT_CANCELED
      if (o.notificationType === 1) return this.googleServerRedeem(o.sku, t) // ONE_TIME_PRODUCT_PURCHASED
      return { handled: false }
    }
    if (msg.subscriptionNotification) {
      const s = msg.subscriptionNotification
      const t = tokenOf(s)
      if (!t) return { handled: false }
      const type = s.notificationType
      if (type === 12 || type === 20) return this.revokeTxn('google', sha256(t), null, { sub: true }) // REVOKED, PENDING_PURCHASE_CANCELED
      if ([1, 2, 4, 7].includes(type)) return this.googleServerRedeem(s.subscriptionId, t) // RECOVERED, RENEWED, PURCHASED, RESTARTED
      if ([5, 10, 13].includes(type)) { // ON_HOLD, PAUSED, EXPIRED
        const row = this.db.prepare("SELECT account FROM txns WHERE store = 'google' AND txn_id = ?").get(sha256(t))
        if (row) this.endPass(row.account)
        return { handled: !!row }
      }
      return { handled: false } // CANCELED (3) = auto-renew off; the pass runs to its expiry
    }
    return { handled: false }
  }

  /** Daily: refunds and chargebacks Play reports (also those RTDN missed). Returns how many applied. */
  async pollVoided() {
    if (!this.google?.configured) return 0
    const since = Number(this.db.prepare("SELECT value FROM meta WHERE key = 'google:voided'").get()?.value) || this.now() - 30 * DAY
    const startedAt = this.now()
    const list = await this.google.voidedPurchases(Math.max(since, startedAt - 30 * DAY))
    let n = 0
    for (const vp of list) {
      if (typeof vp.purchaseToken !== 'string') continue
      // A renewal's order id is '<base>..N'; one-time and first periods have none. Subscription
      // voids tombstone only the token (never a shared order id).
      const sub = typeof vp.orderId === 'string' && /\.\.\d+$/.test(vp.orderId)
      if (this.revokeTxn('google', sha256(vp.purchaseToken), vp.orderId ?? null, { sub }).handled) n++
    }
    // Overlap one hour: revokeTxn is idempotent.
    this.db.prepare("INSERT INTO meta (key, value) VALUES ('google:voided', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(String(startedAt - 3600_000))
    return n
  }

  // ───────── Personal data: retention, export, deletion ─────────

  hashIp(ip) {
    return `h:${createHmac('sha256', this.ipSalt).update(ip).digest('hex').slice(0, 16)}`
  }

  /** Daily retention job. Returns the rows touched per table. */
  prune() {
    const now = this.now()
    const run = (sql, ...a) => this.db.prepare(sql).run(...a).changes
    return tx(this.db, () => {
      const r = {
        ads: run('DELETE FROM ads WHERE (done = 0 AND started < ?) OR started < ?', now - DAY, now - 30 * DAY),
        idem: run('DELETE FROM idem WHERE at < ?', now - 30 * DAY),
        daily: run('DELETE FROM daily WHERE day < ?', this.day(now - 14 * DAY)),
        ipDaily: run('DELETE FROM ip_daily WHERE day < ?', this.day(now - 2 * DAY)),
        // Applied, withdrawn and voided grants (open ones stay until the app applies or voids them).
        grants: run('DELETE FROM grants WHERE acked != 0 AND at < ?', now - 30 * DAY),
        notes: run('DELETE FROM notes WHERE at < ?', now - 30 * DAY),
        audit: run('DELETE FROM audit WHERE at < ?', now - 180 * DAY),
        // Free-diamond references: past the dedupe window that matters (a season is under a year).
        earnRefs: run('DELETE FROM earn_refs WHERE at < ?', now - 400 * DAY),
        // Accounts that never bought anything: old ledger rows keep amounts only.
        ledgerAnon: run('UPDATE ledger SET ref = NULL WHERE at < ? AND ref IS NOT NULL AND account NOT IN (SELECT account FROM txns)', now - 400 * DAY),
        // Store transactions are business records: kept 7 years, then deleted (with their tombstones).
        txns: run('DELETE FROM txns WHERE at < ?', now - 7 * YEAR),
        tombstones: run('DELETE FROM tombstones WHERE at < ?', now - 7 * YEAR),
        accounts: this.pruneAccounts(now - 30 * DAY),
        auditIps: 0,
      }
      const old = this.db.prepare("SELECT id, ip FROM audit WHERE at < ? AND ip IS NOT NULL AND ip NOT LIKE 'h:%'").all(now - 30 * DAY)
      const st = this.db.prepare('UPDATE audit SET ip = ? WHERE id = ?')
      for (const a of old) r.auditIps += st.run(this.hashIp(a.ip), a.id).changes
      return r
    })
  }

  /**
   * Empty accounts nobody has used for 30 days: no diamonds, no store transactions, no
   * entitlements, no open grants, no ledger movement since `before`. Removed with every row that
   * points at them (tokens, recovery code, counters, claims). Inside prune()'s transaction.
   */
  pruneAccounts(before) {
    const ids = this.db.prepare(`SELECT a.id FROM accounts a
      WHERE a.gems = 0 AND a.created < ? AND a.seen < ? AND a.banned = 0 AND a.pass_until < ?
        AND NOT EXISTS (SELECT 1 FROM txns t WHERE t.account = a.id)
        AND NOT EXISTS (SELECT 1 FROM entitlements e WHERE e.account = a.id)
        AND NOT EXISTS (SELECT 1 FROM grants g WHERE g.account = a.id AND g.acked = 0)
        AND NOT EXISTS (SELECT 1 FROM ledger l WHERE l.account = a.id AND l.at >= ?)
      LIMIT 20000`).all(before, before, this.now(), before).map((r) => r.id)
    if (!ids.length) return 0
    const tables = ['account_tokens', 'recovery', 'entitlements', 'grants', 'ads', 'earn_refs', 'daily', 'counters', 'idem', 'ledger']
    const st = tables.map((t) => this.db.prepare(`DELETE FROM ${t} WHERE account = ?`))
    const delAcc = this.db.prepare('DELETE FROM accounts WHERE id = ?')
    for (const id of ids) {
      for (const s of st) s.run(id)
      delAcc.run(id)
    }
    return ids.length
  }

  /** Everything the server holds about the account (GDPR access / portability). */
  exportAccount(acc) {
    const q = (sql) => this.db.prepare(sql).all(acc.id)
    const a = this.account(acc.id)
    return {
      account: { id: a.id, created: a.created, platform: a.platform, gems: a.gems, starter: !!a.starter, passUntil: a.pass_until },
      devices: this.db.prepare('SELECT COUNT(*) AS n FROM account_tokens WHERE account = ?').get(acc.id).n,
      recoveryCode: !!this.db.prepare('SELECT 1 FROM recovery WHERE account = ?').get(acc.id),
      entitlements: q('SELECT product, at FROM entitlements WHERE account = ?'),
      purchases: q('SELECT store, product, env, at, revoked FROM txns WHERE account = ? ORDER BY at'),
      ledger: q('SELECT delta, balance, why, ref, at FROM ledger WHERE account = ? ORDER BY id DESC LIMIT 10000'),
      grants: q('SELECT payload, at, acked FROM grants WHERE account = ? ORDER BY at').map((g) => ({ ...JSON.parse(g.payload), at: g.at, acked: g.acked === 1, state: ['open', 'applied', 'withdrawn', 'voided'][g.acked] ?? 'unknown' })),
      ads: q('SELECT offer, started, ssv, done, ref FROM ads WHERE account = ? ORDER BY started'),
      counters: q('SELECT key, n FROM counters WHERE account = ?'),
      audit: q('SELECT at, event, ip FROM audit WHERE account = ? ORDER BY id DESC LIMIT 1000'),
    }
  }

  /**
   * Erases the account's personal data. Store transactions stay (refunds and fraud checks need
   * them) but point at an account that can no longer sign in; ledger rows keep amounts only.
   */
  deleteAccount(acc, ip) {
    tx(this.db, () => {
      for (const t of ['account_tokens', 'recovery', 'entitlements', 'grants', 'ads', 'earn_refs', 'daily', 'counters', 'idem']) {
        this.db.prepare(`DELETE FROM ${t} WHERE account = ?`).run(acc.id)
      }
      this.db.prepare('UPDATE ledger SET ref = NULL WHERE account = ?').run(acc.id)
      this.db.prepare('UPDATE audit SET ip = NULL, detail = NULL WHERE account = ?').run(acc.id)
      this.db.prepare("UPDATE accounts SET deleted = 1, platform = NULL, secret_hash = '', pass_claim_day = NULL WHERE id = ?").run(acc.id)
      this.audit(acc.id, null, 'deleted')
    })
    return { deleted: true }
  }
}
