/**
 * iPhone (TestFlight build 3) regressions, run in WebKit (iPhone 15) and the
 * Chromium phone project:
 *  1. "Skip to match day" was a silent no-op while a decision card was pending.
 *  2. On matchday the live-match radar showed only the ball (no players), and
 *     the Phaser figures must never render invisible (canvas failure → simple
 *     figures + local error log).
 */
import type { Page } from '@playwright/test'
import { test, expect, preferEnglish, waitForApp, sp } from './fixtures'

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

const cal = (page: Page) => sp<{ day: number; week: number; slot: number; pending: number }>(page, '(() => { const s = sp.state(); return { day: s.calendar.day, week: s.calendar.week, slot: s.calendar.slot, pending: s.pendingEvents.length } })()')

async function tapOrClick(page: Page, sel: ReturnType<Page['locator']>, touch: boolean) {
  if (touch) await sel.tap()
  else await sel.click()
}

test('skip to match day: a pending decision blocks with a reason and a button to it, then the skip works', async ({ page, shot, hasTouch }) => {
  await page.goto('/?autostart=1&seed=777')
  await waitForApp(page)
  await page.keyboard.press('Escape')
  const before = await cal(page)
  expect(before.pending, 'fresh career starts with a decision card').toBeGreaterThan(0)
  const skip = page.locator('.home-cta-auto')
  await tapOrClick(page, skip, hasTouch)
  const toast = page.locator('.toast').filter({ hasText: 'pending decision' })
  await expect(toast).toBeVisible()
  await page.waitForTimeout(400) // enter animation
  await shot('ios-skip-blocked')
  await tapOrClick(page, toast.getByRole('button', { name: 'Open decision' }), hasTouch)
  await expect(page.getByRole('dialog')).toBeVisible()
  // Resolve the cards, then the same button moves the calendar.
  await tapOrClick(page, page.locator('.evt-later'), hasTouch)
  await expect(page.getByRole('dialog')).toBeHidden()
  await sp(page, 'sp.clearEvents()')
  const mid = await cal(page)
  await tapOrClick(page, skip, hasTouch)
  await expect.poll(async () => {
    const c = await cal(page)
    return c.day !== mid.day || c.week !== mid.week || c.slot !== mid.slot || c.pending > 0
  }, { timeout: 15_000 }).toBe(true)
  await shot('ios-skip-advanced')
})

test('live match radar shows both teams, not just the ball', async ({ page, shot, hasTouch }) => {
  await page.goto('/?autostart=1&seed=777')
  await waitForApp(page)
  await sp(page, 'sp.toMatchday()')
  await page.keyboard.press('Escape')
  await tapOrClick(page, page.getByRole('button', { name: 'Play match' }), hasTouch)
  await tapOrClick(page, page.getByRole('button', { name: 'Kick off' }), hasTouch)
  await expect(page.locator('.lm-root')).toBeVisible()
  const dots = page.locator('[data-testid="radar-players"] .lm-dot')
  await expect(dots).toHaveCount(22)
  await expect(page.locator('.lm-dot-home')).toHaveCount(11)
  await expect(page.locator('.lm-dot-away')).toHaveCount(11)
  await page.waitForTimeout(5000)
  await shot('ios-radar')
})

const sceneFigures = (page: Page) =>
  page.evaluate(() => (window as unknown as { __spScene?: { debugInfo(): { phase: string; figures: { players: number; fixes: number; issues: number } } } }).__spScene?.debugInfo() ?? null)

test('match scene: figure textures pass the self-check', async ({ page, shot }) => {
  await page.goto('/match-demo.html?kind=build_up&seed=3')
  await page.waitForFunction(() => (window as unknown as { __spScene?: { debugInfo(): { phase: string } } }).__spScene?.debugInfo().phase === 'live', undefined, { timeout: 30_000 })
  await page.waitForTimeout(5000)
  const d = await sceneFigures(page)
  expect(d?.figures.players).toBeGreaterThan(10)
  expect(d?.figures.fixes).toBe(0)
  expect(d?.figures.issues).toBe(0)
  await shot('ios-scene-figures')
})

test('match scene: a failing figure canvas falls back to simple figures and is logged', async ({ page, shot }) => {
  // Simulate iOS refusing big canvases (canvas memory limit): no 2d context for the figure sheets.
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type === '2d' && this.width >= 1024 && this.height >= 600) return null
      return (orig as (...a: unknown[]) => unknown).call(this, type, ...rest)
    } as typeof orig
    try {
      localStorage.setItem('sp.errorlog.enabled', '1')
    } catch {
      /* ignore */
    }
  })
  // The fallback is reported through console.warn (dev) — not an error.
  await page.goto('/match-demo.html?kind=build_up&seed=3')
  await page.waitForFunction(() => (window as unknown as { __spScene?: { debugInfo(): { phase: string } } }).__spScene?.debugInfo().phase === 'live', undefined, { timeout: 30_000 })
  await page.waitForTimeout(5000)
  const d = await sceneFigures(page)
  expect(d?.figures.issues, 'fallback was reported').toBeGreaterThan(0)
  const log = await page.evaluate(() => localStorage.getItem('sp.errorlog') ?? '')
  expect(log).toContain('render')
  await shot('ios-scene-fallback')
})
