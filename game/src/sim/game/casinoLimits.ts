/**
 * What the casino UI may offer right now (2.7#87): the daily loss limit the
 * player set, how much of it is used, and the largest stake `canBet` accepts.
 * Mirrors the enforcement in sim/life/casino.ts so the UI never offers a bet
 * the sim would refuse.
 */
import type { Life } from '../../core/types'
import { CASINO_FLAGS, maxStakeFor } from '../life/casino'

export interface CasinoLimits {
  /** Daily net-loss limit (0 = none set). */
  lossLimit: number
  /** Net loss so far today (>= 0). */
  lostToday: number
  /** Room left under the limit (Infinity when no limit). */
  remaining: number
  /** Largest stake canBet() would accept. */
  maxStake: number
}

const num = (life: Life, key: string): number => {
  const v = Number(life.flags[key] ?? 0)
  return Number.isFinite(v) ? v : 0
}

export function casinoLimits(life: Pick<Life, 'flags' | 'money'>): CasinoLimits {
  const lossLimit = Math.max(0, num(life as Life, CASINO_FLAGS.lossLimit))
  const lostToday = Math.max(0, num(life as Life, CASINO_FLAGS.lostToday))
  const remaining = lossLimit > 0 ? Math.max(0, lossLimit - lostToday) : Number.POSITIVE_INFINITY
  const maxStake = Math.max(0, Math.min(maxStakeFor(life as Life), Math.floor(life.money), remaining))
  return { lossLimit, lostToday, remaining, maxStake }
}
