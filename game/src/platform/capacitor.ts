/**
 * Capacitor (Android / iOS) integration. Loaded with a dynamic import only on a
 * native shell, so the web/PWA and Electron bundles never execute plugin code.
 */
import { App } from '@capacitor/app'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { KeepAwake } from '@capacitor-community/keep-awake'
import { setHapticDriver, type HapticKind } from '../ui/haptics'
import { CapacitorFileStorage } from './capacitorStorage'
import { setBackgrounded } from './lifecycle'

export { CapacitorFileStorage }

/** Map the UI's haptic vocabulary onto the native Taptic Engine / vibrator. */
export function installHaptics(): void {
  const impact = (style: ImpactStyle) => void Haptics.impact({ style }).catch(() => undefined)
  const notify = (type: NotificationType) => void Haptics.notification({ type }).catch(() => undefined)
  setHapticDriver((kind: HapticKind) => {
    switch (kind) {
      case 'tap':
      case 'select':
        return impact(ImpactStyle.Light)
      case 'success':
        return notify(NotificationType.Success)
      case 'warning':
        return notify(NotificationType.Warning)
      case 'error':
        return notify(NotificationType.Error)
      case 'heavy':
        return impact(ImpactStyle.Heavy)
      case 'goal':
        notify(NotificationType.Success)
        setTimeout(() => impact(ImpactStyle.Heavy), 140)
        return
    }
  })
}

export async function setupChrome(): Promise<void> {
  // Light status-bar icons over the dark UI; the WebView is edge-to-edge and the
  // CSS uses env(safe-area-inset-*) (plus --safe-area-inset-* from SystemBars on old WebViews).
  await StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined)
  await StatusBar.setBackgroundColor({ color: '#00000000' }).catch(() => undefined)
  requestAnimationFrame(() => void SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => undefined))
}

export function setupLifecycle(onBack: () => void): void {
  void App.addListener('pause', () => setBackgrounded(true))
  void App.addListener('resume', () => setBackgrounded(false))
  void App.addListener('appStateChange', ({ isActive }) => setBackgrounded(!isActive))
  void App.addListener('backButton', () => onBack())
}

export function exitApp(): void {
  void App.exitApp()
}

export async function keepAwake(on: boolean): Promise<void> {
  try {
    if (on) await KeepAwake.keepAwake()
    else await KeepAwake.allowSleep()
  } catch {
    /* unsupported */
  }
}
