/**
 * Long-range sanity (playtester build 9: a mis-tapped SHOOT from the halfway line went in). Report:
 * LONG_REPORT=1 npx vitest run src/game/longShot.test.ts --silent=false
 */
import { describe, expect, it } from 'vitest'
import { LONG_BANDS, longShotRate, naturalTapTrial } from './longShotHarness'
import type { HighlightKind } from '../sim/match/types'

const ENV = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
const pct = (x: number) => Math.round(x * 1000) / 10

describe.runIf(ENV.LONG_REPORT === '1')('long-range report', () => {
  it('bands × input × hero × keeper', () => {
    const n = Number(ENV.LONG_N ?? 200)
    for (const input of ['tap', 'aimed'] as const) {
      for (const hero of [40, 65, 90]) {
        for (const gk of [40, 65, 90]) {
          console.log(`LONG ${input} hero ${hero} gk ${gk} | ${LONG_BANDS.map((d) => `${d}m ${pct(longShotRate(d, input, hero, gk, n))}`).join(' | ')}`)
        }
      }
    }
    expect(true).toBe(true)
  }, 3_600_000)

  it('natural: SHOOT tapped the instant he has it', () => {
    const kinds: HighlightKind[] = ['build_up', 'counter', 'switch_play', 'hold_up', 'long_ball_control', 'counter_2v1', 'dribble', 'edge_of_box', 'long_shot', 'one_on_one', 'shoulder_duel', 'cross']
    for (const k of kinds) {
      const bands = new Map<string, { n: number; g: number }>()
      for (let s = 1; s <= Number(ENV.LONG_N ?? 200); s++) {
        const r = naturalTapTrial(k, s)
        if (r.d < 0) continue
        const b = r.d < 16 ? '10-16' : r.d < 25 ? '16-25' : r.d < 35 ? '25-35' : r.d < 45 ? '35-45' : '45+'
        const c = bands.get(b) ?? { n: 0, g: 0 }
        c.n++
        if (r.goal) c.g++
        bands.set(b, c)
      }
      console.log(`NAT ${k} | ${[...bands].map(([b, c]) => `${b}: ${c.g}/${c.n}`).join(' | ')}`)
    }
    expect(true).toBe(true)
  }, 3_600_000)
})
