/**
 * Render guard logic (no Phaser, no DOM): which renderer a Phaser host starts with, the
 * persisted "WebGL is broken on this device" flag, the start sentinel that catches a WebGL
 * start which hung or killed the app, the first-frame watchdog and the blank-frame check.
 *
 * The Phaser glue lives in phaserGuard.ts; this file stays pure so it is unit-tested.
 */

export type RendererChoice = 'webgl' | 'canvas'

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** Persisted after any WebGL failure: later Phaser starts go straight to Canvas. */
export const WEBGL_BROKEN_KEY = 'sp.render.webglBroken'
/** Set while a Phaser host is starting, cleared at its first good frame (or a clean stop). */
export const START_SENTINEL_KEY = 'sp.render.starting'
/** No frame within this long after the game is created counts as a failed start. */
export const FIRST_FRAME_MS = 3000

let memStore: Store | null = null

/** Tests: swap the backing store (null = localStorage). */
export function setRenderGuardStore(s: Store | null): void {
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

function get(key: string): string | null {
  try {
    return store()?.getItem(key) ?? null
  } catch {
    return null
  }
}

function set(key: string, v: string | null): void {
  try {
    if (v === null) store()?.removeItem(key)
    else store()?.setItem(key, v)
  } catch {
    /* storage unavailable: the guard still works for this session */
  }
}

let sessionBroken: string | null = null

export function webglBrokenReason(): string | null {
  return sessionBroken ?? get(WEBGL_BROKEN_KEY)
}

export function isWebglBroken(): boolean {
  return webglBrokenReason() !== null
}

export function markWebglBroken(reason: string): void {
  sessionBroken = reason.slice(0, 200) || 'webgl'
  set(WEBGL_BROKEN_KEY, sessionBroken)
}

/** Settings › Graphics › re-detect clears it, so a fixed driver / WebView update gets WebGL back. */
export function clearWebglBroken(): void {
  sessionBroken = null
  set(WEBGL_BROKEN_KEY, null)
}

/**
 * The renderer a Phaser host starts with: Canvas when the player chose Low graphics, when
 * WebGL already failed on this device, or when the caller forces it (the watchdog's retry).
 */
export function pickRenderer(o: { lowGraphics?: boolean; force?: RendererChoice }): RendererChoice {
  if (o.force) return o.force
  if (o.lowGraphics) return 'canvas'
  return isWebglBroken() ? 'canvas' : 'webgl'
}

// ───────────────────────── Start sentinel ─────────────────────────

/** Records that a host is starting with `r`. */
export function beginStart(r: RendererChoice, host: string, now: number = Date.now()): void {
  set(START_SENTINEL_KEY, JSON.stringify({ r, host, at: now }))
}

/** The host rendered (or was stopped cleanly): the start did not hang. */
export function endStart(): void {
  set(START_SENTINEL_KEY, null)
}

/**
 * At boot: a sentinel left behind means the last WebGL start never reached a frame (the app hung
 * or was killed on the GPU path). WebGL is then marked broken. Returns the host that hung, or null.
 */
export function recoverStaleStart(): string | null {
  const raw = get(START_SENTINEL_KEY)
  if (!raw) return null
  set(START_SENTINEL_KEY, null)
  try {
    const s = JSON.parse(raw) as { r?: string; host?: string }
    if (s.r !== 'webgl') return null
    markWebglBroken(`previous WebGL start did not finish (${s.host ?? '?'})`)
    return s.host ?? '?'
  } catch {
    return null
  }
}

// ───────────────────────── Watchdog ─────────────────────────

export interface Timers {
  setTimeout(fn: () => void, ms: number): unknown
  clearTimeout(id: unknown): void
}

const realTimers: Timers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
}

export interface Watchdog {
  /** A frame was presented (and looked right): the start succeeded. */
  ok(): void
  /** Fail now (scene threw, context lost, blank frame). Ignored once settled. */
  fail(reason: string): void
  /** Stop without a verdict (the player left). */
  dispose(): void
  readonly settled: boolean
}

/**
 * One start attempt: settles exactly once, either `ok()` or failure (explicit, or no `ok()`
 * within `timeoutMs`). A failure after success still counts (a scene can throw later), so
 * `fail` keeps working after `ok`; only the first failure is reported.
 */
export function createWatchdog(onFail: (reason: string) => void, timeoutMs: number = FIRST_FRAME_MS, timers: Timers = realTimers): Watchdog {
  let done = false
  let failed = false
  let timer: unknown = timers.setTimeout(() => {
    timer = null
    if (!done && !failed) fire(`no frame within ${Math.round(timeoutMs / 100) / 10} s`)
  }, timeoutMs)
  const clear = () => {
    if (timer !== null) timers.clearTimeout(timer)
    timer = null
  }
  function fire(reason: string): void {
    if (failed) return
    failed = true
    done = true
    clear()
    onFail(reason)
  }
  return {
    ok() {
      if (done) return
      done = true
      clear()
    },
    fail: (reason) => fire(reason),
    dispose() {
      done = true
      failed = true
      clear()
    },
    get settled() {
      return done
    },
  }
}

// ───────────────────────── Blank frame check ─────────────────────────

/**
 * True when every sampled pixel is fully transparent / pure black, or exactly the clear colour:
 * the renderer presented frames but drew nothing (a broken shader path shows exactly this).
 * `samples` are RGBA quadruples.
 */
export function isBlankFrame(samples: ArrayLike<number>, clear: readonly [number, number, number]): boolean {
  if (samples.length < 4) return false
  for (let i = 0; i + 3 < samples.length; i += 4) {
    const r = samples[i]!, g = samples[i + 1]!, b = samples[i + 2]!, a = samples[i + 3]!
    const empty = a === 0 || (r === 0 && g === 0 && b === 0)
    const cleared = Math.abs(r - clear[0]) <= 2 && Math.abs(g - clear[1]) <= 2 && Math.abs(b - clear[2]) <= 2
    if (!empty && !cleared) return false
  }
  return true
}

/** Tests only. */
export function _resetRenderGuard(): void {
  sessionBroken = null
  memStore = null
}
