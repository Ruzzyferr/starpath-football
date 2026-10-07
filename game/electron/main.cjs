// Electron shell for the desktop / Steam build.
// Loads the static Vite build from dist/ with a locked-down renderer.
//
// IPC surface (see preload.cjs, exposed as window.starpathNative):
//   saves:get / saves:set / saves:remove / saves:dir  file-based save storage
//   steam:available / steam:unlock                    optional Steamworks
//   app:quit
const { app, BrowserWindow, shell, Menu, ipcMain } = require('electron')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')

const isDev = !app.isPackaged && !!process.env.SP_DEV_URL

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
// steamworks.js is NOT a dependency: install it (`npm i steamworks.js`) for the
// Steam build and set the app id via SP_STEAM_APP_ID or a steam_appid.txt next
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

// ───────────────────────── Window ─────────────────────────

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0B1220',
    show: false,
    autoHideMenuBar: true,
    title: 'StarPath Football',
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
  win.once('ready-to-show', () => win.show())

  // Never navigate away from the game; open external links in the browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e) => e.preventDefault())

  // F11 toggles fullscreen like most PC games.
  win.webContents.on('before-input-event', (_e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') win.setFullScreen(!win.isFullScreen())
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
