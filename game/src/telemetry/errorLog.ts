/**
 * Local-only crash log (opt-in, privacy-friendly).
 *
 * When enabled, uncaught errors and unhandled rejections are kept in a ring buffer
 * of the last MAX_ENTRIES in localStorage, together with app version / platform /
 * current screen. Nothing is ever sent anywhere: the player copies the report by hand.
 */
import { frameSummaryLine, installFrameMonitor } from './frameStats'
import { detectPlatform } from '../platform/detect'
import { APP_VERSION, BUILD_COMMIT, BUILD_TIME } from './buildInfo'

export const MAX_ENTRIES = 20
const LOG_KEY = 'sp.errorlog'
const OPT_KEY = 'sp.errorlog.enabled'

export interface ErrorEntry {
  at: number
  kind: 'error' | 'unhandledrejection' | 'manual' | 'recovered' | 'webgl-lost' | 'save' | 'render'
  message: string
  stack?: string
  screen: string
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

let screenOf: () => string = () => 'unknown'
let store: Store | null = null
let installed = false

function ls(): Store | null {
  if (store) return store
  try { return typeof localStorage !== 'undefined' ? localStorage : null } catch { return null }
}

/** Tests: swap the backing store. */
export function setErrorLogStore(s: Store | null): void { store = s }

export function isErrorLogEnabled(): boolean {
  try { return ls()?.getItem(OPT_KEY) === '1' } catch { return false }
}

export function setErrorLogEnabled(on: boolean): void {
  try {
    if (on) ls()?.setItem(OPT_KEY, '1')
    else { ls()?.removeItem(OPT_KEY); clearErrorLog() }
  } catch { /* storage unavailable */ }
}

export function readErrorLog(): ErrorEntry[] {
  try {
    const v = JSON.parse(ls()?.getItem(LOG_KEY) ?? '[]') as unknown
    return Array.isArray(v) ? (v as ErrorEntry[]) : []
  } catch { return [] }
}

export function clearErrorLog(): void {
  try { ls()?.removeItem(LOG_KEY) } catch { /* ignore */ }
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) + '...' : s)

/** Append to the ring buffer (no-op unless the player opted in). */
export function recordError(err: unknown, kind: ErrorEntry['kind'] = 'manual'): void {
  if (!isErrorLogEnabled()) return
  try {
    const e = err as { message?: unknown; stack?: unknown } | null
    const entry: ErrorEntry = {
      at: Date.now(),
      kind,
      message: clip(String(e && typeof e === 'object' && 'message' in e ? e.message : err), 500),
      stack: e && typeof e.stack === 'string' ? clip(e.stack, 2000) : undefined,
      screen: screenOf(),
    }
    const log = [...readErrorLog(), entry].slice(-MAX_ENTRIES)
    ls()?.setItem(LOG_KEY, JSON.stringify(log))
  } catch { /* never throw from the error handler */ }
}

export function installErrorLog(getScreen: () => string): void {
  screenOf = getScreen
  if (installed || typeof window === 'undefined') return
  installed = true
  window.addEventListener('error', (ev) => recordError(ev.error ?? ev.message, 'error'))
  window.addEventListener('unhandledrejection', (ev) => recordError(ev.reason, 'unhandledrejection'))
  installFrameMonitor(isErrorLogEnabled)
}

/** Extra sections for the bug report (e.g. the last match moment's kick inputs, plan 2.1#34). */
const attachments = new Map<string, () => string | null>()
export function setReportAttachment(key: string, fn: (() => string | null) | null): void {
  if (fn) attachments.set(key, fn)
  else attachments.delete(key)
}

/** Plain-text report to paste into a bug report. */
export function buildErrorReport(): string {
  const lines = [
    `Kickborn ${APP_VERSION} (${BUILD_COMMIT}${BUILD_TIME ? ', built ' + BUILD_TIME : ''})`,
    `platform: ${detectPlatform()}`,
    `screen: ${screenOf()}`,
    `ua: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'n/a'}`,
    `logging: ${isErrorLogEnabled() ? 'on' : 'off'}`,
    frameSummaryLine(),
    '',
  ]
  const log = readErrorLog()
  if (!log.length) lines.push('(no errors recorded)')
  for (const e of log) {
    lines.push(`[${new Date(e.at).toISOString()}] ${e.kind} @${e.screen}: ${e.message}`)
    if (e.stack) lines.push(e.stack)
  }
  for (const [key, fn] of attachments) {
    let body: string | null
    try {
      body = fn()
    } catch {
      body = null
    }
    if (body) lines.push('', `${key}:`, body)
  }
  return lines.join('\n')
}
