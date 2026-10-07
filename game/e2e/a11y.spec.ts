import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { test, expect, preferEnglish, waitForApp, sp } from './fixtures'

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

/** Serious / critical axe violations on the current screen. */
async function violations(page: Page) {
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  return res.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)
}

async function noHorizontalOverflow(page: Page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(over, 'horizontal overflow (px)').toBeLessThanOrEqual(1)
}

test('title screen has no serious axe violations', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#main')).toBeVisible()
  await page.waitForTimeout(600)
  expect(await violations(page)).toEqual([])
})

const SCREENS: [string, string][] = [
  ['home', `sp.navigate('home')`],
  ['planner', `sp.navigate('planner')`],
  ['profile', `sp.navigate('profile')`],
  ['life', `sp.navigate('life')`],
  ['settings', `sp.navigate('settings')`],
]

for (const [name, nav] of SCREENS) {
  test(`${name} has no serious axe violations (also at 130% text)`, async ({ page }) => {
    await page.goto('/?autostart=1&seed=4242')
    await waitForApp(page)
    await sp(page, 'sp.clearEvents()')
    await sp(page, nav)
    await page.waitForTimeout(700)
    expect(await violations(page)).toEqual([])
    // Largest text scale must not cause horizontal page overflow.
    await page.evaluate(() => document.documentElement.style.setProperty('--text-scale', '1.3'))
    await page.waitForTimeout(200)
    await noHorizontalOverflow(page)
  })
}

test('settings: palettes apply and key rebinding reports conflicts', async ({ page }) => {
  await page.goto('/?autostart=1&seed=4242')
  await waitForApp(page)
  await sp(page, `sp.navigate('settings')`)
  await page.getByRole('radio', { name: 'Tritanopia' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-cb', 'tritanopia')
  await page.getByRole('radio', { name: 'Off' }).first().click()
  await expect(page.locator('html')).toHaveAttribute('data-cb', 'off')
  // Rebind "Pass" onto the key used by "Through ball": conflict message, no change.
  await page.getByRole('button', { name: /^Pass: Q$/ }).click()
  await page.keyboard.press('KeyR')
  await expect(page.getByRole('status').filter({ hasText: 'already used' })).toBeVisible()
  await page.getByRole('button', { name: 'Swap' }).click()
  await expect(page.getByRole('button', { name: /^Pass: R$/ })).toBeVisible()
  await page.getByRole('button', { name: 'Reset to defaults' }).click()
  await expect(page.getByRole('button', { name: /^Pass: Q$/ })).toBeVisible()
})

test('hide casino removes it from navigation and the planner', async ({ page }) => {
  await page.goto('/?autostart=1&seed=4242')
  await waitForApp(page)
  await sp(page, `sp.navigate('settings')`)
  await page.getByRole('switch', { name: /Hide casino/ }).click()
  await sp(page, `sp.navigate('life')`)
  await expect(page.getByRole('button', { name: /casino/i })).toHaveCount(0)
})

test('post-match flow has no serious axe violations', async ({ page }) => {
  await page.goto('/?autostart=1&seed=4242')
  await waitForApp(page)
  await sp(page, 'sp.toMatchday()')
  await sp(page, "(() => { const s = sp.state(); s.hero.contract.role = 'captain'; s.hero.managerTrust = 100; s.hero.form = 90; s.hero.fatigue = 0; s.hero.sharpness = 100; s.life.flags.promised_start = true })()")
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Play match' }).click()
  await page.getByRole('button', { name: 'Kick off' }).click()
  await expect(page.locator('.lm-root')).toBeVisible()
  for (let i = 0; i < 20; i++) {
    const card = page.locator('.lm-moment')
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
  await page.waitForTimeout(800)
  expect(await violations(page)).toEqual([])
})
