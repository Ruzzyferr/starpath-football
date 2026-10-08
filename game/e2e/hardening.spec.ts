/**
 * Desktop-shell and PWA hardening checks (GAP-AUDIT 2.9#86, #113, #22):
 *  - the strict Electron CSP (electron/csp.cjs) must not break the match renderer or the prod bundle;
 *  - the production build keeps working offline once the service worker is installed;
 *  - repeated match mounts do not leak JS heap.
 */
import { createRequire } from 'node:module'
import { createServer, type Server } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import type { AddressInfo } from 'node:net'
import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'

const { CSP } = createRequire(import.meta.url)('../electron/csp.cjs') as { CSP: string }
const DIST = join(process.cwd(), 'dist')
const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }

function serveDist(withCsp: boolean): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let p = normalize(decodeURIComponent((req.url ?? '/').split('?')[0]!)).replace(/^[\\/]+/, '')
      if (p.includes('..')) p = ''
      let file = join(DIST, p || 'index.html')
      if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html')
      const headers: Record<string, string> = { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' }
      if (withCsp) headers['Content-Security-Policy'] = CSP
      res.writeHead(200, headers)
      res.end(readFileSync(file))
    })
    server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}` }))
  })
}

const needsDist = !existsSync(join(DIST, 'index.html'))

test('Electron CSP: the Phaser match renderer runs without violations', async ({ page, problems }) => {
  test.skip(test.info().project.name === 'mobile', 'desktop shell only')
  await page.addInitScript(() => {
    ;(window as unknown as { __csp: string[] }).__csp = []
    document.addEventListener('securitypolicyviolation', (e) => (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`))
  })
  await page.route('**/match-demo.html*', async (route) => {
    const r = await route.fetch()
    await route.fulfill({ response: r, headers: { ...r.headers(), 'content-security-policy': CSP.replace("connect-src 'self'", "connect-src 'self' ws://127.0.0.1:*") } })
  })
  await page.goto('/match-demo.html?kind=counter&seed=5&auto=1&q=low')
  await page.waitForFunction(() => (window as unknown as { __spScene?: { debugInfo(): { phase: string } } }).__spScene?.debugInfo().phase === 'live', undefined, { timeout: 60_000 })
  await page.waitForTimeout(1500)
  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([])
  // The dev server's HMR socket is not part of the shipped app; everything else must stay clean.
  problems.list = problems.list.filter((p) => !/WebSocket|@vite\/client/.test(p))
})

test('prod bundle under CSP boots, then works offline via the service worker', async ({ page, context }) => {
  test.skip(needsDist, 'run `npm run build` first (CI downloads the web-build artifact)')
  test.skip(test.info().project.name === 'mobile', 'desktop only')
  const { server, url } = await serveDist(true)
  try {
    await page.addInitScript(() => {
      ;(window as unknown as { __csp: string[] }).__csp = []
      document.addEventListener('securitypolicyviolation', (e) => (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`))
      try { localStorage.setItem('starpath.settings.v1', JSON.stringify({ lang: 'en' })) } catch { /* ignore */ }
    })
    await page.goto(`${url}/`)
    await expect(page.locator('#main')).toBeVisible({ timeout: 30_000 })
    expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([])

    // Wait for the worker to take control, then go offline and reload.
    await page.waitForFunction(async () => !!(await navigator.serviceWorker?.getRegistration())?.active, undefined, { timeout: 30_000 })
    await page.reload()
    await page.waitForFunction(() => !!navigator.serviceWorker?.controller, undefined, { timeout: 30_000 })
    await context.setOffline(true)
    await page.reload()
    await expect(page.locator('#main')).toBeVisible({ timeout: 30_000 })
    await context.setOffline(false)
  } finally {
    server.close()
  }
})

async function heapMB(page: Page): Promise<number> {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('HeapProfiler.enable')
  await cdp.send('HeapProfiler.collectGarbage')
  await cdp.send('HeapProfiler.collectGarbage')
  const { usedSize } = (await cdp.send('Runtime.getHeapUsage')) as { usedSize: number }
  await cdp.detach()
  return usedSize / 1048576
}

test('memory: repeated match mounts do not leak JS heap (budget 2.9#22)', async ({ page }) => {
  test.skip(test.info().project.name === 'mobile', 'desktop only')
  test.setTimeout(240_000)
  await page.goto('/match-demo.html?kind=counter&seed=1&auto=1&q=low')
  const live = () =>
    page.waitForFunction(() => (window as unknown as { __spScene?: { debugInfo(): { phase: string } } }).__spScene?.debugInfo().phase === 'live', undefined, { timeout: 60_000 })
  await live()
  const cycle = async () => {
    await page.locator('#again').click()
    await page.waitForTimeout(1200)
    await live()
  }
  for (let i = 0; i < 3; i++) await cycle() // warm-up: caches, textures, JIT
  const base = await heapMB(page)
  for (let i = 0; i < 10; i++) await cycle()
  const after = await heapMB(page)
  console.log(`[mem] heap after warm-up ${base.toFixed(1)} MB, after 10 more mounts ${after.toFixed(1)} MB (+${(after - base).toFixed(1)})`)
  expect(after - base, 'JS heap growth over 10 match mounts').toBeLessThan(30)
  expect(after, 'absolute JS heap budget').toBeLessThan(400)
})
