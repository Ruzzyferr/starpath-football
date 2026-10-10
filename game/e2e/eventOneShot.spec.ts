import type { Page } from '@playwright/test'
import { test, expect, assertCleanText, sp, startWithDecisionCard, waitForApp } from './fixtures'

/**
 * One-shot decision cards (owner bug, TestFlight build 7: "the wheel failed, then I could pick
 * the same option again and it worked"). A chance choice spins the wheel once, the result is
 * shown and the card is gone for good: no re-pick, no double tap, not after a reload. A certain
 * choice never spins and applies exactly the chips shown on its button.
 */
async function settingsInit(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('starpath.settings.v1', JSON.stringify({ lang: 'en', reducedMotion: false }))
    } catch {
      /* ignore */
    }
  })
}

const UID = 'e2e.tactics#1'

/** A fresh career with no other cards, then the tactics-dispute card (chance + certain choices) on top. */
async function startWithCard(page: Page): Promise<void> {
  await page.setViewportSize({ width: 390, height: 844 })
  await settingsInit(page)
  await startWithDecisionCard(page, 4242, UID)
}

const pendingUids = (page: Page) => sp<string[]>(page, `sp.state().pendingEvents.map((p) => p.uid ?? p.defId)`)

test('chance choice: one spin, one result, card gone; no re-pick, no double tap, not after reload', async ({ page, shot }) => {
  await startWithCard(page)
  const modal = page.locator('.modal-root')
  const chance = modal.locator('.evt-choice[data-kind="chance"]:not([disabled])').first()
  await expect(chance).toBeVisible()
  await expect(chance.locator('.evt-odds b')).toContainText('%')
  // Double tap (the second tap must do nothing).
  await chance.dblclick()
  const wheel = modal.getByTestId('odds-wheel')
  await expect(wheel).toBeVisible()
  // Committed at the roll: the card is out of the queue while the wheel is still spinning.
  expect(await pendingUids(page)).not.toContain(UID)
  expect(await sp<boolean>(page, `JSON.parse(sp.state().life.flags['ev:done'] || '[]').includes('${UID}')`)).toBe(true)
  await expect(wheel).toHaveAttribute('data-tier', /success|mixed|fail/, { timeout: 6000 })
  const out = modal.getByTestId('evt-outcome')
  await expect(out).toBeVisible({ timeout: 4000 })
  const tier = await out.getAttribute('data-tier')
  expect(['success', 'mixed', 'fail']).toContain(tier)
  // A real, concrete effect is shown.
  expect(await out.locator('.evt-outcome-deltas .evt-pop').count()).toBeGreaterThan(0)
  await expect(modal.locator('.evt-choice')).toHaveCount(0)
  await expect(modal.locator('.evt-later')).toHaveCount(0)
  await assertCleanText(page)
  await page.waitForTimeout(900)
  await shot('oneshot-chance-result')
  await out.getByRole('button').click()
  await expect(modal).toHaveCount(0)

  // The same card cannot be answered again through the action either.
  const again = await sp<{ already?: boolean }>(page, `sp.actions.resolveEvent('${UID}', 0)`)
  expect(again.already).toBe(true)
  expect(await sp<number>(page, `JSON.parse(sp.state().life.flags['ev:done'] || '[]').filter((k) => k === '${UID}').length`)).toBe(1)

})

test('reload with real storage: an answered card never comes back', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await settingsInit(page)
  await page.goto('/?autostart=1&seed=4243')
  await waitForApp(page)
  await expect(page.locator('.home-grid')).toBeVisible()
  await sp(page, 'sp.clearEvents()')
  if (await page.locator('.modal-root').count()) await page.keyboard.press('Escape')
  await sp(page, `(() => {
    const s = sp.state()
    s.pendingEvents.length = 0
    s.pendingEvents.push({ defId: 'manager.tactics_dispute', vars: { managerName: 'Coach Demir' }, firedAt: { ...s.calendar }, uid: 'e2e.reload#1' })
    sp.touch()
  })()`)
  const modal = page.locator('.modal-root')
  await expect(modal.locator('.evt-card')).toBeVisible()
  await modal.locator('.evt-choice[data-kind="chance"]:not([disabled])').first().click()
  // Kill the app mid-spin: the decision was saved at the roll.
  await expect(modal.getByTestId('odds-wheel')).toBeVisible()
  await expect.poll(async () => sp<boolean>(page, `sp.refreshSlots().then(() => sp.state().pendingEvents.length === 0)`), { timeout: 5000 }).toBe(true)
  await sp(page, 'sp.flushAutosave()')
  await page.goto('/')
  await waitForApp(page)
  await page.locator('.title-continue').click()
  await expect(page.locator('.home-grid')).toBeVisible()
  expect(await pendingUids(page)).not.toContain('e2e.reload#1')
  expect(await sp<boolean>(page, `JSON.parse(sp.state().life.flags['ev:done'] || '[]').includes('e2e.reload#1')`)).toBe(true)
  await page.waitForTimeout(300)
  expect(await page.locator('.modal-root .evt-card').count()).toBe(0)
})

test('certain choice: no wheel, the fixed result shown on the button is applied', async ({ page, shot }) => {
  await startWithCard(page)
  const modal = page.locator('.modal-root')
  const certain = modal.locator('.evt-choice[data-kind="certain"]:not([disabled])').first()
  await expect(certain).toBeVisible()
  await expect(certain.locator('.evt-odds')).toContainText('Certain')
  const chips = await certain.locator('.delta-chip').count()
  expect(chips).toBeGreaterThan(0)
  await page.waitForTimeout(300)
  await shot('oneshot-certain-card')
  await certain.click()
  await expect(modal.getByTestId('odds-wheel')).toHaveCount(0)
  const out = modal.getByTestId('evt-outcome')
  await expect(out).toBeVisible({ timeout: 1000 })
  await expect(out).toHaveAttribute('data-tier', 'certain')
  await expect(out.getByTestId('roll-strip')).toHaveCount(0)
  const shown = await out.locator('.evt-outcome-deltas .evt-pop').count()
  expect(shown).toBeGreaterThan(0)
  expect(shown).toBe(chips)
  expect(await pendingUids(page)).not.toContain(UID)
  await assertCleanText(page)
  await page.waitForTimeout(900)
  await shot('oneshot-certain-result')
})
