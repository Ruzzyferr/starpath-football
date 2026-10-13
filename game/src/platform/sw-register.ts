/**
 * Registers the offline service worker (public build only). The worker itself
 * (dist/sw.js) is generated at build time by the `starpath-sw` Vite plugin
 * (scripts/sw-plugin.ts) with a precache list and a content-hash cache name, so
 * every deploy gets a fresh cache and old ones are deleted on activate.
 *
 * Never registered in dev / e2e (vite dev server), in Electron (file://) or in
 * Capacitor (assets are already local).
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return
  // Belt and braces: Capacitor Android serves the app over https from the localhost host, which passes the
  // protocol check below. A precache there could pin stale assets across APK updates.
  if (isCapacitorNative()) {
    void unregisterServiceWorkers()
    return
  }
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return
  if (new URLSearchParams(location.search).has('nosw')) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((e: unknown) => {
      console.warn('[StarPath] service worker registration failed', e)
    })
  })
}

function isCapacitorNative(): boolean {
  const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return cap?.isNativePlatform?.() === true
}

/**
 * Removes any service worker and its starpath-* caches (native shells: assets ship inside the app,
 * so a worker could only serve stale copies after an update). Safe to call when none exists.
 */
export async function unregisterServiceWorkers(): Promise<number> {
  let n = 0
  try {
    if (typeof navigator !== 'undefined' && navigator.serviceWorker?.getRegistrations) {
      for (const r of await navigator.serviceWorker.getRegistrations()) if (await r.unregister()) n++
    }
    if (typeof caches !== 'undefined') {
      for (const k of await caches.keys()) if (k.startsWith('starpath-')) await caches.delete(k)
    }
  } catch (e) {
    console.warn('[StarPath] service worker cleanup failed', e)
  }
  return n
}
