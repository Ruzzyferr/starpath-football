import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : []
  })
}

describe('cosmetic / purchase isolation (2.9#126)', () => {
  const root = join(process.cwd(), 'src')
  const simFiles = [...walk(join(root, 'sim')), ...walk(join(root, 'core'))].filter((f) => !f.endsWith('.test.ts'))

  it('simulation and core never import purchases, telemetry, audio or platform code', () => {
    expect(simFiles.length).toBeGreaterThan(50)
    const bad: string[] = []
    for (const f of simFiles) {
      const src = readFileSync(f, 'utf8')
      for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        if (/(^|\/)(store-iap|telemetry|audio|platform|ui)(\/|$)/.test(m[1]!)) bad.push(`${f.replace(root, 'src')} -> ${m[1]}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('the catalog sells only cosmetic or content-unlock products (no stat boosts)', () => {
    const catalog = readFileSync(join(root, 'store-iap', 'catalog.ts'), 'utf8')
    expect(catalog).not.toMatch(/\b(ovr|overall|xp|attribute|boost|potion|energy|stamina|reputation)\b\s*[:=]/i)
  })
})
