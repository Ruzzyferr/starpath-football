import { existsSync } from 'node:fs'
import { defineConfig } from '@playwright/test'

/**
 * Playtest recorder (game/e2e-playtest): a human-like touch bot plays every
 * match moment on an Android-sized phone through real CDP touch events (the
 * same path a thumb takes), recording a video, a frame strip and metrics per
 * attempt for review. Not part of `npm run e2e`.
 *
 *   PW_PORT=6192 npx playwright test -c playwright.playtest.config.ts
 *   PT_KINDS=build_up,defend PT_SEEDS=3 PT_OUT=<dir> …
 */
const PORT = Number(process.env.PW_PORT ?? 6192)
// PT_VIEW=443x960 PT_VIDEO=886x1920 records an App Store preview-sized clip (6.9" iPhone).
const [VW, VH] = (process.env.PT_VIEW ?? '412x915').split('x').map(Number)
const [RW, RH] = (process.env.PT_VIDEO ?? `${VW}x${VH}`).split('x').map(Number)
const chrome = [
  `${process.env.PROGRAMFILES ?? 'C:/Program Files'}/Google/Chrome/Application/chrome.exe`,
  `${process.env.LOCALAPPDATA ?? ''}/Google/Chrome/Application/chrome.exe`,
].some((p) => existsSync(p))

export default defineConfig({
  testDir: './e2e-playtest',
  timeout: 600_000,
  fullyParallel: true,
  workers: Number(process.env.PT_WORKERS ?? 3),
  retries: 0,
  reporter: [['list']],
  outputDir: process.env.PT_OUT ? `${process.env.PT_OUT}/pw` : 'test-results/playtest',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    headless: true,
    // Screencast frames (PT_CAST) come in device pixels only with a real scale factor.
    launchOptions: { args: process.env.PT_CAST ? [`--force-device-scale-factor=${process.env.PT_DPR ?? 2}`] : [] },
    channel: chrome ? 'chrome' : undefined,
    // Pixel 7-class Android phone, portrait.
    viewport: { width: VW!, height: VH! },
    deviceScaleFactor: Number(process.env.PT_DPR ?? 2),
    isMobile: true,
    hasTouch: true,
    video: { mode: 'on', size: { width: RW!, height: RH! } },
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: true,
    env: { E2E_NO_HMR: '1' },
    timeout: 120_000,
  },
})
