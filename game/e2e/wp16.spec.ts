/**
 * WP-16 presentation polish: the four new celebrations render in the match
 * scene, quality profiles change crowd density and the particle budget,
 * Settings shows Graphics (profile + flashes off), Privacy and a no-network
 * Cloud placeholder, and the post-match flow has an earnings step.
 */
import type { Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect, preferEnglish, waitForApp, sp, assertCleanText, SHOTS } from './fixtures'

const OUT = process.env.WP16_SHOTS || SHOTS
mkdirSync(OUT, { recursive: true })

async function snap(page: Page, project: string, name: string) {
  await page.screenshot({ path: join(OUT, `wp16-${project}-${name}.png`) })
}

interface SceneDebug {
  phase: string
  mode: string
  celebration: string | null
  quality: string
  crowdDensity: number
  particlesAlive: number
  particleBudget: number
}

async function waitLive(page: Page) {
  await page.waitForFunction(
    () => (window as unknown as { __spScene?: { debugInfo(): { phase: string } } }).__spScene?.debugInfo().phase === 'live',
    undefined,
    { timeout: 60_000 },
  )
}
const info = (page: Page) => page.evaluate(() => (window as unknown as { __spScene: { debugInfo(): SceneDebug } }).__spScene.debugInfo())

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

for (const celeb of ['robot', 'heart_hands', 'ice_cold', 'cartwheel'] as const) {
  test(`celebration renders: ${celeb}`, async ({ page }, ti) => {
    test.skip(ti.project.name === 'mobile' && celeb !== 'robot', 'one mobile sample is enough')
    await page.goto(`/match-demo.html?kind=counter&seed=5&celeb=${celeb}&cap=72000`)
    await waitLive(page)
    // Start the celebration directly (the scene's goal path calls the same method).
    await page.evaluate(() => (window as unknown as { __spScene: { startCelebration(): void } }).__spScene.startCelebration())
    await expect.poll(async () => (await info(page)).celebration).toBe(celeb)
    await page.waitForTimeout(celeb === 'cartwheel' ? 1750 : 2000)
    await snap(page, ti.project.name, `celeb-${celeb}`)
  })
}

test('quality profiles: crowd density and particle budget follow the profile', async ({ page }, ti) => {
  const seen: Record<string, SceneDebug> = {}
  for (const q of ['low', 'medium', 'high'] as const) {
    await page.goto(`/match-demo.html?kind=counter&seed=5&cap=72000&q=${q}`)
    await waitLive(page)
    // Fire a goal-sized confetti burst through the budget, twice.
    // Wide view of the far stand, then goal-sized confetti bursts through the budget.
    await page.evaluate(() => {
      type Em = unknown
      const s = (window as unknown as { __spScene: { debugOverview(on: boolean): void; confetti: Em; burst(em: Em, n: number, x: number, y: number): void; fxN(n: number, life: number): number } }).__spScene
      s.debugOverview(true)
      for (let i = 0; i < 6; i++) s.burst(s.confetti, s.fxN(90, 2600), 816 + (i - 3) * 60, -20)
    })
    seen[q] = await info(page)
    await page.waitForTimeout(700)
    expect(seen[q].quality).toBe(q)
    expect(seen[q].particlesAlive).toBeLessThanOrEqual(seen[q].particleBudget)
    await snap(page, ti.project.name, `quality-${q}`)
  }
  expect(seen.low.crowdDensity).toBeLessThan(seen.medium.crowdDensity)
  expect(seen.medium.crowdDensity).toBeLessThan(seen.high.crowdDensity)
  expect(seen.low.particleBudget).toBeLessThan(seen.high.particleBudget)
})

test('settings: graphics profile + flashes off, privacy, cloud coming soon (no network)', async ({ page }, ti) => {
  const requests: string[] = []
  await page.goto('/?autostart=1&seed=4242')
  await waitForApp(page)
  page.on('request', (r) => {
    if (!/localhost|127\.0\.0\.1|fonts\.(googleapis|gstatic)/.test(r.url())) requests.push(r.url())
  })
  await sp(page, `sp.navigate('settings')`)
  const q = page.getByTestId('quality-setting')
  await expect(q).toBeVisible()
  // Auto ran the device benchmark on first launch.
  await expect(page.getByTestId('quality-detected')).toContainText(/Device test: (Low|Medium|High)/)
  await q.getByRole('radio', { name: 'Low' }).click()
  let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('starpath.settings.v1') ?? '{}') as Record<string, unknown>)
  expect(stored).toMatchObject({ quality: 'low', lowFx: true })
  await expect(page.locator('html')).toHaveAttribute('data-quality', 'low')
  // Flashes off is independent of the profile.
  await page.getByRole('switch', { name: /Disable flashes/ }).click()
  await q.getByRole('radio', { name: 'High' }).click()
  stored = await page.evaluate(() => JSON.parse(localStorage.getItem('starpath.settings.v1') ?? '{}') as Record<string, unknown>)
  expect(stored).toMatchObject({ quality: 'high', lowFx: false, reduceFlashes: true })
  await expect(page.locator('html')).toHaveAttribute('data-flash', 'off')

  await expect(page.getByTestId('privacy-section')).toContainText(/stored on this device only/)
  const cloud = page.getByTestId('cloud-section')
  await expect(cloud).toContainText('Coming soon')
  await expect(cloud.getByRole('button', { name: 'Turn on cloud save' })).toBeDisabled()
  await assertCleanText(page)
  await q.scrollIntoViewIfNeeded()
  await snap(page, ti.project.name, 'settings-graphics')
  await cloud.scrollIntoViewIfNeeded()
  await snap(page, ti.project.name, 'settings-privacy-cloud')
  expect(requests).toEqual([])
})

test('post-match: earnings step itemises real contract money', async ({ page }, ti) => {
  test.skip(ti.project.name === 'mobile', 'flow covered on desktop; layout shot below is enough')
  await page.goto('/?autostart=1&seed=4242')
  await waitForApp(page)
  await sp(page, 'sp.toMatchday()')
  await sp(page, "(() => { const s = sp.state(); s.hero.contract.role = 'captain'; s.hero.contract.goalBonus = 500; s.hero.managerTrust = 100; s.hero.form = 90; s.hero.fatigue = 0; s.hero.sharpness = 100; s.life.flags.promised_start = true })()")
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Play match' }).click()
  await page.getByRole('button', { name: 'Kick off' }).click()
  await expect(page.locator('.lm-root')).toBeVisible()
  const card = page.locator('.lm-moment')
  for (let i = 0; i < 20; i++) {
    if (await card.count()) await card.getByRole('button', { name: 'Sim moment' }).click()
    const simBtn = page.getByRole('button', { name: 'Sim to the end' })
    if (await simBtn.isEnabled().catch(() => false)) {
      await simBtn.click()
      break
    }
    await page.waitForTimeout(200)
  }
  await expect(page.locator('.lm-fulltime')).toBeVisible({ timeout: 30_000 })
  await page.locator('.lm-fulltime').getByRole('button', { name: 'Continue' }).click()
  await page.getByTestId('post-step-earnings').click()
  const e = page.getByTestId('post-earnings')
  await expect(e).toBeVisible()
  const wage = await sp(page, 'sp.state().hero.contract.wage')
  await expect(page.getByTestId('earn-wage')).toBeVisible()
  await expect(page.getByTestId('earn-tax')).toBeVisible()
  expect(Number(wage)).toBeGreaterThan(0)
  await assertCleanText(page)
  await page.waitForTimeout(900)
  await snap(page, ti.project.name, 'postmatch-earnings')
})
