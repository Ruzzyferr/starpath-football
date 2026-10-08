/**
 * WP-13 control schemes: settings persist and reach the match input layer;
 * a moment played with the oscillating PC power bar records a deterministic
 * input log that replays to the same outcome.
 */
import { test, expect, preferEnglish, waitForApp, sp } from './fixtures'

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

test('settings: control schemes persist and reach the input layer; assist multipliers shown', async ({ page }) => {
  await page.goto('/?autostart=1&seed=4242')
  await waitForApp(page)
  await sp(page, `sp.navigate('settings')`)
  await expect(page.getByRole('radio', { name: /Full ×0\.85/ })).toBeVisible()
  await expect(page.getByRole('radio', { name: /Manual ×1\.2/ })).toBeVisible()
  await page.getByRole('radio', { name: 'Sling-shot' }).click()
  // PC power is the first "Oscillating" group, gamepad the second.
  await page.getByRole('radio', { name: 'Oscillating' }).first().click()
  await page.getByRole('radio', { name: 'Analog', exact: true }).click()
  await page.getByRole('switch', { name: /Vision pass hints/ }).click()
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('starpath.settings.v1') ?? '{}') as Record<string, unknown>)
  expect(stored).toMatchObject({ touchShot: 'slingshot', pcPower: 'oscillate', padPower: 'analog', visionHints: false })
  const prefs = await page.evaluate(async () => {
    const m = (await import(/* @vite-ignore */ '/src/input/prefs.ts')) as { getControlPrefs(): Record<string, unknown> }
    return m.getControlPrefs()
  })
  expect(prefs).toMatchObject({ touchShot: 'slingshot', pcPower: 'oscillate', padPower: 'analog', visionHints: false })
  await page.reload()
  await waitForApp(page)
  await sp(page, `sp.navigate('settings')`)
  await expect(page.getByRole('radio', { name: 'Sling-shot' })).toBeChecked()
})

test('oscillating power bar: a played moment records an input log that replays identically', async ({ page, isMobile }) => {
  test.skip(isMobile, 'mouse scheme')
  await page.goto('/match-demo.html?kind=edge_of_box&seed=3')
  await page.waitForFunction(() => !!(window as unknown as { __spScene?: unknown }).__spScene, undefined, { timeout: 30_000 })
  await page.evaluate(async () => {
    const m = (await import(/* @vite-ignore */ '/src/input/prefs.ts')) as { setControlPrefs(p: object): void }
    m.setControlPrefs({ pcPower: 'oscillate' })
    const w = window as unknown as { __spScene: { data0: { highlight: unknown } }; __spHl?: unknown }
    w.__spHl = w.__spScene.data0.highlight
  })
  await page.waitForFunction(() => {
    const i = (window as unknown as { __spScene: { debugInfo(): { phase: string; heroOnBall: boolean } } }).__spScene.debugInfo()
    return i.phase === 'live' && i.heroOnBall
  }, undefined, { timeout: 20_000 })
  const d = await page.evaluate(() => (window as unknown as { __spScene: { debugInfo(): { goal: { x: number; y: number }; hero: { x: number; y: number }; canvas: { top: number } } } }).__spScene.debugInfo())
  // debugInfo() reports page (CSS) coordinates; the goal can be off-screen, so aim along the line toward it.
  const gx = d.hero.x + (d.goal.x - d.hero.x) * 0.4
  const gy = Math.max(d.canvas.top + 20, d.hero.y + (d.goal.y - d.hero.y) * 0.4)
  await page.mouse.move(gx, gy)
  await page.mouse.down()
  await page.waitForTimeout(450)
  // Mid-hold the meter is live and oscillating.
  await page.mouse.move(gx + 3, gy - 1)
  await page.mouse.up()
  await expect(page.locator('#result')).toHaveText(/^edge_of_box: [A-Z_]+ \(/, { timeout: 90_000 })
  const out = await page.evaluate(async () => {
    const w = window as unknown as { __spInputLog?: { frames: { actions?: { kind: string }[] }[] }; __spHl: unknown }
    const log = w.__spInputLog
    if (!log) return null
    const m = (await import(/* @vite-ignore */ '/src/game/inputReplay.ts')) as { replayInputs(h: unknown, r: unknown): { result: { outcome: string } | null; finished: boolean } }
    const rt = m.replayInputs(w.__spHl, log)
    return { frames: log.frames.length, kinds: log.frames.flatMap((f) => (f.actions ?? []).map((a) => a.kind)), outcome: rt.result?.outcome ?? null, finished: rt.finished }
  })
  expect(out).not.toBeNull()
  expect(out!.frames).toBeGreaterThan(30)
  expect(out!.kinds, out!.kinds.join(',')).toContain('shoot')
  const shown = (await page.locator('#result').textContent()) ?? ''
  expect(shown.toLowerCase()).toContain(`: ${out!.outcome}`)
})
