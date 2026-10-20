/**
 * The no-casino build (iOS App Store: VITE_FEATURE_CASINO=0). Runs only under
 * playwright.nocasino.config.ts, whose own dev server is built without the casino:
 *
 *   npx playwright test -c playwright.nocasino.config.ts --project=mobile
 *
 * A career starts, the hero is old enough to gamble and every main screen and tab is visited (in
 * English and Turkish): no casino, gambling or betting text may show anywhere, a direct casino route
 * must land elsewhere, and weeks of simulation must never bring up a casino or betting event.
 */
import type { Page } from '@playwright/test'
import { test, expect, preferEnglish, assertCleanText, waitForApp, sp } from './fixtures'

/** Forbidden words. "bet" only as a whole word (Unicode edges: "nöbet" is fine); "Slot" capitalised. */
const FORBIDDEN: { name: string; re: RegExp }[] = [
  { name: 'Kumarhane', re: /kumarhane/iu },
  { name: 'Casino', re: /casino/iu },
  { name: 'Rulet', re: /rulet/iu },
  { name: 'Roulette', re: /roulette/iu },
  { name: 'Blackjack', re: /blackjack/iu },
  { name: 'Slot', re: /(?<!\p{L})Slots?(?!\p{L})|slot machine/u },
  { name: 'At yarışı', re: /at yarış/iu },
  { name: 'Horse racing', re: /horse rac/iu },
  { name: 'bahis', re: /bahis/iu },
  { name: 'bet', re: /(?<!\p{L})bet(?!\p{L})/iu },
  { name: 'kumar', re: /kumar/iu },
  { name: 'gambl', re: /gambl/iu },
]

function forbiddenIn(text: string): string[] {
  return FORBIDDEN.filter((f) => f.re.test(text)).map((f) => `${f.name}: …${excerpt(text, f.re)}…`)
}
function excerpt(text: string, re: RegExp): string {
  const m = re.exec(text)
  return m ? text.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\s+/g, ' ') : ''
}

/** Visible text of the whole page (screen, chrome, toasts, open modals). */
async function expectNoGambling(page: Page, where: string): Promise<void> {
  const text = await page.locator('body').innerText()
  expect(forbiddenIn(text), `gambling text on ${where}`).toEqual([])
}

/** Screen ids reached through the dev router, plus Life's apps. */
const SCREENS = [
  'home', 'activities', 'inbox', 'careerLog', 'objectives',
  'profile', 'me', 'training', 'club', 'contract', 'trophies',
  'life', 'world', 'national',
  'menu', 'settings', 'glossary', 'achievements', 'store',
] as const
const LIFE_TABS = ['relations', 'assets', 'bank', 'business', 'projects', 'social', 'sponsors'] as const

async function settle(page: Page): Promise<void> {
  await page.waitForTimeout(250)
}

/** Close whatever modal is up (unlock explainer, event card…) after checking it too. */
async function closeModals(page: Page, where: string): Promise<void> {
  for (let i = 0; i < 6; i++) {
    if ((await page.locator('.modal-root').count()) === 0) return
    await expectNoGambling(page, `${where} (modal)`)
    const close = page.locator('.modal-root').last().getByRole('button', { name: /^(Close|Kapat|Got it|Anladım|OK|Tamam)$/i }).first()
    if (await close.isVisible().catch(() => false)) await close.click()
    else await page.keyboard.press('Escape')
    await settle(page)
  }
  await sp(page, 'sp.clearEvents()')
}

/** Navigate to `id` and check it, then every in-page tab it has. */
async function visit(page: Page, id: string, params?: Record<string, string>): Promise<void> {
  await sp(page, `sp.navigate(${JSON.stringify(id)}, ${params ? JSON.stringify(params) : 'undefined'})`)
  await settle(page)
  const where = params ? `${id} ${JSON.stringify(params)}` : id
  expect(await sp<string>(page, 'sp.screen().id'), `${where} opened`).toBe(id)
  await expectNoGambling(page, where)
  await closeModals(page, where)
  const tabs = page.locator('#main [role="tab"]')
  const n = await tabs.count()
  for (let i = 0; i < n; i++) {
    const tab = tabs.nth(i)
    if (!(await tab.isVisible().catch(() => false)) || (await tab.isDisabled().catch(() => true))) continue
    const label = (await tab.innerText().catch(() => '')).trim()
    await closeModals(page, where)
    await tab.click()
    await settle(page)
    // A tab must not have navigated away from the screen.
    if ((await sp<string>(page, 'sp.screen().id')) !== id) break
    await expectNoGambling(page, `${where} › tab "${label}"`)
  }
}

async function walkEverything(page: Page): Promise<void> {
  for (const id of SCREENS) await visit(page, id)
  for (const tab of LIFE_TABS) await visit(page, 'life', { tab })
  // The Life phone home: no casino app among the apps.
  await sp(page, `sp.navigate('life')`)
  await settle(page)
  await expect(page.locator('[data-app="casino"]')).toHaveCount(0)
}

/** Adult hero (old enough for the casino in a casino build), rich, past the week-4 unlocks. */
async function startAdultCareer(page: Page): Promise<void> {
  await page.goto('/?autostart=1&seed=4242')
  await waitForApp(page)
  await sp(page, `(() => { const s = sp.state(); s.hero.birthYear = s.calendar.season - 25; s.life.money = 2_000_000; sp.touch(); sp.clearEvents() })()`)
}

/** Event cards on the table right now: their texts in both languages. */
async function pendingEventTexts(page: Page): Promise<{ defId: string; text: string }[]> {
  return sp(page, `(() => {
    const out = []
    const n = sp.state().pendingEvents.length
    for (let i = 0; i < n; i++) {
      const v = sp.data.eventView(i)
      if (!v) continue
      const parts = [v.title.tr, v.title.en, v.body.tr, v.body.en]
      for (const c of v.choices) parts.push(JSON.stringify(c))
      out.push({ defId: v.defId, text: parts.join('\\n') })
    }
    return out
  })()`)
}

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

test('no-casino build: the casino route, tile, app, activity and setting are gone', async ({ page, shot }) => {
  await startAdultCareer(page)
  expect(await sp<boolean>(page, 'sp.data.activities().some((a) => a.category === "casino" || a.id === "casino")')).toBe(false)

  // Direct navigation to any casino screen lands on Life, never on the casino.
  for (const id of ['casino', 'blackjack', 'roulette', 'slots', 'horses']) {
    await sp(page, `sp.navigate(${JSON.stringify(id)})`)
    await settle(page)
    expect(await sp<string>(page, 'sp.screen().id'), `navigate('${id}')`).toBe('life')
    await expect(page.locator('.cas-bar-money, .bj-result, .rl-readout')).toHaveCount(0)
    await expectNoGambling(page, `navigate('${id}')`)
  }
  // The deep link the casino suite uses (?dev=casino) as well.
  await page.goto('/?autostart=1&dev=casino&seed=31337')
  await waitForApp(page)
  await settle(page)
  expect(await sp<string>(page, 'sp.screen().id')).not.toBe('casino')
  await expectNoGambling(page, '?dev=casino')

  await startAdultCareer(page)
  await sp(page, `sp.navigate('home')`)
  await settle(page)
  await expect(page.locator('.home-tile-casino')).toHaveCount(0)
  await sp(page, `sp.navigate('settings')`)
  await settle(page)
  await expect(page.getByText(/Hide casino/i)).toHaveCount(0)
  await shot('nc1-settings')
})

test('no-casino build: weeks of play and every screen and tab, in English and Turkish, show no gambling', async ({ page, shot }) => {
  test.setTimeout(420_000)
  await startAdultCareer(page)

  // Simulate a few weeks (matches included); every event card that comes up must be clean.
  const seen: string[] = []
  const startWeek = await sp<number>(page, 'sp.state().calendar.season * 52 + sp.state().calendar.week')
  for (let i = 0; i < 500; i++) {
    const week = await sp<number>(page, 'sp.state().calendar.season * 52 + sp.state().calendar.week')
    if (week - startWeek >= 6) break
    for (const e of await pendingEventTexts(page)) {
      seen.push(e.defId)
      expect(e.defId.startsWith('casino.'), `casino event ${e.defId}`).toBe(false)
      expect(forbiddenIn(e.text), `gambling text in event ${e.defId}`).toEqual([])
    }
    await sp(page, 'sp.clearEvents()')
    await sp(page, 'sp.actions.advance()')
  }
  expect(await sp<number>(page, 'sp.state().calendar.season * 52 + sp.state().calendar.week') - startWeek).toBeGreaterThanOrEqual(6)
  // Casino-style history never builds up.
  expect(await sp<number>(page, 'sp.state().life.casino.won + sp.state().life.casino.lost')).toBe(0)
  await sp(page, 'sp.clearEvents()')
  test.info().annotations.push({ type: 'events seen', description: [...new Set(seen)].join(', ') || '(none)' })

  await walkEverything(page)
  await shot('nc2-life-en')

  // Same walk in Turkish.
  await page.evaluate(() => {
    const k = 'starpath.settings.v1'
    const cur = JSON.parse(localStorage.getItem(k) ?? '{}')
    localStorage.setItem(k, JSON.stringify({ ...cur, lang: 'tr' }))
  })
  await startAdultCareer(page)
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('tr')
  await walkEverything(page)
  await assertCleanText(page)
  await shot('nc3-life-tr')
})

test('no-casino build: an old save with casino history loads and plays without crashing or showing it', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await startAdultCareer(page)
  // What a casino build leaves in a save: winnings, a habit, a casino card and follow-up, feed/interview flags.
  await sp(page, `(() => {
    const s = sp.state()
    s.life.casino = { addiction: 70, won: 50_000, lost: 120_000, visitsThisWeek: 2 }
    const week = s.calendar.season * 52 + s.calendar.week
    s.life.flags.casino_seen_week = week
    s.life.flags.nightlife_act = 'casino'
    s.life.flags.relapse = week - 1
    s.life.flags.knew_mate_bets = week - 20
    s.life.flags['ev:followups'] = JSON.stringify([{ id: 'casino.recovery_week', due: 0, vars: {}, from: 'casino.manager_warning' }])
    s.pendingEvents.push({ defId: 'casino.manager_warning', vars: {}, firedAt: { ...s.calendar } })
    s.pendingEvents.push({ defId: 'weird.hairstyle_bet', vars: {}, firedAt: { ...s.calendar } })
    sp.touch()
  })()`)
  // A save/load round trip (the purge runs on load) and a couple of weeks on top.
  const loaded = await sp<boolean>(page, `(async () => { const slot = sp.state().meta.slot || 1; await sp.actions.save(slot); return sp.actions.load(slot) })()`)
  expect(loaded).toBe(true)
  expect(await sp<number>(page, 'sp.state().life.casino.won')).toBe(50_000) // the history itself loads intact
  expect(await sp<string[]>(page, 'sp.state().pendingEvents.map((p) => p.defId)')).toEqual([])
  for (let i = 0; i < 20; i++) {
    for (const e of await pendingEventTexts(page)) {
      expect(e.defId.startsWith('casino.') || e.defId === 'weird.hairstyle_bet', `stale gambling card ${e.defId}`).toBe(false)
      expect(forbiddenIn(e.text), `gambling text in event ${e.defId}`).toEqual([])
    }
    await sp(page, 'sp.clearEvents()')
    await sp(page, 'sp.actions.advance()')
  }
  for (const id of ['home', 'me', 'life', 'inbox', 'activities']) await visit(page, id)
  await visit(page, 'life', { tab: 'social' })
  await visit(page, 'life', { tab: 'relations' })
  expect(errors).toEqual([])
})
