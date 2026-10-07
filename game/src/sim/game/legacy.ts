/**
 * New Game+ "Legacy" (WP-7): start a new career as the child of a Hall of Fame
 * hero. The child carries the surname (UI pre-fills it), a small inheritance
 * and a reputation head start that scale with the parent's legacy score, the
 * free "Famous Surname" perk, and a parent who follows the new career.
 *
 *   inheritance = clamp(5% of the parent's final net worth, 5 000, 2 000 000)
 *   reputation  = clamp(legacy score / 120, 3, 15)
 */
import type { GameState, Gender } from '../../core/types'
import { clamp } from '../../core/rng'
import { absWeek, fill, fmtMoney, lt, pushLog } from '../career/common'
import { grantInnatePerk } from '../career/perks'
import type { HallOfFameEntry } from './hallOfFame'

export interface LegacyStart {
  parentCareerId: string
  parentName: string
  parentGender: Gender
  legacyScore: number
  inheritance: number
  reputationBonus: number
}

export const LEGACY_PARENT_FLAG = 'c:legacyParentId'

/** Legacy terms for a child of `entry`. */
export function legacyStartFrom(entry: Pick<HallOfFameEntry, 'careerId' | 'name' | 'gender' | 'legacyScore' | 'netWorth'>): LegacyStart {
  return {
    parentCareerId: entry.careerId,
    parentName: entry.name,
    parentGender: entry.gender,
    legacyScore: entry.legacyScore,
    inheritance: Math.round(clamp(Math.max(0, entry.netWorth) * 0.05, 5_000, 2_000_000)),
    reputationBonus: Math.round(clamp(entry.legacyScore / 120, 3, 15)),
  }
}

/** Apply a Legacy start to a freshly created state (before the first club is chosen). */
export function applyLegacyStart(state: GameState, l: LegacyStart): void {
  const { hero, life } = state
  life.money += l.inheritance
  hero.reputation = clamp(hero.reputation + l.reputationBonus, 0, 100)
  grantInnatePerk(hero, 'famous_name')
  life.flags[LEGACY_PARENT_FLAG] = l.parentCareerId
  life.flags['c:legacyParentName'] = l.parentName
  const kind = l.parentGender === 'female' ? 'mother' : 'father'
  const rel = life.relationships[kind]
  if (rel) {
    rel.name = l.parentName
    rel.value = Math.max(rel.value, 70)
    rel.lastContactWeek = absWeek(state.calendar)
  }
  pushLog(life, state.calendar, fill(lt('Efsane {p}\'in çocuğu olarak sahneye çıkıyorsun. Miras: {m}, şöhret +{r}.', 'You step out as the child of legend {p}. Inheritance: {m}, reputation +{r}.'), { p: l.parentName, m: fmtMoney(l.inheritance), r: l.reputationBonus }), 'career', '🧬')
}
