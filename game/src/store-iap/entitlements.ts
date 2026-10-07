/**
 * Entitlements: what this install owns. Pure helpers + one signal.
 *
 * Persistence is a GLOBAL key (outside save slots, so deleting/importing a save
 * never loses or shares a purchase). Trust model: on web/dev the record is
 * local and unsigned; the native stores are the source of truth and
 * "Restore purchases" re-grants from them. FUTURE: validate receipts server-side
 * (Play Developer API / App Store Server API) before granting, and sign the
 * local record. Cosmetic-only + a single unlock keeps the fraud surface small.
 */
import { signal } from '@preact/signals'
import { START_YEAR } from '../core/config'
import { FULL_CAREER, PRODUCT_BY_ID, packFor, type CosmeticKind } from './catalog'
import { getFlavor, type Flavor } from './flavor'

export interface EntitlementRecord {
  v: 1
  owned: Record<string, { at: number; src: string }>
}

export const ENTITLEMENT_KEY = 'starpath.entitlements.v1'
export const emptyRecord = (): EntitlementRecord => ({ v: 1, owned: {} })

export function parseRecord(raw: string | null | undefined): EntitlementRecord {
  if (!raw) return emptyRecord()
  try {
    const o = JSON.parse(raw) as Partial<EntitlementRecord>
    const rec = emptyRecord()
    if (o && o.v === 1 && o.owned && typeof o.owned === 'object') {
      for (const [id, e] of Object.entries(o.owned)) {
        if (PRODUCT_BY_ID[id] && e && typeof e.at === 'number') rec.owned[id] = { at: e.at, src: String(e.src ?? '') }
      }
    }
    return rec
  } catch {
    return emptyRecord()
  }
}

export function grantIn(rec: EntitlementRecord, ids: readonly string[], src: string, now = Date.now()): EntitlementRecord {
  const owned = { ...rec.owned }
  for (const id of ids) if (PRODUCT_BY_ID[id] && !owned[id]) owned[id] = { at: now, src }
  return { v: 1, owned }
}

export interface PurchaseHistoryEntry {
  id: string
  at: number
  /** Provider that granted it ("google", "dev", "restore:apple" ...). */
  src: string
}

/** Dated purchase list, newest first (ties broken by id for a stable order). */
export function purchaseHistory(rec: EntitlementRecord): PurchaseHistoryEntry[] {
  return Object.entries(rec.owned)
    .map(([id, e]) => ({ id, at: e.at, src: e.src }))
    .sort((a, b) => b.at - a.at || a.id.localeCompare(b.id))
}

/** Trial gate: season 1 (START_YEAR) is free; later seasons need the unlock on trial builds. */
export function isCareerLocked(flavor: Flavor, ownsFull: boolean, season: number): boolean {
  return flavor === 'trial' && !ownsFull && season > START_YEAR
}

function load(): EntitlementRecord {
  try {
    return parseRecord(globalThis.localStorage?.getItem(ENTITLEMENT_KEY))
  } catch {
    return emptyRecord()
  }
}

export const entitlements = signal<EntitlementRecord>(load())

function save(rec: EntitlementRecord): void {
  entitlements.value = rec
  try {
    globalThis.localStorage?.setItem(ENTITLEMENT_KEY, JSON.stringify(rec))
  } catch {
    /* private mode: stays in memory for this session */
  }
}

export function grant(ids: readonly string[], src: string): void {
  save(grantIn(entitlements.peek(), ids, src))
}

/** Reads the signal, so components re-render on change. Premium builds own the full career. */
export function hasEntitlement(id: string): boolean {
  if (id === FULL_CAREER && getFlavor() === 'premium') return true
  return id in entitlements.value.owned
}

/** True when a cosmetic option is usable: not gated by a pack, or its pack is owned. */
export function cosmeticUnlocked(kind: CosmeticKind, option: string | number): boolean {
  const pack = packFor(kind, option)
  return !pack || hasEntitlement(pack.id)
}

/** The career calendar is locked (read-only mode) for this season. */
export function careerLocked(season: number): boolean {
  return isCareerLocked(getFlavor(), hasEntitlement(FULL_CAREER), season)
}

/** Tests only. */
export function _resetEntitlements(rec: EntitlementRecord = emptyRecord()): void {
  entitlements.value = rec
}
