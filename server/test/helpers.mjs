// Test fixtures: a throwaway 3-level ECDSA chain (root → intermediate → leaf) made with openssl,
// used to sign StoreKit-style JWS exactly the way Apple does (ES256, x5c = [leaf, inter, root]).
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { X509Certificate, createPrivateKey, generateKeyPairSync, sign } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { openDb } from '../src/db.mjs'
import { Shop } from '../src/shop.mjs'

const ossl = (args, cwd) => execFileSync('openssl', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, MSYS_NO_PATHCONV: '1' } })

export function makeChain() {
  const d = mkdtempSync(join(tmpdir(), 'sp-chain-'))
  writeFileSync(join(d, 'ca.ext'), 'basicConstraints=critical,CA:true\nkeyUsage=critical,keyCertSign,cRLSign\n')
  writeFileSync(join(d, 'leaf.ext'), 'basicConstraints=critical,CA:false\nkeyUsage=critical,digitalSignature\n')
  for (const n of ['root', 'inter', 'leaf']) ossl(['ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', `${n}.key`], d)
  ossl(['req', '-x509', '-new', '-key', 'root.key', '-subj', '/CN=Test Root', '-days', '3650', '-out', 'root.pem', '-addext', 'basicConstraints=critical,CA:true', '-addext', 'keyUsage=critical,keyCertSign,cRLSign'], d)
  ossl(['req', '-new', '-key', 'inter.key', '-subj', '/CN=Test Inter', '-out', 'inter.csr'], d)
  ossl(['x509', '-req', '-in', 'inter.csr', '-CA', 'root.pem', '-CAkey', 'root.key', '-CAcreateserial', '-days', '3650', '-extfile', 'ca.ext', '-out', 'inter.pem'], d)
  ossl(['req', '-new', '-key', 'leaf.key', '-subj', '/CN=Test Leaf', '-out', 'leaf.csr'], d)
  ossl(['x509', '-req', '-in', 'leaf.csr', '-CA', 'inter.pem', '-CAkey', 'inter.key', '-CAcreateserial', '-days', '3650', '-extfile', 'leaf.ext', '-out', 'leaf.pem'], d)
  const pem = (n) => readFileSync(join(d, `${n}.pem`), 'utf8')
  const der = (n) => new X509Certificate(pem(n)).raw.toString('base64')
  return {
    x5c: [der('leaf'), der('inter'), der('root')],
    leafKey: createPrivateKey(readFileSync(join(d, 'leaf.key'))),
    rootFingerprint: new X509Certificate(pem('root')).fingerprint256,
  }
}

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')

export function signJws(chain, payload, { x5c = chain.x5c, key = chain.leafKey } = {}) {
  const h = b64u({ alg: 'ES256', x5c })
  const p = b64u(payload)
  const s = sign('sha256', Buffer.from(`${h}.${p}`), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')
  return `${h}.${p}.${s}`
}

export const catalog = JSON.parse(readFileSync(new URL('../catalog.json', import.meta.url), 'utf8'))

export function makeShop(chain, over = {}) {
  let t = Date.now()
  const clock = { now: () => t, advance: (ms) => { t += ms } }
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const shop = new Shop({
    db: openDb(':memory:'),
    catalog,
    signKey: privateKey,
    apple: { bundleId: 'app.starpath.football', allowSandbox: true, rootFingerprint: chain.rootFingerprint, skipOids: true },
    now: clock.now,
    ...over,
  })
  return { shop, clock, publicKey }
}

export const txn = (acc, over = {}) => ({
  transactionId: String(Math.floor(Math.random() * 1e12)),
  originalTransactionId: '1',
  bundleId: 'app.starpath.football',
  productId: 'gems_m',
  environment: 'Sandbox',
  appAccountToken: acc,
  signedDate: Date.now() + 2000, // after the fixture certs' second-truncated notBefore
  type: 'Consumable',
  ...over,
})

export { DatabaseSync }
