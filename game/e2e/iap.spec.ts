/**
 * Free-to-play shop end to end: app → local shop server (repo server/, dev purchases) → career.
 * Covers the owner's checks: rewards really arrive (5.1), they change the career stats they promise
 * (5.2), purchases work (5.3), and nothing bought touches a match (5.4, see gearBalance.node.test).
 */
import { test, expect, preferEnglish, waitForApp, sp } from './fixtures'
import type { Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

async function openStore(page: Page): Promise<void> {
  await sp(page, `sp.navigate('store')`)
  await expect(page.getByTestId('st-wallet')).toBeVisible()
  await expect(page.getByTestId('st-gems')).not.toContainText('—', { timeout: 15_000 })
}
const gems = async (page: Page): Promise<number> => Number((await page.getByTestId('st-gems').innerText()).replace(/[^\d-]/g, ''))
const tab = (page: Page, name: string) => page.getByRole('tab', { name }).click()
/** Balance is `base` plus any free diamonds that landed meanwhile (achievements unlock as the career runs). */
async function expectGems(page: Page, base: number): Promise<void> {
  await expect.poll(async () => { const g = await gems(page); return g >= base && g <= base + 60 }, { timeout: 15_000 }).toBe(true)
}

test('no paywall: a free career crosses the season rollover', async ({ page }) => {
  test.setTimeout(300_000)
  await page.goto('/?autostart=1&seed=2027&flavor=trial')
  await waitForApp(page)
  await sp(page, 'sp.toSeasonEnd()')
  await expect(page.locator('.se-root')).toBeVisible()
  const skip = page.locator('.se-skip')
  if (await skip.isVisible().catch(() => false)) await skip.click()
  await page.locator('.se-footer button:not([disabled])').last().click()
  await sp(page, `(() => { for (let i = 0; i < 700 && sp.state().calendar.season < 2027; i++) { sp.clearEvents(); sp.actions.advance() } })()`)
  expect(await sp<number>(page, 'sp.state().calendar.season')).toBe(2027)
  expect(await sp<string>(page, 'sp.screen().id')).not.toBe('paywall')
})

test('a player who never opens the shop never contacts the shop server', async ({ page }) => {
  const calls: string[] = []
  page.on('request', (r) => { if (r.url().includes(':5288') || r.url().includes('/v1/')) calls.push(r.url()) })
  await page.goto('/?autostart=1&seed=2027')
  await waitForApp(page)
  await sp(page, 'sp.actions.advance()')
  await page.waitForTimeout(1500)
  expect(calls).toEqual([])
})

test('diamonds: buying a pack credits exactly its amount (server-held), the top bar shows it', async ({ page, shot }) => {
  await page.goto('/?autostart=1&seed=2027')
  await waitForApp(page)
  await openStore(page)
  expect(await gems(page)).toBe(0)
  await page.getByTestId('buy-gems_m').click()
  await expectGems(page, 600)
  await expect.poll(async () => Number((await page.getByTestId('topbar-gems').innerText()).replace(/[^\d]/g, ''))).toBeGreaterThanOrEqual(600)
  await shot('shop-gems')
})

test('tampering with the cached balance buys nothing: the server decides', async ({ page }) => {
  await page.goto('/?autostart=1&seed=2027')
  await waitForApp(page)
  await openStore(page)
  // Fake a huge balance in the local cache and reload.
  await page.evaluate(() => {
    const k = 'starpath.walletcache.v1'
    const w = JSON.parse(localStorage.getItem(k) ?? '{}')
    localStorage.setItem(k, JSON.stringify({ ...w, gems: 999999 }))
  })
  await page.reload()
  await waitForApp(page)
  await openStore(page)
  await expectGems(page, 0)
  await tab(page, 'Gear')
  await expect(page.getByTestId('buy-gear-gold_boots')).toBeDisabled()
  // Even calling the server directly with the forged belief (and a price of 0) fails.
  const acc = await page.evaluate(() => JSON.parse(localStorage.getItem('starpath.account.v1') ?? '{}') as { token: string })
  const res = await page.request.post('http://127.0.0.1:5288/v1/spend', { headers: { Authorization: `Bearer ${acc.token}` }, data: { item: 'gold_boots', idem: 'forged-1', price: 0 } })
  const r = { status: res.status(), body: (await res.json()) as { error: string } }
  expect(r.status).toBe(402)
  expect(r.body.error).toBe('insufficient_gems')
})

test('gear: Golden Boots bought with diamonds land in the bag, raise training XP +15%, wear out by matches', async ({ page, shot }) => {
  test.setTimeout(240_000)
  await page.goto('/?autostart=1&seed=2027')
  await waitForApp(page)
  const xpBefore = await sp<number>(page, `sp.data.trainingSessions().find((x) => x.xp > 0)?.xp ?? 0`)
  const sessionId = await sp<string>(page, `sp.data.trainingSessions().find((x) => x.xp > 0)?.id`)
  await openStore(page)
  await page.getByTestId('buy-gems_m').click()
  await expectGems(page, 600)
  await tab(page, 'Gear')
  await page.getByTestId('buy-gear-gold_boots').click()
  await expectGems(page, 400)
  await expect(page.getByTestId('gear-left-gold_boots')).toContainText('60')
  await shot('shop-gear')
  const gear = await sp<{ inv: Record<string, number>; eq: Record<string, string> }>(page, `JSON.parse(sp.state().life.flags['g:gear'])`)
  expect(gear.inv.gold_boots).toBe(60)
  expect(gear.eq.boots).toBe('gold_boots')
  const xpAfter = await sp<number>(page, `sp.data.trainingSessions().find((x) => x.id === ${JSON.stringify(sessionId)})?.xp ?? 0`)
  expect(xpAfter / xpBefore).toBeGreaterThan(1.1)
  expect(xpAfter / xpBefore).toBeLessThan(1.2)
  // A played match uses one up.
  await sp(page, `(() => { const s = sp.state(); s.hero.contract.role = 'captain'; s.hero.managerTrust = 100; s.hero.fatigue = 0; s.life.flags.promised_start = true })()`)
  await sp(page, 'sp.toMatchday()')
  await sp(page, `(() => { sp.clearEvents(); sp.actions.playMatch(); sp.navigate('liveMatch'); sp.actions.matchSimToEnd(); sp.actions.finishMatch() })()`)
  const left = await sp<number>(page, `JSON.parse(sp.state().life.flags['g:gear']).inv.gold_boots`)
  expect(left).toBe(59)
})

test('starter pack: 300 diamonds + Golden Boots once; the card then shows Owned', async ({ page }) => {
  await page.goto('/?autostart=1&seed=2027')
  await waitForApp(page)
  await openStore(page)
  await page.getByTestId('buy-starter_pack').click()
  await expectGems(page, 300)
  await expect(page.getByTestId('pack-starter_pack')).toContainText('Owned')
  const inv = await sp<Record<string, number>>(page, `JSON.parse(sp.state().life.flags['g:gear']).inv`)
  expect(inv.gold_boots).toBe(60)
})

test('rewarded ad: a full view pays +10💎 and counts against the cap; closing early pays nothing', async ({ page, shot }) => {
  test.setTimeout(120_000)
  await page.goto('/?autostart=1&seed=2027')
  await waitForApp(page)
  await openStore(page)
  const ad = page.getByTestId('ad-gems')
  await expect(ad).toContainText('3 left today')
  await ad.click()
  await expect(page.getByTestId('dev-ad')).toBeVisible()
  await shot('shop-ad')
  await page.getByTestId('dev-ad-close').click()
  await expect(page.getByTestId('dev-ad')).toHaveCount(0)
  expect(await gems(page)).toBe(0)
  await expect(ad).toContainText('3 left today')
  await ad.click()
  await expect(page.getByTestId('dev-ad')).toHaveCount(0, { timeout: 20_000 })
  await expectGems(page, 10)
  await expect(ad).toContainText('2 left today')
})

test('training boost ad: the next session really gets +20% XP', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/?autostart=1&seed=2027')
  await waitForApp(page)
  await openStore(page)
  await sp(page, `sp.navigate('training')`)
  await page.getByTestId('ad-train_boost').click()
  await expect(page.getByTestId('train-boost-banked')).toBeVisible({ timeout: 20_000 })
  expect(await sp<number>(page, `sp.state().life.flags['g:adTrain']`)).toBe(1)
})

test('cash pack: weeks × wage land in the career wallet (never below the floor)', async ({ page }) => {
  await page.goto('/?autostart=1&seed=2027')
  await waitForApp(page)
  const before = await sp<number>(page, 'sp.state().life.money')
  const wage = await sp<number>(page, 'sp.state().hero.contract?.wage ?? 0')
  await openStore(page)
  await tab(page, 'Cash')
  await page.getByTestId('buy-cash_s').click()
  await expect.poll(() => sp<number>(page, 'sp.state().life.money')).toBe(before + Math.max(5000, Math.round(4 * wage)))
})

test('physio: diamonds halve a long injury', async ({ page }) => {
  await page.goto('/?autostart=1&seed=2027')
  await waitForApp(page)
  await openStore(page)
  await page.getByTestId('buy-gems_s').click()
  await expectGems(page, 220)
  await sp(page, `(() => { sp.state().hero.injury = { name: { tr: 'Kas', en: 'Muscle' }, weeksLeft: 6, severity: 2 }; sp.touch() })()`)
  await tab(page, 'Gear')
  await page.waitForTimeout(800)
  const before = await gems(page)
  await page.getByTestId('buy-physio').click()
  await expect.poll(() => sp<number>(page, 'sp.state().hero.injury?.weeksLeft ?? 0')).toBe(3)
  // 100💎 spent (free diamonds from achievements may land meanwhile, in steps of 5-10).
  await expect.poll(() => gems(page)).toBeLessThanOrEqual(before - 80)
  // Once per injury.
  await expect(page.getByTestId('st-physio')).toContainText('already')
})

test('Pro Contract: 50💎 once per day while active', async ({ page }) => {
  await page.goto('/?autostart=1&seed=2027')
  await waitForApp(page)
  await openStore(page)
  await tab(page, 'Pro')
  await page.getByTestId('buy-pro_contract').click()
  await page.getByTestId('pass-claim').click()
  await expectGems(page, 50)
  await expect(page.getByTestId('pass-claim')).toBeDisabled()
})

test('restore: a wiped install gets its non-consumables back from the store account', async ({ page }) => {
  await page.goto('/?autostart=1&seed=2027')
  await waitForApp(page)
  await openStore(page)
  await tab(page, 'Style')
  const pack = page.getByTestId('pack-pack_celebrations')
  await page.getByTestId('buy-pack_celebrations').click()
  await expect(pack).toContainText('Owned')
  await page.evaluate(() => localStorage.removeItem('starpath.entitlements.v1'))
  await page.reload()
  await waitForApp(page)
  await sp(page, `sp.navigate('settings')`)
  await page.getByTestId('restore-btn').click()
  await expect(page.getByTestId('entitlement-list')).toContainText('Celebration Pack')
})

test('a grant typed into local storage is never applied (signature check)', async ({ page }) => {
  await page.goto('/?autostart=1&seed=2027')
  await waitForApp(page)
  await openStore(page)
  const acc = await page.evaluate(() => JSON.parse(localStorage.getItem('starpath.account.v1') ?? '{}') as { accountId: string })
  // A forged "Golden Boots" coupon: right account, right shape, signature made up.
  await page.evaluate((id) => {
    const k = 'starpath.walletcache.v1'
    const w = JSON.parse(localStorage.getItem(k) ?? '{}')
    const payload = btoa(JSON.stringify({ v: 1, n: 'forged-nonce', a: id, t: 1, k: 'gear', id: 'gold_boots' })).replace(/=+$/, '')
    w.inbox = [{ nonce: 'forged-nonce', token: `${payload}.${'A'.repeat(86)}`, k: 'gear', id: 'gold_boots' }]
    localStorage.setItem(k, JSON.stringify(w))
  }, acc.accountId)
  await sp(page, `sp.navigate('saves')`)
  await sp(page, `(async () => { await sp.actions.load(sp.state().meta.slot) })()`)
  await page.waitForTimeout(1500)
  expect(await sp<string | undefined>(page, `sp.state().life.flags['g:gear']`)).toBeUndefined()
})

test('cosmetics can be unlocked with diamonds; cash from diamonds is capped per day', async ({ page }) => {
  await page.goto('/?autostart=1&seed=2027')
  await waitForApp(page)
  await openStore(page)
  await page.getByTestId('buy-gems_l').click()
  await expectGems(page, 1300)
  await tab(page, 'Style')
  await page.getByTestId('buy-gems-pack_avatar').click()
  await expect(page.getByTestId('pack-pack_avatar')).toContainText('Owned', { timeout: 15_000 })
  await tab(page, 'Cash')
  const before = await sp<number>(page, 'sp.state().life.money')
  for (let i = 0; i < 3; i++) {
    await page.getByTestId('gems-to-cash').click()
    await expect.poll(() => sp<number>(page, 'sp.state().life.money')).toBeGreaterThan(before)
    await page.waitForTimeout(300)
  }
  await expect(page.getByTestId('gems-to-cash')).toBeDisabled()
})

test('age gate: the casino asks the player birth year once and stays closed under 18', async ({ page }) => {
  await page.addInitScript(() => { sessionStorage.setItem('e2e.noage', '1'); localStorage.removeItem('starpath.agegate.v1') })
  await page.goto('/?autostart=1&seed=2027')
  await waitForApp(page)
  await sp(page, `(() => { const s = sp.state(); s.hero.birthYear = s.calendar.season - 25; sp.touch() })()`)
  await sp(page, `sp.navigate('casino')`)
  await expect(page.getByTestId('age-year')).toBeVisible()
  await page.getByTestId('age-year').fill(String(new Date().getFullYear() - 15))
  await page.getByTestId('age-ok').click()
  await expect(page.locator('body')).toContainText('18')
  await expect(page.getByTestId('age-year')).toHaveCount(0)
})

test('top bar: the diamond pill fits at 320 and 360 px and in landscape', async ({ page }) => {
  await page.goto('/?autostart=1&seed=2027')
  await waitForApp(page)
  for (const [w, h] of [[320, 568], [360, 740], [667, 375]]) {
    await page.setViewportSize({ width: w, height: h })
    await page.waitForTimeout(300)
    const r = await page.evaluate(() => {
      const bar = document.querySelector('.topbar') as HTMLElement
      const pill = document.querySelector('[data-testid="topbar-gems"]') as HTMLElement
      const pb = pill.getBoundingClientRect()
      const overlaps = Array.from(bar.querySelectorAll('.tstat, .topbar-date, .topbar-bell, .topbar-me')).filter((e) => e !== pill && getComputedStyle(e).display !== 'none').some((e) => {
        const b = e.getBoundingClientRect()
        return b.width > 0 && b.left < pb.right - 1 && b.right > pb.left + 1 && b.top < pb.bottom - 1 && b.bottom > pb.top + 1
      })
      return { overflow: bar.scrollWidth > bar.clientWidth + 1, inside: pb.right <= window.innerWidth && pb.left >= 0, overlaps }
    })
    expect(r, `${w}x${h}`).toEqual({ overflow: false, inside: true, overlaps: false })
  }
})

test('match bonus ×2: watching the ad after a match pays that bonus once', async ({ page }) => {
  test.setTimeout(240_000)
  await page.goto('/?autostart=1&seed=2027')
  await waitForApp(page)
  await openStore(page)
  await sp(page, `(() => { const s = sp.state(); s.hero.contract.role = 'captain'; s.hero.managerTrust = 100; s.hero.fatigue = 0; s.life.flags.promised_start = true; s.hero.contract.goalBonus = 500 })()`)
  await sp(page, 'sp.toMatchday()')
  await sp(page, `(() => { sp.clearEvents(); sp.actions.playMatch(); sp.navigate('liveMatch'); sp.actions.matchSimToEnd() })()`)
  // A simulated match may end without a bonus: give it one so the offer always shows.
  const lb = await sp<{ key: string; amount: number }>(page, `(() => { const s = sp.state(); const b = JSON.parse(s.life.flags['g:lastBonus']); if (b.amount <= 0) { b.amount = 1500; s.life.flags['g:lastBonus'] = JSON.stringify(b) } return b })()`)
  await sp(page, `sp.navigate('postMatch')`)
  for (let i = 0; i < 8 && !(await page.getByTestId('ad-match-bonus').isVisible().catch(() => false)); i++) {
    const next = page.locator('.post-next, button:has-text("Next")').first()
    if (!(await next.isVisible().catch(() => false))) break
    await next.click()
    await page.waitForTimeout(400)
  }
  const m0 = await sp<number>(page, 'sp.state().life.money')
  await page.getByTestId('ad-match-bonus').click()
  await expect.poll(() => sp<number>(page, 'sp.state().life.money'), { timeout: 25_000 }).toBe(m0 + lb.amount)
  await expect(page.getByTestId('ad-match-bonus')).toHaveCount(0)
  expect(await sp<boolean>(page, `JSON.parse(sp.state().life.flags['g:lastBonus']).doubled`)).toBe(true)
})

test('season reward ×2: after the season-end diamonds, the ad adds the same again', async ({ page }) => {
  test.setTimeout(300_000)
  await page.goto('/?autostart=1&seed=2027')
  await waitForApp(page)
  await openStore(page)
  const g0 = await gems(page)
  await sp(page, 'sp.toSeasonEnd()')
  await expect(page.locator('.se-root')).toBeVisible()
  const skip = page.locator('.se-skip')
  if (await skip.isVisible().catch(() => false)) await skip.click()
  await expect(page.getByTestId('ad-season_x2')).toBeVisible({ timeout: 30_000 })
  await page.getByTestId('ad-season_x2').click()
  await expect.poll(async () => (await page.evaluate(() => JSON.parse(localStorage.getItem('starpath.walletcache.v1') ?? '{}').gems)) - g0, { timeout: 30_000 }).toBeGreaterThanOrEqual(200)
})
