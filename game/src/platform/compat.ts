/**
 * Engine floor of the shipped bundle. Keep in sync with:
 *  - vite.config.ts `build.target` (es2020 / chrome80 / safari15),
 *  - the inline boot guard in index.html (`MIN_CHROME`),
 *  - capacitor.config.json `android.minWebViewVersion`.
 * compat.node.test.ts checks all four.
 */
export const MIN_CHROME = 80
/** ECMAScript edition every emitted chunk must parse at. */
export const TARGET_ECMA = 2020

/** Chrome / Android System WebView major version from a user agent, or null (Safari, Firefox, unknown). */
export function chromeMajor(ua: string): number | null {
  const m = /(?:Chrome|CriOS)\/(\d+)/.exec(ua)
  return m ? Number(m[1]) : null
}

/** True for an Android WebView / Chrome too old to run the bundle (the boot guard then asks for an update). */
export function webViewTooOld(ua: string, min = MIN_CHROME): boolean {
  const v = chromeMajor(ua)
  return v !== null && v < min
}
