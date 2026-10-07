import { test, expect, preferEnglish, waitForApp, sp } from './fixtures'
import type { Page } from '@playwright/test'

/** Fast-forward from season 1 into the rollover (season-end review first, then plain advancing). */
async function rollOver(page: Page): Promise<void> {
  await sp(page, 'sp.toSeasonEnd()')
  await expect(page.locator('.se-root')).toBeVisible()
  const skip = page.locator('.se-skip')
  if (await skip.isVisible().catch(() => false)) await skip.click()
  await page.locator('.se-footer button:not([disabled])').click()
  await sp(
    page,
    `(() => { for (let i = 0; i < 700 && sp.state().calendar.season < 2027; i++) { sp.clearEvents(); sp.actions.advance() } return sp.state().calendar.season })()`,
  )
}

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

test.describe('trial flavor', () => {
  test('paywall at rollover, read-only on Not now, buy unlocks, restore re-grants', async ({ page, shot }) => {
    test.setTimeout(300_000)
    await page.goto('/?autostart=1&seed=2027&flavor=trial')
    await waitForApp(page)
    await rollOver(page)

    await expect(page.getByTestId('pw-buy')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('pw-buy')).toContainText('€')
    await shot('iap1-paywall')

    // Not now: read-only. The calendar refuses to move and sends us back to the paywall.
    await page.getByTestId('pw-notnow').click()
    await expect(page.getByTestId('pw-buy')).toHaveCount(0)
    const week = await sp<string>(page, 'JSON.stringify(sp.state().calendar)')
    await sp(page, 'sp.actions.advance()')
    await expect(page.getByTestId('pw-buy')).toBeVisible({ timeout: 15_000 })
    expect(await sp<string>(page, 'JSON.stringify(sp.state().calendar)')).toBe(week)
    // Save, trophies and Hall of Fame stay reachable.
    await page.getByTestId('pw-notnow').click()
    await sp(page, `sp.navigate('trophies')`)
    await expect(page.locator('body')).not.toContainText('Your career is paused: unlock')

    // Buy via the dev provider: the career continues.
    await sp(page, 'sp.actions.advance()')
    await page.getByTestId('pw-buy').click()
    await expect(page.getByTestId('pw-buy')).toHaveCount(0, { timeout: 15_000 })
    await sp(page, 'sp.actions.advance()')
    expect(await sp<string>(page, 'JSON.stringify(sp.state().calendar)')).not.toBe(week)
    await expect(page.getByTestId('pw-buy')).toHaveCount(0)

    // Lose the local record (reinstall), then restore from the "store account".
    await page.evaluate(() => localStorage.removeItem('starpath.entitlements.v1'))
    await page.reload()
    await waitForApp(page)
    await sp(page, `sp.navigate('settings')`)
    await expect(page.getByTestId('entitlement-list')).toContainText('No purchases yet')
    await page.getByTestId('restore-btn').click()
    await expect(page.getByTestId('entitlement-list')).toContainText('Full Career')
    await shot('iap2-settings-restored')
  })

  test('cosmetic store: buying a pack lists it as owned', async ({ page }) => {
    await page.goto('/?autostart=1&seed=2027&flavor=trial')
    await waitForApp(page)
    await sp(page, `sp.navigate('store')`)
    const pack = page.getByTestId('pack-pack_celebrations')
    await expect(pack).toBeVisible()
    await pack.getByRole('button').click()
    await expect(pack).toContainText('Owned')
  })
})

test.describe('premium flavor', () => {
  test('never shows a paywall and crosses the rollover freely', async ({ page }) => {
    test.setTimeout(300_000)
    await page.goto('/?autostart=1&seed=2027&flavor=premium')
    await waitForApp(page)
    await rollOver(page)
    expect(await sp<number>(page, 'sp.state().calendar.season')).toBe(2027)
    await page.waitForTimeout(500)
    await expect(page.getByTestId('pw-buy')).toHaveCount(0)
    expect(await sp<string>(page, 'sp.screen().id')).not.toBe('paywall')
    await sp(page, `sp.navigate('settings')`)
    await expect(page.getByTestId('purchases-panel')).toContainText('fully unlocked')
  })
})
