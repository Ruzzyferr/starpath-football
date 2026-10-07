import AxeBuilder from '@axe-core/playwright'
import { test, expect, preferEnglish, waitForApp, sp } from './fixtures'

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

/** Play weeks forward until the sim has handed out a short objective. */
async function untilObjective(page: import('@playwright/test').Page) {
  for (let i = 0; i < 40; i++) {
    if (await sp<number>(page, 'sp.data.objectives().short.length') > 0) break
    await sp(page, 'sp.clearEvents()')
    await sp(page, 'sp.actions.advanceToMatch()')
  }
  await sp(page, 'sp.clearEvents()')
  const dlg = page.getByRole('dialog')
  if (await dlg.count()) await dlg.getByRole('button', { name: 'Close' }).first().click()
  await page.evaluate(() => (window as unknown as { __sp: { navigate: (id: string) => void } }).__sp.navigate('home'))
}

test('objectives card shows on Home and opens the detail screen', async ({ page, shot }) => {
  await page.goto('/?autostart=1&seed=4242')
  await waitForApp(page)
  await expect(page.getByTestId('objectives-card')).toBeVisible()
  await untilObjective(page)
  await sp(page, "sp.navigate('home', undefined, { tab: true })")
  await expect(page.getByTestId('objectives-card').getByTestId('objective').first()).toBeVisible()
  await shot('obj-home')
  await page.getByTestId('objectives-card').getByRole('button', { name: /open objectives/i }).click()
  await expect(page.getByRole('heading', { name: 'Objectives', level: 1 })).toBeVisible()
  await expect(page.getByTestId('objective').first()).toBeVisible()
  await page.waitForTimeout(500)
  await shot('obj-detail')
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([])
})

test('completing an objective raises a toast and lands in the results list', async ({ page }) => {
  await page.goto('/?autostart=1&seed=4242')
  await waitForApp(page)
  await untilObjective(page)
  await sp(page, "sp.navigate('home', undefined, { tab: true })")
  expect(await sp<boolean>(page, 'sp.completeObjective()')).toBe(true)
  await expect(page.locator('.toast-reward', { hasText: /Objective complete/ })).toBeVisible()
  await page.getByTestId('objectives-card').getByRole('button', { name: /open objectives/i }).click()
  await expect(page.getByTestId('objective-result').first()).toContainText('Completed')
})
