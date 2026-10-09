/**
 * UI playtest regressions, career & meta (docs/PLAYTEST-UI.md): retired saves,
 * contract numbers, negotiation outcomes, scouting cards, internationals,
 * squad numbers and the Golden Boot wording.
 */
import type { Page } from '@playwright/test'
import { test, expect, preferEnglish, assertCleanText, sp, waitForApp } from './fixtures'

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

async function career(page: Page, seed = 2718): Promise<void> {
  await page.goto(`/?autostart=1&seed=${seed}`)
  await waitForApp(page)
  await sp(page, 'sp.clearEvents()')
}

test('PT-C1: a retired career is not playable: Home and Continue land on the documentary', async ({ page, shot }) => {
  await career(page)
  await sp(page, `(() => { const s = sp.state(); s.hero.birthYear = s.calendar.season - 35; sp.actions.planSlot(0, null); sp.navigate('profile', undefined, { tab: true }) })()`)
  await page.getByTestId('profile-retire').click()
  await page.getByTestId('retire-go').click()
  await page.getByTestId('retire-confirm').click()
  await expect(page.getByTestId('documentary')).toBeVisible({ timeout: 20_000 })
  // No shell (tabs / Advance) around the ending.
  await expect(page.locator('.home-cta-main')).toHaveCount(0)
  await sp(page, `sp.navigate('home', undefined, { tab: true })`)
  await expect(page.getByTestId('documentary')).toBeVisible()
  await expect(page.locator('.home-grid')).toHaveCount(0)
  await sp(page, `sp.navigate('title', undefined, { tab: true })`)
  await page.locator('.title-continue').click()
  await expect(page.getByTestId('documentary')).toBeVisible()
  await assertCleanText(page)
  await shot('ptc-retired-continue')
})

test('PT-C2: Home and the Contract screen agree on the seasons left', async ({ page }) => {
  await career(page)
  const tile = await page.locator('.home-tile', { hasText: 'Contract' }).innerText()
  const n = tile.match(/(\d+) seasons? left/)?.[1]
  expect(n).toBeTruthy()
  await sp(page, `sp.navigate('contract')`)
  await expect(page.locator('.ctr-term')).toContainText(`${n} season`)
})

/** Open a renewal with the hero's own club (contract in its last season). */
async function openRenewal(page: Page): Promise<boolean> {
  await sp(page, `(() => { const s = sp.state(); s.hero.contract.untilSeason = s.calendar.season; s.hero.managerTrust = 80; sp.navigate('contract'); sp.actions.openNegotiation(s.hero.contract.clubId) })()`)
  return page.getByRole('button', { name: 'Send proposal' }).isVisible({ timeout: 5000 }).catch(() => false)
}

test('PT-C3: the club leaving the table reads as a collapse, not "you walked away"', async ({ page, shot }) => {
  await career(page, 4242)
  test.skip(!(await openRenewal(page)), 'no renewal offer in this world')
  const wage = page.locator('.ctr-nego input[type=range], input[type=range]').first()
  for (let i = 0; i < 25; i++) {
    const send = page.getByRole('button', { name: 'Send proposal' })
    if (!(await send.isVisible().catch(() => false))) break
    await wage.focus()
    await page.keyboard.press('End')
    await send.click()
    await page.waitForTimeout(150)
  }
  await expect(page.locator('.ctr-outcome')).toBeVisible()
  const head = (await page.locator('.ctr-outcome h2').textContent())?.trim()
  if (head !== 'Deal done!') {
    expect(head).toBe('Talks collapsed')
    await expect(page.locator('.ctr-outcome')).not.toContainText('You ended talks')
  }
  await shot('ptc-club-walkout')
})

test('PT-C3b: walking away yourself still says so', async ({ page }) => {
  await career(page, 4242)
  test.skip(!(await openRenewal(page)), 'no renewal offer in this world')
  await sp(page, 'sp.actions.walkAway()')
  await expect(page.locator('.ctr-outcome h2')).toHaveText('You walked away')
})

test('PT-C4: scouting-only clubs cannot open talks (no dead end into your own contract)', async ({ page }) => {
  await career(page)
  await sp(page, `sp.navigate('world', { tab: 'interest' })`)
  const cards = page.locator('.world-int')
  await expect(cards.first()).toBeVisible()
  const n = await cards.count()
  for (let i = 0; i < n; i++) {
    const card = cards.nth(i)
    const talk = card.getByTestId('interest-talk')
    if ((await card.getByTestId('interest-no-offer').count()) > 0) await expect(talk).toBeDisabled()
    else await expect(talk).toBeEnabled()
  }
  // Wage ranges are weekly.
  await expect(page.getByTestId('interest-facts').first()).toContainText('/wk')
})

test('PT-C5: an international fixture shows the hero nation as home side and a real venue', async ({ page }) => {
  test.setTimeout(240_000)
  await career(page, 4242)
  await sp(page, `(() => {
    const s = sp.state()
    for (const k of Object.keys(s.hero.attrs)) s.hero.attrs[k] = 90
    s.hero.reputation = 70; s.hero.form = 75
    s.calendar.week = 9; s.calendar.day = 6; s.calendar.slot = 2
    sp.clearEvents(); sp.actions.advance(); sp.clearEvents()
  })()`)
  const fx = await sp<{ home: { id: string }; away: { id: string }; isHome: boolean; venue: string } | null>(page, `(() => {
    for (let i = 0; i < 40; i++) {
      sp.clearEvents()
      const fx = sp.data.nextFixture()
      if (fx && fx.compType === 'international') return fx
      sp.actions.advanceToMatch(); sp.actions.advance()
    }
    return null
  })()`)
  test.skip(!fx, 'no international reached')
  expect(fx!.isHome).toBe(fx!.home.id.split(':')[0] === 'TR')
  expect(fx!.venue).not.toBe('—')
})

test('PT-C6: squad numbers are unique', async ({ page }) => {
  await career(page)
  await sp(page, `sp.navigate('club')`)
  const nums = await page.getByTestId('squad-num').allInnerTexts()
  expect(nums.length).toBeGreaterThan(10)
  expect(new Set(nums).size).toBe(nums.length)
})

test('PT-C7: the trophy cabinet stops suggesting an award already won', async ({ page }) => {
  await career(page)
  await sp(page, `(() => { const s = sp.state(); s.hero.awards.push({ season: s.calendar.season, key: 'league_top_scorer', name: { tr: 'Lig Gol Kralı', en: 'League Top Scorer' } }); sp.navigate('trophies') })()`)
  await expect(page.locator('.cab-item.is-empty').first()).toBeVisible()
  await expect(page.locator('.cab-cabinet')).not.toContainText('League top scorer')
})
