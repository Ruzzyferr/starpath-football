/**
 * Shop ↔ career bridge (UI backend; the sim never imports the store).
 *
 * The shop server sends grants (signed coupons) for what was paid for with diamonds, real money or a
 * watched ad: gear, a cash top-up, a physio session, a doubled match bonus, a training boost. Each grant
 * is applied to the active career exactly once (its nonce is remembered in the save), then acknowledged
 * so the server stops offering it. Free diamonds earned in the career (Man of the Match, weekly goals,
 * season awards) are claimed here; the server dedupes and caps them.
 */
import type { GameState, LText } from '../../core/types'
import { addAdTrainBoost, addGear, equipGear, GEAR_BY_ID, unequipGear, type GearSlot } from '../../sim/career/gear'
import { fmtMoney } from '../../sim/career/common'
import { readJson, writeJson } from '../../sim/game/internal'
import { ShopApiError, flushEarnQueue, handleWallet, queueEarn, refreshWallet, serverWallet, setInboxHandler, shopApi, storeAvailable, type ServerGrant, type ServerWallet } from '../../store-iap'
import { commit, current, notify } from './session'
import { flushAutosave, scheduleAutosave } from './persistence'

const APPLIED_FLAG = 'g:grants'
const LAST_BONUS_FLAG = 'g:lastBonus'
const BOUGHT_FLAG = 'g:boughtCash'

interface LastBonus { key: string; amount: number; doubled: boolean }

/** Cash pack value: weeks × current gross weekly wage, never less than the pack's floor. */
export function cashGrantAmount(s: GameState, weeks: number, floor: number): number {
  return Math.max(floor, Math.round(weeks * Math.max(0, s.hero.contract?.wage ?? 0)))
}

/** Applies one grant to the career. Returns a line for the toast, or null when it did nothing. */
export function applyGrant(s: GameState, g: ServerGrant): LText | null {
  const applied = readJson<string[]>(s.life, APPLIED_FLAG, [])
  if (applied.includes(g.nonce)) return null
  let line: LText | null = null
  switch (g.k) {
    case 'gear': {
      const def = g.id ? GEAR_BY_ID[g.id] : undefined
      if (def && addGear(s.life, def.id)) line = { tr: `${def.icon} ${def.name.tr} çantanda (${def.matches} maç).`, en: `${def.icon} ${def.name.en} is in your bag (${def.matches} matches).` }
      break
    }
    case 'cash': {
      const amount = cashGrantAmount(s, g.weeks ?? 0, g.floor ?? 0)
      s.life.money += amount
      const b = readJson<{ season: number; total: number }>(s.life, BOUGHT_FLAG, { season: s.calendar.season, total: 0 })
      writeJson(s.life, BOUGHT_FLAG, { season: s.calendar.season, total: (b.season === s.calendar.season ? b.total : 0) + amount })
      line = { tr: `💶 ${fmtMoney(amount).tr} kariyer cüzdanına eklendi.`, en: `💶 ${fmtMoney(amount).en} added to your career wallet.` }
      break
    }
    case 'physio': {
      if (s.hero.injury) {
        const before = s.hero.injury.weeksLeft
        s.hero.injury.weeksLeft = Math.max(1, Math.ceil(before / 2))
        line = { tr: `🩺 Fizyoterapi: sakatlık ${before} haftadan ${s.hero.injury.weeksLeft} haftaya indi.`, en: `🩺 Physio: the lay-off is down from ${before} weeks to ${s.hero.injury.weeksLeft}.` }
      }
      break
    }
    case 'match_bonus': {
      const lb = readJson<LastBonus | null>(s.life, LAST_BONUS_FLAG, null)
      if (lb && !lb.doubled && lb.amount > 0) {
        s.life.money += lb.amount
        writeJson(s.life, LAST_BONUS_FLAG, { ...lb, doubled: true })
        line = { tr: `💰 Maç primi ikiye katlandı: +${fmtMoney(lb.amount).tr}`, en: `💰 Match bonus doubled: +${fmtMoney(lb.amount).en}` }
      }
      break
    }
    case 'train_boost':
      addAdTrainBoost(s.life)
      line = { tr: '⚡ Sonraki antrenmanın XP’si +%20.', en: '⚡ Your next training session gets +20% XP.' }
      break
    default:
      break
  }
  writeJson(s.life, APPLIED_FLAG, [...applied, g.nonce].slice(-200))
  return line
}

let applying = false

/** Inbox handler: apply pending grants to the loaded career, save, then acknowledge them. */
async function applyInbox(w: ServerWallet): Promise<void> {
  const s = current()
  if (!s || applying || !w.inbox.length) return
  applying = true
  try {
    const done: string[] = []
    for (const g of w.inbox) {
      const line = applyGrant(s, g)
      if (line) notify(line, 'success')
      done.push(g.nonce)
    }
    commit(s)
    scheduleAutosave()
    // Saved first, acknowledged after: a crash in between re-offers the grant, and its nonce in the
    // save keeps it from being applied twice.
    await flushAutosave().catch(() => {})
    await shopApi.ack(done).catch(() => {})
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

/** Free diamonds for a completed weekly goal / season award (deduped by the server). */
export function claimFreeGems(s: GameState, source: 'motm' | 'objective' | 'season' | 'award' | 'first', key: string): void {
  if (!storeAvailable()) return
  queueEarn(source, `${s.meta.id}:${key}`)
  void flushEarnQueue()
}

// ───────── Player actions (Store screen) ─────────

export type ShopActionResult = { ok: true } | { ok: false; reason: string }

const idem = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

/** Spend diamonds on the server; the grant it returns is applied to the career right away. */
async function spendFor(item: string, discount = false): Promise<ShopActionResult> {
  try {
    const w = await shopApi.spend(item, idem(), discount)
    await handleWallet(w)
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: e instanceof ShopApiError ? e.code : 'failed' }
  }
}

export function buyGear(id: string): Promise<ShopActionResult> {
  if (!current()) return Promise.resolve({ ok: false, reason: 'no_career' })
  return spendFor(id)
}

export function buyPhysio(discount: boolean): Promise<ShopActionResult> {
  const s = current()
  if (!s?.hero.injury || s.hero.injury.weeksLeft <= 1) return Promise.resolve({ ok: false, reason: 'not_injured' })
  return spendFor('physio', discount)
}

export function gemsToCash(): Promise<ShopActionResult> {
  if (!current()) return Promise.resolve({ ok: false, reason: 'no_career' })
  return spendFor('gems_to_cash')
}

export async function claimPassDaily(): Promise<ShopActionResult> {
  try {
    await shopApi.passClaim()
    return { ok: true }
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
