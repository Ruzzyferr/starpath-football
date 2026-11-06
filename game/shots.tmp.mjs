import { chromium } from '@playwright/test'
const [lang, outDir, ...screens] = process.argv.slice(2)
const b = await chromium.launch({ channel: 'chrome' })
for (const sc of screens) {
  const p = await b.newPage({ locale: lang, viewport: { width: 412, height: 892 }, deviceScaleFactor: 2.5 })
  await p.goto(`http://127.0.0.1:6195/?mock=1&dev=${sc}`)
  await p.waitForTimeout(5000)
  await p.screenshot({ path: `${outDir}/${lang}-${sc}.png` })
  await p.close()
}
await b.close()
