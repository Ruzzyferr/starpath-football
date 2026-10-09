/**
 * The hero's background duels (owner requirement: every attribute must tangibly change the match).
 *
 * Between moments the hero still contests headers, shoulder-to-shoulder battles, foot races, take-ons and
 * pressing runs, and a keeper still claims crosses and distributes. Each minute on the pitch a few of these
 * are rolled from a hash of (seed, minute) — never from the engine stream, so the match itself is untouched —
 * and each won or lost duel nudges the rating. A hero level with the opposition breaks even; the physical
 * duels fade with the hero's condition (stamina, work rate), so tired legs lose them late on.
 *
 * Also the hero's lift on his own team: leadership (more as captain) and work rate (pressing).
 */
import { Rng, clamp, hashString } from '../../core/rng'
import type { AttributeKey, Attributes, Position } from '../../core/types'

export type DuelKind = 'aerial' | 'shoulder' | 'race' | 'takeOn' | 'press' | 'control' | 'switch' | 'claim' | 'distribution'

/** Attribute mix of each duel. */
export const DUEL_MIX: Readonly<Record<DuelKind, Partial<Record<AttributeKey, number>>>> = {
  aerial: { heading: 0.4, jumping: 0.35, strength: 0.15, balance: 0.1 },
  shoulder: { strength: 0.4, balance: 0.4, aggression: 0.2 },
  race: { pace: 0.4, acceleration: 0.4, agility: 0.2 },
  takeOn: { dribbling: 0.5, agility: 0.3, balance: 0.2 },
  press: { workRate: 0.55, anticipation: 0.15, aggression: 0.1, stamina: 0.2 },
  /** Bringing a ball down under pressure. */
  control: { firstTouch: 0.6, composure: 0.2, strength: 0.2 },
  /** A long diagonal / switch of play. */
  switch: { longPassing: 0.6, vision: 0.25, passing: 0.15 },
  claim: { handling: 0.45, jumping: 0.25, gkPositioning: 0.3 },
  distribution: { gkDistribution: 0.7, composure: 0.15, vision: 0.15 },
}

/** Physical duels lose ground as the hero tires. */
const PHYSICAL: ReadonlySet<DuelKind> = new Set<DuelKind>(['aerial', 'shoulder', 'race', 'takeOn', 'press'])

type Rates = Partial<Record<DuelKind, number>>
/** Per-minute chance of each duel by position (in / out of possession). */
const RATES: Readonly<Record<Position, { inP: Rates; outP: Rates }>> = {
  GK: { inP: { distribution: 0.12 }, outP: { claim: 0.06 } },
  CB: { inP: { aerial: 0.04, shoulder: 0.02, switch: 0.03 }, outP: { aerial: 0.09, shoulder: 0.05, race: 0.03, press: 0.02 } },
  LB: { inP: { race: 0.05, takeOn: 0.02, switch: 0.02 }, outP: { aerial: 0.03, shoulder: 0.04, race: 0.05, press: 0.04 } },
  RB: { inP: { race: 0.05, takeOn: 0.02, switch: 0.02 }, outP: { aerial: 0.03, shoulder: 0.04, race: 0.05, press: 0.04 } },
  DM: { inP: { shoulder: 0.03, takeOn: 0.01, switch: 0.05, control: 0.02 }, outP: { aerial: 0.03, shoulder: 0.05, race: 0.02, press: 0.07 } },
  CM: { inP: { shoulder: 0.03, takeOn: 0.02, race: 0.02, switch: 0.05, control: 0.03 }, outP: { aerial: 0.02, shoulder: 0.04, press: 0.07 } },
  AM: { inP: { takeOn: 0.05, shoulder: 0.03, race: 0.02, control: 0.04 }, outP: { press: 0.05, shoulder: 0.02 } },
  LW: { inP: { race: 0.06, takeOn: 0.06, shoulder: 0.02, control: 0.03 }, outP: { press: 0.04, race: 0.02 } },
  RW: { inP: { race: 0.06, takeOn: 0.06, shoulder: 0.02, control: 0.03 }, outP: { press: 0.04, race: 0.02 } },
  ST: { inP: { aerial: 0.06, shoulder: 0.06, race: 0.05, takeOn: 0.02, control: 0.05 }, outP: { press: 0.04, aerial: 0.02 } },
}

/** Rating for a won (+) or lost (−) duel. */
export const DUEL_DELTA = 0.025
/** Condition cost of a physical duel's skill: an exhausted hero (condition 0) is this many points worse. */
export const DUEL_FATIGUE_PTS = 40

export function duelSkill(kind: DuelKind, a: Attributes): number {
  let s = 0
  let w = 0
  for (const [k, weight] of Object.entries(DUEL_MIX[kind]) as [AttributeKey, number][]) {
    s += (a[k] ?? 50) * weight
    w += weight
  }
  return w > 0 ? s / w : 50
}

/** Win chance of a duel for the hero against an opponent level `opp`, with the hero's condition (0..1). */
export function duelWinChance(kind: DuelKind, a: Attributes, opp: number, condition: number): number {
  const s = duelSkill(kind, a) - (PHYSICAL.has(kind) ? (1 - clamp(condition, 0, 1)) * DUEL_FATIGUE_PTS : 0)
  return clamp(0.5 + (s - opp) / 55, 0.1, 0.9)
}

export interface DuelMinute {
  won: number
  lost: number
  delta: number
}

/**
 * One background minute of duels. `key` identifies the minute (seed, period, clock, stoppage); `condition`
 * is 1 − fatigue (the opposition is assumed as tired as a 65-stamina player would be by then).
 */
export function heroDuelMinute(key: string, pos: Position, a: Attributes, inPossession: boolean, opp: number, condition: number, oppCondition: number): DuelMinute {
  const rng = new Rng(hashString(`duel:${key}`))
  const rates = inPossession ? RATES[pos].inP : RATES[pos].outP
  const out: DuelMinute = { won: 0, lost: 0, delta: 0 }
  for (const kind of Object.keys(rates) as DuelKind[]) {
    if (!rng.chance(rates[kind] ?? 0)) continue
    // The opponent tires as well: compare like with like.
    const oppLevel = opp - (PHYSICAL.has(kind) ? (1 - clamp(oppCondition, 0, 1)) * DUEL_FATIGUE_PTS : 0)
    if (rng.chance(duelWinChance(kind, a, oppLevel, condition))) {
      out.won++
      out.delta += DUEL_DELTA
    } else {
      out.lost++
      out.delta -= DUEL_DELTA
    }
  }
  return out
}

/** Extra fatigue rate from work rate: the runner covers more ground (0.85× at 0 … 1.15× at 100). */
export const workRateFatigueMult = (workRate: number | undefined): number => 0.85 + clamp((workRate ?? 50) / 100, 0, 1) * 0.3

/**
 * Lift the hero gives his own team's units (multiplier around 1): leadership (×1.5 as captain) organises and
 * drives the team-mates; work rate is the pressing and the recovery runs. A 65 hero is neutral.
 */
export function heroTeamLift(a: Attributes, captain: boolean, keeper: boolean): number {
  const lead = ((a.leadership ?? 65) - 65) / 100 * 0.1 * (captain ? 1.5 : 1)
  const work = keeper ? 0 : ((a.workRate ?? 65) - 65) / 100 * 0.05
  return clamp(1 + lead + work, 0.9, 1.1)
}

/** In-match (moment) lift on the hero's AI team-mates from his leadership: −1..1 scale, ×1.5 as captain. */
export function leadershipBoost(leadership: number | undefined, captain: boolean): number {
  return clamp(((leadership ?? 65) - 65) / 35, -1, 1) * (captain ? 1.5 : 1)
}
