import { chromium } from '@playwright/test'
const screens = ['home','activities','training','profile','club','world','contract','life','preMatch','postMatch','seasonEnd','trophies','inbox','careerLog','settings','saves','menu','glossary','achievements','hallOfFame','board','community','objectives','national','awards','store','me','newCareer','title']
const lang = process.argv[2] ?? 'de-DE'
const b = await chromium.launch({ channel: 'chrome' })
const ctx = await b.newContext({ locale: lang, viewport: { width: 360, height: 780 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
for (const sc of screens) {
  const p = await ctx.newPage()
  await p.goto(`http://127.0.0.1:6195/?mock=1&dev=${sc}`)
  await p.waitForTimeout(2500)
  const r = await p.evaluate(() => {
    const W = innerWidth
    const bad = []
    for (const el of document.querySelectorAll('button, a, h1, h2, h3, .btn, [class*=title], [class*=label], [class*=chip], [class*=tab]')) {
      const b = el.getBoundingClientRect()
      if (b.width === 0 || b.height === 0) continue
      const st = getComputedStyle(el)
      if (st.visibility === 'hidden' || st.position === 'fixed' && b.right > W * 3) continue
      const clipped = el.scrollWidth > el.clientWidth + 2 && st.overflow !== 'visible' && st.textOverflow !== 'ellipsis'
      if (b.right > W + 1 || clipped) bad.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} "${(el.innerText || '').trim().slice(0, 30)}" r=${Math.round(b.right)}${clipped ? ' clipped' : ''}`)
    }
    return { scroll: document.documentElement.scrollWidth > W + 1, bad: [...new Set(bad)].slice(0, 4) }
  })
  if (r.scroll || r.bad.length) console.log(sc, r.scroll ? 'PAGE-SCROLL' : '', '\n   ' + r.bad.join('\n   '))
  await p.close()
}
await b.close()
