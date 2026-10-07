/**
 * Shared plumbing for the real backend: access to the live GameState,
 * publishing mutations to the UI signals, and per-state memoisation.
 *
 * Every mutating action works on `gameState.value` in place and then calls
 * {@link commit}, which publishes a NEW shallow copy so signal subscribers
 * re-render. Selectors memoise on the state object identity: a commit makes a
 * new identity, so caches invalidate exactly once per change.
 */
import type { GameState, LText } from '../../core/types'
import { lt as render } from '../../i18n'
import { toast } from '../components/Toast'
import { gameState, stateVersion } from '../store'

export function current(): GameState | null {
  return gameState.value
}

export function get(): GameState {
  const s = gameState.value
  if (!s) throw new Error('StarPath: no career loaded')
  return s
}

let lastCommit = 0
const listeners: ((s: GameState) => void)[] = []

/** Called after every commit (autosave, history snapshots…). */
export function onCommit(fn: (s: GameState) => void): void {
  listeners.push(fn)
}

/**
 * Publish an in-place mutated state. Also accrues play time (wall-clock time
 * between commits, capped so an idle tab does not count).
 */
export function commit(s: GameState, opts: { silent?: boolean } = {}): void {
  const now = Date.now()
  if (lastCommit > 0) s.meta.playTimeSec += Math.min(120, Math.max(0, (now - lastCommit) / 1000))
  s.meta.playTimeSec = Math.round(s.meta.playTimeSec)
  lastCommit = now
  stateVersion.value++
  gameState.value = { ...s, life: { ...s.life }, hero: { ...s.hero }, calendar: { ...s.calendar } }
  if (!opts.silent) for (const l of listeners) l(gameState.value)
}

/** Replace the whole state (new game / load / reset). */
export function replaceState(s: GameState | null): void {
  lastCommit = Date.now()
  stateVersion.value++
  gameState.value = s
}

// ───────────────────────── Memo ─────────────────────────

const memo = new WeakMap<GameState, Map<string, unknown>>()

/** Cache `fn()` for the current state object under `key`. */
export function cached<T>(s: GameState, key: string, fn: () => T): T {
  let m = memo.get(s)
  if (!m) {
    m = new Map()
    memo.set(s, m)
  }
  if (m.has(key)) return m.get(key) as T
  const v = fn()
  m.set(key, v)
  return v
}

// ───────────────────────── Feedback ─────────────────────────

/** Toast an error / info line from the sim (bilingual LText). Safe outside the browser. */
export function notify(text: LText | string | null | undefined, kind: 'error' | 'info' | 'success' | 'warning' = 'error'): void {
  if (!text) return
  try {
    toast(render(text), kind)
  } catch {
    /* no DOM (tests) */
  }
}
