// Captures the game's screens (mock career, casino-free dev server on :6195) per language, for the
// store screenshot compositor. Usage: node capture_screens.mjs <outDir> <locale…>
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const [out, ...locales] = process.argv.slice(2)
const SCREENS = ['liveMatch', 'home', 'contract', 'profile', 'life', 'postMatch', 'seasonEnd', 'world']
const DEVICES = {
  phone: { viewport: { width: 412, height: 866 }, deviceScaleFactor: 2.55, isMobile: true, hasTouch: true },
  tablet: { viewport: { width: 820, height: 1093 }, deviceScaleFactor: 2.2, isMobile: true, hasTouch: true },
}
const b = await chromium.launch({ channel: 'chrome' })
for (const loc of locales) {
  for (const [dev, opts] of Object.entries(DEVICES)) {
    mkdirSync(`${out}/${loc}/${dev}`, { recursive: true })
    const ctx = await b.newContext({ ...opts, locale: loc })
    for (const sc of SCREENS) {
      const p = await ctx.newPage()
      await p.goto(`http://127.0.0.1:6195/?mock=1&dev=${sc}`)
      await p.waitForTimeout(sc === 'liveMatch' ? 9000 : 4500)
      await p.screenshot({ path: `${out}/${loc}/${dev}/${sc}.png` })
      await p.close()
    }
    await ctx.close()
  }
  console.log('captured', loc)
}
await b.close()
