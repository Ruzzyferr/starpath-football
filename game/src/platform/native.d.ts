/** Bridge exposed by electron/preload.cjs (contextBridge). Absent on web / Capacitor. */
export interface StarpathNativeBridge {
  platform: 'desktop'
  os: string
  saves: {
    get(key: string): Promise<string | null>
    set(key: string, value: string): Promise<void>
    remove(key: string): Promise<void>
    dir(): Promise<string>
  }
  steam: {
    available(): Promise<boolean>
    unlock(id: string): Promise<boolean>
  }
  quit(): void
}

declare global {
  interface Window {
    starpathNative?: StarpathNativeBridge
  }
}
