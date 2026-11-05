/**
 * Platform layer: one entry point, `initPlatform()`, called by main.tsx before
 * the first render. It
 *  - detects web / electron / android / ios and tags <html> (platform-<id>),
 *  - picks the SaveStorage (Electron: userData/saves files over IPC; Capacitor:
 *    Filesystem files; web: IndexedDB default) and migrates IndexedDB saves once,
 *  - installs viewport chrome (safe areas, keyboard, zoom guards: viewport.ts),
 *  - installs native haptics, status bar, keyboard, Android back button, keep-awake
 *    during matches, and audio pause while the app is in the background,
 *  - registers the offline service worker on the web production build.
 *
 * Everything else talks to `platform` (achievements, keepAwake, exit).
 */
import { effect } from '@preact/signals'
import { IdbStorage, type SaveStorage } from '../state/save'
import { checkSaveIntegrity, refreshSlots, useStorage } from '../ui/backend/persistence'
import { screen } from '../ui/store'
import { detectPlatform, isMobileNative, type PlatformId } from './detect'
import { knownSaveKeys } from './keys'
import { trackAudioContexts, watchVisibility } from './lifecycle'
import { ElectronFileStorage, FallbackStorage, migrateMissing } from './storage'
import { handleBack } from './back'
import { installGlRecovery } from './glRecovery'
import { flushAutosave } from '../ui/backend/persistence'
import { recordError } from '../telemetry/errorLog'
import { registerServiceWorker, unregisterServiceWorkers } from './sw-register'
import { createWebWakeLock } from './wakeLock'
import { installViewport, setKeyboard, markNativeKeyboard } from './viewport'
import './platform.css'

export type { PlatformId } from './detect'

type CapModule = typeof import('./capacitor')

let id: PlatformId = 'web'
let cap: CapModule | null = null
const webWake = createWebWakeLock()

/** Screens during which the display must not sleep. */
const AWAKE_SCREENS = new Set(['liveMatch', 'training'])

export const platform = {
  get id(): PlatformId {
    return id
  },
  get isNative(): boolean {
    return id !== 'web'
  },
  achievements: {
    /**
     * Unlock an achievement: Game Center on iOS (id "kb.<id>", set up in App Store Connect), Steam
     * on a Steam desktop build (API name = id). No-op (false) anywhere else.
     */
    async unlock(achievementId: string): Promise<boolean> {
      if (id === 'ios' && cap) return cap.GameCenter.unlock({ id: `kb.${achievementId}` }).then((r) => r.ok).catch(() => false)
      if (id !== 'electron' || !window.starpathNative) return false
      try {
        return await window.starpathNative.steam.unlock(achievementId)
      } catch {
        return false
      }
    },
    async available(): Promise<boolean> {
      if (id === 'ios' && cap) return true
      if (id !== 'electron' || !window.starpathNative) return false
      return window.starpathNative.steam.available().catch(() => false)
    },
  },
  gameCenter: {
    /** Best career goal total on the Game Center leaderboard (iOS; no-op elsewhere). */
    submitCareerGoals(goals: number): void {
      if (id === 'ios' && cap && goals > 0) void cap.GameCenter.submitScore({ leaderboard: 'kb.career_goals', score: Math.floor(goals) }).catch(() => undefined)
    },
    /** Opens the Game Center dashboard (achievements, leaderboards). False when unavailable. */
    async showDashboard(): Promise<boolean> {
      if (id !== 'ios' || !cap) return false
      return cap.GameCenter.showDashboard().then((r) => r.ok).catch(() => false)
    },
  },
  /** Keep the screen on (matches). Native plugin on mobile, Wake Lock API on web/desktop. */
  async keepAwake(on: boolean): Promise<void> {
    if (cap) await cap.keepAwake(on)
    else await webWake.set(on)
  },
  /** Quit the app (desktop / Android). On the web there is nothing to quit. */
  exit(): void {
    if (cap) cap.exitApp()
    else window.starpathNative?.quit()
  },
}

async function pickStorage(): Promise<SaveStorage | null> {
  if (id === 'electron' && window.starpathNative) return new ElectronFileStorage(window.starpathNative)
  if (cap) {
    // Native files, with IndexedDB as a safety net if a native write ever fails (TestFlight build 4).
    const fb = new FallbackStorage(new cap.CapacitorFileStorage({ absolute: id === 'ios' }), new IdbStorage())
    fb.onFallback = (key, e) => recordError(`native save write failed (${key}): ${String((e as Error)?.message ?? e)}`, 'save')
    return fb
  }
  return null // web: SaveManager's default (IndexedDB → compressed localStorage)
}

const MIGRATED = 'sp.migrated.idb'

async function migrateFromIdb(target: SaveStorage): Promise<void> {
  if ((await target.get(MIGRATED).catch(() => null)) !== null) return
  if (typeof indexedDB === 'undefined') return
  const n = await migrateMissing(new IdbStorage(), target, knownSaveKeys())
  await target.set(MIGRATED, String(Date.now())).catch(() => undefined)
  if (n) console.info(`[StarPath] migrated ${n} save entries from IndexedDB`)
}

let started = false

/** The Electron shell reloads a crashed renderer with ?recovered=<reason>; count it in the opt-in log (2.9#69, 2.12#119). */
function noteRecovery(): void {
  try {
    const u = new URL(location.href)
    const reason = u.searchParams.get('recovered')
    if (!reason) return
    recordError(`Renderer recovered after ${reason.slice(0, 40)}`, 'recovered')
    u.searchParams.delete('recovered')
    history.replaceState(null, '', u.pathname + u.search + u.hash)
  } catch { /* ignore */ }
}

export async function initPlatform(): Promise<PlatformId> {
  if (started) return id
  started = true
  id = detectPlatform()
  document.documentElement.classList.add(`platform-${id}`)
  if (id !== 'web') document.documentElement.classList.add('platform-native')

  installViewport(isMobileNative(id))
  trackAudioContexts()
  watchVisibility()
  installGlRecovery()
  noteRecovery()
  // Desktop: the shell asks us to flush the autosave before the window closes (2.9#45).
  if (id === 'electron') window.starpathNative?.onBeforeQuit(() => flushAutosave(true))

  if (isMobileNative(id)) {
    try {
      cap = await import('./capacitor')
      cap.installHaptics()
      cap.installReview()
      // Game Center sign-in (iOS): Apple shows its own banner or sheet; declining is fine.
      if (id === 'ios') {
        const gc = cap.GameCenter
        void gc.signIn().then(async ({ signedIn }) => {
          if (!signedIn) return
          // Unlocks earned while signed out are sent now (Game Center ignores repeats).
          const { metaData } = await import('../ui/backend/meta')
          for (const a of Object.keys(metaData.peek().achievements.unlocked)) void gc.unlock({ id: `kb.${a}` }).catch(() => undefined)
        }).catch(() => undefined)
      }
      cap.setupLifecycle(() => handleBack(() => platform.exit()))
      void cap.setupChrome()
      if (await cap.setupKeyboard((open) => setKeyboard(open))) markNativeKeyboard()
    } catch (e) {
      console.warn('[StarPath] Capacitor plugins unavailable', e)
    }
  }

  try {
    const st = await pickStorage()
    if (st) {
      await migrateFromIdb(st)
      useStorage(st)
      // The backend listed the slots before the native storage was chosen: list them again from the
      // real storage, otherwise "Continue" / Load show nothing after a relaunch on iOS/Android.
      void refreshSlots().then(() => checkSaveIntegrity())
    }
  } catch (e) {
    console.warn('[StarPath] native save storage unavailable, using browser storage', e)
  }

  effect(() => {
    void platform.keepAwake(AWAKE_SCREENS.has(screen.value.id))
  })

  if (id === 'web') registerServiceWorker()
  else if (isMobileNative(id)) void unregisterServiceWorkers()
  return id
}
