/**
 * New Game+ "Legacy" (WP-7): start a new career as the child of a Hall of Fame
 * hero. The child carries the surname (UI pre-fills it), a small inheritance
 * and a reputation head start that scale with the parent's legacy score, the
 * free "Famous Surname" perk, and a parent who follows the new career.
 *
 *   inheritance = clamp(2% of the parent's final net worth, 5 000, 150 000)
 *   reputation  = clamp(legacy score / 150, 3, 10)
 *
 * Playtest round 2: at 5% / 2M / 15 the child of a 31M legend started at 16
 * with ~1.5M cash, bought 15 luxuries in the first season, had money idling
 * from season 4 and 82 reputation at 22: the rags-to-riches arc, the best part
 * of the genre, was skipped. The legacy is now a head start, not the finish.
 */
import type { GameState, Gender } from '../../core/types'
import { clamp } from '../../core/rng'
import { absWeek, fill, fmtMoney, lt, pushLog } from '../career/common'
import { grantInnatePerk } from '../career/perks'
import type { HallOfFameEntry } from './hallOfFame'
import { legacyAcademyBonus, legacyFundBonus } from '../life/projects'

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
export function legacyStartFrom(entry: Pick<HallOfFameEntry, 'careerId' | 'name' | 'gender' | 'legacyScore' | 'netWorth'> & Partial<Pick<HallOfFameEntry, 'legacyFund' | 'academyLevel'>>): LegacyStart {
  return {
    parentCareerId: entry.careerId,
    parentName: entry.name,
    parentGender: entry.gender,
    legacyScore: entry.legacyScore,
    inheritance: Math.round(clamp(Math.max(0, entry.netWorth) * 0.02, 5_000, 150_000)) + legacyFundBonus(entry.legacyFund ?? 0),
    reputationBonus: Math.round(clamp(entry.legacyScore / 150, 3, 10)) + legacyAcademyBonus(entry.academyLevel ?? 0),
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
