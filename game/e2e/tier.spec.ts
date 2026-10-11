import { test, expect } from './fixtures'

/**
 * Build 9 graded success: a goal-oriented moment reports its tier (full / partial / fail) and the banner says it
 * (TR / EN). Plays the match demo on autopilot; screenshots go to PW_SHOT_DIR when set (owner review).
 */
const ENV = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
const KINDS = ['long_shot', 'edge_of_box', 'freekick', 'cross'] as const

for (const kind of KINDS) {
  test(`graded success is reported: ${kind}`, async ({ page }, info) => {
    test.setTimeout(240_000)
    const seen = new Set<string>()
    for (let seed = 1; seed <= 4; seed++) {
      await page.goto(`/match-demo.html?kind=${kind}&seed=${seed}&auto=1&lang=tr`)
      await page.waitForFunction(() => !!(window as unknown as { __spScene?: unknown }).__spScene, undefined, { timeout: 30_000 })
      // The result banner (tier wording) is up while the moment is in its post phase.
      await page.waitForFunction(
        () => (window as unknown as { __spScene: { debugInfo(): { phase: string } } }).__spScene.debugInfo().phase === 'post',
        undefined,
        { timeout: 90_000 },
      )
      await page.waitForTimeout(450)
      if (ENV.PW_SHOT_DIR) await page.screenshot({ path: `${ENV.PW_SHOT_DIR}/banner-${info.project.name}-${kind}-s${seed}.png` })
      const result = page.locator('#result')
      await expect(result).toHaveText(new RegExp(`^${kind}: [A-Z_]+ [(].*tier (full|partial|fail)[)]$`), { timeout: 90_000 })
      const tier = /tier (full|partial|fail)/.exec((await result.textContent()) ?? '')![1]!
      seen.add(tier)
      if (ENV.PW_SHOT_DIR) await page.screenshot({ path: `${ENV.PW_SHOT_DIR}/tier-${info.project.name}-${kind}-s${seed}-${tier}.png` })
      if (tier === 'partial') break
    }
    expect(seen.size).toBeGreaterThan(0)
  })
}
