/** WP-27 UI: undo toast (2.7#48), "Why?" panel (2.7#83), low meter warning (2.7#43). */
import AxeBuilder from '@axe-core/playwright'
import { test, expect, preferEnglish, sp, waitForApp } from './fixtures'

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

test('clearing a planned slot offers a 6 second undo that restores it', async ({ page, shot }) => {
  await page.goto('/?autostart=1&seed=88')
  await waitForApp(page)
  await sp(page, `sp.navigate('planner')`)
  const body = page.locator('.plan-slot-body:not([disabled])').first()
  await body.click()
  await page.locator('.plan-picker .plan-act:not([disabled])').first().click()
  const name = await page.locator('.plan-slot-act').first().innerText()
  await body.click()
  await page.getByRole('button', { name: /Clear/i }).click()
  await expect(page.locator('.plan-slot-act')).toHaveCount(0)
  const undo = page.getByTestId('toast-action')
  await expect(undo).toBeVisible()
  await page.waitForTimeout(600)
  await shot('w27-undo')
  await undo.click()
  await expect(page.locator('.plan-slot-act').first()).toHaveText(name)
})

test('profile "Why?" panel lists at most three factors', async ({ page, shot }) => {
  await page.goto('/?autostart=1&seed=88')
  await waitForApp(page)
  await sp(page, `sp.navigate('profile')`)
  const card = page.getByTestId('why-playing')
  await card.scrollIntoViewIfNeeded()
  await page.getByTestId('why-toggle').click()
  const n = await card.locator('li').count()
  expect(n).toBeGreaterThan(0)
  expect(n).toBeLessThanOrEqual(3)
  await page.waitForTimeout(800)
  await shot('w27-why')
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([])
})

test('profile shows finance donuts after a few weeks', async ({ page, shot }) => {
  await page.goto('/?autostart=1&seed=88')
  await waitForApp(page)
  await sp(page, `sp.toMatchday()`)
  await sp(page, `sp.navigate('profile')`)
  const card = page.getByTestId('finance-charts')
  await card.scrollIntoViewIfNeeded()
  await expect(card.locator('.donut')).toHaveCount(2)
  await card.locator('.donut-row').first().click()
  await page.waitForTimeout(1200)
  await shot('w27-finance')
})

const LIGHT_SCREENS = ['home', 'planner', 'training', 'profile', 'club', 'world', 'contract', 'life', 'inbox', 'menu', 'settings', 'trophies', 'board', 'whatsNew']

test('light theme: AA contrast on the main screens', async ({ page, shot }) => {
  await page.addInitScript(() => localStorage.setItem('starpath.settings.v1', JSON.stringify({ lang: 'en', vibration: false, theme: 'light' })))
  await page.goto('/?autostart=1&seed=88')
  await waitForApp(page)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  const bad: string[] = []
  for (const id of LIGHT_SCREENS) {
    await sp(page, `sp.navigate('${id}')`)
    await page.waitForTimeout(700)
    if (id === 'home' || id === 'profile' || id === 'settings') await shot(`w27-light-${id}`)
    const res = await new AxeBuilder({ page }).withTags(['wcag2aa']).analyze()
    for (const v of res.violations.filter((x) => x.id === 'color-contrast')) bad.push(`${id}: ${v.nodes.slice(0, 4).map((n) => n.target.join(' ')).join(' | ')}`)
  }
  expect(bad).toEqual([])
})

test('hub reaches core screens within two taps (2.7#23)', async ({ page }) => {
  await page.goto('/?autostart=1&seed=88')
  await waitForApp(page)
  // One tap from the hub: home tiles.
  for (const id of ['planner', 'training', 'life', 'contract', 'club', 'inbox', 'world']) {
    await sp(page, `sp.navigate('home')`)
    await page.locator(`[data-tour="tile-${id}"]`).click()
    expect(await sp<string>(page, `sp.screen().id`), id).toBe(id)
  }
  // Two taps: Menu tab, then a tile (order: saves, settings, trophies, ...).
  const tiles: [number, string][] = [[0, 'saves'], [1, 'settings'], [2, 'trophies']]
  for (const [i, id] of tiles) {
    await sp(page, `sp.navigate('menu')`)
    await page.locator('.menu-tile:not(.menu-tile-wide)').nth(i).click()
    expect(await sp<string>(page, `sp.screen().id`), id).toBe(id)
  }
})

test('planner shows the 7-day strip and keyboard shortcuts work (2.7#24, #31)', async ({ page }) => {
  await page.goto('/?autostart=1&seed=88')
  await waitForApp(page)
  await sp(page, `sp.navigate('planner')`)
  await expect(page.locator('.plan-day')).toHaveCount(7)
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('?')
  await expect(page.getByTestId('shortcuts-list')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('shortcuts-list')).toHaveCount(0)
  await page.keyboard.press('t')
  expect(await sp<string>(page, `sp.screen().id`)).toBe('training')
  await page.keyboard.press('i')
  expect(await sp<string>(page, `sp.screen().id`)).toBe('inbox')
})

test('sparkline reads a value on tap (2.7#56)', async ({ page }) => {
  await page.goto('/?autostart=1&seed=88')
  await waitForApp(page)
  await sp(page, `sp.toMatchday()`)
  await sp(page, `sp.navigate('home')`)
  const spark = page.locator('.sparkline').first()
  if (await spark.count()) {
    await spark.focus()
    await page.keyboard.press('ArrowLeft')
    await expect(page.locator('.sparkline-read').first()).toBeVisible()
  }
})
