/**
 * Competition creation (league, national cup, continental cup) and knockout
 * draws. All mutations are on the passed World; randomness goes through Rng.
 *
 * Conventions:
 *  - League comp:       id `L-<season>-<leagueId>`, table = all clubs.
 *  - National cup:      id `C-<season>-<countryId>`, single-leg knockout with
 *                       first-round byes for top-tier clubs when the field is
 *                       not a power of two. Lower-tier club hosts.
 *  - Continental cup:   id `X-<season>`. `participantIds` are stored group by
 *                       group (group g = participantIds[4g .. 4g+3]); one shared
 *                       `table` holds every group row. Rounds 0..5 are group
 *                       matchdays, rounds ≥ 6 are single-leg knockouts (final at
 *                       a neutral venue).
 *  - `alive` lists clubs still in a knockout competition; `winnerId` is set
 *    when the competition is decided (leagues: when all fixtures are played).
 */
import type { Club, Competition, Fixture, MatchResultSummary, World } from '../../core/types'
import type { Rng } from '../../core/rng'
import { COUNTRY_BY_ID, CONTINENTAL_CUP_NAME } from '../../data/world/countries'
import {
  CONTINENTAL_DAY, CONTINENTAL_GROUP_ROUNDS, CONTINENTAL_GROUP_WEEKS, CUP_DAY, CUP_WEEKS,
  buildLeagueFixtures, continentalKoWeek, cupRoundWeek, doubleRoundRobin, fixtureId,
} from './fixtures'
import { applyResultToTable, createTable, sortTable } from './table'

export const CONTINENTAL_GROUP_SIZE = 4
export const CONTINENTAL_MAX_GROUPS = 8
export const CONTINENTAL_MAX_PER_COUNTRY = 4
/** Largest cup field supported by the calendar (2^7 = 7 rounds). */
export const MAX_CUP_PARTICIPANTS = 1 << CUP_WEEKS.length

export const leagueCompId = (season: number, leagueId: string) => `L-${season}-${leagueId}`
export const cupCompId = (season: number, countryId: string) => `C-${season}-${countryId}`
export const continentalCompId = (season: number) => `X-${season}`

/** Stable key used in `World.honours` (independent of season). */
export function honourKey(comp: Competition): string {
  if (comp.type === 'league') return comp.leagueId ?? comp.id
  if (comp.type === 'cup') return `cup:${comp.countryId}`
  return comp.type
}

// ───────────────────────── Helpers ─────────────────────────

function tierOf(world: World, club: Club): number {
  return world.leagues[club.leagueId]?.tier ?? 99
}

function highestPowerOfTwo(n: number): number {
  let p = 1
  while (p * 2 <= n) p *= 2
  return p
}

/** Number of rounds a knockout cup of `n` entrants needs. */
export function cupTotalRounds(n: number): number {
  return n <= 1 ? 0 : Math.ceil(Math.log2(n))
}

/** Winning side of a played fixture ('home' on level scores without penalties). */
export function fixtureWinner(result: MatchResultSummary): 'home' | 'away' | 'draw' {
  if (result.home !== result.away) return result.home > result.away ? 'home' : 'away'
  if (result.penalties) return result.penalties.home >= result.penalties.away ? 'home' : 'away'
  return 'draw'
}

/** True when this fixture must produce a winner (cup ties, continental KO rounds). */
export function isKnockoutFixture(comp: Competition, fixture: Fixture): boolean {
  return comp.type === 'cup' || (comp.type === 'continental' && fixture.round >= CONTINENTAL_GROUP_ROUNDS)
}

/** True for the last match of a knockout competition (played at a neutral venue). */
export function isFinalFixture(comp: Competition, fixture: Fixture): boolean {
  if (!isKnockoutFixture(comp, fixture)) return false
  return fixture.round === finalRound(comp)
}

/** Round index of the final of a knockout competition (-1 for leagues). */
export function finalRound(comp: Competition): number {
  if (comp.type === 'cup') return cupTotalRounds(comp.participantIds.length) - 1
  if (comp.type === 'continental') {
    const groupsCount = comp.participantIds.length / CONTINENTAL_GROUP_SIZE
    return CONTINENTAL_GROUP_ROUNDS + Math.log2(groupsCount * 2) - 1
  }
  return -1
}

function maxRound(comp: Competition): number {
  let m = -1
  for (const f of comp.fixtures) if (f.round > m) m = f.round
  return m
}

// ───────────────────────── Creation ─────────────────────────

function createLeagueCompetition(world: World, rng: Rng, season: number, leagueId: string): Competition {
  const league = world.leagues[leagueId]
  const id = leagueCompId(season, leagueId)
  return {
    id, type: 'league', name: { tr: league.name, en: league.name }, season,
    countryId: league.countryId, leagueId, participantIds: [...league.clubIds],
    fixtures: buildLeagueFixtures(rng, id, league.clubIds), table: createTable(league.clubIds), alive: null, winnerId: null,
  }
}

function createCupCompetition(world: World, rng: Rng, season: number, countryId: string): Competition {
  const clubs = Object.values(world.leagues)
    .filter((l) => l.countryId === countryId)
    .sort((a, b) => a.tier - b.tier)
    .flatMap((l) => l.clubIds)
    .slice(0, MAX_CUP_PARTICIPANTS)
  const def = COUNTRY_BY_ID[countryId]
  const comp: Competition = {
    id: cupCompId(season, countryId), type: 'cup',
    name: def ? { ...def.cupName } : { tr: `${countryId} Kupası`, en: `${countryId} Cup` },
    season, countryId, leagueId: null, participantIds: clubs, fixtures: [], table: null, alive: [...clubs], winnerId: null,
  }
  drawKnockoutRound(world, comp, rng, 0)
  return comp
}

/**
 * Pick continental entrants: every country gets one slot, extra slots go
 * round-robin by country reputation (max 4 per country). Within a country,
 * clubs are ranked by last season's top-league table when available,
 * otherwise by club reputation.
 */
export function selectContinentalClubs(world: World, season: number): string[] {
  const countries = Object.values(world.countries).sort((a, b) => b.reputation - a.reputation || (a.id < b.id ? -1 : 1))
  const ranked = new Map<string, string[]>()
  for (const c of countries) ranked.set(c.id, rankTopLeagueClubs(world, c.id, season - 1))
  const capacity = countries.reduce((s, c) => s + Math.min(CONTINENTAL_MAX_PER_COUNTRY, ranked.get(c.id)?.length ?? 0), 0)
  const groups = Math.min(CONTINENTAL_MAX_GROUPS, highestPowerOfTwo(Math.max(1, Math.floor(capacity / CONTINENTAL_GROUP_SIZE))))
  const target = Math.min(capacity, groups * CONTINENTAL_GROUP_SIZE)

  const slots = new Map<string, number>(countries.map((c) => [c.id, 0]))
  let total = 0
  while (total < target) {
    let progressed = false
    for (const c of countries) {
      if (total >= target) break
      const have = slots.get(c.id) as number
      if (have < CONTINENTAL_MAX_PER_COUNTRY && have < (ranked.get(c.id)?.length ?? 0)) {
        slots.set(c.id, have + 1)
        total++
        progressed = true
      }
    }
    if (!progressed) break
  }
  const out: string[] = []
  for (const c of countries) out.push(...(ranked.get(c.id) ?? []).slice(0, slots.get(c.id)))
  return out
}

function rankTopLeagueClubs(world: World, countryId: string, prevSeason: number): string[] {
  const top = Object.values(world.leagues).find((l) => l.countryId === countryId && l.tier === 1)
  if (!top) return []
  const prev = world.competitions[leagueCompId(prevSeason, top.id)]
  if (prev?.table) {
    const order = sortTable(prev.table, prev.fixtures).map((r) => r.clubId).filter((id) => world.clubs[id])
    const rest = top.clubIds.filter((id) => !order.includes(id))
    return [...order, ...rest]
  }
  return [...top.clubIds].sort((a, b) => world.clubs[b].reputation - world.clubs[a].reputation || (a < b ? -1 : 1))
}

/** Seeded group draw: pots by reputation, avoiding same-country clubs in a group where possible. */
function drawGroups(world: World, rng: Rng, entrants: readonly string[]): string[][] {
  const groupsCount = entrants.length / CONTINENTAL_GROUP_SIZE
  const byRep = [...entrants].sort((a, b) => world.clubs[b].reputation - world.clubs[a].reputation || (a < b ? -1 : 1))
  const groups: string[][] = Array.from({ length: groupsCount }, () => [])
  for (let pot = 0; pot < CONTINENTAL_GROUP_SIZE; pot++) {
    const potClubs = rng.shuffle(byRep.slice(pot * groupsCount, (pot + 1) * groupsCount))
    for (const g of groups) {
      const countries = new Set(g.map((id) => world.clubs[id].countryId))
      let idx = potClubs.findIndex((id) => !countries.has(world.clubs[id].countryId))
      if (idx < 0) idx = 0
      g.push(potClubs.splice(idx, 1)[0])
    }
  }
  return groups
}

function createContinentalCompetition(world: World, rng: Rng, season: number): Competition | null {
  const entrants = selectContinentalClubs(world, season)
  if (entrants.length < CONTINENTAL_GROUP_SIZE) return null
  const groups = drawGroups(world, rng, entrants)
  const id = continentalCompId(season)
  const fixtures: Fixture[] = []
  groups.forEach((group, g) => {
    doubleRoundRobin(group).forEach((pairs, round) => {
      pairs.forEach(([homeId, awayId], i) => {
        fixtures.push({
          id: fixtureId(id, round, g * 2 + i), compId: id, round,
          week: CONTINENTAL_GROUP_WEEKS[round], day: CONTINENTAL_DAY, homeId, awayId, result: null,
        })
      })
    })
  })
  const participantIds = groups.flat()
  return {
    id, type: 'continental', name: { ...CONTINENTAL_CUP_NAME }, season, countryId: null, leagueId: null,
    participantIds, fixtures, table: createTable(participantIds), alive: [...participantIds], winnerId: null,
  }
}

/**
 * Create every competition (leagues, national cups, continental cup) for a
 * season, with their opening fixtures, and register them in `world.competitions`.
 */
export function createSeasonCompetitions(world: World, rng: Rng, season: number): Competition[] {
  const comps: Competition[] = []
  for (const leagueId of Object.keys(world.leagues)) comps.push(createLeagueCompetition(world, rng, season, leagueId))
  for (const countryId of Object.keys(world.countries)) comps.push(createCupCompetition(world, rng, season, countryId))
  const cont = createContinentalCompetition(world, rng, season)
  if (cont) comps.push(cont)
  for (const c of comps) world.competitions[c.id] = c
  return comps
}

// ───────────────────────── Groups ─────────────────────────

/** Continental groups as arrays of club ids, each sorted by current standing. */
export function continentalGroups(comp: Competition): string[][] {
  const out: string[][] = []
  const rows = comp.table ?? []
  for (let i = 0; i < comp.participantIds.length; i += CONTINENTAL_GROUP_SIZE) {
    const ids = new Set(comp.participantIds.slice(i, i + CONTINENTAL_GROUP_SIZE))
    const groupRows = rows.filter((r) => ids.has(r.clubId))
    const groupFixtures = comp.fixtures.filter((f) => f.round < CONTINENTAL_GROUP_ROUNDS && ids.has(f.homeId))
    out.push(sortTable(groupRows, groupFixtures).map((r) => r.clubId))
  }
  return out
}

// ───────────────────────── Knockout draws ─────────────────────────

function cupRoundFixtures(world: World, comp: Competition, rng: Rng, round: number): Fixture[] {
  const alive = comp.alive ?? []
  const totalRounds = cupTotalRounds(comp.participantIds.length)
  let playing = [...alive]
  if (round === 0) {
    const p = highestPowerOfTwo(alive.length)
    if (p !== alive.length) {
      // Top-tier / most reputable clubs get byes; the rest play a preliminary round.
      const order = [...alive].sort((a, b) => {
        const ca = world.clubs[a]
        const cb = world.clubs[b]
        return tierOf(world, cb) - tierOf(world, ca) || ca.reputation - cb.reputation || (a < b ? -1 : 1)
      })
      playing = order.slice(0, 2 * (alive.length - p))
    }
  }
  rng.shuffle(playing)
  const week = cupRoundWeek(round, totalRounds)
  const fixtures: Fixture[] = []
  for (let i = 0; i + 1 < playing.length; i += 2) {
    let [homeId, awayId] = [playing[i], playing[i + 1]]
    // Giant-killing tradition: the lower-tier club hosts.
    if (tierOf(world, world.clubs[awayId]) > tierOf(world, world.clubs[homeId])) [homeId, awayId] = [awayId, homeId]
    fixtures.push({ id: fixtureId(comp.id, round, i / 2), compId: comp.id, round, week, day: CUP_DAY, homeId, awayId, result: null })
  }
  return fixtures
}

function continentalKoFixtures(comp: Competition, rng: Rng, round: number): Fixture[] {
  const koRound = round - CONTINENTAL_GROUP_ROUNDS
  const groupsCount = comp.participantIds.length / CONTINENTAL_GROUP_SIZE
  const totalKo = Math.log2(groupsCount * 2)
  const week = continentalKoWeek(koRound, totalKo)
  const pairs: [string, string][] = []
  if (koRound === 0 && groupsCount > 1) {
    // Group winners host runners-up from a different group.
    const groups = continentalGroups(comp)
    const offset = rng.int(0, groupsCount - 2)
    for (let g = 0; g < groupsCount; g++) pairs.push([groups[g][0], groups[(g + 1 + offset) % groupsCount][1]])
  } else {
    const alive = rng.shuffle([...(comp.alive ?? [])])
    for (let i = 0; i + 1 < alive.length; i += 2) pairs.push([alive[i], alive[i + 1]])
  }
  return pairs.map(([homeId, awayId], i) => ({
    id: fixtureId(comp.id, round, i), compId: comp.id, round, week, day: CONTINENTAL_DAY, homeId, awayId, result: null,
  }))
}

/** Draw and append the fixtures of knockout round `round` from `comp.alive`. */
export function drawKnockoutRound(world: World, comp: Competition, rng: Rng, round: number): Fixture[] {
  const fixtures = comp.type === 'cup' ? cupRoundFixtures(world, comp, rng, round) : continentalKoFixtures(comp, rng, round)
  comp.fixtures.push(...fixtures)
  return fixtures
}

// ───────────────────────── Results & progression ─────────────────────────

/**
 * Store a fixture result and update the competition state (table rows for
 * leagues/groups, `alive` for knockout ties). Does not draw new rounds; call
 * {@link advanceCompetition} afterwards.
 */
export function applyFixtureResult(comp: Competition, fixture: Fixture, result: MatchResultSummary): void {
  fixture.result = result
  if (isKnockoutFixture(comp, fixture)) {
    const loser = fixtureWinner(result) === 'away' ? fixture.homeId : fixture.awayId
    if (comp.alive) comp.alive = comp.alive.filter((id) => id !== loser)
  } else if (comp.table) {
    applyResultToTable(comp.table, fixture.homeId, fixture.awayId, result.home, result.away)
  }
}

/**
 * Move a competition forward once its current round is complete: settle the
 * league winner, qualify continental group teams, draw the next knockout round
 * or crown the cup winner. Returns true if anything changed.
 */
export function advanceCompetition(world: World, comp: Competition, rng: Rng): boolean {
  if (comp.winnerId) return false
  const current = maxRound(comp)
  if (current < 0) return false
  // Only the current round is ever drawn, so "everything played" == "round complete".
  if (comp.fixtures.some((f) => !f.result)) return false

  if (comp.type === 'league') {
    comp.winnerId = sortTable(comp.table ?? [], comp.fixtures)[0]?.clubId ?? null
    return true
  }
  if (comp.type === 'continental' && current < CONTINENTAL_GROUP_ROUNDS) {
    if (current < CONTINENTAL_GROUP_ROUNDS - 1) return false
    comp.alive = continentalGroups(comp).flatMap((g) => g.slice(0, 2))
    drawKnockoutRound(world, comp, rng, current + 1)
    return true
  }
  const alive = comp.alive ?? []
  if (alive.length <= 1) {
    comp.winnerId = alive[0] ?? null
    return true
  }
  drawKnockoutRound(world, comp, rng, current + 1)
  return true
}
