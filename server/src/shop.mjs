// Shop rules, independent of HTTP. The server is the only place diamonds are created or spent:
// the app shows a cached balance, but every credit needs a verified store receipt, a capped ad
// reward or a capped free-diamond claim, and every spend is checked here against server prices.
import { createHash, randomBytes, randomUUID, sign, timingSafeEqual } from 'node:crypto'
import { tx } from './db.mjs'
import { JwsError, verifyAppleJws } from './apple.mjs'

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

export class Shop {
  /**
   * @param {object} o
   * @param {import('node:sqlite').DatabaseSync} o.db
   * @param {object} o.catalog catalog.json
   * @param {import('node:crypto').KeyObject} o.signKey Ed25519 private key for grants
   * @param {{ bundleId: string, allowSandbox: boolean, rootFingerprint?: string, skipOids?: boolean }} o.apple
   * @param {import('./google.mjs').GooglePlay} [o.google]
   * @param {{ requireSsv: boolean }} [o.ads]
   * @param {boolean} [o.devPurchases] test-only purchases without a store (never in production)
   * @param {() => number} [o.now]
   */
  constructor(o) {
    this.db = o.db
    this.cat = o.catalog
    this.signKey = o.signKey
    this.apple = o.apple
    this.google = o.google
    this.requireSsv = !!o.ads?.requireSsv
    this.devPurchases = !!o.devPurchases
    this.now = o.now ?? (() => Date.now())
  }

  day() {
    return new Date(this.now()).toISOString().slice(0, 10)
  }

  audit(account, ip, event, detail) {
    this.db.prepare('INSERT INTO audit (at, account, ip, event, detail) VALUES (?, ?, ?, ?, ?)').run(this.now(), account ?? null, ip ?? null, event, detail ? JSON.stringify(detail).slice(0, 500) : null)
  }

  // ───────── Accounts ─────────

  register(ip, platform) {
    const id = randomUUID()
    const secret = randomBytes(32).toString('base64url')
    this.db.prepare('INSERT INTO accounts (id, secret_hash, created, platform) VALUES (?, ?, ?, ?)').run(id, sha256(secret), this.now(), ['ios', 'android', 'web'].includes(platform) ? platform : null)
    this.audit(id, ip, 'register')
    return { accountId: id, token: `${id}.${secret}` }
  }

  /** Bearer `<accountId>.<secret>` → account row. Constant-time secret check. */
  auth(header) {
    const m = /^Bearer ([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/.exec(header ?? '')
    if (!m || !UUID.test(m[1])) throw new ShopError(401, 'unauthorized')
    const acc = this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(m[1])
    const want = Buffer.from(acc?.secret_hash ?? sha256('x'), 'hex')
    const got = Buffer.from(sha256(m[2]), 'hex')
    if (!acc || !timingSafeEqual(want, got)) throw new ShopError(401, 'unauthorized')
    if (acc.banned) throw new ShopError(403, 'banned')
    return acc
  }

  account(id) {
    return this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(id)
  }

  // ───────── Ledger ─────────

  /** Adds (or removes) diamonds inside the caller's transaction. Spends never go below zero. */
  moveGems(accountId, delta, why, ref) {
    const acc = this.account(accountId)
    const balance = acc.gems + delta
    if (delta < 0 && balance < 0 && why !== 'refund') throw new ShopError(402, 'insufficient_gems')
    this.db.prepare('UPDATE accounts SET gems = ? WHERE id = ?').run(balance, accountId)
    this.db.prepare('INSERT INTO ledger (account, delta, balance, why, ref, at) VALUES (?, ?, ?, ?, ?, ?)').run(accountId, delta, balance, why, ref ?? null, this.now())
    return balance
  }

  bump(accountId, key, by = 1) {
    this.db.prepare('INSERT INTO daily (account, day, key, n) VALUES (?, ?, ?, ?) ON CONFLICT(account, day, key) DO UPDATE SET n = n + excluded.n').run(accountId, this.day(), key, by)
  }

  count(accountId, key) {
    return this.db.prepare('SELECT n FROM daily WHERE account = ? AND day = ? AND key = ?').get(accountId, this.day(), key)?.n ?? 0
  }

  // ───────── Grants (signed coupons the app applies to the career) ─────────

  grant(accountId, payload) {
    const nonce = randomBytes(16).toString('base64url')
    const body = { v: 1, n: nonce, a: accountId, t: this.now(), ...payload }
    const b = Buffer.from(JSON.stringify(body)).toString('base64url')
    const token = `${b}.${sign(null, Buffer.from(b), this.signKey).toString('base64url')}`
    this.db.prepare('INSERT INTO grants (nonce, account, payload, token, at) VALUES (?, ?, ?, ?, ?)').run(nonce, accountId, JSON.stringify(body), token, this.now())
    return { nonce, token, ...payload }
  }

  ack(acc, nonces) {
    if (!Array.isArray(nonces) || nonces.length > 50) throw new ShopError(400, 'bad_request')
    const st = this.db.prepare('UPDATE grants SET acked = 1 WHERE nonce = ? AND account = ?')
    tx(this.db, () => { for (const n of nonces) if (typeof n === 'string' && n.length < 40) st.run(n, acc.id) })
    return this.wallet(this.account(acc.id))
  }

  // ───────── Wallet view ─────────

  wallet(accIn) {
    const acc = this.account(accIn.id)
    const ents = this.db.prepare('SELECT product FROM entitlements WHERE account = ?').all(acc.id).map((r) => r.product)
    const inbox = this.db.prepare('SELECT nonce, token, payload FROM grants WHERE account = ? AND acked = 0 ORDER BY at').all(acc.id)
      .map((g) => ({ nonce: g.nonce, token: g.token, ...JSON.parse(g.payload) }))
    const ads = Object.fromEntries(Object.keys(this.cat.ads).map((k) => [k, { used: this.count(acc.id, `ad:${k}`), max: this.cat.ads[k].perDay }]))
    const now = this.now()
    return {
      accountId: acc.id,
      gems: acc.gems,
      starter: !!acc.starter,
      pass: { active: acc.pass_until > now, until: acc.pass_until, claimable: acc.pass_until > now && acc.pass_claim_day !== this.day() },
      entitlements: ents,
      inbox,
      ads,
      physioDiscounts: this.count(acc.id, 'disc:physio'),
      earnedToday: this.count(acc.id, 'earn:total'),
      prices: Object.fromEntries(Object.entries(this.cat.spend).map(([k, v]) => [k, v.price])),
    }
  }

  // ───────── Purchases ─────────

  /** Credits one verified store transaction exactly once. */
  credit(acc, { store, txnId, originalId, productId, env, expires }) {
    const p = this.cat.products[productId]
    if (!p) throw new ShopError(400, 'unknown_product')
    return tx(this.db, () => {
      const seen = this.db.prepare('SELECT * FROM txns WHERE store = ? AND txn_id = ?').get(store, txnId)
      if (seen) {
        if (seen.account !== acc.id) {
          this.audit(acc.id, null, 'receipt_reuse', { store, txnId, owner: seen.account })
          throw new ShopError(409, 'receipt_used')
        }
        if (seen.revoked) throw new ShopError(410, 'revoked')
        // Same transaction again (retry / restore): refresh a subscription's expiry, never credit twice.
        if (p.kind === 'pass' && expires) this.db.prepare('UPDATE accounts SET pass_until = MAX(pass_until, ?) WHERE id = ?').run(expires, acc.id)
        return { credited: false }
      }
      this.db.prepare('INSERT INTO txns (store, txn_id, original_id, account, product, env, at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(store, txnId, originalId ?? null, acc.id, productId, env ?? null, this.now())
      const ref = `${store}:${txnId}`
      if (p.kind === 'gems') this.moveGems(acc.id, p.gems, `buy:${productId}`, ref)
      else if (p.kind === 'cash') this.grant(acc.id, { k: 'cash', weeks: p.cashWeeks, floor: p.cashFloor, src: productId })
      else if (p.kind === 'starter') {
        const fresh = this.db.prepare('UPDATE accounts SET starter = 1 WHERE id = ? AND starter = 0').run(acc.id).changes === 1
        if (fresh) {
          this.moveGems(acc.id, p.gems, 'buy:starter_pack', ref)
          this.grant(acc.id, { k: 'gear', id: p.gear, src: productId })
        }
      } else if (p.kind === 'pass') {
        this.db.prepare('UPDATE accounts SET pass_until = MAX(pass_until, ?) WHERE id = ?').run(expires ?? this.now() + 31 * 86400_000, acc.id)
      }
      if (!p.consumable) this.db.prepare('INSERT OR IGNORE INTO entitlements (account, product, at) VALUES (?, ?, ?)').run(acc.id, productId, this.now())
      this.audit(acc.id, null, 'purchase', { store, txnId, productId, env })
      return { credited: true }
    })
  }

  /** StoreKit 2 transaction JWS from the device. */
  applePurchase(acc, jws) {
    let t
    try {
      t = verifyAppleJws(jws, { rootFingerprint: this.apple.rootFingerprint, skipOids: this.apple.skipOids })
    } catch (e) {
      this.audit(acc.id, null, 'apple_bad_jws', { why: e instanceof JwsError ? e.message : 'error' })
      throw new ShopError(400, 'invalid_receipt')
    }
    if (t.bundleId !== this.apple.bundleId) throw new ShopError(400, 'wrong_app')
    if (t.environment !== 'Production' && !(this.apple.allowSandbox && (t.environment === 'Sandbox' || t.environment === 'Xcode'))) throw new ShopError(400, 'sandbox_receipt')
    if (t.revocationDate) throw new ShopError(410, 'revoked')
    // The purchase was made for THIS account (appAccountToken set at purchase time): a receipt
    // copied from someone else's device cannot be credited here.
    if (!t.appAccountToken || t.appAccountToken.toLowerCase() !== acc.id) throw new ShopError(403, 'not_your_receipt')
    if (t.expiresDate && t.expiresDate < this.now()) {
      // An expired subscription period: record nothing new.
      return { ...this.wallet(this.account(acc.id)), credited: false }
    }
    const r = this.credit(acc, { store: 'apple', txnId: String(t.transactionId), originalId: String(t.originalTransactionId ?? ''), productId: t.productId, env: t.environment, expires: t.expiresDate })
    return { ...this.wallet(this.account(acc.id)), ...r }
  }

  async googlePurchase(acc, { productId, purchaseToken }) {
    if (!this.google?.configured) throw new ShopError(503, 'play_not_configured')
    if (!ID.test(productId ?? '') || typeof purchaseToken !== 'string' || purchaseToken.length > 4096) throw new ShopError(400, 'bad_request')
    const p = this.cat.products[productId]
    if (!p) throw new ShopError(400, 'unknown_product')
    const v = p.kind === 'pass' ? await this.google.verifySubscription(purchaseToken) : await this.google.verifyProduct(productId, purchaseToken)
    if (!v.ok) throw new ShopError(400, 'invalid_receipt', v.why)
    if (v.account !== acc.id) throw new ShopError(403, 'not_your_receipt')
    const r = this.credit(acc, { store: 'google', txnId: sha256(purchaseToken), originalId: v.orderId, productId, env: v.test ? 'Sandbox' : 'Production', expires: v.expires })
    return { ...this.wallet(this.account(acc.id)), ...r }
  }

  /** Test builds only (DEV_PURCHASES=1 on a non-production server). */
  devPurchase(acc, productId) {
    if (!this.devPurchases) throw new ShopError(404, 'not_found')
    const r = this.credit(acc, { store: 'dev', txnId: randomUUID(), productId, env: 'Dev', expires: this.cat.products[productId]?.kind === 'pass' ? this.now() + 30 * 86400_000 : undefined })
    return { ...this.wallet(this.account(acc.id)), ...r }
  }

  /** Recover an account on a new install from a verified non-consumable / subscription receipt. */
  recover(jws, ip) {
    let t
    try {
      t = verifyAppleJws(jws, { rootFingerprint: this.apple.rootFingerprint, skipOids: this.apple.skipOids })
    } catch {
      throw new ShopError(400, 'invalid_receipt')
    }
    if (t.bundleId !== this.apple.bundleId) throw new ShopError(400, 'wrong_app')
    const id = String(t.appAccountToken ?? '').toLowerCase()
    const acc = UUID.test(id) && this.account(id)
    if (!acc || acc.banned) throw new ShopError(404, 'no_account')
    const p = this.cat.products[t.productId]
    if (!p || p.consumable) throw new ShopError(400, 'not_restorable')
    const secret = randomBytes(32).toString('base64url')
    this.db.prepare('UPDATE accounts SET secret_hash = ? WHERE id = ?').run(sha256(secret), id)
    this.audit(id, ip, 'recover', { txn: t.transactionId })
    return { accountId: id, token: `${id}.${secret}` }
  }

  // ───────── Spending ─────────

  spend(acc, { item, idem, discount }) {
    const def = this.cat.spend[item]
    if (!def) throw new ShopError(400, 'unknown_item')
    if (typeof idem !== 'string' || !REF.test(idem)) throw new ShopError(400, 'bad_request')
    return tx(this.db, () => {
      const prev = this.db.prepare('SELECT response FROM idem WHERE account = ? AND key = ?').get(acc.id, idem)
      if (prev) return JSON.parse(prev.response)
      let price = def.price
      if (discount && item === 'physio') {
        if (this.count(acc.id, 'disc:physio') < 1) throw new ShopError(400, 'no_discount')
        this.bump(acc.id, 'disc:physio', -1)
        price = def.discounted
      }
      this.moveGems(acc.id, -price, `spend:${item}`, idem)
      const g = this.grant(acc.id, { ...def.grant, src: item })
      const out = { ...this.wallet(this.account(acc.id)), grant: g }
      this.db.prepare('INSERT INTO idem (account, key, response, at) VALUES (?, ?, ?, ?)').run(acc.id, idem, JSON.stringify(out), this.now())
      return out
    })
  }

  // ───────── Rewarded ads ─────────

  adStart(acc, offer) {
    const def = this.cat.ads[offer]
    if (!def) throw new ShopError(400, 'unknown_offer')
    if (this.count(acc.id, `ad:${offer}`) >= def.perDay) throw new ShopError(429, 'ad_cap')
    if (offer === 'season_x2' && this.count(acc.id, 'earn:season') < 1) throw new ShopError(400, 'no_season_reward')
    const nonce = randomBytes(16).toString('hex')
    this.db.prepare('INSERT INTO ads (nonce, account, offer, started) VALUES (?, ?, ?, ?)').run(nonce, acc.id, offer, this.now())
    // Pro Contract: the reward without the ad.
    return { nonce, skipAd: acc.pass_until > this.now() }
  }

  /** Google's SSV callback (already signature-checked): marks the ad session as really watched. */
  adSsv(fields) {
    const [accountId, nonce] = String(fields.custom_data ?? '').split(':')
    const r = this.db.prepare('UPDATE ads SET ssv = 1 WHERE nonce = ? AND account = ?').run(nonce ?? '', accountId ?? '')
    this.audit(accountId, null, 'ad_ssv', { nonce, ok: r.changes === 1, tx: fields.transaction_id })
    return r.changes === 1
  }

  adComplete(acc, nonce) {
    if (typeof nonce !== 'string' || !/^[0-9a-f]{32}$/.test(nonce)) throw new ShopError(400, 'bad_request')
    return tx(this.db, () => {
      const s = this.db.prepare('SELECT * FROM ads WHERE nonce = ? AND account = ?').get(nonce, acc.id)
      if (!s) throw new ShopError(404, 'no_ad_session')
      if (s.done) throw new ShopError(409, 'already_rewarded')
      const pass = acc.pass_until > this.now()
      if (!pass && this.requireSsv && !s.ssv) throw new ShopError(425, 'ad_not_verified')
      if (!pass && !this.requireSsv && this.now() - s.started < 5000) throw new ShopError(425, 'ad_too_short')
      if (this.now() - s.started > 30 * 60_000) throw new ShopError(410, 'ad_expired')
      const def = this.cat.ads[s.offer]
      if (this.count(acc.id, `ad:${s.offer}`) >= def.perDay) throw new ShopError(429, 'ad_cap')
      this.db.prepare('UPDATE ads SET done = 1 WHERE nonce = ?').run(nonce)
      this.bump(acc.id, `ad:${s.offer}`)
      let grant = null
      if (def.reward.gems) this.moveGems(acc.id, def.reward.gems, `ad:${s.offer}`, nonce)
      if (s.offer === 'season_x2') this.moveGems(acc.id, this.cat.earn.season.gems, 'ad:season_x2', nonce)
      if (def.reward.grant) grant = this.grant(acc.id, { ...def.reward.grant, src: `ad:${s.offer}` })
      if (def.reward.discount === 'physio') this.bump(acc.id, 'disc:physio')
      return { ...this.wallet(this.account(acc.id)), grant }
    })
  }

  // ───────── Free diamonds (earned in the career) ─────────

  /**
   * The career runs on the device, so the server cannot prove a Man of the Match happened: free
   * diamonds are therefore deduplicated by reference and hard-capped per source and per day, which
   * bounds what a modified client can farm to a small, free-player amount.
   */
  earn(acc, { source, ref }) {
    const def = this.cat.earn[source]
    if (!def) throw new ShopError(400, 'unknown_source')
    if (typeof ref !== 'string' || !REF.test(ref)) throw new ShopError(400, 'bad_request')
    return tx(this.db, () => {
      const dup = this.db.prepare('INSERT OR IGNORE INTO earn_refs (account, ref) VALUES (?, ?)').run(acc.id, `${source}:${ref}`).changes === 0
      if (dup) return { ...this.wallet(this.account(acc.id)), earned: 0 }
      const capped = this.count(acc.id, `earn:${source}`) >= def.perDay || this.count(acc.id, 'earn:total') + def.gems > this.cat.limits.earnPerDay
      if (capped) return { ...this.wallet(this.account(acc.id)), earned: 0, capped: true }
      this.bump(acc.id, `earn:${source}`)
      this.bump(acc.id, 'earn:total', def.gems)
      this.moveGems(acc.id, def.gems, `earn:${source}`, ref)
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

  // ───────── Refunds / revocations (App Store Server Notifications v2) ─────────

  appleNotification(signedPayload) {
    const opts = { rootFingerprint: this.apple.rootFingerprint, skipOids: this.apple.skipOids }
    const n = verifyAppleJws(signedPayload, opts)
    const info = n.data?.signedTransactionInfo ? verifyAppleJws(n.data.signedTransactionInfo, opts) : null
    if (!info) return { handled: false }
    if (n.data?.bundleId && n.data.bundleId !== this.apple.bundleId) return { handled: false }
    const row = this.db.prepare("SELECT * FROM txns WHERE store = 'apple' AND txn_id = ?").get(String(info.transactionId))
    if (n.notificationType === 'REFUND' || n.notificationType === 'REVOKE') {
      if (!row || row.revoked) return { handled: false }
      return tx(this.db, () => {
        this.db.prepare("UPDATE txns SET revoked = 1 WHERE store = 'apple' AND txn_id = ?").run(row.txn_id)
        const p = this.cat.products[row.product]
        if (p?.kind === 'gems' || p?.kind === 'starter') this.moveGems(row.account, -p.gems, 'refund', `apple:${row.txn_id}`)
        if (p?.kind === 'starter') this.db.prepare('UPDATE accounts SET starter = 0 WHERE id = ?').run(row.account)
        if (p?.kind === 'pass') this.db.prepare('UPDATE accounts SET pass_until = 0 WHERE id = ?').run(row.account)
        if (p && !p.consumable) this.db.prepare('DELETE FROM entitlements WHERE account = ? AND product = ?').run(row.account, row.product)
        this.audit(row.account, null, 'refund', { txn: row.txn_id, product: row.product })
        return { handled: true }
      })
    }
    if (['DID_RENEW', 'SUBSCRIBED'].includes(n.notificationType) && info.expiresDate) {
      const id = String(info.appAccountToken ?? '').toLowerCase()
      if (UUID.test(id) && this.account(id)) this.db.prepare('UPDATE accounts SET pass_until = MAX(pass_until, ?) WHERE id = ?').run(info.expiresDate, id)
      return { handled: true }
    }
    if (['EXPIRED', 'GRACE_PERIOD_EXPIRED'].includes(n.notificationType)) {
      const id = String(info.appAccountToken ?? '').toLowerCase()
      if (UUID.test(id)) this.db.prepare('UPDATE accounts SET pass_until = MIN(pass_until, ?) WHERE id = ?').run(this.now(), id)
      return { handled: true }
    }
    return { handled: false }
  }
}
