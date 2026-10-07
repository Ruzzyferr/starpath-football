import { test, expect, preferEnglish, assertCleanText, waitForApp, sp } from './fixtures'

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

test('pre-match expected moments, then the step-by-step post-match flow', async ({ page, shot }) => {
  await page.goto('/?autostart=1&seed=4242')
  await waitForApp(page)
  await sp(page, 'sp.toMatchday()')
  // Make sure the hero starts (selection is a roll since trials/merit roles; this test needs minutes).
  await sp(page, "(() => { const s = sp.state(); s.hero.contract.role = 'captain'; s.hero.managerTrust = 100; s.hero.form = 90; s.hero.fatigue = 0; s.hero.sharpness = 100; s.life.flags.promised_start = true })()")
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Play match' }).click()
  await expect(page.getByRole('button', { name: 'Kick off' })).toBeVisible()

  // Pre-match: expected moments preview.
  const em = page.getByTestId('pm-expected-moments')
  await expect(em).toBeVisible()
  await expect(em).toContainText(/Expected moments/)
  await expect(em).toContainText(/\d+(–\d+)? moments/)
  await assertCleanText(page)
  await shot('pm1-expected-moments')

  await page.getByRole('button', { name: 'Kick off' }).click()
  await expect(page.locator('.lm-root')).toBeVisible()
  const card = page.locator('.lm-moment')
  for (let i = 0; i < 20; i++) {
    if (await card.count()) await card.getByRole('button', { name: 'Sim moment' }).click()
    const simBtn = page.getByRole('button', { name: 'Sim to the end' })
    if (await simBtn.isEnabled().catch(() => false)) {
      await simBtn.click()
      break
    }
    await page.waitForTimeout(200)
  }
  await expect(page.locator('.lm-fulltime')).toBeVisible({ timeout: 30_000 })
  await page.locator('.lm-fulltime').getByRole('button', { name: 'Continue' }).click()

  // Step 1: result with the rating ring.
  const root = page.locator('.post-root')
  await expect(root).toHaveAttribute('data-step', 'result')
  await expect(page.locator('.post-rating-num')).toHaveText(/^\d{1,2}(\.\d)?$/)
  await expect(page.getByTestId('post-skip')).toBeVisible()
  await assertCleanText(page)

  // Walk every step with Next.
  const seen: string[] = ['result']
  for (let i = 0; i < 8; i++) {
    const next = page.getByTestId('post-next')
    if (!(await next.count())) break
    await next.click()
    const step = (await root.getAttribute('data-step')) ?? ''
    seen.push(step)
    await page.waitForTimeout(300)
    await assertCleanText(page)
    if (step === 'rating') {
      await expect(page.getByTestId('post-rating-final')).toBeVisible()
      await expect(page.getByTestId('post-rating-group-moment').or(page.getByText('No detailed breakdown'))).toBeVisible()
      await page.waitForTimeout(1500) // count-up
      const final = await page.getByTestId('post-rating-final').locator('b').innerText()
      expect(final).toMatch(/^\d{1,2}(\.\d)?$/)
    }
    if (step === 'map') {
      await expect(page.getByTestId('post-heatmap').locator('svg')).toBeVisible()
      await expect(page.getByTestId('post-shotmap').locator('svg')).toBeVisible()
    }
    if (step === 'trust') await expect(page.getByTestId('post-trust-delta')).toHaveText(/^[+−±]\d+(\.\d+)?$/)
    await shot(`pm2-step-${step}`)
  }
  expect(seen[0]).toBe('result')
  expect(seen).toContain('rating')
  expect(seen[seen.length - 1]).toBe('interview')

  // Back to the start via the stepper, then "Skip all" lands on the summary.
  await page.getByTestId('post-step-result').click()
  await expect(root).toHaveAttribute('data-step', 'result')
  await page.keyboard.press('ArrowRight')
  await expect(root).not.toHaveAttribute('data-step', 'result')
  await page.keyboard.press('ArrowLeft')
  await expect(root).toHaveAttribute('data-step', 'result')
  await page.getByTestId('post-skip').click()
  await expect(root).toHaveAttribute('data-step', 'interview')
  await expect(page.getByTestId('post-skip')).toHaveCount(0)
  const iv = page.getByTestId('post-interview')
  if (await iv.count()) {
    await iv.locator('.post-iv-opt').first().click()
    await expect(iv.locator('.post-iv-done')).toBeVisible()
  }
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.locator('.post-root')).toHaveCount(0)
})
