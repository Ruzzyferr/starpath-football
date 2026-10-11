import { test, expect, preferEnglish, assertCleanText, waitForApp, sp, dismissControlHint } from './fixtures'

/** Optional folder for review screenshots (DRILL_SHOTS=dir). */
const SHOTS = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.DRILL_SHOTS

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

async function openTraining(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/?autostart=1&seed=314')
  await waitForApp(page)
  await sp(page, 'sp.clearEvents()')
  await sp(page, `(() => { const s = sp.state(); s.calendar.slot = 0; s.life.energy = 100; s.hero.fatigue = 0; s.hero.injury = null; sp.navigate('training') })()`)
  await expect(page.locator('.trn-session').first()).toBeVisible()
}

for (const { session, rows } of [
  { session: 'Passing Drill', rows: 3 },
  { session: 'Shooting Drill', rows: 3 },
]) {
  test(`${session}: the intro shows you vs the drill's opponent, then the drill plays`, async ({ page }, info) => {
    await openTraining(page)
    const card = page.locator('.trn-session', { hasText: session })
    await card.getByRole('button', { name: 'Play drill' }).click()
    const overlay = page.locator('.trn-drill')
    const mu = overlay.getByTestId('drill-matchup')
    await expect(mu).toBeVisible()
    await expect(mu.getByTestId('drill-mu-row')).toHaveCount(rows)
    await expect(mu).toContainText('You')
    await expect(mu).toContainText(/Level \d+/)
    // Every row is two attribute values side by side.
    for (const r of await mu.getByTestId('drill-mu-row').all()) await expect(r).toContainText(/\d+.*\d+/)
    // The card fits the phone screen: the Start button is reachable.
    await expect(overlay.getByRole('button', { name: 'Start' })).toBeInViewport()
    await assertCleanText(page)
    const tag = `${info.project.name}-${session.replace(/\W+/g, '-').toLowerCase()}`
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${tag}-intro.png` })
    await overlay.getByRole('button', { name: 'Start' }).click()
    await expect(overlay.locator('canvas')).toBeVisible({ timeout: 20_000 })
    await dismissControlHint(page)
    await page.waitForTimeout(4500)
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${tag}-live.png` })
    await overlay.getByRole('button', { name: /Quit/ }).click()
  })
}
