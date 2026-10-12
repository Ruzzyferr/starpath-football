import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

/**
 * Real-browser end-to-end suite (game/e2e). Locally it uses the installed
 * Google Chrome (`channel: 'chrome'`) — no browser download needed. On CI, or
 * when Chrome is not installed, it falls back to Playwright's bundled Chromium
 * (`npx playwright install --with-deps chromium`). Override with
 * PW_CHANNEL=chrome|msedge|chromium.
 *
 *   npm run e2e                 all projects
 *   npx playwright test --project=desktop e2e/match.spec.ts
 *
 * Screenshots of every step go to $E2E_SHOTS (default test-results/shots).
 */
/**
 * Specs that also run in WebKit with an iPhone descriptor (touch, DPR 3), so
 * iOS / WKWebView regressions (blank textures, dead buttons) surface on every
 * run. Needs `npx playwright install webkit` once.
 */
const WEBKIT_SPECS = /(?:^|[\\/])(?:demo|match|matchup|press|tier|kitcontrast|training|onboarding|smoke|ios|saves|autosave|eventOdds|eventWheel|eventOneShot|tutorials)\.spec\.ts$/

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
    headless: true,
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: 'desktop',
      use: { channel, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
    },
    {
      name: 'mobile',
      use: { channel, viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    },
    {
      // iPhone 15 in WebKit: the engine iOS / Capacitor's WKWebView runs.
      name: 'webkit-iphone',
      testMatch: WEBKIT_SPECS,
      // Headless WebKit's WebGL is software-rendered and slow under two workers: one retry for timing flakes.
      retries: 1,
      // Runtime budget: a representative slice of the slow Phaser specs (WebKit runs them ~2x slower).
      grepInvert: /match-demo autopilot reaches an outcome: (?!(?:build_up|penalty|gk_save|corner)$)|goalkeeper distribution|cross station|explosive starts/,
      use: { ...devices['iPhone 15'] },
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
