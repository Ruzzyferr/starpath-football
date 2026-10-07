/**
 * Read-only helpers over the World used by the sim, career layer and UI.
 */
import type {
  Club, Competition, Fixture, Formation, KitColors, League, NpcPlayer, Position, TableRow, World,
} from '../../core/types'
import { POSITIONS } from '../../core/types'
import { kitsClash } from './colors'
import { leagueCompId } from './competitions'
import { selectLineupFromPlayers } from './formations'
import type { Lineup } from './formations'
import { sortTable, tablePosition } from './table'

// ───────────────────────── Players & squads ─────────────────────────

/** NpcPlayers of a club's squad (missing ids skipped), in squad order. */
export function squadPlayers(world: World, clubId: string): NpcPlayer[] {
  const club = world.clubs[clubId]
  if (!club) return []
  const out: NpcPlayer[] = []
  for (const id of club.squad) {
    const p = world.players[id]
    if (p) out.push(p)
  }
  return out
}

const POSITION_ORDER: Readonly<Record<Position, number>> = Object.fromEntries(POSITIONS.map((p, i) => [p, i])) as Record<Position, number>

/** Squad sorted for display: by position (GK → ST), then OVR descending. */
export function sortedSquad(world: World, clubId: string): NpcPlayer[] {
  return squadPlayers(world, clubId).sort((a, b) => POSITION_ORDER[a.position] - POSITION_ORDER[b.position] || b.ovr - a.ovr)
}

/** All free agents (players without a club). */
export function freeAgents(world: World): NpcPlayer[] {
  return Object.values(world.players).filter((p) => p.clubId === null)
}

/** Age during a season. */
export function playerAge(p: Pick<NpcPlayer, 'birthYear'>, season: number): number {
  return season - p.birthYear
}

export type NameFormat = 'full' | 'short' | 'last'

/** "Arda Yılmaz" (full), "A. Yılmaz" (short) or "Yılmaz" (last). */
export function playerDisplayName(p: Pick<NpcPlayer, 'firstName' | 'lastName'> | undefined | null, format: NameFormat = 'short'): string {
  if (!p) return '—'
  if (format === 'full') return `${p.firstName} ${p.lastName}`
  if (format === 'last') return p.lastName
  return `${p.firstName.charAt(0)}. ${p.lastName}`
}

/** Display name by id; retired/removed players render as "—". */
export function playerNameById(world: World, playerId: string, format: NameFormat = 'short'): string {
  return playerDisplayName(world.players[playerId], format)
}

// ───────────────────────── Lineups & strength ─────────────────────────

/**
 * Best XI of a club for a formation (defaults to the club's own), GK first,
 * with position slots and a 7-man bench. `excludeIds` removes players (e.g.
 * suspended, or the hero's slot handled elsewhere).
 */
export function selectLineup(
  world: World,
  clubId: string,
  formation?: Formation,
  excludeIds?: ReadonlySet<string> | readonly string[],
): Lineup {
  const club = world.clubs[clubId]
  const exclude = excludeIds ? (excludeIds instanceof Set ? excludeIds : new Set(excludeIds as readonly string[])) : undefined
  return selectLineupFromPlayers(squadPlayers(world, clubId), formation ?? club?.formation ?? '4-4-2', exclude)
}

const ATTACK_WEIGHT: Readonly<Record<Position, number>> = {
  GK: 0, CB: 0.1, LB: 0.35, RB: 0.35, DM: 0.3, CM: 0.6, AM: 0.9, LW: 0.9, RW: 0.9, ST: 1,
}
const DEFENSE_WEIGHT: Readonly<Record<Position, number>> = {
  GK: 1.4, CB: 1, LB: 0.8, RB: 0.8, DM: 0.8, CM: 0.5, AM: 0.2, LW: 0.2, RW: 0.2, ST: 0.1,
}
/** Effective rating assumed for an empty slot (club cannot field 11). */
const EMPTY_SLOT_RATING = 30
const LINEUP_SIZE = 11

export interface TeamRating {
  lineup: Lineup
  /** Weighted effective rating of attacking slots. */
  attack: number
  /** Weighted effective rating of defensive slots. */
  defense: number
  /** Mean effective rating of the XI. */
  overall: number
  /** Mean morale (0..100) of the XI. */
  morale: number
}

/** Rate a lineup: attack/defense/overall on the OVR scale. */
export function rateLineup(world: World, lineup: Lineup): TeamRating {
  let att = 0, attW = 0, def = 0, defW = 0, sum = 0, morale = 0
  lineup.slots.forEach((slot, i) => {
    const r = lineup.ratings[i]
    att += r * ATTACK_WEIGHT[slot]
    attW += ATTACK_WEIGHT[slot]
    def += r * DEFENSE_WEIGHT[slot]
    defW += DEFENSE_WEIGHT[slot]
    sum += r
    morale += world.players[lineup.playerIds[i]]?.morale ?? 60
  })
  const n = lineup.slots.length
  const missing = Math.max(0, LINEUP_SIZE - n)
  // Missing players drag every unit toward EMPTY_SLOT_RATING proportionally.
  const fill = (total: number, weight: number) =>
    ((weight > 0 ? total / weight : EMPTY_SLOT_RATING) * n + EMPTY_SLOT_RATING * missing) / (n + missing || 1)
  return {
    lineup,
    attack: fill(att, attW),
    defense: fill(def, defW),
    overall: (sum + EMPTY_SLOT_RATING * missing) / LINEUP_SIZE,
    morale: n ? morale / n : 50,
  }
}

/** Strength of a club's best XI in its own formation. */
export function teamRating(world: World, club: Club, excludeIds?: ReadonlySet<string>): TeamRating {
  return rateLineup(world, selectLineup(world, club.id, club.formation, excludeIds))
}

/** Convenience: overall/attack/defense numbers for a club. */
export function clubStrength(world: World, clubId: string): { overall: number; attack: number; defense: number } {
  const club = world.clubs[clubId]
  if (!club) return { overall: 0, attack: 0, defense: 0 }
  const r = teamRating(world, club)
  return { overall: r.overall, attack: r.attack, defense: r.defense }
}

// ───────────────────────── Competitions & fixtures ─────────────────────────

/** All competitions of a season. */
export function seasonCompetitions(world: World, season: number): Competition[] {
  return Object.values(world.competitions).filter((c) => c.season === season)
}

/** The league a club currently plays in. */
export function clubLeague(world: World, clubId: string): League | null {
  const club = world.clubs[clubId]
  return club ? world.leagues[club.leagueId] ?? null : null
}

/** League competition of a league in a season. */
export function leagueCompetition(world: World, leagueId: string, season: number): Competition | null {
  return world.competitions[leagueCompId(season, leagueId)] ?? null
}

/** Sorted league table containing `clubId` for a season, with the club's 1-based position. */
export function leagueTableFor(world: World, clubId: string, season: number): { competition: Competition; rows: TableRow[]; position: number } | null {
  const comp = seasonCompetitions(world, season).find((c) => c.type === 'league' && c.participantIds.includes(clubId))
  if (!comp?.table) return null
  const rows = sortTable(comp.table, comp.fixtures)
  return { competition: comp, rows, position: tablePosition(rows, clubId) }
}

export interface FixtureRef {
  competition: Competition
  fixture: Fixture
}

function compareFixtureTime(a: Fixture, b: Fixture): number {
  return a.week - b.week || a.day - b.day
}

/** Every fixture of a club in a season, chronologically. */
export function clubFixtures(world: World, clubId: string, season: number): FixtureRef[] {
  const out: FixtureRef[] = []
  for (const comp of seasonCompetitions(world, season)) {
    for (const f of comp.fixtures) if (f.homeId === clubId || f.awayId === clubId) out.push({ competition: comp, fixture: f })
  }
  return out.sort((a, b) => compareFixtureTime(a.fixture, b.fixture))
}

/** Next unplayed fixture of a club at or after (week, day). */
export function nextFixtureFor(world: World, clubId: string, season: number, week = 0, day = 0): FixtureRef | null {
  let best: FixtureRef | null = null
  for (const comp of seasonCompetitions(world, season)) {
    for (const f of comp.fixtures) {
      if (f.result || (f.homeId !== clubId && f.awayId !== clubId)) continue
      if (f.week < week || (f.week === week && f.day < day)) continue
      if (!best || compareFixtureTime(f, best.fixture) < 0) best = { competition: comp, fixture: f }
    }
  }
  return best
}

/** Fixtures (any club) scheduled on a given day. */
export function fixturesOn(world: World, season: number, week: number, day: number): FixtureRef[] {
  const out: FixtureRef[] = []
  for (const comp of seasonCompetitions(world, season)) {
    for (const f of comp.fixtures) if (f.week === week && f.day === day) out.push({ competition: comp, fixture: f })
  }
  return out
}

/**
 * Top scorers this season (stats cover all competitions). Filter by league or
 * country of the player's current club.
 */
export function topScorers(world: World, opts: { leagueId?: string; countryId?: string; limit?: number } = {}): NpcPlayer[] {
  const limit = opts.limit ?? 10
  const list = Object.values(world.players).filter((p) => {
    if (p.stats.goals <= 0 || !p.clubId) return false
    const club = world.clubs[p.clubId]
    if (!club) return false
    if (opts.leagueId && club.leagueId !== opts.leagueId) return false
    if (opts.countryId && club.countryId !== opts.countryId) return false
    return true
  })
  return list.sort((a, b) => b.stats.goals - a.stats.goals || a.stats.apps - b.stats.apps || (a.id < b.id ? -1 : 1)).slice(0, limit)
}

// ───────────────────────── Colours ─────────────────────────

/** Home and away kits of a club. */
export function clubColors(world: World, clubId: string): { home: KitColors; away: KitColors } | null {
  const c = world.clubs[clubId]
  return c ? { home: c.colors, away: c.awayColors } : null
}

/** Kits to wear in a match: the away side switches to its change kit on a clash. */
export function matchKits(home: Club, away: Club): { home: KitColors; away: KitColors } {
  if (!kitsClash(home.colors, away.colors)) return { home: home.colors, away: away.colors }
  return { home: home.colors, away: away.awayColors }
}
