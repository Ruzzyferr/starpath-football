/** WP-U: settings and UI wiring (2.4#3/#24/#113, 2.5#1/#3, 2.7#22/#38/#39/#42/#48/#81/#84/#86/#87, 2.3#11). */
import AxeBuilder from '@axe-core/playwright'
import { test, expect, preferEnglish, sp, waitForApp } from './fixtures'

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

const serious = (res: { violations: { id: string; impact?: string | null }[] }) =>
  res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)

test('settings: money notation, transparency and partner preference apply', async ({ page, shot }) => {
  await page.goto('/?autostart=1&seed=88')
  await waitForApp(page)
  await sp(page, `sp.navigate('settings')`)
  await page.getByRole('radio', { name: 'Code (EUR)' }).click()
  await page.getByRole('radio', { name: 'Men', exact: true }).click()
  await page.getByRole('radio', { name: 'Direction chips' }).click()
  await page.waitForTimeout(600)
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('starpath.settings.v1') ?? '{}'))
  expect(stored).toMatchObject({ moneyStyle: 'code', partnerPref: 'men', eventTransparency: 'direction' })
  await shot('wpu-settings')
  await sp(page, `sp.navigate('life', { tab: 'assets' })`)
  await page.waitForTimeout(500)
  await expect(page.locator('#main')).toContainText('EUR')
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(serious(res)).toEqual([])
})

test('relations: band effect, trend and interaction costs are visible', async ({ page, shot }) => {
  await page.goto('/?autostart=1&seed=88')
  await waitForApp(page)
  await sp(page, `sp.clearEvents()`)
  await sp(page, `sp.navigate('life', { tab: 'relations' })`)
  const card = page.locator('.life-person').first()
  await expect(card).toBeVisible()
  await expect(card.getByTestId('rel-band')).toBeVisible()
  await expect(card.getByTestId('rel-effect')).not.toBeEmpty()
  await expect(card.getByTestId('rel-trend')).toBeVisible()
  await expect(card.locator('.life-act-cost').first()).toContainText('energy')
  await page.waitForTimeout(800)
  await shot('wpu-relations')
})

test('assets: shelf shows condition and second-hand value; selling offers undo', async ({ page, shot }) => {
  await page.goto('/?autostart=1&seed=88')
  await waitForApp(page)
  await sp(page, `sp.clearEvents()`)
  await sp(page, `sp.state().life.money = 5000000`)
  await sp(page, `sp.navigate('life', { tab: 'assets' })`)
  const buy = page.locator('.life-asset').getByRole('button', { name: 'Buy' }).first()
  {
    await buy.click()
    await page.locator('.modal-root').getByRole('button', { name: /^Pay / }).click()
    await expect(page.getByTestId('shelf-stats').first()).toContainText('Condition')
    await expect(page.getByTestId('shelf-stats').first()).toContainText('Second-hand')
    const owned = await page.locator('.life-shelf-item').count()
    await page.locator('.life-shelf-item').first().getByRole('button', { name: 'Sell' }).click()
    await expect(page.locator('.life-shelf-item')).toHaveCount(owned - 1)
    await page.waitForTimeout(600)
    await shot('wpu-undo-sale')
    await page.getByTestId('toast-action').click()
    await expect(page.locator('.life-shelf-item')).toHaveCount(owned)
  }
})

test('profile: OVR explainer lists weights that sum to the OVR', async ({ page, shot }) => {
  await page.goto('/?autostart=1&seed=88')
  await waitForApp(page)
  await sp(page, `sp.navigate('profile')`)
  await page.getByTestId('ovr-explain-btn').click()
  const table = page.getByTestId('ovr-table')
  await expect(table).toBeVisible()
  expect(await table.locator('tbody tr').count()).toBeGreaterThan(4)
  await page.waitForTimeout(800)
  await shot('wpu-ovr')
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(serious(res)).toEqual([])
})

test('profile finance: itemised weekly statement', async ({ page, shot }) => {
  await page.goto('/?autostart=1&seed=88')
  await waitForApp(page)
  await sp(page, `sp.toMatchday()`)
  await sp(page, `sp.navigate('profile')`)
  const st = page.getByTestId('finance-statement')
  await st.scrollIntoViewIfNeeded()
  await expect(st.getByTestId('stmt-wage')).toBeVisible()
  await expect(st.getByTestId('stmt-net')).toBeVisible()
  await page.waitForTimeout(800)
  await shot('wpu-statement')
})

test('casino: fixed band shows balance, loss limit and session time', async ({ page, shot }) => {
  await page.addInitScript(() => localStorage.setItem('starpath.settings.v1', JSON.stringify({ lang: 'en', vibration: false })))
  await page.goto('/?autostart=1&dev=casino&seed=31337')
  await waitForApp(page)
  for (const id of ['casino', 'slots']) {
    await sp(page, `sp.navigate('${id}')`)
    const band = page.getByTestId('casino-band')
    await expect(band).toBeVisible()
    await expect(page.getByTestId('casino-band-limit')).toBeVisible()
    await expect(page.getByTestId('casino-band-session')).toContainText('min')
  }
  await expect(page.locator('#cas-bet-slider')).toBeVisible()
  await page.waitForTimeout(800)
  await shot('wpu-casino-band')
})

test('contract: patience preview follows the sliders', async ({ page, shot }) => {
  await page.goto('/?autostart=1&seed=99')
  await waitForApp(page)
  await sp(page, 'sp.clearEvents()')
  await sp(page, `(() => { const s = sp.state(); s.hero.contract.untilSeason = s.calendar.season; s.hero.managerTrust = 70 })()`)
  await sp(page, `sp.navigate('contract')`)
  await page.getByRole('button', { name: 'Discuss renewal' }).click()
  const propose = page.getByRole('button', { name: 'Send proposal' })
  await expect(propose).toBeVisible()
  const pv = page.getByTestId('patience-preview')
  await expect(pv).toBeVisible()
  await expect(pv).toContainText(/does not reduce|costs about|walk away/)
  const wage = page.locator('#ctr-wage')
  await wage.focus()
  for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowRight')
  await expect(pv).toContainText(/costs about|walk away/)
  await page.waitForTimeout(800)
  await shot('wpu-patience')
})
