#!/usr/bin/env node
/**
 * Fails when a UI component contains a literal user-facing string outside i18n:
 *   - JSX text nodes with letters  (<p>Hello</p>)
 *   - literal aria-label / title / placeholder / alt attributes
 * Existing debt is frozen per file in scripts/literal-strings.baseline.json, so the
 * count may only go down. `--update` rewrites the baseline; `--list` prints offenders.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const baselinePath = join(root, 'scripts/literal-strings.baseline.json')
const dirs = ['src/ui']
const ATTR = /\b(?:aria-label|title|placeholder|alt|aria-description)="([^"{}]*[A-Za-zÇĞİÖŞÜçğıöşü]{3,}[^"{}]*)"/g
// Text between > and < on one line that contains a word and no braces / code characters.
const TEXT = />\s*([A-Za-zÇĞİÖŞÜçğıöşü][A-Za-zÇĞİÖŞÜçğıöşü' ,.!?:;-]{2,}[A-Za-zÇĞİÖŞÜçğıöşü.!?])\s*</g
const ALLOW = [/^\s*(?:px|ms|vh|vw|rem|em)\s*$/i]

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx$/.test(n) && !/\.test\./.test(n)) out.push(p)
  }
  return out
}

export function scan() {
  const hits = {}
  for (const d of dirs) {
    for (const f of walk(join(root, d))) {
      const src = readFileSync(f, 'utf8')
      const found = []
      src.split(/\r?\n/).forEach((line, i) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(line) || line.includes('i18n-ok')) return
        for (const m of line.matchAll(ATTR)) found.push(`${i + 1}: ${m[0]}`)
        // Skip generics / comparisons such as `a > b` and `<T extends X>`: require a closing tag nearby.
        for (const m of line.matchAll(TEXT)) {
          const before = line[m.index - 1] ?? ' '
          // Code, not copy: generics (Promise<..>), ternaries, member access, arrows.
          if (/[\w\]=]/.test(before) || /\w\s*[?:]/.test(m[1]) || /\w\.\w/.test(m[1]) || / \?$/.test(m[1])) continue
          if (ALLOW.some((r) => r.test(m[1])) || /\b(?:return|const|let|=>)\b/.test(m[1])) continue
          found.push(`${i + 1}: >${m[1]}<`)
        }
      })
      if (found.length) hits[relative(root, f).split(String.fromCharCode(92)).join('/')] = found
    }
  }
  return hits
}

const hits = scan()
const counts = Object.fromEntries(Object.entries(hits).map(([k, v]) => [k, v.length]))
if (process.argv.includes('--update')) {
  writeFileSync(baselinePath, JSON.stringify(counts, null, 2) + '\n')
  console.log(`baseline written: ${Object.keys(counts).length} files, ${Object.values(counts).reduce((a, b) => a + b, 0)} literals`)
  process.exit(0)
}
if (process.argv.includes('--list')) {
  for (const [f, v] of Object.entries(hits)) console.log(f + '\n  ' + v.join('\n  '))
}
const base = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : {}
let failed = false
for (const [f, n] of Object.entries(counts)) {
  if (n > (base[f] ?? 0)) {
    failed = true
    console.error(`literal UI strings: ${f} has ${n} (baseline ${base[f] ?? 0}). Move text to src/i18n or add // i18n-ok:`)
    for (const l of hits[f].slice(0, 8)) console.error('  ' + l)
  }
}
if (failed) process.exit(1)
console.log(`literal-string check ok (${Object.values(counts).reduce((a, b) => a + b, 0)} frozen literals)`)
