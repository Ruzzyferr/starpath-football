import { readFileSync } from 'node:fs'
import { defineConfig } from '@playwright/test'
import base from './playwright.config'

/**
 * The no-casino build (the iOS App Store one: `VITE_FEATURE_CASINO=0`, see core/contentFlags and
 * .github/workflows/testflight.yml) in a real browser. It runs its OWN vite dev server and shop server
 * on their own ports, so it never collides with the default suite's servers (5287/5288) and can run
 * alongside it.
 *
 *   npx playwright test -c playwright.nocasino.config.ts
 *   npx playwright test -c playwright.nocasino.config.ts --project=mobile
 */
const PORT = Number(process.env.PW_NOCASINO_PORT ?? 5297)
const SHOP_PORT = Number(process.env.PW_NOCASINO_SHOP_PORT ?? PORT + 1)
if (PORT === 6000 || SHOP_PORT === 6000) throw new Error('port 6000 is reserved (browsers block it as X11)')

const [vite, shop] = base.webServer as NonNullable<Exclude<typeof base.webServer, undefined | { command: string }>>

export default defineConfig({
  ...base,
  testMatch: /nocasino\.spec\.ts$/,
  testIgnore: [],
  // The projects of the default suite, minus WebKit's spec filter (this config has one spec).
  projects: (base.projects ?? []).filter((p) => p.name === 'desktop' || p.name === 'mobile'),
  use: { ...base.use, baseURL: `http://127.0.0.1:${PORT}` },
  webServer: [
    {
      ...vite!,
      command: `npx vite --port ${PORT} --strictPort --host 127.0.0.1`,
      url: `http://127.0.0.1:${PORT}/`,
      env: {
        E2E_NO_HMR: '1',
        VITE_FEATURE_CASINO: '0',
        VITE_SHOP_API: `http://127.0.0.1:${SHOP_PORT}`,
        VITE_SHOP_PUBKEY: readFileSync('e2e/shop/test-grant-pub.txt', 'utf8').trim(),
      },
    },
    {
      ...shop!,
      url: `http://127.0.0.1:${SHOP_PORT}/v1/health`,
      env: { ...(shop!.env ?? {}), PORT: String(SHOP_PORT), DATA_DIR: `test-results/shop-e2e-nocasino-${Date.now()}`, ORIGINS: `http://127.0.0.1:${PORT},http://localhost:${PORT}` },
    },
  ],
})
