/**
 * Haptic feedback hook point. Default uses navigator.vibrate; the lead can
 * swap in Capacitor Haptics via setHapticDriver().
 */
import { settings } from './store'

export type HapticKind = 'tap' | 'select' | 'success' | 'warning' | 'error' | 'goal' | 'heavy'

const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 8,
  select: 12,
  success: [12, 40, 18],
  warning: [20, 60, 20],
  error: [40, 50, 40],
  goal: [30, 40, 30, 40, 80],
  heavy: 35,
}

type Driver = (kind: HapticKind) => void
let driver: Driver = (kind) => {
  try {
    // Browsers log an error for vibrate() before the first user gesture: skip until then.
    const nav = globalThis.navigator as (Navigator & { userActivation?: { hasBeenActive: boolean } }) | undefined
    if (nav?.userActivation && !nav.userActivation.hasBeenActive) return
    nav?.vibrate?.(PATTERNS[kind])
  } catch {
    /* unsupported */
  }
}

export function setHapticDriver(d: Driver): void {
  driver = d
}

export function haptic(kind: HapticKind = 'tap'): void {
  if (!settings.value.vibration) return
  driver(kind)
}
