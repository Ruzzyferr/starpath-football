/** Moment matchup: the card before "Play moment" (hero vs key opponent) and the opponent tag during the moment. */
import { join } from 'node:path'
import { test, expect, preferEnglish, waitForApp, sp, assertCleanText, dismissControlHint, SHOTS } from './fixtures'

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

test('moment card shows hero vs key opponent and the opponent tag follows in the moment', async ({ page }, testInfo) => {
  test.setTimeout(150_000)
  await page.goto('/?autostart=1&seed=777')
  await waitForApp(page)
  await sp(page, 'sp.toMatchday()')
  // The hero must start (selection is a roll): this test needs a moment.
  await sp(page, "(() => { const s = sp.state(); s.hero.contract.role = 'captain'; s.hero.managerTrust = 100; s.hero.form = 90; s.hero.fatigue = 0; s.hero.sharpness = 100; s.life.flags.promised_start = true })()")
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Play match' }).click()
  await page.getByRole('button', { name: 'Kick off' }).click()
  await expect(page.locator('.lm-root')).toBeVisible()
  await page.locator('.lm-controls').getByText('4×').click()
  await expect(page.locator('.lm-moment')).toBeVisible({ timeout: 120_000 })
  const card = page.getByTestId('moment-matchup')
  await expect(card).toBeVisible({ timeout: 120_000 })
  const proj = testInfo.project.name
  const dir = process.env.E2E_SHOTS || SHOTS
  await page.screenshot({ path: join(dir, `matchup-card-${proj}.png`) })

  await expect(card.getByTestId('mu-hero')).toBeVisible()
  await expect(card.getByTestId('mu-opp')).toBeVisible()
  for (const id of ['mu-hero', 'mu-opp']) {
    const side = card.getByTestId(id)
    await expect(side.locator('.lm-mu-name')).not.toHaveText('')
    await expect(side.locator('.lm-mu-ovr')).toHaveText(/^\d{2,3}$/)
  }
  expect(await card.getByTestId('mu-row').count()).toBeGreaterThanOrEqual(3)
  await expect(card.getByTestId('mu-edge')).toHaveText(/Your edge|Their edge|Even/)
  // The card must fit inside the viewport (no off-screen dialog).
  const box = await page.locator('.lm-moment-card').boundingBox()
  const vp = page.viewportSize()!
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height + 1)
  await assertCleanText(page)

  // Into the moment: the opponent tag appears above the key opponent.
  await page.getByRole('button', { name: /Play moment/ }).click()
  await dismissControlHint(page).catch(() => false)
  await expect.poll(() => page.evaluate(() => !!(window as unknown as { __spScene?: unknown }).__spScene), { timeout: 30_000 }).toBe(true)
  await page.waitForTimeout(2500)
  const tag = await page.evaluate(() => {
    const s = (window as unknown as { __spScene?: { oppTag: { text: { visible: boolean; text: string }; compact: string } | null } }).__spScene
    return s?.oppTag ? { visible: s.oppTag.text.visible, text: s.oppTag.text.text, compact: s.oppTag.compact } : null
  })
  expect(tag?.compact).toMatch(/ · \d+$/)
  await page.screenshot({ path: join(dir, `matchup-label-${proj}.png`) })
})
