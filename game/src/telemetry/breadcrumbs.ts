/**
 * Persistent start breadcrumbs for remote diagnosis (no network: everything stays on the device).
 *
 * A main-thread hang or a frozen GPU leaves no error behind, so every Phaser host start (and the
 * trial / drill path in front of it) writes short synchronous stages to localStorage. A
 * heartbeat (requestAnimationFrame + timer) runs while a start is in flight: when the next launch
 * finds a start that never reached its first frame (or a clean exit), the heartbeat tells a hung
 * main thread (both stopped) from a frozen screen (timer alive, frames stopped) from a running page.
 *
 * Settings › Diagnostics shows all of it with a Copy button; boot shows a one-time notice.
 * ES2020 only (old Android WebViews): no `||=`, no `structuredClone`, every storage access guarded.
 */

export interface Crumb {
  /** Epoch ms. */
  at: number
  stage: string
  info?: string
}

export interface Heartbeat {
  /** When the heartbeat's start began (epoch ms). */
  since: number
  /** Last requestAnimationFrame callback (epoch ms) and how many ran. */
  raf: number
  rafN: number
  /** Last timer callback (epoch ms) and how many ran. */
  timer: number
  timerN: number
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export const CRUMBS_KEY = 'sp.diag.crumbs'
export const HEARTBEAT_KEY = 'sp.diag.hb'
export const MAX_CRUMBS = 60

/** A start begins with this stage; it ends with one of {@link END_STAGES}. */
export const START_STAGE = 'start'
export const END_STAGES: readonly string[] = ['render-ok', 'exit', 'fail-panel', 'cancel']
/** Written at every app launch, after the previous run was checked. */
export const BOOT_STAGE = 'app-boot'

let memStore: Store | null = null

/** Tests: swap the backing store (null = localStorage). */
export function setCrumbStore(s: Store | null): void {
  memStore = s
}

function store(): Store | null {
  if (memStore) return memStore
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = store()?.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, v: unknown): void {
  try {
    store()?.setItem(key, JSON.stringify(v))
  } catch {
    /* storage full or blocked: diagnostics are best-effort */
  }
}

/** Oldest first. */
export function readCrumbs(): Crumb[] {
  const v = readJson<unknown>(CRUMBS_KEY, [])
  return Array.isArray(v) ? (v.filter((c) => c && typeof (c as Crumb).stage === 'string' && typeof (c as Crumb).at === 'number') as Crumb[]) : []
}

/** Appends one stage (synchronously persisted, so it survives a hang right after). */
export function crumb(stage: string, info?: string, now: number = Date.now()): void {
  const list = readCrumbs()
  const c: Crumb = { at: now, stage: stage.slice(0, 40) }
  if (info) c.info = String(info).slice(0, 160)
  list.push(c)
  writeJson(CRUMBS_KEY, list.length > MAX_CRUMBS ? list.slice(list.length - MAX_CRUMBS) : list)
}

/** Starts a run: `host` is what is starting (trial, drill, match, replay, scouting). */
export function beginRun(host: string, info?: string, now?: number): void {
  crumb(START_STAGE, info ? `${host} · ${info}` : host, now)
}

export function readHeartbeat(): Heartbeat | null {
  const h = readJson<Heartbeat | null>(HEARTBEAT_KEY, null)
  return h && typeof h.since === 'number' ? h : null
}

export function clearCrumbs(): void {
  try {
    store()?.removeItem(CRUMBS_KEY)
    store()?.removeItem(HEARTBEAT_KEY)
  } catch {
    /* ignore */
  }
}

export interface UnfinishedRun {
  /** The start crumb. */
  start: Crumb
  /** The last stage reached before the app stopped. */
  last: Crumb
  /** Every stage of the run, in order (start excluded). */
  stages: string[]
  heartbeat: Heartbeat | null
}

/** Stages written once the Phaser game is being constructed (the GPU path is involved). */
export const PHASER_STAGES: readonly string[] = ['phaser-build', 'phaser-built', 'scene-create', 'scene-textures', 'scene-pitch', 'scene-hud', 'scene-ready', 'first-frame', 'probe', 'render-fail']

/** The run got as far as constructing a Phaser game. */
export function reachedPhaser(r: UnfinishedRun): boolean {
  return r.stages.some((s) => PHASER_STAGES.indexOf(s) >= 0)
}

/**
 * The last run when it ended mid-start: a `start` with no end stage (render-ok, exit, fail-panel, cancel) and no app launch after it.
 * Pure over the crumb list (the heartbeat is only attached).
 */
export function unfinishedRun(crumbs: readonly Crumb[], hb: Heartbeat | null = null): UnfinishedRun | null {
  let i = crumbs.length - 1
  for (; i >= 0; i--) {
    const s = crumbs[i]!.stage
    if (s === START_STAGE) break
    if (s === BOOT_STAGE || END_STAGES.indexOf(s) >= 0) return null
  }
  if (i < 0) return null
  const start = crumbs[i]!
  const last = crumbs[crumbs.length - 1]!
  const stages = crumbs.slice(i + 1).map((c) => c.stage)
  return { start, last, stages, heartbeat: hb && hb.since >= start.at - 60_000 ? hb : null }
}

/**
 * Settings view: the last start when it never finished, even after later launches (the stage
 * reached is the last crumb before the next app launch). Null when it finished.
 */
export function lastIncompleteRun(crumbs: readonly Crumb[], hb: Heartbeat | null = null): UnfinishedRun | null {
  let i = crumbs.length - 1
  while (i >= 0 && crumbs[i]!.stage !== START_STAGE) i--
  if (i < 0) return null
  let last = crumbs[i]!
  const stages: string[] = []
  for (let k = i + 1; k < crumbs.length; k++) {
    const s = crumbs[k]!.stage
    if (END_STAGES.indexOf(s) >= 0) return null
    if (s === BOOT_STAGE) break
    last = crumbs[k]!
    stages.push(s)
  }
  const start = crumbs[i]!
  return { start, last, stages, heartbeat: hb && hb.since >= start.at - 60_000 ? hb : null }
}

/**
 * At launch: returns the previous unfinished run (once), then records this launch so the notice
 * is not shown again.
 */
export function checkLastRunAtBoot(now: number = Date.now()): UnfinishedRun | null {
  const r = unfinishedRun(readCrumbs(), readHeartbeat())
  crumb(BOOT_STAGE, undefined, now)
  return r
}

export type HeartbeatState = 'none' | 'hung' | 'frozen' | 'running'

/**
 * none: no heartbeat for this run; hung: frames and timers stopped together right after the last
 * stage (main thread blocked); frozen: timers ran on but frames stopped (GPU / compositor stall);
 * running: the page kept going after the last stage.
 */
export function heartbeatState(r: UnfinishedRun): HeartbeatState {
  const hb = r.heartbeat
  if (!hb) return 'none'
  if (hb.timer - hb.raf > 1500) return 'frozen'
  return Math.max(hb.raf, hb.timer) - r.last.at < 2000 ? 'hung' : 'running'
}

/** What the heartbeat says about a stopped run (TR/EN short text). */
export function heartbeatVerdict(r: UnfinishedRun, tr: boolean): string {
  const hb = r.heartbeat
  const state = heartbeatState(r)
  if (!hb) return tr ? 'kalp atışı yok' : 'no heartbeat'
  const lastAlive = Math.max(hb.raf, hb.timer)
  const afterLast = Math.round((lastAlive - r.last.at) / 100) / 10
  if (state === 'frozen') return tr ? `ekran donmuş: zamanlayıcı ${afterLast} sn daha çalıştı, kare çizimi durmuştu` : `screen frozen: timers ran ${afterLast} s on, frames had stopped`
  if (state === 'hung') return tr ? 'ana iş parçacığı kilitlendi (kare ve zamanlayıcı birlikte durdu)' : 'main thread hung (frames and timers stopped together)'
  return tr ? `sayfa ${afterLast} sn daha çalıştı (uygulama kapatılmış olabilir)` : `page kept running ${afterLast} s (app may have been closed)`
}

// ───────────────────────── Heartbeat ─────────────────────────

let hbStop: (() => void) | null = null

/**
 * Runs while a host starts: persists the last rAF and timer tick every ~500 ms for `ms`.
 * A new start replaces the previous heartbeat.
 */
export function startHeartbeat(ms = 15_000): () => void {
  stopHeartbeat()
  if (typeof window === 'undefined') return () => undefined
  const hb: Heartbeat = { since: Date.now(), raf: 0, rafN: 0, timer: 0, timerN: 0 }
  let lastWrite = 0
  let stopped = false
  const flush = (force = false) => {
    const now = Date.now()
    if (!force && now - lastWrite < 500) return
    lastWrite = now
    writeJson(HEARTBEAT_KEY, hb)
  }
  const onRaf = () => {
    if (stopped) return
    hb.raf = Date.now()
    hb.rafN++
    flush()
    rafId = requestAnimationFrame(onRaf)
  }
  let rafId = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(onRaf) : 0
  const timerId = setInterval(() => {
    hb.timer = Date.now()
    hb.timerN++
    flush()
  }, 250)
  const endId = setTimeout(() => stop(), ms)
  flush(true)
  const stop = () => {
    if (stopped) return
    stopped = true
    flush(true)
    clearInterval(timerId)
    clearTimeout(endId)
    if (rafId && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafId)
    if (hbStop === stop) hbStop = null
  }
  hbStop = stop
  return stop
}

export function stopHeartbeat(): void {
  if (hbStop) hbStop()
}

/** Tests only. */
export function _resetCrumbs(): void {
  stopHeartbeat()
  memStore = null
}
