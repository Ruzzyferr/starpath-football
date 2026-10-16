/**
 * Contact sheets for review: one PNG per moment kind, one row per attempt
 * (persona × seed), ~10 evenly spaced frames plus the end frame, captioned
 * with what the bot did and what the game recognised.
 *   node e2e-playtest/sheets.mjs <PT_OUT>
 */
import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const OUT = process.argv[2]
if (!OUT) throw new Error('usage: node sheets.mjs <PT_OUT>')
const SHEETS = join(OUT, 'sheets')
mkdirSync(SHEETS, { recursive: true })
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])

const kinds = readdirSync(OUT).filter((d) => d !== 'sheets' && d !== 'pw' && existsSync(join(OUT, d)) && !d.includes('.'))
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1800, height: 1000 } })
for (const kind of kinds) {
  const runs = readdirSync(join(OUT, kind)).filter((d) => existsSync(join(OUT, kind, d, 'run.json')))
  let rows = ''
  let howTo = ''
  for (const r of runs) {
    const run = JSON.parse(readFileSync(join(OUT, kind, r, 'run.json'), 'utf8'))
    howTo = run.howTo ?? howTo
    const fr = run.frames
    const pick = fr.length <= 7 ? fr : Array.from({ length: 7 }, (_, i) => fr[Math.round((i * (fr.length - 1)) / 6)])
    const imgs = pick.map((f) => `<figure><img src="${pathToFileURL(join(OUT, kind, r, f.file)).href}"><figcaption>${(f.t / 1000).toFixed(1)}s ${esc(f.phase)}${f.heroOnBall ? ' ⚽' : ''}</figcaption></figure>`).join('')
    const end = existsSync(join(OUT, kind, r, 'end.jpg')) ? `<figure><img src="${pathToFileURL(join(OUT, kind, r, 'end.jpg')).href}"><figcaption>end</figcaption></figure>` : ''
    const inputs = run.inputs.filter((i) => !i.what.startsWith('tap to continue')).slice(0, 6).map((i) => `${(i.t / 1000).toFixed(1)}s ${i.what}`).join(' · ')
    rows += `<section><h2>${esc(r)} → <b>${esc(run.result)}</b>${run.graded ? ` · tier <b>${esc(run.graded.tier ?? '?')}</b> · banner “${esc(run.graded.banner)}${run.graded.sub ? ' — ' + esc(run.graded.sub) : ''}”` : ''} <small>${esc(run.summary ?? '')}</small></h2>
      <p>bot: ${esc(inputs)}<br>game recognised: ${esc(run.recognised.join(', '))} · kicks ${run.kicks}${run.geom ? ` · goal ${run.geom.goalWidthPx.toFixed(0)}×${run.geom.goalHeightPx.toFixed(0)}px, keeper ${run.geom.keeperHeightPx?.toFixed(0) ?? '-'}px, start ${run.geom.heroToGoalM?.toFixed(0)} m from the goal we attack / ${run.geom.heroToOwnGoalM?.toFixed(0) ?? '-'} m from our goal` : ''}</p>
      <div class="strip">${imgs}${end}</div></section>`
  }
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#111;color:#eee;font:13px system-ui} h1{margin:6px 10px;font-size:20px}
    section{margin:6px 10px 10px} h2{font-size:14px;margin:2px 0} p{margin:2px 0 4px;color:#bbb;font-size:12px}
    .strip{display:flex;gap:4px} figure{margin:0;width:225px} img{width:225px;display:block;border:1px solid #333}
    figcaption{font-size:10px;color:#aaa} .how{margin:0 10px 6px;color:#ffd23f;font-size:13px}</style><h1>${esc(kind)}</h1><p class="how">${esc(howTo)}</p>${rows}`
  const file = join(SHEETS, `${kind}.html`)
  writeFileSync(file, html)
  await page.goto(pathToFileURL(file).href)
  await page.waitForLoadState('load')
  await page.screenshot({ path: join(SHEETS, `${kind}.png`), fullPage: true })
}
await browser.close()
console.log(`sheets: ${kinds.length} → ${SHEETS}`)
