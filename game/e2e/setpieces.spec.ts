/**
 * Set-piece choices on the demo page (GAP-AUDIT 2.1#95 / #97): the corner
 * picker (zone, height, curl) and the wall picker (count, shift), driven by
 * keyboard on desktop and by taps on mobile; the moment then plays out.
 */
import type { Page } from '@playwright/test'
import { test, expect, assertCleanText } from './fixtures'

type Dbg = {
  __spScene: {
    debugInfo(): {
      phase: string
      pendingChoice: 'corner' | 'wall' | null
      cornerChoice: { zone: string; height: string; curl: string } | null
      wallChoice: { count: number; nudge: number } | null
      wall: number
    }
  }
}

async function open(page: Page, query: string): Promise<void> {
  await page.goto(`/match-demo.html?${query}`)
  await page.waitForFunction(() => !!(window as unknown as { __spScene?: unknown }).__spScene, undefined, { timeout: 30_000 })
  await page.waitForFunction(() => (window as unknown as Dbg).__spScene.debugInfo().pendingChoice !== null, undefined, { timeout: 20_000 })
}

const info = (page: Page) => page.evaluate(() => (window as unknown as Dbg).__spScene.debugInfo())

test('corner: pick zone, height and curl, then the delivery plays out', async ({ page, isMobile, shot }) => {
  await open(page, 'kind=corner_kick&seed=4')
  const picker = page.getByTestId('corner-picker')
  await expect(picker).toBeVisible()
  await expect(picker.getByRole('button', { name: 'Near post' })).toBeVisible()
  await shot('setpiece-corner-picker')
  if (isMobile) {
    await picker.getByRole('button', { name: 'Floated' }).tap()
    await expect(picker.getByRole('button', { name: 'Driven' })).toBeVisible()
    await picker.getByRole('button', { name: 'Inswinger' }).tap()
    await picker.getByRole('button', { name: 'Near post' }).tap()
  } else {
    await page.keyboard.press('KeyZ')
    await page.keyboard.press('KeyX')
    await page.keyboard.press('Digit1')
  }
  await expect(picker).toHaveCount(0)
  const d = await info(page)
  expect(d.pendingChoice).toBeNull()
  expect(d.cornerChoice).toEqual({ zone: 'near', height: 'driven', curl: 'out' })
  await expect(page.locator('#result')).toHaveText(/^corner_kick: (ASSIST|GOAL|CLEARED|PASS_COMPLETE|SAVED|MISSED|BLOCKED|WOODWORK|LOST_BALL|FOUL_WON|FOUL_COMMITTED|TIMEOUT) \(/, { timeout: 60_000 })
})

test('wall: set five men and shift it, the free kick follows', async ({ page, isMobile, shot }) => {
  await open(page, 'kind=fk_wall&seed=2')
  const picker = page.getByTestId('wall-picker')
  await expect(picker).toBeVisible()
  await expect(picker).toHaveAttribute('data-count', '4')
  if (isMobile) {
    await picker.getByRole('button', { name: 'One more' }).tap()
    await expect(picker).toHaveAttribute('data-count', '5')
    expect((await info(page)).wall).toBe(5) // live preview on the pitch
    await picker.getByRole('button', { name: 'Shift wall' }).first().tap()
    await shot('setpiece-wall-picker')
    await picker.getByRole('button', { name: 'Set wall' }).tap()
  } else {
    await page.keyboard.press('ArrowUp')
    await expect(picker).toHaveAttribute('data-count', '5')
    expect((await info(page)).wall).toBe(5)
    await page.keyboard.press('ArrowLeft')
    await shot('setpiece-wall-picker')
    await page.keyboard.press('Space')
  }
  await expect(picker).toHaveCount(0)
  const d = await info(page)
  expect(d.wallChoice?.count).toBe(5)
  expect(Math.abs(d.wallChoice?.nudge ?? 0)).toBe(0.5)
  await expect(page.locator('#result')).toHaveText(/^fk_wall: (DEFENDED|CONCEDED|FOUL_COMMITTED) \(/, { timeout: 60_000 })
})

test('captain in the wall, Turkish picker text', async ({ page }) => {
  await open(page, 'kind=fk_wall&seed=3&hero=CB&lang=tr')
  const picker = page.getByTestId('wall-picker')
  await expect(picker).toContainText('BARAJI KUR')
  await expect(picker).toContainText('4 oyuncu')
  await assertCleanText(page)
  await picker.getByRole('button', { name: 'Barajı onayla' }).click()
  await expect(picker).toHaveCount(0)
  await expect(page.locator('#result')).toHaveText(/^fk_wall: [A-Z_]+ \(/, { timeout: 60_000 })
})
