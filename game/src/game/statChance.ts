/**
 * The one rule for every chance event in moments and training drills (owner, build 9): "every stat maxes at 100,
 * and every 1 point means +1 % chance in all events that use that stat; each chance caps at 80–85 %".
 *
 *   uncontested:  p = S %                         (a stat of 62 → 62 %)
 *   contested:    p = (S − (O − 50)) %            (the opponent's points above 50 come off; 50 vs 50 → 50 %,
 *                                                  70 vs 62 → 58 %: every point on either side is worth 1 %)
 *   input:        + mod percentage points         (timing / approach quality: it gates the attempt and moves the
 *                                                  odds a little — the stat sets them)
 *   bounds:       CHANCE_FLOOR ≤ p ≤ CHANCE_CAP   (5 % … 85 %: nothing is certain, nothing hopeless)
 *
 * Physics (ball speed, flight, keeper reach, player pace) is never a roll: see docs/SYSTEMS-MAP.md "Fizik".
 * The only other randomness is execution error (a shot / pass not going exactly where it was aimed).
 */

/** Highest chance any single event can have (owner: 80–85 %). */
export const CHANCE_CAP = 0.85
/** Lowest chance (a stat of 0 against 100 still has a sliver). */
export const CHANCE_FLOOR = 0.05
/** The opponent's stat is measured from this baseline: an opponent at 50 neither helps nor hurts. */
export const CHANCE_BASE = 50

/**
 * Chance (0..1) of an event decided by `stat` (0–100), optionally against the opponent's `opp` stat, moved by `mod`
 * percentage points of input quality. Linear: +1 point → +1 % until the cap.
 */
export function statChance(stat: number, opp?: number, mod = 0): number {
  const pts = stat - (opp === undefined ? 0 : opp - CHANCE_BASE) + mod
  return Math.min(CHANCE_CAP, Math.max(CHANCE_FLOOR, pts / 100))
}

/** The same chance in whole percent (what the cards show). */
export const statChancePct = (stat: number, opp?: number, mod = 0): number => Math.round(statChance(stat, opp, mod) * 100)
