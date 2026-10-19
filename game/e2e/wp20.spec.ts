import { test, expect, preferEnglish, waitForApp, sp } from './fixtures'

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

test('purchase history lists a purchase; legal pages are bundled and marked draft', async ({ page, shot, request }) => {
  await page.goto('/?autostart=1&seed=2027&flavor=trial')
  await waitForApp(page)
  await sp(page, `sp.navigate('settings')`)
  await expect(page.getByTestId('purchase-history')).toContainText('No purchases on record')
  await page.evaluate(() => {
    localStorage.setItem('starpath.entitlements.v1', JSON.stringify({ v: 1, owned: { full_career: { at: Date.UTC(2026, 5, 1), src: 'google' } } }))
  })
  await page.reload()
  await waitForApp(page)
  await sp(page, `sp.navigate('settings')`)
  await expect(page.getByTestId('purchase-history-row')).toHaveCount(1)
  await expect(page.getByTestId('purchase-history-row')).toContainText('2026')
  await expect(page.getByTestId('legal-privacy')).toHaveAttribute('href', './legal/privacy-en.html')
  await shot('wp20-history-legal')
  for (const f of ['privacy-en', 'privacy-tr', 'terms-en', 'terms-tr']) {
    const r = await request.get(`/legal/${f}.html`)
    expect(r.ok()).toBe(true)
    expect(await r.text()).toContain('Rüzgar Emir Bulut')
  }
  expect((await request.get('/legal/THIRD_PARTY_LICENSES.txt')).ok()).toBe(true)
})

test('demo flavor: fixed-seed career starts by itself and shows the demo note', async ({ page }) => {
  await page.goto('/?flavor=demo')
  await waitForApp(page)
  await expect.poll(() => sp<number>(page, 'sp.state()?.meta?.seed ?? 0'), { timeout: 20_000 }).toBe(20261007)
  await sp(page, `sp.navigate('settings')`)
  await expect(page.getByTestId('demo-note')).toBeVisible()
})
