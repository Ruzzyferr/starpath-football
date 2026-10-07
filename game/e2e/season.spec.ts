import { test, expect, preferEnglish, assertCleanText, waitForApp, sp } from './fixtures'

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

test('fast-forward to season end: review renders awards cleanly', async ({ page, shot }) => {
  test.setTimeout(300_000)
  await page.goto('/?autostart=1&seed=2027')
  await waitForApp(page)
  const t0 = Date.now()
  await sp(page, 'sp.toSeasonEnd()')
  console.log(`[e2e] season fast-forward took ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  await expect(page.locator('.se-root')).toBeVisible()
  await expect(page.locator('.se-root')).not.toHaveClass(/se-empty/)
  await shot('f1-season-start')
  // Reveal everything (skip the ceremony) and check the content.
  const skip = page.locator('.se-skip')
  if (await skip.isVisible().catch(() => false)) await skip.click()
  await expect(page.locator('.se-awards')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.se-award.is-pending')).toHaveCount(0, { timeout: 15_000 })
  await page.waitForTimeout(1500)
  await assertCleanText(page)
  const stats = await page.locator('.se-stat .score-font').allInnerTexts()
  for (const s of stats) expect(s).toMatch(/^[\d.,]+$/)
  await shot('f2-season-awards')
  await page.locator('.se-root').evaluate((el) => el.scrollTo?.(0, el.scrollHeight))
  await page.mouse.wheel(0, 3000)
  await shot('f3-season-awards-bottom')
  await page.locator('.se-footer button').click()
  await expect(page.locator('.se-root')).toHaveCount(0)
  await assertCleanText(page)
  await shot('f4-after-season')

  // Contract negotiation with an offer on the table (renewal or a bid), if any club made one.
  const clubs = await sp<string[]>(page, `sp.data.interest().filter((i) => i.level >= 70).map((i) => i.club.id)`)
  for (const id of clubs) {
    await sp(page, `sp.navigate('contract')`)
    await sp(page, `sp.actions.openNegotiation(${JSON.stringify(id)})`)
    const propose = page.getByRole('button', { name: 'Send proposal' })
    if (!(await propose.isVisible().catch(() => false))) continue
    await assertCleanText(page)
    await shot('f5-negotiation')
    await propose.click()
    await page.waitForTimeout(400)
    await assertCleanText(page)
    await shot('f6-negotiation-response')
    break
  }
})
