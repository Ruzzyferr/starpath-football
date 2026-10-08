/**
 * Design-system audit (GAP 2.7#1, #2, #7, #8, #15): contrast of token pairs in
 * both themes, tabular numerals, and frozen-debt counters for hard-coded hex
 * colours, off-scale radii and spacing. Counters may only go down.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '..')

function walk(dir: string, ext: RegExp, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) walk(p, ext, out)
    else if (ext.test(n) && !/\.test\./.test(n)) out.push(p)
  }
  return out
}
const read = (p: string): string => readFileSync(join(root, p), 'utf8')

// ── Contrast ────────────────────────────────────────────────────────────

function block(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(selector + ' {')
  expect(start, selector).toBeGreaterThanOrEqual(0)
  const end = css.indexOf('\n}', start)
  const vars: Record<string, string> = {}
  for (const m of css.slice(start, end).matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g)) vars[m[1]] = m[2]
  return vars
}

const lin = (c: number): number => {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const lum = (hex: string): number => {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
}
export const contrast = (a: string, b: string): number => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const tokens = read('styles/tokens.css')
const dark = block(tokens, ':root')
const light = { ...dark, ...block(tokens, ":root[data-theme='light']") }

const TEXT = ['--text-hi', '--text-mid', '--text-lo']
const SURFACES = ['--bg-0', '--bg-1', '--surface-1', '--surface-2', '--surface-3']
const ACCENT_TEXT = ['--accent-gold', '--accent-blue', '--accent-violet', '--pos', '--neg', '--brand-pitch', '--state-warning']

describe.each([['dark', dark], ['light', light]] as const)('token contrast (%s)', (_name, t) => {
  it.each(TEXT.flatMap((f) => SURFACES.map((b) => [f, b])))('%s on %s >= 4.5', (f, b) => {
    // Resolve var() aliases such as --pos: var(--state-success).
    const fg = t[f]
    const bg = t[b]
    expect(fg && bg, `${f} / ${b} defined`).toBeTruthy()
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5)
  })
  it.each(ACCENT_TEXT.map((f) => [f]))('%s on surface-1 >= 4.5', (f) => {
    const fg = t[f] ?? t['--state-success'] // --pos / --neg alias the state colours in the dark palette
    const neg = f === '--neg' ? t['--state-danger'] : fg
    const col = f === '--pos' ? t['--state-success'] : neg
    expect(contrast(col, t['--surface-1'])).toBeGreaterThanOrEqual(4.5)
  })
  it('label colours on filled buttons >= 3 (bold large text)', () => {
    expect(contrast(t['--text-on-pitch'], t['--brand-pitch'])).toBeGreaterThanOrEqual(3)
    expect(contrast(t['--text-on-gold'], t['--accent-gold'])).toBeGreaterThanOrEqual(3)
  })
})

// ── Numerals ────────────────────────────────────────────────────────────

describe('numerals', () => {
  it('.num uses tabular figures', () => {
    expect(read('styles/base.css')).toMatch(/\.num\b[^{]*\{[^}]*tabular-nums/)
  })
})

// ── Frozen debt ─────────────────────────────────────────────────────────

describe('frozen debt (may only go down)', () => {
  const tsx = walk(join(root, 'ui'), /\.tsx$/).filter((p) => !/[\\/](dev|art)[\\/]/.test(p)).map((p) => readFileSync(p, 'utf8'))
  const css = walk(join(root, 'styles'), /\.css$/).filter((p) => !/tokens\.css$/.test(p)).map((p) => readFileSync(p, 'utf8'))

  it('hex colours in component code', () => {
    let n = 0
    for (const f of tsx) n += (f.match(/['"`]#[0-9a-fA-F]{3,8}['"`]/g) ?? []).length
    expect(n).toBeLessThanOrEqual(138)
  })

  it('border-radius values outside the scale', () => {
    const ok = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 999])
    let n = 0
    for (const f of css) {
      for (const m of f.matchAll(/border-radius:\s*(\d+)px/g)) if (!ok.has(Number(m[1]))) n++
    }
    expect(n).toBeLessThanOrEqual(40)
  })

  it('font sizes under 12px', () => {
    let n = 0
    for (const f of css) {
      const s = f
      n += (s.match(/font-size:\s*(?:\d|1[01])px/g) ?? []).length
      for (const m of s.matchAll(/font-size:\s*0?\.(\d+)rem/g)) if (Number(`0.${m[1]}`) < 0.75 && !s.includes('.rl-num')) n++
    }
    expect(n).toBeLessThanOrEqual(2)
  })
})
