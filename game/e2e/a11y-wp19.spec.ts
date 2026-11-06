import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { test, expect, preferEnglish, waitForApp, sp } from './fixtures'

/** WP-19: axe on more screens, pseudo-locale + 200% text overflow at 390px, keyboard and screen-reader basics. */

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

async function serious(page: Page) {
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  return res.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)
}

const MORE_SCREENS = ['achievements', 'awards', 'saves', 'store', 'trophies', 'training', 'world', 'national', 'menu', 'contract']

for (const name of MORE_SCREENS) {
  test(`${name}: no serious axe violations`, async ({ page }) => {
    await page.goto('/?autostart=1&seed=4242')
    await waitForApp(page)
    await sp(page, 'sp.clearEvents()')
    await sp(page, `sp.navigate('${name}')`)
    await page.waitForTimeout(700)
    expect(await serious(page)).toEqual([])
  })
}

/** Elements whose content is wider than their box and that clip it (hidden overflow, no ellipsis). */
async function clippedText(page: Page) {
  return page.evaluate(() => {
    const out: string[] = []
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('button, .btn, .chip, .tab, h1, h2, h3, label, .tstat, .nav-item'))) {
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden' || el.offsetWidth === 0) continue
      if (cs.overflowX === 'visible' || cs.textOverflow === 'ellipsis') continue
      // Measure the text itself (not decorative pseudo-elements): does it extend past the clipping box?
      const range = document.createRange()
      range.selectNodeContents(el)
      const box = el.getBoundingClientRect()
      const text = range.getBoundingClientRect()
      if (text.width > 0 && (text.right > box.right + 2 || text.left < box.left - 2)) {
        out.push(`${el.tagName.toLowerCase()}.${el.className.toString().split(' ')[0]} "${(el.textContent ?? '').trim().slice(0, 30)}" text ${Math.round(text.right)}>${Math.round(box.right)}`)
      }
    }
    return out
  })
}

const OVERFLOW_SCREENS = ['home', 'activities', 'profile', 'life', 'settings', 'saves', 'training', 'world']

for (const name of OVERFLOW_SCREENS) {
  test(`${name}: pseudo-locale (+35% text) at 390px does not overflow or clip`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/?autostart=1&seed=4242&pseudo=1')
    await waitForApp(page)
    await sp(page, 'sp.clearEvents()')
    await sp(page, `sp.navigate('${name}')`)
    await page.waitForTimeout(700)
    // The pseudo marker proves the mode is active.
    expect(await page.locator('body').innerText()).toMatch(/[áéíöüñšž]/)
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(over, 'horizontal overflow (px)').toBeLessThanOrEqual(1)
    expect(await clippedText(page)).toEqual([])
  })
}

test('200% text scale at 390px: no horizontal overflow on core screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/?autostart=1&seed=4242')
  await waitForApp(page)
  await sp(page, 'sp.clearEvents()')
  await page.evaluate(() => document.documentElement.style.setProperty('--text-scale', '2'))
  for (const name of ['home', 'activities', 'profile', 'settings']) {
    await sp(page, `sp.navigate('${name}')`)
    // Re-apply: a late settings update (e.g. the quality benchmark on a slow runner) rewrites --text-scale.
    await page.evaluate(() => document.documentElement.style.setProperty('--text-scale', '2'))
    await page.waitForTimeout(400)
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(over, `${name} overflow at 200%`).toBeLessThanOrEqual(1)
    const fs = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize))
    expect(fs).toBeCloseTo(32, 0)
  }
})

test('text scale slider reaches 200% and is rem-based', async ({ page }) => {
  await page.goto('/?autostart=1&seed=4242')
  await waitForApp(page)
  await sp(page, `sp.navigate('settings')`)
  const slider = page.locator('#set-text')
  await expect(slider).toHaveAttribute('max', '200')
  await slider.fill('200')
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('32px')
  const body = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize))
  expect(body).toBeGreaterThan(28)
})

test('reduce flashes setting sets data-flash', async ({ page }) => {
  await page.goto('/?autostart=1&seed=4242')
  await waitForApp(page)
  await sp(page, `sp.navigate('settings')`)
  await expect(page.locator('html')).toHaveAttribute('data-flash', 'on')
  await page.getByRole('switch', { name: /Disable flashes/ }).click()
  await expect(page.locator('html')).toHaveAttribute('data-flash', 'off')
})

test('screen reader basics: landmarks, labelled dialog, toast live regions', async ({ page }) => {
  await page.goto('/?autostart=1&seed=4242')
  await waitForApp(page)
  await sp(page, 'sp.clearEvents()')
  await expect(page.locator('main, [role="main"]')).toHaveCount(1)
  expect(await page.locator('nav').count()).toBeGreaterThan(0)
  // Toast host is a polite live region; errors are announced assertively as alerts.
  await expect(page.locator('.toast-host')).toHaveAttribute('aria-live', 'polite')
  // Modal: dialogs always carry an accessible name.
  const dialogs = await page.locator('[role="dialog"], [role="alertdialog"]').evaluateAll((els) =>
    els.map((e) => !!(e.getAttribute('aria-label') || e.getAttribute('aria-labelledby'))),
  )
  expect(dialogs.every(Boolean)).toBe(true)
})

test('tabs are keyboard operable (arrow keys + roving tabindex)', async ({ page }) => {
  await page.goto('/?autostart=1&seed=4242')
  await waitForApp(page)
  await sp(page, 'sp.clearEvents()')
  await sp(page, `sp.navigate('training')`)
  const tabs = page.getByRole('tab')
  await expect(tabs.first()).toBeVisible()
  await tabs.first().focus()
  const before = await tabs.evaluateAll((els) => els.findIndex((e) => e.getAttribute('aria-selected') === 'true'))
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => tabs.evaluateAll((els) => els.findIndex((e) => e.getAttribute('aria-selected') === 'true'))).not.toBe(before)
  const selected = await tabs.evaluateAll((els) => els.map((e) => e.getAttribute('tabindex')))
  expect(selected.filter((v) => v === '0')).toHaveLength(1)
})
