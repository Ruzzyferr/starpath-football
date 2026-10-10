/**
 * Short interactive moments (owner: one-tap tasks felt empty): the national
 * camp check-in, the manager's office and the team dinner as dialogue scenes,
 * the doping test as a calm mini-game and the 1-on-1 as a pair drill — each
 * with a quick resolve, keyboard answers and an outcome card that shows what
 * moved.
 */
import type { Page } from '@playwright/test'
import { test, expect, preferEnglish, waitForApp, sp, assertCleanText } from './fixtures'

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

/** An in-season non-matchday morning at a club, no cards pending. */
async function inSeason(page: Page, seed = 4242) {
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

/** Put a mandatory task on today's agenda (and the national coach for the camp). */
async function injectTask(page: Page, kind: 'nationalCamp' | 'dopingTest') {
  await page.evaluate((k) => {
    const w = window as unknown as { __sp: { state: () => { life: { flags: Record<string, unknown>; relationships: Record<string, unknown> } }; touch: () => void } }
    const s = w.__sp.state()
    const a = JSON.parse(String(s.life.flags['c:agenda'] ?? 'null')) as { day: number; tasks: { mandatory: boolean }[] }
    const T = (tr: string, en: string) => ({ tr, en })
    a.tasks = a.tasks.filter((x) => !x.mandatory)
    a.tasks.unshift(k === 'nationalCamp'
      ? { id: `m:${k}:${a.day}`, mandatory: true, kind: k, title: T('Milli takım kampı', 'National team camp'), why: T('Kampa katılım.', 'Camp check-in and medical.'), reward: T('Hızlı: moral +2', 'Quick: checked in, morale +2'), play: { scene: 'nationalCamp' } } as never
      : { id: `m:${k}:${a.day}`, mandatory: true, kind: k, title: T('Doping testi', 'Doping test'), why: T('Sürpriz kontrol.', 'A surprise control: you must give a sample.'), reward: T('Hızlı: disiplin +1', 'Quick: clean test, discipline +1'), play: { game: 'doping' } } as never)
    s.life.flags['c:agenda'] = JSON.stringify(a)
    if (!s.life.relationships.nt_coach) s.life.relationships.nt_coach = { id: 'nt_coach', kind: 'manager', name: 'Vincenzo Ricci', value: 10, memory: [], lastContactWeek: 0 }
    w.__sp.touch()
  }, kind)
}

test('national camp check-in is a three-line talk with the coach', async ({ page, shot }) => {
  await inSeason(page, 777)
  await injectTask(page, 'nationalCamp')
  const task = page.getByTestId('ag-task-nationalCamp')
  await task.scrollIntoViewIfNeeded()
  await task.getByTestId('ag-play').click()
  const scene = page.getByTestId('scene-nationalCamp')
  await expect(scene).toBeVisible()
  await expect(scene.getByRole('button', { name: /^Answer 1:/ })).toBeFocused()
  await page.waitForTimeout(600)
  await shot('moment-camp')
  // Answer with the keyboard and the mouse.
  await page.keyboard.press('2')
  await expect(scene.getByTestId('scene-opt-starter')).toBeVisible()
  await page.waitForTimeout(400)
  await shot('moment-camp-step2')
  await scene.getByTestId('scene-opt-team').click()
  await scene.getByTestId('scene-opt-learn').click()
  await expect(scene.getByTestId('scene-result')).toBeVisible()
  await expect(scene.getByTestId('scene-effects')).toContainText(/Relation with/)
  await page.waitForTimeout(900)
  await shot('moment-camp-result')
  await assertCleanText(page)
  await scene.getByTestId('scene-done').click()
  await expect(scene).toHaveCount(0)
  await expect(task).toHaveAttribute('data-done', 'played')
})

test('doping test: breathe in the band, sign the forms in order', async ({ page, shot }) => {
  await inSeason(page, 31)
  await injectTask(page, 'dopingTest')
  const task = page.getByTestId('ag-task-dopingTest')
  await task.scrollIntoViewIfNeeded()
  await task.getByTestId('ag-play').click()
  const dlg = page.getByTestId('doping')
  await expect(dlg).toBeVisible()
  await page.waitForTimeout(400)
  await shot('moment-doping-intro')
  await dlg.getByTestId('doping-start').click()
  const hold = dlg.getByTestId('doping-hold')
  await expect(hold).toBeVisible()
  await expect(dlg.getByRole('meter', { name: 'Breathing rhythm' })).toBeVisible()
  // Pulse the breath: hold and release, roughly following the band.
  const box = (await hold.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  for (let i = 0; i < 6; i++) {
    await page.mouse.down()
    await page.waitForTimeout(700)
    if (i === 2) await shot('moment-doping-breath')
    await page.mouse.up()
    await page.waitForTimeout(800)
  }
  await expect(dlg.getByTestId('doping-form-consent')).toBeVisible({ timeout: 8000 })
  await page.waitForTimeout(300)
  await shot('moment-doping-forms')
  await dlg.getByTestId('doping-form-seal').click() // wrong order first: a mistake
  await dlg.getByTestId('doping-form-consent').click()
  await dlg.getByTestId('doping-form-seal').click()
  await dlg.getByTestId('doping-form-declare').click()
  await expect(dlg.getByTestId('doping-result')).toBeVisible()
  await expect(dlg.getByTestId('scene-effects')).toContainText('Composure')
  await page.waitForTimeout(600)
  await shot('moment-doping-result')
  await dlg.getByTestId('doping-done').click()
  await expect(task).toHaveAttribute('data-done', 'played')
})

test('doping test keeps a quick resolve', async ({ page }) => {
  await inSeason(page, 32)
  await injectTask(page, 'dopingTest')
  const task = page.getByTestId('ag-task-dopingTest')
  await task.scrollIntoViewIfNeeded()
  await task.getByTestId('ag-play').click()
  await page.getByTestId('doping-quick').click()
  await expect(page.getByTestId('doping')).toHaveCount(0)
  await expect(task).toHaveAttribute('data-done', 'quick')
})

test('talk to the manager: two choices, the start chance moves', async ({ page, shot }) => {
  await inSeason(page, 99)
  const trust0 = await sp<number>(page, 'sp.state().hero.managerTrust')
  await sp(page, "sp.moment('talk')")
  const scene = page.getByTestId('scene-managerTalk')
  await expect(scene).toBeVisible()
  await page.waitForTimeout(600)
  await shot('moment-talk')
  await scene.getByTestId('scene-opt-ask').click()
  await scene.getByTestId('scene-opt-detail').click()
  await expect(scene.getByTestId('scene-result')).toBeVisible()
  await expect(scene.getByTestId('scene-effects')).toContainText('Manager trust')
  await page.waitForTimeout(900)
  await shot('moment-talk-result')
  await scene.getByTestId('scene-done').click()
  expect(await sp<number>(page, 'sp.state().hero.managerTrust')).toBeGreaterThan(trust0)
  // Once a week: a second try explains why and opens nothing.
  await sp(page, "sp.moment('talk')")
  await expect(page.getByTestId('scene-managerTalk')).toHaveCount(0)
})

test('team dinner: pick a seat, a topic and the bill', async ({ page, shot }) => {
  await inSeason(page, 5)
  await page.evaluate(() => {
    const w = window as unknown as { __sp: { state: () => { calendar: { slot: number }; life: { energy: number; money: number } }; touch: () => void } }
    const s = w.__sp.state()
    s.calendar.slot = 2
    s.life.energy = 100
    s.life.money = Math.max(s.life.money, 5000)
    w.__sp.touch()
  })
  const fx = await sp<{ daysUntil: number } | null>(page, 'sp.data.nextFixture()')
  test.skip(!!fx && fx.daysUntil <= 1, 'no dinner the night before a match')
  const money0 = await sp<number>(page, 'sp.state().life.money')
  await sp(page, "sp.moment('teamDinner')")
  const scene = page.getByTestId('scene-teamDinner')
  await expect(scene).toBeVisible()
  await page.waitForTimeout(600)
  await shot('moment-dinner')
  await scene.getByTestId('scene-opt-sitA').click()
  await scene.getByTestId('scene-opt-jokes').click()
  await page.waitForTimeout(300)
  await shot('moment-dinner-step3')
  await scene.getByTestId('scene-opt-pay').click()
  await expect(scene.getByTestId('scene-result')).toBeVisible()
  await expect(scene.getByTestId('scene-effects')).toContainText('Teammates')
  await page.waitForTimeout(900)
  await shot('moment-dinner-result')
  await scene.getByTestId('scene-done').click()
  expect(await sp<number>(page, 'sp.state().life.money')).toBeLessThan(money0)
})

test('one-on-one opens the pair drill with a quick option', async ({ page, shot }) => {
  await inSeason(page, 11)
  await page.evaluate(() => {
    const w = window as unknown as { __sp: { state: () => { calendar: { slot: number }; life: { energy: number } }; touch: () => void } }
    const s = w.__sp.state()
    s.calendar.slot = 0
    s.life.energy = 100
    w.__sp.touch()
  })
  await sp(page, "sp.moment('oneOnOne')")
  const quick = page.getByTestId('drill-quick')
  await expect(quick).toBeVisible()
  await page.waitForTimeout(600)
  await shot('moment-1on1')
  const slot0 = await sp<number>(page, 'sp.state().calendar.slot')
  await quick.click()
  await expect(quick).toHaveCount(0)
  expect(await sp<number>(page, 'sp.state().calendar.slot')).toBeGreaterThan(slot0)
})
