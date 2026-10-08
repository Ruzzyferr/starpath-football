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

type AudioSessionType = 'auto' | 'playback' | 'transient' | 'transient-solo' | 'ambient' | 'play-and-record'

/**
 * iOS/WebKit audio session (2.8#2, #3, #70): 'ambient' makes game audio obey the hardware silent
 * switch and mix with the user's own music, which is what players expect from a football sim.
 * No-op where `navigator.audioSession` does not exist. Returns whether it was applied.
 */
export function applyAudioSession(type: AudioSessionType = 'ambient', nav: unknown = typeof navigator === 'undefined' ? undefined : navigator): boolean {
  const session = (nav as { audioSession?: { type: string } } | undefined)?.audioSession
  if (!session) return false
  try {
    session.type = type
    return true
  } catch {
    return false
  }
}

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
        applyAudioSession()
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

/** Time given to the audio engine to fade out before contexts are suspended (2.8#4). */
export const SUSPEND_FADE_MS = 140
let suspendTimer: ReturnType<typeof setTimeout> | null = null

export function setBackgrounded(hidden: boolean): void {
  if (hidden === backgrounded) return
  backgrounded = hidden
  if (suspendTimer) {
    clearTimeout(suspendTimer)
    suspendTimer = null
  }
  // Event first so the engine can ramp its master gain down; suspension follows after the fade.
  window.dispatchEvent(new Event(hidden ? 'sp:app-pause' : 'sp:app-resume'))
  const apply = () => {
    suspendTimer = null
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
  }
  if (hidden) suspendTimer = setTimeout(apply, SUSPEND_FADE_MS)
  else apply()
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
