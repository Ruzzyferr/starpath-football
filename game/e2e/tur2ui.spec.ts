import { test, expect, preferEnglish, assertCleanText, waitForApp, sp } from './fixtures'
import AxeBuilder from '@axe-core/playwright'

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

test('tur2 UI: season form, comeback, addiction, foundation, collapsed log', async ({ page, shot }) => {
  test.setTimeout(120_000)
  await page.goto('/?autostart=1&seed=4242')
  await waitForApp(page)
  await sp(page, `(() => {
    const s = sp.state()
    s.hero.reputation = 70
    s.hero.birthYear = s.calendar.season - 32
    s.hero.injury = { name: { tr: 'Çapraz bağ', en: 'Cruciate ligament' }, weeksLeft: 20, severity: 3 }
    s.life.casino.addiction = 45
    s.life.flags.foundation = true
    s.life.flags.foundation_funds = 5
    for (let i = 0; i < 6; i++) s.life.log.push({ season: s.calendar.season, week: 3 + i, day: 1, text: { tr: 'Kumar düşüncesi', en: 'Gambling thoughts will not leave' }, kind: 'event' })
    sp.clearEvents()
    sp.navigate('home', undefined, { tab: true })
  })()`)
  await page.waitForTimeout(5000)
  await expect(page.getByTestId('comeback-card')).toBeVisible()
  await expect(page.getByTestId('addiction-meter')).toBeVisible()
  await expect(page.getByTestId('nt-seasonform')).toBeVisible()
  await assertCleanText(page)
  await shot('t2-home')
  const axe = await new AxeBuilder({ page }).analyze()
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])

  await sp(page, `(() => { sp.clearEvents(); sp.navigate('life', { tab: 'business' }, { tab: true }) })()`)
  await page.waitForTimeout(5000)
  await expect(page.getByTestId('foundation-card')).toBeVisible()
  await expect(page.getByTestId('addiction-meter')).toBeVisible()
  await shot('t2-life-business')

  await sp(page, `(() => { sp.clearEvents(); sp.navigate('careerLog') })()`)
  await page.waitForTimeout(5000)
  await expect(page.locator('.log-repeat').first()).toContainText('×6')
  await shot('t2-log')

  await sp(page, `(() => { sp.clearEvents(); sp.navigate('home', undefined, { tab: true }) })()`)
  await page.getByTestId('comeback-stay').click()
  await expect(page.getByTestId('comeback-card')).toHaveCount(0)
})
