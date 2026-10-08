import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (p: string): string => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8')

describe('Android / iOS shell configuration (2.9#62-#67)', () => {
  const manifest = read('android/app/src/main/AndroidManifest.xml')
  const gradle = read('android/variables.gradle')

  it('rotation never recreates the activity (a match in progress survives it)', () => {
    const cc = /android:configChanges="([^"]+)"/.exec(manifest)?.[1] ?? ''
    for (const k of ['orientation', 'screenSize', 'smallestScreenSize', 'screenLayout', 'keyboardHidden', 'uiMode']) expect(cc.split('|')).toContain(k)
    expect(manifest).not.toMatch(/screenOrientation="(portrait|landscape)/) // both orientations stay playable
  })

  it('only the launcher activity is exported and it is single-task', () => {
    const exported = manifest.match(/android:exported="true"/g) ?? []
    expect(exported).toHaveLength(1)
    expect(manifest).toMatch(/launchMode="singleTask"/)
    expect(manifest).not.toMatch(/usesCleartextTraffic="true"/)
  })

  it('targets a current SDK', () => {
    expect(Number(/targetSdkVersion\s*=\s*(\d+)/.exec(gradle)?.[1])).toBeGreaterThanOrEqual(35)
    expect(Number(/minSdkVersion\s*=\s*(\d+)/.exec(gradle)?.[1])).toBeGreaterThanOrEqual(24)
  })

  it('iOS supports portrait and both landscapes on iPhone', () => {
    const plist = read('ios/App/App/Info.plist')
    const phone = /<key>UISupportedInterfaceOrientations<\/key>\s*<array>([\s\S]*?)<\/array>/.exec(plist)?.[1] ?? ''
    for (const o of ['Portrait', 'LandscapeLeft', 'LandscapeRight']) expect(phone).toContain(`UIInterfaceOrientation${o}`)
  })
})
