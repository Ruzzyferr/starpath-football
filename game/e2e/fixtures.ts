/**
 * Shared e2e fixtures: every test fails on console errors, uncaught page
 * errors and missing-i18n-key warnings; `shot()` saves a named screenshot.
 */
import { test as base, expect, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

export const SHOTS = process.env.E2E_SHOTS || join(process.cwd(), 'test-results', 'shots')
mkdirSync(SHOTS, { recursive: true })

/** Console noise that is not an app bug. */
const IGNORE = [
  /fonts\.(googleapis|gstatic)\.com/i, // offline font CDN
  /Failed to load resource.*fonts/i,
  /\[vite\]/i,
  /AudioContext was not allowed to start/i,
  /GPU stall due to ReadPixels/i,
  /Automatic fallback to software WebGL/i,
]

export interface Problems {
  list: string[]
}

export const test = base.extend<{ problems: Problems; shot: (name: string) => Promise<void> }>({
  problems: [
    async ({ page }, use, testInfo) => {
      const problems: Problems = { list: [] }
      page.on('console', (m) => {
        const text = m.text()
        if (IGNORE.some((r) => r.test(text))) return
        // Reported with its URL by the response listener below.
        if (/^Failed to load resource/.test(text)) return
        if (m.type() === 'error') problems.list.push(`console.error: ${text}`)
        else if (m.type() === 'warning' && /\[i18n\]|missing key/i.test(text)) problems.list.push(`i18n: ${text}`)
      })
      page.on('pageerror', (e) => problems.list.push(`pageerror: ${e.message}\n${e.stack ?? ''}`))
      page.on('response', (r) => {
        if (r.status() >= 400 && !IGNORE.some((x) => x.test(r.url()))) problems.list.push(`http ${r.status()}: ${r.url()}`)
      })
      await use(problems)
      if (testInfo.status === testInfo.expectedStatus) {
        expect(problems.list, 'console / page errors').toEqual([])
      } else if (problems.list.length) {
        console.log('[e2e] problems:', problems.list)
      }
    },
    { auto: true },
  ],
  shot: async ({ page }, use, testInfo) => {
    await use(async (name: string) => {
      const file = join(SHOTS, `e2e-${testInfo.project.name}-${name}.png`)
      await page.screenshot({ path: file })
    })
  },
})

export { expect }

/** Start with English UI unless a test switched languages itself. */
export async function preferEnglish(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      const k = 'starpath.settings.v1'
      if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify({ lang: 'en', reducedMotion: false }))
    } catch {
      /* ignore */
    }
  })
}

/** Text of the page body, checked for render bugs. */
export async function assertCleanText(page: Page): Promise<void> {
  const text = await page.locator('body').innerText()
  expect(text, 'NaN in UI').not.toMatch(/\bNaN\b/)
  expect(text, 'undefined in UI').not.toMatch(/\bundefined\b/)
  expect(text, 'null in UI').not.toMatch(/\bnull\b/)
  expect(text, 'raw i18n key in UI').not.toMatch(/\b(?:common|home|wizard|match|casino|life|season|settings|saves|contract|data|event|title|club|world|planner|profile|training|inbox|nav|ui)\.[a-z][A-Za-z]+(?:\.[A-Za-z]+)*\b/)
}

/** The dev debug API (window.__sp), present in vite dev builds only. */
export async function sp<T>(page: Page, fn: string): Promise<T> {
  return page.evaluate(`(() => { const sp = window.__sp; return (${fn}) })()`) as Promise<T>
}

export async function waitForApp(page: Page): Promise<void> {
  await page.waitForFunction(() => !!(window as unknown as { __sp?: unknown }).__sp && !!document.querySelector('#main'))
}
