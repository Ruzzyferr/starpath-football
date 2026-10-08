/**
 * View helpers for position roles (wizard cards, profile badge): icon, key strengths / weaknesses and
 * the live stat preview the wizard shows while the player picks.
 */
import type { AttributeKey, Background, Position, Role } from '../core/types'
import { ROLE_SPEC, neutralAttrs, previewAttrs } from '../sim/career/createHero'
import type { IconName } from './icons'
import { ATTR_DISPLAY_ORDER } from './screens/career/attrs'

export const ROLE_ICON: Readonly<Record<Role, IconName>> = {
  reflexKeeper: 'energy', shotStopper: 'shield-check', sweeperKeeper: 'boot',
  attackingFullBack: 'trend-up', defensiveFullBack: 'shield', balancedFullBack: 'scales',
  stopper: 'fire', aerialDefender: 'head-ball', ballPlayingDefender: 'tactics',
  anchor: 'shield', boxToBox: 'heartbeat', playmaker: 'eye',
  touchlineWinger: 'run', invertedWinger: 'shuffle', freeWinger: 'sparkle', dribbler: 'slalom',
  targetForward: 'target', runner: 'run-in-behind', pivot: 'head-ball',
}

/** The role's four strengths and four weaknesses (core/roles spec), in profile order. */
export function roleKeys(role: Role, _pos?: Position): { strong: AttributeKey[]; weak: AttributeKey[] } {
  const order = (ks: readonly AttributeKey[]) => ATTR_DISPLAY_ORDER.filter((k) => ks.includes(k))
  return { strong: order(ROLE_SPEC[role].plus), weak: order(ROLE_SPEC[role].minus) }
}

export interface RoleStat {
  key: AttributeKey
  value: number
  /** Difference to the position's starting sheet without a role (+ for the role's strengths, − for its weaknesses). */
  delta: number
  /** Whether the key is one of the role's strengths or weaknesses. */
  kind: 'plus' | 'minus'
}

/**
 * Neutral playstyle tag of each role (owner feedback: no role may look like the "correct" choice, so the
 * wizard shows what a role is about instead of a recommendation).
 */
export type RoleStyle = 'pace' | 'physical' | 'technical' | 'intelligence' | 'engine' | 'aerial' | 'defensive' | 'flair' | 'reflex'
export const ROLE_STYLE: Readonly<Record<Role, RoleStyle>> = {
  reflexKeeper: 'reflex', shotStopper: 'aerial', sweeperKeeper: 'intelligence',
  attackingFullBack: 'pace', defensiveFullBack: 'defensive', balancedFullBack: 'physical',
  stopper: 'physical', aerialDefender: 'aerial', ballPlayingDefender: 'technical',
  anchor: 'defensive', boxToBox: 'engine', playmaker: 'intelligence',
  touchlineWinger: 'pace', invertedWinger: 'technical', freeWinger: 'intelligence', dribbler: 'flair',
  targetForward: 'physical', runner: 'pace', pivot: 'aerial',
}

/**
 * Live preview: the role's four strengths and four weaknesses as numbered rows (the same attributes as the
 * card chips), each with its expected starting value and its difference to the position's role-free sheet.
 */
export function rolePreview(pos: Position, role: Role, background: Background, age?: number): RoleStat[] {
  const mine = previewAttrs(pos, role, background, age)
  const neutral = neutralAttrs(pos, background, age)
  const own = roleKeys(role, pos)
  return [
    ...own.strong.map((k) => ({ key: k, value: mine[k], delta: mine[k] - neutral[k], kind: 'plus' as const })),
    ...own.weak.map((k) => ({ key: k, value: mine[k], delta: mine[k] - neutral[k], kind: 'minus' as const })),
  ]
}
