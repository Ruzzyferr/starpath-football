#!/usr/bin/env node
/** Fails if a bundled legal page still has placeholders or draft banners. */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = join(fileURLToPath(new URL('..', import.meta.url)), 'public', 'legal')
const bad = ['[COMPANY]', '[ADDRESS]', '[CONTACT_EMAIL]', '[DATE]', '[TARİH]', 'DRAFT', 'TASLAK']
let failed = false
for (const f of readdirSync(dir).filter((n) => n.endsWith('.html'))) {
  const t = readFileSync(join(dir, f), 'utf8')
  for (const b of bad) if (t.includes(b)) { console.error(`${f}: contains ${b}`); failed = true }
}
if (failed) process.exit(1)
console.log('legal pages clean')
