// Entry point. Config from the environment (systemd EnvironmentFile on the server, see deploy/).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync } from 'node:crypto'
import { openDb } from './db.mjs'
import { SANDBOX_POLICIES, Shop, keyId } from './shop.mjs'
import { GooglePlay } from './google.mjs'
import { AdMobVerifier } from './admob.mjs'
import { createApp } from './http.mjs'

const env = process.env
const log = (...a) => console.error(new Date().toISOString(), ...a)
const fail = (msg) => {
  console.error(`starpath: ${msg}`)
  process.exit(1)
}
const production = env.NODE_ENV === 'production'
const dataDir = env.DATA_DIR ?? './data'
mkdirSync(dataDir, { recursive: true, mode: 0o700 })

// Ed25519 keys that sign grants; never leave the server (except the operator's encrypted copy).
// The app pins public keys by key id (kid), so a database without its key is a broken restore:
// refuse to start rather than silently minting a new key that no installed app trusts.
// Rotation: GRANT_KEY_FILES=new.pem,old.pem — the first signs, the others stay published in
// GET /v1/keys until no installed app needs them. Without it: DATA_DIR/grant-key.pem.
const dbFile = join(dataDir, 'shop.db')
let keyFiles = (env.GRANT_KEY_FILES ?? '').split(',').map((s) => s.trim()).filter(Boolean)
if (keyFiles.length) {
  for (const f of keyFiles) if (!existsSync(f)) fail(`GRANT_KEY_FILES: ${f} is missing (restore it from the encrypted key backup, see deploy/README.md)`)
} else {
  const keyFile = join(dataDir, 'grant-key.pem')
  if (!existsSync(keyFile)) {
    if (existsSync(dbFile)) fail(`${dbFile} exists but ${keyFile} is missing: restore the grant key from the backup (see deploy/README.md)`)
    const { privateKey } = generateKeyPairSync('ed25519')
    writeFileSync(keyFile, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 })
  }
  keyFiles = [keyFile]
}
const [signKey, ...oldKeys] = keyFiles.map((f) => {
  const k = createPrivateKey(readFileSync(f))
  if (k.asymmetricKeyType !== 'ed25519') fail(`${f} is not an Ed25519 key`)
  return k
})
writeFileSync(join(dataDir, 'grant-pub.pem'), createPublicKey(signKey).export({ type: 'spki', format: 'pem' }))
log('grant keys', `signing kid=${keyId(signKey)}`, oldKeys.length ? `also published: ${oldKeys.map(keyId).join(',')}` : '')

if (env.DEV_PURCHASES === '1' && production) fail('DEV_PURCHASES is not allowed in production')

// Store test purchases: SANDBOX_POLICY = off | testers (SANDBOX_TESTERS=id,id) | capped (SANDBOX_CAP
// diamonds per account, lifetime) | on (development only). Production defaults to off.
const policy = env.SANDBOX_POLICY || (production ? 'off' : env.ALLOW_SANDBOX === '1' ? 'on' : 'off')
if (!SANDBOX_POLICIES.includes(policy)) fail(`SANDBOX_POLICY must be one of ${SANDBOX_POLICIES.join(', ')}`)
if (production && policy === 'on') fail('SANDBOX_POLICY=on is not allowed in production (use testers or capped)')
if (production && env.ALLOW_SANDBOX === '1' && !env.SANDBOX_POLICY) log('warn', 'ALLOW_SANDBOX is ignored in production; set SANDBOX_POLICY')
// SANDBOX_UNTIL (ISO date): after it, 'capped' and 'testers' behave as 'off' without a redeploy.
let sandboxUntil
if (env.SANDBOX_UNTIL) {
  sandboxUntil = Date.parse(env.SANDBOX_UNTIL)
  if (!Number.isFinite(sandboxUntil)) fail('SANDBOX_UNTIL must be an ISO date, e.g. 2026-12-01T00:00:00Z')
}
if (policy === 'capped' || policy === 'testers') {
  const until = sandboxUntil != null ? new Date(sandboxUntil).toISOString() : null
  if (until && sandboxUntil <= Date.now()) log('sandbox', `policy ${policy} ended at ${until}: behaving as off`)
  else if (until) log('warn', `sandbox policy ${policy} is active until ${until}, then off`)
  else log('warn', `sandbox policy ${policy} is active with no SANDBOX_UNTIL: set one before public launch`)
}

const catalog = JSON.parse(readFileSync(new URL('../catalog.json', import.meta.url), 'utf8'))
// Test servers only: scale the daily caps (an e2e run plays a whole season in seconds). Never in production.
const scale = Number(env.LIMITS_SCALE) || 1
if (scale !== 1) {
  if (env.NODE_ENV === 'production') throw new Error('LIMITS_SCALE is not allowed in production')
  for (const k of ['earnPerDay', 'ipEarnPerDay']) if (catalog.limits[k]) catalog.limits[k] *= scale
  for (const d of Object.values(catalog.earn)) d.perDay *= scale
}
const db = openDb(dbFile)
const google = new GooglePlay({ saFile: env.GOOGLE_SA_FILE, packageName: env.ANDROID_PACKAGE })
const shop = new Shop({
  db,
  catalog,
  signKey,
  apple: { bundleId: env.APPLE_BUNDLE_ID ?? 'app.starpath.football' },
  verifyKeys: oldKeys,
  sandbox: { policy, testers: (env.SANDBOX_TESTERS ?? '').split(','), cap: Number(env.SANDBOX_CAP) || undefined, globalDaily: Number(env.SANDBOX_GLOBAL_DAILY) || undefined, until: sandboxUntil },
  dataDir,
  google,
  // ADMOB_AD_UNITS: the app's rewarded ad unit ids (comma list); SSV callbacks for other units are refused.
  ads: { requireSsv: env.REQUIRE_SSV === '1', adUnits: (env.ADMOB_AD_UNITS ?? '').split(',') },
  devPurchases: env.DEV_PURCHASES === '1',
  // Audit IPs older than 30 days are replaced by a keyed hash; the key is derived from the grant key.
  ipSalt: createHash('sha256').update(signKey.export({ type: 'pkcs8', format: 'der' })).update('audit-ip').digest(),
  log,
})
const origins = (env.ORIGINS ?? 'capacitor://localhost,https://localhost,http://localhost').split(',').map((s) => s.trim()).filter(Boolean)
const port = Number(env.PORT ?? 8787)
const server = createApp({
  shop,
  admob: new AdMobVerifier(),
  origins,
  trustProxy: env.TRUST_PROXY !== '0',
  rtdnToken: env.RTDN_TOKEN ?? '',
  opsToken: env.OPS_TOKEN ?? '',
  limits: { regPerMin: Number(env.REG_PER_MIN) || undefined, regBurst: Number(env.REG_PER_MIN) || undefined, regGlobalPerMin: Number(env.REG_GLOBAL_PER_MIN) || undefined, ipPerMin: Number(env.IP_PER_MIN) || undefined },
  log,
})
server.listen(port, env.HOST ?? '127.0.0.1', () => console.log(`starpath shop on ${env.HOST ?? '127.0.0.1'}:${port} (sandbox ${policy}, google ${google.configured ? 'on' : 'off'})`))

// Background jobs: daily retention prune; Play voided purchases every 6 h when Play is configured.
const timers = []
const every = (ms, first, fn) => {
  const run = () => Promise.resolve().then(fn).catch((e) => log('job', e))
  timers.push(setTimeout(run, first), setInterval(run, ms))
}
every(24 * 3600_000, 60_000, async () => log('prune', JSON.stringify(await shop.pruneAsync())))
if (google.configured) {
  every(6 * 3600_000, 120_000, async () => log('voided', await shop.pollVoided()))
  // Play consume / acknowledge that failed after a credit (Play refunds unacknowledged purchases after 3 days).
  every(10 * 60_000, 90_000, async () => {
    const r = await shop.retryFinalize()
    if (r.done || r.failed || r.dropped) log('finalize', JSON.stringify(r))
  })
}

process.on('uncaughtException', (e) => {
  log('uncaughtException', e)
  process.exit(1) // systemd restarts the service
})
process.on('unhandledRejection', (e) => log('unhandledRejection', e))
const stop = (sig) => {
  log('stop', sig)
  for (const t of timers) clearTimeout(t)
  server.close(() => {
    db.close()
    process.exit(0)
  })
  setTimeout(() => process.exit(0), 5000).unref()
}
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
