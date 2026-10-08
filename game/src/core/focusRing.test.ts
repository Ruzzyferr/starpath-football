import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('focus ring (GAP 2.9#97)', () => {
  const css = readFileSync(new URL('../styles/base.css', import.meta.url), 'utf8')
  it('keyboard focus uses the tokenised ring', () => {
    expect(css).toMatch(/:focus-visible\s*\{[^}]*box-shadow:\s*var\(--focus-ring\)/)
  })
  it('forced-colors mode gets a real outline (box-shadow is removed there)', () => {
    const block = /@media \(forced-colors: active\)\s*\{[\s\S]*?\n\}/.exec(css)?.[0] ?? ''
    expect(block).toContain(':focus-visible')
    expect(block).toMatch(/outline:\s*3px solid Highlight/)
  })
})
