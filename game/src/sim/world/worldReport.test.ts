/**
 * World ability report (CI balance artifact, GAP 2.5#125; playtest Tur 2 top-tail check).
 * `WORLD_REPORT=1 [WORLD_REPORT_SEEDS=9,31] [WORLD_REPORT_SEASONS=100] [WORLD_REPORT_OUT=world-report.md] npx vitest run src/sim/world/worldReport.test.ts`
 * Prints (and optionally writes) a markdown table of club-player OVR quantiles every 10 seasons.
 * Without WORLD_REPORT nothing runs; longRun.test.ts holds the hard limits.
 */
import { writeFileSync } from 'node:fs'
import { it } from 'vitest'
import { Rng } from '../../core/rng'
import { generateWorld } from './generate'
import { endOfSeason } from './season'

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}

it.skipIf(!env.WORLD_REPORT)('world ability report', () => {
  const seeds = (env.WORLD_REPORT_SEEDS ?? '9,31').split(',').map(Number)
  const seasons = Number(env.WORLD_REPORT_SEASONS ?? 100)
  const out = ['## Dünya yetenek dağılımı (kulüp oyuncuları, OVR)', '', '| Tohum | Sezon | n | Ort. | p05 | p50 | p95 | p99 | İlk 20 ort. | Max |', '|---|---|---|---|---|---|---|---|---|---|']
  for (const seed of seeds) {
    const world = generateWorld(new Rng(seed), { season: 2026, heroCountryId: 'TR', countryIds: ['TR', 'EN'] })
    const rng = new Rng(seed + 1)
    const row = (season: number) => {
      const o = Object.values(world.players).filter((p) => p.clubId).map((p) => p.ovr).sort((a, b) => a - b)
      const q = (f: number) => o[Math.min(o.length - 1, Math.floor(f * o.length))]
      const mean = o.reduce((a, b) => a + b, 0) / o.length
      const top20 = o.slice(-20).reduce((a, b) => a + b, 0) / 20
      out.push(`| ${seed} | ${season} | ${o.length} | ${mean.toFixed(1)} | ${q(0.05)} | ${q(0.5)} | ${q(0.95)} | ${q(0.99)} | ${top20.toFixed(1)} | ${o[o.length - 1]} |`)
    }
    row(0)
    for (let i = 0; i < seasons; i++) {
      endOfSeason(world, rng, 2026 + i)
      if (i % 10 === 9) row(i + 1)
    }
  }
  const md = out.join('\n') + '\n'
  console.log(md)
  if (env.WORLD_REPORT_OUT) writeFileSync(env.WORLD_REPORT_OUT, md)
}, 3_000_000)
