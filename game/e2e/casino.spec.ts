import type { Page } from '@playwright/test'
import { test, expect, preferEnglish, assertCleanText, waitForApp, sp } from './fixtures'

const money = (page: Page) => sp<number>(page, 'sp.state().life.money')

/** Record every casino action result (net win/loss) the UI triggers. */
async function recordCasino(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __sp: { actions: { casino: Record<string, (...a: unknown[]) => unknown> } }; __casinoLog: { fn: string; net?: number }[] }
    w.__casinoLog = []
    const c = w.__sp.actions.casino
    for (const fn of ['slotsSpin', 'rouletteSpin', 'horseRace']) {
      const orig = c[fn].bind(c)
      c[fn] = (...a: unknown[]) => {
        const r = orig(...a) as { net?: number }
        w.__casinoLog.push({ fn, net: r?.net })
        return r
      }
    }
  })
}
const lastNet = (page: Page) => page.evaluate(() => (window as unknown as { __casinoLog: { net?: number }[] }).__casinoLog.at(-1)?.net ?? null)

/** The header money pill must show the live balance. */
async function expectBarMoney(page: Page, value: number) {
  const txt = (await page.locator('.cas-bar-money').first().innerText()).replace(/\s/g, '')
  if (/^€[\d,]+$/.test(txt)) expect(Number(txt.replace(/[€,]/g, ''))).toBe(value)
  else expect(txt).toMatch(/^-?€[\d.,]+[KM]?$/)
}

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
  await page.goto('/?autostart=1&dev=casino&seed=31337')
  await waitForApp(page)
  await expect(page.locator('main')).toContainText('Casino')
  await recordCasino(page)
})

test('casino: blackjack, roulette, slots and horse racing keep money consistent', async ({ page, shot }) => {
  await shot('d1-casino')
  await assertCleanText(page)

  // ── Blackjack ──
  await sp(page, `sp.navigate('blackjack')`)
  let before = await money(page)
  await page.getByRole('button', { name: 'Deal' }).click()
  await shot('d2-bj-dealt')
  for (let i = 0; i < 6; i++) {
    const stand = page.getByRole('button', { name: 'Stand' })
    if (!(await stand.isVisible().catch(() => false))) break
    await stand.click()
    await page.waitForTimeout(250)
  }
  await expect(page.locator('.bj-result-title').first()).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(1500)
  // The result banner must stay on screen once its pop-in animation has finished.
  expect(Number(await page.locator('.bj-result').evaluate((el) => getComputedStyle(el).opacity))).toBeGreaterThan(0.9)
  let after = await money(page)
  const bjDelta = after - before
  expect([-50, 0, 50, 75, -100, 100], `blackjack delta ${bjDelta}`).toContain(bjDelta)
  await expectBarMoney(page, after)
  await assertCleanText(page)
  await shot('d3-bj-result')

  // ── Roulette ──
  await sp(page, `sp.navigate('roulette')`)
  before = await money(page)
  await page.getByRole('button', { name: 'Red', exact: true }).click()
  await page.getByRole('button', { name: /^Spin/ }).click()
  await expect(page.locator('.rl-readout')).toContainText('spinning')
  await shot('d4-rl-spinning')
  await expect(page.locator('.rl-readout')).toContainText('Net:', { timeout: 10_000 })
  after = await money(page)
  expect(after - before).toBe(await lastNet(page))
  await expectBarMoney(page, after)
  await assertCleanText(page)
  await shot('d5-rl-result')

  // ── Slots ──
  await sp(page, `sp.navigate('slots')`)
  before = await money(page)
  await page.getByRole('button', { name: 'Pull the lever' }).click()
  await expect(page.locator('.slot-readout')).toContainText(/You won|Not this time/, { timeout: 10_000 })
  after = await money(page)
  expect(after - before).toBe(await lastNet(page))
  await expectBarMoney(page, after)
  await assertCleanText(page)
  await shot('d6-slots-result')

  // ── Horses ──
  await sp(page, `sp.navigate('horses')`)
  before = await money(page)
  await page.locator('.hr-pick').nth(2).click()
  await page.getByRole('button', { name: 'Start the race' }).click()
  await page.waitForTimeout(1200)
  await shot('d7-horses-running')
  await expect(page.locator('.hr-result')).toBeVisible({ timeout: 20_000 })
  after = await money(page)
  const net = await lastNet(page)
  expect(after - before).toBe(net)
  const shown = (await page.locator('.hr-result .score-font.num').innerText()).replace(/−/g, '-').replace(/[^\d+-]/g, '')
  expect(Number(shown)).toBe(net)
  await expectBarMoney(page, after)
  await assertCleanText(page)
  await shot('d8-horses-result')
})
