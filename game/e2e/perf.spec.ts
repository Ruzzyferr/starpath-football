import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'

/**
 * Highlight-player frame rate. Desktop runs unthrottled; the mobile project
 * also applies 4x CPU throttling through CDP. Numbers are printed for the
 * report; the assertion is a loose floor so CI noise does not flake it.
 */
async function measure(page: Page, ms: number) {
  return page.evaluate(
    (dur) =>
      new Promise<{ fps: number; p95: number; worst: number; phaserFps: number; renderer: string }>((resolve) => {
        const deltas: number[] = []
        let last = performance.now()
        const t0 = last
        const step = (now: number) => {
          deltas.push(now - last)
          last = now
          if (now - t0 < dur) requestAnimationFrame(step)
          else {
            const sorted = [...deltas].sort((a, b) => a - b)
            const scene = (window as unknown as { __spScene?: { game: { loop: { actualFps: number }; renderer: { type: number } } } }).__spScene
            resolve({
              fps: (deltas.length / (now - t0)) * 1000,
              p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
              worst: sorted[sorted.length - 1] ?? 0,
              phaserFps: scene?.game.loop.actualFps ?? 0,
              renderer: scene?.game.renderer.type === 2 ? 'WebGL' : 'Canvas',
            })
          }
        }
        requestAnimationFrame(step)
      }),
    ms,
  )
}

// Every quality profile (High / Medium / Low, WP-16) on both kinds.
for (const [kind, q] of [['counter', 'high'], ['corner', 'high'], ['counter', 'medium'], ['corner', 'medium'], ['counter', 'low'], ['corner', 'low']] as const) {
  test(`highlight FPS: ${kind}${q === 'high' ? '' : ` (${q} profile)`}`, async ({ page, isMobile }) => {
    if (isMobile) {
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    }
    await page.goto(`/match-demo.html?kind=${kind}&seed=5&auto=1&q=${q}`)
    await page.waitForFunction(
      () => (window as unknown as { __spScene?: { debugInfo(): { phase: string } } }).__spScene?.debugInfo().phase === 'live',
      undefined,
      { timeout: 60_000 },
    )
    const r = await measure(page, 5000)
    const dpr = await page.evaluate(() => devicePixelRatio)
    const canvas = await page.evaluate(() => {
      const c = document.querySelector('canvas')
      return c ? `${c.width}x${c.height}` : '-'
    })
    console.log(
      `[perf] ${isMobile ? 'mobile 390x844 dpr' + dpr + ' cpu/4' : 'desktop 1440x900'} ${kind} [${q}]: ${r.fps.toFixed(1)} fps (phaser ${r.phaserFps.toFixed(1)}), p95 frame ${r.p95.toFixed(1)} ms, worst ${r.worst.toFixed(1)} ms, ${r.renderer}, canvas ${canvas}`,
    )
    expect(r.fps).toBeGreaterThan(isMobile ? 20 : 30)
  })
}
