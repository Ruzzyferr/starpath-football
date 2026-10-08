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
import { actions, navigate, screen } from './ui/store'
import { DEFAULT_CAREER } from './ui/backend'
import { DEMO_SEED, installDemoMode, isDemo } from './store-iap'

/** Demo flavor: wipe everything and start the fixed-seed showcase career. */
async function startDemoCareer(): Promise<void> {
  await actions.resetAll()
  actions.newGame({ ...DEFAULT_CAREER, seed: DEMO_SEED })
  navigate('home', undefined, { tab: true })
}

/**
 * Backend selection: the real simulation by default; the mock backend (UI
 * development, `?dev=<screen>` jumps with a canned career) behind `?mock=1`.
 */
async function boot(): Promise<void> {
  const params = new URLSearchParams(location.search)
  if (params.get('mock') === '1') {
    const { installMockBackend } = await import('./ui/dev/mockActions')
    installMockBackend()
  } else {
    installRealBackend()
  }
  bindSettingsToDocument()
  installErrorLog(() => screen.value.id)
  await initPlatform()
  // After initPlatform so the AudioContext is tracked for background suspend.
  installAudioDirector()
  const root = document.getElementById('app')
  if (root) render(<App />, root)
  if (isDemo() && params.get('mock') !== '1') {
    await startDemoCareer()
    installDemoMode(startDemoCareer)
  }
}

void boot()
