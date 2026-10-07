// Minimal, explicit bridge. Steamworks (achievements, cloud) hooks get added here.
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('starpathNative', {
  platform: 'desktop',
  os: process.platform,
})
