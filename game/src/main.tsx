import { render } from 'preact'
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/layout.css'
import { App } from './ui/App'
import { bindSettingsToDocument } from './ui/store'
import { installRealBackend } from './ui/backend'
import { initPlatform } from './platform'
import { installAudioDirector } from './audio/director'
import { installErrorLog } from './telemetry/errorLog'
import { screen } from './ui/store'

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
}

void boot()
