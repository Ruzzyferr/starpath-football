/**
 * UI playtest regressions (docs/PLAYTEST-UI.md): every P0/P1 the hands-on
 * playtest found and fixed gets a guard here.
 */
import type { Page } from '@playwright/test'
import { test, expect, preferEnglish, assertCleanText, sp, waitForApp } from './fixtures'

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

/** Wizard with defaults up to the summary, trials left ON (the default). */
async function wizardWithTrials(page: Page): Promise<void> {
  await page.goto('/')
  await waitForApp(page)
  await page.getByRole('button', { name: 'New career' }).click()
  await page.locator('#wiz-first').fill('Ece')
  await page.locator('#wiz-last').fill('Demir')
  const next = page.locator('.wiz-foot').getByRole('button', { name: /^Next/ })
  for (let i = 0; i < 6; i++) await next.click()
  await expect(page.locator('.wiz-summary')).toBeVisible()
  await expect(page.locator('label.switch-row', { hasText: 'Start with trials' }).locator('input')).toBeChecked()
  await page.getByRole('button', { name: 'Start career' }).click()
  await expect(page.getByTestId('trials')).toBeVisible({ timeout: 30_000 })
}

/** Simulated notch / home indicator the way Capacitor feeds them. */
async function withInsets(page: Page, top = 47, bottom = 34): Promise<void> {
  await page.addInitScript(({ top, bottom }) => {
    const apply = () => {
      document.documentElement.style.setProperty('--safe-area-inset-top', `${top}px`)
      document.documentElement.style.setProperty('--safe-area-inset-bottom', `${bottom}px`)
    }
    if (document.documentElement) apply()
    else new MutationObserver((_, mo) => { if (document.documentElement) { apply(); mo.disconnect() } }).observe(document, { childList: true })
  }, { top, bottom })
}

test('PT-F6: the trial drill opens on a how-to card (goal, controls, target) before the countdown', async ({ page, shot }) => {
  await withInsets(page)
  await wizardWithTrials(page)
  const card = page.locator('.trial-card').filter({ has: page.getByText(/Target:/) }).first()
  await card.getByRole('button', { name: 'Play the trial' }).click()
  const intro = page.getByTestId('trial-intro')
  await expect(intro).toBeVisible()
  await expect(intro).toContainText(/Target: \d+%/)
  await expect(intro.locator('.trn-drill-controls > div')).toHaveCount(2)
  await expect(page.locator('.trn-drill canvas')).toHaveCount(0) // nothing runs yet
  await assertCleanText(page)
  await shot('pt-trial-intro')
  await page.getByTestId('trial-start').click()
  await expect(page.locator('.trn-drill canvas')).toBeVisible({ timeout: 20_000 })
  // PT-F1: the canvas (and its HUD) starts below the status-bar inset.
  const stage = await page.locator('.trn-drill-stage').boundingBox()
  expect(stage!.y).toBeGreaterThanOrEqual(46)
  const vh = page.viewportSize()!.height
  expect(stage!.y + stage!.height).toBeLessThanOrEqual(vh - 33)
  await shot('pt-trial-playing')
  await page.getByRole('button', { name: 'Quit' }).click()
  await expect(page.getByTestId('trial-drill')).toHaveCount(0)
  await expect(page.getByTestId('trials')).toBeVisible()
})

test('PT-F4: activity chips name the attributes a session trains', async ({ page, shot }) => {
  await page.goto('/?autostart=1&seed=778')
  await waitForApp(page)
  await sp(page, `(() => { sp.clearEvents(); sp.navigate('activities') })()`)
  const row = page.locator('.plan-catalog button.plan-act', { hasText: 'Passing Drill' })
  await expect(row).toBeVisible()
  const labels = await row.locator('.delta-chip.is-uncertain .delta-label').allInnerTexts()
  expect(labels.length).toBeGreaterThan(0)
  expect(labels.join(' ')).toMatch(/Passing/)
  // The "+n more" overflow chip says so in words instead of looking like a stat.
  for (const t of await page.locator('.plan-catalog .delta-more').allInnerTexts()) expect(t).toMatch(/more/)
  await shot('pt-planner-chips')
})

test('PT-F7: the training card and the drill intro quote the same XP range', async ({ page }) => {
  await page.goto('/?autostart=1&seed=314')
  await waitForApp(page)
  await sp(page, `(() => { sp.clearEvents(); const s = sp.state(); s.calendar.slot = 0; s.life.energy = 100; s.hero.fatigue = 0; s.hero.injury = null; sp.navigate('training') })()`)
  const card = page.locator('.trn-session', { hasText: 'Passing Drill' })
  const cardRange = (await card.innerText()).match(/(\d+)–(\d+) XP/)
  expect(cardRange).not.toBeNull()
  await expect(card.getByRole('button', { name: 'Auto (60%)' })).toBeVisible()
  await card.getByRole('button', { name: 'Play drill' }).click()
  const introRange = (await page.locator('.trn-drill-card').innerText()).match(/(\d+)–(\d+) XP/)
  expect(introRange?.[0]).toBe(cardRange![0])
})

test('PT-F10: a locked perk explains what it still needs', async ({ page, shot }) => {
  await page.goto('/?autostart=1&seed=314')
  await waitForApp(page)
  await sp(page, `(() => { sp.clearEvents(); sp.navigate('training') })()`)
  await page.getByRole('tab', { name: /Perk tree/i }).click()
  await page.locator('.trn-node.is-locked').first().click()
  await expect(page.getByTestId('perk-needs')).toBeVisible()
  await expect(page.getByTestId('perk-needs').locator('li').first()).toHaveText(/\S/)
  await shot('pt-perk-needs')
})

test('PT-L1: a closed casino refuses the spin without animating a fake result', async ({ page, shot }) => {
  await page.goto('/?autostart=1&seed=31337')
  await waitForApp(page)
  // Adult hero, Monday morning: the casino opens in the evening.
  await sp(page, `(() => { sp.clearEvents(); const s = sp.state(); s.hero.birthYear = s.calendar.season - 22; s.calendar.slot = 0; sp.navigate('roulette') })()`)
  await expect(page.getByTestId('casino-closed')).toBeVisible()
  const before = await sp<number>(page, 'sp.state().life.money')
  await page.getByRole('button', { name: 'Red', exact: true }).click()
  await page.getByRole('button', { name: /^Spin/ }).click()
  await expect(page.locator('.toast').filter({ hasText: /evening/ }).first()).toBeVisible()
  await page.waitForTimeout(600)
  await expect(page.locator('.rl-readout')).not.toContainText(/spinning|Net:/)
  expect(await sp<number>(page, 'sp.state().life.money')).toBe(before)
  await shot('pt-casino-closed')
})

test('PT-L2: the loan slider never offers more than the bank will lend, and previews rate and payment', async ({ page }) => {
  await page.goto('/?autostart=1&dev=casino&seed=31337')
  await waitForApp(page)
  await sp(page, `(() => { sp.clearEvents(); sp.navigate('life') })()`)
  await page.getByTestId('phone-app-bank').click()
  const limit = await page.evaluate(async () => {
    const s = (window as unknown as { __sp: { state: () => { life: { bank: { creditScore: number } } } } }).__sp.state()
    return s.life.bank.creditScore
  })
  expect(limit).toBeGreaterThan(0)
  const slider = page.getByRole('slider', { name: /Loan amount/ })
  if (await slider.count()) {
    const max = Number(await slider.getAttribute('aria-valuemax'))
    await expect(page.getByTestId('loan-preview')).toContainText(/APR · weekly payment/)
    // Take the maximum the slider offers: the bank must accept it (or the button is disabled with a reason shown).
    await slider.focus()
    await page.keyboard.press('End')
    const btn = page.getByRole('button', { name: 'Take a loan' })
    if (await btn.isEnabled()) {
      await btn.click()
      await expect(page.locator('.toast').filter({ hasText: /rejected|at most/ })).toHaveCount(0)
      expect(await sp<number>(page, 'sp.state().life.bank.loan?.principal ?? 0')).toBe(max)
    } else {
      await expect(page.getByTestId('loan-preview')).toContainText(/40%/)
    }
  } else {
    await expect(page.getByTestId('loan-none')).toBeVisible()
  }
})

test('PT-L3: a refused relationship interaction does not also toast success', async ({ page }) => {
  await page.goto('/?autostart=1&dev=casino&seed=31337')
  await waitForApp(page)
  await sp(page, `(() => { sp.clearEvents(); sp.navigate('life') })()`)
  await page.getByTestId('phone-app-relations').click()
  const person = page.locator('.life-person').first()
  await person.getByRole('button', { name: /^Call,/ }).click()
  await person.getByRole('button', { name: /^Dinner,/ }).click()
  await expect(page.locator('.toast').filter({ hasText: /already spent time/ }).first()).toBeVisible()
  await expect(page.locator('.toast').filter({ hasText: /^You spent time with/ })).toHaveCount(0)
})
