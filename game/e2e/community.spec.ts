/**
 * Local-first community & live-ops (GAP 2.10): season calendar + news of the day,
 * milestone timeline, data-only mods, local feedback form, online switch.
 */
import AxeBuilder from '@axe-core/playwright'
import { test, expect, preferEnglish, assertCleanText, sp, waitForApp } from './fixtures'

const cities = Array.from({ length: 12 }, (_, i) => `Town ${String.fromCharCode(65 + i)}`)
const mod = {
  format: 'starpath-mod', id: 'northern-isles', version: '1.0.0', name: 'Northern Isles',
  countries: [{
    id: 'NIS', name: { tr: 'Kuzey Adaları', en: 'Northern Isles' }, adjective: { tr: 'Adalı', en: 'Islander' }, flag: ['#112233', '#FFFFFF', '#AA0000'],
    reputation: 40, nameStyle: 'english', leagueNames: ['Isles Premier', 'Isles Division One', 'Isles Division Two'], cupName: { tr: 'Ada Kupası', en: 'Isles Cup' }, cities,
  }],
}

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
  await page.addInitScript(() => {
    if (!localStorage.getItem('starpath.meta.v1')) {
      localStorage.setItem('starpath.meta.v1', JSON.stringify({
        version: 1, achievements: { unlocked: {}, best: {}, counters: {} }, hallOfFame: [],
        local: { challenges: { '2026:2': { id: 'win', rating: 7.4, opponent: 'Rival FC' } }, streak: 1, bestStreak: 3, lastKey: '2026:2', bests: { bestRating: 9.1, goalsMatch: 4, assistsMatch: 2, biggestWin: 5, matches: 40 }, seen: [], seenVersion: '' },
      }))
    }
  })
})

test('calendar, news of the day and timeline', async ({ page, shot }) => {
  await page.goto('/?autostart=1&seed=77')
  await waitForApp(page)
  await sp(page, `sp.navigate('community')`)
  await expect(page.getByTestId('season-event')).toBeVisible()
  await expect(page.getByTestId('event-calendar').locator('li')).toHaveCount(7)
  await expect(page.getByTestId('news-of-the-day').locator('li').first()).toBeVisible()
  await page.waitForTimeout(5000)
  await shot('c1-today')
  await page.getByRole('tab', { name: /Journey/ }).click()
  await expect(page.getByTestId('milestone-timeline').locator('li').first()).toBeVisible()
  await page.waitForTimeout(1200)
  await shot('c2-story')
  await assertCleanText(page)
})

test('mods: valid pack is kept as unsigned, invalid pack is rejected', async ({ page, shot }) => {
  await page.goto('/?autostart=1&seed=77')
  await waitForApp(page)
  await sp(page, `sp.navigate('community')`)
  await page.getByRole('tab', { name: /Mods/ }).click()
  await page.getByTestId('mod-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"starpath-mod","script":"x"}') })
  await expect(page.getByTestId('mod-list')).toHaveCount(0)
  await page.getByTestId('mod-file').setInputFiles({ name: 'isles.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(mod)) })
  await expect(page.getByTestId('mod-list')).toContainText('Northern Isles')
  await expect(page.getByTestId('mod-list')).toContainText('Unsigned')
  await page.waitForTimeout(1500)
  await shot('c3-mods')
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('starpath.meta.v1') ?? '{}').local?.mods?.length)
  expect(stored).toBe(1)
})

test('feedback is saved locally and exported as a file', async ({ page, shot }) => {
  await page.goto('/?autostart=1&seed=77')
  await waitForApp(page)
  await sp(page, `sp.navigate('community')`)
  await page.getByRole('tab', { name: /Feedback/ }).click()
  await page.getByTestId('feedback-text').fill('The weekly challenge card overlaps on small phones.')
  await page.getByTestId('feedback-save').click()
  await expect(page.getByTestId('feedback-list').locator('li')).toHaveCount(1)
  await page.waitForTimeout(1200)
  await shot('c4-feedback')
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('feedback-export').click()])
  expect(dl.suggestedFilename()).toMatch(/starpath-feedback\.json$/)
})

test('online switch is off by default and persists; notification prompt waits for a cleared challenge', async ({ page, shot }) => {
  await page.goto('/?autostart=1&seed=77')
  await waitForApp(page)
  await sp(page, `sp.navigate('board')`)
  await expect(page.getByTestId('notify-prompt')).toBeVisible()
  await page.getByTestId('notify-prompt').getByRole('button', { name: 'No thanks' }).click()
  await expect(page.getByTestId('notify-prompt')).toHaveCount(0)
  await sp(page, `sp.navigate('community')`)
  await page.getByRole('tab', { name: /Online/ }).click()
  await expect(page.getByTestId('online-state')).toHaveText('Off')
  await page.getByRole('switch', { name: /Online features/ }).click()
  await expect(page.getByTestId('online-state')).toHaveText('On')
  await expect(page.getByTestId('notify-state')).toContainText('off')
  await page.waitForTimeout(1200)
  await shot('c5-about')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('starpath.meta.v1') ?? '{}').local?.online)).toBe(true)
})

test('community has no serious axe violations', async ({ page }) => {
  await page.goto('/?autostart=1&seed=77')
  await waitForApp(page)
  await sp(page, `sp.navigate('community')`)
  for (const tab of [/Calendar/, /Journey/, /Mods/, /Feedback/, /Online/]) {
    await page.getByRole('tab', { name: tab }).click()
    await page.waitForTimeout(800)
    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([])
  }
})
