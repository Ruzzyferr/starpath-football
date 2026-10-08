/**
 * Aspect-ratio sweep (GAP-AUDIT 2.9#93): the shell and the match canvas must fit every common
 * window shape - ultrawide, 16:10, 4:3, tall phones, small landscape phones, foldables.
 */
import { test, expect, preferEnglish, waitForApp } from './fixtures'

const SIZES: [string, number, number][] = [
  ['ultrawide 21:9', 2560, 1080],
  ['16:9 laptop', 1366, 768],
  ['16:10', 1440, 900],
  ['4:3 / iPad landscape', 1024, 768],
  ['tall phone 9:19.5', 390, 844],
  ['small phone', 360, 640],
  ['landscape phone', 844, 390],
  ['foldable cover', 280, 653],
]

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

for (const [name, w, h] of SIZES) {
  test(`shell fits ${name} (${w}x${h})`, async ({ page }) => {
    test.skip(test.info().project.name === 'mobile', 'sizes are set explicitly')
    await page.setViewportSize({ width: w, height: h })
    await page.goto('/?autostart=1&seed=3')
    await waitForApp(page)
    await expect(page.locator('#main')).toBeVisible()
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, mainH: (document.querySelector('#main') as HTMLElement).getBoundingClientRect().height }))
    expect(m.sw, 'no horizontal page scroll').toBeLessThanOrEqual(m.iw + 1)
    expect(m.mainH).toBeGreaterThan(100)
  })

  test(`match canvas stays inside ${name} (${w}x${h})`, async ({ page }) => {
    test.skip(test.info().project.name === 'mobile', 'sizes are set explicitly')
    await page.setViewportSize({ width: w, height: h })
    await page.goto('/match-demo.html?kind=counter&seed=5&auto=1&q=low')
    await page.waitForFunction(() => (window as unknown as { __spScene?: { debugInfo(): { phase: string } } }).__spScene?.debugInfo().phase === 'live', undefined, { timeout: 60_000 })
    const box = await page.evaluate(() => {
      const c = document.querySelector('canvas')!
      const r = c.getBoundingClientRect()
      const p = c.parentElement!.getBoundingClientRect() // the container the game is fitted into
      return { l: r.left - p.left, t: r.top - p.top, r: r.right - p.left, b: r.bottom - p.top, w: r.width, h: r.height, iw: p.width, ih: p.height }
    })
    expect(box.w).toBeGreaterThan(100)
    expect(box.h).toBeGreaterThan(80)
    expect(box.l).toBeGreaterThanOrEqual(-1)
    expect(box.r).toBeLessThanOrEqual(box.iw + 1)
    // Vertical fit is checked in the real shell by the match spec; the demo harness stacks a toolbar above the stage.
  })
}
