/**
 * Match-feel bands: an "average" human (noisy bot) on normal difficulty must
 * convert at sensible real-football-like rates (see docs/BALANCE.md).
 * Full matrix report: FEEL_REPORT=1 npx vitest run src/game/feel.test.ts
 */
import { describe, expect, it } from 'vitest'
import type { Difficulty } from '../core/types'
import { BOT_LEVELS } from './humanBot'
import { FEEL_KINDS, feelRate, playFeel, type FeelKind } from './feelHarness'

/** Normal difficulty, average bot: [min, max] success rate. */
const BANDS: Record<FeelKind, [number, number]> = {
  one_on_one: [0.28, 0.55],
  penalty: [0.62, 0.88],
  freekick: [0.08, 0.3],
  edge_of_box: [0.05, 0.22],
  cross: [0.08, 0.4],
  corner: [0.05, 0.3],
  defend: [0.4, 0.8],
  gk_save: [0.3, 0.7],
}

const N = 60

describe('match feel (average human, normal)', () => {
  for (const kind of FEEL_KINDS) {
    it(`${kind} converts within band`, () => {
      const r = feelRate(kind, 'average', 'normal', N)
      expect(r).toBeGreaterThanOrEqual(BANDS[kind][0])
      expect(r).toBeLessThanOrEqual(BANDS[kind][1])
    }, 60_000)
  }

  it('difficulty spreads finishing: easy > normal > legend (1v1 + penalty)', () => {
    const score = (d: Difficulty) => feelRate('one_on_one', 'average', d, N) + feelRate('penalty', 'average', d, N)
    const e = score('easy')
    const n = score('normal')
    const l = score('legend')
    expect(e).toBeGreaterThan(n)
    expect(n).toBeGreaterThan(l)
  }, 120_000)

  it('is deterministic', () => {
    expect(playFeel('edge_of_box', 3, 'average', 'normal')).toBe(playFeel('edge_of_box', 3, 'average', 'normal'))
  })
})

describe.runIf(process.env.FEEL_REPORT === '1')('match feel report', () => {
  it('prints kind × difficulty × bot matrix', () => {
    const n = Number(process.env.FEEL_N ?? 200)
    const diffs: Difficulty[] = ['easy', 'normal', 'hard', 'legend']
    const lines: string[] = [`| Tür | Zorluk | ${BOT_LEVELS.join(' | ')} |`, `|---|---|${BOT_LEVELS.map(() => '---').join('|')}|`]
    for (const kind of FEEL_KINDS) {
      for (const d of diffs) {
        const cells = BOT_LEVELS.map((lv) => `${Math.round(feelRate(kind, lv, d, n) * 100)}%`)
        lines.push(`| ${kind} | ${d} | ${cells.join(' | ')} |`)
      }
    }
    // eslint-disable-next-line no-console
    console.log(`\nN=${n}\n${lines.join('\n')}`)
  }, 3_600_000)
})
