/**
 * Offside (Law 11) for the interactive highlight runtime. Pure functions so the
 * rule can be unit tested without the runtime.
 *
 * A player is in an offside position when, at the moment a team-mate plays the
 * ball, any part of them is:
 *  - in the opponents' half (the halfway line itself belongs to their own half), and
 *  - nearer to the opponents' goal line than BOTH the ball and the second-last
 *    opponent (the goalkeeper counts as an opponent).
 * Level with the ball or the second-last opponent is onside. Positions are
 * judged at the moment of the pass; the offence is only called when that player
 * becomes involved (touches the ball) before anyone else does. No offence from
 * a corner kick (also goal kicks / throw-ins, which the runtime does not model).
 *
 * Agents are points here, so "any part of the body" is approximated by the
 * centre; {@link OFFSIDE_TOLERANCE} gives the attacker the benefit of the doubt
 * on razor-thin calls, as a real assistant referee would ("level" band).
 */
import { PITCH_LENGTH } from '../sim/match/types'
import type { Agent, Team } from './model'

/** Distance (m) within which an attacker counts as level (= onside). */
export const OFFSIDE_TOLERANCE = 0.1

/** +1 when attacking the east goal (x = PITCH_LENGTH), −1 for the west goal. */
export type AttackDir = 1 | -1

/** Depth toward the attacked goal line: 0 at the own goal line, PITCH_LENGTH at the attacked one. */
const depth = (x: number, dir: AttackDir): number => (dir > 0 ? x : PITCH_LENGTH - x)

/**
 * Second-last opponent depth (keeper included). With a single opponent on the
 * pitch that opponent is the line; with none, offside cannot be judged.
 */
export function secondLastOpponentDepth(opponentXs: readonly number[], dir: AttackDir): number | null {
  if (opponentXs.length === 0) return null
  const d = opponentXs.map((x) => depth(x, dir)).sort((a, b) => b - a)
  return d.length >= 2 ? d[1]! : d[0]!
}

/**
 * True if an attacker at `attackerX` is in an offside position when the ball
 * is played from `ballX`, given all opponents' x positions (keeper included).
 * @param dir attacking direction of the attacker's team (+1 = toward x = PITCH_LENGTH)
 */
export function isOffsidePosition(attackerX: number, ballX: number, opponentXs: readonly number[], dir: AttackDir): boolean {
  const a = depth(attackerX, dir)
  // Own half (halfway line included) is always onside.
  if (a <= PITCH_LENGTH / 2) return false
  // Level with or behind the ball.
  if (a <= depth(ballX, dir) + OFFSIDE_TOLERANCE) return false
  const second = secondLastOpponentDepth(opponentXs, dir)
  if (second === null) return false
  // Level with or behind the second-last opponent.
  return a > second + OFFSIDE_TOLERANCE
}

/**
 * Ids of the kicker's team-mates standing in an offside position at the moment
 * `kicker` plays the ball (kicker excluded).
 */
export function offsideSnapshot(agents: readonly Agent[], ballX: number, kicker: Pick<Agent, 'id' | 'team'>): Set<string> {
  const team: Team = kicker.team
  const dir: AttackDir = team === 'hero' ? 1 : -1
  const opponents = agents.filter((a) => a.team !== team).map((a) => a.pos.x)
  const out = new Set<string>()
  for (const a of agents) {
    if (a.team !== team || a.id === kicker.id) continue
    if (isOffsidePosition(a.pos.x, ballX, opponents, dir)) out.add(a.id)
  }
  return out
}
