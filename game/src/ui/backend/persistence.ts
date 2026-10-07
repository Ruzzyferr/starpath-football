/**
 * Save slots over the crash-safe SaveManager (IndexedDB in the browser,
 * memory in tests) through the façade's packed saveGame/loadGame wrappers.
 *
 * UI slots are 1..3; SaveManager slots are 0..2 (`ui - 1`). `meta.slot` of the
 * live state always holds the UI slot number.
 *
 * Autosave is debounced and non-blocking: it waits for an idle moment, and a
 * save requested while one is running is coalesced into a single follow-up.
 */
import { signal } from '@preact/signals'
import type { GameState } from '../../core/types'
import { loadGame, saveGame, unpackState } from '../../sim/game'
import { MemoryStorage, SaveManager, defaultStorage, migrate, openEnvelope, type SaveNotice, type SaveStorage } from '../../state/save'
import type { SaveSlotInfo } from '../store'
import { current, notify } from './session'

export const UI_SLOTS = [1, 2, 3] as const

let mgr: SaveManager | null = null
let storage: SaveStorage | null = null

/** Use a specific storage (tests). Resets the manager. */
export function useStorage(s: SaveStorage): void {
  storage = s
  mgr = new SaveManager(s)
  mgr.onNotice = onSaveNotice
}

/** Player-facing messages for SaveManager notices (backup skipped, migrated, integrity problems). */
function onSaveNotice(n: SaveNotice): void {
  if (n.kind === 'backups-skipped') {
    notify({ tr: 'Depolama alanı dolu: yedekler atlandı. Eski kayıtlarını dışa aktarıp yer aç.', en: 'Storage is full: backups were skipped. Export old saves and free some space.' }, 'warning')
  } else if (n.kind === 'integrity') {
    if (n.problem === 'newer-version') notify({ tr: `Slot ${n.slot + 1}: kayıt daha yeni bir sürümden. Oyunu güncelleyin.`, en: `Slot ${n.slot + 1}: save is from a newer version. Please update the game.` }, 'warning')
    else if (n.problem === 'live-invalid-recovered') notify({ tr: `Slot ${n.slot + 1}: kayıt hasarlı; yedekten yüklenebilir.`, en: `Slot ${n.slot + 1}: save is damaged; a backup is available.` }, 'warning')
    else notify({ tr: `Slot ${n.slot + 1}: kayıt hasarlı ve yedek bulunamadı.`, en: `Slot ${n.slot + 1}: save is damaged and no backup was found.` }, 'error')
  }
}

/** Integrity check of every slot; run once per launch. */
export async function checkSaveIntegrity(): Promise<void> {
  try { await manager().checkIntegrity() } catch (e) { console.warn('[StarPath] integrity check failed', e) }
}

function manager(): SaveManager {
  if (!mgr) {
    let st: SaveStorage
    try {
      st = defaultStorage()
    } catch {
      st = new MemoryStorage()
    }
    useStorage(st)
  }
  return mgr as SaveManager
}

const toMgr = (uiSlot: number): number => uiSlot - 1

/** Slot cards, refreshed asynchronously after every save/delete/import. */
export const slotInfos = signal<SaveSlotInfo[]>(UI_SLOTS.map((slot) => ({ slot, empty: true })))

export async function refreshSlots(): Promise<SaveSlotInfo[]> {
  try {
    const sums = await manager().summaries()
    slotInfos.value = UI_SLOTS.map((slot) => {
      const s = sums[toMgr(slot)]
      if (!s) return { slot, empty: true }
      return {
        slot, empty: false, heroName: s.heroName, clubName: s.clubName, crest: s.crest, season: s.season, week: s.week,
        ovr: s.ovr, money: s.money, updatedAt: s.savedAt, playTimeSec: s.playTimeSec,
      }
    })
  } catch (e) {
    console.warn('[StarPath] could not read save slots', e)
  }
  return slotInfos.value
}

/** First empty slot, else the least recently saved one. */
export function pickSlotForNewCareer(): number {
  const infos = slotInfos.value
  const empty = infos.find((x) => x.empty)
  if (empty) return empty.slot
  return [...infos].sort((a, b) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0))[0]?.slot ?? 1
}

let chain: Promise<void> = Promise.resolve()

/** Serialize all storage writes. */
function queue(fn: () => Promise<void>): Promise<void> {
  const next = chain.then(fn, fn)
  chain = next.catch(() => {})
  return next
}

export function saveState(state: GameState, uiSlot = state.meta.slot || 1): Promise<void> {
  const slot = Math.min(3, Math.max(1, Math.round(uiSlot)))
  return queue(async () => {
    // saveGame serializes synchronously (and stamps meta.slot with the manager index): restore the UI slot at once.
    const p = saveGame(manager(), toMgr(slot), state)
    state.meta.slot = slot
    await p
    await refreshSlots()
  })
}

export interface LoadOutcome {
  state: GameState | null
  recoveredFromBackup: number | null
  /** Set when the slot could not be loaded because it was written by a newer build. */
  newerVersion?: boolean
}

export async function loadState(uiSlot: number): Promise<LoadOutcome> {
  await chain
  const r = await loadGame(manager(), toMgr(uiSlot))
  if (!r.ok) return { state: null, recoveredFromBackup: null, newerVersion: r.reason === 'newer' }
  r.state.meta.slot = uiSlot
  return { state: r.state, recoveredFromBackup: r.recoveredFromBackup }
}

export function deleteSlot(uiSlot: number): Promise<void> {
  return queue(async () => {
    await manager().remove(toMgr(uiSlot))
    await refreshSlots()
  })
}

export async function exportSlot(uiSlot: number): Promise<string> {
  await chain
  const raw = await manager().exportSlot(toMgr(uiSlot))
  if (raw) return raw
  const s = current()
  if (s && s.meta.slot === uiSlot) {
    await saveState(s, uiSlot)
    const again = await manager().exportSlot(toMgr(uiSlot))
    if (again) return again
  }
  throw new Error('empty slot')
}

function looksLikeState(x: unknown): x is GameState {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return typeof o.version === 'number' && !!o.hero && !!o.life && !!o.world && !!o.calendar && !!o.meta
}

/** Import an exported envelope (or a bare state JSON) into a slot. */
export async function importSlot(json: string, uiSlot: number): Promise<boolean> {
  if (openEnvelope(json)) {
    let ok = false
    await queue(async () => {
      ok = await manager().importSlot(toMgr(uiSlot), json)
      await refreshSlots()
    })
    return ok
  }
  try {
    const parsed: unknown = JSON.parse(json)
    if (!looksLikeState(parsed)) return false
    const st = migrate(parsed, parsed.version)
    if (!st) return false
    unpackState(st)
    await saveState(st, uiSlot)
    return true
  } catch {
    return false
  }
}

export function deleteAll(): Promise<void> {
  return queue(async () => {
    for (const s of UI_SLOTS) await manager().remove(toMgr(s))
    await refreshSlots()
  })
}

// ───────────────────────── Autosave ─────────────────────────

let timer: ReturnType<typeof setTimeout> | null = null
let pending = false
/** Last autosave error (shown once). */
export const autosaveError = signal<string | null>(null)

/** Request an autosave of the live state (debounced ~1.2 s, then on idle). */
export function scheduleAutosave(delay = 1200): void {
  pending = true
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    const run = () => {
      if (!pending) return
      pending = false
      const s = current()
      if (!s) return
      saveState(s).then(
        () => { autosaveError.value = null },
        (e: unknown) => { autosaveError.value = String((e as Error)?.message ?? e) },
      )
    }
    const ric = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback
    if (ric) ric(run, { timeout: 2000 })
    else run()
  }, delay)
}

/** Flush a pending autosave now (e.g. before unload / in tests). */
export async function flushAutosave(): Promise<void> {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (pending) {
    pending = false
    const s = current()
    if (s) await saveState(s)
  }
  await chain
}

export const storageForTests = (): SaveStorage | null => storage
