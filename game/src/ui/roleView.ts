/**
 * View helpers for position roles (wizard cards, profile badge): icon, key strengths / weaknesses and
 * the live stat preview the wizard shows while the player picks.
 */
import type { AttributeKey, Background, Position, Role } from '../core/types'
import { POSITION_ROLES } from '../core/roles'
import { ROLE_TEMPLATES, ROLE_TEMPLATES_AT, previewAttrs } from '../sim/career/createHero'
import type { IconName } from './icons'

export const ROLE_ICON: Readonly<Record<Role, IconName>> = {
  reflexKeeper: 'energy', shotStopper: 'shield-check', sweeperKeeper: 'boot',
  attackingFullBack: 'trend-up', defensiveFullBack: 'shield', balancedFullBack: 'scales',
  stopper: 'fire', aerialDefender: 'head-ball', ballPlayingDefender: 'tactics',
  anchor: 'shield', boxToBox: 'heartbeat', playmaker: 'eye',
  touchlineWinger: 'run', invertedWinger: 'shuffle', freeWinger: 'sparkle', dribbler: 'slalom',
  targetForward: 'target', runner: 'run-in-behind', pivot: 'head-ball',
}

/** The role's biggest strengths (up to `n`) and its weaknesses, from its template at the position. */
export function roleKeys(role: Role, pos: Position, n = 3): { strong: AttributeKey[]; weak: AttributeKey[] } {
  const e = Object.entries(ROLE_TEMPLATES_AT[pos]?.[role] ?? ROLE_TEMPLATES[role]) as [AttributeKey, number][]
  return {
    strong: e.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k),
    weak: e.filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]).slice(0, 2).map(([k]) => k),
  }
}

export interface RoleStat {
  key: AttributeKey
  value: number
  /** Difference to the average of the position's roles. */
  delta: number
}

/**
 * Live preview: the attributes where the position's roles differ most (6 of them, in sheet order), with
 * this role's expected value and its difference to the position average.
 */
export function rolePreview(pos: Position, role: Role, background: Background, count = 6): RoleStat[] {
  const roles = POSITION_ROLES[pos]
  const sheets = roles.map((r) => previewAttrs(pos, r, background))
  const mine = previewAttrs(pos, role, background)
  const keys = Object.keys(mine) as AttributeKey[]
  const spread = (k: AttributeKey) => Math.max(...sheets.map((s) => s[k])) - Math.min(...sheets.map((s) => s[k]))
  const chosen = new Set([...keys].sort((a, b) => spread(b) - spread(a) || keys.indexOf(a) - keys.indexOf(b)).slice(0, count))
  return keys.filter((k) => chosen.has(k)).map((k) => {
    const avg = sheets.reduce((a, s) => a + s[k], 0) / sheets.length
    return { key: k, value: mine[k], delta: Math.round(mine[k] - avg) }
  })
}
