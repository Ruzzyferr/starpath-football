// StoreKit 2 signed data (JWS) verification without any Apple API key:
// the x5c chain in the header must chain leaf → intermediate → Apple Root CA - G3 (pinned by its
// SHA-256 fingerprint, published by Apple in its trusted-root lists), carry Apple's receipt-signing
// OIDs, be valid at signing time, and the ES256 signature must verify with the leaf key.
import { X509Certificate, verify } from 'node:crypto'
import { certExtensions, isCa } from './der.mjs'

/** Apple Root CA - G3 (ECDSA P-384), SHA-256 fingerprint as published by Apple. */
export const APPLE_ROOT_G3_SHA256 = '63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79'
/** Mac App Store receipt signing leaf / Apple WWDR intermediate marker OIDs. */
const LEAF_OID = '1.2.840.113635.100.6.11.1'
const INTERMEDIATE_OID = '1.2.840.113635.100.6.2.1'

const b64url = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')

/** Max JWS length: an App Store Server Notification nests two signed JWS (each with its own x5c). */
export const MAX_JWS = 100_000

export class JwsError extends Error {}

/** The certificate's parsed extensions (never a byte search over the raw certificate). */
function extensions(cert) {
  try {
    return certExtensions(cert.raw)
  } catch {
    throw new JwsError('bad cert der')
  }
}

/**
 * Verifies an Apple JWS and returns its payload. `opts.rootFingerprint` is only overridden by tests.
 * Throws JwsError on anything off.
 */
export function verifyAppleJws(jws, opts = {}) {
  const rootFp = opts.rootFingerprint ?? APPLE_ROOT_G3_SHA256
  if (typeof jws !== 'string' || jws.length > MAX_JWS) throw new JwsError('bad jws')
  const parts = jws.split('.')
  if (parts.length !== 3) throw new JwsError('bad jws')
  let header, payload
  try {
    header = JSON.parse(b64url(parts[0]).toString('utf8'))
    payload = JSON.parse(b64url(parts[1]).toString('utf8'))
  } catch {
    throw new JwsError('bad jws json')
  }
  if (header.alg !== 'ES256') throw new JwsError('bad alg')
  if (!Array.isArray(header.x5c) || header.x5c.length !== 3) throw new JwsError('bad chain')
  let leaf, inter, root
  try {
    ;[leaf, inter, root] = header.x5c.map((c) => new X509Certificate(Buffer.from(c, 'base64')))
  } catch {
    throw new JwsError('bad cert')
  }
  if (root.fingerprint256 !== rootFp) throw new JwsError('untrusted root')
  if (!root.verify(root.publicKey)) throw new JwsError('root not self-signed')
  if (!inter.verify(root.publicKey) || !inter.checkIssued(root)) throw new JwsError('intermediate not issued by root')
  if (!leaf.verify(inter.publicKey) || !leaf.checkIssued(inter)) throw new JwsError('leaf not issued by intermediate')
  // Apple's marker OIDs must be extension ids of the right certificate, the intermediate must be
  // a CA (basicConstraints cA=true), the leaf must not be, and the leaf key must be EC P-256 (ES256).
  const leafExt = extensions(leaf)
  const interExt = extensions(inter)
  if (!opts.skipOids && (!leafExt.has(LEAF_OID) || !interExt.has(INTERMEDIATE_OID))) throw new JwsError('missing apple oid')
  if (!isCa(interExt) || isCa(leafExt)) throw new JwsError('bad basic constraints')
  const lk = leaf.publicKey
  if (lk.asymmetricKeyType !== 'ec' || lk.asymmetricKeyDetails?.namedCurve !== 'prime256v1') throw new JwsError('leaf key not P-256')
  // Valid when it was signed (Apple's own rule: chain checked at signedDate, not "now").
  const at = new Date(Number(payload.signedDate) || Date.now())
  for (const c of [leaf, inter, root]) {
    if (at < new Date(c.validFrom) || at > new Date(c.validTo)) throw new JwsError('cert expired at signing')
  }
  const ok = verify('sha256', Buffer.from(`${parts[0]}.${parts[1]}`), { key: lk, dsaEncoding: 'ieee-p1363' }, b64url(parts[2]))
  if (!ok) throw new JwsError('bad signature')
  return payload
}
