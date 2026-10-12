/**
 * Build 9 all-kinds checks (owner: every moment kind, four checks — docs/BALANCE.md "Build 9 — every kind"). The
 * kinds are split over four test files so vitest runs them in parallel (game/kindMatrix KIND_CHECK, n = 200,
 * deterministic seeds). Every kind passes every check — no todo list (build 9 all-✅ pass).
 */
import { describe, expect, it } from 'vitest'
import { GOAL_KINDS } from '../sim/match/tier'
import type { FeelKind } from './feelHarness'
import { kindCheck, kindCheckLine } from './kindMatrix'

/** The four parallel groups (kindChecks.a–d.test.ts); together every FEEL_KIND. */
export const KIND_CHECK_GROUPS: readonly (readonly FeelKind[])[] = [
  ['one_on_one', 'penalty', 'freekick', 'edge_of_box', 'cross', 'corner', 'defend', 'gk_save'],
  ['counter_2v1', 'long_ball_control', 'rebound', 'interception', 'hold_up', 'defend_1v1', 'block', 'corner_kick'],
  ['fk_wall', 'dribble', 'header', 'gk_1v1', 'gk_sweep', 'back_post', 'long_shot'],
  ['switch_play', 'recovery_run', 'shoulder_duel', 'timed_run', 'press_trap', 'gk_claim', 'gk_distribution'],
]

export function kindChecksSuite(group: number): void {
  const kinds = KIND_CHECK_GROUPS[group]!
  describe('build 9: every kind on the phone input path, physics + stat chance — sane band, follows its stats, careless input is worse, the opponent matters, a floor', () => {
    for (const k of kinds) {
      it(`${k}: 30–85 % for a starting hero, rising 40 → 90 (graded), sloppy ≥ 20 pts lower, stronger opponent lower, ≥ 30 % at 40`, () => {
        const c = kindCheck(k)
        const line = kindCheckLine(c)
        console.log(line)
        expect(c.band, line).toBe(true)
        expect(c.rising, line).toBe(true)
        expect(c.gap, line).toBe(true)
        expect(c.oppOrder, line).toBe(true)
        // Build 9 floor: played well, a hero with stats of 40 still wins 3 in 10 (against the average side).
        expect(c.floor, line).toBe(true)
        // Goals stay goals: a strike kind is never mostly goals (a penalty is meant to be).
        if (GOAL_KINDS.has(k) && k !== 'penalty') expect(c.start.full, line).toBeLessThan(0.75)
      }, 900_000)
    }
  })
}
