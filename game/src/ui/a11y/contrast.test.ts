import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { contrast, parseTokens, resolveColor } from './contrast'

const css = readFileSync(new URL('../../styles/tokens.css', import.meta.url), 'utf8')
const base = parseTokens(css, /^:root$/)
const withMode = (sel: RegExp) => ({ ...base, ...parseTokens(css, sel) })
const modes: Record<string, Record<string, string>> = {
  default: base,
  'high-contrast': withMode(/^:root\[data-contrast='high'\]$/),
  protanopia: withMode(/^:root\[data-cb='protanopia'\]$/),
  deuteranopia: withMode(/^:root\[data-cb='deuteranopia'\]$/),
  tritanopia: withMode(/^:root\[data-cb='tritanopia'\]$/),
}
const c = (tk: Record<string, string>, n: string) => {
  const v = resolveColor(tk, n)
  if (!v) throw new Error(`unresolvable token ${n}`)
  return v
}

const SURFACES = ['--bg-0', '--bg-1', '--surface-1', '--surface-2']
const TEXT = ['--text-hi', '--text-mid', '--text-lo']
/** Accent/state colours used as text or icons on the dark surfaces. */
const COLOURS = ['--brand-pitch', '--accent-gold', '--accent-blue', '--state-success', '--state-warning', '--state-danger', '--state-info']

describe('WCAG AA contrast over design tokens', () => {
  for (const [mode, tk] of Object.entries(modes)) {
    it(`${mode}: body text >= 4.5:1 on every surface`, () => {
      const bad: string[] = []
      for (const t of TEXT) for (const s of SURFACES) {
        const r = contrast(c(tk, t), c(tk, s))
        if (r < 4.5) bad.push(`${t} on ${s}: ${r.toFixed(2)}`)
      }
      expect(bad).toEqual([])
    })
    it(`${mode}: accent and state colours >= 4.5:1 on surface-1/2`, () => {
      const bad: string[] = []
      for (const a of COLOURS) for (const s of ['--surface-1', '--surface-2']) {
        const r = contrast(c(tk, a), c(tk, s))
        if (r < 4.5) bad.push(`${a} on ${s}: ${r.toFixed(2)}`)
      }
      expect(bad).toEqual([])
    })
  }
  it('dark text on pitch-green and gold fills >= 4.5:1', () => {
    expect(contrast(c(base, '--text-on-pitch'), c(base, '--brand-pitch'))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(c(base, '--text-on-gold'), c(base, '--accent-gold'))).toBeGreaterThanOrEqual(4.5)
  })
  it('strong borders and focus colour reach 3:1 (non-text, 1.4.11) in high-contrast mode', () => {
    const tk = modes['high-contrast']!
    expect(contrast(c(tk, '--border-strong'), c(tk, '--surface-1'))).toBeGreaterThanOrEqual(3)
    expect(contrast(c(tk, '--accent-blue'), c(tk, '--bg-0'))).toBeGreaterThanOrEqual(3)
  })
})

describe('grayscale legibility (2.11#2)', () => {
  // Meaning pairs must stay distinguishable by lightness alone (ratio >= 1.25) in every palette.
  const PAIRS: [string, string][] = [['--pos', '--neg'], ['--zone-promo', '--zone-releg'], ['--attr-1', '--attr-5']]
  for (const [mode, tk] of Object.entries(modes)) {
    it(`${mode}: good/bad pairs differ in lightness`, () => {
      const bad: string[] = []
      for (const [a, b] of PAIRS) {
        const r = contrast(c(tk, a), c(tk, b))
        if (r < 1.25) bad.push(`${a} vs ${b}: ${r.toFixed(2)}`)
      }
      expect(bad).toEqual([])
    })
  }
})
