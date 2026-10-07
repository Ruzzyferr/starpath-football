import { test, expect, preferEnglish, assertCleanText, waitForApp, sp } from './fixtures'

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

test('national call-up → international match (moments simmed) → caps increase', async ({ page, shot }) => {
  test.setTimeout(240_000)
  await page.goto('/?autostart=1&seed=4242')
  await waitForApp(page)
  // A world-class hero on the eve of the first squad announcement (week 10).
  await sp(page, `(() => {
    const s = sp.state()
    for (const k of Object.keys(s.hero.attrs)) s.hero.attrs[k] = 90
    s.hero.reputation = 70; s.hero.form = 75
    s.calendar.week = 9; s.calendar.day = 6; s.calendar.slot = 2
    sp.clearEvents()
    sp.actions.advance()
    sp.clearEvents()
  })()`)
  expect(await sp<string | null>(page, 'sp.state().world.national.hero.teamId')).toBe('TR')
  await sp(page, `(() => { sp.clearEvents(); sp.navigate('home', undefined, { tab: true }) })()`)
  await expect(page.getByTestId('national-card')).toBeVisible()
  await assertCleanText(page)
  await shot('n1-home-callup')
  await sp(page, `(() => { sp.clearEvents(); sp.navigate('national') })()`)
  await page.getByRole('tab', { name: 'Squad' }).click()
  await expect(page.getByTestId('nt-squad')).toBeVisible()
  await assertCleanText(page)
  await shot('n2-national-squad')

  const caps0 = await sp<number>(page, 'sp.state().hero.nationalTeam.caps')
  const ready = await sp<boolean>(page, `(() => {
    for (let i = 0; i < 40; i++) {
      sp.clearEvents()
      const fx = sp.data.nextFixture()
      const slot = sp.state().calendar.slot
      if (fx && fx.daysUntil === 0 && slot >= 1 && fx.compType === 'international') return true
      if (fx && fx.daysUntil === 0 && slot >= 1) { sp.actions.advance(); continue }
      sp.actions.advanceToMatch()
    }
    return false
  })()`)
  expect(ready).toBe(true)
  await sp(page, `(() => { sp.clearEvents(); sp.actions.playMatch(); sp.navigate('preMatch') })()`)
  await expect(page.locator('#main')).toBeVisible()
  await assertCleanText(page)
  await shot('n3-international-prematch')
  await sp(page, `(() => { sp.navigate('liveMatch'); sp.actions.matchSetSpeed(4); sp.actions.matchPause(false) })()`)
  let moments = 0
  for (let i = 0; i < 600; i++) {
    const st = await sp<{ finished: boolean; pending: boolean } | null>(page, `(() => { const m = sp.match(); return m ? { finished: m.finished, pending: !!m.pendingMoment && !m.momentActive } : null })()`)
    if (!st || st.finished) break
    if (st.pending) {
      await sp(page, 'sp.actions.simMoment()')
      moments++
    }
    await page.waitForTimeout(100)
  }
  expect(await sp<boolean>(page, '!!sp.match()?.finished')).toBe(true)
  const minutes = await sp<number>(page, 'sp.data.postMatch().stats.minutes')
  await sp(page, `sp.navigate('postMatch')`)
  await assertCleanText(page)
  await shot('n4-international-postmatch')
  await sp(page, 'sp.actions.finishMatch()')
  const caps = await sp<number>(page, 'sp.state().hero.nationalTeam.caps')
  console.log(`[e2e] international: moments simmed ${moments}, minutes ${minutes}, caps ${caps0} → ${caps}`)
  expect(caps).toBe(caps0 + (minutes > 0 ? 1 : 0))
  expect(minutes).toBeGreaterThan(0)
})

test('season end: awards ceremony renders (podium reveal, team of the season)', async ({ page, shot }) => {
  test.setTimeout(400_000)
  await page.goto('/?autostart=1&seed=2027')
  await waitForApp(page)
  await sp(page, 'sp.toSeasonEnd()')
  await expect(page.locator('.se-root')).toBeVisible()
  const pending = await sp<number | null>(page, 'sp.state().world.awards?.ceremonyPending ?? null')
  expect(pending).not.toBeNull()
  await sp(page, `sp.navigate('awards')`)
  await expect(page.getByTestId('awards-ceremony')).toBeVisible()
  await shot('a1-ceremony-start')
  for (let i = 0; i < 3; i++) await page.getByTestId('reveal-next').click()
  await expect(page.getByTestId('podium-1')).not.toContainText('???')
  await expect(page.getByTestId('tots')).toBeVisible()
  await assertCleanText(page)
  await shot('a2-ceremony-revealed')
  await sp(page, `sp.navigate('world', { tab: 'cups' })`)
  await expect(page.getByTestId('coefficients')).toBeVisible()
  await assertCleanText(page)
  await shot('a3-world-cups')
  await sp(page, `sp.navigate('cupDraw')`)
  await expect(page.getByTestId('cup-draw')).toBeVisible()
  await page.getByRole('button', { name: 'Show all' }).click()
  await expect(page.getByTestId('draw-pair').first()).toBeVisible()
  await assertCleanText(page)
  await shot('a4-cup-draw')
})
