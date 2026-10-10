import type { Page } from '@playwright/test'
import { test, expect, preferEnglish, waitForApp, sp } from './fixtures'

/**
 * Autosave (TestFlight build 4 feedback: "Otomatik kayıt yapılacak"): advancing a day
 * saves the active slot without any manual action, the app going to the background
 * saves at once, and "Continue" on the next launch resumes the latest autosave.
 */
interface Snap {
  name: string
  week: number
  day: number
  slot: number
  money: number
}

const snap = (page: Page) =>
  sp<Snap>(page, `(() => { const s = sp.state(); return { name: s.hero.firstName + ' ' + s.hero.lastName, week: s.calendar.week, day: s.calendar.day, slot: s.calendar.slot, money: s.life.money } })()`)

async function start(page: Page): Promise<void> {
  await page.goto('/?autostart=1&seed=5151')
  await waitForApp(page)
  await expect(page.locator('.home-grid')).toBeVisible()
  await sp(page, 'sp.clearEvents()')
  if (await page.locator('.modal-root').count()) await page.keyboard.press('Escape')
}

async function advanceOnce(page: Page): Promise<void> {
  await sp(page, 'sp.clearEvents()')
  if (await page.locator('.modal-root').count()) await page.keyboard.press('Escape')
  await page.locator('.home-cta-main').click()
  await page.waitForTimeout(150)
  await sp(page, 'sp.clearEvents()')
  if (await page.locator('.modal-root').count()) await page.keyboard.press('Escape')
}

async function continueFromTitle(page: Page, expected: Snap): Promise<void> {
  await page.goto('/')
  await waitForApp(page)
  await expect(page.locator('.title-screen')).toBeVisible()
  const cont = page.locator('.title-continue')
  await expect(cont).toBeEnabled()
  await expect(cont).toContainText(expected.name)
  await cont.click()
  await expect(page.locator('.home-grid')).toBeVisible()
  expect(await snap(page)).toEqual(expected)
}

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

test('autosave after advancing time → reload → Continue resumes it', async ({ page, shot }) => {
  await start(page)
  // The new career's first save lands first.
  await expect.poll(async () => (await sp<{ empty: boolean }[]>(page, 'sp.refreshSlots()'))[0]?.empty, { timeout: 10_000 }).toBe(false)
  const t0 = (await sp<{ updatedAt?: number }[]>(page, 'sp.refreshSlots()'))[0]?.updatedAt ?? 0
  const before = await snap(page)
  await advanceOnce(page)
  const after = await snap(page)
  expect(after.day * 3 + after.slot + after.week * 21).toBeGreaterThan(before.day * 3 + before.slot + before.week * 21)
  // No manual save: the debounced autosave rewrites the active slot and shows the subtle badge.
  await expect.poll(async () => (await sp<{ updatedAt?: number }[]>(page, 'sp.refreshSlots()'))[0]?.updatedAt ?? 0, { timeout: 10_000 }).toBeGreaterThan(t0)
  await expect(page.getByTestId('save-indicator')).toHaveAttribute('data-phase', 'saved')
  await expect(page.getByTestId('save-indicator')).toContainText('Saved')
  await shot('autosave-indicator')
  await continueFromTitle(page, after)
  await shot('autosave-continued')
})

test('app going to the background saves immediately (no debounce wait)', async ({ page }) => {
  await start(page)
  // Let the initial save settle, then change the career without scheduling an autosave.
  await expect(page.getByTestId('save-indicator')).toHaveAttribute('data-phase', 'saved', { timeout: 10_000 })
  await sp(page, `(() => { const s = sp.state(); s.life.money += 12345; sp.touch() })()`)
  const expected = await snap(page)
  // Capacitor App pause / appStateChange and visibilitychange all surface as sp:app-pause.
  await page.evaluate(() => window.dispatchEvent(new Event('sp:app-pause')))
  await expect
    .poll(async () => sp<number | undefined>(page, `sp.refreshSlots().then((s) => s[0].money)`), { timeout: 10_000 })
    .toBe(expected.money)
  await continueFromTitle(page, expected)
})

test('autosave can be switched off in Settings (manual save still works)', async ({ page }) => {
  await start(page)
  await expect(page.getByTestId('save-indicator')).toHaveAttribute('data-phase', 'saved', { timeout: 10_000 })
  const savedWeekDay = await snap(page)
  await sp(page, `sp.navigate('settings')`)
  const sw = page.getByRole('switch', { name: /Autosave/ })
  await expect(sw).toBeChecked()
  await sw.click()
  await expect(sw).not.toBeChecked()
  await sp(page, `sp.navigate('home')`)
  await advanceOnce(page)
  await page.waitForTimeout(2500)
  await page.evaluate(() => window.dispatchEvent(new Event('sp:app-pause')))
  await page.waitForTimeout(500)
  const slot = (await sp<{ week?: number; money?: number }[]>(page, 'sp.refreshSlots()'))[0]
  expect(slot.money).toBe(savedWeekDay.money)
  // Restore the default for other specs sharing the profile.
  await sp(page, `sp.navigate('settings')`)
  await page.getByRole('switch', { name: /Autosave/ }).click()
})
