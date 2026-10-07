/**
 * Objectives for the UI: view mapping (Home card / detail / season review),
 * completion + miss feedback (toasts, queued off the match flow) and a
 * dev-only helper that force-completes an objective for the e2e suite.
 */
import { signal } from '@preact/signals'
import type { GameState, LText } from '../../core/types'
import { lt as render } from '../../i18n'
import { t } from '../../i18n'
import { objectivesView, type ObjectivesView, type ObjectiveView } from '../../sim/game'
import { OBJECTIVES_FLAG } from '../../sim/game'
import { objectivesDaily } from '../../sim/game/objectives'
import { readJson, writeJson } from '../../sim/game/internal'
import { toast } from '../components/Toast'
import { screen } from '../store'
import { TOAST_QUIET_SCREENS } from './meta'
import { commit, onCommit } from './session'

export const OBJ_BASE_FLAG = 'ui:objBase'

export interface ObjectivesUi {
  /** Short objectives (manager, fans, sponsor, family, agent), at most three at once. */
  short: ObjectiveView[]
  /** Board league target (season long). */
  board: ObjectiveView | null
  /** Personal season target (season long). */
  personal: ObjectiveView | null
  recent: ObjectivesView['recent']
  /** Career totals. */
  done: number
  failed: number
  /** Totals since this season began. */
  seasonDone: number
  seasonFailed: number
}

interface Base { season: number; done: number; failed: number }

/** Pure mapping from the sim view (and the counters when the season began). */
export function mapObjectives(view: ObjectivesView, base: Base | null): ObjectivesUi {
  const seasonal = view.active.filter((o) => o.seasonal)
  return {
    short: view.active.filter((o) => !o.seasonal),
    board: seasonal.find((o) => o.source === 'board') ?? null,
    personal: seasonal.find((o) => o.source !== 'board') ?? null,
    recent: view.recent,
    done: view.done,
    failed: view.failed,
    seasonDone: Math.max(0, view.done - (base?.done ?? view.done)),
    seasonFailed: Math.max(0, view.failed - (base?.failed ?? view.failed)),
  }
}

export const emptyObjectives = (): ObjectivesUi => ({ short: [], board: null, personal: null, recent: [], done: 0, failed: 0, seasonDone: 0, seasonFailed: 0 })

/** Selector used by realData and the mock backend. */
export function objectivesUi(s: GameState): ObjectivesUi {
  const view = objectivesView(s)
  const base = readJson<Base | null>(s.life, OBJ_BASE_FLAG, null)
  return mapObjectives(view, base && base.season === s.calendar.season ? base : null)
}

// ───────────────────────── Feedback ─────────────────────────

interface Pending { kind: 'done' | 'failed'; title: LText }
export const queuedObjectiveToasts = signal<Pending[]>([])
let seen: { id: string; done: number; failed: number } | null = null

function show(p: Pending): void {
  try {
    const title = render(p.title)
    if (p.kind === 'done') toast(t('objectives.toastDone', { title }), 'reward', 'target', 5000)
    else toast(t('objectives.toastMissed', { title }), 'info', 'hourglass', 3600)
  } catch {
    /* no DOM */
  }
}

/** Show queued objective toasts once the player is off the match / ceremony screens. */
export function flushObjectiveToasts(): void {
  if (TOAST_QUIET_SCREENS.has(screen.value.id) || queuedObjectiveToasts.value.length === 0) return
  const list = queuedObjectiveToasts.value
  queuedObjectiveToasts.value = []
  for (const p of list) show(p)
}

/** Commit hook: season baseline + toast for objectives that just finished. */
export function onObjectivesCommit(s: GameState): void {
  const view = objectivesView(s)
  const base = readJson<Base | null>(s.life, OBJ_BASE_FLAG, null)
  if (!base || base.season !== s.calendar.season) {
    writeJson(s.life, OBJ_BASE_FLAG, { season: s.calendar.season, done: view.done, failed: view.failed } satisfies Base)
  }
  const prev = seen
  seen = { id: s.meta.id, done: view.done, failed: view.failed }
  if (!prev || prev.id !== s.meta.id || view.done < prev.done || view.failed < prev.failed) return
  const dd = view.done - prev.done
  const df = view.failed - prev.failed
  if (dd + df <= 0) return
  // `recent` is newest first; the first dd+df rows are what just finished.
  const fresh: Pending[] = view.recent.slice(0, dd + df).reverse().map((r) => ({ kind: r.status, title: r.title }))
  for (const p of fresh) {
    if (TOAST_QUIET_SCREENS.has(screen.value.id)) queuedObjectiveToasts.value = [...queuedObjectiveToasts.value, p]
    else show(p)
  }
}

let installed = false
export function installObjectivesFeed(): void {
  if (installed) return
  installed = true
  onCommit(onObjectivesCommit)
}

/** Forget the toast baseline (new game / load). */
export function resetObjectivesFeed(): void {
  seen = null
  queuedObjectiveToasts.value = []
}

/**
 * Dev hook: push the first short objective to its target and settle it,
 * exactly as a real match would. Returns false when nothing is active.
 */
export function forceCompleteObjective(s: GameState): boolean {
  const st = readJson<{ active: { kind: string; target: number; progress: number; sum?: number }[] }>(s.life, OBJECTIVES_FLAG, { active: [] })
  const o = st.active.find((x) => !['leaguePos', 'seasonGoals', 'seasonCleanSheets', 'seasonApps'].includes(x.kind)) ?? st.active[0]
  if (!o) return false
  o.progress = o.target
  if (o.kind === 'rating') o.sum = o.target * 10
  writeJson(s.life, OBJECTIVES_FLAG, st)
  objectivesDaily(s, [])
  commit(s)
  return true
}
