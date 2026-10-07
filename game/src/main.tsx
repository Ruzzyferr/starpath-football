import { render } from 'preact'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/layout.css'
import { App } from './ui/App'
import { bindSettingsToDocument } from './ui/store'
// DEV BACKEND: the lead replaces this with the real sim backend
// (installBackend({ actions, data }) from ./ui/store).
import { installMockBackend } from './ui/dev/mockActions'

installMockBackend()
bindSettingsToDocument()

const root = document.getElementById('app')
if (root) render(<App />, root)
