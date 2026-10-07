/** Screen Wake Lock API wrapper (web, PWA, Electron). Re-acquires the lock when the page becomes visible again. */
interface Sentinel {
  release(): Promise<void>
  released?: boolean
}

export function createWebWakeLock() {
  let wanted = false
  let sentinel: Sentinel | null = null
  let listening = false

  const api = () => (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<Sentinel> } }).wakeLock

  async function acquire(): Promise<void> {
    const wl = api()
    if (!wl || document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) return
    try {
      sentinel = await wl.request('screen')
    } catch {
      sentinel = null // denied / unsupported
    }
  }

  return {
    async set(on: boolean): Promise<void> {
      wanted = on
      if (!listening && typeof document !== 'undefined') {
        listening = true
        document.addEventListener('visibilitychange', () => {
          if (wanted) void acquire()
        })
      }
      if (on) await acquire()
      else if (sentinel) {
        const s = sentinel
        sentinel = null
        await s.release().catch(() => undefined)
      }
    },
  }
}
