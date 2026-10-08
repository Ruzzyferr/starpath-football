/** Late-game projects tab, casino VIP/cost panel and business decision effect. */
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { test, expect, preferEnglish, assertCleanText, waitForApp, sp } from './fixtures'

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
  await page.goto('/?autostart=1&dev=casino&seed=31337')
  await waitForApp(page)
  await sp(page, 'sp.clearEvents()')
})

async function serious(page: Page) {
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  return res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`)
}

test('projects tab: build academy, buy a stake, fund the legacy', async ({ page, shot }) => {
  await sp(page, 'sp.state().life.money = 20_000_000')
  await sp(page, `sp.navigate('home')`)
  await sp(page, `sp.navigate('life', { tab: 'projects' })`)
  const root = page.getByTestId('projects')
  await expect(root).toBeVisible()
  await page.waitForTimeout(1000)
  await shot('proj-empty')
  await page.getByTestId('prj-academy').getByRole('button', { name: /^Build/ }).click()
  expect(await sp<number>(page, `sp.state().life.flags['proj:academy']`)).toBe(1)
  await page.getByTestId('prj-stake').getByRole('button', { name: /^Buy/ }).click()
  await expect(page.getByTestId('prj-stake-pct')).toHaveText('5%')
  await page.getByTestId('prj-fund').getByRole('button', { name: /^Move into fund/ }).click()
  expect(await sp<number>(page, `Number(sp.state().life.flags['proj:fund'])`)).toBeGreaterThan(0)
  await expect(page.getByTestId('prj-points')).not.toHaveText('+0')
  await assertCleanText(page)
  expect(await serious(page)).toEqual([])
  await page.waitForTimeout(5000)
  await shot('proj-filled')
})

test('casino lobby shows VIP tier and weekly gambling cost', async ({ page, shot }) => {
  await sp(page, `(() => { const l = sp.state().life; l.flags['casino_turnover'] = 2_000_000; l.casino.addiction = 60 })()`)
  await sp(page, `sp.navigate('home')`)
  await sp(page, `sp.navigate('casino')`)
  const vip = page.getByTestId('casino-vip')
  await expect(vip).toBeVisible()
  await expect(vip).toHaveAttribute('data-tier', '2')
  await expect(page.getByTestId('casino-vip-limit')).toContainText('Table limit')
  await expect(page.getByTestId('casino-cost-now')).toContainText('cost of gambling')
  await expect(page.getByTestId('casino-cost').locator('.is-active')).toHaveCount(3)
  await assertCleanText(page)
  expect(await serious(page)).toEqual([])
  await page.waitForTimeout(5000)
  await shot('casino-vip')
})

test('business tab shows the active decision effect', async ({ page, shot }) => {
  await sp(page, `(() => { const s = sp.state(); s.life.money = 5_000_000; s.hero.reputation = 50 })()`)
  await sp(page, `sp.navigate('life', { tab: 'business' })`)
  await page.locator('.biz-shop[data-kind="gym"]').getByRole('button', { name: /^Open/ }).click()
  await sp(page, `(() => { const b = sp.state().life.businesses[0]; b.boost = { mult: 1.3, weeks: 4 } })()`)
  await sp(page, `sp.navigate('home')`)
  await sp(page, `sp.navigate('life', { tab: 'business' })`)
  await expect(page.getByTestId('biz-decision').first()).toContainText('revenue x1.30')
  await page.waitForTimeout(5000)
  await shot('biz-decision')
})
