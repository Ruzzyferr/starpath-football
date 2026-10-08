import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

type Budgets = typeof import('../../scripts/budgets.json')
interface Mod {
  measure(dist: string): Record<string, number>
  check(m: Record<string, number>, b: Record<string, number>): string[]
}
const load = async (): Promise<Mod> => (await import(/* @vite-ignore */ pathToFileURL(join(process.cwd(), 'scripts/check-budgets.mjs')).href)) as Mod

describe('bundle budgets (2.9#72/#73)', () => {
  it('measures a dist folder and flags breaches', async () => {
    const { measure, check } = await load()
    const dir = mkdtempSync(join(tmpdir(), 'sp-budget-'))
    try {
      mkdirSync(join(dir, 'assets'))
      writeFileSync(join(dir, 'assets', 'index-a.js'), 'x'.repeat(5000))
      writeFileSync(join(dir, 'assets', 'MatchScene-b.js'), 'y'.repeat(9000))
      writeFileSync(join(dir, 'assets', 'a.css'), 'a{}')
      writeFileSync(join(dir, 'assets', 'beep.mp3'), 'zzzz')
      const m = measure(dir)
      expect(m.jsChunks).toBe(2)
      expect(m.audioFileBytes).toBe(4)
      expect(m.jsInitialGzKB).toBeLessThan(m.jsTotalGzKB)
      expect(check(m, { jsChunks: 5, audioFileBytes: 10 })).toEqual([])
      expect(check(m, { jsChunks: 1 })).toHaveLength(1)
      expect(check(m, { nope: 1 })[0]).toMatch(/unknown/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('budgets.json only uses keys the script measures', async () => {
    const { check } = await load()
    const b = JSON.parse(readFileSync(join(process.cwd(), 'scripts/budgets.json'), 'utf8')) as Budgets
    const zero = { jsTotalGzKB: 0, jsLargestGzKB: 0, jsInitialGzKB: 0, cssTotalGzKB: 0, distTotalKB: 0, audioFileBytes: 0, jsChunks: 0 }
    expect(check(zero, b as unknown as Record<string, number>)).toEqual([])
  })
})
