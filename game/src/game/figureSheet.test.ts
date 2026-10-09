import { describe, expect, it, vi } from 'vitest'

vi.mock('phaser', () => ({ default: { WEBGL: 2 } }))

const { FIG_RES, SHEET_W, sheetPages } = await import('./figures')

describe('figure sheet paging (iOS texture limits)', () => {
  it('fits one page at the default 4096 limit', () => {
    for (const S of Object.values(FIG_RES)) {
      const p = sheetPages(S, 4096)
      expect(p.w).toBe(SHEET_W)
      expect(p.pages).toHaveLength(1)
      expect(p.pages[0]!).toBeLessThanOrEqual(4096)
    }
  })

  it('splits into pages that each fit a small max texture size, keeping every frame', () => {
    const one = sheetPages(FIG_RES.high, 4096)
    const small = sheetPages(FIG_RES.high, 512)
    expect(small.w).toBeLessThanOrEqual(512)
    expect(small.pages.length).toBeGreaterThan(1)
    for (const h of small.pages) expect(h).toBeLessThanOrEqual(512)
    expect(small.frames).toBe(one.frames)
  })
})
