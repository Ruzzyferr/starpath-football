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
import { recordError } from '../../telemetry/errorLog'
import { signal } from '@preact/signals'
import type { GameState } from '../../core/types'
import { loadGame, saveGame, unpackState } from '../../sim/game'
import { MemoryStorage, SaveManager, defaultStorage, migrate, openEnvelope, type SaveNotice, type SaveStorage } from '../../state/save'
import { stateVersion, type SaveSlotInfo } from '../store'
import { current, notify } from './session'

export const UI_SLOTS = [1, 2, 3] as const

let mgr: SaveManager | null = null
let storage: SaveStorage | null = null

/** Use a specific storage (tests). Resets the manager. */
export function useStorage(s: SaveStorage): void {
  storage = s
  mgr = new SaveManager(s)
  mgr.onNotice = onSaveNotice
  slotsGen++ // a listing still running against the previous storage must not overwrite the new one
}

/** Player-facing messages for SaveManager notices (backup skipped, migrated, integrity problems). */
function onSaveNotice(n: SaveNotice): void {
  recordError(`save notice: ${n.kind}${'problem' in n ? ' ' + n.problem : ''}`, 'save') // opt-in local log (2.12#120)
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

let slotsGen = 0

/** Career ids of all saved careers, or null when unknown (an older save without the id, storage error). */
export async function savedCareerIds(): Promise<Set<string> | null> {
  try {
    const sums = await manager().summaries()
    const ids = new Set<string>()
    for (const s of Object.values(sums)) {
      if (!s) continue
      if (!s.careerId) return null
      ids.add(s.careerId)
    }
    return ids
  } catch {
    return null
  }
}

export async function refreshSlots(): Promise<SaveSlotInfo[]> {
  let m: SaveManager
  try {
    m = manager() // may install the default storage (which bumps the generation): before taking ours
  } catch {
    return slotInfos.value
  }
  const gen = ++slotsGen
  try {
    const sums = await m.summaries()
    if (gen !== slotsGen) return slotInfos.value
    slotInfos.value = UI_SLOTS.map((slot) => {
      const s = sums[toMgr(slot)]
      if (!s) return { slot, empty: true }
      return {
        slot, empty: false, heroName: s.heroName, clubName: s.clubName, crest: s.crest, season: s.season, week: s.week,
        ovr: s.ovr, money: s.money, updatedAt: s.savedAt, playTimeSec: s.playTimeSec, thumb: s.thumb,
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

/** Save indicator state ("Kaydediliyor…" / "Kaydedildi" / error) for the subtle HUD badge. */
export interface SaveStatus {
  /** `pending`: newer changes are waiting for the debounced autosave (the badge never says "Saved" for an old snapshot). */
  phase: 'idle' | 'pending' | 'saving' | 'saved' | 'error'
  kind: 'auto' | 'manual'
  at: number
  error?: string
}
export const saveStatus = signal<SaveStatus>({ phase: 'idle', kind: 'auto', at: 0 })

/** True while the live state has changes no save has picked up yet. */
let dirty = false
/** stateVersion (bumped by every commit, silent ones included) at the last save of the live career. */
let savedVersion = -1
export function markDirty(): void {
  dirty = true
}
export const isDirty = (): boolean => dirty || (!!current() && stateVersion.peek() !== savedVersion)

export function saveState(state: GameState, uiSlot = state.meta.slot || 1, kind: SaveStatus['kind'] = 'manual'): Promise<void> {
  const slot = Math.min(3, Math.max(1, Math.round(uiSlot)))
  return queue(async () => {
    saveStatus.value = { phase: 'saving', kind, at: Date.now() }
    // Newest state wins: a save queued behind another one writes the live career as it is NOW,
    // never the (older) snapshot object it was asked for — commits replace the state object.
    const live = current()
    const isLive = !!live && (state === live || state.meta.id === live.meta.id)
    const snap = isLive ? live : state
    // Changes made from here on are not in this snapshot.
    if (isLive) {
      dirty = false
      savedVersion = stateVersion.peek()
    }
    try {
      // saveGame serializes synchronously (and stamps meta.slot with the manager index): restore the UI slot at once.
      const p = saveGame(manager(), toMgr(slot), snap, Date.now())
      snap.meta.slot = slot
      if (snap !== state) state.meta.slot = slot
      await p
    } catch (e) {
      dirty = true
      savedVersion = -1
      saveStatus.value = { phase: 'error', kind, at: Date.now(), error: String((e as Error)?.message ?? e) }
      throw e
    }
    // Still "pending" if newer changes arrived meanwhile and an autosave for them is on its way.
    const newer = isLive && isDirty() && autosaveEnabled() && (pending || timer !== null)
    saveStatus.value = { phase: newer ? 'pending' : 'saved', kind, at: Date.now() }
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
let retries = 0
/** Last autosave error (shown once). */
export const autosaveError = signal<string | null>(null)

/** Autosave switch (Settings → "Otomatik kayıt"); default ON. Wired to the settings signal by the backend. */
let autosaveOn: () => boolean = () => true
export function setAutosaveSource(fn: () => boolean): void {
  autosaveOn = fn
}
export const autosaveEnabled = (): boolean => {
  try {
    return autosaveOn() !== false
  } catch {
    return true
  }
}

function runAutosave(): Promise<void> {
  pending = false
  const s = current()
  if (!s) return Promise.resolve()
  return saveState(s, s.meta.slot || 1, 'auto').then(
    () => {
      retries = 0
      autosaveError.value = null
    },
    (e: unknown) => {
      const msg = String((e as Error)?.message ?? e)
      recordError(e, 'save') // opt-in local log (2.12#120)
      // Transient failures (busy bridge, storage hiccup): retry a few times with backoff, then tell the player once.
      if (retries < 3) {
        retries++
        scheduleAutosave(1500 * 2 ** retries)
      } else if (autosaveError.value === null) {
        autosaveError.value = msg
        notify({ tr: 'Otomatik kayıt başarısız. Ayarlar → Kayıtlar’dan elle kaydet.', en: 'Autosave failed. Save manually from Settings → Saves.' }, 'error')
      }
    },
  )
}

/** Request an autosave of the live state (debounced ~1.2 s, then on idle). No-op when autosave is off. */
export function scheduleAutosave(delay = 1200): void {
  dirty = true
  if (!autosaveEnabled()) return
  pending = true
  // The last "Saved" no longer covers the live state.
  if (saveStatus.peek().phase !== 'saving') saveStatus.value = { phase: 'pending', kind: 'auto', at: Date.now() }
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    const run = () => {
      if (pending) void runAutosave()
    }
    const ric = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback
    if (ric) ric(run, { timeout: 2000 })
    else run()
  }, delay)
}

/**
 * Flush a pending autosave now (before unload, on app background, before loading a slot, in tests).
 * With `force`, also saves unsaved changes that no autosave was scheduled for (app going to background).
 */
export async function flushAutosave(force = false): Promise<void> {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (pending || (force && isDirty() && autosaveEnabled())) await runAutosave()
  await chain
}

let triggersInstalled = false
/**
 * Crash-safe autosave triggers: the app going to the background (Capacitor App pause / appStateChange →
 * `sp:app-pause`, browser visibilitychange) or the page being closed (pagehide) saves unsaved changes at once.
 * `beforeSave` runs first (e.g. persist the live-match snapshot into the state).
 */
export function installAutosaveTriggers(beforeSave: () => void = () => {}): void {
  if (triggersInstalled || typeof window === 'undefined') return
  triggersInstalled = true
  const now = () => {
    if (!current()) return
    try { beforeSave() } catch { /* ignore */ }
    void flushAutosave(true).catch(() => undefined)
  }
  window.addEventListener('sp:app-pause', now)
  window.addEventListener('pagehide', now)
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') now()
    })
  }
}

export const storageForTests = (): SaveStorage | null => storage
