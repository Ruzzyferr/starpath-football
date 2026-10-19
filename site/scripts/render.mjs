// Writes index.html (TR, default) and en/index.html from index.template.html + content/copy.json.
// Both pages are complete static HTML, so the content reads without JavaScript.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const tpl = readFileSync(resolve(root, 'index.template.html'), 'utf8')
const copy = JSON.parse(readFileSync(resolve(root, 'content/copy.json'), 'utf8'))
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const RUNTIME = ['playHint', 'playPower', 'resGoal', 'resSaved', 'resPost', 'resWide', 'resOver', 'resWeak', 'summary', 'summaryPerfect', 'playKickLabel']

for (const lang of ['tr', 'en']) {
  const t = copy[lang]
  const other = lang === 'tr' ? 'en' : 'tr'
  const vars = {
    ...t,
    segTr: lang === 'tr' ? 'is-on' : '',
    segEn: lang === 'en' ? 'is-on' : '',
    privacyHref: `/legal/privacy-${lang}.html`,
    termsHref: `/legal/terms-${lang}.html`,
    privacyAltHref: `/legal/privacy-${other}.html`,
    termsAltHref: `/legal/terms-${other}.html`,
  }
  const runtime = JSON.stringify(Object.fromEntries(RUNTIME.map((k) => [k, t[k]]))).replace(/</g, '\u003c')
  const missing = new Set()
  let html = tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (k === '__runtime') return runtime
    if (!(k in vars)) { missing.add(k); return '' }
    return esc(vars[k])
  })
  if (missing.size) throw new Error(`copy.json ${lang}: missing ${[...missing].join(', ')}`)
  const out = lang === 'tr' ? resolve(root, 'index.html') : resolve(root, 'en/index.html')
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, html)
  console.log('rendered', out)
}
