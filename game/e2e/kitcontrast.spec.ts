import { test, expect } from './fixtures'

/**
 * Tester report: "the ball and a team's colour are sometimes the same". With a
 * white and a yellow kit on the pitch the classic white ball must be swapped
 * for one that reads against both kits and the turf.
 */
const CASES = [
  { name: 'white-yellow', home: 'FFFFFF', opp: 'FFD100', white: false },
  { name: 'red-navy', home: 'C8102E', opp: '0B1F41', white: true },
]

for (const c of CASES) {
  test(`ball contrasts with both kits: ${c.name}`, async ({ page, shot }) => {
    await page.goto(`/match-demo.html?kind=edge_of_box&seed=3&auto=1&home=${c.home}&opp=${c.opp}&home2=111111&opp2=111111`)
    await page.waitForFunction(() => !!(window as unknown as { __spScene?: unknown }).__spScene, undefined, { timeout: 30_000 })
    await page.waitForFunction(
      () => (window as unknown as { __spScene: { debugInfo(): { phase: string } } }).__spScene.debugInfo().phase === 'live',
      undefined,
      { timeout: 20_000 },
    )
    const style = await page.evaluate(() => (window as unknown as { __spScene: { ballStyle?: { fill: string; contrast: number } } }).__spScene.ballStyle ?? null)
    expect(style).not.toBeNull()
    expect(style!.fill === '#fbfbf7').toBe(c.white)
    expect(style!.contrast).toBeGreaterThanOrEqual(25)
    await page.waitForTimeout(500)
    await shot(`kitcontrast-${c.name}`)
  })
}
