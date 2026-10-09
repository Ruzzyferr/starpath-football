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

test('PT-F4: planner activity chips name the attributes a session trains', async ({ page, shot }) => {
  await page.goto('/?autostart=1&seed=778')
  await waitForApp(page)
  await sp(page, `(() => { sp.clearEvents(); sp.navigate('planner') })()`)
  await page.locator('button.plan-slot-body').first().click()
  const row = page.locator('.plan-picker button.plan-act', { hasText: 'Passing Drill' })
  await expect(row).toBeVisible()
  const labels = await row.locator('.delta-chip.is-uncertain .delta-label').allInnerTexts()
  expect(labels.length).toBeGreaterThan(0)
  expect(labels.join(' ')).toMatch(/Passing/)
  // The "+n more" overflow chip says so in words instead of looking like a stat.
  for (const t of await page.locator('.plan-picker .delta-more').allInnerTexts()) expect(t).toMatch(/more/)
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
