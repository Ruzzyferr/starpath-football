// Electron shell for the desktop / Steam build.
// Loads the static Vite build from dist/ with a locked-down renderer.
//
// IPC surface (see preload.cjs, exposed as window.starpathNative):
//   saves:get / saves:set / saves:remove / saves:dir  file-based save storage
//   steam:available / steam:unlock                    optional Steamworks
//   app:quit / app:flushed (renderer finished flushing the autosave before the window closes)
const { app, BrowserWindow, shell, Menu, ipcMain, session, screen } = require('electron')
const { CSP } = require('./csp.cjs')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')

const isDev = !app.isPackaged && !!process.env.SP_DEV_URL

// The game was renamed StarPath Football -> Kickborn. Electron derives userData from productName,
// so a packaged build would otherwise look for saves in a new, empty folder. Keep the old folder.
if (app.isPackaged) app.setPath('userData', path.join(app.getPath('appData'), 'StarPath Football'))

// ───────────────────────── Save storage ─────────────────────────
// One file per key in <userData>/saves. Writes are atomic: write <key>.json.tmp,
// fsync, rename over <key>.json (rename replaces atomically on NTFS/APFS/ext4),
// then fsync the directory on POSIX. Keys are validated strictly so the
// renderer can never escape the saves directory.

const KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/
const MAX_VALUE = 64 * 1024 * 1024

function savesDir() {
  return path.join(app.getPath('userData'), 'saves')
}

function fileFor(key) {
  if (typeof key !== 'string' || !KEY_RE.test(key) || key.includes('..')) throw new Error('invalid key')
  const dir = savesDir()
  const file = path.join(dir, `${key}.json`)
  if (path.dirname(file) !== dir) throw new Error('invalid key')
  return file
}

async function readOrNull(file) {
  try {
    return await fsp.readFile(file, 'utf8')
  } catch (e) {
    if (e && e.code === 'ENOENT') return null
    throw e
  }
}

async function atomicWrite(file, value) {
  await fsp.mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  const fh = await fsp.open(tmp, 'w')
  try {
    await fh.writeFile(value, 'utf8')
    await fh.sync()
  } finally {
    await fh.close()
  }
  await fsp.rename(tmp, file)
  if (process.platform !== 'win32') {
    try {
      const dh = await fsp.open(path.dirname(file), 'r')
      try { await dh.sync() } finally { await dh.close() }
    } catch { /* some filesystems refuse directory fsync */ }
  }
}

// Serialize writes per key so overlapping set/remove calls cannot interleave.
const queues = new Map()
function serial(key, fn) {
  const prev = queues.get(key) || Promise.resolve()
  const next = prev.then(fn, fn)
  queues.set(key, next.catch(() => {}))
  return next
}

ipcMain.handle('saves:get', async (_e, key) => {
  const file = fileFor(key)
  await (queues.get(key) || Promise.resolve())
  // A crash between tmp write and rename leaves only a fully fsynced .tmp.
  return (await readOrNull(file)) ?? (await readOrNull(`${file}.tmp`))
})
ipcMain.handle('saves:set', (_e, key, value) => {
  const file = fileFor(key)
  if (typeof value !== 'string' || value.length > MAX_VALUE) throw new Error('invalid value')
  return serial(key, () => atomicWrite(file, value))
})
ipcMain.handle('saves:remove', (_e, key) => {
  const file = fileFor(key)
  return serial(key, async () => {
    await fsp.rm(file, { force: true })
    await fsp.rm(`${file}.tmp`, { force: true })
  })
})
ipcMain.handle('saves:dir', () => savesDir())

// ───────────────────────── Steamworks (optional) ─────────────────────────
// steamworks.js is an optionalDependency (package.json): `npm install` pulls it when
// it can; a missing/broken install is tolerated. Set the app id via SP_STEAM_APP_ID or a steam_appid.txt next
// to the executable. Without it every call is a harmless no-op.

let steam = null
function initSteam() {
  let appId = Number(process.env.SP_STEAM_APP_ID || 0)
  if (!appId) {
    try {
      appId = Number(fs.readFileSync(path.join(path.dirname(process.execPath), 'steam_appid.txt'), 'utf8').trim())
    } catch { /* not a Steam build */ }
  }
  if (!appId) return
  try {
    const steamworks = require('steamworks.js')
    steam = steamworks.init(appId)
    if (typeof steamworks.electronEnableSteamOverlay === 'function') steamworks.electronEnableSteamOverlay()
    console.log('[StarPath] Steamworks ready for app', appId)
  } catch (e) {
    console.warn('[StarPath] Steamworks unavailable:', e && e.message)
    steam = null
  }
}

const ACH_RE = /^[A-Za-z0-9_]{1,64}$/
ipcMain.handle('steam:available', () => !!steam)
ipcMain.handle('steam:unlock', (_e, id) => {
  if (!steam || typeof id !== 'string' || !ACH_RE.test(id)) return false
  try {
    return !!steam.achievement.activate(id)
  } catch {
    return false
  }
})

ipcMain.on('app:quit', () => app.quit())

// ───────────────────────── Window state (2.9#92) ─────────────────────────
// Bounds / maximized / fullscreen survive restarts; a saved rectangle that no longer fits any display is dropped.

function stateFile() {
  return path.join(app.getPath('userData'), 'window.json')
}

function loadWindowState() {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile(), 'utf8'))
    const num = (v) => typeof v === 'number' && Number.isFinite(v)
    const out = { fullscreen: s.fullscreen === true, maximized: s.maximized === true }
    if (num(s.width) && num(s.height) && s.width >= 960 && s.height >= 600) {
      out.width = Math.round(s.width)
      out.height = Math.round(s.height)
      if (num(s.x) && num(s.y)) {
        const visible = screen.getAllDisplays().some((d) => {
          const b = d.workArea
          return s.x + 100 > b.x && s.x < b.x + b.width - 100 && s.y >= b.y - 10 && s.y < b.y + b.height - 100
        })
        if (visible) {
          out.x = Math.round(s.x)
          out.y = Math.round(s.y)
        }
      }
    }
    return out
  } catch {
    return {}
  }
}

function saveWindowState(win) {
  try {
    const b = win.getNormalBounds()
    fs.writeFileSync(stateFile(), JSON.stringify({ ...b, maximized: win.isMaximized(), fullscreen: win.isFullScreen() }))
  } catch { /* best effort */ }
}

// ───────────────────────── Window ─────────────────────────

let crashReloads = []

function createWindow() {
  const saved = loadWindowState()
  const win = new BrowserWindow({
    width: saved.width ?? 1440,
    height: saved.height ?? 900,
    ...(saved.x !== undefined ? { x: saved.x, y: saved.y } : {}),
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0B1220',
    show: false,
    autoHideMenuBar: true,
    title: 'Kickborn',
    icon: path.join(__dirname, '..', 'build-resources', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  })
  Menu.setApplicationMenu(null)
  win.once('ready-to-show', () => {
    if (saved.maximized) win.maximize()
    if (saved.fullscreen) win.setFullScreen(true)
    win.show()
  })

  // Close handshake: give the renderer a moment to flush the autosave (2.9#45).
  let flushed = false
  win.on('close', (e) => {
    saveWindowState(win)
    if (flushed || win.webContents.isDestroyed() || win.webContents.isCrashed()) return
    e.preventDefault()
    const finish = () => {
      if (flushed) return
      flushed = true
      if (!win.isDestroyed()) win.close()
    }
    ipcMain.once('app:flushed', finish)
    setTimeout(finish, 2000)
    win.webContents.send('app:before-quit')
  })

  // Renderer crash / kill: reload (at most 3 times a minute) so the player lands back on the title
  // screen with the autosave intact instead of a dead window (2.9#69).
  win.webContents.on('render-process-gone', (_e, details) => {
    if (details.reason === 'clean-exit') return
    const now = Date.now()
    crashReloads = crashReloads.filter((t) => now - t < 60_000)
    if (crashReloads.length >= 3) return app.quit()
    crashReloads.push(now)
    console.error('[StarPath] renderer gone:', details.reason)
    if (isDev) win.loadURL(process.env.SP_DEV_URL)
    else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { recovered: details.reason } })
  })

  // Never navigate away from the game; open external links in the browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e) => e.preventDefault())

  // F11 toggles fullscreen like most PC games.
  win.webContents.on('before-input-event', (_e, input) => {
    if (input.type !== 'keyDown') return
    if (input.key === 'F11' || (input.alt && input.key === 'Enter')) win.setFullScreen(!win.isFullScreen())
  })

  if (isDev) win.loadURL(process.env.SP_DEV_URL)
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(() => {
    // Lock the renderer down: CSP on every response, no device/notification permissions, no <webview>.
    if (!isDev) {
      session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
        cb({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [CSP] } })
      })
    }
    session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false))
    session.defaultSession.setPermissionCheckHandler(() => false)
    app.on('web-contents-created', (_e, contents) => {
      contents.on('will-attach-webview', (ev) => ev.preventDefault())
    })
    initSteam()
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
