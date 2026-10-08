/**
 * Career end & career start (WP-7 / WP-8):
 *  - achievement unlock toast,
 *  - retire flow → documentary → Hall of Fame entry → Legacy new game,
 *  - trials at career start (wizard switch → invitations → signed).
 */
import type { Page } from '@playwright/test'
import { test, expect, preferEnglish, assertCleanText, sp, waitForApp } from './fixtures'

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

/** Walk the wizard (identity already filled by the caller) to the summary step. */
async function wizardToSummary(page: Page): Promise<void> {
  const next = page.locator('.wiz-foot').getByRole('button', { name: /^Next/ })
  await next.click() // → nation
  await page.locator('.wiz-flag').first().click()
  await next.click() // → position
  await next.click() // → archetype
  await page.locator('.wiz-card').nth(2).click()
  await next.click() // → background
  await page.locator('.wiz-story').first().click()
  await next.click() // → look
  await next.click() // → summary
  await expect(page.locator('.wiz-summary')).toBeVisible()
}

test('an achievement unlock shows a toast and lands on the achievements screen', async ({ page, shot }) => {
  await page.goto('/?autostart=1&seed=314')
  await waitForApp(page)
  await sp(page, `sp.actions.planSlot(0, null)`)
  await expect(page.locator('.toast-reward').first()).toContainText('🏆', { timeout: 10_000 })
  await shot('l1-toast')
  await sp(page, `sp.navigate('achievements')`)
  await expect(page.locator('.ach-card[data-unlocked="1"]').first()).toBeVisible()
  const n = await page.locator('.ach-card').count()
  expect(n).toBeGreaterThanOrEqual(60)
  await assertCleanText(page)
  await shot('l2-achievements')
})

test('unlock toasts are held back during the match flow and shown afterwards', async ({ page }) => {
  // No user gesture in this headless flow: keep haptics off (the browser blocks vibrate() before a tap).
  await page.addInitScript(() => localStorage.setItem('starpath.settings.v1', JSON.stringify({ lang: 'en', vibration: false })))
  await page.goto('/?autostart=1&seed=315&dev=postMatch')
  await waitForApp(page)
  await expect(page.locator('#main')).toBeVisible()
  expect(await sp<string>(page, `sp.screen().id`)).toBe('postMatch')
  // Let toasts from before the match expire, then unlock "50 goals" on the post-match screen.
  await expect(page.locator('.toast-reward')).toHaveCount(0, { timeout: 12_000 })
  await sp(page, `(() => { sp.state().hero.careerStats.goals = 50; sp.actions.planSlot(0, null) })()`)
  expect(await sp<number>(page, `sp.meta.queuedToasts.value.length`)).toBeGreaterThan(0)
  await expect(page.locator('.toast-reward')).toHaveCount(0)
  await sp(page, `sp.navigate('home', undefined, { tab: true })`)
  await expect(page.locator('.toast-reward').first()).toContainText('🏆', { timeout: 10_000 })
  expect(await sp<number>(page, `sp.meta.queuedToasts.value.length`)).toBe(0)
})

test('retire → documentary → Hall of Fame → legacy career as the child', async ({ page, shot }) => {
  await page.goto('/?autostart=1&seed=2718')
  await waitForApp(page)
  // A 35-year-old veteran (any-time retirement from 33).
  await sp(page, `(() => { const s = sp.state(); s.hero.birthYear = s.calendar.season - 35; sp.actions.planSlot(0, null); sp.navigate('profile', undefined, { tab: true }) })()`)
  await page.getByTestId('profile-retire').click()
  await expect(page.getByTestId('retire-card')).toBeVisible()
  await shot('l3-retire')
  await page.getByTestId('retire-go').click()
  await page.getByTestId('retire-confirm').click()

  await expect(page.getByTestId('documentary')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('legacy-score')).not.toHaveText('')
  await assertCleanText(page)
  await shot('l4-documentary')
  expect(await sp<boolean>(page, `sp.state().hero.retired`)).toBe(true)

  await page.getByRole('button', { name: 'Hall of Fame' }).click()
  await expect(page.locator('.hof-row')).toHaveCount(1)
  await expect(page.locator('.hof-row')).toContainText('Arda Yıldız')
  await shot('l5-hall-of-fame')
  // The Hall of Fame lives outside the save slots.
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('starpath.meta.v1') ?? '{}').hallOfFame?.length ?? 0)
  expect(stored).toBe(1)

  await page.locator('.hof-row').getByRole('button', { name: 'Start as their child' }).click()
  await expect(page.locator('#wiz-last')).toHaveValue('Yıldız')
  await page.locator('#wiz-first').fill('Mira')
  await wizardToSummary(page)
  await expect(page.locator('.wiz-summary')).toContainText('Arda Yıldız')
  await shot('l6-legacy-wizard')
  await page.getByRole('button', { name: 'Start career' }).click()
  await page.waitForFunction(() => {
    const w = window as unknown as { __sp?: { state(): { hero: { firstName: string } } | null } }
    return w.__sp?.state()?.hero.firstName === 'Mira'
  })
  const child = await sp<{ parent: unknown; perks: string[] }>(page, `({ parent: sp.state().life.flags['c:legacyParentId'], perks: sp.state().hero.perks })`)
  expect(typeof child.parent).toBe('string')
  expect(child.perks).toContain('famous_name')
})

test('a majority club owner retires: chairman-owner section in the documentary and a Hall of Fame badge', async ({ page, shot }) => {
  await page.goto('/?autostart=1&seed=2719')
  await waitForApp(page)
  await sp(page, `(() => { const s = sp.state(); s.hero.birthYear = s.calendar.season - 35; s.life.flags['proj:stake'] = 60; s.life.flags['proj:stakeClub'] = s.hero.contract.clubId; sp.actions.planSlot(0, null); sp.navigate('profile', undefined, { tab: true }) })()`)
  await page.getByTestId('profile-retire').click()
  await page.getByTestId('retire-go').click()
  await page.getByTestId('retire-confirm').click()
  await expect(page.getByTestId('documentary')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('doc-owner')).toBeVisible()
  await expect(page.getByTestId('doc-owner-headline')).toContainText('Majority owner')
  await expect(page.getByTestId('doc-owner-epilogue')).toContainText('60%')
  await assertCleanText(page)
  await shot('l4b-documentary-owner')
  await page.getByRole('button', { name: 'Hall of Fame' }).click()
  await expect(page.getByTestId('hof-owner')).toContainText('Club owner')
  await shot('l5b-hall-of-fame-owner')
})

test('trials at career start: pick an invitation, sign, play on', async ({ page, shot }) => {
  await page.goto('/')
  await waitForApp(page)
  await page.getByRole('button', { name: 'New career' }).click()
  await page.locator('#wiz-first').fill('Ece')
  await page.locator('#wiz-last').fill('Demir')
  await wizardToSummary(page)
  await page.locator('label.switch-row', { hasText: 'Start with trials' }).locator('input').check()
  await page.getByRole('button', { name: 'Start career' }).click()

  await expect(page.getByTestId('trials')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.trial-card')).toHaveCount(3)
  await assertCleanText(page)
  await shot('l7-trials')
  expect(await sp<unknown>(page, `sp.state().hero.contract`)).toBeNull()
  await page.getByTestId('trial-sim-academy').click()
  await expect(page.getByTestId('trial-result')).toContainText('Contract signed')
  await shot('l8-trial-signed')
  await page.getByTestId('trial-continue').click()
  await expect(page.locator('.home-grid')).toBeVisible({ timeout: 30_000 })
  expect(await sp<string>(page, `sp.state().hero.contract.role`)).toBe('youth')
})
