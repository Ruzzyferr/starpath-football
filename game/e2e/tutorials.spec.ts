/**
 * TestFlight build 6: "Mini-games no longer show any tutorial — I want one in EVERY mini-game,
 * every time". The how-to card shows before every play of every kind (match moment, drill,
 * scouting video, doping test, dialogue), freezes the scene (pause gate), and can be hidden per
 * kind ("Don't show again") or globally (Settings › Mini-game tips), with "Show all again".
 */
import type { Page } from '@playwright/test'
import { test, expect, preferEnglish, waitForApp, sp, assertCleanText } from './fixtures'

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

const card = (page: Page) => page.getByTestId('tutorial')
const momentActive = (page: Page) => sp<boolean>(page, '!!sp.match()?.momentActive')
const gateHeld = (page: Page) => page.evaluate(() => (window as unknown as { __spPauseGate?: { held(): boolean } }).__spPauseGate?.held() ?? false)
const hidden = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem('starpath.help.v1') ?? '{}').hiddenTutorials ?? []) as string[])

/** The card is a focused modal: title, goal, controls, a tip naming an attribute. */
async function expectCard(page: Page, key: RegExp | string) {
  const c = card(page)
  await expect(c).toBeVisible({ timeout: 30_000 })
  await expect(c).toHaveAttribute('data-tutorial', key)
  const dlg = c.getByRole('dialog')
  await expect(dlg).toHaveAttribute('aria-modal', 'true')
  await expect(dlg.getByRole('heading', { level: 2 })).toBeVisible()
  await expect(dlg).toContainText('Goal')
  await expect(dlg).toContainText('Controls')
  await expect(c.getByTestId('tutorial-attr')).not.toBeEmpty()
  await expect(c.getByTestId('tutorial-start')).toBeFocused()
  await assertCleanText(page)
}

async function openTraining(page: Page) {
  await page.goto('/?autostart=1&seed=314')
  await waitForApp(page)
  await sp(page, 'sp.clearEvents()')
  await sp(page, `(() => { const s = sp.state(); s.calendar.slot = 0; s.life.energy = 100; s.hero.fatigue = 0; s.hero.injury = null; sp.navigate('training') })()`)
  await expect(page.locator('.trn-session').first()).toBeVisible()
}

/** Open a drill and press Start on its intro; the canvas is up afterwards. */
async function startDrill(page: Page, name: string) {
  await page.locator('.trn-session', { hasText: name }).getByRole('button', { name: 'Play drill' }).click()
  const overlay = page.locator('.trn-drill')
  await overlay.locator('.trn-drill-card').getByRole('button', { name: 'Start' }).click()
  await expect(overlay.locator('canvas')).toBeVisible({ timeout: 20_000 })
}

async function quitDrill(page: Page) {
  await page.locator('.trn-drill-quit').click()
  await expect(page.locator('.trn-drill')).toHaveCount(0)
}

test('match: the how-to card shows before two moments in a row, frozen until Start', async ({ page, shot }) => {
  test.setTimeout(360_000)
  await page.goto('/?autostart=1&seed=777')
  await waitForApp(page)
  await sp(page, 'sp.toMatchday()')
  await sp(page, "(() => { const s = sp.state(); s.hero.contract.role = 'captain'; s.hero.managerTrust = 100; s.hero.form = 90; s.hero.fatigue = 0; s.hero.sharpness = 100; s.life.flags.promised_start = true })()")
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Play match' }).click()
  await page.getByRole('button', { name: 'Kick off' }).click()
  await expect(page.locator('.lm-root')).toBeVisible()
  await page.locator('.lm-controls').getByText('4×').click()
  const kinds: string[] = []
  for (let n = 0; n < 2; n++) {
    const moment = page.locator('.lm-moment')
    await expect(moment).toBeVisible({ timeout: 150_000 })
    await moment.getByRole('button', { name: 'Play moment' }).click()
    await expectCard(page, /^match:/)
    expect(await gateHeld(page), 'scene frozen behind the card').toBe(true)
    kinds.push((await card(page).getAttribute('data-tutorial'))!)
    if (n === 0) {
      await page.waitForTimeout(500)
      await shot('tut-match-1')
      // Keyboard: Enter starts (focus is on Start).
      await page.keyboard.press('Enter')
    } else {
      await shot('tut-match-2')
      await card(page).getByTestId('tutorial-start').click()
    }
    await expect(card(page)).toHaveCount(0)
    // The gate's 3-2-1, then the moment runs to its end.
    await expect.poll(() => gateHeld(page)).toBe(false)
    await expect.poll(() => momentActive(page), { timeout: 120_000, intervals: [500] }).toBe(false)
  }
  console.log(`[e2e] tutorial cards for ${kinds.join(', ')}`)
  expect(kinds).toHaveLength(2)
})

test('drills: card every time; "Don\'t show again" hides that kind only; "Show all again" restores', async ({ page, shot }) => {
  test.setTimeout(180_000)
  await openTraining(page)

  // 1st Shooting Drill: card; tick "Don't show again".
  await startDrill(page, 'Shooting Drill')
  await expectCard(page, 'drill:finishing')
  await expect.poll(() => gateHeld(page)).toBe(true)
  // Focus trap: Tab cycles inside the card; Space on the checkbox ticks it.
  await page.keyboard.press('Tab')
  await expect(card(page).getByTestId('tutorial-dont-show')).toBeFocused()
  await page.keyboard.press('Space')
  await expect(card(page).getByTestId('tutorial-dont-show')).toBeChecked()
  await page.keyboard.press('Tab')
  await expect(card(page).getByTestId('tutorial-start')).toBeFocused()
  await page.waitForTimeout(300)
  await shot('tut-drill-dont-show')
  await page.keyboard.press('Space')
  await expect(card(page)).toHaveCount(0)
  expect(await hidden(page)).toEqual(['drill:finishing'])
  await quitDrill(page)

  // 2nd Shooting Drill: no card, the drill runs.
  await startDrill(page, 'Shooting Drill')
  await page.waitForTimeout(2500)
  await expect(card(page)).toHaveCount(0)
  expect(await gateHeld(page)).toBe(false)
  await quitDrill(page)

  // Another kind still shows its card.
  await startDrill(page, 'Passing Drill')
  await expectCard(page, /^drill:(?!finishing$)/)
  await card(page).getByTestId('tutorial-start').click()
  await expect(card(page)).toHaveCount(0)
  await quitDrill(page)

  // Settings › Help: the hidden count, then "Show all again".
  await sp(page, `sp.navigate('settings')`)
  await expect(page.getByText('Mini-game tips', { exact: true })).toBeVisible()
  await expect(page.getByTestId('tutorials-hidden')).toContainText('1 mini-game card hidden')
  const reset = page.getByTestId('tutorials-reset')
  await reset.scrollIntoViewIfNeeded()
  await shot('tut-settings')
  await reset.click()
  expect(await hidden(page)).toEqual([])
  await expect(page.getByTestId('tutorials-hidden')).toHaveCount(0)

  await sp(page, `sp.navigate('training')`)
  await startDrill(page, 'Shooting Drill')
  await expectCard(page, 'drill:finishing')
  await card(page).getByTestId('tutorial-start').click()
  await quitDrill(page)
})

test('the global "Mini-game tips" switch turns every card off', async ({ page }) => {
  await openTraining(page)
  await sp(page, `sp.navigate('settings')`)
  const sw = page.getByRole('switch', { name: /Mini-game tips/ })
  await sw.scrollIntoViewIfNeeded()
  await expect(sw).toBeChecked()
  await sw.click()
  await expect(sw).not.toBeChecked()
  await sp(page, `sp.navigate('training')`)
  await startDrill(page, 'Passing Drill')
  await page.waitForTimeout(2500)
  await expect(card(page)).toHaveCount(0)
  expect(await gateHeld(page)).toBe(false)
  await quitDrill(page)
})
