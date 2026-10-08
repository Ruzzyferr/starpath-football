/**
 * Data-only mod packs (GAP 2.10#60/#62/#76/#15). A pack is plain JSON (no code,
 * no URLs, no images): extra countries and name pools, validated with the same
 * rules as the built-in world data (src/data/world/validate.ts). A pack may carry
 * an Ed25519 signature; only packs signed by a key in {@link OFFICIAL_KEYS}
 * count as official, every other pack makes the career "modded".
 */
import type { CountryDef } from '../../data/world/countries'
import { NAME_STYLES, type NameStyle } from '../../data/world/names'
import { validateCountryDef, validateNameList } from '../../data/world/validate'

export const MOD_FORMAT = 'starpath-mod'
export const MOD_MAX_BYTES = 256 * 1024
export const MOD_MAX_COUNTRIES = 24
export const MOD_MAX_INSTALLED = 8

/** Hex Ed25519 public keys allowed to sign official packs. Empty until a release key exists (no backend yet). */
export const OFFICIAL_KEYS: readonly string[] = []

export interface ModCountry extends CountryDef {
  cities: string[]
}

export interface ModNames {
  style: NameStyle
  first?: string[]
  firstFemale?: string[]
  last?: string[]
}

export interface ModPack {
  format: typeof MOD_FORMAT
  id: string
  version: string
  name: string
  author?: string
  description?: string
  countries?: ModCountry[]
  names?: ModNames[]
}

/** What the meta store keeps per imported mod. */
export interface InstalledMod {
  id: string
  version: string
  name: string
  author: string
  enabled: boolean
  /** True when a valid signature from an official key was attached on import. */
  official: boolean
  addedAt: number
  bytes: number
  pack: ModPack
}

export interface ModCheck {
  ok: boolean
  errors: string[]
  pack: ModPack | null
}

const ID = /^[a-z0-9][a-z0-9-]{1,39}$/
const VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/
const TOP_KEYS = new Set(['format', 'id', 'version', 'name', 'author', 'description', 'countries', 'names', 'signature'])
const COUNTRY_KEYS = new Set(['id', 'name', 'adjective', 'flag', 'reputation', 'nameStyle', 'leagueNames', 'cupName', 'cities'])
const NAMES_KEYS = new Set(['style', 'first', 'firstFemale', 'last'])
const isStr = (v: unknown, max = 120): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** Reject keys outside the whitelist (so nothing executable or surprising hides in a pack). */
function unknownKeys(o: Record<string, unknown>, allowed: Set<string>, where: string): string[] {
  return Object.keys(o).filter((k) => !allowed.has(k)).map((k) => `${where}: unknown field "${k}"`)
}

/** Validate untrusted JSON text as a mod pack (size, shape, whitelist, then the world-data rules). */
export function validateModPack(text: string, existingCountryIds: readonly string[] = []): ModCheck {
  const errors: string[] = []
  if (text.length > MOD_MAX_BYTES) return { ok: false, errors: [`file too large (${text.length} > ${MOD_MAX_BYTES} bytes)`], pack: null }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, errors: ['not valid JSON'], pack: null }
  }
  if (!isObj(raw)) return { ok: false, errors: ['root must be an object'], pack: null }
  errors.push(...unknownKeys(raw, TOP_KEYS, 'pack'))
  if (raw.format !== MOD_FORMAT) errors.push(`format must be "${MOD_FORMAT}"`)
  if (typeof raw.id !== 'string' || !ID.test(raw.id)) errors.push('id must be 2-40 chars of a-z, 0-9, "-"')
  if (typeof raw.version !== 'string' || !VERSION.test(raw.version)) errors.push('version must look like 1.0.0')
  if (!isStr(raw.name, 60)) errors.push('name is required (max 60 chars)')
  if (raw.author !== undefined && !isStr(raw.author, 60)) errors.push('author must be short text')
  if (raw.description !== undefined && !isStr(raw.description, 300)) errors.push('description must be short text')
  const countries = raw.countries === undefined ? [] : raw.countries
  const names = raw.names === undefined ? [] : raw.names
  if (!Array.isArray(countries) || countries.length > MOD_MAX_COUNTRIES) errors.push(`countries must be a list of at most ${MOD_MAX_COUNTRIES}`)
  if (!Array.isArray(names) || names.length > NAME_STYLES.length) errors.push('names must be a list with one entry per style at most')
  if (Array.isArray(countries) && Array.isArray(names)) {
    if (countries.length + names.length === 0) errors.push('pack changes nothing: add countries or names')
    const seen = new Set<string>()
    for (const c of countries) {
      if (!isObj(c)) { errors.push('country entry must be an object'); continue }
      errors.push(...unknownKeys(c, COUNTRY_KEYS, `country ${String(c.id)}`))
      const cid = String(c.id)
      if (!/^[A-Z]{2,3}$/.test(cid)) errors.push(`country id "${cid}" must be 2-3 capital letters`)
      if (seen.has(cid) || existingCountryIds.includes(cid)) errors.push(`country id "${cid}" already exists`)
      seen.add(cid)
      const cities = Array.isArray(c.cities) ? (c.cities as string[]) : undefined
      errors.push(...validateCountryDef(c as unknown as CountryDef, cities))
    }
    for (const n of names) {
      if (!isObj(n)) { errors.push('names entry must be an object'); continue }
      errors.push(...unknownKeys(n, NAMES_KEYS, 'names'))
      if (!(NAME_STYLES as readonly string[]).includes(String(n.style))) { errors.push(`names: unknown style ${String(n.style)}`); continue }
      for (const k of ['first', 'firstFemale', 'last'] as const) {
        const list = n[k]
        if (list === undefined) continue
        if (!Array.isArray(list) || list.length > 400) errors.push(`${String(n.style)}.${k}: must be a list of at most 400`)
        else errors.push(...validateNameList(`${String(n.style)}.${k}`, list as string[]))
      }
    }
  }
  if (errors.length) return { ok: false, errors: errors.slice(0, 12), pack: null }
  const { signature: _sig, ...rest } = raw
  void _sig
  return { ok: true, errors: [], pack: rest as unknown as ModPack }
}

// ───────────────────────── Signatures (Ed25519) ─────────────────────────

/** Key-sorted JSON: the bytes that get signed. */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`
  if (isObj(v)) return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(v[k])}`).join(',')}}`
  return JSON.stringify(v) ?? 'null'
}

const hexToBytes = (h: string): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(new ArrayBuffer(h.length / 2))
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16)
  return out
}
const isHex = (h: unknown, len: number): h is string => typeof h === 'string' && h.length === len && /^[0-9a-f]+$/i.test(h)

/**
 * True only when `signatureHex` is a valid Ed25519 signature of the canonical pack made by `publicKeyHex`.
 * Never throws: an unsupported runtime or malformed input is simply "not verified".
 */
export async function verifySignature(payload: unknown, signatureHex: unknown, publicKeyHex: string): Promise<boolean> {
  try {
    if (!isHex(signatureHex, 128) || !isHex(publicKeyHex, 64)) return false
    const key = await globalThis.crypto.subtle.importKey('raw', hexToBytes(publicKeyHex), { name: 'Ed25519' }, false, ['verify'])
    return await globalThis.crypto.subtle.verify({ name: 'Ed25519' }, key, hexToBytes(signatureHex), new TextEncoder().encode(canonicalJson(payload)))
  } catch {
    return false
  }
}

/** Does the signature in a pack's raw text verify against any trusted key? Unsigned or foreign-signed means false. */
export async function isOfficialSigned(text: string, keys: readonly string[] = OFFICIAL_KEYS): Promise<boolean> {
  try {
    const raw = JSON.parse(text) as Record<string, unknown>
    if (!isObj(raw)) return false
    const { signature, ...rest } = raw
    for (const k of keys) if (await verifySignature(rest, signature, k)) return true
  } catch {
    /* fall through */
  }
  return false
}

// ───────────────────────── Install / save signature ─────────────────────────

/** Add or replace (by id) an installed mod; returns the new list or an error key. */
export function installMod(list: readonly InstalledMod[], pack: ModPack, official: boolean, bytes: number, now: number): { list: InstalledMod[]; error?: 'limit' } {
  const rest = list.filter((m) => m.id !== pack.id)
  if (rest.length >= MOD_MAX_INSTALLED) return { list: [...list], error: 'limit' }
  return { list: [...rest, { id: pack.id, version: pack.version, name: pack.name, author: pack.author ?? '', enabled: true, official, addedAt: now, bytes, pack }] }
}

export const activeMods = (list: readonly InstalledMod[]): InstalledMod[] => list.filter((m) => m.enabled)

/** Career is "modded" when any enabled mod lacks an official signature. */
export const isModded = (list: readonly InstalledMod[]): boolean => activeMods(list).some((m) => !m.official)

/** Compact mod signature stored in a career save: sorted "id@version" entries. */
export const modSignature = (list: readonly InstalledMod[]): string[] => activeMods(list).map((m) => `${m.id}@${m.version}`).sort()

export interface ModMismatch {
  missing: string[]
  versionDiffers: string[]
}

/** Compare the signature a save was made with against what is installed now (warn before loading). */
export function checkModSignature(saved: readonly string[], installed: readonly InstalledMod[]): ModMismatch {
  const have = new Map(activeMods(installed).map((m) => [m.id, m.version]))
  const res: ModMismatch = { missing: [], versionDiffers: [] }
  for (const entry of saved) {
    const [id, ver] = entry.split('@')
    if (!have.has(id)) res.missing.push(id)
    else if (have.get(id) !== ver) res.versionDiffers.push(id)
  }
  return res
}

/** Name pool as the player's active mods would extend it (for the world generator to adopt). */
export function mergedNameList(style: NameStyle, key: 'first' | 'firstFemale' | 'last', base: readonly string[], list: readonly InstalledMod[]): string[] {
  const extra = activeMods(list).flatMap((m) => (m.pack.names ?? []).filter((n) => n.style === style).flatMap((n) => n[key] ?? []))
  return [...new Set([...base, ...extra])]
}
