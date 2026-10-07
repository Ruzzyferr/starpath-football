import { test, expect } from './fixtures'

const KINDS = ['build_up', 'counter', 'one_on_one', 'cross', 'edge_of_box', 'freekick', 'penalty', 'corner', 'defend', 'gk_save', 'gk_penalty', 'hold_up', 'defend_1v1', 'block', 'corner_kick', 'fk_wall']

for (const kind of KINDS) {
  test(`match-demo autopilot reaches an outcome: ${kind}`, async ({ page, shot }) => {
    await page.goto(`/match-demo.html?kind=${kind}&seed=3&auto=1`)
    await page.waitForFunction(() => !!(window as unknown as { __spScene?: unknown }).__spScene, undefined, { timeout: 30_000 })
    // Mid-moment frame for the visual check (HUD vs. play).
    await page.waitForFunction(
      () => (window as unknown as { __spScene: { debugInfo(): { phase: string } } }).__spScene.debugInfo().phase === 'live',
      undefined,
      { timeout: 20_000 },
    )
    await page.waitForTimeout(1200)
    await shot(`c-demo-${kind}-live`)
    const result = page.locator('#result')
    await expect(result).toHaveText(new RegExp(`^${kind}: [A-Z_]+ \\(`), { timeout: 90_000 })
    await shot(`c-demo-${kind}-done`)
  })
}
