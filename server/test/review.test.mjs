// Review round 1 fixes (ids from the review: M2 … m14). One test or more per finding.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash, verify } from 'node:crypto'
import { fakeGoogle, makeChain, makeShop, note, signJws, txn } from './helpers.mjs'
import { ShopError } from '../src/shop.mjs'
import { verifyAppleJws } from '../src/apple.mjs'
import { certExtensions } from '../src/der.mjs'
import { RateLimiter, ipKey } from '../src/http.mjs'

const chain = makeChain()
const sha = (s) => createHash('sha256').update(s).digest('hex')
const DAY = 86400_000

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
    if (e instanceof ShopError) return e.code
    throw e
  }
  return 'ok'
}
const payloadOf = (token) => JSON.parse(Buffer.from(token.split('.')[0], 'base64url'))
const watch = (shop, clock, acc, offer, { ref, career } = {}) => {
  const { nonce } = shop.adStart(acc, offer, ref)
  clock.advance(6000)
  return shop.adComplete(acc, nonce, career)
}

// ───────── M2 ─────────

test('M2: a refund that arrives before the purchase is redeemed tombstones it (credit and recover get 410)', () => {
  const { shop, acc } = setup()
  const t = txn(acc.id, { productId: 'gems_l' })
  assert.equal(shop.appleNotification(note(chain, 'REFUND', t)).tombstone, true)
  assert.equal(code(() => shop.applePurchase(acc, signJws(chain, t))), 'revoked')
  assert.equal(shop.wallet(acc).gems, 0)
  // One-time products: matched by originalTransactionId too.
  assert.equal(code(() => shop.applePurchase(acc, signJws(chain, { ...t, transactionId: 'other-txn' }))), 'revoked')
  // m3: a subscription period tombstones only its own transaction; later renewals still count.
  const sub = txn(acc.id, { productId: 'pro_contract', expiresDate: Date.now() + 9 * DAY })
  shop.appleNotification(note(chain, 'REVOKE', sub))
  assert.equal(code(() => shop.applePurchase(acc, signJws(chain, sub))), 'revoked')
  assert.equal(code(() => shop.recover(signJws(chain, sub), 'x')), 'revoked')
  assert.equal(shop.wallet(acc).pass.active, false)
  const renewal = { ...sub, transactionId: 'renewal-2', expiresDate: Date.now() + 40 * DAY }
  assert.equal(shop.applePurchase(acc, signJws(chain, renewal)).pass.active, true)
})

// ───────── M3 ─────────

test('M3: Apple OIDs are matched as extension ids; P-256 leaf and a CA intermediate are required', () => {
  const opts = (c) => ({ rootFingerprint: c.rootFingerprint })
  const pay = { bundleId: 'b', signedDate: Date.now() + 2000 }
  // The default fixture carries both extensions and verifies with the OID check on.
  assert.equal(verifyAppleJws(signJws(chain, pay), opts(chain)).bundleId, 'b')
  assert.ok(certExtensions(Buffer.from(chain.x5c[0], 'base64')).has('1.2.840.113635.100.6.11.1'))
  assert.ok(certExtensions(Buffer.from(chain.x5c[1], 'base64')).has('1.2.840.113635.100.6.2.1'))
  // The leaf OID bytes only inside the subject (the old raw-byte search accepted this).
  const inSubject = makeChain({ leafOid: false, oidInSubject: true })
  assert.ok(Buffer.from(inSubject.x5c[0], 'base64').includes(Buffer.from('060a2a864886f76364060b01', 'hex')), 'fixture holds the OID bytes')
  assert.throws(() => verifyAppleJws(signJws(inSubject, pay), opts(inSubject)), /missing apple oid/)
  const noInter = makeChain({ interOid: false })
  assert.throws(() => verifyAppleJws(signJws(noInter, pay), opts(noInter)), /missing apple oid/)
  // An RSA leaf (the signature itself would verify with node's generic verify).
  const rsa = makeChain({ leafKey: 'rsa' })
  assert.throws(() => verifyAppleJws(signJws(rsa, pay), opts(rsa)), /P-256/)
  const notCa = makeChain({ interCa: false })
  assert.throws(() => verifyAppleJws(signJws(notCa, pay), opts(notCa)), /basic constraints/)
})

// ───────── M4 ─────────

test('M4: sandbox policy off refuses test receipts in purchase, recover and renewals', () => {
  const { shop, acc } = setup({ sandbox: { policy: 'off' } })
  assert.equal(code(() => shop.applePurchase(acc, signJws(chain, txn(acc.id)))), 'sandbox_receipt')
  assert.equal(code(() => shop.recover(signJws(chain, txn(acc.id, { productId: 'starter_pack' })), 'x')), 'sandbox_receipt')
  const renew = txn(acc.id, { productId: 'pro_contract', expiresDate: Date.now() + 9 * DAY })
  assert.equal(shop.appleNotification(note(chain, 'DID_RENEW', renew)).handled, false)
  assert.equal(shop.wallet(acc).pass.active, false)
  assert.equal(shop.appleNotification(note(chain, 'DID_RENEW', { ...renew, environment: 'Production' })).handled, true)
  assert.equal(shop.wallet(acc).pass.active, true)
  assert.equal(shop.health().sandbox, 'off')
})

test('M4: testers policy honours sandbox receipts only for listed accounts', () => {
  const s = makeShop(chain)
  const a = s.shop.auth(`Bearer ${s.shop.register('1').token}`)
  const b = s.shop.auth(`Bearer ${s.shop.register('1').token}`)
  s.shop.sandbox = { ...s.shop.sandbox, policy: 'testers', testers: new Set([a.id]) }
  assert.equal(s.shop.applePurchase(a, signJws(chain, txn(a.id))).gems, 600)
  assert.equal(code(() => s.shop.applePurchase(b, signJws(chain, txn(b.id)))), 'sandbox_receipt')
  assert.equal(s.shop.applePurchase(b, signJws(chain, txn(b.id, { environment: 'Production' }))).gems, 600)
})

test('M4: capped policy records sandbox credits as Sandbox and caps them at 3000 per account', () => {
  const { shop, acc, db } = setup({ sandbox: { policy: 'capped' } })
  shop.applePurchase(acc, signJws(chain, txn(acc.id, { productId: 'gems_l' })))
  shop.applePurchase(acc, signJws(chain, txn(acc.id, { productId: 'gems_l' })))
  assert.equal(shop.applePurchase(acc, signJws(chain, txn(acc.id, { productId: 'gems_s' }))).gems, 2820)
  assert.equal(code(() => shop.applePurchase(acc, signJws(chain, txn(acc.id, { productId: 'gems_s' })))), 'sandbox_cap')
  assert.equal(shop.applePurchase(acc, signJws(chain, txn(acc.id, { environment: 'Production', productId: 'gems_s' }))).gems, 3040, 'real purchases are not capped')
  assert.deepEqual(db.prepare("SELECT env, COUNT(*) AS n FROM txns GROUP BY env ORDER BY env").all().map((r) => [r.env, r.n]), [['Production', 1], ['Sandbox', 3]])
})

// ───────── M6 + m3 ─────────

test('M6/m3: Google purchase — product match, test-purchase policy, server consume / acknowledge', async () => {
  const { shop, acc } = setup({ sandbox: { policy: 'off' } })
  const g = fakeGoogle({
    tGems: { orderId: 'GPA.1', account: acc.id },
    tTest: { orderId: 'GPA.2', account: acc.id, test: true },
    tSub: { sub: true, productId: 'pro_contract', orderId: 'GPA.3', account: acc.id, expires: Date.now() + 30 * DAY },
    tOtherSub: { sub: true, productId: 'something_else', orderId: 'GPA.4', account: acc.id, expires: Date.now() + 30 * DAY },
    tConsumed: { orderId: 'GPA.5', account: acc.id, consumed: true },
    tStarter: { orderId: 'GPA.6', account: acc.id },
  })
  shop.google = g
  const r = await shop.googlePurchase(acc, { productId: 'gems_m', purchaseToken: 'tGems' })
  assert.equal(r.gems, 600)
  assert.equal(r.finalized, true)
  assert.deepEqual(g.calls.at(-1), ['consume', 'gems_m', 'tGems'])
  // A retry after the consume: already ours, not a "consumed elsewhere".
  assert.equal((await shop.googlePurchase(acc, { productId: 'gems_m', purchaseToken: 'tGems' })).credited, false)
  assert.equal(await acode(shop.googlePurchase(acc, { productId: 'gems_m', purchaseToken: 'tConsumed' })), 'consumed_elsewhere')
  assert.equal(await acode(shop.googlePurchase(acc, { productId: 'gems_m', purchaseToken: 'tTest' })), 'sandbox_receipt')
  assert.equal(await acode(shop.googlePurchase(acc, { productId: 'pro_contract', purchaseToken: 'tOtherSub' })), 'wrong_product')
  assert.equal((await shop.googlePurchase(acc, { productId: 'pro_contract', purchaseToken: 'tSub' })).pass.active, true)
  assert.deepEqual(g.calls.at(-1), ['ackSub', 'pro_contract', 'tSub'])
  await shop.googlePurchase(acc, { productId: 'starter_pack', purchaseToken: 'tStarter' })
  assert.deepEqual(g.calls.at(-1), ['ack', 'starter_pack', 'tStarter'])
  assert.equal(await acode(shop.googlePurchase(acc, { productId: 'constructor', purchaseToken: 'x' })), 'unknown_product')
})

test('M6: RTDN voided / revoked / canceled claw back like Apple; a void before redeem tombstones', async () => {
  const { shop, acc } = setup()
  const g = fakeGoogle({
    t1: { orderId: 'GPA.1', account: acc.id },
    t2: { sub: true, productId: 'pro_contract', orderId: 'GPA.2', account: acc.id, expires: Date.now() + 30 * DAY },
    t3: { orderId: 'GPA.3', account: acc.id },
  })
  shop.google = g
  await shop.googlePurchase(acc, { productId: 'gems_l', purchaseToken: 't1' })
  await shop.googlePurchase(acc, { productId: 'pro_contract', purchaseToken: 't2' })
  const msg = (o) => ({ version: '1.0', packageName: 'app.starpath.football', eventTimeMillis: '1', ...o })
  // Round 3 (m8): Play's own state is re-read before acting on a void / cancel.
  g.voided.push({ purchaseToken: 't1' })
  g.purchases.t2.revoked = true
  g.purchases.t3.cancelled = true
  assert.equal((await shop.googleRtdn(msg({ voidedPurchaseNotification: { purchaseToken: 't1', orderId: 'GPA.1', productType: 2 } }))).handled, true)
  assert.equal(shop.wallet(acc).gems, -1300 + 1300)
  assert.equal((await shop.googleRtdn(msg({ subscriptionNotification: { notificationType: 12, purchaseToken: 't2', subscriptionId: 'pro_contract' } }))).handled, true)
  assert.equal(shop.wallet(acc).pass.active, false)
  // Voided before the app redeemed it.
  await shop.googleRtdn(msg({ oneTimeProductNotification: { notificationType: 2, purchaseToken: 't3', sku: 'gems_l' } }))
  g.purchases.t3.cancelled = false // a stale 'purchased' read: the tombstone still wins
  assert.equal(await acode(shop.googlePurchase(acc, { productId: 'gems_l', purchaseToken: 't3' })), 'revoked')
  // Wrong package: ignored.
  assert.equal((await shop.googleRtdn({ packageName: 'evil', voidedPurchaseNotification: { purchaseToken: 't1' } })).handled, false)
})

test('M6: RTDN purchase notification credits the account the purchase was made for', async () => {
  const { shop, acc } = setup()
  shop.google = fakeGoogle({ t9: { orderId: 'GPA.9', account: acc.id } })
  const r = await shop.googleRtdn({ packageName: 'app.starpath.football', oneTimeProductNotification: { notificationType: 1, purchaseToken: 't9', sku: 'gems_s' } })
  assert.equal(r.handled, true)
  assert.equal(shop.wallet(acc).gems, 220)
})

test('M6: pollVoided claws back purchases Play reports as voided', async () => {
  const { shop, acc } = setup()
  shop.google = fakeGoogle({ tv: { orderId: 'GPA.7', account: acc.id } }, { voided: [{ purchaseToken: 'tv', orderId: 'GPA.7' }, { purchaseToken: 'unknown' }] })
  await shop.googlePurchase(acc, { productId: 'gems_m', purchaseToken: 'tv' })
  assert.equal(await shop.pollVoided(), 2)
  assert.equal(shop.wallet(acc).gems, 0)
  assert.equal(await shop.pollVoided(), 0, 'idempotent')
  const shop2 = makeShop(chain).shop
  assert.equal(await shop2.pollVoided(), 0, 'no-op without Play configured')
})

test('m3: Google API non-JSON errors are a refusal, not a crash', async () => {
  const { GooglePlay } = await import('../src/google.mjs')
  const gp = new GooglePlay({ packageName: 'p', fetchImpl: async () => new Response('<html>502</html>', { status: 502 }) })
  gp.sa = {}
  gp.token = { value: 'x', exp: Date.now() + 3600_000 }
  assert.deepEqual(await gp.verifyProduct('gems_m', 't'), { ok: false, why: 'play 502', transient: true })
})

// ───────── M7 + m14 ─────────

test('M7: Google recovery adds a device token for the account the purchase belongs to', async () => {
  const { shop, acc, reg } = setup()
  shop.google = fakeGoogle({ ts: { orderId: 'GPA.1', account: acc.id }, tg: { orderId: 'GPA.2', account: acc.id } })
  await shop.googlePurchase(acc, { productId: 'starter_pack', purchaseToken: 'ts' })
  const r = await shop.recoverGoogle({ productId: 'starter_pack', purchaseToken: 'ts' }, 'ip')
  assert.equal(r.accountId, acc.id)
  assert.equal(shop.auth(`Bearer ${r.token}`).id, acc.id)
  assert.equal(shop.auth(`Bearer ${reg.token}`).id, acc.id, 'the first device stays signed in')
  assert.equal(await acode(shop.recoverGoogle({ productId: 'gems_m', purchaseToken: 'tg' }, 'ip')), 'not_restorable')
  shop.google.purchases.tx = { orderId: 'GPA.3', account: '00000000-0000-4000-8000-000000000000' }
  assert.equal(await acode(shop.recoverGoogle({ productId: 'starter_pack', purchaseToken: 'tx' }, 'ip')), 'no_account')
})

test('M7: a recovery code restores the account once; wrong codes fail', () => {
  const { shop, acc } = setup()
  const { code: c } = shop.recoveryCode(acc, 'ip')
  assert.match(c, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
  assert.equal(code(() => shop.recoverCode('AAAA-AAAA-AAAA-AAAA', 'ip')), 'bad_code')
  assert.equal(code(() => shop.recoverCode('nope', 'ip')), 'bad_code')
  assert.equal(code(() => shop.recoverCode({ c }, 'ip')), 'bad_code')
  const r = shop.recoverCode(` ${c.toLowerCase().replace(/-/g, ' ')} `, 'ip')
  assert.equal(r.accountId, acc.id)
  assert.equal(shop.auth(`Bearer ${r.token}`).id, acc.id)
  assert.equal(code(() => shop.recoverCode(c, 'ip')), 'bad_code', 'one-time')
  const again = shop.recoveryCode(acc, 'ip').code
  shop.recoveryCode(acc, 'ip') // a new code replaces the old one
  assert.equal(code(() => shop.recoverCode(again, 'ip')), 'bad_code')
})

test('m14: up to 5 device tokens per account; the oldest drops out after a 6th', () => {
  const { shop, acc, reg, clock } = setup()
  const jws = signJws(chain, txn(acc.id, { productId: 'starter_pack' }))
  shop.applePurchase(acc, jws)
  const tokens = [reg.token]
  for (let i = 0; i < 4; i++) { clock.advance(1); tokens.push(shop.recover(jws, 'x').token) }
  for (const t of tokens) assert.equal(shop.auth(`Bearer ${t}`).id, acc.id)
  clock.advance(1)
  tokens.push(shop.recover(jws, 'x').token)
  assert.equal(code(() => shop.auth(`Bearer ${tokens[0]}`)), 'unauthorized')
  for (const t of tokens.slice(1)) assert.equal(shop.auth(`Bearer ${t}`).id, acc.id)
})

// ───────── M8 ─────────

test('M8: health and wallet report store readiness', () => {
  const { shop, acc } = setup()
  assert.deepEqual(shop.health(), { ok: true, apple: true, google: false, sandbox: 'on' })
  assert.equal(shop.health().ops, undefined, 'operator details only on request')
  assert.deepEqual(shop.wallet(acc).stores, { apple: true, google: false })
  shop.google = fakeGoogle()
  assert.equal(shop.wallet(acc).stores.google, true)
})

// ───────── M17 ─────────

test('M17: prune drops stale rows and hashes old audit IPs; open ad sessions are capped', () => {
  const { shop, acc, clock, db } = setup()
  for (const offer of ['gems', 'match_bonus', 'train_boost']) shop.adStart(acc, offer)
  assert.equal(code(() => shop.adStart(acc, 'physio_disc')), 'too_many_open_ads')
  shop.applePurchase(acc, signJws(chain, txn(acc.id, { productId: 'gems_l' })))
  const g = shop.spend(acc, { item: 'gold_boots', idem: 'i1' }).grant
  shop.ack(acc, [g.nonce])
  shop.earn(acc, { source: 'motm', ref: 'r1' })
  shop.recoveryCode(acc, '5.5.5.5') // an audit row with an address ('register' rows go after 30 days)
  clock.advance(31 * DAY)
  assert.equal(code(() => shop.adStart(acc, 'gems')), 'ok', 'old unfinished sessions no longer count')
  const r = shop.prune()
  assert.equal(r.ads, 3)
  assert.equal(r.idem, 1)
  assert.equal(r.grants, 1)
  assert.ok(r.daily >= 1)
  assert.ok(r.auditIps >= 1)
  assert.ok(db.prepare('SELECT ip FROM audit WHERE ip IS NOT NULL').all().every((a) => a.ip.startsWith('h:')))
  clock.advance(180 * DAY)
  assert.ok(shop.prune().audit >= 1)
})

test('M17: export returns the account data; delete erases it and the token stops working', () => {
  const { shop, acc, reg, db } = setup()
  const t = txn(acc.id, { productId: 'gems_m' })
  shop.applePurchase(acc, signJws(chain, t))
  shop.recoveryCode(acc, 'ip')
  const ex = shop.exportAccount(acc)
  assert.equal(ex.account.id, acc.id)
  assert.equal(ex.purchases.length, 1)
  assert.equal(ex.ledger[0].delta, 600)
  assert.equal(ex.recoveryCode, true)
  assert.deepEqual(shop.deleteAccount(acc, 'ip'), { deleted: true })
  assert.equal(code(() => shop.auth(`Bearer ${reg.token}`)), 'unauthorized')
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM txns WHERE account = ?').get(acc.id).n, 1, 'purchases stay for refunds')
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ledger WHERE account = ? AND ref IS NOT NULL').get(acc.id).n, 0)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM audit WHERE account = ? AND ip IS NOT NULL').get(acc.id).n, 0)
  assert.equal(code(() => shop.recover(signJws(chain, txn(acc.id, { productId: 'starter_pack' })), 'x')), 'no_account')
  // A refund after deletion still claws back.
  assert.equal(shop.appleNotification(note(chain, 'REFUND', t)).handled, true)
})

// ───────── M19 ─────────

test('M19: a claim refused by the cap does not burn its reference', () => {
  const { shop, acc, clock } = setup()
  for (let i = 0; i < 10; i++) shop.earn(acc, { source: 'motm', ref: `m${i}` })
  assert.deepEqual([shop.earn(acc, { source: 'motm', ref: 'late' }).earned, shop.earn(acc, { source: 'motm', ref: 'late' }).capped], [0, true])
  clock.advance(DAY)
  assert.equal(shop.earn(acc, { source: 'motm', ref: 'late' }).earned, 8, 'claimable the next day')
  assert.equal(shop.earn(acc, { source: 'motm', ref: 'late' }).earned, 0, 'and then only once')
})

// ───────── M21 / M22 / M23 ─────────

test('M21: cash grants carry a cap; gems_to_cash is capped at 25000 and 3 a day', () => {
  const { shop, acc, clock } = setup()
  shop.applePurchase(acc, signJws(chain, txn(acc.id, { productId: 'cash_l' })))
  assert.equal(shop.wallet(acc).inbox[0].cap, 200000)
  shop.applePurchase(acc, signJws(chain, txn(acc.id, { productId: 'gems_m' })))
  assert.equal(shop.wallet(acc).limits.gemsToCashLeft, 3)
  for (let i = 0; i < 3; i++) assert.equal(shop.spend(acc, { item: 'gems_to_cash', idem: `g${i}` }).grant.cap, 25000)
  assert.equal(shop.wallet(acc).limits.gemsToCashLeft, 0)
  assert.equal(code(() => shop.spend(acc, { item: 'gems_to_cash', idem: 'g4' })), 'spend_cap')
  clock.advance(DAY)
  assert.equal(shop.spend(acc, { item: 'gems_to_cash', idem: 'g5' }).limits.gemsToCashLeft, 2)
})

test('M22: earn amounts and the 300 daily cap', () => {
  const { shop, acc, clock } = setup()
  clock.advance(DAY) // past the new-account half caps
  assert.equal(shop.earn(acc, { source: 'season', ref: 's1' }).earned, 100)
  assert.equal(shop.earn(acc, { source: 'award', ref: 'a1' }).earned, 25)
  assert.equal(shop.earn(acc, { source: 'objective', ref: 'o1' }).earned, 8)
  assert.equal(shop.earn(acc, { source: 'motm', ref: 'm1' }).earned, 8)
  assert.equal(shop.earn(acc, { source: 'first', ref: 'f1' }).earned, 10)
  let total = 0
  for (let i = 0; i < 60; i++) total += shop.earn(acc, { source: ['season', 'award', 'objective', 'first', 'motm'][i % 5], ref: `x${i}` }).earned
  assert.equal(shop.wallet(acc).earnedToday, shop.wallet(acc).gems)
  assert.ok(shop.wallet(acc).gems <= 300 && shop.wallet(acc).gems >= 285, String(shop.wallet(acc).gems))
})

test('M23: cosmetics bought with diamonds are owned server-side, once', () => {
  const { shop, acc } = setup()
  shop.applePurchase(acc, signJws(chain, txn(acc.id, { productId: 'gems_m' })))
  const r = shop.spend(acc, { item: 'cos_celebrations', idem: 'c1' })
  assert.deepEqual([r.gems, r.grant.k, r.grant.id], [350, 'cosmetic', 'pack_celebrations'])
  assert.ok(r.entitlements.includes('pack_celebrations'))
  assert.equal(code(() => shop.spend(acc, { item: 'cos_celebrations', idem: 'c2' })), 'owned')
  assert.equal(shop.spend(acc, { item: 'cos_celebrations', idem: 'c1' }).gems, 350, 'a retry is a replay, not "owned"')
  assert.equal(shop.spend(acc, { item: 'cos_avatar', idem: 'c3' }).gems, 100)
})

// ───────── m1 ─────────

test('m1: notifications — bad payload is 400, bundleId required, UUID dedupe, out-of-order EXPIRED ignored', () => {
  const { shop, acc, clock } = setup()
  assert.equal(code(() => shop.appleNotification('junk')), 'invalid_notification')
  assert.equal(code(() => shop.appleNotification(undefined)), 'invalid_notification')
  const t = txn(acc.id, { productId: 'gems_m' })
  shop.applePurchase(acc, signJws(chain, t))
  const noBundle = signJws(chain, { notificationType: 'REFUND', data: { signedTransactionInfo: signJws(chain, t) }, signedDate: t.signedDate })
  assert.equal(shop.appleNotification(noBundle).handled, false)
  const p1 = txn(acc.id, { productId: 'pro_contract', expiresDate: clock.now() + 10 * DAY })
  const p2 = { ...p1, transactionId: 'p2', expiresDate: clock.now() + 40 * DAY }
  assert.equal(shop.appleNotification(note(chain, 'DID_RENEW', p1, { notificationUUID: 'u1' })).handled, true)
  assert.equal(shop.appleNotification(note(chain, 'DID_RENEW', p1, { notificationUUID: 'u1' })).duplicate, true)
  shop.appleNotification(note(chain, 'DID_RENEW', p2, { notificationUUID: 'u2' }))
  assert.equal(shop.appleNotification(note(chain, 'EXPIRED', p1, { notificationUUID: 'u3' })).handled, false, 'older period')
  assert.equal(shop.wallet(acc).pass.active, true)
  // A renewal carrying a revocation date does not extend.
  const p3 = { ...p1, transactionId: 'p3', expiresDate: clock.now() + 90 * DAY, revocationDate: 1 }
  assert.equal(shop.appleNotification(note(chain, 'DID_RENEW', p3)).handled, false)
  assert.equal(shop.wallet(acc).pass.until, p2.expiresDate)
  assert.equal(shop.appleNotification(note(chain, 'EXPIRED', p2)).handled, true)
  assert.equal(shop.wallet(acc).pass.active, false)
  assert.ok(!shop.wallet(acc).entitlements.includes('pro_contract'))
})

// ───────── m2 ─────────

test('m2: recover refuses refunded and expired receipts; Pro entitlement lapses with the pass', () => {
  const { shop, acc, clock } = setup()
  const st = txn(acc.id, { productId: 'starter_pack' })
  shop.applePurchase(acc, signJws(chain, st))
  shop.appleNotification(note(chain, 'REFUND', st))
  assert.equal(code(() => shop.recover(signJws(chain, st), 'x')), 'revoked')
  assert.equal(code(() => shop.recover(signJws(chain, { ...st, revocationDate: 1 }), 'x')), 'revoked')
  const sub = txn(acc.id, { productId: 'pro_contract', expiresDate: clock.now() + DAY })
  shop.applePurchase(acc, signJws(chain, sub))
  assert.ok(shop.wallet(acc).entitlements.includes('pro_contract'))
  clock.advance(2 * DAY)
  assert.equal(code(() => shop.recover(signJws(chain, sub), 'x')), 'expired')
  assert.ok(!shop.wallet(acc).entitlements.includes('pro_contract'))
})

// ───────── m4 ─────────

test('m4: a refund withdraws unapplied grants; a Starter Pack with applied boots keeps starter=1', () => {
  const a = setup()
  const cash = txn(a.acc.id, { productId: 'cash_m' })
  a.shop.applePurchase(a.acc, signJws(chain, cash))
  assert.equal(a.shop.wallet(a.acc).inbox.length, 1)
  a.shop.appleNotification(note(chain, 'REFUND', cash))
  assert.equal(a.shop.wallet(a.acc).inbox.length, 0)
  // Starter, boots not applied yet: everything goes back, the pack can be bought again.
  const s1 = txn(a.acc.id, { productId: 'starter_pack' })
  a.shop.applePurchase(a.acc, signJws(chain, s1))
  a.shop.appleNotification(note(chain, 'REFUND', s1))
  assert.deepEqual([a.shop.wallet(a.acc).gems, a.shop.wallet(a.acc).starter, a.shop.wallet(a.acc).inbox.length], [0, false, 0])
  // Starter, boots applied: diamonds back, starter stays 1 (no second pair of boots).
  const s2 = txn(a.acc.id, { productId: 'starter_pack' })
  const w = a.shop.applePurchase(a.acc, signJws(chain, s2))
  a.shop.ack(a.acc, [w.inbox[0].nonce])
  a.shop.appleNotification(note(chain, 'REFUND', s2))
  assert.deepEqual([a.shop.wallet(a.acc).gems, a.shop.wallet(a.acc).starter], [0, true])
  // A repeat Starter Pack credited nothing, so its refund takes nothing.
  const s3 = txn(a.acc.id, { productId: 'starter_pack' })
  a.shop.applePurchase(a.acc, signJws(chain, s3))
  a.shop.appleNotification(note(chain, 'REFUND', s3))
  assert.equal(a.shop.wallet(a.acc).gems, 0)
})

// ───────── m6 ─────────

test('m6: the physio discount and season x2 eligibility survive midnight', () => {
  const { shop, acc, clock } = setup()
  shop.applePurchase(acc, signJws(chain, txn(acc.id, { productId: 'gems_s' })))
  watch(shop, clock, acc, 'physio_disc')
  shop.earn(acc, { source: 'season', ref: 's2026' })
  assert.equal(shop.wallet(acc).seasonX2Ready, true)
  clock.advance(DAY)
  assert.equal(shop.wallet(acc).physioDiscounts, 1)
  assert.equal(shop.spend(acc, { item: 'physio', idem: 'p', discount: true }).gems, 220 + 100 - 50)
  assert.equal(shop.wallet(acc).seasonX2Ready, true)
  assert.equal(watch(shop, clock, acc, 'season_x2').gems, 270 + 100, 'season x2 pays the season reward again')
  assert.equal(shop.wallet(acc).seasonX2Ready, false)
  clock.advance(DAY)
  assert.equal(code(() => shop.adStart(acc, 'season_x2')), 'no_season_reward', 'one x2 per season reward')
})

// ───────── m8 ─────────

test('m8: an idempotency key reused for another item is 409; a replay returns a fresh wallet', () => {
  const { shop, acc } = setup()
  shop.applePurchase(acc, signJws(chain, txn(acc.id, { productId: 'gems_m' })))
  const a = shop.spend(acc, { item: 'speed_boots', idem: 'k' })
  assert.equal(code(() => shop.spend(acc, { item: 'gold_boots', idem: 'k' })), 'idem_mismatch')
  shop.applePurchase(acc, signJws(chain, txn(acc.id, { productId: 'gems_s' })))
  const b = shop.spend(acc, { item: 'speed_boots', idem: 'k' })
  assert.equal(b.grant.nonce, a.grant.nonce)
  assert.equal(b.gems, 500 + 220, 'current balance, not the stored one')
  assert.equal(b.replay, true)
})

// ───────── m9 ─────────

test('m9: inherited catalog keys and non-string ids are a 400, never a crash', () => {
  const { shop, acc } = setup()
  for (const source of ['constructor', '__proto__', 'toString', 5, {}]) assert.equal(code(() => shop.earn(acc, { source, ref: 'r' })), 'unknown_source')
  for (const item of ['constructor', '__proto__', 'hasOwnProperty']) assert.equal(code(() => shop.spend(acc, { item, idem: 'i' })), 'unknown_item')
  assert.equal(code(() => shop.adStart(acc, 'constructor')), 'unknown_offer')
  assert.equal(code(() => shop.devPurchase(acc, 'constructor')), 'not_found')
})

// ───────── m10 ─────────

test('m10: rate limiter keys IPv6 by /64 and evicts the oldest keys instead of clearing', () => {
  assert.equal(ipKey('2001:db8:1:2:aaaa::1'), ipKey('2001:db8:1:2:bbbb:cccc:dddd:eeee'))
  assert.notEqual(ipKey('2001:db8:1:2::1'), ipKey('2001:db8:1:3::1'))
  assert.equal(ipKey('::ffff:1.2.3.4'), '1.2.3.4')
  assert.equal(ipKey('9.9.9.9'), '9.9.9.9')
  const rl = new RateLimiter(60, 1, 100)
  assert.equal(rl.take('hot', 0), true)
  assert.equal(rl.take('hot', 0), false)
  for (let i = 0; i < 150; i++) rl.take(`k${i}`, 0)
  assert.equal(rl.take('hot', 0), true, 'an evicted key starts fresh, but…')
  assert.equal(rl.take('hot', 0), false, '…a recently used key is not evicted')
  for (let i = 0; i < 50; i++) rl.take(`z${i}`, 0)
  assert.equal(rl.take('hot', 0), false)
  assert.ok(rl.b.size <= 101)
})

// ───────── Contract: career and fixture binding ─────────

test('contract: spend and ad grants carry the career id (c) and the ad session ref, signed', () => {
  const { shop, acc, clock, publicKey } = setup()
  shop.applePurchase(acc, signJws(chain, txn(acc.id, { productId: 'gems_m' })))
  const g = shop.spend(acc, { item: 'compression', idem: 'q1', career: 'car_01:x' }).grant
  assert.equal(g.c, 'car_01:x')
  const [b, sig] = g.token.split('.')
  assert.ok(verify(null, Buffer.from(b), publicKey, Buffer.from(sig, 'base64url')))
  assert.deepEqual(Object.keys(payloadOf(g.token)).slice(0, 5), ['v', 'n', 'a', 't', 'k'])
  assert.equal(payloadOf(g.token).kid, shop.kid)
  assert.equal(payloadOf(g.token).c, 'car_01:x')
  assert.equal(shop.spend(acc, { item: 'compression', idem: 'q2' }).grant.c, undefined)
  const m = watch(shop, clock, acc, 'match_bonus', { ref: 'c1:s2026:fx14', career: 'car_01' }).grant
  assert.deepEqual([m.k, m.c, m.ref], ['match_bonus', 'car_01', 'c1:s2026:fx14'])
  assert.deepEqual([payloadOf(m.token).c, payloadOf(m.token).ref], ['car_01', 'c1:s2026:fx14'])
  assert.equal(code(() => shop.spend(acc, { item: 'compression', idem: 'q3', career: 'x'.repeat(65) })), 'bad_request')
  assert.equal(code(() => shop.spend(acc, { item: 'compression', idem: 'q3', career: 'a b' })), 'bad_request')
  assert.equal(code(() => shop.adStart(acc, 'match_bonus', 'x'.repeat(81))), 'bad_request')
  assert.equal(code(() => shop.adStart(acc, 'match_bonus', 7)), 'bad_request')
})

// ───────── Migration ─────────

test('migration: an old database (one secret per account) keeps working', async () => {
  const { DatabaseSync } = await import('node:sqlite')
  const { mkdtempSync } = await import('node:fs')
  const { join } = await import('node:path')
  const { tmpdir } = await import('node:os')
  const file = join(mkdtempSync(join(tmpdir(), 'sp-mig-')), 'shop.db')
  const old = new DatabaseSync(file)
  old.exec(`CREATE TABLE accounts (id TEXT PRIMARY KEY, secret_hash TEXT NOT NULL, created INTEGER NOT NULL, gems INTEGER NOT NULL DEFAULT 0, starter INTEGER NOT NULL DEFAULT 0, pass_until INTEGER NOT NULL DEFAULT 0, pass_claim_day TEXT, banned INTEGER NOT NULL DEFAULT 0, platform TEXT);
    CREATE TABLE grants (nonce TEXT PRIMARY KEY, account TEXT NOT NULL, payload TEXT NOT NULL, token TEXT NOT NULL, at INTEGER NOT NULL, acked INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE ads (nonce TEXT PRIMARY KEY, account TEXT NOT NULL, offer TEXT NOT NULL, started INTEGER NOT NULL, ssv INTEGER NOT NULL DEFAULT 0, done INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE idem (account TEXT NOT NULL, key TEXT NOT NULL, response TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (account, key));`)
  const id = '11111111-2222-4333-8444-555555555555'
  const secret = 'S'.repeat(43)
  old.prepare('INSERT INTO accounts (id, secret_hash, created, gems) VALUES (?, ?, 1, 42)').run(id, sha(secret))
  old.close()
  const { openDb } = await import('../src/db.mjs')
  const { catalog } = await import('./helpers.mjs')
  const { Shop } = await import('../src/shop.mjs')
  const { generateKeyPairSync } = await import('node:crypto')
  const db = openDb(file)
  const shop = new Shop({ db, catalog, signKey: generateKeyPairSync('ed25519').privateKey, apple: { bundleId: 'x' } })
  assert.equal(shop.wallet(shop.auth(`Bearer ${id}.${secret}`)).gems, 42)
  db.close()
  const again = openDb(file) // reopening does not duplicate or resurrect tokens
  assert.equal(again.prepare('SELECT COUNT(*) AS n FROM account_tokens').get().n, 1)
  again.close()
})
