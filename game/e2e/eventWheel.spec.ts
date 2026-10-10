import { test, expect, assertCleanText, waitForApp } from './fixtures'
import type { Page } from '@playwright/test'

/**
 * Odds wheel (tester feedback, TestFlight build 6): a risky choice spins a
 * green / amber / red wheel sized exactly like the card's odds; it stops on the
 * draw the sim already made and the outcome follows.
 */
async function settingsInit(page: Page, s: Record<string, unknown>): Promise<void> {
  await page.addInitScript((v) => {
    try {
      localStorage.setItem('starpath.settings.v1', JSON.stringify(v))
    } catch {
      /* ignore */
    }
  }, s)
}

/** Index of the first enabled choice that shows a percentage (a real roll). */
async function rolledChoice(page: Page): Promise<{ i: number; pct: number }> {
  const choices = page.locator('.modal-root .evt-choice')
  const n = await choices.count()
  for (let i = 0; i < n; i++) {
    const c = choices.nth(i)
    if (await c.isDisabled()) continue
    const txt = await c.locator('.evt-odds b').first().innerText().catch(() => '')
    if (/\d+%|%\d+/.test(txt)) return { i, pct: Number(txt.replace(/\D/g, '')) }
  }
  return { i: -1, pct: 0 }
}

test('event wheel: spins to the rolled band, then the matching outcome', async ({ page, shot }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await settingsInit(page, { lang: 'en', reducedMotion: false })
  await page.goto('/?autostart=1&seed=99&event=1')
  await waitForApp(page)
  const modal = page.locator('.modal-root')
  await expect(modal).toBeVisible()
  // Each rolled choice shows the three-way split next to its chance.
  await expect(modal.getByTestId('evt-split').first()).toBeVisible()

  const { i, pct } = await rolledChoice(page)
  expect(i).toBeGreaterThanOrEqual(0)
  await modal.locator('.evt-choice').nth(i).click()

  const wheel = modal.getByTestId('odds-wheel')
  await expect(wheel).toBeVisible()
  await expect(wheel.locator('.ow-key.is-success')).toContainText(`${pct}%`)
  await page.waitForTimeout(650)
  await shot('wheel1-midspin')
  await expect(wheel).not.toHaveAttribute('data-tier', /./) // still spinning

  await expect(wheel).toHaveAttribute('data-tier', /success|mixed|fail/, { timeout: 6000 })
  const tier = await wheel.getAttribute('data-tier')
  await page.waitForTimeout(250)
  await shot('wheel2-landed')

  const out = modal.getByTestId('evt-outcome')
  await expect(out).toBeVisible()
  await expect(out).toHaveAttribute('data-tier', tier!)
  await expect(out.getByTestId('roll-strip')).toBeVisible()
  await assertCleanText(page)
  await page.waitForTimeout(700)
  await shot('wheel3-outcome')
})

test('event wheel: a tap skips the spin; Turkish labels', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await settingsInit(page, { lang: 'tr', reducedMotion: false })
  await page.goto('/?autostart=1&seed=99&event=1')
  await waitForApp(page)
  const modal = page.locator('.modal-root')
  const { i } = await rolledChoice(page)
  expect(i).toBeGreaterThanOrEqual(0)
  await modal.locator('.evt-choice').nth(i).click()
  const wheel = modal.getByTestId('odds-wheel')
  await expect(wheel).toContainText('Şans çarkı')
  await wheel.click() // land now
  await expect(wheel).toHaveAttribute('data-tier', /success|mixed|fail/, { timeout: 1000 })
  await expect(wheel.locator('.ow-skip')).toHaveText('Devam')
  // Straight on (guarded: the short hold may already have moved on by itself).
  await page.evaluate(() => (document.querySelector('.ow-skip') as HTMLElement | null)?.click())
  await expect(modal.getByTestId('evt-outcome')).toBeVisible({ timeout: 1000 })
})

test('event wheel: reduced motion reveals the outcome instantly with the roll strip', async ({ page }) => {
  await settingsInit(page, { lang: 'en', reducedMotion: true })
  await page.goto('/?autostart=1&seed=99&event=1')
  await waitForApp(page)
  const modal = page.locator('.modal-root')
  const { i } = await rolledChoice(page)
  expect(i).toBeGreaterThanOrEqual(0)
  await modal.locator('.evt-choice').nth(i).click()
  await expect(modal.getByTestId('evt-outcome')).toBeVisible({ timeout: 1000 })
  await expect(modal.getByTestId('odds-wheel')).toHaveCount(0)
  await expect(modal.getByTestId('roll-strip')).toBeVisible()
})
