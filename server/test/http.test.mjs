import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { makeChain, makeShop, signJws, txn } from './helpers.mjs'
import { createApp } from '../src/http.mjs'

const chain = makeChain()
const { shop } = makeShop(chain, { devPurchases: true })
const server = createApp({ shop, admob: null, origins: ['capacitor://localhost'], trustProxy: false, limits: { regPerMin: 6, regBurst: 6 } })
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
  assert.equal(sp.body.gems, 300)
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
