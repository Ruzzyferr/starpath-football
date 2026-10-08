/** Life hub as an in-game smartphone: home grid, app open/close, back gesture, axe. */
import AxeBuilder from '@axe-core/playwright'
import { test, expect, preferEnglish, waitForApp, sp } from './fixtures'

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
  await page.goto('/?autostart=1&dev=casino&seed=31337')
  await waitForApp(page)
  await sp(page, 'sp.clearEvents()')
  await sp(page, `sp.navigate('life')`)
})

test('phone home lists every life app and a status bar', async ({ page, shot }) => {
  await expect(page.getByTestId('phone-status')).toBeVisible()
  if ((page.viewportSize()?.width ?? 0) >= 1000) await expect(page.getByTestId('phone-context')).toBeVisible()
  for (const id of ['relations', 'bank', 'assets', 'business', 'projects', 'social', 'sponsors', 'casino', 'inbox']) {
    await expect(page.getByTestId(`phone-app-${id}`)).toBeVisible()
  }
  await page.waitForTimeout(5000)
  await shot('phone-home')
  const axe = await new AxeBuilder({ page }).analyze()
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
})

test('apps open and Escape returns to the phone home', async ({ page, shot }) => {
  await page.getByTestId('phone-app-bank').click()
  await expect(page.locator('.ph-app-view')).toHaveAttribute('data-app', 'bank')
  await page.waitForTimeout(5000)
  await shot('phone-app-bank')
  const axe = await new AxeBuilder({ page }).analyze()
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
  await page.keyboard.press('Escape')
  await expect(page.locator('.ph-app-view')).toHaveCount(0)
  await expect(page.getByTestId('phone-app-bank')).toBeFocused()
  await page.getByTestId('phone-app-relations').click()
  await expect(page.locator('.ph-app-view')).toHaveAttribute('data-app', 'relations')
  await page.waitForTimeout(5000)
  await shot('phone-app-relations')
  await page.getByRole('button', { name: 'Back to home screen' }).first().click()
  await expect(page.getByTestId('phone-app-relations')).toBeVisible()
  await page.getByTestId('phone-app-business').click()
  await page.waitForTimeout(5000)
  await shot('phone-app-business')
})

test('messages app opens the inbox', async ({ page }) => {
  await page.getByTestId('phone-app-inbox').click()
  await expect(page.locator('main')).toContainText(/Inbox|News/i)
})
