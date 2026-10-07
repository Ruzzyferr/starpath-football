/**
 * Audio (WP-3): the AudioContext stays untouched until the first gesture,
 * unlocks on the first click, plays the menu track, mixer settings persist,
 * and the audio lab can drive every system without errors.
 */
import { test, expect, preferEnglish, waitForApp } from './fixtures'
import type { Page } from '@playwright/test'

interface AudioDebug {
  state: string
  music: string | null
  crowdActive: boolean
  crowdReady: boolean
  errors: number
  mix: Record<string, number | boolean>
}

const dbg = (page: Page) => page.evaluate(() => (window as unknown as { __spAudio: { debug(): AudioDebug } }).__spAudio.debug())

test('audio unlocks on first click and the menu music starts', async ({ page }) => {
  await preferEnglish(page)
  await page.goto('/')
  await waitForApp(page)
  await page.waitForFunction(() => !!(window as unknown as { __spAudio?: unknown }).__spAudio)
  // No context before any user gesture (autoplay policy).
  expect((await dbg(page)).state).toBe('none')
  await page.mouse.click(4, 4)
  await expect.poll(async () => (await dbg(page)).state, { timeout: 10_000 }).toBe('running')
  const d = await dbg(page)
  expect(d.music).toBe('menu')
  expect(d.errors).toBe(0)

  // Mixer sliders persist.
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.locator('#set-master').fill('40')
  await page.locator('#set-crowd').fill('25')
  await expect.poll(async () => (await dbg(page)).mix.master).toBe(0.4)
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('starpath.settings.v1') ?? '{}'))
  expect(saved.masterVolume).toBe(0.4)
  expect(saved.crowdVolume).toBe(0.25)
  await page.getByRole('switch', { name: /Mute all audio/ }).click({ force: true })
  await expect.poll(async () => (await dbg(page)).mix.muted).toBe(true)
  await page.reload()
  await waitForApp(page)
  await page.mouse.click(4, 4)
  await expect.poll(async () => (await dbg(page)).mix.muted).toBe(true)
  expect((await dbg(page)).mix.master).toBe(0.4)
  expect((await dbg(page)).errors).toBe(0)
})

test('audio lab drives music, crowd, UI and match SFX without errors', async ({ page }) => {
  await page.goto('/audio-lab.html')
  await page.waitForFunction(() => !!(window as unknown as { __renderAudio?: unknown }).__renderAudio)
  const click = (name: string) => page.getByRole('button', { name, exact: true }).first().click()
  await click('▶ menu')
  await expect.poll(async () => (await dbg(page)).state).toBe('running')
  await click('▶ tension')
  await click('victory')
  await click('crowd ON')
  await expect.poll(async () => (await dbg(page)).crowdReady, { timeout: 30_000 }).toBe(true)
  await expect.poll(async () => (await dbg(page)).crowdActive).toBe(true)
  for (const b of ['goal (home)', 'goal (away)', 'ooh (home)', 'yellow for away', 'time wasting', 'chant 1', 'tap', 'moneyIn', 'levelUp', 'kick shot', 'whistle full', 'post (full)']) await click(b)
  await page.waitForTimeout(1500)
  // A short offline render through the real mixer stays below -1 dBFS.
  const res = await page.evaluate(() => (window as unknown as { __renderAudio(id: string): Promise<{ stats: { peakDb: number; nan: number; rmsDb: number } }> }).__renderAudio('sting-victory'))
  expect(res.stats.nan).toBe(0)
  expect(res.stats.peakDb).toBeLessThan(-1)
  expect(res.stats.rmsDb).toBeGreaterThan(-45)
  expect((await dbg(page)).errors).toBe(0)
})
