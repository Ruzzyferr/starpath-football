import { test, expect, preferEnglish, assertCleanText, waitForApp } from './fixtures'

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

test('new career through the wizard lands on Home with the hero name', async ({ page, shot }) => {
  await page.goto('/')
  await waitForApp(page)
  await expect(page.getByRole('button', { name: 'New career' })).toBeVisible()
  await shot('a1-title')
  await page.getByRole('button', { name: 'New career' }).click()

  // Identity
  await page.locator('#wiz-first').fill('Deniz')
  await page.locator('#wiz-last').fill('Kaplan')
  await page.locator('#wiz-nick').fill('Kaplan')
  await shot('a2-identity')
  const next = page.locator('.wiz-foot').getByRole('button', { name: /^Next/ })
  await next.click()

  // Nation: search and pick one
  await page.getByRole('searchbox').fill('bra')
  const flag = page.locator('.wiz-flag').first()
  await expect(flag).toBeVisible()
  await flag.click()
  await expect(flag).toHaveAttribute('aria-checked', 'true')
  await shot('a3-nation')
  await next.click()

  // Position
  await shot('a4-position')
  await next.click()
  // Role (only the position's roles)
  await page.locator('.wiz-card').nth(2).click()
  await shot('a5-role')
  await next.click()
  // Background
  await page.locator('.wiz-story').first().click()
  await shot('a6-background')
  await next.click()
  // Look
  await shot('a7-look')
  await next.click()
  // Summary
  await expect(page.locator('.wiz-summary')).toBeVisible()
  await assertCleanText(page)
  await shot('a8-summary')
  // Trials are on by default; this path skips them and lands straight on Home.
  const trialSwitch = page.locator('label.switch-row', { hasText: 'Start with trials' }).locator('input')
  await expect(trialSwitch).toBeChecked()
  await trialSwitch.uncheck()
  await page.getByRole('button', { name: 'Start career' }).click()

  // Home
  await expect(page.locator('.home-grid')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.page-title, h1').first()).toContainText('Kaplan')
  await expect(page.locator('.home-cardteaser-info')).toContainText('Deniz Kaplan')
  await assertCleanText(page)
  await shot('a9-home')
})
