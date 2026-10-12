/**
 * "Ben / Me" stats hub (playtest: "I can't find my fame level"): one tap from Home opens it,
 * and it shows fame (level, next threshold), all 30 attributes and the items the hero owns.
 * Runs on desktop, mobile Chromium and WebKit iPhone.
 */
import type { Page } from '@playwright/test'
import { test, expect, preferEnglish, assertCleanText, waitForApp, sp } from './fixtures'

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

/** Start a career with one owned item, on Home. */
async function startWithItem(page: Page): Promise<string> {
  await page.goto('/?autostart=1&seed=99')
  await waitForApp(page)
  await sp(page, 'sp.clearEvents()')
  const name = await sp<string>(page, `(() => {
    const s = sp.state()
    s.life.money = 5_000_000
    sp.touch()
    const a = sp.data.assetCatalog().filter((x) => !x.minReputation && x.category !== 'business').sort((x, y) => x.price - y.price)[0]
    if (!sp.actions.buy(a.id)) throw new Error('buy failed')
    return a.name.en
  })()`)
  await sp(page, `sp.navigate('home', undefined, { tab: true })`)
  await expect(page.locator('.home-grid')).toBeVisible()
  return name
}

async function noSideScroll(page: Page): Promise<void> {
  const over = await page.evaluate(() => {
    const els = [document.documentElement, document.querySelector('.shell-content')].filter(Boolean) as Element[]
    return els.map((e) => e.scrollWidth - e.clientWidth)
  })
  for (const o of over) expect(o, 'horizontal overflow').toBeLessThanOrEqual(1)
}

async function cleanHubText(page: Page): Promise<void> {
  await assertCleanText(page)
  const text = await page.locator('#main').innerText()
  expect(text, 'raw hub i18n key').not.toMatch(/\bhub\.[a-z][A-Za-z]+/)
}

test('the Me hub opens in one tap from Home and shows fame, attributes and items', async ({ page, shot }, info) => {
  const itemName = await startWithItem(page)
  const rep = await sp<number>(page, 'sp.state().hero.reputation')

  // Fame is visible at a glance on Home.
  const chip = page.getByTestId('home-fame-chip')
  await expect(chip).toBeVisible()
  await expect(chip).toContainText('Fame:')
  await shot('hub-0-home')

  // One tap: the avatar in the top bar (phone) / the hero button in the sidebar (desktop).
  const entry = info.project.name === 'desktop' ? page.getByTestId('sidebar-me') : page.getByTestId('topbar-me')
  await expect(entry).toBeVisible()
  await entry.click()
  expect(await sp<string>(page, 'sp.screen().id')).toBe('me')

  const head = page.getByTestId('hub-head')
  await expect(head).toBeVisible()
  await expect(page.getByTestId('hub-head-fame')).toContainText('Level')
  const fame = page.getByTestId('hub-fame')
  await expect(fame).toBeVisible()
  await expect(page.getByTestId('hub-fame-value')).toContainText(`${Math.round(rep)} / 100`)
  await expect(page.getByTestId('hub-fame-next')).toContainText(/Next level at \d+|top fame level/)
  await expect(fame.locator('.me-affects').first()).toContainText('Wage and market value')
  await expect(page.getByTestId('hub-market-value')).toBeVisible()
  await expect(page.getByTestId('hub-traits')).toBeVisible()
  await cleanHubText(page)
  await noSideScroll(page)
  await shot('hub-1-career')

  // All 30 attributes, grouped.
  await page.getByTestId('hub-tab-attrs').click()
  await expect(page.getByTestId('hub-attrs')).toBeVisible()
  await expect(page.getByTestId('hub-attr')).toHaveCount(30)
  await expect(page.getByTestId('hub-group-physical')).toHaveAttribute('open', '')
  await cleanHubText(page)
  await noSideScroll(page)
  await shot('hub-2-attrs')

  await page.getByTestId('hub-tab-condition').click()
  for (const k of ['energy', 'fatigue', 'form', 'morale', 'happiness', 'stress', 'sharpness', 'discipline']) {
    await expect(page.getByTestId(`hub-cond-${k}`)).toBeVisible()
  }
  await cleanHubText(page)
  await shot('hub-3-condition')

  await page.getByTestId('hub-tab-relations').click()
  for (const k of ['manager', 'teammate', 'fans', 'family', 'partner', 'agent']) await expect(page.getByTestId(`hub-rel-${k}`)).toBeVisible()
  await cleanHubText(page)
  await noSideScroll(page)
  await shot('hub-4-relations')

  // Items: the asset bought above, with its effects, and the money block.
  await page.getByTestId('hub-tab-items').click()
  await expect(page.getByTestId('hub-money')).toBeVisible()
  const asset = page.getByTestId('hub-asset')
  await expect(asset).toHaveCount(1)
  await expect(asset).toContainText(itemName)
  await cleanHubText(page)
  await noSideScroll(page)
  await shot('hub-5-items')

  await page.getByTestId('hub-tab-honours').click()
  await expect(page.getByTestId('hub-honours')).toBeVisible()
  await cleanHubText(page)
  await shot('hub-6-honours')

  // The sticky summary stays on screen while the content scrolls.
  await page.getByTestId('hub-tab-attrs').click()
  await page.locator('.shell-content').evaluate((el) => el.scrollTo(0, 1200))
  const box = await head.boundingBox()
  expect(box, 'sticky header').not.toBeNull()
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.y).toBeLessThan(200)
  await shot('hub-7-sticky')

  // The Home chip opens the hub too (career tab, fame first).
  await sp(page, `sp.navigate('home', undefined, { tab: true })`)
  await page.getByTestId('home-fame-chip').click()
  await expect(page.getByTestId('hub-fame')).toBeVisible()
})

test('Turkish: the hub reads Ben / Şöhret', async ({ page, shot }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('starpath.settings.v1', JSON.stringify({ lang: 'tr', reducedMotion: false }))
    } catch {
      /* ignore */
    }
  })
  await page.goto('/?autostart=1&seed=99')
  await waitForApp(page)
  await sp(page, 'sp.clearEvents()')
  await expect(page.getByTestId('home-fame-chip')).toContainText('Şöhret:')
  await sp(page, `sp.navigate('me')`)
  await expect(page.locator('.page-title')).toContainText('Ben')
  await expect(page.getByTestId('hub-fame-value')).toContainText('Seviye')
  await cleanHubText(page)
  await shot('hub-8-tr')
})
