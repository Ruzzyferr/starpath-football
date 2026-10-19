import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verify } from 'node:crypto'
import { makeChain, makeShop, signJws, txn } from './helpers.mjs'
import { ShopError } from '../src/shop.mjs'

const chain = makeChain()
const other = makeChain()

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

test('auth: only the exact token opens the account', () => {
  const { shop, reg } = setup()
  assert.equal(code(() => shop.auth(`Bearer ${reg.token}`)), 'ok')
  assert.equal(code(() => shop.auth(`Bearer ${reg.accountId}.${'A'.repeat(43)}`)), 'unauthorized')
  assert.equal(code(() => shop.auth('Bearer nonsense')), 'unauthorized')
  assert.equal(code(() => shop.auth(undefined)), 'unauthorized')
  assert.equal(code(() => shop.auth(`Bearer ${'0'.repeat(8)}-0000-0000-0000-000000000000.${'A'.repeat(43)}`)), 'unauthorized')
})

test('apple: a verified receipt credits diamonds once; replay and cross-account reuse are refused', () => {
  const { shop, acc } = setup()
  const jws = signJws(chain, txn(acc.id))
  const r = shop.applePurchase(acc, jws)
  assert.equal(r.gems, 600)
  assert.equal(r.credited, true)
  const again = shop.applePurchase(acc, jws)
  assert.equal(again.gems, 600, 'same receipt twice must not double')
  assert.equal(again.credited, false)
  const thief = shop.auth(`Bearer ${shop.register('2.2.2.2').token}`)
  assert.equal(code(() => shop.applePurchase(thief, jws)), 'not_your_receipt')
})

test('apple: a receipt made for another account cannot be credited even if never used', () => {
  const { shop, acc } = setup()
  const victim = shop.register('3.3.3.3').accountId
  assert.equal(code(() => shop.applePurchase(acc, signJws(chain, txn(victim)))), 'not_your_receipt')
  assert.equal(code(() => shop.applePurchase(acc, signJws(chain, txn(undefined)))), 'not_your_receipt')
})

test('apple: forged, tampered, wrong-app and untrusted receipts are refused', () => {
  const { shop, acc } = setup()
  // Self-made chain (an attacker's own CA): untrusted root.
  assert.equal(code(() => shop.applePurchase(acc, signJws(other, txn(acc.id)))), 'invalid_receipt')
  // Real chain, payload edited after signing (gems_m → gems_xxl).
  const good = signJws(chain, txn(acc.id))
  const [h, , s] = good.split('.')
  const forged = `${h}.${Buffer.from(JSON.stringify(txn(acc.id, { productId: 'gems_xxl' }))).toString('base64url')}.${s}`
  assert.equal(code(() => shop.applePurchase(acc, forged)), 'invalid_receipt')
  // Signed by a key that is not the leaf's.
  assert.equal(code(() => shop.applePurchase(acc, signJws(chain, txn(acc.id), { key: other.leafKey }))), 'invalid_receipt')
  // Chain with the attacker's leaf but the trusted root.
  assert.equal(code(() => shop.applePurchase(acc, signJws(chain, txn(acc.id), { x5c: [other.x5c[0], chain.x5c[1], chain.x5c[2]], key: other.leafKey }))), 'invalid_receipt')
  assert.equal(code(() => shop.applePurchase(acc, signJws(chain, txn(acc.id, { bundleId: 'com.evil.app' })))), 'wrong_app')
  assert.equal(code(() => shop.applePurchase(acc, signJws(chain, txn(acc.id, { productId: 'gems_free' })))), 'unknown_product')
  assert.equal(code(() => shop.applePurchase(acc, signJws(chain, txn(acc.id, { revocationDate: 1 })))), 'revoked')
  assert.equal(code(() => shop.applePurchase(acc, 'a.b.c')), 'invalid_receipt')
  assert.equal(code(() => shop.applePurchase(acc, 'x'.repeat(30_000))), 'invalid_receipt')
  assert.equal(code(() => shop.applePurchase(acc, { jws: 1 })), 'invalid_receipt')
  assert.equal(shop.wallet(acc).gems, 0)
})

test('apple: sandbox receipts only when the server allows them', () => {
  const { shop, acc } = setup({ apple: { bundleId: 'app.starpath.football', allowSandbox: false, rootFingerprint: chain.rootFingerprint, skipOids: true } })
  assert.equal(code(() => shop.applePurchase(acc, signJws(chain, txn(acc.id)))), 'sandbox_receipt')
  assert.equal(shop.applePurchase(acc, signJws(chain, txn(acc.id, { environment: 'Production' }))).gems, 600)
})

test('apple: the real Apple root is required by default (a test chain is not trusted)', () => {
  const { shop, acc } = setup({ apple: { bundleId: 'app.starpath.football', allowSandbox: true } })
  assert.equal(code(() => shop.applePurchase(acc, signJws(chain, txn(acc.id)))), 'invalid_receipt')
})

test('starter pack: 300 diamonds + golden boots once per account, even if bought again', () => {
  const { shop, acc } = setup()
  const r = shop.applePurchase(acc, signJws(chain, txn(acc.id, { productId: 'starter_pack', type: 'Non-Consumable' })))
  assert.equal(r.gems, 300)
  assert.equal(r.starter, true)
  assert.deepEqual(r.inbox.map((g) => [g.k, g.id]), [['gear', 'gold_boots']])
  assert.ok(r.entitlements.includes('starter_pack'))
  const r2 = shop.applePurchase(acc, signJws(chain, txn(acc.id, { productId: 'starter_pack', type: 'Non-Consumable' })))
  assert.equal(r2.gems, 300)
  assert.equal(r2.inbox.length, 1)
  // m5: the repeat is reported as not credited, with a reason, and audited.
  assert.deepEqual([r2.credited, r2.reason], [false, 'already_owned'])
})

test('spending: server prices, no overdraft, idempotent retries charge once', () => {
  const { shop, acc } = setup()
  shop.applePurchase(acc, signJws(chain, txn(acc.id, { productId: 'gems_s' }))) // 220
  assert.equal(code(() => shop.spend(acc, { item: 'cos_avatar', idem: 'k1' })), 'insufficient_gems')
  const a = shop.spend(acc, { item: 'speed_boots', idem: 'k2', price: 1 })
  assert.equal(a.gems, 120, 'the client cannot choose the price')
  const b = shop.spend(acc, { item: 'speed_boots', idem: 'k2' })
  assert.equal(b.gems, 120, 'same idempotency key does not charge twice')
  assert.equal(b.grant.nonce, a.grant.nonce)
  assert.equal(shop.spend(acc, { item: 'speed_boots', idem: 'k3' }).gems, 20)
  assert.equal(code(() => shop.spend(acc, { item: 'speed_boots', idem: 'k3b' })), 'insufficient_gems')
  assert.equal(code(() => shop.spend(acc, { item: 'free_money', idem: 'k4' })), 'unknown_item')
  assert.equal(code(() => shop.spend(acc, { item: 'speed_boots', idem: "'; DROP TABLE accounts; --" })), 'bad_request')
  assert.equal(shop.wallet(acc).gems, 20)
})

test('grants are signed by the server key; a tampered grant fails verification', () => {
  const { shop, acc, publicKey } = setup()
  shop.applePurchase(acc, signJws(chain, txn(acc.id, { productId: 'cash_m' })))
  const [g] = shop.wallet(acc).inbox
  assert.equal(g.k, 'cash')
  assert.equal(g.weeks, 12)
  const [b, sig] = g.token.split('.')
  assert.ok(verify(null, Buffer.from(b), publicKey, Buffer.from(sig, 'base64url')))
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(b, 'base64url')), weeks: 999 })).toString('base64url')
  assert.ok(!verify(null, Buffer.from(forged), publicKey, Buffer.from(sig, 'base64url')))
  shop.ack(acc, [g.nonce])
  assert.equal(shop.wallet(acc).inbox.length, 0)
})

test('rewarded ads: daily cap, minimum watch time, one reward per ad, nonce bound to the account', () => {
  const { shop, acc, clock } = setup()
  clock.advance(86400_000) // past the new-account half caps
  for (let i = 0; i < 5; i++) {
    const { nonce } = shop.adStart(acc, 'gems')
    assert.equal(code(() => shop.adComplete(acc, nonce)), 'ad_too_short')
    clock.advance(6000)
    shop.adComplete(acc, nonce)
    assert.equal(code(() => shop.adComplete(acc, nonce)), 'already_rewarded')
  }
  assert.equal(shop.wallet(acc).gems, 50)
  assert.equal(code(() => shop.adStart(acc, 'gems')), 'ad_cap')
  const other = shop.auth(`Bearer ${shop.register('9.9.9.9').token}`)
  const { nonce } = shop.adStart(other, 'gems')
  clock.advance(6000)
  assert.equal(code(() => shop.adComplete(acc, nonce)), 'no_ad_session')
  clock.advance(86400_000)
  assert.equal(code(() => shop.adStart(acc, 'gems')), 'ok', 'a new day resets the cap')
})

test('rewarded ads with SSV required: no reward until Google confirms the view', () => {
  const { shop, acc, clock } = setup({ ads: { requireSsv: true } })
  const { nonce } = shop.adStart(acc, 'gems')
  clock.advance(60_000)
  assert.equal(code(() => shop.adComplete(acc, nonce)), 'ad_not_verified')
  assert.equal(shop.adSsv({ custom_data: `${acc.id}:${nonce}` }), true)
  assert.equal(shop.adComplete(acc, nonce).gems, 10)
  assert.equal(shop.adSsv({ custom_data: `someone:${nonce}` }), false)
})

test('physio discount needs a watched ad; season x2 needs a season reward first', () => {
  const { shop, acc, clock } = setup()
  shop.applePurchase(acc, signJws(chain, txn(acc.id, { productId: 'gems_s' })))
  assert.equal(code(() => shop.spend(acc, { item: 'physio', idem: 'p1', discount: true })), 'no_discount')
  const { nonce } = shop.adStart(acc, 'physio_disc')
  clock.advance(6000)
  shop.adComplete(acc, nonce)
  assert.equal(shop.spend(acc, { item: 'physio', idem: 'p2', discount: true }).gems, 170)
  assert.equal(code(() => shop.adStart(acc, 'season_x2')), 'no_season_reward')
})

test('free diamonds: deduplicated by reference and capped per day', () => {
  const { shop, acc, clock } = setup()
  clock.advance(86400_000) // past the new-account half caps
  assert.equal(shop.earn(acc, { source: 'motm', ref: 'c1:s2026:w5' }).earned, 8)
  assert.equal(shop.earn(acc, { source: 'motm', ref: 'c1:s2026:w5' }).earned, 0)
  for (let i = 0; i < 20; i++) shop.earn(acc, { source: 'motm', ref: `c1:w${i}` })
  assert.equal(shop.wallet(acc).gems, 80, '10 MOTM claims a day at most')
  let total = 0
  for (let i = 0; i < 100; i++) total += shop.earn(acc, { source: ['objective', 'award', 'first', 'season'][i % 4], ref: `r${i}` }).earned
  assert.ok(shop.wallet(acc).gems <= 300, `daily free cap holds (${shop.wallet(acc).gems})`)
  assert.equal(code(() => shop.earn(acc, { source: 'admin', ref: 'x' })), 'unknown_source')
})

test('pro contract: 50 diamonds once per day while active', () => {
  const { shop, acc, clock } = setup()
  assert.equal(code(() => shop.passClaim(acc)), 'no_pass')
  shop.applePurchase(acc, signJws(chain, txn(acc.id, { productId: 'pro_contract', type: 'Auto-Renewable Subscription', expiresDate: clock.now() + 3 * 86400_000 })))
  assert.equal(shop.passClaim(acc).gems, 50)
  assert.equal(code(() => shop.passClaim(acc)), 'already_claimed')
  clock.advance(86400_000)
  assert.equal(shop.passClaim(acc).gems, 100)
  clock.advance(3 * 86400_000)
  assert.equal(code(() => shop.passClaim(acc)), 'no_pass')
})

test('refund notification takes the diamonds back; a negative balance blocks spending', () => {
  const { shop, acc } = setup()
  const t = txn(acc.id, { productId: 'gems_l' })
  shop.applePurchase(acc, signJws(chain, t))
  shop.spend(acc, { item: 'gold_boots', idem: 'a' })
  shop.spend(acc, { item: 'gold_boots', idem: 'b' })
  shop.spend(acc, { item: 'gold_boots', idem: 'c' }) // 1300 - 600 = 700
  const note = signJws(chain, { notificationType: 'REFUND', data: { bundleId: 'app.starpath.football', signedTransactionInfo: signJws(chain, t) }, signedDate: t.signedDate })
  assert.equal(shop.appleNotification(note).handled, true)
  assert.equal(shop.wallet(acc).gems, -600)
  assert.equal(shop.wallet(acc).refundHold, true)
  assert.equal(code(() => shop.spend(acc, { item: 'compression', idem: 'd' })), 'refund_hold')
  assert.equal(shop.appleNotification(note).handled, false, 'a refund is applied once')
  assert.equal(code(() => shop.applePurchase(acc, signJws(chain, t))), 'revoked')
  // A forged notification (attacker CA) is rejected.
  assert.throws(() => shop.appleNotification(signJws(other, { notificationType: 'REFUND', data: {} })))
})

test('recover: a verified non-consumable receipt restores the account on a new install', () => {
  const { shop, acc } = setup()
  const jws = signJws(chain, txn(acc.id, { productId: 'starter_pack' }))
  shop.applePurchase(acc, jws)
  const r = shop.recover(jws, '5.5.5.5')
  assert.equal(r.accountId, acc.id)
  assert.equal(shop.wallet(shop.auth(`Bearer ${r.token}`)).gems, 300)
  assert.equal(code(() => shop.auth(`Bearer ${acc.id}.x`)), 'unauthorized')
  assert.equal(code(() => shop.recover(signJws(chain, txn(acc.id, { productId: 'gems_s' })), 'x')), 'not_restorable')
})

test('dev purchases exist only when the server enables them', () => {
  const { shop, acc } = setup()
  assert.equal(code(() => shop.devPurchase(acc, 'gems_l')), 'not_found')
  const d = setup({ devPurchases: true })
  assert.equal(d.shop.devPurchase(d.acc, 'gems_l').gems, 1300)
  assert.equal(code(() => d.shop.devPurchase(d.acc, 'gems_xxl')), 'unknown_product', 'xl/xxl packs are gone')
})
