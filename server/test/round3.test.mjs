// Review round 3 fixes (ids from the review: M1, M5, m1 … m44).
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createPublicKey, generateKeyPairSync, verify } from 'node:crypto'
import { catalog, fakeGoogle, makeChain, makeShop, note, signJws, txn } from './helpers.mjs'
import { PRUNE_CHUNK, ShopError, keyId } from '../src/shop.mjs'
import { GooglePlay } from '../src/google.mjs'
import { openDb } from '../src/db.mjs'
import { createApp } from '../src/http.mjs'

const chain = makeChain()
const DAY = 86400_000
const MIN = 60_000
const MAIN = fileURLToPath(new URL('../src/main.mjs', import.meta.url))

function setup(over) {
  const s = makeShop(chain, over)
  const reg = s.shop.register('1.1.1.1', 'ios')
  const acc = s.shop.auth(`Bearer ${reg.token}`)
  return { ...s, reg, acc }
}
const code = (fn) => {
  try {
    fn()
  } catch (e) {
    if (e instanceof ShopError) return e.code
    throw e
  }
  return 'ok'
}
const acode = async (p) => {
  try {
    await p
  } catch (e) {
    if (e instanceof ShopError) return `${e.status} ${e.code}`
    throw e
  }
  return 'ok'
}
const buy = (shop, acc, productId, over = {}) => shop.applePurchase(acc, signJws(chain, txn(acc.id, { productId, ...over })))
const newAcc = (shop, ip = '9.9.9.9') => shop.auth(`Bearer ${shop.register(ip).token}`)
const count = (db, sql, ...a) => db.prepare(sql).get(...a).n
const audits = (db, event) => count(db, 'SELECT COUNT(*) AS n FROM audit WHERE event = ?', event)
const payloadOf = (token) => JSON.parse(Buffer.from(token.split('.')[0], 'base64url'))
const secsToMidnight = (now) => Math.ceil((Date.parse(new Date(now).toISOString().slice(0, 10) + 'T00:00:00Z') + DAY - now) / 1000)
const subTxn = (accId, over = {}) => txn(accId, { productId: 'pro_contract', type: 'Auto-Renewable Subscription', expiresDate: Date.now() + 30 * DAY, ...over })

/** A real GooglePlay client whose HTTP answers come from `answer(url)` ({status, body} or a thrown error). */
function playWith(answer) {
  const gp = new GooglePlay({ packageName: 'app.starpath.football', fetchImpl: async (url) => {
    const a = await answer(String(url))
    return new Response(JSON.stringify(a.body ?? {}), { status: a.status })
  } })
  gp.sa = { client_email: 'x' }
  gp.token = { value: 'tok', exp: Date.now() + 3600_000 }
  return gp
}

// ───────── M1: transient Play failures are 503, only a definitive answer is invalid_receipt ─────────

test('M1: GooglePlay marks 5xx / 429 / 401 / 403 / transport failures transient, 404 as not found', async () => {
  for (const status of [500, 503, 429, 401, 403]) {
    const v = await playWith(() => ({ status })).verifyProduct('gems_m', 't')
    assert.deepEqual([v.ok, v.transient], [false, true], String(status))
  }
  const nf = await playWith(() => ({ status: 404 })).verifyProduct('gems_m', 't')
  assert.deepEqual([nf.transient, nf.notFound], [false, true])
  const bad = await playWith(() => ({ status: 400 })).verifySubscription('t')
  assert.deepEqual([bad.transient, bad.notFound], [false, false])
  const net = await playWith(() => { throw new TypeError('fetch failed') }).verifyProduct('gems_m', 't')
  assert.deepEqual([net.ok, net.transient], [false, true])
  // The OAuth token endpoint failing is transport too (no usable key here).
  const gp = new GooglePlay({ packageName: 'p', fetchImpl: async () => new Response('', { status: 500 }) })
  gp.sa = { client_email: 'x', private_key: 'not a key' }
  assert.equal((await gp.verifyProduct('gems_m', 't')).transient, true)
  const pend = await playWith(() => ({ status: 200, body: { purchaseState: 2 } })).verifyProduct('gems_m', 't')
  assert.deepEqual([pend.ok, pend.pending], [false, true])
})

test('M1: purchase maps Play failures to 503 play_unavailable; 404 only right after the purchase', async () => {
  const { shop, acc, clock } = setup()
  let answer = { status: 503 }
  shop.google = playWith(() => answer)
  const p = (purchaseTime) => acode(shop.googlePurchase(acc, { productId: 'gems_m', purchaseToken: 'tk', purchaseTime }))
  for (const status of [500, 503, 429, 401, 403]) {
    answer = { status }
    assert.equal(await p(), '503 play_unavailable', String(status))
  }
  answer = { status: 404 }
  assert.equal(await p(clock.now() - 2 * MIN), '503 play_unavailable', 'fresh purchase: Play may not know it yet')
  assert.equal(await p(clock.now() - 11 * MIN), '400 invalid_receipt')
  assert.equal(await p(), '400 invalid_receipt', 'no purchase time: definitive')
  answer = { status: 200, body: { purchaseState: 1, obfuscatedExternalAccountId: acc.id } }
  assert.equal(await p(clock.now()), '400 invalid_receipt', 'cancelled is definitive')
  answer = { status: 200, body: { purchaseState: 2, obfuscatedExternalAccountId: acc.id } }
  assert.equal(await p(), '409 purchase_pending')
  // A client that throws (SDK bug, network) is transient too.
  shop.google = { configured: true, verifyProduct: async () => { throw new Error('boom') } }
  assert.equal(await p(), '503 play_unavailable')
  assert.equal(shop.wallet(acc).gems, 0)
})

// ───────── M5: the per-address ceiling holds only young accounts ─────────

test('M5: per-address ceiling applies to accounts younger than 7 days; ip_cap is audited once a day', () => {
  const { shop, clock, db } = makeShop(chain)
  const old = newAcc(shop)
  clock.advance(8 * DAY)
  const ip = '7.7.7.7'
  // An established account earns without touching (or being held by) the address total.
  assert.equal(shop.earn(old, { source: 'season', ref: 's1' }, ip).earned, 100)
  assert.equal(shop.ipCount(shop.ipBucket(ip)), 0)
  const young = Array.from({ length: 7 }, () => newAcc(shop))
  for (let i = 0; i < 6; i++) assert.equal(shop.earn(young[i], { source: 'season', ref: 's1' }, ip).earned, 100)
  const r = shop.earn(young[6], { source: 'season', ref: 's1' }, ip)
  assert.deepEqual([r.earned, r.capped, r.reason, r.retryAfter], [0, true, 'ip', secsToMidnight(clock.now())])
  shop.earn(young[6], { source: 'award', ref: 'a' }, ip)
  assert.equal(code(() => shop.adStart(young[6], 'gems', undefined, ip)), 'ad_cap')
  assert.equal(audits(db, 'ip_cap'), 1, 'one row per account and day')
  assert.equal(shop.earn(old, { source: 'award', ref: 'a' }, ip).earned, 25, 'older accounts are not starved behind the same NAT')
  assert.equal(code(() => shop.adStart(old, 'gems', undefined, ip)), 'ok')
  // The limits are configurable.
  assert.equal(catalog.limits.ipCapAccountAgeDays, 7)
  clock.advance(7 * DAY)
  assert.equal(shop.ipLimited(young[0]), false)
})

// ───────── m1: consume / acknowledge retried from a timer ─────────

test('m1: a failed consume keeps the purchase in finalize_pending until a retry finishes it', async () => {
  const { shop, acc, db, clock } = setup()
  const g = fakeGoogle({ f1: { orderId: 'GPA.f1', account: acc.id }, f2: { orderId: 'GPA.f2', account: acc.id }, f3: { orderId: 'GPA.f3', account: acc.id } })
  shop.google = g
  g.finishStatus = 503
  const r = await shop.googlePurchase(acc, { productId: 'gems_m', purchaseToken: 'f1' })
  assert.deepEqual([r.credited, r.finalized, r.gems], [true, false, 600])
  assert.equal(count(db, 'SELECT COUNT(*) AS n FROM finalize_pending'), 1)
  assert.deepEqual(await shop.retryFinalize(), { done: 0, failed: 1, dropped: 0 })
  g.finishStatus = 204
  assert.deepEqual(await shop.retryFinalize(), { done: 1, failed: 0, dropped: 0 })
  assert.equal(count(db, 'SELECT COUNT(*) AS n FROM finalize_pending'), 0)
  assert.equal(shop.wallet(acc).gems, 600, 'credited once, stays credited')
  // The app re-sending the purchase also finishes it (and clears the row).
  g.finishStatus = 503
  await shop.googlePurchase(acc, { productId: 'gems_s', purchaseToken: 'f2' })
  g.finishStatus = 204
  const again = await shop.googlePurchase(acc, { productId: 'gems_s', purchaseToken: 'f2' })
  assert.deepEqual([again.credited, again.finalized], [false, true])
  assert.equal(count(db, 'SELECT COUNT(*) AS n FROM finalize_pending'), 0)
  // Cancelled on Play meanwhile: dropped; still failing after 7 days: given up. Both audited.
  g.finishStatus = 503
  await shop.googlePurchase(acc, { productId: 'gems_s', purchaseToken: 'f3' })
  g.purchases.f3.cancelled = true
  assert.equal((await shop.retryFinalize()).dropped, 1)
  assert.equal(audits(db, 'finalize_dropped'), 1)
  g.purchases.f3.cancelled = false
  db.prepare("INSERT INTO finalize_pending (token_hash, token, product, account, at) VALUES ('h', 'f3', 'gems_s', ?, ?)").run(acc.id, clock.now())
  clock.advance(8 * DAY)
  assert.equal((await shop.retryFinalize()).dropped, 1)
  assert.equal(audits(db, 'finalize_gave_up'), 1)
})

// ───────── m3: Pro daily diamonds of a refunded period ─────────

test('m3: Pro daily diamonds claimed in a refunded period are clawed back (and returned on reversal)', () => {
  const { shop, acc, clock, db } = setup()
  const t = subTxn(acc.id)
  assert.equal(shop.applePurchase(acc, signJws(chain, t)).pass.active, true)
  shop.passClaim(acc)
  clock.advance(DAY)
  assert.equal(shop.passClaim(acc).gems, 40)
  assert.equal(count(db, "SELECT COUNT(*) AS n FROM ledger WHERE why = 'pass:daily' AND ref LIKE ?", `apple:${t.transactionId}@%`), 2)
  shop.appleNotification(note(chain, 'REFUND', t))
  const w = shop.wallet(acc)
  assert.deepEqual([w.gems, w.pass.active], [0, false])
  shop.appleNotification(note(chain, 'REFUND_REVERSED', t, { signedDate: t.signedDate + 1000 }))
  assert.deepEqual([shop.wallet(acc).gems, shop.wallet(acc).pass.active], [40, true])
})

// ───────── m4: refund hold lifts after 90 days ─────────

test('m4: a refund-count hold lifts 90 days after the last refund; cash packs stay on sale under hold', () => {
  const { shop, acc, clock } = setup()
  for (let i = 0; i < 3; i++) {
    buy(shop, acc, 'gems_m')
    const t = txn(acc.id, { productId: 'gems_s' })
    shop.applePurchase(acc, signJws(chain, t))
    shop.appleNotification(note(chain, 'REFUND', t))
  }
  const w = shop.wallet(acc)
  assert.equal(w.refundHold, true)
  assert.equal(w.refundHoldUntil, clock.now() + 90 * DAY)
  assert.equal(code(() => shop.spend(acc, { item: 'gems_to_cash', idem: 'g1' })), 'refund_hold')
  assert.equal(buy(shop, acc, 'cash_s').credited, true)
  assert.ok(shop.wallet(acc).inbox.some((g) => g.k === 'cash'), 'the cash pack grant is issued')
  clock.advance(90 * DAY)
  const w2 = shop.wallet(acc)
  assert.deepEqual([w2.refundHold, w2.refundHoldUntil], [false, null])
  assert.equal(code(() => shop.spend(acc, { item: 'compression', idem: 's1' })), 'ok')
  // Another refund: back on hold.
  const t = txn(acc.id, { productId: 'gems_s' })
  shop.applePurchase(acc, signJws(chain, t))
  shop.appleNotification(note(chain, 'REFUND', t))
  assert.equal(shop.wallet(acc).refundHold, true)
  // A hold from before the last-refund time was recorded stays until the next refund.
  shop.setCounter(acc.id, 'refund:last', 0)
  clock.advance(200 * DAY)
  assert.equal(shop.wallet(acc).refundHold, true)
})

// ───────── m5: SSV callback checks ─────────

test('m5: SSV refuses unknown ad units, stale timestamps and replayed transaction ids', () => {
  const { shop, acc, clock, db } = setup({ ads: { requireSsv: true, adUnits: ['ca-app-pub-1/111'] } })
  const { nonce } = shop.adStart(acc, 'gems')
  const f = (over) => ({ custom_data: `${acc.id}:${nonce}`, ad_unit: 'ca-app-pub-1/111', transaction_id: 'tx1', timestamp: String(clock.now()), ...over })
  assert.equal(shop.adSsv(f({ ad_unit: 'ca-app-pub-1/999' })), false)
  assert.equal(shop.adSsv(f({ timestamp: String(clock.now() - 2 * 3600_000) })), false)
  assert.equal(shop.adSsv(f({ transaction_id: '' })), false)
  assert.equal(shop.adSsv(f()), true)
  assert.equal(shop.adSsv(f()), false, 'a replayed transaction id')
  assert.equal(audits(db, 'ad_ssv_rejected'), 4)
  clock.advance(1000)
  assert.equal(shop.adComplete(acc, nonce).gems, 10)
  // Without ADMOB_AD_UNITS any unit is accepted.
  const s2 = setup({ ads: { requireSsv: true } })
  const n2 = s2.shop.adStart(s2.acc, 'gems').nonce
  assert.equal(s2.shop.adSsv({ custom_data: `${s2.acc.id}:${n2}`, ad_unit: 'any', transaction_id: 't', timestamp: String(s2.clock.now()) }), true)
})

// ───────── m7: refusal audits survive the rollback ─────────

test('m7: the receipt_reuse audit row is kept although the credit rolls back', () => {
  const { shop, acc, db } = setup()
  const other = newAcc(shop)
  shop.credit(acc, { store: 'dev', txnId: 'same', productId: 'gems_s', env: 'Dev' })
  assert.equal(code(() => shop.credit(other, { store: 'dev', txnId: 'same', productId: 'gems_s', env: 'Dev' })), 'receipt_used')
  const row = db.prepare("SELECT account, detail FROM audit WHERE event = 'receipt_reuse'").get()
  assert.equal(row.account, other.id)
  assert.equal(JSON.parse(row.detail).owner, acc.id)
})

// ───────── m8: notification ordering and RTDN re-checks ─────────

test('m8: an Apple refund signed before the last applied reversal is ignored', () => {
  const { shop, acc } = setup()
  const t = txn(acc.id, { productId: 'gems_m' })
  shop.applePurchase(acc, signJws(chain, t))
  // Delivered out of order: the reversal (signed later) arrives first and finds nothing to reverse.
  shop.appleNotification(note(chain, 'REFUND', t, { signedDate: t.signedDate + 1000, notificationUUID: 'a' }))
  shop.appleNotification(note(chain, 'REFUND_REVERSED', t, { signedDate: t.signedDate + 2000, notificationUUID: 'b' }))
  assert.equal(shop.wallet(acc).gems, 600)
  const stale = shop.appleNotification(note(chain, 'REFUND', t, { signedDate: t.signedDate + 1500, notificationUUID: 'c' }))
  assert.deepEqual([stale.handled, stale.stale], [false, true])
  assert.equal(shop.wallet(acc).gems, 600, 'the older refund does not take the diamonds again')
})

test('m8: RTDN void / cancel / revoke act only when Play confirms; Play down is a 503 (Pub/Sub retries)', async () => {
  const { shop, acc, db } = setup()
  const g = fakeGoogle({
    v1: { orderId: 'GPA.v1', account: acc.id },
    s1: { sub: true, productId: 'pro_contract', orderId: 'GPA.s1', account: acc.id, expires: Date.now() + 30 * DAY },
  })
  shop.google = g
  await shop.googlePurchase(acc, { productId: 'gems_m', purchaseToken: 'v1' })
  await shop.googlePurchase(acc, { productId: 'pro_contract', purchaseToken: 's1' })
  const msg = (o) => ({ packageName: 'app.starpath.football', eventTimeMillis: String(Date.now()), ...o })
  const voided = msg({ voidedPurchaseNotification: { purchaseToken: 'v1', orderId: 'GPA.v1', productType: 2 } })
  assert.deepEqual(await shop.googleRtdn(voided), { handled: false, why: 'not_confirmed' })
  assert.deepEqual(await shop.googleRtdn(msg({ oneTimeProductNotification: { notificationType: 2, purchaseToken: 'v1', sku: 'gems_m' } })), { handled: false, why: 'not_confirmed' })
  assert.deepEqual(await shop.googleRtdn(msg({ subscriptionNotification: { notificationType: 12, purchaseToken: 's1', subscriptionId: 'pro_contract' } })), { handled: false, why: 'not_confirmed' })
  assert.deepEqual([shop.wallet(acc).gems, shop.wallet(acc).pass.active], [600, true])
  assert.equal(audits(db, 'rtdn_unconfirmed'), 3)
  const isVoided = g.isVoided
  g.isVoided = async () => { throw new Error('play down') }
  assert.equal(await acode(shop.googleRtdn(voided)), '503 play_unavailable')
  g.isVoided = isVoided
  g.voided.push({ purchaseToken: 'v1' })
  assert.equal((await shop.googleRtdn(voided)).handled, true)
  assert.equal(shop.wallet(acc).gems, 0)
  const since = g.calls.filter((c) => c[0] === 'isVoided').at(-1)[2]
  assert.ok(since >= Date.now() - DAY - 5000 && since <= Date.now() - DAY + 5000, 'looks back one day from the event time')
})

// ───────── m9: SANDBOX_UNTIL ─────────

test('m9: past SANDBOX_UNTIL the capped and testers policies behave as off', () => {
  for (const policy of ['capped', 'testers']) {
    const { shop, acc, clock } = setup({ sandbox: { policy, testers: [], until: Date.now() + DAY } })
    if (policy === 'testers') shop.sandbox.testers.add(acc.id)
    assert.equal(buy(shop, acc, 'gems_s').credited, true, policy)
    assert.equal(shop.health().sandbox, policy)
    clock.advance(2 * DAY)
    assert.equal(code(() => buy(shop, acc, 'gems_s')), 'sandbox_receipt', policy)
    assert.equal(shop.health().sandbox, 'off')
    assert.equal(buy(shop, acc, 'gems_s', { environment: 'Production' }).credited, true)
  }
  const on = setup({ sandbox: { policy: 'on', until: Date.now() - DAY } })
  assert.equal(on.shop.sandboxPolicy(), 'on', "'on' (development) is not time-limited")
})

// ───────── m10: Family Sharing ─────────

test('m10: family-shared transactions unlock cosmetics and Pro, never diamonds, cash or the Starter Pack', () => {
  const { shop, acc } = setup()
  const fam = { inAppOwnershipType: 'FAMILY_SHARED' }
  for (const p of ['gems_m', 'cash_s', 'starter_pack']) assert.equal(code(() => buy(shop, acc, p, fam)), 'family_shared', p)
  assert.equal(shop.wallet(acc).gems, 0)
  assert.equal(buy(shop, acc, 'pack_avatar', fam).credited, true)
  assert.equal(shop.applePurchase(acc, signJws(chain, subTxn(acc.id, fam))).pass.active, true)
  assert.equal(buy(shop, acc, 'gems_s', { inAppOwnershipType: 'PURCHASED' }).credited, true)
  // Recovery from a family-shared Starter Pack receipt is refused as well.
  const t = txn(acc.id, { productId: 'starter_pack' })
  shop.applePurchase(acc, signJws(chain, t))
  assert.equal(code(() => shop.recover(signJws(chain, { ...t, ...fam }), 'ip')), 'family_shared')
})

// ───────── m11: void needs a 15-minute-old grant ─────────

test('m11: a spend grant can be voided only 15 minutes after it was issued (425 too_early)', () => {
  const { shop, acc, clock } = setup()
  buy(shop, acc, 'gems_m')
  const g = shop.spend(acc, { item: 'compression', idem: 'v' }).grant
  let err
  try { shop.voidGrant(acc, g.nonce) } catch (e) { err = e }
  assert.deepEqual([err.status, err.code], [425, 'too_early'])
  clock.advance(14 * MIN)
  assert.equal(code(() => shop.voidGrant(acc, g.nonce)), 'too_early')
  clock.advance(MIN)
  assert.equal(shop.voidGrant(acc, g.nonce).refunded, 80)
})

// ───────── m12: entitlements reference-counted by source ─────────

test('m12: a cosmetic owned by purchase and by diamonds survives the refund or void of one source', () => {
  const { shop, acc, clock, db } = setup()
  buy(shop, acc, 'gems_m')
  const g = shop.spend(acc, { item: 'cos_avatar', idem: 'c1' }).grant
  const t = txn(acc.id, { productId: 'pack_avatar' })
  shop.applePurchase(acc, signJws(chain, t))
  assert.equal(count(db, "SELECT COUNT(*) AS n FROM entitlement_sources WHERE account = ? AND product = 'pack_avatar'", acc.id), 2)
  shop.appleNotification(note(chain, 'REFUND', t))
  assert.ok(shop.wallet(acc).entitlements.includes('pack_avatar'), 'still owned via diamonds')
  clock.advance(15 * MIN)
  assert.ok(!shop.voidGrant(acc, g.nonce).entitlements.includes('pack_avatar'), 'no source left')
  // The other order: void first, the purchase still owns it, then the reversal of the refund adds it back.
  const g2 = shop.spend(acc, { item: 'cos_celebrations', idem: 'c2' }).grant
  buy(shop, acc, 'pack_celebrations')
  clock.advance(15 * MIN)
  assert.ok(shop.voidGrant(acc, g2.nonce).entitlements.includes('pack_celebrations'))
  shop.appleNotification(note(chain, 'REFUND_REVERSED', t, { signedDate: t.signedDate + 1000 }))
  assert.ok(shop.wallet(acc).entitlements.includes('pack_avatar'))
})

test('m12: existing entitlements get sources on migration (purchase, grant, else legacy)', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'sp-m12-')), 'shop.db')
  let db = openDb(file)
  const ins = (sql, ...a) => db.prepare(sql).run(...a)
  ins("INSERT INTO accounts (id, secret_hash, created) VALUES ('a', '', 0)")
  ins("INSERT INTO entitlements (account, product, at) VALUES ('a', 'pack_avatar', 1), ('a', 'pack_celebrations', 1), ('a', 'starter_pack', 1)")
  ins("INSERT INTO txns (store, txn_id, account, product, at) VALUES ('apple', 'T1', 'a', 'pack_avatar', 1)")
  ins("INSERT INTO grants (nonce, account, payload, token, at, acked) VALUES ('N1', 'a', ?, 'x', 1, 1)", JSON.stringify({ k: 'cosmetic', id: 'pack_celebrations' }))
  db.exec('DELETE FROM entitlement_sources')
  db.close()
  db = openDb(file)
  const src = Object.fromEntries(db.prepare("SELECT product, source FROM entitlement_sources WHERE account = 'a'").all().map((r) => [r.product, r.source]))
  assert.deepEqual(src, { pack_avatar: 'txn:apple:T1', pack_celebrations: 'grant:N1', starter_pack: 'legacy' })
  db.close()
})

// ───────── m6: re-sign old open grants ─────────

test('m6: inbox refresh re-signs open grants older than 60 days (same nonce, new time, current key)', () => {
  const { shop, acc, clock, publicKey, db } = setup()
  buy(shop, acc, 'gems_m')
  const old = shop.spend(acc, { item: 'compression', idem: 'o' }).grant
  const applied = shop.spend(acc, { item: 'compression', idem: 'a' }).grant
  shop.ack(acc, [applied.nonce])
  clock.advance(61 * DAY)
  const young = shop.spend(acc, { item: 'compression', idem: 'y' }).grant
  const r = shop.refreshInbox(acc)
  assert.equal(r.refreshed, 1)
  const fresh = r.inbox.find((g) => g.nonce === old.nonce)
  assert.equal(fresh.t, clock.now())
  assert.notEqual(fresh.token, old.token)
  const [b, sig] = fresh.token.split('.')
  assert.ok(verify(null, Buffer.from(b), publicKey, Buffer.from(sig, 'base64url')))
  assert.deepEqual([payloadOf(fresh.token).n, payloadOf(fresh.token).k, payloadOf(fresh.token).kid], [old.nonce, 'gear', shop.kid])
  assert.equal(r.inbox.find((g) => g.nonce === young.nonce).token, young.token, 'younger grants untouched')
  assert.equal(shop.refreshInbox(acc).refreshed, 0)
  assert.equal(audits(db, 'grant_refresh'), 1)
  assert.equal(shop.ack(acc, [old.nonce]).inbox.some((g) => g.nonce === old.nonce), false, 'acks by the same nonce')
})

// ───────── m17: cap reached between start and complete ─────────

test('m17: an ad cap filled between start and complete is 409 ad_cap_reached (definitive)', () => {
  const { shop, acc, clock } = setup()
  const { nonce } = shop.adStart(acc, 'gems')
  shop.bump(acc.id, 'ad:gems', shop.adCap(acc, 'gems'))
  clock.advance(6000)
  let err
  try { shop.adComplete(acc, nonce) } catch (e) { err = e }
  assert.deepEqual([err.status, err.code], [409, 'ad_cap_reached'])
})

// ───────── m28: registration budget alert and audit retention ─────────

test('m28: a daily registration budget alert; register audit rows kept 30 days', () => {
  const cat = structuredClone(catalog)
  cat.limits.regDailyAlert = 2
  const logs = []
  const { shop, clock, db } = makeShop(chain, { catalog: cat, log: (...a) => logs.push(a.join(' ')) })
  const accs = Array.from({ length: 4 }, () => newAcc(shop))
  assert.equal(audits(db, 'register_budget'), 1)
  assert.ok(logs.some((l) => l.startsWith('register_budget')))
  shop.recoveryCode(accs[0], '2.2.2.2')
  buy(shop, accs[0], 'gems_s') // keeps the account through the empty-account prune
  clock.advance(31 * DAY)
  shop.prune()
  assert.equal(audits(db, 'register'), 0)
  assert.equal(audits(db, 'recovery_code'), 1, 'other audit rows stay 180 days')
})

// ───────── m29: grant key rotation ─────────

test('m29: grants carry the key id; old keys stay published with their kid', () => {
  const old = generateKeyPairSync('ed25519').privateKey
  const { shop, acc } = setup({ verifyKeys: [old] })
  assert.equal(shop.publicKeys.length, 2)
  assert.equal(shop.publicKeys[0].kid, shop.kid)
  assert.equal(shop.publicKeys[1].kid, keyId(old))
  assert.match(shop.kid, /^[0-9a-f]{8}$/)
  buy(shop, acc, 'gems_m')
  const g = shop.spend(acc, { item: 'compression', idem: 'k' }).grant
  assert.equal(payloadOf(g.token).kid, shop.kid)
  // The published raw key verifies the grant.
  const raw = shop.publicKeys[0].key
  assert.equal(Buffer.from(raw, 'base64').length, 32)
  const pub = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: Buffer.from(raw, 'base64').toString('base64url') }, format: 'jwk' })
  const [b, sig] = g.token.split('.')
  assert.ok(verify(null, Buffer.from(b), pub, Buffer.from(sig, 'base64url')))
})

test('m29/m9: main loads GRANT_KEY_FILES (first signs) and logs the sandbox end', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sp-keys-'))
  const run = (env) => spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', MAIN], { env: { ...process.env, DATA_DIR: dir, ...env }, encoding: 'utf8', timeout: 10_000 })
  const missing = run({ GRANT_KEY_FILES: join(dir, 'nope.pem'), PORT: '0' })
  assert.equal(missing.status, 1)
  assert.match(missing.stderr, /GRANT_KEY_FILES: .*nope\.pem is missing/)
  const keys = [generateKeyPairSync('ed25519').privateKey, generateKeyPairSync('ed25519').privateKey]
  keys.forEach((k, i) => writeFileSync(join(dir, `k${i}.pem`), k.export({ type: 'pkcs8', format: 'pem' })))
  const bad = run({ GRANT_KEY_FILES: `${join(dir, 'k0.pem')},${join(dir, 'k1.pem')}`, SANDBOX_POLICY: 'capped', SANDBOX_UNTIL: 'soon', PORT: '0' })
  assert.equal(bad.status, 1)
  assert.match(bad.stderr, new RegExp(`grant keys signing kid=${keyId(keys[0])} also published: ${keyId(keys[1])}`))
  assert.match(bad.stderr, /SANDBOX_UNTIL must be an ISO date/)
  // A bad port stops it right after the startup log.
  const ended = run({ GRANT_KEY_FILES: join(dir, 'k0.pem'), SANDBOX_POLICY: 'capped', SANDBOX_UNTIL: '2020-01-01T00:00:00Z', PORT: '-1' })
  assert.match(ended.stderr, /policy capped ended at 2020-01-01T00:00:00\.000Z: behaving as off/)
})

// ───────── m30: chunked prune ─────────

test('m30: prune works in chunks and yields to the event loop between them', async () => {
  const { shop, db, clock } = makeShop(chain)
  const fill = (n) => {
    db.exec('BEGIN')
    const st = db.prepare('INSERT INTO idem (account, key, response, at) VALUES (?, ?, ?, ?)')
    for (let i = 0; i < n; i++) st.run('x', `k${Math.random()}`, '{}', clock.now())
    db.exec('COMMIT')
  }
  fill(2 * PRUNE_CHUNK + 500)
  clock.advance(31 * DAY)
  const it = shop.pruneSteps()
  let yields = 0
  let x
  while (!(x = it.next()).done) yields++
  assert.equal(x.value.idem, 2 * PRUNE_CHUNK + 500)
  assert.ok(yields >= 2, String(yields))
  fill(PRUNE_CHUNK + 1)
  clock.advance(31 * DAY)
  let ran = false
  setImmediate(() => { ran = true })
  const r = await shop.pruneAsync()
  assert.equal(r.idem, PRUNE_CHUNK + 1)
  assert.equal(ran, true, 'other work ran while pruning')
})

// ───────── m32 / m44: earn caps say when to retry; achievements have a lifetime ceiling ─────────

test('m32: a daily-capped claim carries retryAfter (seconds to the next UTC day)', () => {
  const { shop, acc, clock } = setup()
  for (let i = 0; i < 5; i++) shop.earn(acc, { source: 'motm', ref: `m${i}` })
  const r = shop.earn(acc, { source: 'motm', ref: 'm9' })
  assert.deepEqual([r.capped, r.reason, r.retryAfter], [true, 'source', secsToMidnight(clock.now())])
  assert.ok(r.retryAfter > 0 && r.retryAfter <= 86400)
  // One source at its cap does not hold the others (round 4 m10).
  assert.equal(shop.earn(acc, { source: 'objective', ref: 'o1' }).capped, undefined)
})

test('m44: achievement diamonds (first) stop at 600 per account, lifetime', () => {
  const { shop, acc, clock } = setup()
  assert.equal(catalog.earn.first.lifetime, 600)
  clock.advance(DAY)
  shop.setCounter(acc.id, 'earn:life:first', 590)
  assert.equal(shop.earn(acc, { source: 'first', ref: 'f1' }).earned, 10)
  const r = shop.earn(acc, { source: 'first', ref: 'f2' })
  assert.deepEqual([r.earned, r.capped, r.reason, r.retryAfter], [0, true, 'lifetime', undefined])
  clock.advance(DAY)
  assert.equal(shop.earn(acc, { source: 'first', ref: 'f2' }).reason, 'lifetime')
  assert.equal(shop.earn(acc, { source: 'award', ref: 'a' }).earned, 25, 'other sources unaffected')
})

// ───────── HTTP: new routes and codes ─────────

const H = makeShop(chain)
const server = createApp({ shop: H.shop, admob: null, origins: [], trustProxy: true, limits: { regPerMin: 100, regBurst: 100 } })
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}`
after(() => server.close())
const call = async (method, path, { body, token } = {}) => {
  const r = await fetch(base + path, { method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined })
  return { status: r.status, body: await r.json().catch(() => null) }
}

test('http: GET /v1/keys (no auth), POST /v1/inbox/refresh, 503 play_unavailable, 425 too_early', async () => {
  const keys = await call('GET', '/v1/keys')
  assert.equal(keys.status, 200)
  assert.equal(keys.body.kid, H.shop.kid)
  assert.deepEqual(keys.body.keys.map((k) => [k.kid, k.alg]), [[H.shop.kid, 'Ed25519']])
  const { token, accountId } = H.shop.register('t')
  const acc = H.shop.auth(`Bearer ${token}`)
  H.shop.applePurchase(acc, signJws(chain, txn(accountId, { productId: 'gems_m' })))
  const sp = await call('POST', '/v1/spend', { token, body: { item: 'compression', idem: 'r1' } })
  assert.deepEqual([(await call('POST', '/v1/inbox/void', { token, body: { nonce: sp.body.grant.nonce } })).status], [425])
  H.clock.advance(61 * DAY)
  const rf = await call('POST', '/v1/inbox/refresh', { token, body: {} })
  assert.deepEqual([rf.status, rf.body.refreshed], [200, 1])
  assert.equal((await call('POST', '/v1/inbox/refresh', { body: {} })).status, 401)
  H.shop.google = fakeGoogle({ down: { fail: 503 } })
  const g = await call('POST', '/v1/purchase/google', { token, body: { productId: 'gems_m', purchaseToken: 'down', purchaseTime: H.clock.now() } })
  assert.deepEqual([g.status, g.body.error], [503, 'play_unavailable'])
  const nf = await call('POST', '/v1/purchase/google', { token, body: { productId: 'gems_m', purchaseToken: 'unknown', purchaseTime: H.clock.now() - MIN } })
  assert.deepEqual([nf.status, nf.body.error], [503, 'play_unavailable'], 'purchaseTime reaches the shop')
})
