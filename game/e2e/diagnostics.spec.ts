/**
 * Remote diagnosis of a game screen that hangs on a player's device (telemetry/breadcrumbs,
 * DiagnosticsPanel, lastRunNotice) and compatibility mode (platform/renderMode):
 *  - Settings › Diagnostics shows the device facts, breadcrumbs and errors, and copies them;
 *  - a run that ended mid-start shows a one-time notice naming the last stage;
 *  - a trial start leaves its breadcrumbs, and compatibility mode starts drills on Canvas.
 */
import type { Page } from '@playwright/test'
import { test, expect, waitForApp, sp } from './fixtures'

async function english(page: Page, extra: Record<string, string> = {}): Promise<void> {
  await page.addInitScript((extra) => {
    try {
      const k = 'starpath.settings.v1'
      if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify({ lang: 'en', reducedMotion: false }))
      for (const [key, v] of Object.entries(extra)) if (!sessionStorage.getItem(`seeded:${key}`)) {
        localStorage.setItem(key, v)
        sessionStorage.setItem(`seeded:${key}`, '1')
      }
    } catch { /* ignore */ }
  }, extra)
}

const crumbs = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('sp.diag.crumbs') ?? '[]') as { stage: string; info?: string }[])

test('Settings › Diagnostics: device facts, graphics choice, breadcrumbs, errors and Copy', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await english(page)
  await page.goto('/?autostart=1&seed=4242')
  await waitForApp(page)
  await sp(page, `sp.navigate('settings')`)
  const panel = page.getByTestId('diagnostics')
  await panel.scrollIntoViewIfNeeded()
  await expect(panel).toBeVisible()
  const text = await page.getByTestId('diagnostics-text').inputValue()
  expect(text).toMatch(/WebView: Chrome \d+/)
  expect(text).toMatch(/OS: /)
  expect(text).toMatch(/WebGL: /)
  expect(text).toMatch(/Quality: /)
  expect(text).toContain('Compatibility mode: off')
  expect(text).toMatch(/Renderer: (webgl|canvas)/)
  expect(text).toContain('Breadcrumbs')
  expect(text).toContain('app-boot')
  expect(text).toContain('Last errors')
  await page.getByTestId('diagnostics-copy').click()
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText()).catch(() => ''), { timeout: 5000 }).toContain('StarPath Diagnostics')
})

test('a run that ended mid-start shows a one-time notice with the last stage; Settings keeps it', async ({ page }) => {
  const at = Date.now() - 60_000
  await english(page, {
    'sp.diag.crumbs': JSON.stringify([
      { at, stage: 'start', info: 'trial · finishing · medium' },
      { at: at + 50, stage: 'chunk-loaded' },
      { at: at + 80, stage: 'drill-created', info: 'finishing' },
      { at: at + 90, stage: 'phaser-build', info: 'drill webgl' },
      { at: at + 400, stage: 'phaser-built', info: 'webgl · Adreno (TM) 618' },
      { at: at + 420, stage: 'scene-create', info: 'drill' },
    ]),
    'sp.diag.hb': JSON.stringify({ since: at + 90, raf: at + 420, rafN: 4, timer: at + 430, timerN: 2 }),
  })
  await page.goto('/')
  await waitForApp(page)
  const notice = page.getByTestId('last-run-notice')
  await expect(notice).toBeVisible()
  await expect(notice).toContainText('scene-create')
  // Web: compatibility mode is an Android shell switch; it is not turned on automatically here.
  await expect(notice).toHaveAttribute('data-compat', '0')
  await page.getByTestId('last-run-ok').click()
  await expect(notice).toHaveCount(0)
  await page.reload()
  await waitForApp(page)
  await page.waitForTimeout(800)
  await expect(page.getByTestId('last-run-notice')).toHaveCount(0)
  await sp(page, `sp.navigate('settings')`)
  const text = await page.getByTestId('diagnostics-text').inputValue()
  expect(text).toContain('Last start did not finish: trial · finishing · medium → scene-create')
  expect(text).toContain('main thread hung')
  // The GPU path misbehaved: the panel does not open a WebGL context itself.
  expect(text).toContain('WebGL: not probed · last: webgl · Adreno (TM) 618')
})

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

test('a trial start leaves its breadcrumbs; compatibility mode starts the drill on Canvas; Quit ends the run', async ({ page }) => {
  await english(page, { 'sp.render.software': JSON.stringify({ on: true }) })
  await toTrials(page)
  await page.locator('.trial-card').first().getByRole('button', { name: 'Play the trial' }).click()
  await page.getByTestId('trial-start').click()
  await expect(page.locator('.trn-drill canvas')).toBeVisible({ timeout: 20_000 })
  await expect.poll(async () => (await crumbs(page)).map((c) => c.stage), { timeout: 10_000 }).toContain('render-ok')
  const stages = (await crumbs(page)).map((c) => c.stage)
  for (const s of ['trial-intro', 'start', 'chunk-loaded', 'drill-created', 'phaser-build', 'phaser-built', 'scene-create', 'scene-ready', 'first-frame', 'render-ok']) expect(stages).toContain(s)
  expect((await crumbs(page)).find((c) => c.stage === 'phaser-build')?.info).toBe('drill canvas')
  expect(await page.evaluate(() => (globalThis as { __spTraining?: { game: { renderer: { type: number } } } }).__spTraining?.game.renderer.type)).toBe(1) // Phaser.CANVAS
  // Quit is the overlay's last child and answers the first touch.
  expect(await page.evaluate(() => document.querySelector('.trn-drill')?.lastElementChild?.getAttribute('data-testid'))).toBe('drill-quit')
  await page.getByTestId('drill-quit').tap().catch(() => page.getByTestId('drill-quit').click())
  await expect(page.getByTestId('trial-drill')).toHaveCount(0)
  const after = (await crumbs(page)).map((c) => c.stage)
  expect(after).toContain('quit-tap')
  expect(after[after.length - 1]).toBe('exit')
})
