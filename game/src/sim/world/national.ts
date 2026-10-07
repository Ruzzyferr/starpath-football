/**
 * National teams: squads (U19 / U21 / senior) picked from the world's players
 * by nationality, coaches, and the international calendar.
 *
 *  - Every international break (weeks 11, 24, 35; Thursday + Sunday) the
 *    senior teams play qualifiers and the U21/U19 teams a development league.
 *  - Every season ends with a senior finals tournament in the off-season
 *    (weeks 42–43): continental championships (old continent / oceans) and
 *    the "World Tournament" alternate every year, each therefore every 2 years.
 *    Qualifying groups → finals (host + qualifiers): 2 groups of 4 → semi-finals
 *    → final, or straight semi-finals for a 4-team finals.
 *  - Nations without simulated leagues get deterministic generated squads.
 *
 * Team ids: the senior team is the nation id ('TR'); youth teams 'TR:U21',
 * 'TR:U19'. These ids are stored in Fixture.homeId / awayId of competitions
 * of type 'international'.
 */
import type { Competition, Fixture, Formation, LText, NpcPlayer, Position, TacticStyle, World } from '../../core/types'
import { Rng, clamp } from '../../core/rng'
import { START_YEAR } from '../../core/config'
import { worldGender } from '../../core/gender'
import {
  NATION_BY_ID, NATION_DEFS, NATIONAL_TOURNAMENT_NAMES, QUALIFIER_SUFFIX, YOUTH_LEAGUE_NAMES, type Confed, type NationDef,
} from '../../data/world/nations'
import { positionGroup, type PositionGroup } from './attributes'
import { applyFixtureResult, isDecisiveFixture, isNeutralFixture, tieWinner } from './competitions'
import { selectLineupFromPlayers } from './formations'
import { INTERNATIONAL_DATES, NATIONAL_FINALS_DATES, doubleRoundRobin, roundRobin, fixtureId } from './fixtures'
import { createNpcPlayer, randomName } from './players'
import { quickSimLineups, type QuickSimDetail } from './quickSim'
import { createTable, sortTable } from './table'
import type { NationalLevel, NationalWorld } from './worldTypes'

export const NATIONAL_SQUAD_SIZE = 23
export const SQUAD_QUOTA: Readonly<Record<PositionGroup, number>> = { GK: 3, DEF: 8, MID: 7, FWD: 5 }
export const LEVELS: readonly NationalLevel[] = ['A', 'U21', 'U19']
export const LEVEL_MAX_AGE: Readonly<Record<NationalLevel, number>> = { A: 99, U21: 21, U19: 19 }
/** Senior debut is possible from this age. */
export const SENIOR_MIN_AGE = 17
const VIRTUAL_POSITIONS: readonly Position[] = [
  'GK', 'GK', 'GK', 'CB', 'CB', 'CB', 'CB', 'LB', 'LB', 'RB', 'RB', 'DM', 'DM', 'CM', 'CM', 'CM', 'AM', 'AM', 'LW', 'RW', 'ST', 'ST', 'ST',
]

// ───────────────────────── Ids ─────────────────────────

export const nationalTeamId = (nationId: string, level: NationalLevel): string => (level === 'A' ? nationId : `${nationId}:${level}`)

export function parseTeamId(teamId: string): { nationId: string; level: NationalLevel } | null {
  const [nationId, lv] = teamId.split(':')
  if (!NATION_BY_ID[nationId]) return null
  if (lv === undefined) return { nationId, level: 'A' }
  return lv === 'U21' || lv === 'U19' ? { nationId, level: lv } : null
}

export const isNationalTeamId = (id: string): boolean => parseTeamId(id) !== null

export const youthCompId = (season: number, level: NationalLevel) => `NY-${season}-${level}`
export const qualifierCompId = (season: number, key: string) => `NQ-${season}-${key}`
export const finalsCompId = (season: number, key: string) => `NF-${season}-${key}`
export const friendlyCompId = (season: number) => `NFR-${season}`
const FRIENDLY_NAME: LText = { tr: 'Hazırlık Maçları', en: 'International Friendlies' }

/** Which senior tournament a season ends with: continental championships in even years, the World Tournament in odd years. */
export function tournamentKind(season: number): 'continental' | 'world' {
  return (season - START_YEAR) % 2 === 0 ? 'continental' : 'world'
}

/** Tournament keys of a season ('EU' + 'OC', or 'WORLD'). */
export function tournamentKeys(season: number): ('EU' | 'OC' | 'WORLD')[] {
  return tournamentKind(season) === 'world' ? ['WORLD'] : ['EU', 'OC']
}

/** Senior tournament key a nation plays in this season. */
export function tournamentKeyFor(nationId: string, season: number): 'EU' | 'OC' | 'WORLD' {
  if (tournamentKind(season) === 'world') return 'WORLD'
  return NATION_BY_ID[nationId]?.confed ?? 'EU'
}

export function teamName(teamId: string): LText {
  const p = parseTeamId(teamId)
  const n = p ? NATION_BY_ID[p.nationId] : undefined
  if (!p || !n) return { tr: teamId, en: teamId }
  if (p.level === 'A') return { ...n.name }
  return { tr: `${n.name.tr} ${p.level}`, en: `${n.name.en} ${p.level}` }
}

// ───────────────────────── State ─────────────────────────

/** Lazily create the national state (old saves, fresh worlds). */
export function ensureNational(world: World): NationalWorld {
  if (!world.national) {
    const coaches: Record<string, string> = {}
    for (const n of NATION_DEFS) {
      const r = new Rng(`coach:${n.id}`)
      const nm = randomName(r, n.nameStyle)
      coaches[n.id] = `${nm.firstName} ${nm.lastName}`
    }
    world.national = {
      v: 1, coaches, squads: {}, announced: null, stats: {},
      hero: { teamId: null, meter: 0, level: 'U19', status: 'out', youthCaps: 0, youthGoals: 0, log: [] },
    }
  }
  return world.national
}

// ───────────────────────── Players & squads ─────────────────────────

/** True when the nation has generated club players in this world. */
export function isSimulatedNation(world: World, nationId: string): boolean {
  return !!world.countries[nationId]
}

const virtualCache = new Map<string, NpcPlayer[]>()

function virtualBase(n: NationDef, level: NationalLevel): number {
  const base = 48 + n.reputation * 0.36
  return level === 'A' ? base : level === 'U21' ? base - 9 : base - 15
}

/**
 * Deterministic generated squad for a team (23 players). Used for nations
 * without simulated leagues and to fill thin youth pools. Never stored.
 */
export function virtualSquad(teamId: string, season: number, gender: 'male' | 'female' = 'male'): NpcPlayer[] {
  const key = `${teamId}|${gender}`
  const cached = virtualCache.get(key)
  if (cached) return cached.map((p) => ({ ...p, birthYear: season - (p.birthYear) }))
  const parsed = parseTeamId(teamId)
  const n = parsed ? NATION_BY_ID[parsed.nationId] : undefined
  if (!parsed || !n) return []
  const rng = new Rng(`virtual:${teamId}:${gender}`)
  const base = virtualBase(n, parsed.level)
  const rank = new Map<Position, number>()
  const out: NpcPlayer[] = VIRTUAL_POSITIONS.map((pos, i) => {
    const r = rank.get(pos) ?? 0
    rank.set(pos, r + 1)
    const age = parsed.level === 'U19' ? rng.int(17, 19) : parsed.level === 'U21' ? rng.int(19, 21) : rng.int(22, 33)
    const ovr = clamp(Math.round(base + (r === 0 ? 2 : -1.5 * r) + rng.normal(0, 2.5)), 35, 92)
    // birthYear stores the age here; it is rebased on the requested season when served.
    return { ...createNpcPlayer(rng, { id: `v:${teamId}:${i}`, nationality: n.id, position: pos, age, season: 0, ovr, clubId: null, gender }), birthYear: age }
  })
  virtualCache.set(key, out)
  return out.map((p) => ({ ...p, birthYear: season - p.birthYear }))
}

/** Players eligible for a nation and level, best first (selection score). */
function eligiblePlayers(world: World, nationId: string, level: NationalLevel, season: number, exclude: ReadonlySet<string>): NpcPlayer[] {
  const maxAge = LEVEL_MAX_AGE[level]
  const list: { p: NpcPlayer; s: number }[] = []
  for (const p of Object.values(world.players)) {
    if (p.nationality !== nationId || exclude.has(p.id) || p.injuredWeeks > 2) continue
    const age = season - p.birthYear
    if (age > maxAge || age < 16) continue
    list.push({ p, s: selectionScore(world, p) })
  }
  return list.sort((a, b) => b.s - a.s || (a.p.id < b.p.id ? -1 : 1)).map((x) => x.p)
}

/** How a national coach rates a player: ability, form, club level and playing time. */
export function selectionScore(world: World, p: NpcPlayer): number {
  const club = p.clubId ? world.clubs[p.clubId] : undefined
  return p.ovr + (p.form - 50) * 0.05 + (club ? (club.reputation - 50) * 0.03 : -2) + Math.min(p.stats.apps, 20) * 0.05
}

/** Pick 23 by position quota from a ranked pool (fills from the best remaining when a group is thin). */
function pickByQuota(pool: readonly NpcPlayer[], size = NATIONAL_SQUAD_SIZE): NpcPlayer[] {
  const picked: NpcPlayer[] = []
  const used = new Set<string>()
  for (const g of ['GK', 'DEF', 'MID', 'FWD'] as PositionGroup[]) {
    let n = 0
    for (const p of pool) {
      if (n >= SQUAD_QUOTA[g]) break
      if (positionGroup(p.position) !== g || used.has(p.id)) continue
      picked.push(p)
      used.add(p.id)
      n++
    }
  }
  for (const p of pool) {
    if (picked.length >= size) break
    if (!used.has(p.id) && positionGroup(p.position) !== 'GK') {
      picked.push(p)
      used.add(p.id)
    }
  }
  return picked
}

/**
 * Select every national squad (senior first, so a player is in one squad
 * only) and store the ids. Thin pools are topped up with generated players.
 */
export function announceSquads(world: World, season: number, week: number): void {
  const nat = ensureNational(world)
  const squads: Record<string, string[]> = {}
  for (const n of NATION_DEFS) {
    const used = new Set<string>()
    for (const level of LEVELS) {
      const id = nationalTeamId(n.id, level)
      if (!isSimulatedNation(world, n.id)) continue
      const picked = pickByQuota(eligiblePlayers(world, n.id, level, season, used))
      for (const p of picked) used.add(p.id)
      const ids = picked.map((p) => p.id)
      if (ids.length < NATIONAL_SQUAD_SIZE) {
        const fill = virtualSquad(id, season, worldGender(world)).filter((v) => !ids.includes(v.id))
        // Fill the missing position groups first.
        const have = new Map<PositionGroup, number>()
        for (const p of picked) have.set(positionGroup(p.position), (have.get(positionGroup(p.position)) ?? 0) + 1)
        for (const v of fill) {
          if (ids.length >= NATIONAL_SQUAD_SIZE) break
          const g = positionGroup(v.position)
          if ((have.get(g) ?? 0) < SQUAD_QUOTA[g]) {
            ids.push(v.id)
            have.set(g, (have.get(g) ?? 0) + 1)
          }
        }
        for (const v of fill) if (ids.length < NATIONAL_SQUAD_SIZE && !ids.includes(v.id)) ids.push(v.id)
      }
      squads[id] = ids
    }
  }
  // Keep the hero's place if the game layer already put him in.
  for (const [id, list] of Object.entries(nat.squads)) if (list.includes('hero') && squads[id]) squads[id] = [...squads[id], 'hero']
  nat.squads = squads
  nat.announced = { season, week }
}

/** Resolve a player id of a national squad (world player or generated one). */
export function nationalPlayer(world: World, teamId: string, id: string, season: number): NpcPlayer | null {
  if (world.players[id]) return world.players[id]
  if (id.startsWith('v:')) return virtualSquad(teamId, season, worldGender(world)).find((p) => p.id === id) ?? null
  return null
}

/** Players of a national team (announced squad, or a fresh selection / generated squad). */
export function nationalTeamPlayers(world: World, teamId: string, season: number): NpcPlayer[] {
  const nat = ensureNational(world)
  const parsed = parseTeamId(teamId)
  if (!parsed) return []
  if (!isSimulatedNation(world, parsed.nationId)) return virtualSquad(teamId, season, worldGender(world))
  const ids = nat.squads[teamId]
  if (ids && ids.length) {
    const out: NpcPlayer[] = []
    for (const id of ids) {
      const p = nationalPlayer(world, teamId, id, season)
      if (p) out.push(p)
    }
    if (out.length >= 11) return out
  }
  const picked = pickByQuota(eligiblePlayers(world, parsed.nationId, parsed.level, season, new Set()))
  if (picked.length >= NATIONAL_SQUAD_SIZE) return picked
  const fill = virtualSquad(teamId, season, worldGender(world))
  return [...picked, ...fill.slice(0, NATIONAL_SQUAD_SIZE - picked.length)]
}

export function nationFormation(nationId: string): Formation {
  return NATION_BY_ID[nationId]?.formation ?? '4-3-3'
}
export function nationStyle(nationId: string): TacticStyle {
  return NATION_BY_ID[nationId]?.style ?? 'balanced'
}

/** Mean OVR of a national team's best XI (for previews and tables). */
export function nationalTeamStrength(world: World, teamId: string, season: number): number {
  const p = parseTeamId(teamId)
  if (!p) return 0
  const lineup = selectLineupFromPlayers(nationalTeamPlayers(world, teamId, season), nationFormation(p.nationId))
  return lineup.ratings.length ? lineup.ratings.reduce((s, v) => s + v, 0) / lineup.ratings.length : 0
}

// ───────────────────────── Competitions ─────────────────────────

/** Snake-seed `teams` (sorted strongest first) into `groups` groups. */
function snakeGroups(teams: readonly string[], groups: number): string[][] {
  const out: string[][] = Array.from({ length: groups }, () => [])
  teams.forEach((id, i) => {
    const row = Math.floor(i / groups)
    const col = i % groups
    out[row % 2 === 0 ? col : groups - 1 - col].push(id)
  })
  return out
}

const byReputation = (a: string, b: string): number =>
  (NATION_BY_ID[parseTeamId(b)?.nationId ?? '']?.reputation ?? 0) - (NATION_BY_ID[parseTeamId(a)?.nationId ?? '']?.reputation ?? 0) || (a < b ? -1 : 1)

function nationsOf(key: 'EU' | 'OC' | 'WORLD'): NationDef[] {
  return key === 'WORLD' ? [...NATION_DEFS] : NATION_DEFS.filter((n) => n.confed === (key as Confed))
}

/** Last host of a tournament key (to rotate hosts). */
function lastHost(world: World, key: string): string | null {
  for (let i = world.honours.length - 1; i >= 0; i--) {
    const h = world.honours[i] as { compKey: string; hostId?: string }
    if (h.compKey === `nt:${key}` && h.hostId) return h.hostId
  }
  return null
}

/** Group fixtures on international dates: group of R rounds spread over the 6 dates. */
function groupFixtures(compId: string, groups: readonly string[][], dates: readonly { week: number; day: number }[], double: boolean): Fixture[] {
  const out: Fixture[] = []
  groups.forEach((group, g) => {
    const rounds = double ? doubleRoundRobin(group) : roundRobin(group)
    rounds.forEach((pairs, r) => {
      const di = rounds.length <= 1 ? 0 : Math.round((r * (dates.length - 1)) / (rounds.length - 1))
      const date = dates[Math.min(di, dates.length - 1)]
      pairs.forEach(([homeId, awayId], i) => {
        out.push({ id: fixtureId(compId, r, g * 4 + i), compId, round: r, group: g, week: date.week, day: date.day, homeId, awayId, result: null })
      })
    })
  })
  return out
}

/** Finals size of a tournament key (8, or 4 for small confederations). */
export function finalsSize(key: 'EU' | 'OC' | 'WORLD'): number {
  return nationsOf(key).length >= 8 ? 8 : 4
}

/**
 * Create the season's international competitions: U21/U19 development
 * leagues (6 rounds of a single round robin) and the senior qualifying
 * groups of the tournament(s) ending this season.
 */
export function createNationalCompetitions(world: World, rng: Rng, season: number): Competition[] {
  ensureNational(world)
  const comps: Competition[] = []
  for (const level of ['U21', 'U19'] as NationalLevel[]) {
    const id = youthCompId(season, level)
    const teams = rng.shuffle(NATION_DEFS.map((n) => nationalTeamId(n.id, level)))
    const rounds = roundRobin(teams).slice(0, INTERNATIONAL_DATES.length)
    const fixtures: Fixture[] = []
    rounds.forEach((pairs, r) => {
      const d = INTERNATIONAL_DATES[r]
      pairs.forEach(([homeId, awayId], i) => fixtures.push({ id: fixtureId(id, r, i), compId: id, round: r, week: d.week, day: d.day, homeId, awayId, result: null }))
    })
    comps.push({
      id, type: 'international', name: { ...YOUTH_LEAGUE_NAMES[level as 'U21' | 'U19'] }, season, countryId: null, leagueId: null,
      participantIds: teams, fixtures, table: createTable(teams), alive: null, winnerId: null,
      meta: { format: 'nt_youth', level, key: `nt:youth:${level}` },
    })
  }
  const hosts: string[] = []
  for (const key of tournamentKeys(season)) {
    const nations = nationsOf(key)
    const prev = lastHost(world, key)
    const hostPool = nations.filter((n) => n.id !== prev)
    const host = rng.weighted(hostPool, (n) => 0.5 + n.reputation / 100).id
    const teams = nations.filter((n) => n.id !== host).map((n) => n.id).sort(byReputation)
    const groupCount = Math.max(1, Math.ceil(teams.length / 4))
    const groups = snakeGroups(teams, groupCount)
    const id = qualifierCompId(season, key)
    const name = NATIONAL_TOURNAMENT_NAMES[key]
    comps.push({
      id, type: 'international', name: { tr: `${name.tr} ${QUALIFIER_SUFFIX.tr}`, en: `${name.en} ${QUALIFIER_SUFFIX.en}` }, season,
      countryId: null, leagueId: null, participantIds: groups.flat(), fixtures: groupFixtures(id, groups, INTERNATIONAL_DATES, true),
      table: createTable(groups.flat()), alive: null, winnerId: null,
      meta: { format: 'nt_qual', groups, hostId: host, key: `nt:${key}`, level: 'A', slots: finalsSize(key) - 1 },
    })
    hosts.push(host)
  }
  // Hosts skip qualifying: they play friendlies against teams idle on that date.
  const fid = friendlyCompId(season)
  const friendlies: Fixture[] = []
  INTERNATIONAL_DATES.forEach((d, di) => {
    const busy = new Set<string>()
    for (const c of comps) for (const f of c.fixtures) if (f.week === d.week && f.day === d.day) { busy.add(f.homeId); busy.add(f.awayId) }
    for (const host of hosts) {
      if (busy.has(host)) continue
      const idle = NATION_DEFS.map((n) => n.id).filter((id) => id !== host && !busy.has(id) && !hosts.includes(id))
      if (!idle.length) continue
      const opp = rng.pick(idle)
      busy.add(opp)
      busy.add(host)
      const [homeId, awayId] = di % 2 === 0 ? [host, opp] : [opp, host]
      friendlies.push({ id: fixtureId(fid, di, friendlies.length), compId: fid, round: di, week: d.week, day: d.day, homeId, awayId, result: null })
    }
  })
  if (friendlies.length) {
    comps.push({
      id: fid, type: 'international', name: { ...FRIENDLY_NAME }, season, countryId: null, leagueId: null,
      participantIds: [...new Set(friendlies.flatMap((f) => [f.homeId, f.awayId]))], fixtures: friendlies, table: null, alive: null, winnerId: null,
      meta: { format: 'nt_friendly', level: 'A' },
    })
  }
  for (const c of comps) world.competitions[c.id] = c
  return comps
}

/** Teams of each group sorted by standing. */
export function groupStandings(comp: Competition): string[][] {
  const groups = comp.meta?.groups ?? [comp.participantIds]
  const rows = comp.table ?? []
  return groups.map((g) => {
    const ids = new Set(g)
    const fx = comp.fixtures.filter((f) => (comp.meta?.groups ? f.group !== undefined && ids.has(f.homeId) : true))
    return sortTable(rows.filter((r) => ids.has(r.clubId)), fx).map((r) => r.clubId)
  })
}

/** Qualified teams of a finished qualifying competition (group winners first, then best runners-up…). */
export function qualifiers(comp: Competition): string[] {
  const standings = groupStandings(comp)
  const rowOf = new Map((comp.table ?? []).map((r) => [r.clubId, r]))
  const ranked: { id: string; pos: number }[] = []
  standings.forEach((g) => g.forEach((id, pos) => ranked.push({ id, pos })))
  ranked.sort((a, b) => {
    if (a.pos !== b.pos) return a.pos - b.pos
    const ra = rowOf.get(a.id)
    const rb = rowOf.get(b.id)
    // Normalise by games played (groups of different sizes).
    const ppg = (r: typeof ra) => (r && r.p ? r.pts / r.p : 0)
    const gdg = (r: typeof ra) => (r && r.p ? (r.gf - r.ga) / r.p : 0)
    return ppg(rb) - ppg(ra) || gdg(rb) - gdg(ra) || byReputation(a.id, b.id)
  })
  return ranked.slice(0, comp.meta?.slots ?? 7).map((r) => r.id)
}

/** Create the finals tournament from a finished qualifying competition. */
export function createFinalsCompetition(world: World, rng: Rng, qual: Competition): Competition {
  const key = (qual.meta?.key ?? 'nt:WORLD').replace('nt:', '') as 'EU' | 'OC' | 'WORLD'
  const id = finalsCompId(qual.season, key)
  const existing = world.competitions[id]
  if (existing) return existing
  const host = qual.meta?.hostId ?? qual.participantIds[0]
  const quals = qualifiers(qual)
  const teams = [host, ...quals]
  const name = NATIONAL_TOURNAMENT_NAMES[key]
  const comp: Competition = {
    id, type: 'international', name: { ...name }, season: qual.season, countryId: null, leagueId: null,
    participantIds: teams, fixtures: [], table: createTable(teams), alive: [...teams], winnerId: null,
    meta: { format: 'nt_finals', hostId: host, key: `nt:${key}`, level: 'A', draws: [] },
  }
  const neutralFor = (h: string, a: string) => (h !== host && a !== host ? { neutral: true } : {})
  if (teams.length >= 8) {
    // Pot 1: host (group A) + best qualifier (group B); the rest snake-seeded in pots of two.
    const rest = quals.slice(1).sort(byReputation)
    const groups: string[][] = [[host], [quals[0]]]
    for (let i = 0; i + 1 < rest.length; i += 2) {
      const pair = rng.shuffle([rest[i], rest[i + 1]])
      groups[0].push(pair[0])
      groups[1].push(pair[1])
    }
    if (rest.length % 2 === 1) groups[0].push(rest[rest.length - 1])
    comp.meta!.groups = groups
    comp.meta!.koFrom = 3
    comp.participantIds = groups.flat()
    comp.table = createTable(comp.participantIds)
    groups.forEach((group, g) => {
      // Host always plays at home; other games are on neutral ground.
      roundRobin(group).forEach((pairs, r) => {
        const d = NATIONAL_FINALS_DATES[r]
        pairs.forEach(([a, b], i) => {
          const [h, aw] = b === host ? [b, a] : [a, b]
          comp.fixtures.push({ id: fixtureId(id, r, g * 2 + i), compId: id, round: r, group: g, week: d.week, day: d.day, homeId: h, awayId: aw, result: null, ...neutralFor(h, aw) })
        })
      })
    })
  } else {
    comp.meta!.koFrom = 0
    const seeds = [host, ...quals]
    const pairs: [string, string][] = [[seeds[0], seeds[3]], [seeds[1], seeds[2]]].filter((p) => p[0] && p[1]) as [string, string][]
    const d = NATIONAL_FINALS_DATES[3]
    pairs.forEach(([h, a], i) => comp.fixtures.push({ id: fixtureId(id, 0, i), compId: id, round: 0, week: d.week, day: d.day, homeId: h, awayId: a, result: null, ...neutralFor(h, a) }))
    comp.meta!.draws!.push({ round: 0, week: d.week, pairs })
  }
  world.competitions[id] = comp
  return comp
}

function maxRound(comp: Competition): number {
  let m = -1
  for (const f of comp.fixtures) if (f.round > m) m = f.round
  return m
}

/** Push the champion of an international competition into the honours list. */
function recordNationalHonour(world: World, comp: Competition): void {
  if (!comp.winnerId) return
  world.honours.push({ season: comp.season, compKey: comp.meta?.key ?? comp.id, name: { ...comp.name }, winnerId: comp.winnerId, ...(comp.meta?.hostId ? { hostId: comp.meta.hostId } : {}) } as World['honours'][number])
}

/**
 * Advance an international competition once its current round is complete:
 * crown youth-league winners, create the finals from the qualifiers, draw the
 * finals knockout rounds and crown the champion. Returns true if anything changed.
 */
export function advanceNationalCompetition(world: World, rng: Rng, comp: Competition): boolean {
  if (comp.type !== 'international' || comp.winnerId) return false
  if (comp.fixtures.length === 0 || comp.fixtures.some((f) => !f.result)) return false
  const format = comp.meta?.format
  if (format === 'nt_youth') {
    comp.winnerId = sortTable(comp.table ?? [], comp.fixtures)[0]?.clubId ?? null
    recordNationalHonour(world, comp)
    return true
  }
  if (format === 'nt_qual') {
    const key = (comp.meta?.key ?? 'nt:WORLD').replace('nt:', '')
    if (world.competitions[finalsCompId(comp.season, key)]) return false
    createFinalsCompetition(world, rng, comp)
    return true
  }
  if (format !== 'nt_finals') return false
  const host = comp.meta?.hostId
  const koFrom = comp.meta?.koFrom ?? 0
  const current = maxRound(comp)
  const neutralFor = (h: string, a: string) => (h !== host && a !== host ? { neutral: true } : {})
  const datesFor = (round: number) => NATIONAL_FINALS_DATES[Math.min(NATIONAL_FINALS_DATES.length - 1, round - koFrom + 3)]
  if (current < koFrom) {
    if (current < koFrom - 1) return false
    const st = groupStandings(comp)
    comp.alive = st.flatMap((g) => g.slice(0, 2))
    const pairs: [string, string][] = st.length >= 2 ? [[st[0][0], st[1][1]], [st[1][0], st[0][1]]] : [[st[0][0], st[0][1]]]
    const d = datesFor(koFrom)
    pairs.forEach(([a, b], i) => {
      const [h, aw] = b === host ? [b, a] : [a, b]
      comp.fixtures.push({ id: fixtureId(comp.id, koFrom, i), compId: comp.id, round: koFrom, week: d.week, day: d.day, homeId: h, awayId: aw, result: null, ...neutralFor(h, aw) })
    })
    comp.meta = { ...comp.meta, draws: [...(comp.meta?.draws ?? []), { round: koFrom, week: d.week, pairs }] }
    return true
  }
  const alive = comp.alive ?? []
  if (alive.length <= 1) {
    comp.winnerId = alive[0] ?? null
    recordNationalHonour(world, comp)
    return true
  }
  const next = current + 1
  const d = datesFor(next)
  // Bracket order: winners of tie 0 and tie 1 meet.
  const winners = comp.fixtures.filter((f) => f.round === current).sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((f) => tieWinner(comp, f) ?? f.homeId)
  const pairs: [string, string][] = []
  for (let i = 0; i + 1 < winners.length; i += 2) pairs.push([winners[i], winners[i + 1]])
  pairs.forEach(([a, b], i) => {
    const [h, aw] = b === host ? [b, a] : [a, b]
    comp.fixtures.push({ id: fixtureId(comp.id, next, i), compId: comp.id, round: next, week: d.week, day: d.day, homeId: h, awayId: aw, result: null, ...neutralFor(h, aw) })
  })
  comp.meta = { ...comp.meta, draws: [...(comp.meta?.draws ?? []), { round: next, week: d.week, pairs }] }
  return true
}

// ───────────────────────── Quick sim ─────────────────────────

/** Simulate one AI international and apply it (table / knockout / caps & goals). */
export function playNationalFixture(world: World, rng: Rng, comp: Competition, f: Fixture, excludeIds?: ReadonlySet<string>): QuickSimDetail | null {
  const hp = parseTeamId(f.homeId)
  const ap = parseTeamId(f.awayId)
  if (!hp || !ap) return null
  const home = nationalTeamPlayers(world, f.homeId, comp.season)
  const away = nationalTeamPlayers(world, f.awayId, comp.season)
  const detail = quickSimLineups(
    rng, world,
    { lineup: selectLineupFromPlayers(home, nationFormation(hp.nationId), excludeIds), style: nationStyle(hp.nationId) },
    { lineup: selectLineupFromPlayers(away, nationFormation(ap.nationId), excludeIds), style: nationStyle(ap.nationId) },
    { knockout: isDecisiveFixture(comp, f), neutral: isNeutralFixture(comp, f) },
  )
  applyFixtureResult(comp, f, detail.result)
  if (hp.level === 'A') recordInternationalStats(world, [...detail.homeLineup.playerIds, ...detail.awayLineup.playerIds], detail.result.scorers)
  return detail
}

/** Senior caps and goals of the current award year (NPC and generated players). */
export function recordInternationalStats(world: World, playedIds: readonly string[], scorers: readonly { playerId: string; ownGoal?: boolean }[]): void {
  const nat = ensureNational(world)
  for (const id of playedIds) {
    if (id === 'hero') continue
    const s = nat.stats[id] ?? [0, 0]
    s[0]++
    nat.stats[id] = s
  }
  for (const g of scorers) {
    if (g.ownGoal || g.playerId === 'hero') continue
    const s = nat.stats[g.playerId] ?? [0, 0]
    s[1]++
    nat.stats[g.playerId] = s
  }
}

/** Squad member's international caps/goals this award year. */
export function internationalStats(world: World, playerId: string): { caps: number; goals: number } {
  const s = world.national?.stats[playerId]
  return { caps: s?.[0] ?? 0, goals: s?.[1] ?? 0 }
}

/** Start a new award year for international stats (called at the end of the club season). */
export function resetInternationalStats(world: World): void {
  const nat = ensureNational(world)
  nat.stats = {}
}

/** International competitions of a season. */
export function nationalCompetitions(world: World, season: number): Competition[] {
  return Object.values(world.competitions).filter((c) => c.type === 'international' && c.season === season)
}

/** Next unplayed international fixture of a team at or after (week, day) of `season`. */
export function nextNationalFixture(world: World, teamId: string, season: number, week: number, day: number): { competition: Competition; fixture: Fixture } | null {
  let best: { competition: Competition; fixture: Fixture } | null = null
  for (const comp of nationalCompetitions(world, season)) {
    for (const f of comp.fixtures) {
      if (f.result || (f.homeId !== teamId && f.awayId !== teamId)) continue
      if (f.week < week || (f.week === week && f.day < day)) continue
      if (!best || f.week < best.fixture.week || (f.week === best.fixture.week && f.day < best.fixture.day)) best = { competition: comp, fixture: f }
    }
  }
  return best
}

/** Champions of national tournaments (newest first). */
export function nationalHonours(world: World): { season: number; key: string; name: LText; winnerId: string }[] {
  return world.honours.filter((h) => h.compKey.startsWith('nt:')).map((h) => ({ season: h.season, key: h.compKey, name: h.name, winnerId: h.winnerId })).reverse()
}
