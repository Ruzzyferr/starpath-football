/**
 * Match-feel bands: an "average" human (noisy bot) on normal difficulty must
 * convert at sensible real-football-like rates (see docs/BALANCE.md).
 * Full matrix report: FEEL_REPORT=1 npx vitest run src/game/feel.test.ts
 */
import { describe, expect, it } from 'vitest'
import type { Difficulty } from '../core/types'
import { BOT_LEVELS } from './humanBot'
import { FEEL_KINDS, feelRate, playFeel, type FeelKind } from './feelHarness'

/**
 * Normal difficulty, average bot: [min, max] success rate. Targets (docs/BALANCE.md):
 * defend ~55–65%, cross 15–25%, corner 20–30%, 1v1 ~40%. Bands allow for N=60 sampling noise.
 */
const BANDS: Record<FeelKind, [number, number]> = {
  one_on_one: [0.25, 0.55],
  penalty: [0.62, 0.88],
  freekick: [0.06, 0.28],
  edge_of_box: [0.05, 0.25],
  cross: [0.1, 0.3],
  corner: [0.15, 0.38],
  defend: [0.48, 0.75],
  gk_save: [0.5, 0.85],
  counter_2v1: [0.12, 0.45],
  long_ball_control: [0.06, 0.4],
  rebound: [0.06, 0.4],
  interception: [0.42, 0.8],
}

const N = 60
/** Env access without Node typings (the app tsconfig has no @types/node). */
const ENV = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}

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

  it('defending is a skill: an expert defender clearly beats a novice (defend + interception)', () => {
    const n = 100
    const rate = (lv: 'novice' | 'expert') => feelRate('defend', lv, 'normal', n) + feelRate('interception', lv, 'normal', n)
    expect(rate('expert') - rate('novice')).toBeGreaterThan(0.12)
  }, 180_000)

  it('is deterministic', () => {
    expect(playFeel('edge_of_box', 3, 'average', 'normal')).toBe(playFeel('edge_of_box', 3, 'average', 'normal'))
  })
})

describe.runIf(ENV.FEEL_REPORT === '1')('match feel report', () => {
  it('prints kind × difficulty × bot matrix', () => {
    const n = Number(ENV.FEEL_N ?? 200)
    const diffs = (ENV.FEEL_DIFFS ?? 'easy,normal,hard,legend').split(',') as Difficulty[]
    const kinds = ENV.FEEL_ONLY ? (ENV.FEEL_ONLY.split(',') as FeelKind[]) : FEEL_KINDS
    const lines: string[] = [`| Tür | Zorluk | ${BOT_LEVELS.join(' | ')} |`, `|---|---|${BOT_LEVELS.map(() => '---').join('|')}|`]
    for (const kind of kinds) {
      for (const d of diffs) {
        const cells = BOT_LEVELS.map((lv) => `${Math.round(feelRate(kind, lv, d, n) * 100)}%`)
        lines.push(`| ${kind} | ${d} | ${cells.join(' | ')} |`)
      }
    }
    // eslint-disable-next-line no-console
    console.log(`\nN=${n}\n${lines.join('\n')}`)
  }, 3_600_000)
})
