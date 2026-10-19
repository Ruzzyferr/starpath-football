// Minimal DER reader: just enough to walk an X.509 tbsCertificate and list its extensions
// (RFC 5280 §4.1). Strict: definite lengths only, every element must fit inside its parent.

export class DerError extends Error {}

/** Reads one TLV at `off` (inside [off, end)). Returns { tag, start (content), end (content end) }. */
export function readTlv(buf, off, end = buf.length) {
  if (off + 2 > end) throw new DerError('truncated')
  const tag = buf[off]
  if ((tag & 0x1f) === 0x1f) throw new DerError('high tag')
  let len = buf[off + 1]
  let p = off + 2
  if (len & 0x80) {
    const n = len & 0x7f
    if (n === 0 || n > 4) throw new DerError('bad length')
    if (p + n > end) throw new DerError('truncated')
    len = 0
    for (let i = 0; i < n; i++) len = len * 256 + buf[p + i]
    p += n
  }
  if (p + len > end) throw new DerError('overflow')
  return { tag, start: p, end: p + len }
}

/** Children of a constructed element. */
export function children(buf, el) {
  const out = []
  for (let p = el.start; p < el.end; ) {
    const c = readTlv(buf, p, el.end)
    out.push(c)
    p = c.end
  }
  return out
}

/** OBJECT IDENTIFIER content bytes → dotted string. */
export function oidString(bytes) {
  if (!bytes.length) throw new DerError('empty oid')
  const out = [Math.min(2, Math.floor(bytes[0] / 40)), bytes[0] - 40 * Math.min(2, Math.floor(bytes[0] / 40))]
  let v = 0
  for (let i = 1; i < bytes.length; i++) {
    v = v * 128 + (bytes[i] & 0x7f)
    if (!(bytes[i] & 0x80)) { out.push(v); v = 0 }
    else if (i === bytes.length - 1) throw new DerError('bad oid')
  }
  return out.join('.')
}

/**
 * Extensions of a DER certificate: Map(oid → { critical, value: Buffer }). Only the
 * tbsCertificate's [3] extensions field is read, so the same bytes anywhere else (subject, key,
 * another extension's value) never count.
 */
export function certExtensions(der) {
  const cert = readTlv(der, 0)
  if (cert.tag !== 0x30 || cert.end !== der.length) throw new DerError('not a certificate')
  const [tbs] = children(der, cert)
  if (!tbs || tbs.tag !== 0x30) throw new DerError('no tbs')
  const out = new Map()
  for (const f of children(der, tbs)) {
    if (f.tag !== 0xa3) continue // [3] EXPLICIT Extensions
    const [seq] = children(der, f)
    if (!seq || seq.tag !== 0x30) throw new DerError('bad extensions')
    for (const ext of children(der, seq)) {
      const parts = children(der, ext)
      if (ext.tag !== 0x30 || parts[0]?.tag !== 0x06) throw new DerError('bad extension')
      const oid = oidString(der.subarray(parts[0].start, parts[0].end))
      const critical = parts.length === 3 && parts[1].tag === 0x01 && der[parts[1].start] !== 0
      const val = parts[parts.length - 1]
      if (val.tag !== 0x04) throw new DerError('bad extension value')
      if (out.has(oid)) throw new DerError('duplicate extension')
      out.set(oid, { critical, value: der.subarray(val.start, val.end) })
    }
  }
  return out
}

/** basicConstraints (2.5.29.19) cA flag; false when absent. */
export function isCa(exts) {
  const bc = exts.get('2.5.29.19')
  if (!bc) return false
  try {
    const seq = readTlv(bc.value, 0)
    const [first] = children(bc.value, seq)
    return !!first && first.tag === 0x01 && bc.value[first.start] !== 0
  } catch {
    return false
  }
}
