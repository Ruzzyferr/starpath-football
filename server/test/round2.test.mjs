// Review round 2 fixes (ids from the review: M8, m2 … m31) and the economy changes.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { catalog, fakeGoogle, makeChain, makeShop, note, signJws, txn } from './helpers.mjs'
import { ShopError, codeBucket } from '../src/shop.mjs'
import { GooglePlay } from '../src/google.mjs'
import { createApp } from '../src/http.mjs'

const chain = makeChain()
const DAY = 86400_000
const YEAR = 365 * DAY
const sha = (s) => createHash('sha256').update(s).digest('hex')

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
const buy = (shop, acc, productId, over = {}) => shop.applePurchase(acc, signJws(chain, txn(acc.id, { productId, ...over })))
const newAcc = (shop, ip = '9.9.9.9') => shop.auth(`Bearer ${shop.register(ip).token}`)
const count = (db, sql, ...a) => db.prepare(sql).get(...a).n

// ───────── Economy ─────────

test('economy: xl/xxl packs gone, new prices and earn amounts, cashPerSeason and refundHold in the wallet', () => {
  assert.deepEqual(Object.keys(catalog.products).filter((k) => k.startsWith('gems_')), ['gems_s', 'gems_m', 'gems_l'])
  assert.ok(!JSON.stringify(catalog).toLowerCase().includes('best'))
  const { shop, acc } = setup()
  const w = shop.wallet(acc)
  // Stat gear by tier (2026-10-19 redesign): Standard 60, Pro 100, Elite 200, Legend 300; compression 80.
  assert.deepEqual(w.prices, {
    classic_boots: 60, sprint_boots: 60, grip_boots: 60, training_gloves: 60, compression: 80,
    striker_boots: 100, speed_boots: 100, playmaker_boots: 100, aerial_boots: 100, keeper_gloves: 100, mind_band: 100,
    gold_boots: 200, dribbler_boots: 200, sweeper_boots: 200, freekick_boots: 200, elite_gloves: 200,
    legend_striker: 300, legend_maestro: 300, legend_wall: 300, legend_gloves: 300,
    physio: 100, gems_to_cash: 100, cos_celebrations: 250, cos_avatar: 250,
  })
  assert.equal(catalog.spend.physio.discounted, 50)
  assert.deepEqual(Object.fromEntries(Object.entries(catalog.earn).map(([k, v]) => [k, [v.gems, v.perDay]])), { motm: [8, 10], objective: [8, 10], season: [100, 2], award: [25, 6], first: [10, 10] })
  assert.equal(catalog.limits.earnPerDay, 300)
  assert.equal(w.limits.cashPerSeason, 200000)
  assert.equal(w.refundHold, false)
  assert.equal(code(() => buy(shop, acc, 'gems_xl')), 'unknown_product')
})

// ───────── M8 / m19 / m31: retention and health ─────────

test('M8/m19: prune removes stale empty accounts with their rows; keeps buyers, holders and active ones', () => {
  const { shop, db, clock } = makeShop(chain)
  const empty = newAcc(shop)
  shop.recoveryCode(empty, 'ip')
  const t = shop.adStart(empty, 'match_bonus')
  shop.adAbort(empty, t.nonce)
  const spender = newAcc(shop) // earned then spent everything: ledger sums to 0
  clock.advance(DAY)
  for (let i = 0; i < 3; i++) shop.earn(spender, { source: 'award', ref: `a${i}` }) // 75
  shop.earn(spender, { source: 'first', ref: 'f' }) // 85
  shop.spend(spender, { item: 'compression', idem: 's' }) // 5 left
  shop.earn(spender, { source: 'objective', ref: 'o' }) // 13
  const holder = newAcc(shop)
  shop.earn(holder, { source: 'motm', ref: 'm' })
  const buyer = newAcc(shop)
  buy(shop, buyer, 'gems_s')
  shop.spend(buyer, { item: 'compression', idem: 'x' })
  shop.spend(buyer, { item: 'compression', idem: 'y' }) // 60 left
  const active = newAcc(shop)
  clock.advance(31 * DAY)
  shop.auth(`Bearer ${shop.register('x').token}`) // a fresh account is too young
  // `active` signs in now: seen within 30 days.
  const activeTok = db.prepare('SELECT 1 FROM account_tokens WHERE account = ?').get(active.id)
  assert.ok(activeTok)
  db.prepare('UPDATE accounts SET seen = ? WHERE id = ?').run(clock.now(), active.id)
  const r = shop.prune()
  assert.equal(r.accounts, 1, JSON.stringify(r))
  for (const t of ['accounts', 'account_tokens', 'recovery', 'ads', 'daily', 'counters', 'earn_refs', 'ledger']) {
    const col = t === 'accounts' ? 'id' : 'account'
    assert.equal(count(db, `SELECT COUNT(*) AS n FROM ${t} WHERE ${col} = ?`, empty.id), 0, t)
  }
  for (const a of [spender, holder, buyer, active]) assert.ok(shop.account(a.id), 'kept')
  // Spender: gems 13 > 0. Zero it to test the "ledger sums to zero" path after another 30 idle days.
  db.prepare('UPDATE accounts SET gems = 0 WHERE id = ?').run(spender.id)
  db.prepare("INSERT INTO ledger (account, delta, balance, why, ref, at) VALUES (?, -13, 0, 'test', NULL, ?)").run(spender.id, clock.now() - 40 * DAY)
  // The spend grant is still open (not applied): the account stays until it is applied.
  assert.equal(shop.prune().accounts, 0)
  db.prepare('UPDATE grants SET acked = 1 WHERE account = ?').run(spender.id)
  assert.equal(shop.prune().accounts, 1)
  assert.equal(shop.account(spender.id), undefined)
})

test('m19: earn_refs pruned after 400 days; non-buyer ledger refs anonymised; txns deleted after 7 years', () => {
  const { shop, db, clock, acc } = setup()
  shop.earn(acc, { source: 'motm', ref: 'c1:w1' })
  buy(shop, acc, 'gems_s') // a buyer: ledger refs stay
  const other = newAcc(shop)
  shop.earn(other, { source: 'motm', ref: 'c2:w1' })
  clock.advance(401 * DAY)
  shop.auth(`Bearer ${shop.register('k').token}`)
  const r = shop.prune()
  assert.equal(r.earnRefs, 2)
  assert.equal(count(db, 'SELECT COUNT(*) AS n FROM ledger WHERE account = ? AND ref IS NOT NULL', other.id), 0)
  assert.ok(count(db, 'SELECT COUNT(*) AS n FROM ledger WHERE account = ? AND ref IS NOT NULL', acc.id) >= 1)
  assert.equal(count(db, 'SELECT COUNT(*) AS n FROM txns'), 1)
  clock.advance(7 * YEAR)
  assert.equal(shop.prune().txns, 1)
})

test('m31: health checks the database and disk; ops details only on request', () => {
  const { shop, acc } = setup({ dataDir: mkdtempSync(join(tmpdir(), 'sp-h-')) })
  buy(shop, acc, 'gems_s')
  const h = shop.health()
  assert.equal(h.ok, true)
  assert.equal(h.ops, undefined)
  const o = shop.health({ ops: true }).ops
  assert.equal(o.db, true)
  assert.ok(o.disk.totalBytes > 0 && o.disk.freePct >= 0)
  assert.equal(o.rows.accounts, 1)
  assert.equal(o.rows.txns, 1)
  assert.equal(o.sandboxToday, 1)
  shop.disk = () => ({ freeBytes: 10, totalBytes: 1000, freePct: 1 })
  assert.equal(shop.health().ok, false, 'a full disk fails the health check')
})

// ───────── m2 / m3: subscription refunds and reversals ─────────

test('m2: refunding one subscription period keeps the pass to the latest remaining paid period', () => {
  const { shop, acc, clock, db } = setup()
  const p1 = txn(acc.id, { productId: 'pro_contract', expiresDate: clock.now() + 10 * DAY })
  const p2 = { ...p1, transactionId: 'p2-renewal', expiresDate: clock.now() + 40 * DAY }
  shop.applePurchase(acc, signJws(chain, p1))
  shop.applePurchase(acc, signJws(chain, p2))
  assert.equal(db.prepare("SELECT expires FROM txns WHERE txn_id = 'p2-renewal'").get().expires, p2.expiresDate)
  // Refund of the older period: the newer one still runs.
  shop.appleNotification(note(chain, 'REFUND', p1))
  assert.deepEqual([shop.wallet(acc).pass.until, shop.wallet(acc).pass.active], [p2.expiresDate, true])
  assert.ok(shop.wallet(acc).entitlements.includes('pro_contract'))
  // Refund of the newer period while the older one is refunded too: nothing remains.
  shop.appleNotification(note(chain, 'REFUND', p2))
  assert.deepEqual([shop.wallet(acc).pass.until, shop.wallet(acc).pass.active], [0, false])
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM entitlements WHERE product = 'pro_contract'").get().n, 0)
})

test('m2: refunding the newest period falls back to the previous expiry', () => {
  const { shop, acc, clock } = setup()
  const p1 = txn(acc.id, { productId: 'pro_contract', expiresDate: clock.now() + 10 * DAY })
  const p2 = { ...p1, transactionId: 'p2', expiresDate: clock.now() + 40 * DAY }
  shop.applePurchase(acc, signJws(chain, p1))
  shop.applePurchase(acc, signJws(chain, p2))
  shop.appleNotification(note(chain, 'REFUND', p2))
  assert.equal(shop.wallet(acc).pass.until, p1.expiresDate)
  assert.ok(shop.wallet(acc).entitlements.includes('pro_contract'))
})

test('m3: REFUND_REVERSED gives back diamonds once, the pass, and clears a tombstone', () => {
  const { shop, acc, clock, db } = setup()
  const g = txn(acc.id, { productId: 'gems_m' })
  shop.applePurchase(acc, signJws(chain, g))
  shop.appleNotification(note(chain, 'REFUND', g))
  assert.equal(shop.wallet(acc).gems, 0)
  assert.equal(shop.appleNotification(note(chain, 'REFUND_REVERSED', g)).handled, true)
  assert.equal(shop.wallet(acc).gems, 600)
  assert.equal(shop.appleNotification(note(chain, 'REFUND_REVERSED', g)).handled, false, 'once')
  assert.equal(shop.wallet(acc).gems, 600)
  assert.equal(shop.counter(acc.id, 'refunds'), 0)
  // Refunded again after the reversal: taken again, and reversible again.
  shop.appleNotification(note(chain, 'REFUND', g))
  assert.equal(shop.wallet(acc).gems, 0)
  shop.appleNotification(note(chain, 'REFUND_REVERSED', g))
  assert.equal(shop.wallet(acc).gems, 600)
  // Pass.
  const p = txn(acc.id, { productId: 'pro_contract', expiresDate: clock.now() + 20 * DAY })
  shop.applePurchase(acc, signJws(chain, p))
  shop.appleNotification(note(chain, 'REFUND', p))
  assert.equal(shop.wallet(acc).pass.active, false)
  shop.appleNotification(note(chain, 'REFUND_REVERSED', p))
  assert.deepEqual([shop.wallet(acc).pass.active, shop.wallet(acc).pass.until], [true, p.expiresDate])
  assert.ok(shop.wallet(acc).entitlements.includes('pro_contract'))
  // Cash pack: the withdrawn grant comes back to the inbox.
  const c = txn(acc.id, { productId: 'cash_s' })
  shop.applePurchase(acc, signJws(chain, c))
  shop.appleNotification(note(chain, 'REFUND', c))
  assert.equal(shop.wallet(acc).inbox.length, 0)
  shop.appleNotification(note(chain, 'REFUND_REVERSED', c))
  assert.equal(shop.wallet(acc).inbox.length, 1)
  // A refund before the purchase was redeemed (tombstone), then reversed: the receipt credits.
  const late = txn(acc.id, { productId: 'gems_s' })
  shop.appleNotification(note(chain, 'REFUND', late))
  assert.equal(code(() => shop.applePurchase(acc, signJws(chain, late))), 'revoked')
  assert.equal(shop.appleNotification(note(chain, 'REFUND_REVERSED', late)).handled, true)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tombstones').get().n, 0)
  assert.equal(shop.applePurchase(acc, signJws(chain, late)).credited, true)
})

test('m3: a reversed Starter Pack refund restores the pack, unless another was bought since', () => {
  const { shop, acc } = setup()
  const s1 = txn(acc.id, { productId: 'starter_pack' })
  shop.applePurchase(acc, signJws(chain, s1))
  shop.appleNotification(note(chain, 'REFUND', s1))
  assert.deepEqual([shop.wallet(acc).starter, shop.wallet(acc).gems, shop.wallet(acc).inbox.length], [false, 0, 0])
  shop.appleNotification(note(chain, 'REFUND_REVERSED', s1))
  assert.deepEqual([shop.wallet(acc).starter, shop.wallet(acc).gems, shop.wallet(acc).inbox.length], [true, 300, 1])
  const b = setup()
  const t1 = txn(b.acc.id, { productId: 'starter_pack' })
  b.shop.applePurchase(b.acc, signJws(chain, t1))
  b.shop.appleNotification(note(chain, 'REFUND', t1))
  b.shop.applePurchase(b.acc, signJws(chain, txn(b.acc.id, { productId: 'starter_pack' }))) // bought again
  b.shop.appleNotification(note(chain, 'REFUND_REVERSED', t1))
  assert.deepEqual([b.shop.wallet(b.acc).gems, b.shop.wallet(b.acc).inbox.length], [300, 1], 'no second pair, no double diamonds')
})

// ───────── m4 ─────────

test('m4: a cancelled Play subscription still counts until its expiry', async () => {
  let now = Date.parse('2026-10-01T00:00:00Z')
  const sub = (state, expiry) => async (url) => new Response(JSON.stringify({ subscriptionState: state, lineItems: [{ productId: 'pro_contract', expiryTime: expiry }], latestOrderId: 'GPA.1' }), { status: 200 })
  const make = (f) => {
    const gp = new GooglePlay({ packageName: 'p', fetchImpl: f, now: () => now })
    gp.sa = {}
    gp.token = { value: 'x', exp: Date.now() + 3600_000 }
    return gp
  }
  assert.equal((await make(sub('SUBSCRIPTION_STATE_CANCELED', '2026-10-20T00:00:00Z')).verifySubscription('t')).ok, true)
  assert.equal((await make(sub('SUBSCRIPTION_STATE_CANCELED', '2026-09-20T00:00:00Z')).verifySubscription('t')).ok, false)
  assert.equal((await make(sub('SUBSCRIPTION_STATE_EXPIRED', '2026-10-20T00:00:00Z')).verifySubscription('t')).ok, false)
  now += 30 * DAY
  assert.equal((await make(sub('SUBSCRIPTION_STATE_CANCELED', '2026-10-20T00:00:00Z')).verifySubscription('t')).ok, false)
})

// ───────── m5 ─────────

test('m5: a second Starter Pack returns credited:false, already_owned, and is audited', () => {
  const { shop, acc, db } = setup()
  assert.equal(buy(shop, acc, 'starter_pack').credited, true)
  const r = buy(shop, acc, 'starter_pack')
  assert.deepEqual([r.credited, r.reason, r.gems], [false, 'already_owned', 300])
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM audit WHERE event = 'starter_repeat' AND account = ?").get(acc.id).n, 1)
})

// ───────── m6 ─────────

test('m6: capped sandbox counts every product kind per account and has a global daily budget', () => {
  const { shop, acc, clock } = setup({ sandbox: { policy: 'capped', globalDaily: 5 } })
  shop.sandbox.txnCap = 3
  buy(shop, acc, 'cash_s')
  buy(shop, acc, 'pro_contract', { expiresDate: clock.now() + DAY })
  shop.applePurchase(acc, signJws(chain, txn(acc.id, { productId: 'pack_avatar' })))
  assert.equal(code(() => buy(shop, acc, 'gems_s')), 'sandbox_cap', 'cash, pass and cosmetics count')
  const b = newAcc(shop)
  buy(shop, b, 'gems_s')
  buy(shop, b, 'gems_s')
  const c = newAcc(shop)
  assert.equal(code(() => buy(shop, c, 'gems_s')), 'sandbox_cap', 'global budget: 5 a day')
  assert.equal(buy(shop, c, 'gems_s', { environment: 'Production' }).credited, true, 'real purchases are not counted')
  clock.advance(DAY)
  assert.equal(buy(shop, c, 'gems_s').credited, true, 'a new day')
})

// ───────── m7 ─────────

test('m7: recovery needs a receipt the account already redeemed; capped sandbox cannot recover', async () => {
  const { shop, acc, clock } = setup()
  const never = txn(acc.id, { productId: 'starter_pack' })
  assert.equal(code(() => shop.recover(signJws(chain, never), 'ip')), 'unknown_receipt')
  shop.applePurchase(acc, signJws(chain, never))
  assert.equal(shop.recover(signJws(chain, never), 'ip').accountId, acc.id)
  // A renewal of a redeemed subscription matches by original transaction id.
  const p1 = txn(acc.id, { productId: 'pro_contract', expiresDate: clock.now() + 10 * DAY })
  shop.applePurchase(acc, signJws(chain, p1))
  assert.equal(shop.recover(signJws(chain, { ...p1, transactionId: 'renewal-x', expiresDate: clock.now() + 40 * DAY }), 'ip').accountId, acc.id)
  // capped: sandbox purchases are fine, sandbox recovery is not.
  shop.sandbox.policy = 'capped'
  assert.equal(code(() => shop.recover(signJws(chain, never), 'ip')), 'sandbox_receipt')
  shop.sandbox = { ...shop.sandbox, policy: 'testers', testers: new Set([acc.id]) }
  assert.equal(shop.recover(signJws(chain, never), 'ip').accountId, acc.id)
  // Google: the token or order id must be one this account redeemed.
  shop.sandbox.policy = 'on'
  shop.google = fakeGoogle({ ts: { orderId: 'GPA.1', account: acc.id }, tu: { orderId: 'GPA.2', account: acc.id } })
  await shop.googlePurchase(acc, { productId: 'starter_pack', purchaseToken: 'ts' })
  assert.equal((await shop.recoverGoogle({ productId: 'starter_pack', purchaseToken: 'ts' }, 'ip')).accountId, acc.id)
  assert.equal(await acode(shop.recoverGoogle({ productId: 'starter_pack', purchaseToken: 'tu' }, 'ip')), 'unknown_receipt')
})

// ───────── m12 ─────────

test('m12: aborting an ad frees its slot; starting the same offer again reuses the open session', () => {
  const { shop, acc, clock } = setup()
  const a = shop.adStart(acc, 'match_bonus', 'fx1')
  const again = shop.adStart(acc, 'match_bonus', 'fx2')
  assert.equal(again.nonce, a.nonce)
  assert.equal(again.reused, true)
  assert.equal(code(() => shop.adComplete(acc, a.nonce)), 'ad_too_short', 'the watch timer restarts on reuse')
  clock.advance(6000)
  assert.equal(shop.adComplete(acc, a.nonce).grant.ref, 'fx2')
  // Three dismissed ads no longer lock the offers.
  for (const offer of ['gems', 'train_boost', 'physio_disc']) {
    const s = shop.adStart(acc, offer)
    assert.deepEqual(shop.adAbort(acc, s.nonce), { aborted: true })
    assert.equal(code(() => shop.adComplete(acc, s.nonce)), 'ad_aborted')
  }
  for (const offer of ['gems', 'train_boost', 'physio_disc']) assert.equal(code(() => shop.adStart(acc, offer)), 'ok')
  assert.equal(code(() => shop.adAbort(acc, a.nonce)), 'already_rewarded')
  assert.equal(code(() => shop.adAbort(acc, 'f'.repeat(32))), 'no_ad_session')
  assert.equal(code(() => shop.adAbort(acc, 'nope')), 'bad_request')
})

test('m12: an aborted session confirmed by SSV can still be rewarded', () => {
  const { shop, acc, clock } = setup({ ads: { requireSsv: true } })
  const s = shop.adStart(acc, 'gems')
  shop.adAbort(acc, s.nonce)
  shop.adSsv({ custom_data: `${acc.id}:${s.nonce}`, transaction_id: 'ssv-m12', timestamp: String(clock.now()) })
  clock.advance(1000)
  assert.equal(shop.adComplete(acc, s.nonce).gems, 10)
})

// ───────── m15 ─────────

test('m15: new accounts get half the free caps for 24 hours', () => {
  const { shop, acc, clock } = setup()
  for (let i = 0; i < 10; i++) shop.earn(acc, { source: 'motm', ref: `m${i}` })
  assert.equal(shop.wallet(acc).gems, 5 * 8, 'motm 10/day → 5')
  assert.equal(shop.wallet(acc).ads.gems.max, 3)
  for (let i = 0; i < 3; i++) {
    const { nonce } = shop.adStart(acc, 'gems')
    clock.advance(6000)
    shop.adComplete(acc, nonce)
  }
  assert.equal(code(() => shop.adStart(acc, 'gems')), 'ad_cap')
  assert.equal(shop.wallet(acc).ads.match_bonus.max, 6, 'ads that pay no diamonds are not ramped')
  clock.advance(DAY)
  assert.equal(shop.wallet(acc).ads.gems.max, 5)
})

test('m15: one address (IPv6 by /64) earns at most 600 free diamonds a day across accounts', () => {
  const { shop, clock } = makeShop(chain)
  clock.advance(0)
  const accs = Array.from({ length: 10 }, () => newAcc(shop))
  clock.advance(DAY)
  let total = 0
  accs.forEach((a, i) => {
    const ip = `2001:db8:1:2::${i + 1}`
    total += shop.earn(a, { source: 'season', ref: 's1' }, ip).earned
  })
  assert.equal(total, 600)
  const r = shop.earn(accs[9], { source: 'award', ref: 'a' }, '2001:db8:1:2:ffff::9')
  assert.deepEqual([r.earned, r.capped], [0, true])
  assert.equal(code(() => shop.adStart(accs[0], 'gems', undefined, '2001:db8:1:2::77')), 'ad_cap')
  assert.equal(shop.earn(accs[9], { source: 'award', ref: 'a' }, '2001:db8:1:3::1').earned, 25, 'another /64')
  assert.equal(code(() => shop.adStart(accs[0], 'match_bonus', undefined, '2001:db8:1:2::77')), 'ok', 'no-diamond ads are not limited')
  clock.advance(DAY)
  assert.equal(shop.earn(accs[9], { source: 'season', ref: 's2' }, '2001:db8:1:2::9').earned, 100, 'resets daily')
})

// ───────── m16 ─────────

test('m16: three refunds put the account on refund hold (no spends, no ads; purchases allowed)', () => {
  const { shop, acc, clock } = setup()
  clock.advance(DAY)
  for (let i = 0; i < 3; i++) {
    buy(shop, acc, 'gems_s')
    const t = txn(acc.id, { productId: 'cash_s' })
    shop.applePurchase(acc, signJws(chain, t))
    shop.appleNotification(note(chain, 'REFUND', t))
  }
  assert.equal(shop.counter(acc.id, 'refunds'), 3)
  const w = shop.wallet(acc)
  assert.deepEqual([w.gems, w.refundHold], [660, true])
  assert.equal(code(() => shop.spend(acc, { item: 'compression', idem: 'h' })), 'refund_hold')
  assert.equal(code(() => shop.adStart(acc, 'gems')), 'refund_hold')
  assert.equal(buy(shop, acc, 'gems_s').credited, true)
  assert.equal(shop.earn(acc, { source: 'motm', ref: 'x' }).earned, 8, 'free claims still count')
})

test('m16: a negative balance holds ads too, until it is paid back', () => {
  const { shop, acc, clock } = setup()
  clock.advance(DAY)
  const t = txn(acc.id, { productId: 'gems_s' })
  shop.applePurchase(acc, signJws(chain, t))
  shop.spend(acc, { item: 'gold_boots', idem: 'g' })
  const s = shop.adStart(acc, 'gems')
  shop.appleNotification(note(chain, 'REFUND', t))
  clock.advance(6000)
  assert.equal(code(() => shop.adComplete(acc, s.nonce)), 'refund_hold')
  buy(shop, acc, 'gems_s') // -200 + 220
  assert.equal(shop.wallet(acc).refundHold, false)
  assert.equal(code(() => shop.adStart(acc, 'gems')), 'ok')
})

// ───────── m9: void a spend grant ─────────

test('m9: an unacked spend grant can be voided once for its diamonds; purchase/ad grants cannot', () => {
  const { shop, acc, clock } = setup()
  buy(shop, acc, 'gems_m') // 600
  const g = shop.spend(acc, { item: 'gold_boots', idem: 'v1', career: 'car_gone' }).grant
  assert.equal(shop.wallet(acc).gems, 400)
  clock.advance(15 * 60_000) // round 3 (m11): voids need a grant at least 15 minutes old
  const r = shop.voidGrant(acc, g.nonce)
  assert.deepEqual([r.voided, r.refunded, r.gems, r.inbox.length], [true, 200, 600, 0])
  const again = shop.voidGrant(acc, g.nonce)
  assert.deepEqual([again.voided, again.refunded, again.gems], [true, 0, 600], 'a retry refunds nothing')
  shop.ack(acc, [g.nonce])
  assert.equal(shop.voidGrant(acc, g.nonce).gems, 600, 'an ack after the void changes nothing')
  assert.equal(code(() => shop.spend(acc, { item: 'gold_boots', idem: 'v1' })), 'grant_voided', 'the old idempotency key cannot fetch the grant again')
  // A discounted physio returns what was paid.
  const { nonce } = shop.adStart(acc, 'physio_disc')
  clock.advance(6000)
  shop.adComplete(acc, nonce)
  const ph = shop.spend(acc, { item: 'physio', idem: 'v2', discount: true }).grant
  clock.advance(15 * 60_000)
  assert.equal(shop.voidGrant(acc, ph.nonce).refunded, 50)
  // Cosmetic: the entitlement goes with the refund.
  const cos = shop.spend(acc, { item: 'cos_avatar', idem: 'v3' }).grant
  assert.ok(shop.wallet(acc).entitlements.includes('pack_avatar'))
  clock.advance(15 * 60_000)
  assert.ok(!shop.voidGrant(acc, cos.nonce).entitlements.includes('pack_avatar'))
  // Not voidable / already applied / unknown.
  const applied = shop.spend(acc, { item: 'compression', idem: 'v4' }).grant
  shop.ack(acc, [applied.nonce])
  assert.equal(code(() => shop.voidGrant(acc, applied.nonce)), 'already_acked')
  buy(shop, acc, 'cash_s')
  const cash = shop.wallet(acc).inbox.find((x) => x.k === 'cash')
  assert.equal(code(() => shop.voidGrant(acc, cash.nonce)), 'not_voidable')
  const mb = shop.adStart(acc, 'match_bonus')
  clock.advance(6000)
  assert.equal(code(() => shop.voidGrant(acc, shop.adComplete(acc, mb.nonce).grant.nonce)), 'not_voidable')
  assert.equal(code(() => shop.voidGrant(acc, 'nope')), 'no_grant')
  assert.equal(code(() => shop.voidGrant(acc, 5)), 'bad_request')
  const other = newAcc(shop)
  const g2 = shop.spend(acc, { item: 'compression', idem: 'v5' }).grant
  assert.equal(code(() => shop.voidGrant(other, g2.nonce)), 'no_grant', 'only the owner')
})

// ───────── HTTP: new routes, RTDN header, ops token, auth-fail logging, code buckets ─────────

const logs = []
const H = makeShop(chain, { dataDir: mkdtempSync(join(tmpdir(), 'sp-h2-')) })
const server = createApp({ shop: H.shop, admob: null, origins: [], trustProxy: true, rtdnToken: 'rtdn-secret', opsToken: 'ops-secret', limits: { regPerMin: 100, regBurst: 100, regGlobalPerMin: 4, authFailBurst: 3 }, log: (...a) => logs.push(a.join(' ')) })
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}`
after(() => server.close())
const call = async (method, path, { body, token, headers = {} } = {}) => {
  const r = await fetch(base + path, { method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: body !== undefined ? JSON.stringify(body) : undefined })
  return { status: r.status, body: await r.json().catch(() => null) }
}

test('http: health ops details need the OPS_TOKEN header', async () => {
  assert.equal((await call('GET', '/v1/health')).body.ops, undefined)
  assert.equal((await call('GET', '/v1/health', { headers: { 'X-Ops-Token': 'wrong' } })).body.ops, undefined)
  const h = await call('GET', '/v1/health', { headers: { 'X-Ops-Token': 'ops-secret' } })
  assert.equal(h.status, 200)
  assert.equal(h.body.ops.db, true)
  assert.equal(typeof h.body.ops.rows.accounts, 'number')
  const disk = H.shop.disk
  H.shop.disk = () => ({ freeBytes: 1, totalBytes: 100, freePct: 1 })
  try {
    assert.equal((await call('GET', '/v1/health')).status, 503)
  } finally {
    H.shop.disk = disk
  }
})

test('http: the global registration bucket is configurable (default 600/min)', async () => {
  const codes = []
  for (let i = 0; i < 6; i++) codes.push((await call('POST', '/v1/register', { body: {}, headers: { 'X-Forwarded-For': `10.0.${i}.1` } })).status)
  assert.deepEqual(codes, [200, 200, 200, 200, 429, 429])
})

test('http: void and abort routes; earn and ad diamonds are capped per address', async () => {
  const { token, accountId } = H.shop.register('t')
  const acc = H.shop.auth(`Bearer ${token}`)
  H.shop.applePurchase(acc, signJws(chain, txn(accountId, { productId: 'gems_m' })))
  const sp = await call('POST', '/v1/spend', { token, body: { item: 'compression', idem: 'h1', career: 'c' } })
  assert.deepEqual((await call('POST', '/v1/inbox/void', { token, body: { nonce: sp.body.grant.nonce } })).body, { error: 'too_early' })
  H.clock.advance(15 * 60_000)
  const v = await call('POST', '/v1/inbox/void', { token, body: { nonce: sp.body.grant.nonce } })
  assert.deepEqual([v.status, v.body.voided, v.body.gems], [200, true, 600])
  assert.equal((await call('POST', '/v1/inbox/void', { token, body: { nonce: 'x' } })).body.error, 'no_grant')
  const st = await call('POST', '/v1/ads/start', { token, body: { offer: 'gems' } })
  assert.deepEqual((await call('POST', '/v1/ads/abort', { token, body: { nonce: st.body.nonce } })).body, { aborted: true })
  const e = await call('POST', '/v1/earn', { token, body: { source: 'motm', ref: 'r1' }, headers: { 'X-Forwarded-For': '203.0.113.5' } })
  assert.equal(e.body.earned, 8)
  assert.equal(H.shop.ipCount(H.shop.ipBucket('203.0.113.5')), 8)
})

test('http (m17): RTDN secret accepted from the X-RTDN-Token header or the query', async () => {
  const data = { message: { data: Buffer.from(JSON.stringify({ packageName: 'app.starpath.football', voidedPurchaseNotification: { purchaseToken: 'tok-h', orderId: 'GPA.h' } })).toString('base64') } }
  H.shop.google = fakeGoogle({}, { voided: [{ purchaseToken: 'tok-h' }] })
  try {
    assert.equal((await call('POST', '/v1/google/rtdn', { body: data, headers: { 'X-RTDN-Token': 'nope' } })).status, 403)
    assert.equal((await call('POST', '/v1/google/rtdn', { body: data, headers: { 'X-RTDN-Token': 'rtdn-secret' } })).status, 200)
    assert.equal((await call('POST', '/v1/google/rtdn?token=rtdn-secret', { body: data })).status, 200)
  } finally {
    H.shop.google = undefined
  }
})

test('http (m30): auth failures log the account id prefix; a flood on one account answers 429', async () => {
  const id = 'abcdef01-0000-4000-8000-000000000000'
  const statuses = []
  for (let i = 0; i < 5; i++) statuses.push((await call('GET', '/v1/wallet', { token: `${id}.${'A'.repeat(43)}`, headers: { 'X-Forwarded-For': `10.9.${i}.1` } })).status)
  assert.deepEqual(statuses, [401, 401, 401, 429, 429])
  assert.ok(logs.some((l) => /^auth_fail ip=10\.9\.0\.1 acct=abcdef01 GET \/v1\/wallet$/.test(l)), logs.join('\n'))
  assert.ok(logs.some((l) => l === 'auth_flood acct=abcdef01'))
})

test('m30: recovery-code attempts are bucketed by a prefix of the code hash', () => {
  assert.equal(codeBucket('nope'), null)
  const b = codeBucket('abcd-efgh-jkmn-pqrs')
  assert.equal(b, sha('ABCDEFGHJKMNPQRS').slice(0, 2))
  assert.equal(codeBucket(' ABCD EFGH JKMN PQRS '), b)
})
