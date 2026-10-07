/**
 * App foreground/background handling shared by every platform:
 *  - every AudioContext created after initPlatform() is tracked and suspended
 *    while the app is hidden / backgrounded, then resumed (only the ones we
 *    suspended) when it comes back;
 *  - `sp:app-pause` / `sp:app-resume` window events for anything else.
 */
const contexts = new Set<AudioContext>()
const suspendedByUs = new WeakSet<AudioContext>()
let installed = false
let backgrounded = false

/** Wrap window.AudioContext so instances are tracked (Phaser's sound manager and src/game/audio.ts included). */
export function trackAudioContexts(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  const w = window as unknown as Record<string, unknown>
  for (const name of ['AudioContext', 'webkitAudioContext']) {
    const Native = w[name] as (new (...a: any[]) => AudioContext) | undefined
    if (typeof Native !== 'function') continue
    const Tracked = class extends Native {
      constructor(...args: any[]) {
        super(...args)
        contexts.add(this)
        // A context created while hidden starts suspended too.
        if (backgrounded) void suspendOne(this)
      }
    }
    Object.defineProperty(Tracked, 'name', { value: name })
    try {
      w[name] = Tracked
    } catch {
      /* read-only global */
    }
  }
}

async function suspendOne(c: AudioContext): Promise<void> {
  if (c.state !== 'running') return
  try {
    await c.suspend()
    suspendedByUs.add(c)
  } catch {
    /* closed */
  }
}

export function setBackgrounded(hidden: boolean): void {
  if (hidden === backgrounded) return
  backgrounded = hidden
  for (const c of contexts) {
    if (c.state === 'closed') {
      contexts.delete(c)
      continue
    }
    if (hidden) void suspendOne(c)
    else if (suspendedByUs.has(c)) {
      suspendedByUs.delete(c)
      void c.resume().catch(() => undefined)
    }
  }
  window.dispatchEvent(new Event(hidden ? 'sp:app-pause' : 'sp:app-resume'))
}

export function isBackgrounded(): boolean {
  return backgrounded
}

/** Browser + Electron: page visibility. Capacitor additionally feeds App pause/resume in. */
export function watchVisibility(): void {
  if (typeof document === 'undefined') return
  const sync = () => setBackgrounded(document.visibilityState === 'hidden')
  document.addEventListener('visibilitychange', sync)
  sync()
}
