#!/usr/bin/env node
/**
 * Collects every English UI string the game can show, for the translation overlays
 * (src/i18n/overlay/<lang>.json, keyed by the English text):
 *   - leaves of the keyed dictionary (src/i18n/en.ts, through its sections)
 *   - TR/EN pairs written inline: calls like L('…','…') / t('…','…') with two string
 *     literals, and object literals { tr: '…', en: '…' }
 * Writes src/i18n/overlay/_source.json (sorted unique strings) and prints counts.
 *
 *   node scripts/i18n-extract.mjs            write the source list
 *   node scripts/i18n-extract.mjs --missing  list overlay entries missing per language
 */
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('..', import.meta.url))
const src = join(root, 'src')
const outDir = join(src, 'i18n', 'overlay')
const strings = new Set()

const lit = (n) => (n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null)

function walkFiles(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) {
      if (f === 'overlay' || f === '__tests__') continue // ui/dev: the sample career seen in store screenshots
      walkFiles(p, out)
    } else if (/\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.endsWith('.d.ts')) out.push(p)
  }
  return out
}

for (const file of walkFiles(src)) {
  const rel = relative(src, file).replace(/\\/g, '/')
  const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  // The keyed English dictionary: every string leaf of en.ts and of the sections' `en` export.
  const isEnDict = rel === 'i18n/en.ts' || rel.startsWith('i18n/sections/')
  const visit = (n) => {
    if (ts.isCallExpression(n) && n.arguments.length >= 2) {
      const a = lit(n.arguments[0])
      const b = lit(n.arguments[1])
      const callee = n.expression.getText(sf)
      if (a !== null && b !== null && /(^|\.)(L|t|lt|tt|lt2|pair)$/.test(callee) && a !== b) strings.add(b)
    }
    if (ts.isObjectLiteralExpression(n)) {
      const props = new Map()
      for (const p of n.properties) if (ts.isPropertyAssignment(p) && p.name) props.set(p.name.getText(sf).replace(/['"]/g, ''), p.initializer)
      const tr = lit(props.get('tr'))
      const en = lit(props.get('en'))
      if (tr !== null && en !== null) strings.add(en)
      // Per-language tables { tr: {…}, en: {…} } (match/training scenes): every English leaf.
      const enObj = props.get('en')
      if (props.has('tr') && enObj && ts.isObjectLiteralExpression(enObj)) collectLeaves(enObj)
    }
    if (isEnDict && ts.isVariableDeclaration(n) && n.name.getText(sf) === 'en' && n.initializer) collectLeaves(n.initializer)
    ts.forEachChild(n, visit)
  }
  const collectLeaves = (n) => {
    const s = lit(n)
    if (s !== null) {
      if (s.trim()) strings.add(s)
      return
    }
    ts.forEachChild(n, collectLeaves)
  }
  visit(sf)
}

const list = [...strings].filter((s) => /[A-Za-z]/.test(s)).sort()
mkdirSync(outDir, { recursive: true })
if (process.argv.includes('--missing')) {
  for (const f of readdirSync(outDir).filter((f) => /^[a-z]{2}\.json$/.test(f))) {
    const o = JSON.parse(readFileSync(join(outDir, f), 'utf8'))
    const miss = list.filter((s) => !(s in o))
    console.log(`${f}: ${list.length - miss.length}/${list.length} translated, ${miss.length} missing`)
  }
} else {
  writeFileSync(join(outDir, '_source.json'), JSON.stringify(list, null, 1) + '\n')
  const chars = list.reduce((n, s) => n + s.length, 0)
  console.log(`${list.length} unique English strings, ${chars} characters -> src/i18n/overlay/_source.json`)
}
if (!existsSync(outDir)) process.exit(1)
