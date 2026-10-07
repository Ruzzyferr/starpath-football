/**
 * Build flavor.
 *   premium  fully unlocked, never shows a paywall (Steam / desktop / web)
 *   trial    first full season free, then a one-time "Full Career" unlock (mobile stores)
 * `SP_FLAVOR=trial|premium|auto vite build` sets the build flag; `auto` (default)
 * picks trial on Android/iOS native shells and premium everywhere else.
 *   demo     `SP_FLAVOR=demo`: premium (nothing to buy) + kiosk/event showcase (see demo.ts)
 * In dev builds `?flavor=trial|premium` overrides it (used by the e2e suite).
 */
import { detectPlatform, isMobileNative, type PlatformId } from '../platform/detect'

declare const __SP_FLAVOR__: string

export type Flavor = 'trial' | 'premium'
export type FlavorFlag = Flavor | 'auto' | 'demo'

export function resolveFlavor(flag: FlavorFlag, platform: PlatformId, override?: string | null): Flavor {
  if (override === 'trial' || override === 'premium') return override
  if (flag === 'trial' || flag === 'premium') return flag
  if (flag === 'demo') return 'premium'
  return isMobileNative(platform) ? 'trial' : 'premium'
}

/** Build-flag / dev-override lookup shared by getFlavor and isDemo. */
export function isDemoFlag(flag: string, override?: string | null): boolean {
  return override === 'demo' || (override !== 'trial' && override !== 'premium' && flag === 'demo')
}

function readOverride(): string | null {
  if (!import.meta.env?.DEV) return null
  try {
    return new URLSearchParams(globalThis.location?.search ?? '').get('flavor')
  } catch {
    return null /* no location (tests) */
  }
}

/** Showcase build for events / kiosks: fixed-seed career, idle + session auto-reset. */
export function isDemo(): boolean {
  return isDemoFlag(typeof __SP_FLAVOR__ === 'string' ? __SP_FLAVOR__ : 'auto', readOverride())
}

let cached: Flavor | null = null

export function getFlavor(): Flavor {
  if (cached) return cached
  const flag = (typeof __SP_FLAVOR__ === 'string' ? __SP_FLAVOR__ : 'auto') as FlavorFlag
  cached = resolveFlavor(flag, detectPlatform(), readOverride())
  return cached
}

/** Tests only. */
export function _resetFlavor(): void {
  cached = null
}
