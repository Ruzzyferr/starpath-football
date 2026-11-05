#!/usr/bin/env node
/**
 * Work tool for the translation overlays (src/i18n/overlay/<lang>.json, keyed by English text).
 *
 *   node scripts/i18n-overlay.mjs slice <lang> [size]   untranslated strings -> .work/<lang>/in-NNN.json
 *   node scripts/i18n-overlay.mjs merge <lang>          .work/<lang>/out-NNN.json -> <lang>.json
 *   node scripts/i18n-overlay.mjs check [lang…]         every entry keeps its placeholders; counts
 *
 * An out-NNN.json is an object { "<English>": "<translation>", … } for the strings of in-NNN.json.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = fileURLToPath(new URL('../src/i18n/overlay/', import.meta.url))
const source = JSON.parse(readFileSync(join(dir, '_source.json'), 'utf8'))
const read = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d)
const file = (lang) => join(dir, `${lang}.json`)
const work = (lang) => join(dir, '.work', lang)

/** The parts a translation must keep: {var}, {n|a|b} heads, ICU plural heads, %s, line breaks, emoji. */
function tokens(s) {
  const out = []
  for (const m of s.matchAll(/\{(\w+)(?:\s*,\s*plural|\|)?/g)) out.push(`{${m[1]}`)
  for (const m of s.matchAll(/\p{Extended_Pictographic}/gu)) out.push(m[0])
  out.push(`nl:${(s.match(/\n/g) ?? []).length}`)
  return out.sort().join(' ')
}

const [cmd, ...args] = process.argv.slice(2)
if (cmd === 'slice') {
  const [lang, size = '250'] = args
  const have = read(file(lang), {})
  const todo = source.filter((s) => !(s in have))
  mkdirSync(work(lang), { recursive: true })
  let n = 0
  for (let i = 0; i < todo.length; i += Number(size)) {
    writeFileSync(join(work(lang), `in-${String(n++).padStart(3, '0')}.json`), JSON.stringify(todo.slice(i, i + Number(size)), null, 1))
  }
  console.log(`${lang}: ${todo.length} to translate in ${n} chunks -> ${work(lang)}`)
} else if (cmd === 'merge') {
  const [lang] = args
  const out = read(file(lang), {})
  let added = 0
  for (const f of readdirSync(work(lang)).filter((f) => /^out-\d+\.json$/.test(f)).sort()) {
    const part = read(join(work(lang), f), {})
    for (const [k, v] of Object.entries(part)) {
      if (source.includes(k) && typeof v === 'string' && v.trim() && tokens(k) === tokens(v)) {
        if (!(k in out)) added++
        out[k] = v
      }
    }
  }
  const sorted = Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]]))
  writeFileSync(file(lang), JSON.stringify(sorted, null, 1) + '\n')
  console.log(`${lang}: +${added}, ${Object.keys(sorted).length}/${source.length}`)
} else if (cmd === 'check') {
  const langs = args.length ? args : readdirSync(dir).filter((f) => /^[a-z]{2}\.json$/.test(f)).map((f) => f.slice(0, 2))
  let bad = 0
  for (const lang of langs) {
    const o = read(file(lang), {})
    const broken = Object.entries(o).filter(([k, v]) => tokens(k) !== tokens(v))
    const missing = source.filter((s) => !(s in o)).length
    bad += broken.length
    console.log(`${lang}: ${Object.keys(o).length - broken.length}/${source.length} ok, ${missing} missing, ${broken.length} broken`)
    for (const [k, v] of broken.slice(0, 5)) console.log(`  ${JSON.stringify(k).slice(0, 80)} -> ${JSON.stringify(v).slice(0, 80)}`)
  }
  process.exit(bad ? 1 : 0)
} else {
  console.log('usage: i18n-overlay.mjs slice <lang> [size] | merge <lang> | check [lang…]')
}
