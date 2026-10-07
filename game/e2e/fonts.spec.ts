import { test, expect, waitForApp } from './fixtures'

test('fonts are self-hosted and render Turkish glyphs, no Google Fonts requests', async ({ page, shot }) => {
  const external: string[] = []
  page.on('request', (r) => {
    if (/googleapis|gstatic/.test(r.url())) external.push(r.url())
  })
  await page.goto('/')
  await waitForApp(page)
  const result = await page.evaluate(async () => {
    const turkish = 'ğüşıöçİĞÜŞÖÇ'
    const specs = ['600 20px "Barlow Condensed"', 'italic 800 20px "Barlow Condensed"', '400 16px Inter', '700 16px Inter', '500 20px Teko']
    await Promise.all(specs.map((s) => document.fonts.load(s, turkish)))
    return specs.map((s) => [s, document.fonts.check(s, turkish)] as const)
  })
  for (const [spec, ok] of result) expect(ok, spec).toBe(true)
  await page.evaluate(() => {
    const d = document.createElement('div')
    d.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99999;background:#000;color:#fff;padding:8px'
    d.innerHTML = '<div style="font:italic 800 36px Barlow Condensed">ĞÜŞİÖÇ ğüşıöç Barlow</div><div style="font:500 32px Teko">ğüşıöçİ 3-2 Teko</div><div style="font:400 20px Inter">ğüşıöçİ Inter</div>'
    document.body.appendChild(d)
  })
  await shot('fonts-turkish')
  expect(external).toEqual([])
})
