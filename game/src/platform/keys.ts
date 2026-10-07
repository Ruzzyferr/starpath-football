/**
 * Storage keys become file names on desktop and mobile, so they are validated
 * strictly (same rule as electron/main.cjs): letters, digits, dot, dash,
 * underscore; must start alphanumeric; no "..", max 96 chars.
 */
export const KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/

export function isValidKey(key: unknown): key is string {
  return typeof key === 'string' && KEY_RE.test(key) && !key.includes('..')
}

export function assertKey(key: string): string {
  if (!isValidKey(key)) throw new Error(`Invalid storage key: ${String(key)}`)
  return key
}

/** Every key the SaveManager can write (3 slots: live, staging, 3 backups). Used for one-time migration. */
export function knownSaveKeys(slots = 3, backups = 3): string[] {
  const out: string[] = []
  for (let s = 0; s < slots; s++) {
    out.push(`sp.save.${s}`, `sp.save.${s}.staging`, `sp.save.${s}.premigrate`)
    for (let b = 0; b < backups; b++) out.push(`sp.save.${s}.bak${b}`)
  }
  return out
}
