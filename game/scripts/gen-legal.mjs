#!/usr/bin/env node
/**
 * Renders docs/legal/*.md into static offline pages public/legal/{privacy,terms}-{tr,en}.html
 * (bundled into every build, linked from Settings > About). Tiny markdown subset:
 * headings, paragraphs, bullet lists, tables, blockquotes, **bold**, `code`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const src = join(root, '..', 'docs', 'legal')
const out = join(root, 'public', 'legal')
mkdirSync(out, { recursive: true })

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code>$1</code>')

function render(md) {
  const lines = md.split(/\r?\n/)
  const html = []
  let list = false
  let table = []
  const flushList = () => { if (list) { html.push('</ul>'); list = false } }
  const flushTable = () => {
    if (!table.length) return
    const rows = table.filter((r) => !/^\|[\s|:-]+\|$/.test(r)).map((r) => r.slice(1, -1).split('|').map((c) => c.trim()))
    html.push('<div class="tw"><table>' + rows.map((r, i) => '<tr>' + r.map((c) => `<${i ? 'td' : 'th'}>${inline(c)}</${i ? 'td' : 'th'}>`).join('') + '</tr>').join('') + '</table></div>')
    table = []
  }
  for (const line of lines) {
    if (/^<!--.*-->\s*$/.test(line)) continue
    if (line.startsWith('|')) { flushList(); table.push(line.trim()); continue }
    flushTable()
    if (/^#{1,3} /.test(line)) { flushList(); const n = line.match(/^#+/)[0].length; html.push(`<h${n}>${inline(line.replace(/^#+ /, ''))}</h${n}>`) }
    else if (line.startsWith('> ')) { flushList(); html.push(`<blockquote>${inline(line.slice(2))}</blockquote>`) }
    else if (line.startsWith('- ')) { if (!list) { html.push('<ul>'); list = true } html.push(`<li>${inline(line.slice(2))}</li>`) }
    else if (line.trim()) { flushList(); html.push(`<p>${inline(line)}</p>`) }
    else flushList()
  }
  flushList(); flushTable()
  return html.join('\n')
}

const page = (title, lang, body) => `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(title)}</title>
<style>
:root{color-scheme:light dark;--bg:#fff;--fg:#14181f;--mut:#566;--line:#cfd6df;--warn:#fff3cd;--warnfg:#5c4400}
@media(prefers-color-scheme:dark){:root{--bg:#0e1218;--fg:#e6ebf2;--mut:#9aa7b8;--line:#2b3442;--warn:#3a2f0b;--warnfg:#ffe9a6}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:46rem;margin:0 auto;padding:1rem 16px 3rem}
h1{font-size:1.6rem}h2{font-size:1.2rem;margin-top:2rem}
blockquote{margin:1rem 0;padding:.75rem 1rem;background:var(--warn);color:var(--warnfg);border-radius:8px}
.tw{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:.9rem}th,td{border:1px solid var(--line);padding:.4rem .6rem;text-align:left;vertical-align:top}
code{font-size:.9em}a{color:inherit}
</style></head><body><main>
${body}
</main></body></html>
`

for (const doc of ['privacy', 'terms']) {
  for (const lang of ['tr', 'en']) {
    const md = readFileSync(join(src, `${doc.toUpperCase()}.${lang}.md`), 'utf8')
    const title = md.match(/^# (.+)$/m)?.[1] ?? doc
    writeFileSync(join(out, `${doc}-${lang}.html`), page(title, lang, render(md)))
  }
}
console.log('legal pages written to public/legal')
