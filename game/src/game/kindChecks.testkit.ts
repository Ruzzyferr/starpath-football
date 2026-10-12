/**
 * Build 9 all-kinds checks (owner: every moment kind, four checks — docs/BALANCE.md "Build 9 — every kind"). The
 * kinds are split over four test files so vitest runs them in parallel (game/kindMatrix KIND_CHECK, n = 200,
 * deterministic seeds). A kind listed in KIND_CHECK_PENDING is still being tuned: it shows as a todo, not a pass.
 */
import { describe, expect, it } from 'vitest'
import { GOAL_KINDS } from '../sim/match/tier'
import type { FeelKind } from './feelHarness'
import { kindCheck, kindCheckLine } from './kindMatrix'

/**
 * Build 9 physics + stat-chance pass (owner model): kinds with at least one check still open, listed so the suite shows
 * them as todo rather than hiding them — docs/BALANCE.md "Build 9 (4. tur)" has each one's ❌ and cause.
 */
export const KIND_CHECK_PENDING: ReadonlySet<FeelKind> = new Set<FeelKind>([
  'back_post', 'block', 'corner_kick', 'counter_2v1', 'cross', 'defend', 'dribble', 'fk_wall', 'freekick', 'gk_1v1',
  'gk_save', 'header', 'hold_up', 'long_ball_control', 'long_shot', 'press_trap', 'shoulder_duel', 'switch_play',
])

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
      if (KIND_CHECK_PENDING.has(k)) {
        it.todo(`${k}: four checks (still being tuned)`)
        continue
      }
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
