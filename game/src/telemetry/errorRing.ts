/**
 * Always-on, in-memory ring of the last few runtime errors (window errors, unhandled
 * rejections, Phaser scene failures). Unlike the opt-in crash log (errorLog.ts) nothing is
 * persisted or sent: the ring only feeds the render-failure panel, so a player stuck on a
 * broken GPU path can screenshot the real cause.
 */

export interface RingEntry {
  at: number
  kind: 'error' | 'rejection' | 'phaser' | 'render'
  message: string
}

export const RING_SIZE = 12
const ring: RingEntry[] = []

const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n)}…` : s)

/** Short, single-line text of any thrown value (message + first stack frame). */
export function describeError(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { message?: unknown; stack?: unknown; name?: unknown }
    const msg = typeof e.message === 'string' ? e.message : String(err)
    const frame = typeof e.stack === 'string' ? e.stack.split('\n').find((l) => /\bat\b|@/.test(l) && !l.includes(msg)) : undefined
    return clip(frame ? `${msg} (${frame.trim()})` : msg, 300)
  }
  return clip(String(err), 300)
}

/** The last few entries are also kept in localStorage, so a hang / restart does not lose them. */
export const PERSISTED_ERRORS_KEY = 'sp.diag.errors'
const PERSISTED_MAX = 8

export function pushError(kind: RingEntry['kind'], err: unknown, now: number = Date.now()): void {
  const e: RingEntry = { at: now, kind, message: describeError(err) }
  ring.push(e)
  if (ring.length > RING_SIZE) ring.splice(0, ring.length - RING_SIZE)
  try {
    if (typeof localStorage === 'undefined') return
    const list = persistedErrors()
    list.push(e)
    localStorage.setItem(PERSISTED_ERRORS_KEY, JSON.stringify(list.slice(-PERSISTED_MAX)))
  } catch {
    /* storage unavailable: the in-memory ring still works */
  }
}

/** Errors kept across launches (oldest first). */
export function persistedErrors(): RingEntry[] {
  try {
    if (typeof localStorage === 'undefined') return []
    const v = JSON.parse(localStorage.getItem(PERSISTED_ERRORS_KEY) || '[]') as unknown
    return Array.isArray(v) ? (v as RingEntry[]).filter((e) => e && typeof e.message === 'string') : []
  } catch {
    return []
  }
}

/** Oldest first. */
export function recentErrors(): readonly RingEntry[] {
  return ring.slice()
}

export function clearErrorRing(): void {
  ring.length = 0
}

let installed = false

/** Listens to window errors and unhandled rejections (idempotent). */
export function installErrorRing(target: Pick<Window, 'addEventListener'> | undefined = typeof window === 'undefined' ? undefined : window): void {
  if (installed || !target) return
  installed = true
  target.addEventListener('error', (ev: Event) => {
    const e = ev as ErrorEvent
    pushError('error', e.error ?? e.message ?? 'error')
  })
  target.addEventListener('unhandledrejection', (ev: Event) => {
    pushError('rejection', (ev as PromiseRejectionEvent).reason ?? 'rejection')
  })
}

/** Tests only. */
export function _resetErrorRing(): void {
  installed = false
  ring.length = 0
}
