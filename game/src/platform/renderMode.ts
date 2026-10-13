/**
 * Compatibility mode (software drawing). Some Android GPU drivers (an old Adreno driver shipped
 * with an OS that no longer updates, under a current WebView) stall the GPU when a game screen
 * starts: a frozen black screen whose DOM buttons no longer respond. Low graphics does not help
 * there, because Canvas 2D is GPU-rastered as well.
 *
 * Compatibility mode bypasses the driver: on Android the native shell (MainActivity +
 * SpRenderPlugin) switches the WebView to a software layer at startup, and every Phaser host
 * uses the Canvas renderer. Elsewhere it only forces Canvas.
 *
 * The JS copy lives in localStorage (read synchronously by the render guard); the native copy in
 * SharedPreferences (read by MainActivity before the WebView draws).
 */

export const SOFTWARE_KEY = 'sp.render.software'

export interface SoftwareModeState {
  on: boolean
  /** Why it was switched on automatically (absent when the player chose it). */
  auto?: string
  at?: number
}

export interface NativeRenderInfo {
  /** Stored setting (applies at startup). */
  software: boolean
  /** The WebView's current layer is software. */
  active: boolean
  /** Times the WebView renderer was reported unresponsive (Android 10+). */
  unresponsive: number
  android: string
  sdk: number
  model: string
}

interface SpRenderPlugin {
  get(): Promise<NativeRenderInfo>
  set(o: { software: boolean; applyNow?: boolean }): Promise<NativeRenderInfo>
}

interface CapGlobal {
  isNativePlatform?: () => boolean
  getPlatform?: () => string
  registerPlugin?: <T>(name: string) => T
}

let plugin: SpRenderPlugin | null | undefined

function nativePlugin(): SpRenderPlugin | null {
  if (plugin !== undefined) return plugin
  plugin = null
  try {
    const cap = (globalThis as { Capacitor?: CapGlobal }).Capacitor
    if (cap?.isNativePlatform?.() && cap.getPlatform?.() === 'android' && typeof cap.registerPlugin === 'function') plugin = cap.registerPlugin<SpRenderPlugin>('SpRender')
  } catch {
    plugin = null
  }
  return plugin
}

export function softwareModeState(): SoftwareModeState {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SOFTWARE_KEY) : null
    if (!raw) return { on: false }
    const v = JSON.parse(raw) as SoftwareModeState
    return v && v.on === true ? v : { on: false }
  } catch {
    return { on: false }
  }
}

/** Synchronous: Phaser hosts start on Canvas while this is on. */
export function softwareModeOn(): boolean {
  return softwareModeState().on
}

/**
 * Switches compatibility mode. On Android the native setting is written too (it applies at the
 * next start, or at once with `applyNow`). Never throws; resolves with the native info if any.
 */
export async function setSoftwareMode(on: boolean, opts: { applyNow?: boolean; auto?: string } = {}): Promise<NativeRenderInfo | null> {
  try {
    if (typeof localStorage !== 'undefined') {
      if (on) localStorage.setItem(SOFTWARE_KEY, JSON.stringify({ on: true, at: Date.now(), ...(opts.auto ? { auto: opts.auto } : {}) }))
      else localStorage.removeItem(SOFTWARE_KEY)
    }
  } catch {
    /* storage blocked: native setting below still applies */
  }
  const p = nativePlugin()
  if (!p) return null
  try {
    return await p.set({ software: on, applyNow: opts.applyNow === true })
  } catch {
    return null
  }
}

/** Native facts (Android shell only), or null. */
export async function nativeRenderInfo(): Promise<NativeRenderInfo | null> {
  const p = nativePlugin()
  if (!p) return null
  try {
    return await p.get()
  } catch {
    return null
  }
}

/**
 * Boot: the native setting wins when they disagree (e.g. the JS copy was wiped with site data),
 * so the renderer choice matches what MainActivity applied.
 */
export async function syncSoftwareModeFromNative(): Promise<NativeRenderInfo | null> {
  const n = await nativeRenderInfo()
  if (n && n.software !== softwareModeOn()) {
    try {
      if (n.software) localStorage.setItem(SOFTWARE_KEY, JSON.stringify({ on: true, at: Date.now() }))
      else localStorage.removeItem(SOFTWARE_KEY)
    } catch {
      /* ignore */
    }
  }
  return n
}

/** Tests only. */
export function _resetRenderMode(p?: SpRenderPlugin | null): void {
  plugin = p
}
