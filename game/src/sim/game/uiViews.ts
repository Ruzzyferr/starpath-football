/**
 * Read-only view selectors for UI cards (national season form, comeback
 * decision, foundation + business hints, gambling meter). Never mutates.
 */
import type { GameState } from '../../core/types'
import { heroAge } from '../career/common'
import { BUSINESS_DEFS, BUSINESS_KINDS, upgradeCost } from '../life/business'
import { contentFlags } from '../../core/contentFlags'
import { heroPerformanceBonus, PERFORMANCE_BONUS_MAX } from './national'
import { END_OF_SEASON_WEEK } from '../world/fixtures'

const BONUS_MIN = -2

export interface SeasonFormView { bonus: number; min: number; max: number; ratio: number }

/** The coach's "season form" read: performance bonus mapped to 0..1. */
export function seasonFormView(state: GameState): SeasonFormView {
  const bonus = heroPerformanceBonus(state)
  return { bonus, min: BONUS_MIN, max: PERFORMANCE_BONUS_MAX, ratio: (bonus - BONUS_MIN) / (PERFORMANCE_BONUS_MAX - BONUS_MIN) }
}

/** Answered via retirement.continueCareer(), which records this flag. */
const ASKED_FLAG = 'c:retireAsked'

export interface ComebackView { age: number; weeksLeft: number; wasSeasonOver: boolean }

/** 31–33-year-old with a severe (severity 3) injury who has not answered yet this season. */
export function comebackView(state: GameState): ComebackView | null {
  const h = state.hero
  if (h.retired || !h.injury || h.injury.severity !== 3) return null
  const age = heroAge(h, state.calendar.season)
  if (age < 31 || age > 33) return null
  if (state.life.flags[ASKED_FLAG] === state.calendar.season) return null
  return { age, weeksLeft: h.injury.weeksLeft, wasSeasonOver: state.calendar.week >= END_OF_SEASON_WEEK }
}

export interface FoundationView {
  founded: boolean
  name: string
  funds: number
  /** Reputation needed before the foundation idea can appear. */
  needRep: number
  repOk: boolean
}

export function foundationView(state: GameState): FoundationView {
  const f = state.life.flags
  return {
    founded: !!f.foundation,
    name: state.hero.lastName,
    funds: Number(f.foundation_funds ?? 0) || 0,
    needRep: 22,
    repOk: state.hero.reputation >= 22,
  }
}

export interface BizHint { id: string; kind: string; cost: number; affordable: boolean }

/** Upgrades the hero could buy now (or soon), cheapest first; plus kinds not yet opened. */
export function businessHints(state: GameState): { upgrades: BizHint[]; unopened: { kind: string; price: number; locked: boolean }[] } {
  const list = state.life.businesses ?? []
  const upgrades = list.flatMap((b) => {
    const cost = upgradeCost(b)
    return cost === null ? [] : [{ id: b.id, kind: b.kind, cost, affordable: state.life.money >= cost }]
  }).sort((a, b) => a.cost - b.cost)
  const unopened = BUSINESS_KINDS.filter((k) => !list.some((b) => b.kind === k))
    .map((k) => ({ kind: k as string, price: BUSINESS_DEFS[k].price, locked: state.hero.reputation < BUSINESS_DEFS[k].minReputation }))
  return { upgrades, unopened }
}

export type AddictionLevel = 'none' | 'low' | 'mid' | 'high'

export interface AddictionView { value: number; level: AddictionLevel; hidden: boolean }

export function addictionView(state: GameState, hideCasinoSetting: boolean): AddictionView {
  const value = Math.round(state.life.casino?.addiction ?? 0)
  return {
    value,
    level: value >= 60 ? 'high' : value >= 30 ? 'mid' : value > 0 ? 'low' : 'none',
    hidden: hideCasinoSetting || contentFlags.hideCasino,
  }
}
