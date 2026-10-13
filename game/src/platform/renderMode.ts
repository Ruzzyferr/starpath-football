/**
 * Compatibility mode. Some GPU drivers (seen: a Galaxy A52's Adreno 618 driver under a current
 * WebView) stall, reset or lose the GPU when a game screen starts: a black or flickering screen
 * whose buttons no longer respond. Low graphics alone does not help there, because Chrome
 * rasters Canvas 2D on the GPU as well.
 *
 * Two steps, both keyed on observed behaviour (never on a device or OS version):
 *  1. Compatibility mode: every Phaser host uses Canvas with a CPU-rastered 2D context
 *     (willReadFrequently) at the Low render scale, so the game itself never touches the driver;
 *     the page is still composited on the GPU (measured: 60 fps on an Android 14 emulator).
 *  2. Software layer (Android, last resort): the native shell (MainActivity + SpRenderPlugin)
 *     draws the whole WebView in software from the next start. Bypasses the driver completely,
 *     but is slow (measured: about 3-4 fps on the same emulator).
 *
 * The JS state lives in localStorage (read synchronously by the render guard); the native layer
 * setting in SharedPreferences (read by MainActivity before the WebView draws).
 */

export const SOFTWARE_KEY = 'sp.render.software'

export interface SoftwareModeState {
  on: boolean
  /** Android: the whole WebView is drawn in software (applies at the next start). */
  layer?: boolean
  /** Why it was switched on automatically (absent when the player chose it). */
  auto?: string
  at?: number
}

export interface NativeRenderInfo {
  /** Stored software-layer setting (applies at startup). */
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

/** Synchronous: Phaser hosts start on a CPU Canvas while this is on. */
export function softwareModeOn(): boolean {
  return softwareModeState().on
}

function writeState(s: SoftwareModeState): void {
  try {
    if (typeof localStorage === 'undefined') return
    if (s.on) localStorage.setItem(SOFTWARE_KEY, JSON.stringify(s))
    else localStorage.removeItem(SOFTWARE_KEY)
  } catch {
    /* storage blocked: the native setting below still applies */
  }
}

/**
 * Switches compatibility mode and, on Android, the software layer (`layer`; applies at the next
 * start, or at once with `applyNow`). Turning compatibility mode off turns the layer off too; an
 * omitted `layer` keeps the current one. Never throws; resolves with the native info if any.
 */
export async function setSoftwareMode(on: boolean, opts: { applyNow?: boolean; auto?: string; layer?: boolean } = {}): Promise<NativeRenderInfo | null> {
  const prev = softwareModeState()
  const layer = on && (opts.layer !== undefined ? opts.layer : prev.layer === true)
  const auto = opts.auto ?? (prev.on ? prev.auto : undefined)
  writeState(on ? { on: true, at: Date.now(), ...(layer ? { layer: true } : {}), ...(auto ? { auto } : {}) } : { on: false })
  const p = nativePlugin()
  if (!p) return null
  try {
    return await p.set({ software: layer, applyNow: opts.applyNow === true })
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
 * Boot: the native layer setting wins when they disagree (e.g. the JS copy was wiped with site
 * data), so the JS state matches what MainActivity applied.
 */
export async function syncSoftwareModeFromNative(): Promise<NativeRenderInfo | null> {
  const n = await nativeRenderInfo()
  if (!n) return null
  const s = softwareModeState()
  if (n.software && !(s.on && s.layer)) writeState({ ...s, on: true, layer: true, at: s.at ?? Date.now() })
  else if (!n.software && s.layer) writeState({ ...s, layer: false })
  return n
}

/** Tests only. */
export function _resetRenderMode(p?: SpRenderPlugin | null): void {
  plugin = p
}
