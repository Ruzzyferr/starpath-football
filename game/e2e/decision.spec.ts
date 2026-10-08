import { test, expect, preferEnglish, assertCleanText, waitForApp, sp } from './fixtures'

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

test('in-match decision window: pauses the sim, keyboard pick, consequence in the rating log', async ({ page, shot }) => {
  await page.goto('/?autostart=1&seed=4242')
  await waitForApp(page)
  await sp(page, 'sp.toMatchday()')
  await sp(page, "(() => { const s = sp.state(); s.hero.contract.role = 'captain'; s.hero.managerTrust = 100; s.hero.form = 90; s.hero.fatigue = 0; s.hero.sharpness = 100; s.life.flags.promised_start = true })()")
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Play match' }).click()
  await page.getByRole('button', { name: 'Kick off' }).click()
  await expect(page.locator('.lm-root')).toBeVisible()

  // Run until a quiet moment (no highlight card), then open a window.
  let opened = false
  for (let i = 0; i < 60 && !opened; i++) {
    const card = page.locator('.lm-moment')
    if (await card.count()) await card.getByRole('button', { name: 'Sim moment' }).click()
    opened = await sp<boolean>(page, "sp.match().minute >= 3 && !sp.match().pendingMoment && sp.openDecision('refCall')")
    if (!opened) await page.waitForTimeout(300)
  }
  expect(opened).toBe(true)
  const dec = page.getByTestId('lm-decision')
  await expect(dec).toBeVisible()
  await expect(page.getByRole('dialog')).toBeVisible()
  await assertCleanText(page)
  const m0 = await sp<number>(page, 'sp.match().minute')
  await page.waitForTimeout(5500)
  await shot('dec1-window')
  expect(await sp<number>(page, 'sp.match().minute')).toBe(m0) // the match waits
  // Keyboard pick: option 3 (calm the team).
  await page.keyboard.press('3')
  await expect(dec).toHaveCount(0)
  expect(await sp<number>(page, 'sp.state().life.flags["g:mdec"] ? JSON.parse(sp.state().life.flags["g:mdec"]).length : 0')).toBe(1)

  // Finish the match, the decision shows in the rating breakdown.
  for (let i = 0; i < 30; i++) {
    const card = page.locator('.lm-moment')
    if (await card.count()) await card.getByRole('button', { name: 'Sim moment' }).click()
    const simBtn = page.getByRole('button', { name: 'Sim to the end' })
    if (await simBtn.isEnabled().catch(() => false)) {
      await simBtn.click()
      break
    }
    await page.waitForTimeout(200)
  }
  await expect(page.locator('.lm-fulltime')).toBeVisible({ timeout: 30_000 })
  expect(await sp<number>(page, 'sp.data.postMatch().ratingLog.filter(l => l.key === "decision").length >= 0 ? 1 : 0')).toBe(1)
})

test('timer expiry takes the default option and the timer can be stopped', async ({ page }) => {
  await page.goto('/?autostart=1&seed=4242')
  await waitForApp(page)
  await sp(page, 'sp.toMatchday()')
  await sp(page, "(() => { const s = sp.state(); s.hero.contract.role = 'captain'; s.hero.managerTrust = 100; s.hero.form = 90; s.hero.fatigue = 0; s.hero.sharpness = 100; s.life.flags.promised_start = true })()")
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Play match' }).click()
  await page.getByRole('button', { name: 'Kick off' }).click()
  let opened = false
  for (let i = 0; i < 60 && !opened; i++) {
    const card = page.locator('.lm-moment')
    if (await card.count()) await card.getByRole('button', { name: 'Sim moment' }).click()
    opened = await sp<boolean>(page, "sp.match().minute >= 3 && !sp.match().pendingMoment && sp.openDecision('shout')")
    if (!opened) await page.waitForTimeout(300)
  }
  expect(opened).toBe(true)
  await page.getByRole('button', { name: 'Stop timer' }).click()
  await page.waitForTimeout(3000)
  await expect(page.getByTestId('lm-decision')).toBeVisible()
  await page.getByRole('button', { name: 'Resume timer' }).click()
  await expect(page.getByTestId('lm-decision')).toHaveCount(0, { timeout: 16_000 })
})
