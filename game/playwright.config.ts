import { defineConfig } from '@playwright/test'

/**
 * Real-browser end-to-end suite (game/e2e). Uses the locally installed Google
 * Chrome (`channel: 'chrome'`) — no browser download needed.
 *
 *   npm run e2e                 both projects
 *   npx playwright test --project=desktop e2e/match.spec.ts
 *
 * Screenshots of every step go to $E2E_SHOTS (default test-results/shots).
 */
const PORT = 5287

export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 2,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    channel: 'chrome',
    headless: true,
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: 'desktop',
      use: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
    },
    {
      name: 'mobile',
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    env: { E2E_NO_HMR: '1' },
    timeout: 120_000,
  },
})
