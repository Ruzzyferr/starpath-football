/**
 * WP-14: referee shown before kick-off, pass-to-me call in a live moment,
 * the new moment kinds on the demo page.
 */
import { test, expect, preferEnglish, assertCleanText, waitForApp, sp } from './fixtures'

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

test('pre-match shows the referee with strictness 1-5', async ({ page, shot }) => {
  await page.goto('/?autostart=1&seed=4242')
  await waitForApp(page)
  await sp(page, 'sp.toMatchday()')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Play match' }).click()
  await expect(page.getByRole('button', { name: 'Kick off' })).toBeVisible()
  const ref = page.getByTestId('pm-referee')
  await expect(ref).toBeVisible()
  await expect(ref).toContainText('Referee')
  const s = Number(await ref.getAttribute('data-strictness'))
  expect(s).toBeGreaterThanOrEqual(1)
  expect(s).toBeLessThanOrEqual(5)
  await expect(ref.locator('.pm-ref-pip.is-on')).toHaveCount(s)
  await expect(ref).toContainText(/Lenient|Relaxed|Balanced|Strict|Card-happy/)
  await assertCleanText(page)
  await shot('wp14-referee')
})

test('a suspended hero cannot be picked: Play match is blocked with a notice', async ({ page }) => {
  await page.goto('/?autostart=1&seed=4242')
  await waitForApp(page)
  await sp(page, 'sp.toMatchday()')
  await sp(page, '(() => { sp.state().hero.suspendedMatches = 2; sp.actions.playMatch() })()')
  await expect(page.getByText('You are suspended for this match.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Kick off' })).toHaveCount(0)
})

test('pass-to-me: G raises the hand off the ball', async ({ page }) => {
  await page.goto('/match-demo.html?kind=defend&seed=3')
  await page.waitForFunction(() => !!(window as unknown as { __spScene?: unknown }).__spScene, undefined, { timeout: 30_000 })
  type Dbg = { __spScene: { debugInfo(): { phase: string; heroCallAt: number; heroOnBall: boolean } } }
  await page.waitForFunction(() => (window as unknown as Dbg).__spScene.debugInfo().phase === 'live', undefined, { timeout: 20_000 })
  await page.locator('canvas').first().click({ position: { x: 5, y: 5 } }).catch(() => undefined)
  await page.keyboard.press('g')
  await page.waitForFunction(() => (window as unknown as Dbg).__spScene.debugInfo().heroCallAt >= 0, undefined, { timeout: 5_000 })
})
