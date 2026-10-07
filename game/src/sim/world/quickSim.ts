/**
 * Fast statistical match simulation for AI-vs-AI fixtures.
 *
 * Model: independent Poisson goals per side. Each side's expected goals is
 *   base × venue × exp(K × (attack − opponentDefense)) × style × morale
 * where attack/defense come from the best XI's effective ratings. With equal
 * teams this gives ≈1.45 vs ≈1.17 goals (≈2.6 per game, ≈25% draws).
 * Knockout ties go to extra time (⅓ of the 90-minute rate) then penalties.
 */
import type { Club, MatchResultSummary, Position, TacticStyle, World } from '../../core/types'
import './worldTypes'
import { clamp } from '../../core/rng'
import type { Rng } from '../../core/rng'
import type { Lineup } from './formations'
import { rateLineup, selectLineup } from './queries'
import type { TeamRating } from './queries'

/** Tunable constants of the goal model. */
export const QUICKSIM_TUNING = {
  baseGoals: 1.3,
  homeAdvantage: 1.12,
  awayFactor: 0.9,
  /** Goal-rate multiplier per OVR point of attack-vs-defense difference (exponential). */
  strengthK: 0.042,
  extraTimeFraction: 1 / 3,
  ownGoalChance: 0.04,
  penaltyChance: 0.08,
  assistChance: 0.72,
  shootoutConversion: 0.76,
} as const

const STYLE_ATTACK: Readonly<Record<TacticStyle, number>> = {
  possession: 1.02, counter: 1, direct: 1.04, pressing: 1.05, defensive: 0.88, balanced: 1,
}
const STYLE_DEFENSE: Readonly<Record<TacticStyle, number>> = {
  possession: 1.03, counter: 1.02, direct: 0.98, pressing: 0.97, defensive: 1.12, balanced: 1,
}

const SCORER_WEIGHT: Readonly<Record<Position, number>> = {
  GK: 0.01, CB: 0.6, LB: 0.5, RB: 0.5, DM: 0.7, CM: 1.6, AM: 3, LW: 3, RW: 3, ST: 5,
}
const ASSIST_WEIGHT: Readonly<Record<Position, number>> = {
  GK: 0.1, CB: 0.5, LB: 1.5, RB: 1.5, DM: 1.2, CM: 2.5, AM: 3, LW: 3, RW: 3, ST: 1.5,
}
const OWN_GOAL_WEIGHT: Readonly<Record<Position, number>> = {
  GK: 0.5, CB: 4, LB: 2, RB: 2, DM: 1.5, CM: 0.6, AM: 0.2, LW: 0.2, RW: 0.2, ST: 0.2,
}
const DEFENSIVE_SLOTS: ReadonlySet<Position> = new Set<Position>(['GK', 'CB', 'LB', 'RB'])

export interface QuickSimOptions {
  /** A winner is required (extra time + penalties when level). */
  knockout?: boolean
  /** No home advantage (finals). */
  neutral?: boolean
  homeExclude?: ReadonlySet<string>
  awayExclude?: ReadonlySet<string>
  /**
   * Second leg of a two-legged tie: goals already scored in the first leg by
   * this fixture's home and away team. Extra time + penalties are played when
   * the aggregate is level after 90' (no away-goals rule).
   */
  aggregate?: { home: number; away: number }
}

export interface QuickSimDetail {
  result: MatchResultSummary
  homeLineup: Lineup
  awayLineup: Lineup
  /** `assists[i]` is the assisting player for `result.scorers[i]` (null if none). */
  assists: (string | null)[]
  /** Match rating (0..10) of every starter. */
  ratings: Record<string, number>
  extraTime: boolean
  expected: { home: number; away: number }
}

/** Expected 90-minute goals for both sides. */
export function expectedGoals(
  home: TeamRating,
  away: TeamRating,
  homeStyle: TacticStyle,
  awayStyle: TacticStyle,
  neutral = false,
): { home: number; away: number } {
  const t = QUICKSIM_TUNING
  const morale = (m: number) => 1 + clamp((m - 60) / 400, -0.12, 0.1)
  const counterBonus = (style: TacticStyle, opp: TacticStyle) => (style === 'counter' && (opp === 'possession' || opp === 'pressing') ? 1.06 : 1)
  const rate = (att: TeamRating, def: TeamRating, attStyle: TacticStyle, defStyle: TacticStyle, venue: number) =>
    t.baseGoals * venue * Math.exp(t.strengthK * (att.attack - def.defense)) *
    (STYLE_ATTACK[attStyle] / STYLE_DEFENSE[defStyle]) * counterBonus(attStyle, defStyle) * morale(att.morale)
  return {
    home: clamp(rate(home, away, homeStyle, awayStyle, neutral ? 1 : t.homeAdvantage), 0.1, 6),
    away: clamp(rate(away, home, awayStyle, homeStyle, neutral ? 1 : t.awayFactor), 0.1, 6),
  }
}

function pickByWeight(rng: Rng, lineup: Lineup, weights: Readonly<Record<Position, number>>, exclude?: string): string | null {
  const idx: number[] = []
  for (let i = 0; i < lineup.playerIds.length; i++) if (lineup.playerIds[i] !== exclude) idx.push(i)
  if (!idx.length) return null
  const i = rng.weighted(idx, (k) => weights[lineup.slots[k]] * Math.pow(Math.max(lineup.ratings[k], 20) / 70, 3))
  return lineup.playerIds[i]
}

function penaltyTaker(lineup: Lineup): string | null {
  let best = -1
  let id: string | null = null
  lineup.slots.forEach((slot, i) => {
    const v = lineup.ratings[i] * (SCORER_WEIGHT[slot] >= 3 ? 1.1 : slot === 'CM' ? 1 : 0.7)
    if (v > best) {
      best = v
      id = lineup.playerIds[i]
    }
  })
  return id
}

/**
 * Penalty shootout: 5 kicks each with early finish, then sudden death.
 * `homeSkill`/`awaySkill` shift conversion slightly (±0.05 for ±10 OVR).
 */
export function penaltyShootout(rng: Rng, homeSkill = 70, awaySkill = 70): { home: number; away: number } {
  const p = (s: number) => clamp(QUICKSIM_TUNING.shootoutConversion + (s - 70) * 0.005, 0.6, 0.9)
  const ph = p(homeSkill)
  const pa = p(awaySkill)
  let h = 0
  let a = 0
  for (let k = 0; k < 5; k++) {
    const left = 4 - k // kicks each side still has after this round
    if (rng.chance(ph)) h++
    if (h > a + left + 1 || a > h + left) break // away still has this round's kick
    if (rng.chance(pa)) a++
    if (h > a + left || a > h + left) break
  }
  while (h === a) {
    if (rng.chance(ph)) h++
    if (rng.chance(pa)) a++
  }
  return { home: h, away: a }
}

interface GoalDraft {
  minute: number
  team: 'home' | 'away'
  playerId: string
  ownGoal?: boolean
  penalty?: boolean
  assistId: string | null
}

function draftGoal(rng: Rng, team: 'home' | 'away', minute: number, scoring: Lineup, conceding: Lineup): GoalDraft {
  const t = QUICKSIM_TUNING
  if (rng.chance(t.ownGoalChance)) {
    const og = pickByWeight(rng, conceding, OWN_GOAL_WEIGHT)
    if (og) return { minute, team, playerId: og, ownGoal: true, assistId: null }
  }
  if (rng.chance(t.penaltyChance)) {
    const taker = penaltyTaker(scoring)
    if (taker) return { minute, team, playerId: taker, penalty: true, assistId: null }
  }
  const scorer = pickByWeight(rng, scoring, SCORER_WEIGHT) ?? ''
  const assistId = rng.chance(t.assistChance) ? pickByWeight(rng, scoring, ASSIST_WEIGHT, scorer) : null
  return { minute, team, playerId: scorer, assistId }
}

function rateStarters(
  rng: Rng, lineup: Lineup, goalsFor: number, goalsAgainst: number, goals: readonly GoalDraft[], team: 'home' | 'away', out: Record<string, number>,
): void {
  const result = goalsFor > goalsAgainst ? 0.35 : goalsFor < goalsAgainst ? -0.35 : 0
  lineup.playerIds.forEach((id, i) => {
    const slot = lineup.slots[i]
    let r = 6.4 + result + rng.normal(0, 0.45) + (lineup.ratings[i] - 65) * 0.01
    for (const g of goals) {
      if (g.team !== team) continue
      if (g.playerId === id && !g.ownGoal) r += 1
      if (g.assistId === id) r += 0.6
    }
    for (const g of goals) if (g.ownGoal && g.playerId === id && g.team !== team) r -= 0.8
    if (DEFENSIVE_SLOTS.has(slot)) r += goalsAgainst === 0 ? 0.6 : -0.15 * Math.max(0, goalsAgainst - 1)
    out[id] = Math.round(clamp(r, 3, 10) * 10) / 10
  })
}

/**
 * Simulate a match and return the summary plus lineups, assists and player
 * ratings (used to update NPC season stats).
 */
export function quickSimDetailed(rng: Rng, home: Club, away: Club, world: World, opts: QuickSimOptions = {}): QuickSimDetail {
  const homeLineup = selectLineup(world, home.id, home.formation, opts.homeExclude)
  const awayLineup = selectLineup(world, away.id, away.formation, opts.awayExclude)
  return quickSimLineups(rng, world, { lineup: homeLineup, style: home.style }, { lineup: awayLineup, style: away.style }, opts)
}

/** A side for {@link quickSimLineups}: a ready lineup and its tactical style. */
export interface SimSide {
  lineup: Lineup
  style: TacticStyle
}

/**
 * Core of the goal model on two ready lineups (clubs or national teams).
 * `world` is only read for player morale (unknown ids count as neutral).
 */
export function quickSimLineups(rng: Rng, world: World, homeSide: SimSide, awaySide: SimSide, opts: QuickSimOptions = {}): QuickSimDetail {
  const homeLineup = homeSide.lineup
  const awayLineup = awaySide.lineup
  const hr = rateLineup(world, homeLineup)
  const ar = rateLineup(world, awayLineup)
  const xg = expectedGoals(hr, ar, homeSide.style, awaySide.style, opts.neutral)

  let h = rng.poisson(xg.home)
  let a = rng.poisson(xg.away)
  const goals: GoalDraft[] = []
  for (let i = 0; i < h; i++) goals.push(draftGoal(rng, 'home', rng.int(1, 90), homeLineup, awayLineup))
  for (let i = 0; i < a; i++) goals.push(draftGoal(rng, 'away', rng.int(1, 90), awayLineup, homeLineup))

  let extraTime = false
  let penalties: { home: number; away: number } | undefined
  const aggH = opts.aggregate?.home ?? 0
  const aggA = opts.aggregate?.away ?? 0
  if ((opts.knockout || opts.aggregate) && h + aggH === a + aggA) {
    extraTime = true
    const eh = rng.poisson(xg.home * QUICKSIM_TUNING.extraTimeFraction)
    const ea = rng.poisson(xg.away * QUICKSIM_TUNING.extraTimeFraction)
    for (let i = 0; i < eh; i++) goals.push(draftGoal(rng, 'home', rng.int(91, 120), homeLineup, awayLineup))
    for (let i = 0; i < ea; i++) goals.push(draftGoal(rng, 'away', rng.int(91, 120), awayLineup, homeLineup))
    h += eh
    a += ea
    if (h + aggH === a + aggA) penalties = penaltyShootout(rng, hr.overall, ar.overall)
  }
  goals.sort((x, y) => x.minute - y.minute)

  const ratings: Record<string, number> = {}
  rateStarters(rng, homeLineup, h, a, goals, 'home', ratings)
  rateStarters(rng, awayLineup, a, h, goals, 'away', ratings)

  const result: MatchResultSummary = {
    home: h,
    away: a,
    scorers: goals.map((g) => {
      const s: MatchResultSummary['scorers'][number] = { minute: g.minute, playerId: g.playerId, team: g.team }
      if (g.ownGoal) s.ownGoal = true
      if (g.penalty) s.penalty = true
      return s
    }),
  }
  if (penalties) result.penalties = penalties
  if (extraTime && opts.aggregate) result.extraTime = true
  if (goals.some((g) => g.assistId)) result.assists = goals.map((g) => g.assistId)
  const motm = manOfTheMatch(ratings, homeLineup, awayLineup, h, a, penalties)
  if (motm) result.motmId = motm

  return { result, homeLineup, awayLineup, assists: goals.map((g) => g.assistId), ratings, extraTime, expected: xg }
}

function manOfTheMatch(
  ratings: Record<string, number>, homeL: Lineup, awayL: Lineup, h: number, a: number, pens?: { home: number; away: number },
): string | undefined {
  const homeWon = h > a || (h === a && !!pens && pens.home > pens.away)
  const awayWon = a > h || (h === a && !!pens && pens.away > pens.home)
  let best: string | undefined
  let bestV = -Infinity
  const consider = (ids: readonly string[], bonus: number) => {
    for (const id of ids) {
      const v = (ratings[id] ?? 0) + bonus
      if (v > bestV) {
        bestV = v
        best = id
      }
    }
  }
  consider(homeL.playerIds, homeWon ? 0.3 : 0)
  consider(awayL.playerIds, awayWon ? 0.3 : 0)
  return best
}

/** Simulate an AI match and return only the result summary. */
export function quickSimMatch(rng: Rng, home: Club, away: Club, world: World, opts: QuickSimOptions = {}): MatchResultSummary {
  return quickSimDetailed(rng, home, away, world, opts).result
}
