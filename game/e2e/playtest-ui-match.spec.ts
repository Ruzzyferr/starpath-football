/**
 * Match playtest regressions (docs/PLAYTEST-UI.md, match section).
 */
import { test, expect, preferEnglish, waitForApp, sp } from './fixtures'

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

/** Matchday with a starting hero, on the pre-match screen. */
async function toPreMatch(page: import('@playwright/test').Page, seed: number, tweak = ''): Promise<void> {
  await page.goto(`/?autostart=1&seed=${seed}`)
  await waitForApp(page)
  await sp(page, 'sp.toMatchday()')
  await sp(page, `(() => { const s = sp.state(); s.hero.contract.role = 'captain'; s.hero.managerTrust = 100; s.hero.form = 90; s.hero.fatigue = 0; s.hero.sharpness = 100; s.life.flags.promised_start = true; ${tweak} })()`)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Play match' }).click()
  await expect(page.getByRole('button', { name: 'Kick off' })).toBeVisible()
}

test('PT-M1: a young, raw striker is told he will mostly keep the ball (build-up), as the engine will do', async ({ page, shot }) => {
  // Weak finisher: the engine turns his hopeless shooting moments into build-up moments.
  await toPreMatch(page, 777, `for (const k of ['finishing','shotPower','composure','curve','heading','dribbling']) s.hero.attrs[k] = 20`)
  const em = page.getByTestId('pm-expected-moments')
  await expect(em).toBeVisible()
  await expect(em.locator('[data-kind="build_up"]')).toBeVisible()
  await shot('ptm-build-up-preview')
})

test('PT-M1b: a strong striker keeps his shooting moments in the preview', async ({ page }) => {
  await toPreMatch(page, 777, `for (const k of Object.keys(s.hero.attrs)) s.hero.attrs[k] = 90`)
  const em = page.getByTestId('pm-expected-moments')
  await expect(em).toBeVisible()
  await expect(em.locator('[data-kind="build_up"]')).toHaveCount(0)
})

test('PT-M2: no decision option looks pre-selected; the default is named instead', async ({ page, shot }) => {
  await toPreMatch(page, 4242)
  await page.getByRole('button', { name: 'Kick off' }).click()
  await expect(page.locator('.lm-root')).toBeVisible()
  await sp(page, 'sp.openDecision()')
  const dec = page.getByTestId('lm-decision')
  await expect(dec).toBeVisible()
  await expect(dec.locator('.lm-dec-opts .btn-primary')).toHaveCount(0)
  await expect(dec.locator('.lm-dec-opts')).toContainText('Default')
  await shot('ptm-decision')
})
