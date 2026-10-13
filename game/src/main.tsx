// First: polyfills for older Android System WebViews (module bodies run in import order).
import './platform/polyfills'
import { render } from 'preact'
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/layout.css'
import './styles/theme-light.css'
import { App } from './ui/App'
import { bindSettingsToDocument } from './ui/store'
import { installRealBackend } from './ui/backend'
import { initPlatform } from './platform'
import { installAudioDirector } from './audio/director'
import { installErrorLog } from './telemetry/errorLog'
import { installErrorRing, pushError } from './telemetry/errorRing'
import { recoverStaleStart } from './game/renderGuard'
import { handleLastRunAtBoot } from './telemetry/lastRunNotice'
import { setSoftwareMode, softwareModeState, syncSoftwareModeFromNative } from './platform/renderMode'
import { detectPlatform } from './platform/detect'
import { actions, navigate, screen } from './ui/store'
import { DEFAULT_CAREER } from './ui/backend'
import { DEMO_SEED, installDemoMode, isDemo } from './store-iap'

/** Demo flavor: wipe everything and start the fixed-seed showcase career. */
async function startDemoCareer(): Promise<void> {
  await actions.resetAll()
  actions.newGame({ ...DEFAULT_CAREER, seed: DEMO_SEED })
  navigate('home', undefined, { tab: true })
}

/** Longest the first render waits for native platform setup (storage, plugins) before going ahead. */
const PLATFORM_INIT_LIMIT_MS = 6000

declare global {
  interface Window {
    /** Set by public/boot-guard.js: the app has rendered, the boot error screen stands down. */
    __spBootDone?: () => void
  }
}

/**
 * Native platform setup must never hold the first render hostage: a plugin call or an IndexedDB
 * open that never settles on some Android WebViews would otherwise leave a black screen. Setup
 * keeps running in the background after the limit (storage switches over when it is ready).
 */
async function initPlatformBounded(): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const limit = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), PLATFORM_INIT_LIMIT_MS)
  })
  try {
    const r = await Promise.race([initPlatform(), limit])
    if (r === 'timeout') console.warn(`[StarPath] platform setup still running after ${PLATFORM_INIT_LIMIT_MS} ms; rendering anyway`)
  } catch (e) {
    console.error('[StarPath] platform setup failed; rendering anyway', e)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Backend selection: the real simulation by default; the mock backend (UI
 * development, `?dev=<screen>` jumps with a canned career) behind `?mock=1`.
 */
async function boot(): Promise<void> {
  installErrorRing()
  // A Phaser start that never reached a good frame last time (GPU hang / killed app): Canvas from now on.
  const hung = recoverStaleStart()
  if (hung) pushError('render', `last WebGL start hung (${hung}); using Canvas`)
  const params = new URLSearchParams(location.search)
  if (params.get('mock') === '1') {
    const { installMockBackend } = await import('./ui/dev/mockActions')
    installMockBackend()
  } else {
    installRealBackend()
  }
  bindSettingsToDocument()
  installErrorLog(() => screen.value.id)
  await initPlatformBounded()
  // After initPlatform so the AudioContext is tracked for background suspend.
  installAudioDirector()
  const root = document.getElementById('app')
  if (root) render(<App />, root)
  window.__spBootDone?.()
  // The previous run stopped mid-start (a hang leaves no error): one-time notice, and
  // compatibility mode, then the software layer, when it hung on the GPU path.
  await syncSoftwareModeFromNative()
  await handleLastRunAtBoot({ platform: detectPlatform(), state: softwareModeState(), enable: (step, auto) => setSoftwareMode(true, { auto, ...(step === 'layer' ? { layer: true } : {}) }) })
  if (isDemo() && params.get('mock') !== '1') {
    await startDemoCareer()
    installDemoMode(startDemoCareer)
  }
}

void boot()
