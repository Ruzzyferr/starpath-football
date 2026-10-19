/**
 * Shop ↔ career bridge (UI backend; the sim never imports the store).
 *
 * The shop server sends grants (Ed25519-signed coupons) for what was paid for with diamonds, real money
 * or a watched ad: gear, a cash top-up, a physio session, a doubled match bonus, a training boost. A grant
 * is applied only if its signature verifies for this install's account (store-iap/grantVerify), only to
 * the career it is bound to (spends and ads inside a career carry its id), and only once: its nonce is
 * kept in the save AND in an install-wide list, so a failed acknowledgement can never apply it to a
 * second career or an older save. Acknowledgements that fail are queued and retried.
 *
 * Free diamonds earned in the career (Man of the Match, weekly goals, season end, awards, achievements)
 * are claimed here; the server dedupes and caps them.
 */
import type { GameState, LText } from '../../core/types'
import { PURCHASED_CASH_PER_SEASON, addAdTrainBoost, addGear, equipGear, GEAR_BY_ID, unequipGear, type GearSlot } from '../../sim/career/gear'
import { fmtMoney } from '../../sim/career/common'
import { readJson, writeJson } from '../../sim/game/internal'
import {
  GRANT_MAX_AGE_MS, ShopApiError, currentAccountId, flushEarnQueue, handleWallet, queueEarn, refreshWallet, serverWallet, setInboxHandler, shopApi, storeAvailable, verifyGrant,
  type GrantPayload, type ServerWallet,
} from '../../store-iap'
import { commit, current, notify } from './session'
import { flushAutosave, savedCareerIds, scheduleAutosave } from './persistence'

const APPLIED_FLAG = 'g:grants'
const LAST_BONUS_FLAG = 'g:lastBonus'
const BOUGHT_FLAG = 'g:boughtCash'
/** Install-wide: nonces already applied (any career) and acknowledgements still to send. */
const APPLIED_KEY = 'starpath.grants.applied.v1'
const ACKQ_KEY = 'starpath.grants.ackq.v1'

interface LastBonus { key: string; amount: number; doubled: boolean }

function lsList(key: string): string[] {
  try {
    const v = JSON.parse(globalThis.localStorage?.getItem(key) ?? '[]') as unknown
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}
function lsSet(key: string, list: string[]): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(list.slice(-400)))
  } catch {
    /* private mode */
  }
}

/** Cash pack value: weeks × current gross weekly wage, at least the floor, at most the pack's cap. */
export function cashGrantAmount(s: GameState, weeks: number, floor: number, cap = Infinity): number {
  return Math.min(cap, Math.max(floor, Math.round(weeks * Math.max(0, s.hero.contract?.wage ?? 0))))
}

export type GrantOutcome = { applied: true; line: LText | null } | { applied: false; why: 'done' | 'other_career' | 'not_applicable' }

/** Applies one VERIFIED grant payload to the career. */
export function applyGrant(s: GameState, g: GrantPayload): GrantOutcome {
  const applied = readJson<string[]>(s.life, APPLIED_FLAG, [])
  if (applied.includes(g.n) || lsList(APPLIED_KEY).includes(g.n)) return { applied: false, why: 'done' }
  if (g.c && g.c !== s.meta.id) return { applied: false, why: 'other_career' }
  let line: LText | null = null
  switch (g.k) {
    case 'gear': {
      const def = g.id ? GEAR_BY_ID[g.id] : undefined
      if (!def || !addGear(s.life, def.id)) return { applied: false, why: 'not_applicable' }
      line = { tr: `${def.icon} ${def.name.tr} çantanda (${def.matches} maç).`, en: `${def.icon} ${def.name.en} is in your bag (${def.matches} matches).` }
      break
    }
    case 'cash': {
      const left = Math.max(0, CASH_PER_SEASON - boughtCashThisSeason(s))
      const amount = Math.min(left, cashGrantAmount(s, g.weeks ?? 0, g.floor ?? 0, g.cap ?? Infinity))
      s.life.money += amount
      const b = readJson<{ season: number; total: number }>(s.life, BOUGHT_FLAG, { season: s.calendar.season, total: 0 })
      writeJson(s.life, BOUGHT_FLAG, { season: s.calendar.season, total: (b.season === s.calendar.season ? b.total : 0) + amount })
      line = { tr: `💶 +${fmtMoney(amount).tr} kariyer cüzdanına eklendi.`, en: `💶 +${fmtMoney(amount).en} added to your career wallet.` }
      break
    }
    case 'physio': {
      if (!s.hero.injury || s.hero.injury.weeksLeft <= 1) return { applied: false, why: 'not_applicable' }
      const before = s.hero.injury.weeksLeft
      s.hero.injury.weeksLeft = Math.max(1, Math.ceil(before / 2))
      line = { tr: `🩺 Fizyoterapi: sakatlık ${before} haftadan ${s.hero.injury.weeksLeft} haftaya indi.`, en: `🩺 Physio: the lay-off is down from ${before} weeks to ${s.hero.injury.weeksLeft}.` }
      break
    }
    case 'match_bonus': {
      const lb = readJson<LastBonus | null>(s.life, LAST_BONUS_FLAG, null)
      if (!lb || lb.doubled || lb.amount <= 0 || (g.ref && g.ref !== lb.key)) return { applied: false, why: 'not_applicable' }
      s.life.money += lb.amount
      writeJson(s.life, LAST_BONUS_FLAG, { ...lb, doubled: true })
      line = { tr: `💰 Maç primi ikiye katlandı: +${fmtMoney(lb.amount).tr}`, en: `💰 Match bonus doubled: +${fmtMoney(lb.amount).en}` }
      break
    }
    case 'train_boost':
      addAdTrainBoost(s.life)
      line = { tr: '⚡ Sonraki antrenmanın XP’si +%20.', en: '⚡ Your next training session gets +20% XP.' }
      break
    default:
      // cosmetic / season_x2: nothing in the career (entitlements and diamonds live on the server).
      break
  }
  // The nonce goes into the save now (written with the career); the install-wide list and the ack only
  // after the save is on disk (applyInbox), so a crash in between can never lose the grant.
  writeJson(s.life, APPLIED_FLAG, [...applied, g.n].slice(-200))
  return { applied: true, line }
}

/** Per career season, purchased cash (packs + diamonds→cash) stops here (docs/MONETIZASYON.md §6.4). */
export const CASH_PER_SEASON = PURCHASED_CASH_PER_SEASON

/** Cash bought this career season so far. */
export function boughtCashThisSeason(s: GameState): number {
  const b = readJson<{ season: number; total: number }>(s.life, BOUGHT_FLAG, { season: s.calendar.season, total: 0 })
  return b.season === s.calendar.season ? b.total : 0
}

async function flushAcks(): Promise<void> {
  const q = lsList(ACKQ_KEY)
  if (!q.length) return
  try {
    await shopApi.ack(q.slice(0, 50))
    lsSet(ACKQ_KEY, lsList(ACKQ_KEY).filter((n) => !q.slice(0, 50).includes(n)))
  } catch {
    /* kept for the next wallet refresh */
  }
}

let applying = false
let refreshedOld = false

const NOT_APPLIED: Record<string, LText> = {
  match_bonus: { tr: 'Prim ×2 bu maça uygulanamadı (prim yok ya da zaten katlandı).', en: 'The ×2 bonus could not apply to this match (no bonus, or already doubled).' },
  physio: { tr: 'Fizyoterapi uygulanamadı: sakatlık bitmiş. Elmasların iade edilecek.', en: 'Physio could not apply: the injury is over. Your diamonds will be refunded.' },
}

/** Inbox handler: verify, apply to the loaded career, save, then mark and acknowledge. */
export async function applyInbox(w: ServerWallet): Promise<void> {
  const s = current()
  const account = currentAccountId()
  if (applying) return
  applying = true
  try {
    const ack: string[] = []
    const appliedNow: string[] = []
    const voids: string[] = []
    let otherCareer: string[] = []
    let changed = false
    for (const g of w.inbox) {
      const p = await verifyGrant(g.token, account)
      if (!p) {
        // Not signed by our server for this account (or too old): never applied, never acknowledged.
        // A genuine grant that only aged past 90 days is re-signed by the server once per session.
        if (!refreshedOld && Date.now() - (g as { t?: number }).t! > GRANT_MAX_AGE_MS) {
          refreshedOld = true
          void shopApi.refreshGrants().then((nw) => applyInbox(nw)).catch(() => {})
        }
        console.warn('[StarPath] shop grant rejected (bad signature, account or age)')
        continue
      }
      if (p.k === 'cosmetic' || p.k === 'season_x2') {
        ack.push(p.n)
        continue
      }
      // The career may have changed while we awaited the signature check (load / new game).
      if (!s || current() !== s) continue
      const r = applyGrant(s, p)
      if (r.applied) {
        changed = true
        if (r.line) notify(r.line, 'success')
        appliedNow.push(p.n)
      } else if (r.why === 'done') ack.push(p.n)
      else if (r.why === 'other_career') otherCareer.push(p.n)
      else if (r.why === 'not_applicable') {
        const msg = NOT_APPLIED[p.k]
        if (msg) notify(msg, 'info')
        // A diamond spend that can no longer apply (injury healed) is refunded by the server.
        if (p.k === 'physio') voids.push(p.n)
        else ack.push(p.n)
      }
    }
    if (changed && s && current() === s) {
      commit(s)
      scheduleAutosave()
      // Saved first, marked and acknowledged after: a crash in between re-offers the grant, and the
      // nonce saved with the career keeps it from being applied twice.
      try {
        await flushAutosave()
        lsSet(APPLIED_KEY, [...lsList(APPLIED_KEY), ...appliedNow])
        ack.push(...appliedNow)
      } catch {
        /* not on disk yet: acknowledged on the next pass */
      }
    }
    // Grants bound to a career that no longer exists in any save: give the diamonds back.
    if (otherCareer.length) {
      const ids = await savedCareerIds()
      if (ids) {
        otherCareer = otherCareer.filter((n) => {
          const g = w.inbox.find((x) => x.nonce === n)
          const c = g ? (JSON.parse(atob(g.token.split('.')[0]!.replace(/-/g, '+').replace(/_/g, '/'))) as { c?: string }).c : undefined
          return c && !ids.has(c) && (s?.meta.id !== c)
        })
        voids.push(...otherCareer)
      }
    }
    for (const n of voids) {
      try {
        const r = await shopApi.voidGrant(n)
        if (r.refunded > 0) notify({ tr: `💎 ${r.refunded} elmas iade edildi (kariyer bulunamadı).`, en: `💎 ${r.refunded} diamonds refunded (the career is gone).` }, 'info')
      } catch {
        ack.push(n)
      }
    }
    if (ack.length) lsSet(ACKQ_KEY, [...new Set([...lsList(ACKQ_KEY), ...ack])])
    await flushAcks()
  } finally {
    applying = false
  }
}

let installed = false
/** Called once at boot. */
export function installShopBridge(): void {
  if (installed) return
  installed = true
  setInboxHandler(applyInbox)
}

/** A career was loaded or started: pick up anything bought meanwhile (title screen, other slot). */
export function onCareerReady(): void {
  if (!storeAvailable()) return
  const w = serverWallet.peek()
  if (w?.inbox.length) void applyInbox(w)
  void refreshWallet()
}

/** After a club match: remember its bonus (for the "watch an ad: ×2" offer) and claim MOTM diamonds. */
export function onMatchFinished(s: GameState, fixtureId: string, bonusTotal: number, motm: boolean): void {
  writeJson(s.life, LAST_BONUS_FLAG, { key: fixtureId, amount: Math.max(0, Math.round(bonusTotal)), doubled: false } satisfies LastBonus)
  if (motm) claimFreeGems(s, 'motm', fixtureId)
}

/** Last match's bonus, while it can still be doubled. */
export function doublableBonus(s: GameState, fixtureId: string): number {
  const lb = readJson<LastBonus | null>(s.life, LAST_BONUS_FLAG, null)
  return lb && lb.key === fixtureId && !lb.doubled ? lb.amount : 0
}

/** Free diamonds for an event in the career (deduped and capped by the server; queued until the shop is used). */
export function claimFreeGems(s: GameState, source: 'motm' | 'objective' | 'season' | 'award' | 'first', key: string): void {
  if (!storeAvailable()) return
  queueEarn(source, `${s.meta.id}:${key}`)
  void flushEarnQueue()
}

// ───────── Player actions (Store screen) ─────────

export type ShopActionResult = { ok: true; gems?: number } | { ok: false; reason: string }

const idem = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

/** Spend diamonds on the server; the grant it returns is applied to the career right away. */
async function spendFor(item: string, discount = false): Promise<ShopActionResult> {
  try {
    const w = await shopApi.spend(item, idem(), discount, current()?.meta.id)
    await handleWallet(w)
    return { ok: true, gems: w.gems }
  } catch (e) {
    return { ok: false, reason: e instanceof ShopApiError ? e.code : 'failed' }
  }
}

export function buyGear(id: string): Promise<ShopActionResult> {
  if (!current()) return Promise.resolve({ ok: false, reason: 'no_career' })
  return spendFor(id)
}

/** One physio session per injury (a second would only shave a week). */
export function physioUsedOnThisInjury(s: GameState): boolean {
  const k = readJson<{ name: string; at: number } | null>(s.life, 'g:physioOn', null)
  return !!(k && s.hero.injury && k.name === s.hero.injury.name.en && k.at >= s.hero.injury.weeksLeft)
}

export async function buyPhysio(discount: boolean): Promise<ShopActionResult> {
  const s = current()
  if (!s?.hero.injury || s.hero.injury.weeksLeft <= 1) return { ok: false, reason: 'not_injured' }
  if (physioUsedOnThisInjury(s)) return { ok: false, reason: 'physio_used' }
  const r = await spendFor('physio', discount)
  if (r.ok && s.hero.injury) {
    writeJson(s.life, 'g:physioOn', { name: s.hero.injury.name.en, at: s.hero.injury.weeksLeft })
    commit(s)
  }
  return r
}

export function gemsToCash(): Promise<ShopActionResult> {
  if (!current()) return Promise.resolve({ ok: false, reason: 'no_career' })
  return spendFor('gems_to_cash')
}

/** Cosmetic packs can also be unlocked with diamonds (docs/MONETIZASYON.md §5). */
export function buyCosmeticWithGems(packId: 'pack_celebrations' | 'pack_avatar'): Promise<ShopActionResult> {
  return spendFor(packId === 'pack_celebrations' ? 'cos_celebrations' : 'cos_avatar')
}

export async function claimPassDaily(): Promise<ShopActionResult> {
  try {
    const w = await shopApi.passClaim()
    return { ok: true, gems: w.gems }
  } catch (e) {
    return { ok: false, reason: e instanceof ShopApiError ? e.code : 'failed' }
  }
}

export function equipGearAction(id: string): void {
  const s = current()
  if (!s || !equipGear(s.life, id)) return
  commit(s)
  scheduleAutosave()
}

export function unequipGearAction(slot: GearSlot): void {
  const s = current()
  if (!s) return
  unequipGear(s.life, slot)
  commit(s)
  scheduleAutosave()
}
