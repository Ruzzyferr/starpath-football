import type { Page } from '@playwright/test'
import { test, expect, preferEnglish, assertCleanText, waitForApp, sp } from './fixtures'

interface Snap {
  name: string
  season: number
  week: number
  day: number
  slot: number
  money: number
}

const snap = (page: Page) =>
  sp<Snap>(page, `(() => { const s = sp.state(); return { name: s.hero.firstName + ' ' + s.hero.lastName, season: s.calendar.season, week: s.calendar.week, day: s.calendar.day, slot: s.calendar.slot, money: s.life.money } })()`)

async function startAndPlayADay(page: Page): Promise<Snap> {
  await page.goto('/?autostart=1&seed=4242')
  await waitForApp(page)
  await expect(page.locator('.home-grid')).toBeVisible()
  await sp(page, 'sp.clearEvents()')
  await page.keyboard.press('Escape')
  const before = await snap(page)
  // Play a full day through the UI (three time slots).
  for (let i = 0; i < 3; i++) {
    await sp(page, 'sp.clearEvents()')
    if (await page.locator('.modal-root').count()) await page.keyboard.press('Escape')
    await page.locator('.home-cta-main').click()
    await page.waitForTimeout(150)
  }
  await sp(page, 'sp.clearEvents()')
  if (await page.locator('.modal-root').count()) await page.keyboard.press('Escape')
  const after = await snap(page)
  expect(after.day * 3 + after.slot + after.week * 21).toBeGreaterThan(before.day * 3 + before.slot + before.week * 21)
  return after
}

async function saveToSlot(page: Page, slot: number): Promise<void> {
  await sp(page, `sp.navigate('saves')`)
  const card = page.locator('.saves-card').nth(slot - 1)
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: /Save here|Overwrite/ }).click()
  if (await page.locator('.modal-root').getByRole('button', { name: 'Overwrite' }).count()) {
    await page.locator('.modal-root').getByRole('button', { name: 'Overwrite' }).click()
  }
  await expect(card).not.toHaveClass(/is-empty/)
}

async function loadFromTitle(page: Page, slot: number, expected: Snap, shot: (n: string) => Promise<void>, tag: string) {
  await page.goto('/')
  await waitForApp(page)
  await expect(page.locator('.title-screen')).toBeVisible()
  await page.getByRole('button', { name: 'Load game' }).or(page.locator('.title-item').nth(1)).first().click()
  const card = page.locator('.saves-card').nth(slot - 1)
  await expect(card).toContainText(expected.name)
  await assertCleanText(page)
  await shot(`${tag}-saves-before-load`)
  await card.getByRole('button', { name: 'Load' }).click()
  await expect(page.locator('.home-grid')).toBeVisible()
  const got = await snap(page)
  expect(got).toEqual(expected)
  await expect(page.locator('.home-cardteaser-info')).toContainText(expected.name)
  await shot(`${tag}-loaded-home`)
}

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

test('save / load with real IndexedDB + autosave', async ({ page, shot }) => {
  const played = await startAndPlayADay(page)
  // Autosave: the active slot (1) is refreshed after advancing.
  await sp(page, 'sp.flushAutosave()')
  const slots = await sp<{ slot: number; empty: boolean; week?: number; heroName?: string }[]>(page, 'sp.refreshSlots()')
  expect(slots[0].empty).toBe(false)
  expect(slots[0].heroName).toBe(played.name)
  // Data really is in IndexedDB.
  const idbKeys = await page.evaluate(
    () =>
      new Promise<string[]>((res, rej) => {
        const r = indexedDB.open('starpath', 1)
        r.onsuccess = () => {
          const q = r.result.transaction('kv', 'readonly').objectStore('kv').getAllKeys()
          q.onsuccess = () => res((q.result as IDBValidKey[]).map(String))
          q.onerror = () => rej(q.error)
        }
        r.onerror = () => rej(r.error)
      }),
  )
  expect(idbKeys.length).toBeGreaterThan(0)

  await saveToSlot(page, 2)
  await shot('b1-saved')
  const expected = await snap(page)
  await loadFromTitle(page, 2, expected, shot, 'b2')
})

test('save / load through the localStorage fallback when IndexedDB is broken', async ({ page, shot }) => {
  await page.addInitScript(() => {
    // Simulate a WebView whose IndexedDB refuses to open.
    Object.defineProperty(IDBFactory.prototype, 'open', {
      configurable: true,
      value() {
        throw new DOMException('blocked for test', 'InvalidStateError')
      },
    })
  })
  await startAndPlayADay(page)
  await saveToSlot(page, 3)
  const expected = await snap(page)
  const lsKeys = await page.evaluate(() => Object.keys(localStorage).filter((k) => !k.startsWith('starpath.settings')))
  expect(lsKeys.length).toBeGreaterThan(0)
  await loadFromTitle(page, 3, expected, shot, 'b3-ls')
})
