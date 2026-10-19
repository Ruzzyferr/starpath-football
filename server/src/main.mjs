// Entry point. Config from the environment (systemd EnvironmentFile on the server).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createPrivateKey, createPublicKey, generateKeyPairSync } from 'node:crypto'
import { openDb } from './db.mjs'
import { Shop } from './shop.mjs'
import { GooglePlay } from './google.mjs'
import { AdMobVerifier } from './admob.mjs'
import { createApp } from './http.mjs'

const env = process.env
const dataDir = env.DATA_DIR ?? './data'
mkdirSync(dataDir, { recursive: true, mode: 0o700 })

// Ed25519 key that signs grants; created once, never leaves the server.
const keyFile = join(dataDir, 'grant-key.pem')
if (!existsSync(keyFile)) {
  const { privateKey } = generateKeyPairSync('ed25519')
  writeFileSync(keyFile, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 })
}
const signKey = createPrivateKey(readFileSync(keyFile))
writeFileSync(join(dataDir, 'grant-pub.pem'), createPublicKey(signKey).export({ type: 'spki', format: 'pem' }))

if (env.DEV_PURCHASES === '1' && env.NODE_ENV === 'production') throw new Error('DEV_PURCHASES is not allowed in production')

const catalog = JSON.parse(readFileSync(new URL('../catalog.json', import.meta.url), 'utf8'))
const shop = new Shop({
  db: openDb(join(dataDir, 'shop.db')),
  catalog,
  signKey,
  apple: { bundleId: env.APPLE_BUNDLE_ID ?? 'app.starpath.football', allowSandbox: env.ALLOW_SANDBOX === '1' },
  google: new GooglePlay({ saFile: env.GOOGLE_SA_FILE, packageName: env.ANDROID_PACKAGE }),
  ads: { requireSsv: env.REQUIRE_SSV === '1' },
  devPurchases: env.DEV_PURCHASES === '1',
})
const origins = (env.ORIGINS ?? 'capacitor://localhost,https://localhost,http://localhost').split(',').map((s) => s.trim()).filter(Boolean)
const port = Number(env.PORT ?? 8787)
createApp({ shop, admob: new AdMobVerifier(), origins, trustProxy: env.TRUST_PROXY !== '0', limits: { regPerMin: Number(env.REG_PER_MIN) || undefined, regBurst: Number(env.REG_PER_MIN) || undefined, ipPerMin: Number(env.IP_PER_MIN) || undefined }, log: (...a) => console.error(new Date().toISOString(), ...a) })
  .listen(port, env.HOST ?? '127.0.0.1', () => console.log(`starpath shop on ${env.HOST ?? '127.0.0.1'}:${port}`))
