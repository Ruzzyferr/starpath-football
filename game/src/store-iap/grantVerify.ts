/**
 * Grants (what diamonds, money or an ad paid for) are signed by the shop server with Ed25519.
 * The app applies only grants whose signature checks out against the server's public key, using
 * the fields INSIDE the signed payload (never the unsigned copy next to it), and only when the
 * payload names this install's account. A grant typed into local storage is therefore worthless.
 */
export interface GrantPayload {
  v: 1
  /** Nonce: unique per grant. */
  n: string
  /** Account it was issued to. */
  a: string
  t: number
  /** gear | cash | physio | match_bonus | train_boost | season_x2 | cosmetic */
  k: string
  id?: string
  weeks?: number
  floor?: number
  /** Ceiling on a cash grant (euros). */
  cap?: number
  /** Career it is bound to (spends and ads made inside a career). */
  c?: string
  /** Context reference (match_bonus: the fixture id). */
  ref?: string
  src?: string
}

/** Production grant key (server/data/grant-pub.pem, raw 32 bytes, base64). */
const PROD_PUBKEY = 'ScDKFvJVj40rUud+oECIuLfHM/ZWdbAvBGMLsCh5hYQ='

function pubKey(): Uint8Array {
  const env = import.meta.env?.VITE_SHOP_PUBKEY as string | undefined
  return b64(env || PROD_PUBKEY)
}

function b64(s: string): Uint8Array {
  const std = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(std + '='.repeat((4 - (std.length % 4)) % 4))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Returns the signed payload, or null when the token is forged, malformed or for another account. */
export async function verifyGrant(token: string, accountId: string | null): Promise<GrantPayload | null> {
  if (typeof token !== 'string' || token.length > 4000 || !accountId) return null
  const dot = token.indexOf('.')
  if (dot <= 0) return null
  const body = token.slice(0, dot)
  let sig: Uint8Array
  let payload: GrantPayload
  try {
    sig = b64(token.slice(dot + 1))
    payload = JSON.parse(new TextDecoder().decode(b64(body))) as GrantPayload
  } catch {
    return null
  }
  if (sig.length !== 64 || payload?.v !== 1 || payload.a !== accountId || typeof payload.n !== 'string' || typeof payload.k !== 'string') return null
  try {
    // @noble/ed25519 (audited, pure JS): works on old Android WebViews without WebCrypto Ed25519.
    const ed = await import('@noble/ed25519')
    return (await ed.verifyAsync(sig, new TextEncoder().encode(body), pubKey())) ? payload : null
  } catch {
    return null
  }
}
