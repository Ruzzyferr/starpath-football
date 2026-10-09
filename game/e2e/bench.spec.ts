/**
 * Path off the bench + daily agenda (owner feedback: "always on the bench",
 * "a footballer's every moment is planned"): selection meter, today's
 * programme with a mandatory task that blocks Advance, the one-confirm skip,
 * the coach's challenge and a playable U21 game through the live match flow.
 */
import { test, expect, preferEnglish, waitForApp, sp, assertCleanText } from './fixtures'

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

/** Reach an in-season non-matchday morning at a club, with no cards pending. */
async function inSeason(page: import('@playwright/test').Page, seed = 4242) {
  await page.goto(`/?autostart=1&seed=${seed}`)
  await waitForApp(page)
  await sp(page, 'sp.toMatchday()')
  await sp(page, 'sp.actions.advance()')
  await sp(page, 'sp.clearEvents()')
  for (let i = 0; i < 12; i++) {
    const fx = await sp<{ daysUntil: number } | null>(page, 'sp.data.nextFixture()')
    const slot = await sp<number>(page, 'sp.state().calendar.slot')
    if (fx && fx.daysUntil >= 2 && slot === 0) break
    await sp(page, 'sp.actions.advance()')
    await sp(page, 'sp.clearEvents()')
  }
  const dlg = page.getByRole('dialog')
  if (await dlg.count()) await dlg.getByRole('button', { name: 'Close' }).first().click()
}

/** Put a mandatory task on today's agenda (deterministic UI check). */
async function injectTask(page: import('@playwright/test').Page, kind: string, choices = true) {
  await page.evaluate(([k, c]) => {
    const w = window as unknown as { __sp: { state: () => { life: { flags: Record<string, unknown> } }; touch: () => void } }
    const s = w.__sp.state()
    const a = JSON.parse(String(s.life.flags['c:agenda'] ?? 'null')) as { day: number; tasks: unknown[] }
    const T = (tr: string, en: string) => ({ tr, en })
    a.tasks.unshift({
      id: `m:${k}:${a.day}`, mandatory: true, kind: k, title: T('Basın toplantısı', 'Press conference'), why: T('Maç öncesi.', 'Before the match.'),
      reward: T('Hızlı: basın +1', 'Quick: press +1'), skip: T('Basın −5', 'Press −5'),
      ...(c ? { play: { choices: [{ id: 'humble', label: T('Alçakgönüllü', 'Humble'), hint: T('Basın +3', 'Press +3') }] } } : {}),
    })
    s.life.flags['c:agenda'] = JSON.stringify(a)
    w.__sp.touch()
  }, [kind, choices] as const)
}

test('Home shows the selection meter and today’s programme', async ({ page, shot }) => {
  await inSeason(page)
  await expect(page.getByTestId('selection-meter')).toBeVisible()
  await expect(page.getByTestId('agenda')).toBeVisible()
  await expect(page.getByTestId('selection-meter').getByRole('meter')).toHaveAttribute('aria-valuenow', /\d+/)
  await page.waitForTimeout(5000)
  await shot('bench-home')
  await page.getByTestId('selection-meter').scrollIntoViewIfNeeded()
  await page.waitForTimeout(800)
  await shot('bench-meter')
  await assertCleanText(page)
})

test('a mandatory task blocks Advance until it is decided', async ({ page, shot }) => {
  await inSeason(page, 777)
  await injectTask(page, 'pressConference')
  const task = page.getByTestId('ag-task-pressConference')
  await expect(task).toBeVisible()
  await expect(page.getByTestId('advance-blocked')).toBeVisible()
  await expect(page.locator('[data-tour="advance"]').first()).toBeDisabled()
  await task.scrollIntoViewIfNeeded()
  await page.waitForTimeout(5000)
  await shot('agenda-mandatory')
  await task.getByTestId('ag-decide').click()
  await task.getByTestId('ag-choice-humble').click()
  await expect(task).toHaveAttribute('data-done', 'played')
  await expect(page.getByTestId('advance-blocked')).toHaveCount(0)
  await page.waitForTimeout(1000)
  await shot('agenda-done')
})

test('skip to matchday asks once to quick-resolve the open tasks', async ({ page, shot }) => {
  await inSeason(page, 31)
  await injectTask(page, 'pressConference', false)
  await sp(page, 'sp.actions.advanceToMatch()')
  const modal = page.getByRole('dialog')
  await expect(modal).toBeVisible()
  await page.waitForTimeout(5000)
  await shot('agenda-skip-confirm')
  await page.getByTestId('ag-skip-all').click()
  await expect(modal).toHaveCount(0)
  const fx = await sp<{ daysUntil: number } | null>(page, 'sp.data.nextFixture()')
  expect(fx?.daysUntil ?? 0).toBeLessThanOrEqual(1)
})

test('the coach’s challenge opens a drill with a target grade', async ({ page, shot }) => {
  await inSeason(page, 99)
  await sp(page, "sp.navigate('training', { challenge: '1' }, { tab: true })")
  const banner = page.getByTestId('drill-challenge')
  if (await banner.count() === 0) {
    await expect(page.getByTestId('coach-challenge')).toBeVisible()
    await page.getByTestId('challenge-start').click()
  }
  await expect(page.getByTestId('drill-challenge')).toBeVisible()
  await page.waitForTimeout(5000)
  await shot('challenge-intro')
})

test('a U21 game plays through pre-match, live and post-match', async ({ page, shot }) => {
  await inSeason(page, 5)
  await page.evaluate(() => {
    const w = window as unknown as { __sp: { state: () => { hero: { contract: { role: string } }; calendar: { slot: number }; life: { energy: number } }; touch: () => void } }
    const s = w.__sp.state()
    s.hero.contract.role = 'reserve'
    s.calendar.slot = 0
    s.life.energy = 100
    w.__sp.touch()
  })
  const idea = page.getByTestId('idea-reserve')
  test.skip(await idea.count() === 0, 'no U21 game on offer today')
  await idea.click()
  await expect(page.getByTestId('pm-planned')).toBeVisible()
  await page.waitForTimeout(5000)
  await shot('reserve-prematch')
  await sp(page, 'sp.actions.matchSimToEnd()')
  await sp(page, "sp.navigate('postMatch')")
  await page.waitForTimeout(1500)
  await shot('reserve-post')
  const st = await sp<{ activeMatchId: string | null }>(page, 'sp.state()')
  expect(st.activeMatchId).toBeNull()
})
