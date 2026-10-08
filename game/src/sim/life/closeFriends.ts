/**
 * Close friends (Analiz-ve-Plan 2.4#37): the hero may mark up to three people
 * as close friends. Perks (all gated on the friendship staying warm, >= 25):
 *  - crisis: in a low-mood week a friend steps in (+happiness, -stress), max once per 4 weeks;
 *  - insider: friends leak transfer rumours (event `rumour.insider_tip`);
 *  - match: a teammate friend looks for the hero more, about +10 % pass chance;
 *  - decay: neglect fades a close friend half as fast.
 */
import type { Hero, Life, RelationKind, Relationship } from '../../core/types'
import { clamp, fill, lt, type Lines } from '../career/common'
import { changeRelation } from './relationships'

export const MAX_CLOSE_FRIENDS = 3
/** Friendship must stay at least this warm for the perks to apply. */
export const CLOSE_FRIEND_MIN = 25
/** Added to a teammate friend's relation in the match engine: ~ +10 % pass factor. */
export const CLOSE_FRIEND_PASS_BONUS = 33
/** Kinds that can be marked as a close friend. */
export const FRIEND_KINDS: ReadonlySet<RelationKind> = new Set(['bestFriend', 'teammate', 'sibling'])
const SUPPORT_FLAG = 'close_friend_support_week'
const SUPPORT_COOLDOWN = 4

export const closeFriends = (life: Life): Relationship[] =>
  Object.values(life.relationships).filter((r) => r.closeFriend)

/** Warm close friends (value >= {@link CLOSE_FRIEND_MIN}): the ones whose perks apply. */
export const warmCloseFriends = (life: Life): Relationship[] =>
  closeFriends(life).filter((r) => r.value >= CLOSE_FRIEND_MIN)

export const canBeCloseFriend = (r: Pick<Relationship, 'kind'>): boolean => FRIEND_KINDS.has(r.kind)

export type ToggleFriendResult = 'added' | 'removed' | 'full' | 'invalid'

/** Mark/unmark a close friend. Fails when three are already chosen or the kind is not eligible. */
export function toggleCloseFriend(life: Life, id: string): ToggleFriendResult {
  const r = life.relationships[id]
  if (!r || !canBeCloseFriend(r)) return 'invalid'
  if (r.closeFriend) { delete r.closeFriend; return 'removed' }
  if (closeFriends(life).length >= MAX_CLOSE_FRIENDS) return 'full'
  r.closeFriend = true
  return 'added'
}

/** Extra relation points a teammate gets in the match engine for being a warm close friend. */
export const closeFriendMatchBonus = (r: Pick<Relationship, 'closeFriend' | 'value'> | undefined): number =>
  r?.closeFriend && r.value >= CLOSE_FRIEND_MIN ? CLOSE_FRIEND_PASS_BONUS : 0

/** Is the hero in a crisis week (low mood, high stress or a hostile crowd)? */
export const inCrisis = (life: Life): boolean =>
  life.happiness < 35 || life.stress > 75 || (life.relationships.fans?.value ?? 0) < -25

/**
 * Weekly tick: a warm close friend steps in during a crisis. At most once per
 * {@link SUPPORT_COOLDOWN} weeks. Returns the log lines.
 */
export function weeklyCloseFriendSupport(life: Life, hero: Pick<Hero, 'perks'>, week: number): Lines {
  const friends = warmCloseFriends(life)
  if (friends.length === 0 || !inCrisis(life)) return []
  const last = life.flags[SUPPORT_FLAG]
  if (typeof last === 'number' && week - last < SUPPORT_COOLDOWN) return []
  const f = friends.reduce((a, b) => (b.value > a.value ? b : a))
  life.flags[SUPPORT_FLAG] = week
  life.happiness = clamp(life.happiness + 6, 0, 100)
  life.stress = clamp(life.stress - 5, 0, 100)
  changeRelation(life, f.id, 1, { week, contact: true, hero, cause: 'activity', why: lt('Zor haftada yanındaydı', 'Stood by you in a rough week') })
  return [fill(lt('{name} zor zamanında yanında durdu: moral +6, stres −5.', '{name} stood by you in a rough patch: mood +6, stress −5.'), { name: f.name })]
}
