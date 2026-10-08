/**
 * Position roles in the new-career wizard (owner feedback after the APK play-test): the role step only
 * offers the chosen position's roles, changing the position resets the role to that position's default,
 * the live preview follows the pick, and the career starts with the chosen role and height.
 */
import type { Page } from '@playwright/test'
import { test, expect, preferEnglish, assertCleanText, sp, waitForApp } from './fixtures'

const ROLES: Record<string, string[]> = {
  GK: ['reflexKeeper', 'shotStopper', 'sweeperKeeper'],
  LB: ['balancedFullBack', 'attackingFullBack', 'defensiveFullBack'],
  RB: ['balancedFullBack', 'attackingFullBack', 'defensiveFullBack'],
  CB: ['stopper', 'aerialDefender', 'ballPlayingDefender'],
  DM: ['anchor', 'boxToBox', 'playmaker'],
  CM: ['boxToBox', 'anchor', 'playmaker'],
  AM: ['playmaker', 'boxToBox'],
  LW: ['touchlineWinger', 'invertedWinger', 'freeWinger', 'dribbler'],
  RW: ['touchlineWinger', 'invertedWinger', 'freeWinger', 'dribbler'],
  ST: ['runner', 'targetForward', 'pivot'],
}

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

async function toPositionStep(page: Page): Promise<void> {
  await page.goto('/')
  await waitForApp(page)
  await page.getByRole('button', { name: 'New career' }).click()
  await page.locator('#wiz-first').fill('Deniz')
  await page.locator('#wiz-last').fill('Kaplan')
  const next = page.locator('.wiz-foot').getByRole('button', { name: /^Next/ })
  await next.click() // → nation
  await next.click() // → position
  await expect(page.locator('.wiz-pitch')).toBeVisible()
}

const cardRoles = (page: Page) => page.locator('[data-testid="role-cards"] [data-role]').evaluateAll((els) => els.map((e) => e.getAttribute('data-role')))

test('every position offers only its own roles; changing position resets the role', async ({ page }) => {
  await toPositionStep(page)
  const next = page.locator('.wiz-foot').getByRole('button', { name: /^Next/ })
  const back = page.locator('.wiz-foot').getByRole('button', { name: /^Back/ })
  for (const [pos, roles] of Object.entries(ROLES)) {
    await page.locator(`[data-pos="${pos}"]`).click()
    await next.click()
    await expect(page.locator('[data-testid="role-cards"]')).toBeVisible()
    expect(await cardRoles(page), pos).toEqual(roles)
    // The default role is selected after a position change.
    await expect(page.locator(`[data-role="${roles[0]}"]`)).toHaveAttribute('aria-checked', 'true')
    // Picking another role moves the selection and the preview.
    const last = roles[roles.length - 1]!
    const before = await page.locator('[data-testid="role-preview"] .wiz-role-name').textContent()
    await page.locator(`[data-role="${last}"]`).click()
    await expect(page.locator(`[data-role="${last}"]`)).toHaveAttribute('aria-checked', 'true')
    await expect(page.locator(`[data-role="${roles[0]}"]`)).toHaveAttribute('aria-checked', 'false')
    await expect(page.locator('[data-testid="role-preview"] .wiz-role-name')).not.toHaveText(before ?? '')
    // Every role is four strengths and four weaknesses, each a numbered attribute (chips and preview rows).
    await expect(page.locator('[data-testid="role-preview"] .statbar')).toHaveCount(8)
    await expect(page.locator(`[data-role="${last}"] .wiz-role-key`)).toHaveCount(8)
    for (const txt of await page.locator(`[data-role="${last}"] .wiz-role-key`).allTextContents()) expect(txt, pos).toMatch(/\d+$/)
    // No role is marked as the recommended one: each shows a neutral playstyle tag instead.
    await expect(page.locator('[data-testid="role-cards"]')).not.toContainText('Suggested')
    await expect(page.locator('[data-testid="role-cards"] .wiz-role-style')).toHaveCount(roles.length)
    await back.click()
  }
})

test('starting age 16-21 shows the trade-off: older starts higher with less ceiling', async ({ page }) => {
  await page.goto('/')
  await waitForApp(page)
  await page.getByRole('button', { name: 'New career' }).click()
  const trade = page.locator('[data-testid="age-trade"]')
  const ovrAt = async (age: number) => {
    await page.getByRole('radio', { name: String(age), exact: true }).click()
    return Number((await trade.locator('.wiz-age-val').first().textContent())!.trim().split(/\s/)[0])
  }
  const young = await ovrAt(16)
  await expect(trade).toContainText('Longest career')
  const old = await ovrAt(21)
  await expect(trade).toContainText('Ready now')
  expect(old).toBeGreaterThan(young + 5)
  await expect(trade.locator('.wiz-age-val').nth(1)).toHaveText('−3')
  await assertCleanText(page)
})

test('a pivot striker starts the career with the role and a taller frame', async ({ page }) => {
  await toPositionStep(page)
  const next = page.locator('.wiz-foot').getByRole('button', { name: /^Next/ })
  await page.locator('[data-pos="ST"]').click()
  await next.click()
  await page.locator('[data-role="pivot"]').click()
  await expect(page.locator('#wiz-height')).toHaveValue('192')
  await page.getByRole('button', { name: 'Increase Height' }).click()
  await expect(page.locator('#wiz-height')).toHaveValue('193')
  await assertCleanText(page)
  await next.click() // → background
  await next.click() // → look
  await next.click() // → summary
  await expect(page.locator('.wiz-summary')).toContainText('Pivot Striker · 193 cm')
  const trialSwitch = page.locator('label.switch-row', { hasText: 'Start with trials' }).locator('input')
  await trialSwitch.uncheck()
  await page.getByRole('button', { name: 'Start career' }).click()
  await expect(page.locator('.home-grid')).toBeVisible({ timeout: 30_000 })
  const hero = await sp<{ role: string; heightCm: number; position: string }>(page, `(() => { const h = sp.state().hero; return { role: h.role, heightCm: h.heightCm, position: h.position } })()`)
  expect(hero).toEqual({ role: 'pivot', heightCm: 193, position: 'ST' })
  await sp(page, `sp.navigate('profile')`)
  await expect(page.locator('[data-testid="profile-role"]')).toContainText('Pivot Striker')
})

test('role step screenshots (390 and 1440)', async ({ page }) => {
  const out = process.env.ROLE_SHOTS
  test.skip(!out, 'set ROLE_SHOTS=<dir> to capture')
  for (const [w, h] of [[390, 844], [1440, 900]] as const) {
    await page.setViewportSize({ width: w, height: h })
    await toPositionStep(page)
    await page.locator('[data-pos="LW"]').click()
    await page.locator('.wiz-foot').getByRole('button', { name: /^Next/ }).click()
    await page.locator('[data-role="invertedWinger"]').click()
    await page.waitForTimeout(5000)
    await page.screenshot({ path: `${out}/role-${w}.png` })
    if (w === 390) {
      await page.locator('[data-role="invertedWinger"]').evaluate((el) => el.scrollIntoView({ block: 'start' }))
      await page.waitForTimeout(600)
      await page.screenshot({ path: `${out}/role-${w}-picked.png` })
      await page.locator('[data-testid="role-preview"]').evaluate((el) => el.scrollIntoView({ block: 'end' }))
      await page.waitForTimeout(600)
      await page.screenshot({ path: `${out}/role-${w}-panel.png` })
    }
    await page.goto('about:blank')
  }
})
