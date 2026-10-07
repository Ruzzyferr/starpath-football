/**
 * Runtime platform detection. Pure (no plugin imports) so it is safe on every target.
 *
 *   web          browser / installed PWA
 *   electron     desktop shell (Steam, Windows/macOS/Linux) — electron/preload.cjs bridge
 *   android/ios  Capacitor native shell
 */
export type PlatformId = 'web' | 'electron' | 'android' | 'ios'

interface CapacitorGlobal {
  isNativePlatform?: () => boolean
  getPlatform?: () => string
}

export function detectPlatform(): PlatformId {
  const g = globalThis as { starpathNative?: unknown; Capacitor?: CapacitorGlobal }
  if (g.starpathNative && typeof g.starpathNative === 'object') return 'electron'
  const cap = g.Capacitor
  if (cap?.isNativePlatform?.()) {
    const p = cap.getPlatform?.()
    if (p === 'android' || p === 'ios') return p
  }
  return 'web'
}

export const isMobileNative = (p: PlatformId): p is 'android' | 'ios' => p === 'android' || p === 'ios'
