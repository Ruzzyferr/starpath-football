import { test, expect, preferEnglish, assertCleanText, startWithDecisionCard, sp } from './fixtures'

/**
 * Decision cards show honest odds before choosing and can really fail
 * (tester feedback, TestFlight build 5: "whatever I choose it always says things went well").
 */
test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

test('event odds: the card shows "Chance: N%" with its factors, and a struggling hero sees a choice backfire', async ({ page, shot }) => {
  await startWithDecisionCard(page)
  const modal = page.locator('.modal-root')
  await expect(modal).toBeVisible()

  // Every choice carries an odds chip (a percentage or "No risk").
  const chips = modal.getByTestId('evt-odds')
  await expect(chips.first()).toBeVisible()
  expect(await chips.count()).toBe(await modal.locator('.evt-choice').count())
  await expect(modal.locator('.evt-odds').filter({ hasText: /Chance: \d+%/ }).first()).toBeVisible()
  await assertCleanText(page)
  await shot('odds1-card')

  // Same card, a hero at rock bottom: low morale, exhausted, stressed, everyone against him.
  await sp(page, `(() => {
    const s = sp.state()
    for (const k of Object.keys(s.hero.attrs)) s.hero.attrs[k] = 15
    s.hero.morale = 3; s.hero.form = 5; s.hero.fatigue = 100; s.hero.managerTrust = 0; s.hero.reputation = 1
    s.life.stress = 100; s.life.energy = 5; s.life.discipline = 5; s.life.money = 0; s.life.bank.savings = 0; s.life.casino.addiction = 100
    for (const r of Object.values(s.life.relationships)) r.value = -100
    sp.touch()
  })()`)
  const pcts = await modal.locator('.evt-odds b').allInnerTexts()
  const nums = pcts.map((x) => Number(x.replace(/\D/g, ''))).filter((n) => Number.isFinite(n))
  expect(nums.length).toBeGreaterThan(0)
  expect(Math.min(...nums)).toBeLessThan(35)
  await expect(modal.locator('.evt-factor.is-neg').first()).toBeVisible()
  await shot('odds2-card-weak')

  // Pick the worst-odds rolled choice: under this seed it backfires.
  const choices = modal.locator('.evt-choice')
  const n = await choices.count()
  let worst = -1
  let worstPct = 101
  for (let i = 0; i < n; i++) {
    const c = choices.nth(i)
    if (await c.isDisabled()) continue
    if (!(await c.locator('.evt-odds b').count())) continue // certain choice: no odds to roll
    const txt = await c.locator('.evt-odds b').first().innerText().catch(() => '')
    const p = Number(txt.replace(/\D/g, ''))
    if (txt && p < worstPct) { worstPct = p; worst = i }
  }
  expect(worst).toBeGreaterThanOrEqual(0)
  await choices.nth(worst).click()
  const out = modal.getByTestId('evt-outcome')
  await expect(out).toBeVisible()
  await expect(out).toHaveAttribute('data-tier', /fail|mixed/)
  await expect(out).toContainText(/It backfired|It half worked/)
  await expect(out).toContainText(`Your chance was ${worstPct}%`)
  await assertCleanText(page)
  await page.waitForTimeout(1200) // let the outcome animation settle for the screenshot
  await shot('odds3-outcome-fail')
})
