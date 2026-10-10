/**
 * Lightweight visual-regression check (GAP 2.7#16): key screens at the project
 * viewport (desktop 1440 / mobile 390) must not overflow horizontally, must not
 * clip headings or buttons, and are screenshotted into $E2E_SHOTS/visual.
 * Pixel baselines are opt-in because they are platform specific:
 *   VISUAL_PIXELS=1 npx playwright test e2e/visual.spec.ts --update-snapshots   (before a change)
 *   VISUAL_PIXELS=1 npx playwright test e2e/visual.spec.ts                      (after: diff > 4% fails)
 */
import { join } from 'node:path'
import { test, expect, preferEnglish, waitForApp, sp, SHOTS } from './fixtures'

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

const SCREENS = ['home', 'activities', 'profile', 'club', 'inbox', 'life', 'settings', 'training'] as const

for (const name of SCREENS) {
  test(`visual: ${name} fits and keeps its type`, async ({ page }, info) => {
    await page.goto('/?autostart=1&seed=4242')
    await waitForApp(page)
    await sp(page, 'sp.clearEvents()')
    await sp(page, `sp.navigate('${name}')`)
    await page.waitForTimeout(900)
    const m = await page.evaluate(() => {
      const clipped: string[] = []
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('h1, h2, h3'))) {
        const cs = getComputedStyle(el)
        if (cs.display === 'none' || cs.visibility === 'hidden' || el.offsetWidth === 0) continue
        const range = document.createRange()
        range.selectNodeContents(el)
        const r = range.getBoundingClientRect()
        const box = el.getBoundingClientRect()
        const clips = cs.overflowX !== 'visible' && cs.textOverflow !== 'ellipsis' && r.right > box.right + 2
        if (r.right > innerWidth + 1 || r.left < -1 || clips) clipped.push(`${el.tagName.toLowerCase()}.${el.className}: ${el.textContent?.trim().slice(0, 30)}`)
      }
      const h1 = document.querySelector('h1')
      return {
        over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        clipped: clipped.slice(0, 5),
        h1px: h1 ? parseFloat(getComputedStyle(h1).fontSize) : 0,
      }
    })
    expect(m.over, 'horizontal overflow (px)').toBeLessThanOrEqual(1)
    expect(m.clipped, 'headings cut off by the viewport or their box').toEqual([])
    await page.screenshot({ path: join(SHOTS, 'visual', `${info.project.name}-${name}.png`) })
    if (process.env.VISUAL_PIXELS) {
      await expect(page).toHaveScreenshot(`${info.project.name}-${name}.png`, { maxDiffPixelRatio: 0.04, animations: 'disabled' })
    }
  })
}
