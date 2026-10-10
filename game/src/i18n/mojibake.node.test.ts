/**
 * Guard: no mojibake ships. Turkish text that went through a wrong
 * UTF-8 → Latin-1/Windows-1252 round trip turns every "ı", "ş", "ü"… into a
 * two-character garble (src/sim/game/whyPlaying.ts had to be fixed by hand once).
 * Scans every source file (src/**\/*.ts(x), which includes the locale
 * sections in src/i18n) plus the legal pages and the web manifest.
 *
 * The patterns are built from char codes so this file never matches itself.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ch = (...codes: number[]): string => String.fromCharCode(...codes)
const A_TILDE = ch(0xc3) // A with tilde: lead byte of every 2-byte Latin-1 letter (ü ç ö Ç Ö Ü …)
const A_DIAER = ch(0xc4) // A with diaeresis: lead byte of ı İ ğ Ğ
const A_RING = ch(0xc5) // A with ring: lead byte of ş Ş
const A_CIRC = ch(0xe2) // a with circumflex (+ euro sign): curly quotes, dashes, ellipsis

/** Sequences that never occur in correct Turkish or English text. */
export const MOJIBAKE: readonly { seq: string; was: string }[] = [
  { seq: A_TILDE + ch(0xbc), was: 'ü' },
  { seq: A_TILDE + ch(0xa7), was: 'ç' },
  { seq: A_TILDE + ch(0xb6), was: 'ö' },
  { seq: A_TILDE + ch(0x2021), was: 'Ç' },
  { seq: A_TILDE + ch(0x2013), was: 'Ö' },
  { seq: A_TILDE + ch(0x153), was: 'Ü' },
  { seq: A_DIAER + ch(0xb1), was: 'ı' },
  { seq: A_DIAER + ch(0xb0), was: 'İ' },
  { seq: A_DIAER + ch(0x178), was: 'ğ' },
  { seq: A_DIAER + ch(0x17e), was: 'Ğ' },
  { seq: A_RING + ch(0x178), was: 'ş' },
  { seq: A_RING + ch(0x17e), was: 'Ş' },
  { seq: A_CIRC + ch(0x20ac), was: '’ “ ” – …' },
  { seq: ch(0xfffd), was: '(replacement character)' },
  // Any capital A-tilde at all: no Turkish/English string needs it, and it is the
  // first byte of most Latin-1 double encodings not listed above.
  { seq: A_TILDE, was: '(a double-encoded Latin letter)' },
]

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const SCAN: readonly { dir: string; ext: RegExp }[] = [
  { dir: 'src', ext: /\.(ts|tsx)$/ },
  { dir: 'public/legal', ext: /\.(html|md|txt)$/ },
  { dir: 'public', ext: /\.webmanifest$/ },
]

function walk(dir: string, ext: RegExp, out: string[], recurse: boolean): void {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return
  }
  for (const n of names) {
    if (n === 'node_modules' || n.startsWith('.')) continue
    const p = join(dir, n)
    const st = statSync(p)
    if (st.isDirectory()) {
      if (recurse) walk(p, ext, out, recurse)
    } else if (ext.test(n)) out.push(p)
  }
}

export function findMojibake(text: string): { line: number; was: string; snippet: string }[] {
  const hits: { line: number; was: string; snippet: string }[] = []
  text.split('\n').forEach((l, i) => {
    const m = MOJIBAKE.find((x) => l.includes(x.seq))
    if (m) {
      const at = l.indexOf(m.seq)
      hits.push({ line: i + 1, was: m.was, snippet: l.slice(Math.max(0, at - 20), at + 20).trim() })
    }
  })
  return hits
}

describe('mojibake guard', () => {
  it('detects the classic broken-Turkish sequences', () => {
    const broken = 'Kad' + A_DIAER + ch(0xb1) + 'n, ' + A_RING + ch(0x178) + 'ut, g' + A_TILDE + ch(0xbc) + 'zel'
    expect(findMojibake(broken)).toHaveLength(1)
    expect(findMojibake('x' + A_DIAER + ch(0xb1)).map((h) => h.was)).toEqual(['ı'])
    expect(findMojibake('Kadın, şut, güzel, İstanbul, Ğ, Çok, Öz, Üç — “ok” …')).toEqual([])
  })

  it('no source or locale file contains mojibake', () => {
    const files: string[] = []
    for (const s of SCAN) walk(join(ROOT, s.dir), s.ext, files, s.dir !== 'public')
    expect(files.length).toBeGreaterThan(100)
    const bad: string[] = []
    for (const f of files) {
      for (const h of findMojibake(readFileSync(f, 'utf8'))) bad.push(`${relative(ROOT, f)}:${h.line} (should be ${h.was}): ${h.snippet}`)
    }
    expect(bad, `Broken characters (fix the file encoding, save as UTF-8):\n${bad.join('\n')}`).toEqual([])
  })
})
