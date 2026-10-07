import { existsSync } from 'node:fs'
import { defineConfig } from '@playwright/test'

/**
 * Real-browser end-to-end suite (game/e2e). Locally it uses the installed
 * Google Chrome (`channel: 'chrome'`) — no browser download needed. On CI, or
 * when Chrome is not installed, it falls back to Playwright's bundled Chromium
 * (`npx playwright install --with-deps chromium`). Override with
 * PW_CHANNEL=chrome|msedge|chromium.
 *
 *   npm run e2e                 both projects
 *   npx playwright test --project=desktop e2e/match.spec.ts
 *
 * Screenshots of every step go to $E2E_SHOTS (default test-results/shots).
 */
const PORT = Number(process.env.PW_PORT ?? 5287)

function chromeInstalled(): boolean {
  const paths = [
    `${process.env.PROGRAMFILES ?? 'C:/Program Files'}/Google/Chrome/Application/chrome.exe`,
    `${process.env['PROGRAMFILES(X86)'] ?? 'C:/Program Files (x86)'}/Google/Chrome/Application/chrome.exe`,
    `${process.env.LOCALAPPDATA ?? ''}/Google/Chrome/Application/chrome.exe`,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/opt/google/chrome/chrome',
    '/usr/bin/google-chrome',
  ]
  return paths.some((p) => existsSync(p))
}
const envChannel = process.env.PW_CHANNEL
const channel = envChannel ? (envChannel === 'chromium' ? undefined : envChannel) : !process.env.CI && chromeInstalled() ? 'chrome' : undefined

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
    channel,
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
