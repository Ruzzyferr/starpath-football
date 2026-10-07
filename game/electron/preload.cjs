// Minimal, explicit bridge (sandboxed preload: only contextBridge + ipcRenderer).
// Typed in src/platform/native.d.ts; keys are re-validated in main.cjs.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('starpathNative', {
  platform: 'desktop',
  os: process.platform,
  saves: {
    get: (key) => ipcRenderer.invoke('saves:get', String(key)),
    set: (key, value) => ipcRenderer.invoke('saves:set', String(key), String(value)),
    remove: (key) => ipcRenderer.invoke('saves:remove', String(key)),
    dir: () => ipcRenderer.invoke('saves:dir'),
  },
  steam: {
    available: () => ipcRenderer.invoke('steam:available'),
    unlock: (id) => ipcRenderer.invoke('steam:unlock', String(id)),
  },
  quit: () => ipcRenderer.send('app:quit'),
})
