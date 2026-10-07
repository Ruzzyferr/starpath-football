/**
 * Build flavor.
 *   premium  fully unlocked, never shows a paywall (Steam / desktop / web)
 *   trial    first full season free, then a one-time "Full Career" unlock (mobile stores)
 * `SP_FLAVOR=trial|premium|auto vite build` sets the build flag; `auto` (default)
 * picks trial on Android/iOS native shells and premium everywhere else.
 * In dev builds `?flavor=trial|premium` overrides it (used by the e2e suite).
 */
import { detectPlatform, isMobileNative, type PlatformId } from '../platform/detect'

declare const __SP_FLAVOR__: string

export type Flavor = 'trial' | 'premium'
export type FlavorFlag = Flavor | 'auto'

export function resolveFlavor(flag: FlavorFlag, platform: PlatformId, override?: string | null): Flavor {
  if (override === 'trial' || override === 'premium') return override
  if (flag === 'trial' || flag === 'premium') return flag
  return isMobileNative(platform) ? 'trial' : 'premium'
}

let cached: Flavor | null = null

export function getFlavor(): Flavor {
  if (cached) return cached
  const flag = (typeof __SP_FLAVOR__ === 'string' ? __SP_FLAVOR__ : 'auto') as FlavorFlag
  let override: string | null = null
  if (import.meta.env?.DEV) {
    try {
      override = new URLSearchParams(globalThis.location?.search ?? '').get('flavor')
    } catch {
      /* no location (tests) */
    }
  }
  cached = resolveFlavor(flag, detectPlatform(), override)
  return cached
}

/** Tests only. */
export function _resetFlavor(): void {
  cached = null
}
