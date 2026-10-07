import { render } from 'preact'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/layout.css'
import { App } from './ui/App'
import { bindSettingsToDocument } from './ui/store'
import { installRealBackend } from './ui/backend'

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
  const root = document.getElementById('app')
  if (root) render(<App />, root)
}

void boot()
