/**
 * Render guard (game/phaserGuard.ts): a Phaser host must never leave the player on a black
 * canvas. WebGL failing restarts on Canvas; Canvas failing too shows a readable panel whose Exit
 * (and the drill's own Quit) always works. Failures are forced with the `__spForceRenderFail` hook.
 */
import type { Page } from '@playwright/test'
import { test, expect, waitForApp, sp, dismissControlHint } from './fixtures'

const CANVAS = 1 // Phaser.CANVAS

async function boot(page: Page, opts: { force?: string; quality?: string } = {}): Promise<void> {
  await page.addInitScript(({ force, quality }) => {
    try {
      const k = 'starpath.settings.v1'
      if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify({ lang: 'en', reducedMotion: false, ...(quality ? { quality } : {}) }))
    } catch { /* ignore */ }
    if (force) (globalThis as { __spForceRenderFail?: string }).__spForceRenderFail = force
  }, opts)
}

async function toTrials(page: Page): Promise<void> {
  await page.goto('/')
  await waitForApp(page)
  await page.getByRole('button', { name: 'New career' }).click()
  await page.locator('#wiz-first').fill('Ece')
  await page.locator('#wiz-last').fill('Demir')
  const next = page.locator('.wiz-foot').getByRole('button', { name: /^Next/ })
  for (let i = 0; i < 6; i++) await next.click()
  await page.getByRole('button', { name: 'Start career' }).click()
  await expect(page.getByTestId('trials')).toBeVisible({ timeout: 30_000 })
}

async function startTrialDrill(page: Page): Promise<void> {
  await page.locator('.trial-card').first().getByRole('button', { name: 'Play the trial' }).click()
  await page.getByTestId('trial-start').click()
}

const rendererType = (page: Page) =>
  page.evaluate(() => (globalThis as { __spTraining?: { game: { renderer: { type: number } } } }).__spTraining?.game.renderer.type ?? null)

test('a healthy WebGL drill stays on WebGL (no false alarm from the watchdog or blank-frame check)', async ({ page }) => {
  await boot(page)
  await toTrials(page)
  await startTrialDrill(page)
  await expect(page.locator('.trn-drill canvas')).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(6000)
  expect(await rendererType(page)).toBe(2) // Phaser.WEBGL
  expect(await page.evaluate(() => localStorage.getItem('sp.render.webglBroken'))).toBeNull()
  expect(await page.evaluate(() => localStorage.getItem('sp.render.starting'))).toBeNull()
  await page.getByTestId('drill-quit').click()
  await expect(page.getByTestId('trial-drill')).toHaveCount(0)
})

test('WebGL failing: the trial drill restarts on Canvas, the failure is remembered, Quit works', async ({ page, shot }) => {
  await boot(page, { force: 'throw-webgl' })
  await toTrials(page)
  await startTrialDrill(page)
  await expect(page.locator('.trn-drill canvas')).toBeVisible({ timeout: 20_000 })
  await expect.poll(() => rendererType(page), { timeout: 10_000 }).toBe(CANVAS)
  await expect(page.getByTestId('render-fail')).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('sp.render.webglBroken'))).toMatch(/drill: scene error/)
  await shot('rg-canvas-fallback')
  await page.getByTestId('drill-quit').click()
  await expect(page.getByTestId('trial-drill')).toHaveCount(0)
  await expect(page.getByTestId('trials')).toBeVisible()
})

test('every renderer failing: a readable panel, its Exit and the Quit button both leave the drill', async ({ page, shot }) => {
  await boot(page, { force: 'throw-all' })
  await toTrials(page)
  await startTrialDrill(page)
  const panel = page.getByTestId('render-fail')
  await expect(panel).toBeVisible({ timeout: 20_000 })
  await expect(panel).toContainText('The game view could not start')
  await expect(panel).toContainText('webgl → canvas')
  await expect(panel).toContainText('forced canvas scene throw')
  await expect(panel).toContainText(/WebView: (Chrome|Mozilla|.+)/)
  // Quit stays above the panel and the canvas.
  await expect(page.getByTestId('drill-quit')).toBeVisible()
  await shot('rg-panel')
  await panel.getByTestId('render-fail-exit').click()
  await expect(page.getByTestId('trial-drill')).toHaveCount(0)
  await expect(page.getByTestId('trials')).toBeVisible()
  // The DOM Quit button works the same way on a second attempt.
  await startTrialDrill(page)
  await expect(page.getByTestId('render-fail')).toBeVisible({ timeout: 20_000 })
  await page.getByTestId('drill-quit').click()
  await expect(page.getByTestId('trial-drill')).toHaveCount(0)
})

test('Settings › Graphics quality › Low draws drills with Canvas from the start', async ({ page }) => {
  await boot(page, { quality: 'low' })
  await toTrials(page)
  await startTrialDrill(page)
  await expect(page.locator('.trn-drill canvas')).toBeVisible({ timeout: 20_000 })
  await expect.poll(() => rendererType(page), { timeout: 10_000 }).toBe(CANVAS)
  // Canvas by choice, not because WebGL broke.
  expect(await page.evaluate(() => localStorage.getItem('sp.render.webglBroken'))).toBeNull()
  await page.getByTestId('drill-quit').click()
  await expect(page.getByTestId('trial-drill')).toHaveCount(0)
})

test('a WebGL start that hung last session (sentinel left behind) starts on Canvas', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('rg-once')) {
      sessionStorage.setItem('rg-once', '1')
      localStorage.setItem('sp.render.starting', JSON.stringify({ r: 'webgl', host: 'drill', at: 1 }))
    }
  })
  await boot(page)
  await toTrials(page)
  expect(await page.evaluate(() => localStorage.getItem('sp.render.webglBroken'))).toMatch(/did not finish/)
  await startTrialDrill(page)
  await expect.poll(() => rendererType(page), { timeout: 20_000 }).toBe(CANVAS)
  await page.getByTestId('drill-quit').click()
  await expect(page.getByTestId('trial-drill')).toHaveCount(0)
})

test('live match: a moment no renderer can draw shows the panel, Exit resolves the moment', async ({ page }) => {
  test.setTimeout(240_000)
  await boot(page, { force: 'throw-all' })
  await page.goto('/?autostart=1&seed=777')
  await waitForApp(page)
  await sp(page, 'sp.toMatchday()')
  await sp(page, "(() => { const s = sp.state(); s.hero.contract.role = 'captain'; s.hero.managerTrust = 100; s.hero.form = 90; s.hero.fatigue = 0; s.hero.sharpness = 100; s.life.flags.promised_start = true })()")
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Play match' }).click()
  await page.getByRole('button', { name: 'Kick off' }).click()
  await expect(page.locator('.lm-root')).toBeVisible()
  await page.locator('.lm-controls').getByText('4×').click()
  const card = page.locator('.lm-moment')
  await expect(card).toBeVisible({ timeout: 120_000 })
  await card.getByRole('button', { name: 'Play moment' }).click()
  const panel = page.getByTestId('render-fail')
  await expect(panel).toBeVisible({ timeout: 20_000 })
  await expect(panel).toContainText('webgl → canvas')
  // The first-run control hint may sit on top (it is modal); close it like a player would.
  await dismissControlHint(page, 2000)
  await panel.getByTestId('render-fail-exit').click()
  await expect(panel).toHaveCount(0)
  await expect.poll(() => sp<boolean>(page, '!!sp.match()?.momentActive'), { timeout: 30_000 }).toBe(false)
})
