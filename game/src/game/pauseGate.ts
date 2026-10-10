/**
 * The single "may the playable moment run?" source (TestFlight build 5 bug: a match moment kept
 * playing behind the control-hint card and ended before the player had read it).
 *
 * Anything that covers a moment holds the gate under a reason — a control / tutorial hint
 * (`hint:match`, `hint:drill`), the app going to the background or a system sheet (`app`), the
 * player's own pause key (`user`). While any hold is on, the Phaser scenes (match highlight,
 * training drill, scouting video) stop their whole loop: physics, AI, bullet time, the moment's
 * time limit, the drill countdown, event-driven sound cues. When the last hold is released while a
 * scene is attached, a short 3-2-1 beat runs (scene time) before play resumes.
 *
 * The scene drives the gate with `tick(dt)` once per frame and only advances its simulation when
 * that returns true. Pure state, no Phaser: unit-tested in pauseGate.test.ts.
 */

/** Length of one countdown beat ("3", "2", "1") in seconds. */
export const BEAT_S = 0.5
/** Full resume countdown: three beats. */
export const COUNTDOWN_S = BEAT_S * 3

/** Hold reasons owned by the scene session (cleared when a scene attaches / detaches). */
const SCENE_OWNED = new Set(['user'])

export class PauseGate {
  private holds = new Set<string>()
  private cd = 0
  private attached = false
  private session = 0
  private subs = new Set<() => void>()

  /** Freeze play under `reason` (idempotent per reason). Cancels a running countdown. */
  hold(reason: string): void {
    if (this.holds.has(reason)) return
    this.holds.add(reason)
    this.cd = 0
    this.notify()
  }

  /** Lift `reason`; when it was the last hold and a scene is live, the resume countdown starts. */
  release(reason: string): void {
    if (!this.holds.delete(reason)) return
    if (this.holds.size === 0 && this.attached) this.cd = COUNTDOWN_S
    this.notify()
  }

  /** Toggle a hold (the in-scene pause key). Returns whether it is now held. */
  toggle(reason: string): boolean {
    if (this.holds.has(reason)) this.release(reason)
    else this.hold(reason)
    return this.holds.has(reason)
  }

  has(reason: string): boolean {
    return this.holds.has(reason)
  }

  /** Any hold on (a hint / background / pause is covering play). */
  held(): boolean {
    return this.holds.size > 0
  }

  /** Play may advance this frame: nothing holds it and the resume countdown is over. */
  running(): boolean {
    return this.holds.size === 0 && this.cd <= 0
  }

  /** Seconds left on the resume countdown (0 when none). */
  countdown(): number {
    return this.cd
  }

  /** The countdown beat to show ("3" / "2" / "1"), or null when none runs. */
  beat(): string | null {
    if (this.holds.size > 0 || this.cd <= 0) return null
    return String(Math.min(3, Math.ceil(this.cd / BEAT_S - 1e-9)))
  }

  /**
   * Advance the gate by one scene frame. Returns true when the scene may step its simulation
   * with this `dt`. The countdown only runs in scene time, never while held.
   */
  tick(dt: number): boolean {
    if (this.holds.size > 0) return false
    if (this.cd > 0) {
      this.cd = Math.max(0, this.cd - Math.max(0, dt))
      if (this.cd === 0) this.notify()
      return false
    }
    return true
  }

  /**
   * A scene started playing: fresh session (no stale countdown / pause key). Hints held before it
   * stay. Returns the session token for `detach`.
   */
  attach(): number {
    this.attached = true
    this.cd = 0
    for (const r of SCENE_OWNED) this.holds.delete(r)
    this.notify()
    return ++this.session
  }

  /** The scene ended (a stale token from an older scene is ignored). */
  detach(token?: number): void {
    if (token !== undefined && token !== this.session) return
    this.attached = false
    this.cd = 0
    for (const r of SCENE_OWNED) this.holds.delete(r)
    this.notify()
  }

  isAttached(): boolean {
    return this.attached
  }

  /** Subscribe to hold / attach / countdown-end changes. Returns the unsubscribe. */
  subscribe(fn: () => void): () => void {
    this.subs.add(fn)
    return () => {
      this.subs.delete(fn)
    }
  }

  /** Tests: back to a clean gate. */
  reset(): void {
    this.holds.clear()
    this.cd = 0
    this.attached = false
    this.notify()
  }

  private notify(): void {
    for (const fn of [...this.subs]) {
      try {
        fn()
      } catch {
        /* a listener must not break the gate */
      }
    }
  }
}

/** The app-wide gate. */
export const pauseGate = new PauseGate()
// Dev/e2e: inspect the gate from tests. Stripped from production builds.
if (import.meta.env.DEV && typeof globalThis !== 'undefined') (globalThis as { __spPauseGate?: PauseGate }).__spPauseGate = pauseGate

let appWired = false
/**
 * Background / system sheet (platform/lifecycle `sp:app-pause` / `sp:app-resume`, which Capacitor's
 * App pause / resume / appStateChange and the page's visibilitychange feed) holds the gate.
 */
export function wireAppPause(gate: PauseGate = pauseGate, target: Pick<Window, 'addEventListener'> | undefined = typeof window === 'undefined' ? undefined : window): void {
  if (!target || (gate === pauseGate && appWired)) return
  if (gate === pauseGate) appWired = true
  target.addEventListener('sp:app-pause', () => gate.hold('app'))
  target.addEventListener('sp:app-resume', () => gate.release('app'))
}

// Wired as soon as anything imports the gate (match screen, scenes), so a background is never missed.
wireAppPause()
