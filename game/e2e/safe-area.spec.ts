/**
 * Notch / status bar / home indicator / keyboard: every screen adapts to the
 * device's safe areas. Insets are simulated the way Capacitor SystemBars feeds
 * them on Android (--safe-area-inset-* on <html>), which the --safe-* tokens
 * merge with env(). Also: no double-tap zoom, no input-focus zoom (fields >= 16px).
 */
import type { Page } from '@playwright/test'
import { test, expect, preferEnglish, waitForApp, sp } from './fixtures'

interface Device {
  name: string
  width: number
  height: number
  insets: { top: number; right: number; bottom: number; left: number }
}

const DEVICES: Device[] = [
  { name: 'iphone-15', width: 390, height: 844, insets: { top: 47, right: 0, bottom: 34, left: 0 } },
  { name: 'iphone-16pro', width: 393, height: 852, insets: { top: 59, right: 0, bottom: 34, left: 0 } },
  { name: 'pixel-8', width: 412, height: 915, insets: { top: 48, right: 0, bottom: 24, left: 0 } },
  { name: 'iphone-16pro-land', width: 852, height: 393, insets: { top: 0, right: 59, bottom: 21, left: 59 } },
]

const PRO = DEVICES[1]

async function simulateInsets(page: Page, d: Device, textScale = 1): Promise<void> {
  await page.addInitScript(
    ({ i, textScale }) => {
      // What Capacitor SystemBars does natively: inject the insets on <html>.
      const apply = () => {
        const s = document.documentElement.style
        s.setProperty('--safe-area-inset-top', `${i.top}px`)
        s.setProperty('--safe-area-inset-right', `${i.right}px`)
        s.setProperty('--safe-area-inset-bottom', `${i.bottom}px`)
        s.setProperty('--safe-area-inset-left', `${i.left}px`)
      }
      if (document.documentElement) apply()
      else new MutationObserver((_, mo) => { if (document.documentElement) { apply(); mo.disconnect() } }).observe(document, { childList: true })
      try {
        localStorage.setItem('sp.safeDebug', '1') // red inset bands in the screenshots
        const k = 'starpath.settings.v1'
        const cur = JSON.parse(localStorage.getItem(k) || '{}')
        localStorage.setItem(k, JSON.stringify({ lang: 'en', reducedMotion: false, ...cur, textScale }))
      } catch { /* ignore */ }
    },
    { i: d.insets, textScale },
  )
}

interface Offender { what: string; rect: string; why: string }

/**
 * Nothing interactive (or a page title) sits in the status-bar / cutout bands, and
 * every fixed/sticky bar's controls end above the home indicator.
 */
async function insetOffenders(page: Page, d: Device): Promise<Offender[]> {
  return page.evaluate((i) => {
    const out: { what: string; rect: string; why: string }[] = []
    const W = window.innerWidth
    const H = window.innerHeight
    const sel = 'button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=switch], h1, .page-back'
    // Pinned = fixed/sticky before reaching the scroller it lives in (scrolling
    // content may pass under the home indicator; bars must not).
    const pinned = (el: Element): boolean => {
      for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) {
        const cs = getComputedStyle(n)
        if (cs.position === 'fixed' || cs.position === 'sticky') return true
        if (n !== el && /(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight) return false
      }
      return false
    }
    const name = (el: Element) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${[...el.classList].join('.')} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)}"`
    for (const el of document.querySelectorAll(sel)) {
      const he = el as HTMLElement
      if (he.closest('.sa-debug, .skip-link, .sr-only, [aria-hidden=true], canvas')) continue
      if (typeof he.checkVisibility === 'function' && !he.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue
      const r = he.getBoundingClientRect()
      if (r.width < 2 || r.height < 2) continue
      if (r.bottom <= 0 || r.top >= H || r.right <= 0 || r.left >= W) continue // off-screen (scrolled away)
      const rect = `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`
      if (r.top < i.top - 1) out.push({ what: name(el), rect, why: `top ${r.top.toFixed(1)} < inset ${i.top}` })
      const fullyInX = r.left >= 0 && r.right <= W
      if (fullyInX && r.left < i.left - 1) out.push({ what: name(el), rect, why: `left ${r.left.toFixed(1)} < inset ${i.left}` })
      if (fullyInX && r.right > W - i.right + 1) out.push({ what: name(el), rect, why: `right ${r.right.toFixed(1)} > ${W - i.right}` })
      if (pinned(el) && r.bottom > H - i.bottom + 1) out.push({ what: name(el), rect, why: `pinned bottom ${r.bottom.toFixed(1)} > ${H - i.bottom}` })
    }
    return out
  }, d.insets)
}

async function expectClear(page: Page, d: Device, label: string): Promise<void> {
  // Let screen-enter / slide-up transitions finish (they shift boxes by a few px).
  await page
    .waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity), undefined, { timeout: 5000 })
    .catch(() => undefined)
  const resolved = await page.evaluate(() => {
    const p = document.createElement('div')
    p.style.cssText = 'position:fixed;padding:var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left)'
    document.body.appendChild(p)
    const cs = getComputedStyle(p)
    const v = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map((x) => parseFloat(x))
    p.remove()
    return v
  })
  expect(resolved, `${label}: --safe-* tokens pick up the device insets`).toEqual([d.insets.top, d.insets.right, d.insets.bottom, d.insets.left])
  expect(await insetOffenders(page, d), `${label}: controls under a system bar`).toEqual([])
}

async function expectFieldsNoZoom(page: Page, label: string): Promise<void> {
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('input, select, textarea')]
      .filter((el) => !/^(checkbox|radio|range|color|file|hidden)$/.test((el as HTMLInputElement).type || ''))
      .map((el) => ({ id: el.id || el.className, fs: parseFloat(getComputedStyle(el).fontSize) }))
      .filter((x) => x.fs < 16),
  )
  expect(small, `${label}: form fields under 16px zoom the page on iOS focus`).toEqual([])
}

async function shot(page: Page, d: Device, name: string): Promise<void> {
  const dir = process.env.E2E_SHOTS || 'test-results/shots'
  await page.waitForTimeout(5000)
  await page.screenshot({ path: `${dir}/safe-${d.name}-${name}.png` })
}

for (const d of DEVICES) {
  test.describe(`safe areas · ${d.name}`, () => {
    test.use({ viewport: { width: d.width, height: d.height }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
    test.beforeEach(({ browserName }, info) => test.skip(info.project.name !== 'mobile' || browserName !== 'chromium', 'device emulation runs once, in the mobile project'))

    test('title menus, settings back button and the wizard search clear the system bars', async ({ page }) => {
      await preferEnglish(page)
      await simulateInsets(page, d, 0.9)
      await page.goto('/')
      await waitForApp(page)
      await expectClear(page, d, 'title')

      // Shell-less sub-menu (the reported bug: back button under the iOS clock).
      await page.getByRole('button', { name: 'Settings' }).first().click()
      const back = page.locator('.page-back').first()
      await expect(back).toBeVisible()
      await expectClear(page, d, 'settings (no career)')
      await shot(page, d, 'settings-back')
      await back.click()

      await page.getByRole('button', { name: 'New career' }).click()
      await expect(page.locator('#wiz-first')).toBeVisible()
      await expectFieldsNoZoom(page, 'wizard name')
      await shot(page, d, 'wizard-step1')
      await expectClear(page, d, 'wizard step 1')
      await page.locator('#wiz-first').fill('Deniz')
      await page.locator('#wiz-last').fill('Kaplan')
      await page.locator('.wiz-foot').getByRole('button', { name: /^Next/ }).click()
      const search = page.locator('.wiz-search input')
      await expect(search).toBeVisible()
      await expectFieldsNoZoom(page, 'wizard country search')
      await search.tap()
      await search.fill('bra')
      expect(await page.evaluate(() => window.visualViewport?.scale ?? 1), 'focus did not zoom').toBe(1)
      await expectClear(page, d, 'wizard country')
      await shot(page, d, 'wizard-country')
    })

    test('in-game shell, sub-menu, Life phone and live match clear the system bars', async ({ page }) => {
      await preferEnglish(page)
      await simulateInsets(page, d)
      await page.goto('/?autostart=1&seed=777')
      await waitForApp(page)
      await sp(page, 'sp.clearEvents()')
      await expectClear(page, d, 'home shell')

      await sp(page, `sp.navigate('settings')`)
      await expect(page.locator('.page-back').first()).toBeVisible()
      await expectClear(page, d, 'settings (in shell)')

      await sp(page, `sp.navigate('life')`)
      await expect(page.getByTestId('phone-status')).toBeVisible()
      await page.getByTestId('phone-app-bank').click()
      await expect(page.locator('.ph-app-view')).toHaveAttribute('data-app', 'bank')
      await expectClear(page, d, 'life phone app')
      await shot(page, d, 'life-phone')

      await sp(page, `sp.navigate('home')`)
      await sp(page, 'sp.toMatchday()')
      await sp(page, "(() => { const s = sp.state(); s.hero.contract.role = 'captain'; s.hero.managerTrust = 100; s.hero.form = 90; s.hero.fatigue = 0; s.hero.sharpness = 100; s.life.flags.promised_start = true })()")
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'Play match' }).click()
      await expect(page.getByRole('button', { name: 'Kick off' })).toBeVisible()
      await expectClear(page, d, 'pre-match')
      await page.getByRole('button', { name: 'Kick off' }).click()
      await expect(page.locator('.lm-root')).toBeVisible()
      await page.waitForTimeout(1500)
      await expectClear(page, d, 'live match')
      await shot(page, d, 'live-match')
      // Scrolled: the sticky score bug must not ride up under the status bar.
      await page.locator('.lm-root').evaluate((el) => el.scrollTo(0, 400))
      await page.waitForTimeout(300)
      await expectClear(page, d, 'live match scrolled')
      await shot(page, d, 'live-match-scrolled')
    })
  })
}

test.describe('zoom guards', () => {
  test.beforeEach(({ browserName }, info) => test.skip(info.project.name !== 'mobile' || browserName !== 'chromium', 'touch emulation'))

  test.use({ viewport: { width: PRO.width, height: PRO.height }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })

  test('double-tap does not zoom; the match moment keeps its own gestures and clears the bars', async ({ page }) => {
    test.setTimeout(300_000)
    await preferEnglish(page)
    await simulateInsets(page, PRO)
    await page.goto('/?autostart=1&seed=777')
    await waitForApp(page)
    await sp(page, 'sp.clearEvents()')
    const ta = await page.evaluate(() => [getComputedStyle(document.documentElement).touchAction, getComputedStyle(document.body).touchAction])
    expect(ta).toEqual(['manipulation', 'manipulation'])
    const title = page.locator('h1, .page-title, .topbar').first()
    const box = (await title.boundingBox())!
    for (let k = 0; k < 3; k++) {
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
      await page.waitForTimeout(80)
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
      await page.waitForTimeout(400)
    }
    expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1)

    await sp(page, 'sp.toMatchday()')
    await sp(page, "(() => { const s = sp.state(); s.hero.contract.role = 'captain'; s.hero.managerTrust = 100; s.hero.form = 90; s.hero.fatigue = 0; s.hero.sharpness = 100; s.life.flags.promised_start = true })()")
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Play match' }).click()
    await page.getByRole('button', { name: 'Kick off' }).click()
    // A decision moment: the card, then the live Phaser moment with its HUD.
    await page.locator('.lm-controls').getByText('4×').click()
    const card = page.locator('.lm-moment')
    await expect(card).toBeVisible({ timeout: 120_000 })
    await page.waitForTimeout(1000) // slide-up spring settles
    await expectClear(page, PRO, 'decision card')
    await shot(page, PRO, 'decision-card')
    await card.getByRole('button', { name: 'Play moment' }).click()
    await page.waitForFunction(() => !!(window as unknown as { __spScene?: unknown }).__spScene, undefined, { timeout: 30_000 })
    await page.waitForFunction(() => (window as unknown as { __spScene: { debugInfo(): { phase: string } } }).__spScene.debugInfo().phase === 'live', undefined, { timeout: 20_000 })
    await expectClear(page, PRO, 'live moment')
    const canvasTa = await page.locator('#match-canvas canvas').first().evaluate((c) => getComputedStyle(c).touchAction)
    await shot(page, PRO, 'live-moment')
    expect(canvasTa, 'match canvas owns its touch gestures').toBe('none')
  })

  test('safe-area debug overlay toggles and reports the insets', async ({ page }) => {
    await preferEnglish(page)
    await page.goto('/?safe=47,0,34,0&safedebug=1')
    await waitForApp(page)
    const dbg = page.getByTestId('safe-area-debug')
    await expect(dbg).toBeAttached()
    await expect(dbg).toContainText('safe T47 R0 B34 L0')
    await page.evaluate(() => (window as unknown as { __safeAreaDebug: (v?: boolean) => void }).__safeAreaDebug(false))
    await expect(dbg).toHaveCount(0)
  })
})
