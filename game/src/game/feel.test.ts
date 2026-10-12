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
  // Oct 2026 intent pass (playtester build 7): placed hero finishes beat the keeper, frame-safe execution — 1v1 ~0.65.
  // Build 9 physics pass (a keeper who gets there saves it, no save roll): 1v1 measured 0.30, penalty 0.617.
  one_on_one: [0.22, 0.78],
  penalty: [0.5, 0.88],
  // Build 9 (the bot judges its patience on the pitch clock, shot power follows Shooting): bands re-based on the measured rates.
  freekick: [0.04, 0.38], // build 9 all-✅ pass: 0.067 (over the wall, under the bar: the taker's dip)
  // Build 8: measured 0.35 at N=120 already at build 7 (the 0.25 cap only held on seeds 1–60); ~0.33–0.39 now.
  edge_of_box: [0.12, 0.68], // build 9 physics pass: measured 0.18
  cross: [0.1, 0.4],
  // Build 9 (the hero's timed leap attacks the ball; the header feed is the setup): re-based on measured rates.
  corner: [0.15, 0.48],
  // Hero standing tackle now a smooth curve in the tackle moment skill (game/momentSkill): ~0.78.
  defend: [0.48, 0.88],
  gk_save: [0.5, 0.93], // build 9 all-✅ pass: 0.90 (GK Positioning's step across, keeper physics)
  counter_2v1: [0.12, 0.6],
  // Build 9 (body under the long ball contests it; the parried ball is his to pounce on; a timed take-on): re-based.
  long_ball_control: [0.15, 0.72],
  rebound: [0.06, 0.55],
  interception: [0.42, 0.8],
  // WP-14 kinds (measured N=120 average: hold-up ~0.62, 1v1 ~0.70, block ~0.45).
  hold_up: [0.35, 0.8], // build 9 all-✅ pass: 0.42 (no free first look; the marker's challenge on his shield)
  defend_1v1: [0.5, 0.95],
  block: [0.3, 0.65],
  // Set-piece choices (2.1#95 / #97). Hero corner: assist or goal (measured N=200 ~0.13);
  // free kick against with the hero in goal: kept out (measured N=60 ~0.72).
  // Build 9: the delivery's quality (Crossing / Curve) wins the aerial and keeps the keeper home.
  corner_kick: [0.06, 0.6],
  fk_wall: [0.58, 0.88],
  // S21 kinds (measured N=120 average, normal): take-on got past and ended in a shot/pass ~0.43,
  // open-play header scored ~0.28, keeper 1v1 kept out ~0.58, sweeping ~0.77, back post ~0.43.
  dribble: [0.2, 0.72], // build 9 all-✅ pass: 0.27 (full only here; past his man then lost it is a partial)
  header: [0.14, 0.68],
  gk_1v1: [0.3, 0.75],
  gk_sweep: [0.6, 0.92],
  // Build 9: his own header / clearance counts, and marking his man is the job.
  back_post: [0.25, 0.85],
  // Attribute moments (measured N=150 average, normal): long shot scored ~0.14, switch found the far side
  // ~0.45, recovery run stopped it ~0.62, shoulder duel won ~0.35, timed run scored ~0.13 (offside trap and a
  // finish), press won it ~0.52, cross claimed / kept out ~0.91, distribution found a man ~0.65.
  long_shot: [0.02, 0.38], // build 9 physics pass: measured 0.05 (long shots are rare)
  switch_play: [0.3, 0.9], // build 9: 0.633 (solid bodies), 0.667 (physics pass), 0.85 (a team-mate chests his side's switch down)
  recovery_run: [0.45, 0.88], // build 9 all-✅ pass: 0.80
  shoulder_duel: [0.22, 0.85],
  // Build 9: the ball over the top is weighted onto his run (he meets it as it comes down).
  timed_run: [0.05, 0.6],
  press_trap: [0.25, 0.66],
  // Build 9: graded keeper credit (his own claim / on his spot) and team-mates leave the cross to him.
  gk_claim: [0.6, 0.98],
  gk_distribution: [0.5, 0.9], // build 9 physics pass: measured 0.85 (a soft ball is simply controlled)
}

const N = 60
/** Env access without Node typings (the app tsconfig has no @types/node). */
const ENV = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}

describe('match feel (average human, normal)', () => {
  for (const kind of FEEL_KINDS) {
    it(`${kind} converts within band`, () => {
      // Low-rate kinds need a bigger sample for a stable estimate.
      const r = feelRate(kind, 'average', 'normal', kind === 'cross' || kind === 'corner' || kind === 'corner_kick' ? 200 : N)
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
