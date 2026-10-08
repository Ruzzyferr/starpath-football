import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const read = (p: string): string => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8')
const main = read('electron/main.cjs')
const preload = read('electron/preload.cjs')
const require_ = createRequire(import.meta.url)

describe('Electron hardening (2.9#86, #45, #69, #92)', () => {
  it('shell files are syntactically valid CommonJS', () => {
    expect(() => new Script(`(function(require,module,exports,__dirname){${main}\n})`)).not.toThrow()
    expect(() => new Script(`(function(require){${preload}\n})`)).not.toThrow()
  })

  it('renderer is isolated and sandboxed', () => {
    expect(main).toMatch(/contextIsolation:\s*true/)
    expect(main).toMatch(/nodeIntegration:\s*false/)
    expect(main).toMatch(/sandbox:\s*true/)
    expect(main).not.toMatch(/nodeIntegration:\s*true|contextIsolation:\s*false|sandbox:\s*false|webSecurity:\s*false/)
    expect(main).toMatch(/setWindowOpenHandler/)
    expect(main).toMatch(/will-navigate/)
    expect(main).toMatch(/will-attach-webview/)
  })

  it('denies every permission request and injects the CSP outside dev', () => {
    expect(main).toMatch(/setPermissionRequestHandler\(\(_wc, _perm, cb\) => cb\(false\)\)/)
    expect(main).toMatch(/setPermissionCheckHandler\(\(\) => false\)/)
    expect(main).toMatch(/Content-Security-Policy/)
  })

  it('CSP is strict: no remote origins, no unsafe-eval, no framing', () => {
    const { CSP } = require_('../../electron/csp.cjs') as { CSP: string }
    expect(CSP).toMatch(/default-src 'self'/)
    expect(CSP).toMatch(/object-src 'none'/)
    expect(CSP).not.toMatch(/'unsafe-eval'|https?:|\*/)
    const script = /script-src ([^;]+)/.exec(CSP)![1]
    expect(script).not.toMatch(/unsafe-inline/)
  })

  it('the preload bridge exposes a minimal, explicit surface', () => {
    expect(preload).toMatch(/contextBridge\.exposeInMainWorld\('starpathNative'/)
    expect(preload).not.toMatch(/exposeInMainWorld\([^)]*ipcRenderer\s*[,)]/)
    expect(preload).toMatch(/onBeforeQuit/)
    expect(main).toMatch(/app:flushed/)
  })

  it('recovers from renderer crashes with a reload cap and restores window state', () => {
    expect(main).toMatch(/render-process-gone/)
    expect(main).toMatch(/crashReloads\.length >= 3/)
    expect(main).toMatch(/window\.json/)
  })

  it('electron-builder flips the security fuses', () => {
    const yml = read('electron-builder.yml')
    expect(yml).toMatch(/runAsNode:\s*false/)
    expect(yml).toMatch(/enableNodeOptionsEnvironmentVariable:\s*false/)
    expect(yml).toMatch(/enableNodeCliInspectArguments:\s*false/)
    expect(yml).toMatch(/onlyLoadAppFromAsar:\s*true/)
  })
})
