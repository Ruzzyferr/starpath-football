/**
 * WP-6 onboarding: first-career coach tour (complete / skip / replay / no
 * re-show after reload), matchday confirm, glossary + info tips, progressive
 * unlocks and the first-moment control hint. Key states are screenshotted as
 * wp6-<project>-<name>.png into $WP6_SHOTS (default: the e2e shots folder).
 */
import type { Page } from '@playwright/test'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { test, expect, preferEnglish, assertCleanText, waitForApp, sp, SHOTS } from './fixtures'

const WP6 = process.env.WP6_SHOTS || SHOTS
mkdirSync(WP6, { recursive: true })

async function snapWp6(page: Page, project: string, name: string): Promise<void> {
  await page.screenshot({ path: join(WP6, `wp6-${project}-${name}.png`) })
}

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

/** Create a career through the wizard (the only path that starts the coach tour). */
async function wizardCareer(page: Page, trial = false): Promise<void> {
  await page.goto('/')
  await waitForApp(page)
  await page.getByRole('button', { name: 'New career' }).click()
  await page.locator('#wiz-first').fill('Deniz')
  await page.locator('#wiz-last').fill('Kaplan')
  const next = page.locator('.wiz-foot').getByRole('button', { name: /^Next/ })
  await next.click()
  await page.locator('.wiz-flag').first().click()
  for (let i = 0; i < 5; i++) await next.click()
  // Starting-club trials are ON by default; the tour tests skip them unless asked.
  const sw = page.locator('label.switch-row', { hasText: 'Start with trials' }).locator('input')
  await expect(sw).toBeChecked()
  if (!trial) await sw.uncheck()
  await page.getByRole('button', { name: 'Start career' }).click()
  if (trial) {
    await expect(page.getByTestId('trials')).toBeVisible({ timeout: 30_000 })
    await expect(coach(page)).toHaveCount(0) // no tour during the trial
    await page.getByTestId('trial-sim-academy').click()
    await expect(page.getByTestId('trial-result')).toContainText('Contract signed')
    await expect(coach(page)).toHaveCount(0)
    await page.getByTestId('trial-continue').click()
  }
  await expect(page.locator('.home-grid')).toBeVisible({ timeout: 30_000 })
}

const coach = (page: Page) => page.locator('.coach-root')

async function closeModals(page: Page): Promise<void> {
  for (let i = 0; i < 4 && (await page.locator('.modal-root').count()); i++) {
    await sp(page, 'sp.clearEvents()')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(150)
  }
}

test('new career: coach tour runs end to end and does not come back after reload', async ({ page }, info) => {
  const P = info.project.name
  await wizardCareer(page)
  await expect(coach(page)).toBeVisible()
  await expect(coach(page)).toHaveAttribute('data-step', 'welcome')
  const card = page.locator('.coach-card')
  await expect(card).toContainText('Coach Selim')
  await assertCleanText(page)
  await snapWp6(page, P, '01-tour-welcome')
  const next = card.getByRole('button', { name: /^(Next|Let’s go)/ })

  await next.click()
  await expect(coach(page)).toHaveAttribute('data-step', 'meters')
  await page.waitForTimeout(300)
  await snapWp6(page, P, '02-tour-meters')

  // Keyboard navigation: → advances, ← goes back.
  await page.keyboard.press('ArrowRight')
  await expect(coach(page)).toHaveAttribute('data-step', 'condition')
  await page.keyboard.press('ArrowLeft')
  await expect(coach(page)).toHaveAttribute('data-step', 'meters')
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(400)
  await snapWp6(page, P, '03-tour-condition')

  await next.click()
  await expect(coach(page)).toHaveAttribute('data-step', 'planner')
  await page.waitForTimeout(400)
  await snapWp6(page, P, '04-tour-planner-tile')
  // Action step: tapping the highlighted tile completes it.
  await page.locator('[data-tour="tile-planner"]').click()
  await expect(coach(page)).toHaveAttribute('data-step', 'planSlot')
  await expect(page.locator('.plan-slots')).toBeVisible()
  await page.waitForTimeout(400)
  await snapWp6(page, P, '05-tour-plan-slot')

  await page.locator('.plan-slot-body:not([disabled])').first().click()
  await expect(page.locator('.plan-picker')).toBeVisible()
  await expect(coach(page)).toHaveCount(0) // steps aside for the picker
  await page.locator('.plan-picker .plan-act:not([disabled])').first().click()
  await expect(coach(page)).toHaveAttribute('data-step', 'advance')
  await page.waitForTimeout(400)
  await snapWp6(page, P, '06-tour-advance')

  await page.locator('.page-footer [data-tour="advance"]').click()
  await closeModals(page)
  await expect(coach(page)).toHaveAttribute('data-step', 'decisions')
  await page.waitForTimeout(400)
  await snapWp6(page, P, '07-tour-decisions')

  await next.click()
  await expect(coach(page)).toHaveAttribute('data-step', 'matchday')
  await page.waitForTimeout(400)
  await assertCleanText(page)
  await snapWp6(page, P, '08-tour-matchday')
  await card.getByRole('button', { name: 'Let’s go' }).click()
  await expect(coach(page)).toHaveCount(0)
  expect(await sp<string>(page, `sp.state().life.flags['tut:status']`)).toBe('done')

  // Reload and continue the career: the tour stays finished.
  await page.waitForTimeout(400)
  await sp(page, 'sp.flushAutosave()')
  await page.goto('/')
  await waitForApp(page)
  await page.locator('.title-continue').click()
  await expect(page.locator('.home-grid')).toBeVisible({ timeout: 30_000 })
  expect(await sp<string>(page, `sp.state().life.flags['tut:status']`)).toBe('done')
  await page.waitForTimeout(500)
  await expect(coach(page)).toHaveCount(0)
})

test('trial on: the coach tour starts only after the trial, on Home', async ({ page }) => {
  await wizardCareer(page, true)
  await expect(coach(page)).toBeVisible()
  await expect(coach(page)).toHaveAttribute('data-step', 'welcome')
})

test('skip the tour, then replay it from Settings', async ({ page }, info) => {
  const P = info.project.name
  await wizardCareer(page)
  await expect(coach(page)).toBeVisible()
  await page.locator('.coach-card').getByRole('button', { name: 'Skip tutorial' }).click()
  await expect(coach(page)).toHaveCount(0)
  expect(await sp<string>(page, `sp.state().life.flags['tut:status']`)).toBe('skipped')

  await sp(page, 'sp.clearEvents()')
  await closeModals(page)
  await sp(page, `sp.navigate('settings')`)
  const replay = page.getByRole('button', { name: 'Replay tutorial' })
  await replay.scrollIntoViewIfNeeded()
  await expect(replay).toBeEnabled()
  await assertCleanText(page)
  await snapWp6(page, P, '10-settings-help')
  await replay.click()
  await expect(page.locator('.home-grid')).toBeVisible()
  await expect(coach(page)).toHaveAttribute('data-step', 'welcome')
  // Esc skips as well.
  await page.keyboard.press('Escape')
  await expect(coach(page)).toHaveCount(0)
  expect(await sp<string>(page, `sp.state().life.flags['tut:status']`)).toBe('skipped')
})

test('advance on matchday asks Play / Sim / Cancel', async ({ page }, info) => {
  const P = info.project.name
  await page.goto('/?autostart=1&seed=777')
  await waitForApp(page)
  await sp(page, 'sp.toMatchday()')
  await page.keyboard.press('Escape')
  const before = await sp<string>(page, 'JSON.stringify(sp.state().calendar)')
  await page.locator('.home-cta-main').click()
  const dlg = page.locator('.mdc')
  await expect(dlg).toBeVisible()
  await expect(dlg.getByRole('button', { name: /Play the match/ })).toBeVisible()
  await expect(dlg.getByRole('button', { name: /Sim the match/ })).toBeVisible()
  await assertCleanText(page)
  await snapWp6(page, P, '20-matchday-confirm')
  await dlg.getByRole('button', { name: 'Cancel' }).click()
  await expect(dlg).toHaveCount(0)
  expect(await sp<string>(page, 'JSON.stringify(sp.state().calendar)')).toBe(before)
  expect(await sp<number>(page, 'sp.data.nextFixture().daysUntil')).toBe(0)

  // Sim: the match is played by the sim.
  await page.locator('.home-cta-main').click()
  await page.locator('.mdc').getByRole('button', { name: /Sim the match/ }).click()
  await expect(page.locator('.mdc')).toHaveCount(0)
  await expect.poll(() => sp<string>(page, 'JSON.stringify(sp.state().calendar)')).not.toBe(before)
})

test('matchday confirm: Play the match opens the pre-match screen', async ({ page }) => {
  await page.goto('/?autostart=1&seed=778')
  await waitForApp(page)
  await sp(page, 'sp.toMatchday()')
  await page.keyboard.press('Escape')
  await page.locator('.home-cta-main').click()
  await page.locator('.mdc').getByRole('button', { name: /Play the match/ }).click()
  await expect(page.getByRole('button', { name: 'Kick off' })).toBeVisible()
})

test('glossary opens from the menu and from an info tip', async ({ page }, info) => {
  const P = info.project.name
  await page.goto('/?autostart=1&seed=99')
  await waitForApp(page)
  await sp(page, 'sp.clearEvents()')
  await closeModals(page)

  // Info tip on Home (hover/focus on desktop, tap/long-press on touch).
  const tip = page.locator('.infotip-btn[data-term="form"]').first()
  await tip.scrollIntoViewIfNeeded()
  await tip.click()
  const pop = page.locator('.infotip-pop')
  await expect(pop).toBeVisible()
  await expect(pop).toContainText('Form')
  await snapWp6(page, P, '30-infotip-form')
  await pop.getByRole('button', { name: /Open in glossary/ }).click()
  await expect(page.locator('.gloss-item.is-focus[data-term="form"]')).toBeVisible()
  await page.waitForTimeout(300)
  await snapWp6(page, P, '31-glossary-focus')

  // From the menu, with search.
  await sp(page, `sp.navigate('menu')`)
  await page.locator('.menu-tile', { hasText: 'Glossary' }).click()
  const items = page.locator('.gloss-item')
  expect(await items.count()).toBeGreaterThanOrEqual(25)
  await assertCleanText(page)
  await snapWp6(page, P, '32-glossary')
  await page.getByRole('searchbox', { name: 'Search terms' }).fill('trust')
  await expect(items.first()).toContainText(/trust/i)
  expect(await items.count()).toBeLessThan(5)
  await snapWp6(page, P, '33-glossary-search')
})

test('progressive unlocks: locked message, then New! tag and one-time explainer', async ({ page }, info) => {
  const P = info.project.name
  await page.goto('/?autostart=1&seed=99')
  await waitForApp(page)
  await sp(page, 'sp.clearEvents()')
  await closeModals(page)
  // Pretend the career started this week (wizard careers record this).
  await sp(page, `(() => { const s = sp.state(); s.life.flags['ux:start'] = s.calendar.season * 44 + s.calendar.week; sp.actions.planSlot(2, null); sp.navigate('life', { tab: 'sponsors' }) })()`)
  const locked = page.locator('.unlock-locked[data-locked="sponsors"]')
  await expect(locked).toBeVisible()
  await expect(locked).toContainText(/Unlocks in week \d+/)
  await assertCleanText(page)
  await snapWp6(page, P, '40-unlock-locked')
  await sp(page, `sp.navigate('home')`)
  await expect(page.locator('.home-tile-casino [data-locked="casino"]')).toBeVisible()
  await page.locator('.home-tile-casino').scrollIntoViewIfNeeded()
  await snapWp6(page, P, '41-unlock-home-tile')

  // Ten weeks later: unlocked, flagged New! with a one-time explainer.
  await sp(page, `(() => { const s = sp.state(); s.life.flags['ux:start'] = s.calendar.season * 44 + s.calendar.week - 10; sp.actions.planSlot(2, null); sp.navigate('life', { tab: 'sponsors' }) })()`)
  await expect(page.locator('.ph-app-bar .new-tag')).toBeVisible()
  const exp = page.locator('.unlock-explainer[data-explainer="sponsors"]')
  await expect(exp).toBeVisible()
  await page.waitForTimeout(600)
  await snapWp6(page, P, '42-unlock-explainer')
  await exp.getByRole('button', { name: 'Got it' }).click()
  await expect(exp).toHaveCount(0)
  await expect(page.locator('.ph-app-bar .new-tag')).toHaveCount(0)
})

test('first match moment shows a platform-aware control hint', async ({ page, isMobile }, info) => {
  const P = info.project.name
  await page.goto('/?autostart=1&seed=777')
  await waitForApp(page)
  await sp(page, 'sp.toMatchday()')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Play match' }).click()
  await page.getByRole('button', { name: 'Kick off' }).click()
  await expect(page.locator('.lm-root')).toBeVisible()
  await page.waitForTimeout(800) // screen enter transition
  await snapWp6(page, P, '50-live-controls')
  // 390px: the speed buttons and the sim button stay inside the viewport.
  const vw = page.viewportSize()!.width
  for (const sel of ['.lm-controls .segmented-opt:last-child', '.lm-controls .btn-ghost']) {
    const b = await page.locator(sel).first().boundingBox()
    expect(b, sel).not.toBeNull()
    expect(b!.x + b!.width, `${sel} inside viewport`).toBeLessThanOrEqual(vw + 0.5)
    expect(b!.x).toBeGreaterThanOrEqual(-0.5)
  }
  await page.locator('.lm-controls').getByText('4×').click()
  const card = page.locator('.lm-moment')
  await expect(card).toBeVisible({ timeout: 120_000 })
  await card.getByRole('button', { name: 'Play moment' }).click()
  await page.waitForFunction(() => (window as unknown as { __spScene?: { debugInfo(): { phase: string } } }).__spScene?.debugInfo().phase === 'live', undefined, { timeout: 30_000 })
  const hint = page.locator('.control-hint')
  await expect(hint).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(900)
  const text = await hint.innerText()
  if (isMobile) expect(text).toMatch(/Swipe|Tap|Drag|joystick/i)
  else expect(text).toMatch(/click|Click|WASD|Space|button/)
  await snapWp6(page, P, '51-match-hint')
  await hint.getByRole('button', { name: 'Got it' }).click()
  await expect(hint).toHaveCount(0)
  const seen = await page.evaluate(() => JSON.parse(localStorage.getItem('starpath.help.v1') ?? '{}').seenHints as string[])
  expect(seen.some((s) => s.startsWith('match:'))).toBe(true)
})

test('live match control bar fits at phone width in Turkish', async ({ page }, info) => {
  const P = info.project.name
  await page.addInitScript(() => localStorage.setItem('starpath.settings.v1', JSON.stringify({ lang: 'tr' })))
  await page.goto('/?autostart=1&seed=777')
  await waitForApp(page)
  await sp(page, 'sp.toMatchday()')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Maça çık' }).first().click()
  await page.getByRole('button', { name: 'Başlama vuruşu' }).click()
  await expect(page.locator('.lm-controls')).toBeVisible()
  await page.waitForTimeout(800) // screen enter transition
  const vw = page.viewportSize()!.width
  for (const sel of ['.lm-controls .segmented-opt:last-child', '.lm-controls .btn-ghost']) {
    for (const el of await page.locator(sel).all()) {
      const b = (await el.boundingBox())!
      expect(b.x + b.width, sel).toBeLessThanOrEqual(vw + 0.5)
    }
  }
  // Skip-to-moment and sim-to-end are both ghost buttons; neither label may clip.
  for (const label of await page.locator('.lm-controls .btn-ghost .btn-label').all()) {
    if (!(await label.isVisible())) continue
    const clipped = await label.evaluate((el) => el.scrollWidth > el.clientWidth + 1)
    expect(clipped, 'control label is not clipped').toBe(false)
  }
  await snapWp6(page, P, '52-live-controls-tr')
})
