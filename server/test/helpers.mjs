// Test fixtures: a throwaway 3-level chain (root → intermediate → leaf) made with openssl, carrying
// Apple's marker OID extensions like the real one, used to sign StoreKit-style JWS exactly the way
// Apple does (ES256, x5c = [leaf, inter, root]). Options build the broken chains for negative tests.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { X509Certificate, createPrivateKey, generateKeyPairSync, sign } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { openDb } from '../src/db.mjs'
import { Shop } from '../src/shop.mjs'

const ossl = (args, cwd) => execFileSync('openssl', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, MSYS_NO_PATHCONV: '1' } })

export const LEAF_OID = '1.2.840.113635.100.6.11.1'
export const INTER_OID = '1.2.840.113635.100.6.2.1'

/**
 * @param {object} [o]
 * @param {boolean} [o.leafOid=true] Apple leaf marker as an extension of the leaf
 * @param {boolean} [o.interOid=true] Apple intermediate marker as an extension of the intermediate
 * @param {boolean} [o.oidInSubject=false] the leaf marker OID only as an attribute type in the leaf's subject
 * @param {boolean} [o.interCa=true] intermediate basicConstraints CA:true
 * @param {'ec'|'rsa'} [o.leafKey='ec'] leaf key type (P-256 or RSA-2048)
 */
export function makeChain(o = {}) {
  const { leafOid = true, interOid = true, oidInSubject = false, interCa = true, leafKey = 'ec' } = o
  const d = mkdtempSync(join(tmpdir(), 'sp-chain-'))
  const ca = interCa ? 'basicConstraints=critical,CA:true\nkeyUsage=critical,keyCertSign,cRLSign\n' : 'basicConstraints=critical,CA:false\n'
  writeFileSync(join(d, 'ca.ext'), ca + (interOid ? `${INTER_OID}=ASN1:NULL\n` : ''))
  writeFileSync(join(d, 'leaf.ext'), 'basicConstraints=critical,CA:false\nkeyUsage=critical,digitalSignature\n' + (leafOid ? `${LEAF_OID}=ASN1:NULL\n` : ''))
  // A request config that names the leaf OID, so it can sit in a subject (negative test).
  writeFileSync(join(d, 'req.cnf'), `oid_section=oids\n[oids]\nappleLeafMarker=${LEAF_OID}\n[req]\ndistinguished_name=dn\n[dn]\n`)
  for (const n of ['root', 'inter']) ossl(['ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', `${n}.key`], d)
  if (leafKey === 'rsa') ossl(['genpkey', '-algorithm', 'RSA', '-pkeyopt', 'rsa_keygen_bits:2048', '-out', 'leaf.key'], d)
  else ossl(['ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', 'leaf.key'], d)
  ossl(['req', '-x509', '-new', '-key', 'root.key', '-subj', '/CN=Test Root', '-days', '3650', '-out', 'root.pem', '-addext', 'basicConstraints=critical,CA:true', '-addext', 'keyUsage=critical,keyCertSign,cRLSign'], d)
  ossl(['req', '-new', '-key', 'inter.key', '-subj', '/CN=Test Inter', '-out', 'inter.csr'], d)
  ossl(['x509', '-req', '-in', 'inter.csr', '-CA', 'root.pem', '-CAkey', 'root.key', '-CAcreateserial', '-days', '3650', '-extfile', 'ca.ext', '-out', 'inter.pem'], d)
  ossl(['req', '-config', 'req.cnf', '-new', '-key', 'leaf.key', '-subj', oidInSubject ? '/appleLeafMarker=x/CN=Test Leaf' : '/CN=Test Leaf', '-out', 'leaf.csr'], d)
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
  const db = openDb(':memory:')
  const shop = new Shop({
    db,
    catalog,
    signKey: privateKey,
    apple: { bundleId: 'app.starpath.football', allowSandbox: true, rootFingerprint: chain.rootFingerprint },
    now: clock.now,
    ...over,
  })
  return { shop, clock, publicKey, db }
}

export const txn = (acc, over = {}) => ({
  transactionId: String(Math.floor(Math.random() * 1e12)),
  originalTransactionId: String(Math.floor(Math.random() * 1e12)),
  bundleId: 'app.starpath.football',
  productId: 'gems_m',
  environment: 'Sandbox',
  appAccountToken: acc,
  signedDate: Date.now() + 2000, // after the fixture certs' second-truncated notBefore
  type: 'Consumable',
  ...over,
})

/** An App Store Server Notification v2 wrapping one signed transaction. */
export const note = (chain, type, t, over = {}) =>
  signJws(chain, { notificationType: type, data: { bundleId: 'app.starpath.football', environment: t.environment, signedTransactionInfo: signJws(chain, t) }, signedDate: t.signedDate, ...over })

/** A stand-in for GooglePlay: `purchases[token]` = verify result; records finish calls. */
export function fakeGoogle(purchases = {}, { voided = [] } = {}) {
  const calls = []
  // Flags on a purchase: fail (Play answers that HTTP status: transient), cancelled / revoked
  // (definitively not purchased / not active), pending.
  const state = (v, ok) => {
    if (!v) return { ok: false, why: 'play 404', transient: false, notFound: true }
    if (v.fail) return { ok: false, why: `play ${v.fail}`, transient: true }
    if (v.pending) return { ok: false, pending: true, why: 'pending' }
    if (v.cancelled || v.revoked) return { ok: false, why: 'not purchased', transient: false }
    return ok
  }
  return {
    configured: true,
    pkg: 'app.starpath.football',
    calls,
    purchases,
    voided,
    async verifyProduct(productId, token) {
      const v = purchases[token]
      return state(v && !v.sub ? v : null, { ok: true, productId, ...v })
    },
    async verifySubscription(token) {
      const v = purchases[token]
      return state(v && v.sub ? v : null, { ok: true, ...v })
    },
    async isVoided(token, since) { calls.push(['isVoided', token, since]); return voided.some((vp) => vp.purchaseToken === token) },
    // finishStatus: what consume / acknowledge answer (e.g. 503 to test the finalize retry).
    finishStatus: 204,
    async consumeProduct(p, t) { calls.push(['consume', p, t]); if (this.finishStatus < 300 && purchases[t]) purchases[t].consumed = true; return this.finishStatus },
    async acknowledgeProduct(p, t) { calls.push(['ack', p, t]); if (this.finishStatus < 300 && purchases[t]) purchases[t].acknowledged = true; return this.finishStatus },
    async acknowledgeSubscription(p, t) { calls.push(['ackSub', p, t]); if (this.finishStatus < 300 && purchases[t]) purchases[t].acknowledged = true; return this.finishStatus },
    async voidedPurchases(since) { calls.push(['voided', since]); return voided },
  }
}

export { DatabaseSync }
