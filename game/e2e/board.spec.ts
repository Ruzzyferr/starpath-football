/**
 * Local-first meta (GAP 2.10): records board (weekly challenge, career ranking,
 * personal bests), share card PNG + CSV export, What's New.
 */
import AxeBuilder from '@axe-core/playwright'
import { test, expect, preferEnglish, assertCleanText, sp, waitForApp } from './fixtures'

const entry = (id: string, name: string, goals: number, legacy: number) => ({
  careerId: id, name, firstName: name.split(' ')[0], lastName: name.split(' ')[1], nickname: '', gender: 'm', nationality: 'TR', position: 'ST',
  birthYear: 2008, startSeason: 2026, endSeason: 2043, age: 35, ovr: 80, peakOvr: 86, clubs: ['Ankara FK', 'Madrid FC'],
  timeline: [{ season: 2026, clubName: 'Ankara FK', leagueName: 'Anadolu Ligi', apps: 30, goals: 12, assists: 4, avgRating: 7.1, leaguePosition: 3, trophies: [] }],
  totals: { apps: 500, goals, assists: 120, motm: 30, cleanSheets: 0, avgRating: 7.2 }, caps: 40, intGoals: 12,
  trophies: [{ season: 2030, name: { tr: 'Lig', en: 'League' } }], awards: [], bestMoments: [], netWorth: 5e6, followers: 1e6, reputation: 90,
  legacyScore: legacy, breakdown: [], testimonial: null, forced: null, retiredAt: 1, difficulty: 'normal',
})

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
  await page.addInitScript((data) => {
    if (!localStorage.getItem('starpath.meta.v1')) localStorage.setItem('starpath.meta.v1', JSON.stringify(data))
  }, {
    version: 1,
    achievements: { unlocked: {}, best: {}, counters: {} },
    hallOfFame: [entry('c1', 'Emre Kaya', 210, 900), entry('c2', 'Deniz Arda', 340, 700)],
    local: {
      challenges: { '2026:2': { id: 'win', rating: 7.4, opponent: 'Rival FC' } }, streak: 1, bestStreak: 3, lastKey: '2026:2',
      bests: { bestRating: 9.1, goalsMatch: 4, assistsMatch: 2, biggestWin: 5, matches: 40 }, seen: [], seenVersion: '',
    },
  })
})

test('records board: weekly challenge, ranking, bests', async ({ page, shot }) => {
  await page.goto('/?autostart=1&seed=77')
  await waitForApp(page)
  await sp(page, `sp.navigate('board')`)
  await expect(page.getByTestId('weekly-challenge')).toBeVisible()
  await page.waitForTimeout(5000)
  await shot('b1-challenge')
  await page.getByRole('tab', { name: /Career ranking/ }).click()
  const rows = page.locator('[data-testid=career-board] > li')
  await expect(rows).toHaveCount(2)
  await expect(rows.first()).toContainText('Emre Kaya')
  await page.getByRole('radio', { name: 'Goals' }).click()
  await expect(rows.first()).toContainText('Deniz Arda')
  await page.waitForTimeout(1000)
  await shot('b2-ranking')
  await page.getByRole('tab', { name: /Personal bests/ }).click()
  await page.waitForTimeout(1200)
  await expect(page.getByTestId('personal-bests')).toContainText('9.1')
  await shot('b3-bests')
  await assertCleanText(page)
})

test('share card downloads a PNG and the CSV export works', async ({ page }) => {
  // No OS share sheet in the test browser: exercise the download fallback.
  await page.addInitScript(() => Object.defineProperty(navigator, 'share', { value: undefined }))
  await page.goto('/?autostart=1&seed=77')
  await waitForApp(page)
  await sp(page, `sp.navigate('board')`)
  await page.getByRole('tab', { name: /Career ranking/ }).click()
  const [png] = await Promise.all([page.waitForEvent('download'), page.getByTestId('share-career').first().click()])
  expect(png.suggestedFilename()).toMatch(/\.png$/)
  if (process.env.E2E_SHOTS) await png.saveAs(`${process.env.E2E_SHOTS}/card-career.png`)
  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-csv').first().click()])
  expect(csv.suggestedFilename()).toMatch(/\.csv$/)
})

test('whats new screen lists the changes and is remembered', async ({ page, shot }) => {
  await page.goto('/?autostart=1&seed=77')
  await waitForApp(page)
  await sp(page, `sp.navigate('whatsNew')`)
  await expect(page.getByTestId('whats-new').locator('li')).toHaveCount(4)
  await page.waitForTimeout(1500)
  await shot('b4-whatsnew')
  const seen = await page.evaluate(() => JSON.parse(localStorage.getItem('starpath.meta.v1') ?? '{}').local?.seenVersion)
  expect(seen).toBeTruthy()
})

test('post-match summary offers a share card', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'share', { value: undefined }))
  await page.goto('/?autostart=1&seed=315&dev=postMatch')
  await waitForApp(page)
  expect(await sp<string>(page, `sp.screen().id`)).toBe('postMatch')
  for (let i = 0; i < 8 && !(await page.getByTestId('share-match').count()); i++) {
    const next = page.getByTestId('post-next')
    if (!(await next.count())) break
    await next.click()
  }
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('share-match').click()])
  expect(dl.suggestedFilename()).toMatch(/\.png$/)
  if (process.env.E2E_SHOTS) await dl.saveAs(`${process.env.E2E_SHOTS}/card-match.png`)
})

test('records and whats-new have no serious axe violations', async ({ page }) => {
  await page.goto('/?autostart=1&seed=77')
  await waitForApp(page)
  for (const id of ['board', 'whatsNew']) {
    await sp(page, `sp.navigate('${id}')`)
    await page.waitForTimeout(800)
    for (const tab of id === 'board' ? [/Weekly/, /Career ranking/, /Personal bests/] : [null]) {
      if (tab) await page.getByRole('tab', { name: tab }).click()
      await page.waitForTimeout(800)
      const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      expect(res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([])
    }
  }
})
