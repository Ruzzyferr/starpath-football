import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fakeGoogle, makeChain, makeShop, note, signJws, txn } from './helpers.mjs'
import { createApp } from '../src/http.mjs'

const chain = makeChain()
const { shop } = makeShop(chain, { devPurchases: true })
const logs = []
const server = createApp({ shop, admob: null, origins: ['capacitor://localhost'], trustProxy: false, limits: { regPerMin: 6, regBurst: 6 }, rtdnToken: 'rtdn-secret', log: (...a) => logs.push(a.join(' ')) })
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}`
after(() => server.close())

const call = async (method, path, { body, token, headers = {}, raw } = {}) => {
  const r = await fetch(base + path, { method, headers: { ...(body !== undefined || raw ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) })
  return { status: r.status, body: await r.json().catch(() => null), headers: r.headers }
}

test('full flow over HTTP: register → buy (verified receipt) → spend → ad', async () => {
  const reg = await call('POST', '/v1/register', { body: { platform: 'ios' } })
  assert.equal(reg.status, 200)
  const tok = reg.body.token
  assert.equal((await call('GET', '/v1/wallet', { token: tok })).body.gems, 0)
  const buy = await call('POST', '/v1/purchase/apple', { token: tok, body: { jws: signJws(chain, txn(reg.body.accountId)) } })
  assert.equal(buy.body.gems, 600)
  const sp = await call('POST', '/v1/spend', { token: tok, body: { item: 'gold_boots', idem: 'x1' } })
  assert.equal(sp.body.gems, 400)
  assert.equal(sp.body.grant.id, 'gold_boots')
})

test('hardening: auth required, JSON only, body limit, unknown routes, no internals leaked', async () => {
  assert.equal((await call('GET', '/v1/wallet')).status, 401)
  assert.equal((await call('POST', '/v1/spend', { body: { item: 'gold_boots' } })).status, 401)
  assert.equal((await call('POST', '/v1/register', { raw: 'x', headers: { 'Content-Type': 'text/plain' } })).status, 415)
  assert.equal((await call('POST', '/v1/register', { raw: '{bad' })).status, 400)
  assert.equal((await call('POST', '/v1/register', { raw: JSON.stringify({ a: 'x'.repeat(40_000) }) })).status, 413)
  assert.equal((await call('GET', '/admin')).status, 404)
  assert.equal((await call('GET', '/../../etc/passwd')).status, 404)
  const r = await call('POST', '/v1/purchase/apple', { token: 'nope', body: { jws: 1 } })
  assert.deepEqual(r.body, { error: 'unauthorized' })
  const h = await call('GET', '/v1/health')
  assert.equal(h.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(h.headers.get('access-control-allow-origin'), null)
})

test('CORS answers only the app origins', async () => {
  const ok = await call('GET', '/v1/health', { headers: { Origin: 'capacitor://localhost' } })
  assert.equal(ok.headers.get('access-control-allow-origin'), 'capacitor://localhost')
  const evil = await call('GET', '/v1/health', { headers: { Origin: 'https://evil.example' } })
  assert.equal(evil.headers.get('access-control-allow-origin'), null)
})

test('rate limit: registration flood is throttled', async () => {
  const codes = []
  for (let i = 0; i < 10; i++) codes.push((await call('POST', '/v1/register', { body: {} })).status)
  assert.ok(codes.includes(429), codes.join(','))
})

// Registration is rate limited per IP above, so the tests below share accounts made directly.
const fresh = () => shop.register('t', 'android')

test('M8: health reports store readiness and the sandbox policy', async () => {
  const h = await call('GET', '/v1/health')
  assert.deepEqual(h.body, { ok: true, apple: true, google: false, sandbox: 'on' })
  const { token } = fresh()
  assert.deepEqual((await call('GET', '/v1/wallet', { token })).body.stores, { apple: true, google: false })
})

test('m1/m9/m11: bad notifications and bad earn types are 400; 401s are logged by IP', async () => {
  assert.equal((await call('POST', '/v1/apple/notifications', { raw: 'not json' })).status, 400)
  assert.equal((await call('POST', '/v1/apple/notifications', { body: { signedPayload: 'a.b.c' } })).status, 400)
  const { token } = fresh()
  assert.equal((await call('POST', '/v1/earn', { token, body: { source: ['motm'], ref: 'x' } })).status, 400)
  assert.equal((await call('POST', '/v1/earn', { token, body: { source: 'constructor', ref: 'x' } })).status, 400)
  await call('GET', '/v1/wallet', { token: 'bad' })
  assert.ok(logs.some((l) => l.startsWith('auth_fail ip=127.0.0.1')), logs.join('\n'))
})

test('m1: a large signed notification (nested JWS) fits the notification body limit', async () => {
  const { accountId } = fresh()
  const t = txn(accountId, { productId: 'gems_m', padding: 'p'.repeat(20_000) })
  const r = await call('POST', '/v1/apple/notifications', { body: { signedPayload: note(chain, 'REFUND', t) } })
  assert.equal(r.status, 200)
  assert.equal(r.body.tombstone, true)
})

test('m11: an oversized body gets 413 and the connection is closed', async () => {
  const r = await call('POST', '/v1/spend', { raw: JSON.stringify({ a: 'x'.repeat(40_000) }) })
  assert.equal(r.status, 413)
  assert.equal(r.headers.get('connection'), 'close')
  // A much bigger upload is cut off (the socket is destroyed, not drained).
  const big = await call('POST', '/v1/spend', { raw: 'x'.repeat(5_000_000) }).catch((e) => ({ status: e.cause?.code ?? 'error' }))
  assert.ok([413, 'ECONNRESET', 'UND_ERR_SOCKET', 'EPIPE'].includes(big.status), String(big.status))
})

test('M6: RTDN push needs the shared token and claws back a voided purchase', async () => {
  const data = (o) => ({ message: { data: Buffer.from(JSON.stringify(o)).toString('base64') } })
  const msg = { packageName: 'app.starpath.football', voidedPurchaseNotification: { purchaseToken: 'tok-1', orderId: 'GPA.1' } }
  assert.equal((await call('POST', '/v1/google/rtdn?token=wrong', { body: data(msg) })).status, 403)
  assert.equal((await call('POST', '/v1/google/rtdn', { body: data(msg) })).status, 403)
  const before = shop.google
  shop.google = fakeGoogle({}, { voided: [{ purchaseToken: 'tok-1' }] })
  try {
    const r = await call('POST', '/v1/google/rtdn?token=rtdn-secret', { body: data(msg) })
    assert.deepEqual([r.status, r.body.tombstone], [200, true])
    assert.equal((await call('POST', '/v1/google/rtdn?token=rtdn-secret', { body: { message: {} } })).status, 400)
  } finally {
    shop.google = before
  }
})

test('M7: recovery code over HTTP; M17: export and DELETE /v1/account', async () => {
  const { token, accountId } = fresh()
  const rc = await call('POST', '/v1/account/recovery-code', { token, body: {} })
  assert.equal(rc.status, 200)
  const r = await call('POST', '/v1/recover/code', { body: { code: rc.body.code } })
  assert.equal(r.body.accountId, accountId)
  assert.equal((await call('POST', '/v1/recover/code', { body: { code: rc.body.code } })).status, 404)
  const ex = await call('GET', '/v1/account/export', { token: r.body.token })
  assert.equal(ex.body.account.id, accountId)
  assert.equal(ex.body.devices, 2)
  const pre = await call('OPTIONS', '/v1/account', { headers: { Origin: 'capacitor://localhost' } })
  assert.match(pre.headers.get('access-control-allow-methods'), /DELETE/)
  assert.deepEqual((await call('DELETE', '/v1/account', { token })).body, { deleted: true })
  assert.equal((await call('GET', '/v1/wallet', { token: r.body.token })).status, 401)
})

test('contract over HTTP: spend career and ad ref/career reach the grant', async () => {
  const { token } = fresh()
  await call('POST', '/v1/purchase/dev', { token, body: { productId: 'gems_m' } })
  const sp = await call('POST', '/v1/spend', { token, body: { item: 'compression', idem: 'h1', career: 'car-9' } })
  assert.equal(sp.body.grant.c, 'car-9')
  const st = await call('POST', '/v1/ads/start', { token, body: { offer: 'match_bonus', ref: 'fx:12' } })
  assert.equal(st.status, 200)
  assert.equal((await call('POST', '/v1/ads/start', { token, body: { offer: 'match_bonus', ref: 'bad ref' } })).status, 400)
})

const MAIN = fileURLToPath(new URL('../src/main.mjs', import.meta.url))

test('M1: the server refuses to start when shop.db exists without its grant key', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sp-main-'))
  writeFileSync(join(dir, 'shop.db'), '')
  const r = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', MAIN], { env: { ...process.env, DATA_DIR: dir, PORT: '0' }, encoding: 'utf8', timeout: 10_000 })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /grant-key\.pem is missing/)
  const r2 = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', MAIN], { env: { ...process.env, DATA_DIR: mkdtempSync(join(tmpdir(), 'sp-main-')), PORT: '0', NODE_ENV: 'production', SANDBOX_POLICY: 'on' }, encoding: 'utf8', timeout: 10_000 })
  assert.equal(r2.status, 1)
  assert.match(r2.stderr, /not allowed in production/)
})
