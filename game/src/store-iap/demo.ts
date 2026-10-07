/**
 * Demo flavor (`SP_FLAVOR=demo vite build`): a showcase build for events and kiosks.
 * Fully unlocked, nothing to buy, every visitor starts the same fixed-seed career,
 * and the machine resets itself when nobody touches it (idle) or a session runs too long.
 * Pure decision logic is split from the DOM wiring so it is unit-testable.
 */
export const DEMO_SEED = 20261007
/** No input for this long: wipe and restart (unattended kiosk). */
export const DEMO_IDLE_MS = 90_000
/** Hard cap per visitor even with constant input. */
export const DEMO_SESSION_MS = 15 * 60_000

export function demoResetDue(now: number, lastInput: number, sessionStart: number): 'idle' | 'session' | null {
  if (now - sessionStart >= DEMO_SESSION_MS) return 'session'
  if (now - lastInput >= DEMO_IDLE_MS) return 'idle'
  return null
}

/**
 * Starts the watchdog. `reset` must wipe saves and begin the fixed-seed career
 * (the caller owns that: it needs the actions layer). Returns a stop function.
 */
export function installDemoMode(reset: (why: 'idle' | 'session') => void | Promise<void>): () => void {
  if (typeof document === 'undefined') return () => {}
  let last = Date.now()
  let start = last
  const touch = () => {
    last = Date.now()
  }
  const events = ['pointerdown', 'keydown', 'touchstart', 'gamepadconnected'] as const
  for (const e of events) globalThis.addEventListener(e, touch, { passive: true })
  const timer = setInterval(() => {
    const now = Date.now()
    const why = demoResetDue(now, last, start)
    if (!why) return
    last = start = now
    void Promise.resolve(reset(why)).catch((e: unknown) => console.warn('[StarPath] demo reset failed', e))
  }, 1000)
  return () => {
    clearInterval(timer)
    for (const e of events) globalThis.removeEventListener(e, touch)
  }
}
