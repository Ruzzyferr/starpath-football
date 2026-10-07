/**
 * Competition creation (league, national cup, continental cup, promotion
 * play-offs) and knockout draws. All mutations are on the passed World;
 * randomness goes through Rng.
 *
 * Conventions:
 *  - League comp:       id `L-<season>-<leagueId>`, table = all clubs. Tier ≥ 2
 *                       leagues end by week 39; positions after the automatic
 *                       promotion places play a play-off (`P-<season>-<leagueId>`).
 *  - National cup:      id `C-<season>-<countryId>`, single-leg knockout with
 *                       first-round byes for top-tier clubs when the field is
 *                       not a power of two. Early rounds are seeded (higher
 *                       tier vs lower tier) and the lower-tier club hosts.
 *  - Continental cup:   id `X-<season>`. Places per country come from the
 *                       coefficient ranking (coefficients.ts); the weakest
 *                       entrants play a two-legged qualifying round
 *                       (`XQ-<season>`, weeks 1–2) whose winners join the
 *                       group draw. `participantIds` are stored group by group
 *                       (group g = participantIds[4g .. 4g+3]); one shared
 *                       `table` holds every group row. Rounds 0..5 are group
 *                       matchdays, rounds ≥ 6 are knockouts: two legs (same
 *                       round, `leg` 1/2, aggregate, no away-goals rule, extra
 *                       time and penalties in the second leg), single final at
 *                       a neutral venue.
 *  - `alive` lists clubs still in a knockout competition; `winnerId` is set
 *    when the competition is decided (leagues: when all fixtures are played).
 *  - `meta.draws` keeps every knockout draw for the draw screen.
 */
import type { Club, Competition, Fixture, MatchResultSummary, World } from '../../core/types'
import type { Rng } from '../../core/rng'
import { COUNTRY_BY_ID, CONTINENTAL_CUP_NAME } from '../../data/world/countries'
import { CONTINENTAL_QUALIFYING_NAME, PLAYOFF_NAME } from '../../data/world/nations'
import { coefficientRanking } from './coefficients'
import {
  CONTINENTAL_DAY, CONTINENTAL_GROUP_ROUNDS, CONTINENTAL_GROUP_WEEKS, CONTINENTAL_QUALIFYING_WEEKS, CUP_DAY, CUP_WEEKS,
  LOWER_TIER_LAST_WEEK, PLAYOFF_DAY, PLAYOFF_WEEKS,
  buildLeagueFixtures, continentalKoLegs, cupRoundWeek, doubleRoundRobin, fixtureId,
} from './fixtures'
import { applyResultToTable, createTable, sortTable } from './table'
import type { DrawRecord } from './worldTypes'

export const CONTINENTAL_GROUP_SIZE = 4
export const CONTINENTAL_MAX_GROUPS = 8
export const CONTINENTAL_MAX_PER_COUNTRY = 5
/** Largest cup field supported by the calendar (2^7 = 7 rounds). */
export const MAX_CUP_PARTICIPANTS = 1 << CUP_WEEKS.length
/** Continental places (group stage or qualifying) by coefficient rank (index = rank; last entry repeats). */
export const CONTINENTAL_DIRECT_SLOTS: readonly number[] = [4, 4, 3, 3, 3, 2, 2, 2, 1]
/** Share of the group stage filled directly; the rest comes through the qualifying round. */
export const CONTINENTAL_DIRECT_SHARE = 0.75
/** Countries in the coefficient top N send one extra league club to the qualifying round. */
export const CONTINENTAL_EXTRA_QUALIFIER_RANKS = 4
/** Teams in a promotion play-off (3rd–6th with two automatic places). */
export const PLAYOFF_TEAMS = 4

export const leagueCompId = (season: number, leagueId: string) => `L-${season}-${leagueId}`
export const cupCompId = (season: number, countryId: string) => `C-${season}-${countryId}`
export const continentalCompId = (season: number) => `X-${season}`
export const continentalQualifyingCompId = (season: number) => `XQ-${season}`
export const playoffCompId = (season: number, leagueId: string) => `P-${season}-${leagueId}`

/** Stable key used in `World.honours` (independent of season). */
export function honourKey(comp: Competition): string {
  if (comp.meta?.key) return comp.meta.key
  if (comp.type === 'league') return comp.leagueId ?? comp.id
  if (comp.type === 'cup') return `cup:${comp.countryId}`
  return comp.type
}

/** Competitions that crown nobody (qualifying rounds, qualifying groups, friendlies). */
export function isQualifyingComp(comp: Competition): boolean {
  const f = comp.meta?.format
  return f === 'continental_q' || f === 'nt_qual' || f === 'nt_friendly'
}

// ───────────────────────── Helpers ─────────────────────────

function tierOf(world: World, club: Club | undefined): number {
  return club ? world.leagues[club.leagueId]?.tier ?? 99 : 99
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

/** True when this fixture belongs to a knockout tie (single leg or one leg of two). */
export function isKnockoutFixture(comp: Competition, fixture: Fixture): boolean {
  if (comp.type === 'cup') return true
  if (comp.type === 'continental') return comp.meta?.format === 'continental_q' || fixture.round >= CONTINENTAL_GROUP_ROUNDS
  if (comp.type === 'international') return comp.meta?.format === 'nt_finals' && fixture.round >= (comp.meta.koFrom ?? 0)
  return false
}

/**
 * True when a level score after 90' must be settled on the day: single-leg
 * knockout ties (extra time + penalties). Second legs are settled on aggregate
 * (see {@link firstLegOf}); first legs may end level.
 */
export function isDecisiveFixture(comp: Competition, fixture: Fixture): boolean {
  return isKnockoutFixture(comp, fixture) && !fixture.leg
}

/** True for the last match of a knockout competition (played at a neutral venue). */
export function isFinalFixture(comp: Competition, fixture: Fixture): boolean {
  if (!isKnockoutFixture(comp, fixture)) return false
  return fixture.round === finalRound(comp)
}

/** Neutral venue: finals, or fixtures flagged neutral (tournament games). */
export function isNeutralFixture(comp: Competition, fixture: Fixture): boolean {
  return !!fixture.neutral || isFinalFixture(comp, fixture)
}

/** Round index of the final of a knockout competition (-1 when there is none). */
export function finalRound(comp: Competition): number {
  if (comp.type === 'cup') return cupTotalRounds(comp.participantIds.length) - 1
  if (comp.type === 'continental') {
    if (comp.meta?.format === 'continental_q') return -1
    const groupsCount = Math.max(1, comp.participantIds.length / CONTINENTAL_GROUP_SIZE)
    return CONTINENTAL_GROUP_ROUNDS + Math.log2(groupsCount * 2) - 1
  }
  if (comp.type === 'international' && comp.meta?.format === 'nt_finals') {
    const koTeams = comp.meta.groups ? comp.meta.groups.length * 2 : comp.participantIds.length
    return (comp.meta.koFrom ?? 0) + Math.log2(Math.max(2, koTeams)) - 1
  }
  return -1
}

function maxRound(comp: Competition): number {
  let m = -1
  for (const f of comp.fixtures) if (f.round > m) m = f.round
  return m
}

/** First leg of a second-leg fixture (null for single-leg ties). */
export function firstLegOf(comp: Competition, fixture: Fixture): Fixture | null {
  if (fixture.leg !== 2) return null
  return comp.fixtures.find((f) => f.round === fixture.round && f.tie === fixture.tie && f.leg === 1) ?? null
}

/** Second leg of a first-leg fixture. */
export function secondLegOf(comp: Competition, fixture: Fixture): Fixture | null {
  if (fixture.leg !== 1) return null
  return comp.fixtures.find((f) => f.round === fixture.round && f.tie === fixture.tie && f.leg === 2) ?? null
}

/**
 * Goals already scored in the first leg, from the second-leg fixture's point of
 * view: `home` = first-leg goals of the second leg's home team.
 */
export function aggregateBefore(comp: Competition, secondLeg: Fixture): { home: number; away: number } | null {
  const first = firstLegOf(comp, secondLeg)
  if (!first?.result) return null
  return { home: first.result.away, away: first.result.home }
}

/**
 * Winner of a decided tie containing `fixture` (null while undecided). Two
 * legs: aggregate, no away-goals rule, penalties in the second leg.
 */
export function tieWinner(comp: Competition, fixture: Fixture): string | null {
  if (!fixture.leg) {
    if (!fixture.result) return null
    const w = fixtureWinner(fixture.result)
    return w === 'away' ? fixture.awayId : fixture.homeId
  }
  const second = fixture.leg === 2 ? fixture : secondLegOf(comp, fixture)
  const first = fixture.leg === 1 ? fixture : firstLegOf(comp, fixture)
  if (!first?.result || !second?.result) return null
  // Second leg home team = first leg away team.
  const secondHomeAgg = second.result.home + first.result.away
  const secondAwayAgg = second.result.away + first.result.home
  if (secondHomeAgg !== secondAwayAgg) return secondHomeAgg > secondAwayAgg ? second.homeId : second.awayId
  const p = second.result.penalties
  if (p) return p.home >= p.away ? second.homeId : second.awayId
  return second.homeId
}

/** Aggregate score of a two-legged tie as [firstLegHome total, firstLegAway total]. */
export function tieAggregate(comp: Competition, fixture: Fixture): [number, number] | null {
  const first = fixture.leg === 1 ? fixture : firstLegOf(comp, fixture)
  const second = fixture.leg === 2 ? fixture : secondLegOf(comp, fixture)
  if (!first?.result) return null
  const a = first.result.home + (second?.result?.away ?? 0)
  const b = first.result.away + (second?.result?.home ?? 0)
  return [a, b]
}

// ───────────────────────── Creation ─────────────────────────

function createLeagueCompetition(world: World, rng: Rng, season: number, leagueId: string): Competition {
  const league = world.leagues[leagueId]
  const id = leagueCompId(season, leagueId)
  const lastWeek = hasPlayoff(world, leagueId) ? LOWER_TIER_LAST_WEEK : undefined
  return {
    id, type: 'league', name: { tr: league.name, en: league.name }, season,
    countryId: league.countryId, leagueId, participantIds: [...league.clubIds],
    fixtures: buildLeagueFixtures(rng, id, league.clubIds, lastWeek), table: createTable(league.clubIds), alive: null, winnerId: null,
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
    meta: { draws: [] },
  }
  drawKnockoutRound(world, comp, rng, 0)
  return comp
}

/** Clubs of a country's top league ranked by last season's table (or reputation). */
function rankTopLeagueClubs(world: World, countryId: string, prevSeason: number): string[] {
  const top = Object.values(world.leagues).find((l) => l.countryId === countryId && l.tier === 1)
  if (!top) return []
  const prev = world.competitions[leagueCompId(prevSeason, top.id)]
  if (prev?.table) {
    const order = sortTable(prev.table, prev.fixtures).map((r) => r.clubId).filter((id) => top.clubIds.includes(id))
    const rest = top.clubIds.filter((id) => !order.includes(id)).sort((a, b) => world.clubs[b].reputation - world.clubs[a].reputation || (a < b ? -1 : 1))
    return [...order, ...rest]
  }
  return [...top.clubIds].sort((a, b) => world.clubs[b].reputation - world.clubs[a].reputation || (a < b ? -1 : 1))
}

/** Last season's cup winner of a country, if known and still existing. */
function previousCupWinner(world: World, countryId: string, season: number): string | null {
  for (let i = world.honours.length - 1; i >= 0; i--) {
    const h = world.honours[i]
    if (h.season === season - 1 && h.compKey === `cup:${countryId}` && world.clubs[h.winnerId]) return h.winnerId
  }
  return null
}

export interface ContinentalEntrants {
  /** Straight into the group stage, in priority order. */
  direct: string[]
  /** Two-legged qualifying round (even count, seeded order). */
  qualifying: string[]
  groups: number
}

/**
 * Continental places from the coefficient ranking: rank 1–2 → 3 direct places,
 * 3–5 → 2, others 1 (by last season's league position). Last season's cup
 * winner and, for the top 4 countries, the next league club go to the
 * qualifying round, whose winners fill the group stage up to a power-of-two
 * number of groups.
 */
export function selectContinentalEntrants(world: World, season: number): ContinentalEntrants {
  const ranking = coefficientRanking(world)
  const ranked = new Map<string, string[]>()
  for (const r of ranking) ranked.set(r.countryId, rankTopLeagueClubs(world, r.countryId, season - 1))
  const slots = new Map<string, number>()
  ranking.forEach((r, i) => {
    const want = CONTINENTAL_DIRECT_SLOTS[Math.min(i, CONTINENTAL_DIRECT_SLOTS.length - 1)]
    slots.set(r.countryId, Math.min(want, ranked.get(r.countryId)?.length ?? 0, CONTINENTAL_MAX_PER_COUNTRY))
  })
  // Direct places in round-robin priority: every country's champion first, then runners-up…
  const direct: string[] = []
  const maxSlots = Math.max(0, ...slots.values())
  for (let k = 0; k < maxSlots; k++) {
    for (const r of ranking) if ((slots.get(r.countryId) ?? 0) > k) direct.push((ranked.get(r.countryId) ?? [])[k])
  }
  const taken = new Set(direct)
  const perCountry = new Map<string, number>()
  for (const id of direct) perCountry.set(world.clubs[id].countryId, (perCountry.get(world.clubs[id].countryId) ?? 0) + 1)
  const qualPool: string[] = []
  const tryAdd = (id: string | undefined) => {
    if (!id || taken.has(id)) return false
    const c = world.clubs[id]?.countryId
    if (!c || (perCountry.get(c) ?? 0) >= CONTINENTAL_MAX_PER_COUNTRY) return false
    taken.add(id)
    perCountry.set(c, (perCountry.get(c) ?? 0) + 1)
    qualPool.push(id)
    return true
  }
  for (const r of ranking) {
    const cupWinner = previousCupWinner(world, r.countryId, season)
    if (!tryAdd(cupWinner ?? undefined)) {
      // Cup winner already qualified (or unknown): the next league club takes the place.
      const next = (ranked.get(r.countryId) ?? []).find((id) => !taken.has(id))
      tryAdd(next)
    }
  }
  const cupPlaces = qualPool.length
  ranking.slice(0, CONTINENTAL_EXTRA_QUALIFIER_RANKS).forEach((r) => {
    tryAdd((ranked.get(r.countryId) ?? []).find((id) => !taken.has(id)))
  })

  // Group stage = 3/4 direct places + 1/4 qualifying winners (two clubs per tie).
  const total = direct.length + qualPool.length
  const perGroup = CONTINENTAL_GROUP_SIZE * (CONTINENTAL_DIRECT_SHARE + 2 * (1 - CONTINENTAL_DIRECT_SHARE))
  let groups = Math.min(CONTINENTAL_MAX_GROUPS, highestPowerOfTwo(Math.max(1, Math.floor(total / perGroup))))
  for (;;) {
    const need = groups * CONTINENTAL_GROUP_SIZE
    const directCount = Math.min(direct.length, Math.round(need * CONTINENTAL_DIRECT_SHARE))
    // Direct overflow (lowest-priority places) drops into the qualifying round after the cup winners.
    const pool = [...qualPool.slice(0, cupPlaces), ...direct.slice(directCount), ...qualPool.slice(cupPlaces)]
    const winnersNeeded = need - directCount
    if (pool.length >= winnersNeeded * 2 || groups === 1) {
      let qualifying = pool.slice(0, winnersNeeded * 2)
      if (qualifying.length % 2 === 1) qualifying.pop()
      // Too few qualifiers for a full group stage (tiny worlds): extra direct places instead.
      const directOut = direct.slice(0, Math.max(directCount, need - qualifying.length / 2))
      qualifying = qualifying.filter((id) => !directOut.includes(id))
      if (qualifying.length % 2 === 1) qualifying.pop()
      return { direct: directOut, qualifying, groups }
    }
    groups /= 2
  }
}

/** Every continental entrant (group stage + qualifying round). */
export function selectContinentalClubs(world: World, season: number): string[] {
  const e = selectContinentalEntrants(world, season)
  return [...e.direct, ...e.qualifying]
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

/** Draw the continental groups from `comp.participantIds` and schedule the 6 matchdays. */
function startContinentalGroups(world: World, rng: Rng, comp: Competition): void {
  const groups = drawGroups(world, rng, comp.participantIds)
  comp.fixtures = []
  groups.forEach((group, g) => {
    doubleRoundRobin(group).forEach((pairs, round) => {
      pairs.forEach(([homeId, awayId], i) => {
        comp.fixtures.push({
          id: fixtureId(comp.id, round, g * 2 + i), compId: comp.id, round, group: g,
          week: CONTINENTAL_GROUP_WEEKS[round], day: CONTINENTAL_DAY, homeId, awayId, result: null,
        })
      })
    })
  })
  comp.participantIds = groups.flat()
  comp.table = createTable(comp.participantIds)
  comp.alive = [...comp.participantIds]
  comp.meta = { ...comp.meta, groups }
}

function createContinentalCompetitions(world: World, rng: Rng, season: number): Competition[] {
  const entrants = selectContinentalEntrants(world, season)
  if (entrants.direct.length + entrants.qualifying.length / 2 < CONTINENTAL_GROUP_SIZE) return []
  const id = continentalCompId(season)
  const main: Competition = {
    id, type: 'continental', name: { ...CONTINENTAL_CUP_NAME }, season, countryId: null, leagueId: null,
    participantIds: [...entrants.direct], fixtures: [], table: null, alive: [...entrants.direct], winnerId: null,
    meta: { draws: [], twoLegFrom: CONTINENTAL_GROUP_ROUNDS },
  }
  const out: Competition[] = [main]
  if (entrants.qualifying.length >= 2) {
    const qid = continentalQualifyingCompId(season)
    const q: Competition = {
      id: qid, type: 'continental', name: { ...CONTINENTAL_QUALIFYING_NAME }, season, countryId: null, leagueId: null,
      participantIds: [...entrants.qualifying], fixtures: [], table: null, alive: [...entrants.qualifying], winnerId: null,
      meta: { format: 'continental_q', feedsInto: id, draws: [], twoLegFrom: 0, key: 'continental_q' },
    }
    // Seeded: the stronger half (reputation) meets the weaker half; the weaker club hosts the first leg.
    const sorted = [...entrants.qualifying].sort((a, b) => world.clubs[b].reputation - world.clubs[a].reputation || (a < b ? -1 : 1))
    const half = sorted.length / 2
    const seeded = rng.shuffle(sorted.slice(0, half))
    const unseeded = rng.shuffle(sorted.slice(half))
    const pairs: [string, string][] = seeded.map((s, i) => [unseeded[i], s])
    q.fixtures = twoLegFixtures(q, 0, pairs, CONTINENTAL_QUALIFYING_WEEKS, CONTINENTAL_DAY)
    q.meta!.draws!.push({ round: 0, week: CONTINENTAL_QUALIFYING_WEEKS[0], pairs, seeded: sorted.slice(0, half), twoLegged: true })
    out.push(q)
  } else {
    startContinentalGroups(world, rng, main)
  }
  return out
}

/** Does this league have a promotion play-off (tier ≥ 2 with a tier above and ≥ 2 promotion places)? */
export function hasPlayoff(world: World, leagueId: string): boolean {
  const league = world.leagues[leagueId]
  if (!league || league.tier < 2 || league.promote < 2) return false
  const above = Object.values(world.leagues).some((l) => l.countryId === league.countryId && l.tier === league.tier - 1)
  return above && league.clubIds.length >= league.promote - 1 + PLAYOFF_TEAMS
}

/** Automatic promotion places of a league (one place goes to the play-off winner). */
export function autoPromotionPlaces(world: World, leagueId: string): number {
  const league = world.leagues[leagueId]
  if (!league) return 0
  return hasPlayoff(world, leagueId) ? league.promote - 1 : league.promote
}

/**
 * Create the promotion play-off of a finished league: the four clubs after the
 * automatic places; semi-finals (best seed hosts) in week 40, final (neutral)
 * in week 41.
 */
export function createPlayoffCompetition(world: World, league: Competition): Competition | null {
  if (!league.leagueId || !hasPlayoff(world, league.leagueId) || !league.table) return null
  const id = playoffCompId(league.season, league.leagueId)
  if (world.competitions[id]) return world.competitions[id]
  const auto = autoPromotionPlaces(world, league.leagueId)
  const order = sortTable(league.table, league.fixtures).map((r) => r.clubId)
  const field = order.slice(auto, auto + PLAYOFF_TEAMS)
  if (field.length < PLAYOFF_TEAMS) return null
  const lg = world.leagues[league.leagueId]
  const comp: Competition = {
    id, type: 'cup', name: { tr: `${lg.name} ${PLAYOFF_NAME.tr}`, en: `${lg.name} ${PLAYOFF_NAME.en}` }, season: league.season,
    countryId: league.countryId, leagueId: league.leagueId, participantIds: field, fixtures: [], table: null, alive: [...field], winnerId: null,
    meta: { format: 'playoff', key: `playoff:${league.leagueId}`, draws: [] },
  }
  const pairs: [string, string][] = [[field[0], field[3]], [field[1], field[2]]]
  comp.fixtures = pairs.map(([homeId, awayId], i) => ({
    id: fixtureId(id, 0, i), compId: id, round: 0, week: PLAYOFF_WEEKS[0], day: PLAYOFF_DAY, homeId, awayId, result: null,
  }))
  comp.meta!.draws!.push({ round: 0, week: PLAYOFF_WEEKS[0], pairs })
  world.competitions[id] = comp
  return comp
}

/**
 * Create every competition (leagues, national cups, continental cup and its
 * qualifying round) for a season, with their opening fixtures, and register
 * them in `world.competitions`.
 */
export function createSeasonCompetitions(world: World, rng: Rng, season: number): Competition[] {
  const comps: Competition[] = []
  for (const leagueId of Object.keys(world.leagues)) comps.push(createLeagueCompetition(world, rng, season, leagueId))
  for (const countryId of Object.keys(world.countries)) comps.push(createCupCompetition(world, rng, season, countryId))
  comps.push(...createContinentalCompetitions(world, rng, season))
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

/** First + second leg fixtures for `pairs` ([first-leg home, first-leg away]). */
export function twoLegFixtures(comp: Competition, round: number, pairs: readonly [string, string][], weeks: readonly number[], day: number): Fixture[] {
  const out: Fixture[] = []
  pairs.forEach(([a, b], i) => {
    out.push({ id: fixtureId(comp.id, round, i * 2), compId: comp.id, round, leg: 1, tie: i, week: weeks[0], day, homeId: a, awayId: b, result: null })
    out.push({ id: fixtureId(comp.id, round, i * 2 + 1), compId: comp.id, round, leg: 2, tie: i, week: weeks[1], day, homeId: b, awayId: a, result: null })
  })
  return out
}

function recordDraw(comp: Competition, draw: DrawRecord): void {
  comp.meta = comp.meta ?? {}
  comp.meta.draws = [...(comp.meta.draws ?? []), draw].slice(-8)
}

/**
 * Domestic cup draw. Round 0: byes for the top-tier/most reputable clubs when
 * the field is not a power of two. Before the semi-finals the draw is seeded:
 * the higher-tier half meets the lower-tier half. The lower-tier club hosts
 * (same tier: the first club drawn). The final is at a neutral venue.
 */
function cupRoundFixtures(world: World, comp: Competition, rng: Rng, round: number): Fixture[] {
  const alive = comp.alive ?? []
  const totalRounds = cupTotalRounds(comp.participantIds.length)
  const week = comp.meta?.format === 'playoff' ? PLAYOFF_WEEKS[Math.min(round, PLAYOFF_WEEKS.length - 1)] : cupRoundWeek(round, totalRounds)
  const day = comp.meta?.format === 'playoff' ? PLAYOFF_DAY : CUP_DAY
  const isFinal = round === totalRounds - 1
  let playing = [...alive]
  if (round === 0) {
    const p = highestPowerOfTwo(alive.length)
    if (p !== alive.length) {
      // Top-tier / most reputable clubs get byes; the rest play a preliminary round.
      const order = [...alive].sort((a, b) => {
        const ca = world.clubs[a]
        const cb = world.clubs[b]
        return tierOf(world, cb) - tierOf(world, ca) || (ca?.reputation ?? 0) - (cb?.reputation ?? 0) || (a < b ? -1 : 1)
      })
      playing = order.slice(0, 2 * (alive.length - p))
    }
  }
  const pairs: [string, string][] = []
  let seededIds: string[] | undefined
  if (comp.meta?.format === 'playoff') {
    // Play-off final: the two semi-final winners (better seed listed first).
    const seedOf = (id: string) => comp.participantIds.indexOf(id)
    const ordered = [...playing].sort((a, b) => seedOf(a) - seedOf(b))
    for (let i = 0; i + 1 < ordered.length; i += 2) pairs.push([ordered[i], ordered[i + 1]])
  } else {
    const seededRound = round < totalRounds - 2 && playing.length >= 4
    if (seededRound) {
      const byStrength = [...playing].sort((a, b) => {
        const ca = world.clubs[a]
        const cb = world.clubs[b]
        return tierOf(world, ca) - tierOf(world, cb) || (cb?.reputation ?? 0) - (ca?.reputation ?? 0) || (a < b ? -1 : 1)
      })
      const half = byStrength.length / 2
      const seeded = rng.shuffle(byStrength.slice(0, half))
      const unseeded = rng.shuffle(byStrength.slice(half))
      seededIds = byStrength.slice(0, half)
      for (let i = 0; i < seeded.length; i++) pairs.push([unseeded[i], seeded[i]])
    } else {
      rng.shuffle(playing)
      for (let i = 0; i + 1 < playing.length; i += 2) pairs.push([playing[i], playing[i + 1]])
    }
    // Giant-killing tradition: the lower-tier club hosts.
    for (const pr of pairs) {
      if (tierOf(world, world.clubs[pr[1]]) > tierOf(world, world.clubs[pr[0]])) pr.reverse()
    }
  }
  recordDraw(comp, { round, week, pairs: pairs.map((p) => [p[0], p[1]]), seeded: seededIds })
  return pairs.map(([homeId, awayId], i) => ({
    id: fixtureId(comp.id, round, i), compId: comp.id, round, week, day, homeId, awayId, result: null,
    ...(isFinal ? { neutral: true } : {}),
  }))
}

/**
 * Continental knockout draw. First round: group winners meet runners-up of a
 * different group (avoiding same-country ties when possible); the group winner
 * hosts the second leg. Later rounds: open draw. All rounds except the final
 * are two-legged.
 */
function continentalKoFixtures(world: World, comp: Competition, rng: Rng, round: number): Fixture[] {
  const koRound = round - CONTINENTAL_GROUP_ROUNDS
  const groupsCount = comp.participantIds.length / CONTINENTAL_GROUP_SIZE
  const totalKo = Math.log2(groupsCount * 2)
  const legs = continentalKoLegs(koRound, totalKo)
  const pairs: [string, string][] = []
  let seeded: string[] | undefined
  if (koRound === 0 && groupsCount > 1) {
    const groups = continentalGroups(comp)
    seeded = groups.map((g) => g[0])
    const offsets = rng.shuffle(Array.from({ length: groupsCount - 1 }, (_, k) => k))
    const country = (id: string) => world.clubs[id]?.countryId
    let best = offsets[0]
    for (const off of offsets) {
      const clash = groups.some((g, i) => country(g[0]) === country(groups[(i + 1 + off) % groupsCount][1]))
      if (!clash) { best = off; break }
    }
    // Runner-up hosts the first leg, the group winner the second.
    for (let g = 0; g < groupsCount; g++) pairs.push([groups[(g + 1 + best) % groupsCount][1], groups[g][0]])
  } else {
    const alive = rng.shuffle([...(comp.alive ?? [])])
    for (let i = 0; i + 1 < alive.length; i += 2) pairs.push([alive[i], alive[i + 1]])
  }
  const twoLegged = legs.length === 2
  recordDraw(comp, { round, week: legs[0], pairs: pairs.map((p) => [p[0], p[1]]), seeded, twoLegged })
  if (twoLegged) return twoLegFixtures(comp, round, pairs, legs, CONTINENTAL_DAY)
  return pairs.map(([homeId, awayId], i) => ({
    id: fixtureId(comp.id, round, i), compId: comp.id, round, week: legs[0], day: CONTINENTAL_DAY, homeId, awayId, result: null, neutral: true,
  }))
}

/** Draw and append the fixtures of knockout round `round` from `comp.alive`. */
export function drawKnockoutRound(world: World, comp: Competition, rng: Rng, round: number): Fixture[] {
  const fixtures = comp.type === 'cup' ? cupRoundFixtures(world, comp, rng, round) : continentalKoFixtures(world, comp, rng, round)
  comp.fixtures.push(...fixtures)
  return fixtures
}

// ───────────────────────── Results & progression ─────────────────────────

/**
 * Store a fixture result and update the competition state (table rows for
 * leagues/groups, `alive` for decided knockout ties). Does not draw new
 * rounds; call {@link advanceCompetition} afterwards.
 */
export function applyFixtureResult(comp: Competition, fixture: Fixture, result: MatchResultSummary): void {
  fixture.result = result
  if (isKnockoutFixture(comp, fixture)) {
    if (fixture.leg === 1) return
    const winner = tieWinner(comp, fixture)
    if (!winner) return
    const loser = winner === fixture.homeId ? fixture.awayId : fixture.homeId
    if (comp.alive) comp.alive = comp.alive.filter((id) => id !== loser)
  } else if (comp.table) {
    applyResultToTable(comp.table, fixture.homeId, fixture.awayId, result.home, result.away)
  }
}

/**
 * Move a competition forward once its current round is complete: settle the
 * league winner (and create its play-off), qualify continental group teams,
 * feed qualifying winners into the group draw, draw the next knockout round
 * or crown the cup winner. Returns true if anything changed. International
 * competitions are advanced by national.ts.
 */
export function advanceCompetition(world: World, comp: Competition, rng: Rng): boolean {
  if (comp.winnerId || comp.type === 'international') return false
  const current = maxRound(comp)
  if (current < 0) return false
  // Only the current round is ever drawn, so "everything played" == "round complete".
  if (comp.fixtures.some((f) => !f.result)) return false

  if (comp.type === 'league') {
    comp.winnerId = sortTable(comp.table ?? [], comp.fixtures)[0]?.clubId ?? null
    createPlayoffCompetition(world, comp)
    return true
  }
  if (comp.meta?.format === 'continental_q') {
    const main = comp.meta.feedsInto ? world.competitions[comp.meta.feedsInto] : undefined
    if (!main || main.fixtures.length > 0) return false
    main.participantIds = [...main.participantIds, ...(comp.alive ?? [])]
    startContinentalGroups(world, rng, main)
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
