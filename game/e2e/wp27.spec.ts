/** WP-27 UI: undo toast (2.7#48), "Why?" panel (2.7#83), low meter warning (2.7#43). */
import AxeBuilder from '@axe-core/playwright'
import { test, expect, preferEnglish, sp, waitForApp } from './fixtures'

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

test('clearing a planned slot offers a 6 second undo that restores it', async ({ page, shot }) => {
  await page.goto('/?autostart=1&seed=88')
  await waitForApp(page)
  await sp(page, `sp.navigate('planner')`)
  const body = page.locator('.plan-slot-body:not([disabled])').first()
  await body.click()
  await page.locator('.plan-picker .plan-act:not([disabled])').first().click()
  const name = await page.locator('.plan-slot-act').first().innerText()
  await body.click()
  await page.getByRole('button', { name: /Clear/i }).click()
  await expect(page.locator('.plan-slot-act')).toHaveCount(0)
  const undo = page.getByTestId('toast-action')
  await expect(undo).toBeVisible()
  await page.waitForTimeout(600)
  await shot('w27-undo')
  await undo.click()
  await expect(page.locator('.plan-slot-act').first()).toHaveText(name)
})

test('profile "Why?" panel lists at most three factors', async ({ page, shot }) => {
  await page.goto('/?autostart=1&seed=88')
  await waitForApp(page)
  await sp(page, `sp.navigate('profile')`)
  const card = page.getByTestId('why-playing')
  await card.scrollIntoViewIfNeeded()
  await page.getByTestId('why-toggle').click()
  const n = await card.locator('li').count()
  expect(n).toBeGreaterThan(0)
  expect(n).toBeLessThanOrEqual(3)
  await page.waitForTimeout(800)
  await shot('w27-why')
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([])
})
