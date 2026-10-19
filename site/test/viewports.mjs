// Viewport matrix check: every section of the site at phones (portrait and landscape), tablets,
// desktops and tall portrait monitors. For each section, at its stop on the camera path, asserts:
//   - no horizontal overflow of the page;
//   - no visible text outside the viewport (left/right), and no text cut by the screen bottom on the
//     section's first screen when the section fits;
//   - no scrim (a translucent dark panel laid over the 3D world) taller than 60% of the viewport;
//   - the section's heading is fully visible: inside the viewport under the bar, not covered.
// Screenshots of every section are written for a representative subset (one size per group plus the
// owner's 1389x2316).
//
//   node test/viewports.mjs [baseUrl] [outDir] [--only=WxH,...] [--lang=tr|en] [--nowebgl]
// Exit code 1 if any assertion fails.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const args = process.argv.slice(2)
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')))
const [base = 'http://localhost:5795/', out = 'viewport-shots'] = args.filter((a) => !a.startsWith('--'))
const GROUPS = {
  'phone-portrait': ['320x568', '360x740', '375x667', '390x844', '414x896', '430x932'],
  'phone-landscape': ['568x320', '667x375', '844x390', '932x430'],
  tablet: ['768x1024', '820x1180', '1024x768', '1180x820', '1024x1366', '1366x1024'],
  desktop: ['1280x720', '1440x900', '1920x1080', '2560x1440', '3440x1440'],
  tall: ['1389x2316', '1440x2560', '1080x1920'],
}
const SHOOT = new Set(['390x844', '844x390', '768x1024', '1440x900', '2560x1440', '1389x2316', '1440x2560', '1920x1080'])
const SECTIONS = ['top', 'penalti', 'anlar', 'kariyer', 'hayat', 'adil', 'platformlar', 'foot']
const only = flags.only ? new Set(flags.only.split(',')) : null
const url = new URL(flags.lang === 'en' ? 'en/' : '', base).href
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ args: flags.nowebgl ? ['--disable-webgl', '--disable-3d-apis'] : ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const failures = []
let checks = 0

for (const [group, sizes] of Object.entries(GROUPS)) {
  for (const size of sizes) {
    if (only && !only.has(size)) continue
    const [w, h] = size.split('x').map(Number)
    const touch = Math.min(w, h) < 600
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: touch, hasTouch: touch, deviceScaleFactor: 1 })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(url, { waitUntil: 'networkidle' })
    if (!flags.nowebgl) await page.waitForSelector('.world.is-live', { timeout: 20000 }).catch(() => errors.push('world never went live'))
    // The brand is Latin: no Turkish dotted capital I may appear in it (CSS uppercase under lang="tr").
    const brands = await page.evaluate(() => [...document.querySelectorAll('[data-brand], .wordmark .brand, .foot-name')].map((e) => e.innerText))
    if (!brands.length) failures.push(`${size} (${group}): no brand elements found`)
    for (const b of brands) if (/[İı]/.test(b) || b.replace(/\s/g, '') !== 'KICKBORN') failures.push(`${size} (${group}): brand renders as "${b}"`)
    // Reveal everything so the check measures the settled layout.
    await page.evaluate(() => document.querySelectorAll('.reveal').forEach((e) => e.classList.add('is-in')))
    for (const id of SECTIONS) {
      await page.evaluate((id) => {
        const el = document.getElementById(id)
        const bar = document.querySelector('.bar')?.getBoundingClientRect().height ?? 0
        window.scrollTo(0, Math.max(0, el.offsetTop - (id === 'top' ? 0 : bar)))
      }, id)
      await page.waitForTimeout(SHOOT.has(size) ? 1600 : 450)
      const r = await page.evaluate((id) => {
        const vw = document.documentElement.clientWidth
        const vh = innerHeight
        const bar = document.querySelector('.bar')?.getBoundingClientRect().height ?? 0
        const sec = document.getElementById(id)
        const problems = []
        const over = document.documentElement.scrollWidth - vw
        if (over > 1) problems.push(`horizontal overflow ${over}px`)
        const visible = (el) => {
          const cs = getComputedStyle(el)
          if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < 0.1) return false
          for (let p = el; p; p = p.parentElement) {
            const s = getComputedStyle(p)
            if (s.display === 'none' || s.visibility === 'hidden') return false
            if (p.hidden) return false
          }
          return true
        }
        // Text outside the viewport (horizontally), for text in this section that is on screen.
        const walker = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT)
        const rg = document.createRange()
        const seen = new Set()
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          if (!n.nodeValue.trim() || !n.parentElement || !visible(n.parentElement)) continue
          if (n.parentElement.closest('[data-ui], .sr-only, .skip, noscript')) continue
          rg.selectNodeContents(n)
          for (const b of rg.getClientRects()) {
            if (b.width < 1 || b.bottom < bar || b.top > vh) continue
            if (b.left < -1 || b.right > vw + 1) {
              const t = n.nodeValue.trim().slice(0, 30)
              if (!seen.has(t)) problems.push(`text outside viewport: "${t}" (${Math.round(b.left)}..${Math.round(b.right)} of ${vw})`)
              seen.add(t)
            }
          }
        }
        // Scrims: translucent dark backgrounds laid over the world.
        for (const el of sec.querySelectorAll('*')) {
          if (!visible(el)) continue
          const m = getComputedStyle(el).backgroundColor.match(/rgba?\(([^)]+)\)/)
          if (!m) continue
          const [r, g, b, a = '1'] = m[1].split(/[ ,/]+/).filter(Boolean)
          const alpha = parseFloat(a)
          if (!(alpha > 0.3 && alpha < 0.96) || +r + +g + +b > 120) continue
          const box = el.getBoundingClientRect()
          if (box.height > vh * 0.6) problems.push(`scrim ${el.className || el.tagName} is ${Math.round(box.height)}px = ${Math.round((box.height / vh) * 100)}% of the viewport`)
        }
        // The section heading.
        const hd = sec.querySelector('h1, h2')
        if (!hd) problems.push('no heading')
        else {
          const b = hd.getBoundingClientRect()
          if (b.top < bar - 1 || b.bottom > vh + 1 || b.left < -1 || b.right > vw + 1) problems.push(`heading "${hd.textContent.trim().slice(0, 30)}" not fully visible (${Math.round(b.left)},${Math.round(b.top)} ${Math.round(b.width)}x${Math.round(b.height)}; bar ${Math.round(bar)}, vh ${vh})`)
          else if (hd.scrollWidth > hd.clientWidth + 2) problems.push(`heading "${hd.textContent.trim().slice(0, 30)}" clipped horizontally`)
          else {
            // Hit-test with pointer events on everywhere (overlays let the pointer through to the world).
            const st = document.createElement('style')
            st.textContent = '* { pointer-events: auto !important; } .world, .world * { pointer-events: none !important; }'
            document.head.appendChild(st)
            const pts = [[0.5, 0.5], [0.08, 0.5], [0.92, 0.5]].map(([fx, fy]) => document.elementFromPoint(b.left + b.width * fx, b.top + b.height * fy))
            st.remove()
            const covered = pts.filter((el) => el && !hd.contains(el) && !el.contains(hd))
            if (covered.length) problems.push(`heading "${hd.textContent.trim().slice(0, 30)}" covered by ${covered[0].className || covered[0].tagName}`)
          }
        }
        return problems
      }, id)
      checks++
      for (const p of r) failures.push(`${size} (${group}) #${id}: ${p}`)
      if (SHOOT.has(size)) await page.screenshot({ path: `${out}/${size}-${id}.png` })
    }
    for (const e of errors) failures.push(`${size} (${group}): page error ${e}`)
    console.log(`${size.padEnd(10)} ${group.padEnd(16)} ${failures.filter((f) => f.startsWith(size + ' ')).length ? 'FAIL' : 'ok'}`)
    await ctx.close()
  }
}
await browser.close()
console.log(`\n${checks} section checks, ${failures.length} problem(s)`)
for (const f of failures) console.log('  ' + f)
process.exit(failures.length ? 1 : 0)
