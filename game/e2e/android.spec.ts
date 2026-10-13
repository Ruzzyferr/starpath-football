/**
 * Mid/low-end Android hardening (Galaxy A52 black-screen report):
 *  - the app boots and plays a match with WebGL2 unavailable (Phaser 4 only needs WebGL1);
 *  - when the real WebGL context cannot be created, the match falls back to the Canvas renderer;
 *  - a failed import before the first render shows the boot error screen, not a black page,
 *    and "Yeniden dene" recovers once the network is back;
 *  - a WebView under the engine floor gets the "update Android System WebView" message.
 */
import { test, expect, waitForApp, preferEnglish } from './fixtures'

const SCENE_LIVE = () => (window as unknown as { __spScene?: { debugInfo(): { phase: string } } }).__spScene?.debugInfo().phase === 'live'
const RENDERER = () => (window as unknown as { __spScene?: { game: { renderer: { type: number } } } }).__spScene?.game.renderer.type

test('boots and plays a match with WebGL2 disabled', async ({ page }) => {
  test.skip(test.info().project.name === 'mobile', 'one renderer check is enough')
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, id: string, ...rest: unknown[]) {
      if (id === 'webgl2') return null
      return (orig as (...a: unknown[]) => unknown).call(this, id, ...rest)
    } as typeof orig
  })
  await preferEnglish(page)
  await page.goto('/')
  await waitForApp(page)
  await expect(page.locator('#sp-boot-error')).toHaveCount(0)
  await page.goto('/match-demo.html?kind=counter&seed=5&auto=1&q=low')
  await page.waitForFunction(SCENE_LIVE, undefined, { timeout: 60_000 })
  expect(await page.evaluate(RENDERER)).toBeGreaterThan(0)
})

test('falls back to the Canvas renderer when the WebGL context cannot be created', async ({ page, problems, shot }) => {
  test.skip(test.info().project.name === 'mobile', 'one renderer check is enough')
  // Phaser's feature probe (plain getContext('webgl')) succeeds, the real context (with attributes) fails:
  // what a blocklisted / exhausted mobile GPU driver does.
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, id: string, attrs?: unknown, ...rest: unknown[]) {
      if ((id === 'webgl' || id === 'experimental-webgl' || id === 'webgl2') && attrs && typeof attrs === 'object' && 'powerPreference' in attrs) return null
      return (orig as (...a: unknown[]) => unknown).call(this, id, attrs, ...rest)
    } as typeof orig
  })
  await page.goto('/match-demo.html?kind=counter&seed=5&auto=1&q=low')
  await page.waitForFunction(SCENE_LIVE, undefined, { timeout: 60_000 })
  expect(await page.evaluate(RENDERER)).toBe(1) // Phaser.CANVAS
  await page.waitForTimeout(800)
  await shot('android-canvas-fallback')
  // The fallback is logged as a warning, never as an error.
  expect(problems.list).toEqual([])
})

test('a failed import before the first render shows the boot error screen, and retry recovers', async ({ page, problems, shot }) => {
  await page.route('**/src/ui/App.tsx*', (route) => route.abort())
  await page.goto('/')
  const screen = page.locator('#sp-boot-error')
  await expect(screen).toBeVisible({ timeout: 15_000 })
  await expect(screen).toHaveAttribute('data-reason', /load|error|rejection/)
  await expect(screen.getByRole('button', { name: /Yeniden dene|Try again/ })).toBeVisible()
  await expect(screen).toContainText(/Chrome \d+|WebView \d+/)
  await expect(page.locator('#main')).toHaveCount(0)
  await shot('android-boot-error')

  await page.unroute('**/src/ui/App.tsx*')
  await screen.getByRole('button', { name: /Yeniden dene|Try again/ }).click()
  await waitForApp(page)
  await expect(page.locator('#sp-boot-error')).toHaveCount(0)
  // The aborted request is the point of this test.
  problems.list = problems.list.filter((p) => !/App\.tsx|Failed to fetch dynamically imported module|net::ERR_FAILED/.test(p))
})

test('an Android WebView under the floor gets the update message', async ({ browser }) => {
  test.skip(test.info().project.name === 'mobile', 'UA check, once')
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Linux; Android 10; SM-A525F; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/79.0.3945.116 Mobile Safari/537.36',
    locale: 'tr-TR',
  })
  const page = await ctx.newPage()
  try {
    await page.goto('/')
    const screen = page.locator('#sp-boot-error')
    await expect(screen).toBeVisible()
    await expect(screen).toHaveAttribute('data-reason', 'webview-too-old')
    await expect(screen).toContainText('Android System WebView')
    await expect(screen).toContainText('Play Store')
    await expect(screen.getByRole('button', { name: 'Yeniden dene' })).toBeVisible()
    await expect(page.locator('#sp-boot-store')).toHaveAttribute('href', /com\.google\.android\.webview/)
  } finally {
    await ctx.close()
  }
})
