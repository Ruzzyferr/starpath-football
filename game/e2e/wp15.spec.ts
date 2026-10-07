import { test, expect, preferEnglish, waitForApp, sp } from './fixtures'

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

test('wizard offers a birth city for the chosen nation', async ({ page }) => {
  await page.goto('/')
  await waitForApp(page)
  await page.getByRole('button', { name: 'New career' }).click()
  await page.locator('#wiz-first').fill('Deniz')
  await page.locator('#wiz-last').fill('Kaplan')
  const next = page.locator('.wiz-foot').getByRole('button', { name: /^Next/ })
  await next.click()
  const city = page.locator('#wiz-city')
  await expect(city).toBeVisible()
  await city.selectOption({ index: 1 })
  expect(await city.inputValue()).not.toBe('')
})

test('term deposit locks cash from the bank', async ({ page }) => {
  await page.goto('/?autostart=1&seed=99')
  await waitForApp(page)
  await sp(page, 'sp.clearEvents()')
  await sp(page, `sp.state().life.money = 200000`)
  await sp(page, `sp.navigate('life', { tab: 'bank' })`)
  const card = page.getByTestId('bank-term')
  await expect(card).toBeVisible()
  await sp(page, `sp.actions.bankTermDeposit(50000, 26)`)
  await expect(page.getByTestId('bank-term-row')).toHaveCount(1)
  await page.getByTestId('bank-term-row').getByRole('button').click()
  await expect(page.getByTestId('bank-term-row')).toHaveCount(0)
})

test('bench complaint card appears after a bench streak and resolves', async ({ page }) => {
  await page.goto('/?autostart=1&seed=99')
  await waitForApp(page)
  await sp(page, 'sp.clearEvents()')
  await sp(page, `sp.navigate('profile')`)
  await expect(page.getByTestId('bench-complaint')).toHaveCount(0)
  await sp(page, `(sp.state().life.flags.can_complain = true, sp.navigate('home'))`)
  await sp(page, `sp.navigate('profile')`)
  await expect(page.getByTestId('bench-complaint')).toBeVisible()
  await page.getByTestId('complain-polite').click()
  await expect(page.getByTestId('bench-complaint')).toHaveCount(0)
})

test('retirement card offers a post-career path', async ({ page }) => {
  await page.goto('/?autostart=1&seed=99')
  await waitForApp(page)
  await sp(page, 'sp.clearEvents()')
  await sp(page, `sp.navigate('retire')`)
  await expect(page.getByTestId('retire-card')).toBeVisible()
})
