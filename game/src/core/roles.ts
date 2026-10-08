/**
 * Position roles (owner feedback after the APK play-test, defined with a football-insider friend).
 * Each position offers only its own roles; a role carries an attribute template (sim/career/createHero),
 * a height default, a suggested perk, a match identity (sim/match/highlightGen kind mix) and a hint for
 * the AI team-mates in a highlight (how they like to find the hero).
 */
import type { Attributes, Gender, NpcPlayer, Position, Role } from './types'
import { hashString } from './rng'

/** Roles offered at each position, in the order the wizard shows them (first = default). */
export const POSITION_ROLES: Readonly<Record<Position, readonly Role[]>> = {
  GK: ['reflexKeeper', 'shotStopper', 'sweeperKeeper'],
  LB: ['balancedFullBack', 'attackingFullBack', 'defensiveFullBack'],
  RB: ['balancedFullBack', 'attackingFullBack', 'defensiveFullBack'],
  CB: ['stopper', 'aerialDefender', 'ballPlayingDefender'],
  DM: ['anchor', 'boxToBox', 'playmaker'],
  CM: ['boxToBox', 'anchor', 'playmaker'],
  AM: ['playmaker', 'boxToBox'],
  LW: ['touchlineWinger', 'invertedWinger', 'freeWinger', 'dribbler'],
  RW: ['touchlineWinger', 'invertedWinger', 'freeWinger', 'dribbler'],
  ST: ['runner', 'targetForward', 'pivot'],
}

export const ROLES: readonly Role[] = [
  'reflexKeeper', 'shotStopper', 'sweeperKeeper',
  'attackingFullBack', 'defensiveFullBack', 'balancedFullBack',
  'stopper', 'aerialDefender', 'ballPlayingDefender',
  'anchor', 'boxToBox', 'playmaker',
  'touchlineWinger', 'invertedWinger', 'freeWinger', 'dribbler',
  'targetForward', 'runner', 'pivot',
]

export const isRole = (v: unknown): v is Role => typeof v === 'string' && (ROLES as readonly string[]).includes(v)

/** Default role of a position (the wizard resets to it when the position changes). */
export const defaultRole = (pos: Position): Role => POSITION_ROLES[pos][0]!

export const roleFits = (pos: Position, role: Role): boolean => POSITION_ROLES[pos].includes(role)

/** A role valid for the position: the given one when it fits, else the position default. */
export const normalizeRole = (pos: Position, role: unknown): Role => (isRole(role) && roleFits(pos, role) ? role : defaultRole(pos))

// ───────────────────────── Height ─────────────────────────

/** Default height (cm) of a male player in each role; women's game −12 cm. The wizard allows ±HEIGHT_ADJUST. */
export const ROLE_HEIGHT: Readonly<Record<Role, number>> = {
  reflexKeeper: 187, shotStopper: 190, sweeperKeeper: 188,
  attackingFullBack: 176, defensiveFullBack: 180, balancedFullBack: 178,
  stopper: 184, aerialDefender: 192, ballPlayingDefender: 186,
  anchor: 183, boxToBox: 180, playmaker: 175,
  touchlineWinger: 175, invertedWinger: 177, freeWinger: 176, dribbler: 171,
  targetForward: 183, runner: 178, pivot: 192,
}
export const HEIGHT_ADJUST = 5
const FEMALE_OFFSET = -12
/** Height the aerial bonus is measured from (an average outfielder). */
const HEIGHT_REF = 181

export function heightRange(role: Role, gender: Gender = 'male'): { def: number; min: number; max: number } {
  const def = ROLE_HEIGHT[role] + (gender === 'female' ? FEMALE_OFFSET : 0)
  return { def, min: def - HEIGHT_ADJUST, max: def + HEIGHT_ADJUST }
}

/** Clamp a requested height into the role's range (default when missing / invalid). */
export function clampHeight(role: Role, gender: Gender | undefined, cm: unknown): number {
  const r = heightRange(role, gender)
  const n = typeof cm === 'number' && Number.isFinite(cm) ? Math.round(cm) : r.def
  return Math.max(r.min, Math.min(r.max, n))
}

/** The hero's height (old saves without one read the role default). */
export const heroHeight = (hero: { role: Role; heightCm?: number; gender?: Gender }): number =>
  typeof hero.heightCm === 'number' && Number.isFinite(hero.heightCm) ? hero.heightCm : heightRange(hero.role, hero.gender).def

/**
 * Aerial edge from height, in attribute points for heading / jumping in matches (−4..+4). Relative to the
 * gender's average so a 180 cm woman is tall. A tall player also gives up a little agility (half of it).
 */
export function heightAerialBonus(cm: number, gender: Gender = 'male'): number {
  const ref = HEIGHT_REF + (gender === 'female' ? FEMALE_OFFSET : 0)
  return Math.max(-4, Math.min(4, Math.round((cm - ref) / 2.5)))
}

/** Match attributes with the height edge: heading and jumping ± bonus, a tall player a little less agile. */
export function withHeight(attrs: Attributes, cm: number, gender: Gender = 'male'): Attributes {
  const b = heightAerialBonus(cm, gender)
  if (!b) return attrs
  const fit = (v: number) => Math.max(1, Math.min(99, Math.round(v)))
  return { ...attrs, heading: fit(attrs.heading + b), jumping: fit(attrs.jumping + b), agility: fit(attrs.agility - (b > 0 ? b / 2 : 0)) }
}

// ───────────────────────── Perk suggestion ─────────────────────────

/** Perk that suits the role (shown in the wizard and highlighted in the perk tree). */
export const ROLE_PERK: Readonly<Record<Role, string>> = {
  reflexKeeper: 'cat_reflexes', shotStopper: 'penalty_saver', sweeperKeeper: 'sweeper_keeper',
  attackingFullBack: 'cross_specialist', defensiveFullBack: 'slide_tackle', balancedFullBack: 'marathon',
  stopper: 'interceptor', aerialDefender: 'aerial_wall', ballPlayingDefender: 'metronome',
  anchor: 'interceptor', boxToBox: 'marathon', playmaker: 'through_ball',
  touchlineWinger: 'cross_specialist', invertedWinger: 'finesse_master', freeWinger: 'through_ball', dribbler: 'elastico',
  targetForward: 'iron_body', runner: 'speed_demon', pivot: 'header_king',
}

// ───────────────────────── AI team-mates ─────────────────────────

/**
 * How team-mates look for the hero in a highlight: `runner` → balls in behind the line,
 * `aerial` → high balls to win, `feet` → into feet even with a marker on his back.
 */
export type RoleAiStyle = 'runner' | 'aerial' | 'feet'
export function roleAiStyle(role: Role | undefined): RoleAiStyle | null {
  switch (role) {
    case 'runner': case 'touchlineWinger': case 'attackingFullBack':
      return 'runner'
    case 'pivot': case 'aerialDefender':
      return 'aerial'
    case 'targetForward': case 'playmaker': case 'dribbler':
      return 'feet'
    default:
      return null
  }
}

// ───────────────────────── NPCs and old saves ─────────────────────────

/** NPC role: derived from the player's style seed (no save field), for scouting text and AI flavour. */
export function npcRole(p: Pick<NpcPlayer, 'position' | 'styleSeed'>): Role {
  const list = POSITION_ROLES[p.position]
  return list[hashString(`role|${p.styleSeed}`) % list.length]!
}

/**
 * Frozen v4 → v5 mapping (do not change: old saves must migrate the same way forever): the old
 * position-agnostic archetype becomes the closest role at the hero's position.
 */
export function roleFromArchetype(archetype: unknown, pos: Position): Role {
  const a = typeof archetype === 'string' ? archetype : ''
  const pick = (m: Record<string, Role>): Role => m[a] ?? defaultRole(pos)
  switch (pos) {
    case 'GK':
      return 'shotStopper'
    case 'CB':
      return pick({ wall: 'aerialDefender', playmaker: 'ballPlayingDefender' })
    case 'LB': case 'RB':
      return pick({ winger: 'attackingFullBack', poacher: 'attackingFullBack', wall: 'defensiveFullBack', boxToBox: 'balancedFullBack' })
    case 'DM': case 'CM': case 'AM':
      return pick({ wall: 'anchor', playmaker: 'playmaker', poacher: 'playmaker', boxToBox: 'boxToBox', winger: 'boxToBox' })
    case 'LW': case 'RW':
      return pick({ winger: 'touchlineWinger', poacher: 'invertedWinger', playmaker: 'freeWinger' })
    case 'ST':
      return pick({ poacher: 'runner', winger: 'runner', wall: 'pivot', playmaker: 'targetForward', boxToBox: 'targetForward' })
  }
}
