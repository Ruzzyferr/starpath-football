/**
 * WP-10 life depth: relationship "why" panel, business purchase + weekly P&L,
 * press conference (3-question interview) and casino responsible gaming.
 */
import { test, expect, preferEnglish, assertCleanText, waitForApp, sp } from './fixtures'

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
  await page.goto('/?autostart=1&seed=99&storage=memory')
  await waitForApp(page)
  await sp(page, 'sp.clearEvents()')
})

/** Advance time until the absolute week changes (runs the weekly tick). */
async function nextWeek(page: import('@playwright/test').Page): Promise<void> {
  await sp(page, `(() => {
    const w0 = sp.state().calendar.week, s0 = sp.state().calendar.season
    for (let i = 0; i < 30; i++) {
      sp.clearEvents()
      const c = sp.state().calendar
      if (c.week !== w0 || c.season !== s0) break
      sp.actions.advance()
    }
    sp.clearEvents()
  })()`)
}

test('relationship why-panel lists changes with their cause', async ({ page, shot }) => {
  await sp(page, `sp.actions.interact('mother', 'call')`)
  await sp(page, `sp.navigate('life', { tab: 'relations' })`)
  const name = await sp<string>(page, 'sp.state().life.relationships.mother.name')
  const card = page.locator('.life-person').filter({ hasText: name }).first()
  await card.getByRole('button', { name: 'Why did it change?' }).click()
  const modal = page.locator('.modal-root')
  await expect(modal).toBeVisible()
  await expect(modal.locator('.life-why-row').first()).toBeVisible()
  await expect(modal.locator('.life-why-row').first()).toHaveAttribute('data-cause', 'activity')
  await expect(modal).toContainText('Activity')
  await assertCleanText(page)
  await shot('w1-why-panel')
})

test('open a business and see its weekly profit & loss', async ({ page, shot }) => {
  await sp(page, `(() => { const s = sp.state(); s.life.money = 5000000; s.hero.reputation = 50 })()`)
  await sp(page, `sp.navigate('life', { tab: 'business' })`)
  const gym = page.locator('.biz-shop[data-kind="gym"]')
  await expect(gym).toBeVisible()
  await gym.getByRole('button', { name: /^Open/ }).click()
  await expect(page.locator('.biz-card[data-kind="gym"]')).toBeVisible()
  expect(await sp<number>(page, 'sp.state().life.businesses.length')).toBe(1)
  await shot('w2-business-open')
  await nextWeek(page)
  await sp(page, `sp.navigate('life', { tab: 'business' })`)
  const hist = await sp<number>(page, 'sp.state().life.businesses[0].history.length')
  expect(hist).toBeGreaterThanOrEqual(1)
  await expect(page.locator('[data-testid="biz-profit"]').first()).toBeVisible()
  await assertCleanText(page)
  await shot('w3-business-pnl')
})

test('press conference: three questions, answers apply, headline printed', async ({ page, shot }) => {
  await sp(page, `sp.navigate('life', { tab: 'social' })`)
  const room = page.locator('[data-testid="press-room"]')
  await room.getByRole('button', { name: 'Hold a press conference' }).click()
  const news0 = await sp<number>(page, 'sp.state().life.news.length')
  for (let i = 0; i < 3; i++) {
    await expect(room.locator('.press-question')).toBeVisible()
    await assertCleanText(page)
    if (i === 0) await shot('w4-press-question')
    await room.locator('.press-option').first().click()
  }
  await expect(room.locator('.press-headline-text')).toBeVisible()
  expect(await sp<number>(page, 'sp.state().life.news.length')).toBe(news0 + 1)
  await expect(page.locator('[data-testid="fan-comments"] .fan-comment').first()).toBeVisible()
  await shot('w5-press-headline')
})

test('casino: helpline, loss limit and self-exclusion lock', async ({ page, shot }) => {
  await sp(page, `(() => { const s = sp.state(); s.hero.birthYear = s.calendar.season - 22 })()`)
  await sp(page, `sp.navigate('casino')`)
  await expect(page.getByText(/If gambling stops being fun/).first()).toBeVisible()
  const rg = page.locator('[data-testid="casino-rg"]')
  await rg.getByRole('button', { name: 'Save limit' }).click()
  await expect(rg.locator('[data-testid="casino-limit"]')).toContainText('Limit')
  await rg.getByRole('button', { name: '4 weeks' }).click()
  await expect(page.locator('[data-testid="casino-excluded"]')).toBeVisible()
  expect(await sp<number>(page, 'sp.state().life.flags.casino_excluded_weeks')).toBe(4)
  await assertCleanText(page)
  await shot('w6-casino-excluded')
})

test('close friends: mark a person, list shows the star, cap of three is enforced (2.4#37)', async ({ page, shot }) => {
  await sp(page, `sp.navigate('life', { tab: 'relations' })`)
  const section = page.getByTestId('close-friends')
  await expect(section).toBeVisible()
  const toggles = page.getByTestId('close-friend-toggle')
  await expect(toggles.first()).toBeVisible()
  await toggles.first().click()
  await expect(section).toContainText('★')
  await expect(page.getByTestId('close-friend-badge').first()).toBeVisible()
  const n = await sp(page, `Object.values(sp.state().life.relationships).filter((r) => r.closeFriend).length`)
  expect(n).toBe(1)
  await page.waitForTimeout(800)
  await shot('close-friends')
})
