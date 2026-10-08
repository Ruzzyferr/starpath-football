/**
 * WP-V rewatch + render: goal reel (stored input replayed in the Phaser scene), clip export
 * (behind a capability check), attribute growth on the Profile, slot thumbnails on the Saves
 * screen and the Low-quality render-scale cap.
 */
import type { Page } from '@playwright/test'
import { test, expect, preferEnglish, assertCleanText, waitForApp, sp } from './fixtures'

const KIND = 'edge_of_box'
const SEED = 7

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

async function boot(page: Page) {
  await page.goto('/?autostart=1&seed=4242')
  await waitForApp(page)
  await expect(page.locator('.home-grid')).toBeVisible()
  await sp(page, 'sp.clearEvents()')
  await page.keyboard.press('Escape')
}

const canClip = (page: Page) =>
  page.evaluate(() => typeof MediaRecorder === 'function' && typeof HTMLCanvasElement.prototype.captureStream === 'function' && MediaRecorder.isTypeSupported('video/webm'))

test('goal reel: a stored goal replays to the same outcome as the headless replay', async ({ page, shot }) => {
  test.setTimeout(240_000)
  await boot(page)
  const expected = await page.evaluate(async ([kind, seed]) => {
    const imp = (p: string) => import(/* @vite-ignore */ p)
    const probe = await imp('/src/game/reelProbe.ts')
    const dh = await imp('/src/game/demoHighlights.ts')
    const sh = await imp('/src/sim/game/saveHistory.ts')
    const w = window as unknown as { __sp: { state(): { calendar: { season: number; week: number }; replays?: unknown[] } } }
    const rec = probe.scriptedRecording(kind, seed)
    const s = w.__sp.state()
    s.replays = [{ season: s.calendar.season, week: s.calendar.week, minute: 61, rec: sh.packRecording(rec), hl: dh.makeDemoHighlight(kind, seed, 'en', 72) }]
    return JSON.stringify(probe.headlessOutcome(kind, seed, rec))
  }, [KIND, SEED] as const)

  await sp(page, `sp.navigate('profile')`)
  const card = page.getByTestId('goal-reel')
  await card.scrollIntoViewIfNeeded()
  await expect(card.getByTestId('reel-watch')).toHaveCount(1)
  await page.waitForTimeout(5000)
  await shot('reel-card')
  await assertCleanText(page)

  await card.getByTestId('reel-watch').click()
  await expect(page.getByTestId('reel-stage').locator('canvas')).toBeVisible({ timeout: 30_000 })
  if (await canClip(page)) {
    await expect(page.getByTestId('clip-record')).toBeVisible()
    // No OS share sheet in the test browser: take the download path.
    await page.evaluate(() => { Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true }) })
    const download = page.waitForEvent('download', { timeout: 30_000 })
    await page.getByTestId('clip-record').click()
    await expect(page.getByTestId('clip-stop')).toBeVisible()
    await page.waitForTimeout(1500)
    await shot('reel-recording')
    await page.getByTestId('clip-stop').click()
    expect((await download).suggestedFilename()).toMatch(/\.webm$/)
  } else {
    await expect(page.getByTestId('clip-record')).toHaveCount(0)
  }

  await expect(page.getByTestId('reel-done')).toBeVisible({ timeout: 120_000 })
  const got = await page.evaluate(() => JSON.stringify((window as unknown as { __spLastReel: unknown }).__spLastReel))
  expect(got).toBe(expected)
  await shot('reel-done')
})

test('goal reel: scene playback matches the headless replay regardless of live settings', async ({ page }) => {
  test.setTimeout(180_000)
  await page.goto('/match-demo.html?kind=edge_of_box&seed=3')
  await page.waitForFunction(() => !!(window as unknown as { __spReel?: unknown }).__spReel, undefined, { timeout: 30_000 })
  const r = await page.evaluate(async ([kind, seed]) => {
    type Reel = { scripted(k: string, s: number): unknown; headless(k: string, s: number, r: unknown): unknown; play(k: string, s: number, r: unknown): Promise<unknown> }
    const reel = (window as unknown as { __spReel: Reel }).__spReel
    const rec = reel.scripted(kind, seed)
    const head = JSON.stringify(reel.headless(kind, seed, rec))
    const a = JSON.stringify(await reel.play(kind, seed, rec))
    const b = JSON.stringify(await reel.play(kind, seed, rec))
    return { head, a, b }
  }, [KIND, SEED] as const)
  expect(r.a).toBe(r.head)
  expect(r.b).toBe(r.head)
})

test('clip export records the match canvas to WebM when the browser supports it', async ({ page }) => {
  await page.goto('/match-demo.html?kind=edge_of_box&seed=3&auto=1')
  await page.waitForFunction(() => !!(window as unknown as { __spReel?: unknown }).__spReel, undefined, { timeout: 30_000 })
  test.skip(!(await canClip(page)), 'MediaRecorder / captureStream / WebM not available in this browser')
  await page.waitForTimeout(1500)
  const clip = await page.evaluate(() => (window as unknown as { __spReel: { clip(ms: number): Promise<{ size: number; type: string; capped: boolean } | null> } }).__spReel.clip(1500))
  expect(clip).not.toBeNull()
  expect(clip!.type).toBe('video/webm')
  expect(clip!.size).toBeGreaterThan(1000)
  expect(clip!.capped).toBe(true)
})

test('Low quality caps the canvas render scale at 1.25x on a 2x display', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  const ratio = async (q: string) => {
    await page.goto(`/match-demo.html?kind=edge_of_box&seed=3&q=${q}`)
    await page.waitForFunction(() => !!document.querySelector('#stage canvas'), undefined, { timeout: 30_000 })
    await page.waitForTimeout(800)
    return page.evaluate(() => {
      const c = document.querySelector('#stage canvas') as HTMLCanvasElement
      return c.width / c.getBoundingClientRect().width
    })
  }
  const low = await ratio('low')
  const high = await ratio('high')
  await ctx.close()
  expect(low).toBeLessThanOrEqual(1.3)
  expect(high).toBeGreaterThan(1.6)
})

test('Profile shows attribute growth against a season ago', async ({ page, shot }) => {
  await boot(page)
  await page.evaluate(() => {
    type S = { calendar: { season: number; week: number }; hero: { attrs: Record<string, number> }; attrHistory?: { v: 1; keys: string[]; rows: number[][] } }
    const s = (window as unknown as { __sp: { state(): S } }).__sp.state()
    const keys = Object.keys(s.hero.attrs)
    const row = (season: number, week: number, d: number) => [season, week, ...keys.map((k) => Math.max(1, Math.round(s.hero.attrs[k] - d)))]
    const { season, week } = s.calendar
    s.attrHistory = { v: 1, keys, rows: [row(season - 1, 37, 6), row(season, 2, 4), row(season, 10, 2), row(season, week, 0)] }
  })
  await sp(page, `sp.navigate('profile')`)
  const card = page.getByTestId('attr-growth')
  await card.scrollIntoViewIfNeeded()
  await expect(card.locator('svg.prof-radar')).toBeVisible()
  await expect(card.locator('.prof-radar-past')).toHaveCount(1)
  await expect(page.getByTestId('attr-growth-list').locator('li').first()).toContainText('+')
  await page.waitForTimeout(5000)
  await shot('attr-growth')
  await assertCleanText(page)
})

test('Saves screen shows a portrait thumbnail per saved slot', async ({ page, shot }) => {
  await boot(page)
  await sp(page, `sp.navigate('saves')`)
  const card = page.locator('.saves-card').first()
  await card.getByRole('button', { name: /Save here|Overwrite/ }).click()
  await expect(card).not.toHaveClass(/is-empty/)
  await expect(page.getByTestId('slot-thumb-1').locator('svg')).toBeVisible()
  await page.waitForTimeout(5000)
  await shot('saves-thumb')
})
