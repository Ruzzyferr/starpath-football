import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

interface Mod {
  assemble(a: string, o: string, env: Record<string, string>): { appId: number; depots: { id: number; os: string }[] }
}

describe('Steam depot assembly (2.9#117/#118)', () => {
  it('maps CI artifacts to depots and renders VDF files', async () => {
    const mod = (await import(/* @vite-ignore */ pathToFileURL(join(process.cwd(), 'scripts/steam-depot.mjs')).href)) as Mod
    const root = mkdtempSync(join(tmpdir(), 'sp-steam-'))
    try {
      for (const n of ['desktop-windows-latest', 'desktop-ubuntu-latest', 'other']) {
        mkdirSync(join(root, 'in', n), { recursive: true })
        writeFileSync(join(root, 'in', n, 'game.bin'), n)
      }
      const r = mod.assemble(join(root, 'in'), join(root, 'out'), { SP_STEAM_APP_ID: '4242', SP_STEAM_BRANCH: 'beta' })
      expect(r.depots.map((d) => d.os).sort()).toEqual(['linux', 'windows'])
      expect(existsSync(join(root, 'out', 'content', 'windows', 'game.bin'))).toBe(true)
      expect(existsSync(join(root, 'out', 'content', 'other'))).toBe(false)
      const app = readFileSync(join(root, 'out', 'app_build.vdf'), 'utf8')
      expect(app).toContain('"AppID" "4242"')
      expect(app).toContain('"SetLive" "beta"')
      expect(app).toMatch(/"4243" "depot_4243.vdf"/)
      expect(readFileSync(join(root, 'out', 'depot_4244.vdf'), 'utf8')).toContain('"LocalPath" "windows/*"')
      expect(() => mod.assemble(join(root, 'nothing'), join(root, 'o2'), {})).toThrow()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
