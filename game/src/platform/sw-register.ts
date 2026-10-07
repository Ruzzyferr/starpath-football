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
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return
  if (new URLSearchParams(location.search).has('nosw')) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((e: unknown) => {
      console.warn('[StarPath] service worker registration failed', e)
    })
  })
}
