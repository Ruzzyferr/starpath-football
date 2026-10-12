/**
 * Long-range sanity (playtester build 9: a mis-tapped SHOOT from the halfway line went in). Report:
 * LONG_REPORT=1 npx vitest run src/game/longShot.test.ts --silent=false
 */
import { describe, expect, it } from 'vitest'
import { LONG_BANDS, longShotRate, naturalTapTrial } from './longShotHarness'
import type { HighlightKind } from '../sim/match/types'

const ENV = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
const pct = (x: number) => Math.round(x * 1000) / 10

describe('long-range sanity (pinned; physics + direction error only)', () => {
  const N = 100
  it('a tap on SHOOT from 45–50 m practically never scores (≤ 1 % vs a 65 keeper, ≤ 2 % vs a 40)', () => {
    for (const d of [45, 50]) {
      expect(longShotRate(d, 'tap', 65, 65, N), `${d} m vs 65`).toBeLessThanOrEqual(0.01)
      expect(longShotRate(d, 'tap', 90, 40, N), `${d} m 90 vs 40`).toBeLessThanOrEqual(0.02)
    }
  }, 600_000)

  it('even a 90 long shooter: an aimed strike from 40 m stays rare (≤ 8 %)', () => {
    expect(longShotRate(40, 'aimed', 90, 65, N)).toBeLessThanOrEqual(0.08)
    expect(longShotRate(40, 'aimed', 90, 40, N)).toBeLessThanOrEqual(0.08)
  }, 600_000)

  it('13 m and 20 m: rising with the shooter, falling with the keeper (2-point tolerance)', () => {
    for (const d of [13, 20]) {
      const byHero = [40, 65, 90].map((h) => longShotRate(d, 'aimed', h, 65, N))
      const byGk = [40, 65, 90].map((g) => longShotRate(d, 'aimed', 65, g, N))
      const line = `${d} m hero ${byHero} gk ${byGk}`
      expect(byHero[1]!, line).toBeGreaterThanOrEqual(byHero[0]! - 0.02)
      expect(byHero[2]!, line).toBeGreaterThanOrEqual(byHero[1]! - 0.02)
      expect(byHero[2]! - byHero[0]!, line).toBeGreaterThanOrEqual(0.08)
      expect(byGk[1]!, line).toBeLessThanOrEqual(byGk[0]! + 0.02)
      expect(byGk[2]!, line).toBeLessThanOrEqual(byGk[1]! + 0.02)
      expect(byGk[0]! - byGk[2]!, line).toBeGreaterThanOrEqual(0.08)
    }
    expect(longShotRate(20, 'aimed', 65, 65, N)).toBeLessThan(longShotRate(13, 'aimed', 65, 65, N))
  }, 900_000)

  it('in every moment he starts on the ball, SHOOT tapped the instant he has it from 35 m+ scores ≤ 2 %', () => {
    const kinds: HighlightKind[] = ['build_up', 'counter', 'switch_play', 'hold_up', 'long_ball_control', 'counter_2v1', 'dribble', 'edge_of_box', 'long_shot', 'shoulder_duel', 'cross']
    let n = 0
    let g = 0
    for (const k of kinds) {
      for (let s = 1; s <= 60; s++) {
        const r = naturalTapTrial(k, s)
        if (r.d < 35) continue
        n++
        if (r.goal) g++
      }
    }
    expect(n).toBeGreaterThan(200)
    expect(g / n, `${g}/${n}`).toBeLessThanOrEqual(0.02)
  }, 900_000)
})

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
