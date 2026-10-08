/**
 * Season machinery: playing AI fixtures day by day, recording the hero's
 * results, weekly upkeep, awards, AI transfer windows and the end-of-season
 * rollover (honours, promotion/relegation, ageing, retirements, youth intake,
 * contracts, transfers, next season's competitions).
 *
 * All functions mutate the passed World in place and draw randomness only
 * from the passed Rng, so a season replays identically from the same state.
 */
import type {
  Club, Competition, LText, MatchResultSummary, NpcPlayer, Position, World,
} from '../../core/types'
import { POSITIONS } from '../../core/types'
import { worldGender } from '../../core/gender'
import { clamp } from '../../core/rng'
import type { Rng } from '../../core/rng'
import { positionGroup } from './attributes'
import {
  advanceCompetition, aggregateBefore, applyFixtureResult, autoPromotionPlaces, createSeasonCompetitions, honourKey, isDecisiveFixture,
  isNeutralFixture, isQualifyingComp, playoffCompId,
} from './competitions'
import {
  computeSeasonAwardRecord, goldenStarShortlist, goldenStarVote, nominateGoals, seasonAwards, storeSeasonAwards,
  type HeroAwardInput, type SeasonAwards,
} from './awards'
import { updateCoefficients } from './coefficients'
import { reviewManagers, updateClubRecords } from './managers'
import { END_OF_SEASON_WEEK } from './fixtures'
import {
  advanceNationalCompetition, createNationalCompetitions, ensureNational, playNationalFixture, recordInternationalStats, resetInternationalStats,
} from './national'
import type { GoldenStarResult, SeasonAwardRecord } from './worldTypes'
import { anchorAbility, recordAbilityReference } from './anchor'
import { effectsOf } from './profiles'
import { slotCount } from './formations'
import { FREE_AGENT_COUNT, generateFreeAgents } from './generate'
import {
  ageIn, budgetForReputation, createNpcPlayer, emptySeasonStats, nameStyleOf, randomName, playerValue, playerWage, rollPotential, roundMoney,
} from './players'
import { quickSimDetailed } from './quickSim'
import type { QuickSimDetail } from './quickSim'
import { seasonCompetitions, squadPlayers, teamRating } from './queries'
import { sortTable } from './table'
import { addNpcBan, serveClubBans } from './referees'

export {
  MIN_AWARD_APPS, YOUNG_PLAYER_MAX_AGE, playerSeasonScore, seasonAwards, type AwardWinner, type SeasonAwards,
} from './awards'

// ───────────────────────── Constants ─────────────────────────
/** Clubs never drop below / rise above these squad sizes after the summer. */
export const SQUAD_MIN = 22
export const SQUAD_MAX = 30
const SELLER_MIN_SQUAD = 20
const MAX_FREE_AGENTS = 260
const INJURY_CHANCE_PER_MATCH = 0.012
const YELLOW_CHANCE = 0.08
const RED_CHANCE = 0.004

// ───────────────────────── Playing fixtures ─────────────────────────

export interface PlayedFixture {
  compId: string
  fixtureId: string
  result: MatchResultSummary
}

/** Update NPC season stats, form, morale and injuries from a simulated match. */
function applyMatchStats(world: World, rng: Rng, d: QuickSimDetail): void {
  const minutes = d.extraTime ? 120 : 90
  const sides: { ids: string[]; slots: Position[]; gf: number; ga: number }[] = [
    { ids: d.homeLineup.playerIds, slots: d.homeLineup.slots, gf: d.result.home, ga: d.result.away },
    { ids: d.awayLineup.playerIds, slots: d.awayLineup.slots, gf: d.result.away, ga: d.result.home },
  ]
  for (const side of sides) {
    const moraleDelta = side.gf > side.ga ? 3 : side.gf < side.ga ? -3 : 0
    side.ids.forEach((id, i) => {
      const p = world.players[id]
      if (!p) return
      const rating = d.ratings[id] ?? 6
      p.stats.apps++
      p.stats.starts++
      p.stats.minutes += minutes
      p.stats.ratingSum += rating
      if (side.ga === 0 && (positionGroup(side.slots[i]!) === 'GK' || positionGroup(side.slots[i]!) === 'DEF')) p.stats.cleanSheets++
      const fx = effectsOf(p) // 2.6#36: traits shift cards, injuries and locker-room mood (same number of draws)
      const yellowAdded = rng.chance(YELLOW_CHANCE * fx.cards)
      if (yellowAdded) p.stats.yellow++
      const red = rng.chance(RED_CHANCE * fx.cards)
      if (red) p.stats.red++
      addNpcBan(p, { red, yellowAdded }, `${id}:${p.stats.apps}:${p.stats.red}`)
      p.form = Math.round(p.form * 0.7 + rating * 10 * 0.3)
      p.morale = clamp(p.morale + moraleDelta + (side.gf > side.ga ? fx.winMorale : side.gf < side.ga ? fx.lossMorale : 0), 0, 100)
      if (rng.chance(INJURY_CHANCE_PER_MATCH * fx.injury)) p.injuredWeeks = rng.weighted([1, 2, 3, 4, 6, 10], (w) => 12 / w)
    })
  }
  d.result.scorers.forEach((s, i) => {
    if (!s.ownGoal) {
      const scorer = world.players[s.playerId]
      if (scorer) scorer.stats.goals++
    }
    const assist = d.assists[i]
    if (assist && world.players[assist]) world.players[assist].stats.assists++
  })
  if (d.result.motmId && world.players[d.result.motmId]) world.players[d.result.motmId]!.stats.motm++
}

/** Advance every competition of a season whose current round is complete. */
export function advanceCompetitions(world: World, rng: Rng, season: number): void {
  for (const comp of seasonCompetitions(world, season)) {
    if (comp.type === 'international') advanceNationalCompetition(world, rng, comp)
    else advanceCompetition(world, comp, rng)
  }
}

/**
 * Play every unplayed fixture scheduled on (week, day) of `season`, except
 * `skipFixtureIds` (the hero's matches, played interactively and recorded
 * with {@link recordFixtureResult}). Updates tables, knockout progress, NPC
 * stats, and draws next knockout rounds when a round completes.
 */
export function playFixturesFor(
  world: World,
  rng: Rng,
  season: number,
  week: number,
  day: number,
  skipFixtureIds: ReadonlySet<string> = new Set(),
): PlayedFixture[] {
  const played: PlayedFixture[] = []
  for (const comp of seasonCompetitions(world, season)) {
    for (const f of comp.fixtures) {
      if (f.week !== week || f.day !== day || f.result || skipFixtureIds.has(f.id)) continue
      if (comp.type === 'international') {
        const d = playNationalFixture(world, rng, comp, f)
        if (d) {
          nominateGoals(world, comp, f)
          played.push({ compId: comp.id, fixtureId: f.id, result: d.result })
        }
        continue
      }
      const home = world.clubs[f.homeId]
      const away = world.clubs[f.awayId]
      if (!home || !away) continue
      const aggregate = f.leg === 2 ? aggregateBefore(comp, f) ?? undefined : undefined
      const detail = quickSimDetailed(rng, home, away, world, {
        knockout: isDecisiveFixture(comp, f),
        neutral: isNeutralFixture(comp, f),
        aggregate,
      })
      applyFixtureResult(comp, f, detail.result)
      // Banned players sat this one out: serve a match, then book the new bans.
      serveClubBans(world, home.id)
      serveClubBans(world, away.id)
      applyMatchStats(world, rng, detail)
      nominateGoals(world, comp, f)
      played.push({ compId: comp.id, fixtureId: f.id, result: detail.result })
    }
  }
  advanceCompetitions(world, rng, season)
  return played
}

/**
 * Record a result produced elsewhere (the hero's interactive match). NPC
 * scorers get their goals; `npcRatings` (optional) credits appearances and
 * ratings to NPCs who played. Knockout results must be decisive (use
 * `penalties` when level) — a level knockout result without penalties
 * advances the home side.
 */
export function recordFixtureResult(
  world: World,
  rng: Rng,
  compId: string,
  fixtureId: string,
  result: MatchResultSummary,
  npcRatings?: Readonly<Record<string, number>>,
): void {
  const comp = world.competitions[compId]
  const fixture = comp?.fixtures.find((f) => f.id === fixtureId)
  if (!comp || !fixture) throw new Error(`Unknown fixture ${compId}/${fixtureId}`)
  if (fixture.result) return
  applyFixtureResult(comp, fixture, result)
  nominateGoals(world, comp, fixture)
  if (comp.type === 'international') {
    // Internationals do not count toward club season stats.
    if (!comp.meta?.level || comp.meta.level === 'A') recordInternationalStats(world, Object.keys(npcRatings ?? {}), result.scorers)
    advanceCompetitions(world, rng, comp.season)
    return
  }
  result.scorers.forEach((s, i) => {
    const p = world.players[s.playerId]
    if (p && !s.ownGoal) p.stats.goals++
    const a = result.assists?.[i]
    if (a && world.players[a]) world.players[a].stats.assists++
  })
  if (npcRatings) {
    for (const [id, rating] of Object.entries(npcRatings)) {
      const p = world.players[id]
      if (!p) continue
      p.stats.apps++
      p.stats.starts++
      p.stats.minutes += 90
      p.stats.ratingSum += rating
    }
  }
  if (result.motmId && world.players[result.motmId]) world.players[result.motmId]!.stats.motm++
  advanceCompetitions(world, rng, comp.season)
}

/**
 * Simulate every fixture of the season that is still unplayed (incl. rounds
 * drawn meanwhile), optionally only those before week `beforeWeek`.
 */
export function simulateRemainingFixtures(world: World, rng: Rng, season: number, beforeWeek = Infinity): number {
  let total = 0
  for (;;) {
    let next: { week: number; day: number } | null = null
    for (const comp of seasonCompetitions(world, season)) {
      for (const f of comp.fixtures) {
        if (f.result || f.week >= beforeWeek) continue
        if (!next || f.week < next.week || (f.week === next.week && f.day < next.day)) next = { week: f.week, day: f.day }
      }
    }
    if (!next) break
    total += playFixturesFor(world, rng, season, next.week, next.day).length
  }
  return total
}

/** Weekly upkeep: injuries heal, morale drifts back toward neutral. */
export function weeklyTick(world: World): void {
  for (const p of Object.values(world.players)) {
    if (p.injuredWeeks > 0) p.injuredWeeks--
    p.morale = Math.round(p.morale + (62 - p.morale) * 0.1)
  }
}

// ───────────────────────── Transfers ─────────────────────────

export interface TransferRecord {
  playerId: string
  fromClubId: string | null
  toClubId: string
  fee: number
  season: number
}

export interface TransferWindowOptions {
  /** Max signings per club in this window (default 3). */
  maxPerClub?: number
  /** Probability that a given club is active in this window (default 1). */
  intensity?: number
  /** Players the AI must never move (e.g. the hero's close teammates). */
  protectedPlayerIds?: ReadonlySet<string>
  /** Clubs that neither buy nor sell (e.g. the hero's club mid-season). */
  protectedClubIds?: ReadonlySet<string>
}

/** Remove a player from his club's squad and make him a free agent. */
export function releasePlayer(world: World, playerId: string): void {
  const p = world.players[playerId]
  if (!p?.clubId) return
  const club = world.clubs[p.clubId]
  if (club) club.squad = club.squad.filter((id) => id !== playerId)
  p.clubId = null
}

/** Move a player to `toClubId` for `fee`, signing a new contract. */
export function transferPlayer(world: World, playerId: string, toClubId: string, fee: number, season: number, contractYears: number): void {
  const p = world.players[playerId]
  const to = world.clubs[toClubId]
  if (!p || !to) return
  const from = p.clubId ? world.clubs[p.clubId] : null
  if (from) {
    from.squad = from.squad.filter((id) => id !== playerId)
    from.budget += fee
  }
  to.budget -= fee
  to.squad.push(playerId)
  p.clubId = toClubId
  p.contractUntil = season + contractYears
  p.wage = playerWage(p.ovr, to.reputation)
  p.morale = clamp(p.morale + 10, 0, 100)
}

interface Need {
  pos: Position
  severity: number
  minOvr: number
  maxOvr: number
}

function squadNeeds(world: World, club: Club, level: number): Need[] {
  const byPos = new Map<Position, number[]>()
  for (const p of squadPlayers(world, club.id)) {
    const arr = byPos.get(p.position) ?? []
    arr.push(p.ovr)
    byPos.set(p.position, arr)
  }
  const needs: Need[] = []
  for (const pos of POSITIONS) {
    const slots = pos === 'GK' ? 1 : slotCount(club.formation, pos)
    const ovrs = (byPos.get(pos) ?? []).sort((a, b) => b - a)
    const minDepth = pos === 'GK' ? 2 : slots === 0 ? 0 : slots + 1
    if (ovrs.length < minDepth) {
      needs.push({ pos, severity: 10 + (minDepth - ovrs.length) * 5, minOvr: Math.round(level - 8), maxOvr: Math.round(level + 2) })
    } else if (slots > 0) {
      const starters = ovrs.slice(0, slots)
      const gap = level - starters.reduce((s, v) => s + v, 0) / starters.length
      if (gap > 4) needs.push({ pos, severity: gap, minOvr: Math.round(level + 1), maxOvr: Math.round(level + 8) })
    }
  }
  return needs.sort((a, b) => b.severity - a.severity)
}

function lowerBound(arr: readonly NpcPlayer[], ovr: number): number {
  let lo = 0, hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (arr[mid]!.ovr < ovr) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** Players indexed by position, each list sorted by OVR ascending (stable by id). */
function buildMarketIndex(world: World): Map<Position, NpcPlayer[]> {
  const idx = new Map<Position, NpcPlayer[]>(POSITIONS.map((p) => [p, []]))
  for (const p of Object.values(world.players)) idx.get(p.position)?.push(p)
  for (const list of idx.values()) list.sort((a, b) => a.ovr - b.ovr || (a.id < b.id ? -1 : 1))
  return idx
}

/** Fee a selling club asks: value with a premium, discounted near contract expiry. */
export function askingFee(rng: Rng, p: NpcPlayer, season: number): number {
  if (!p.clubId) return 0
  const expiring = p.contractUntil <= season ? 0.6 : 1
  return roundMoney(p.value * rng.range(1, 1.35) * expiring)
}

interface WindowState {
  world: World
  rng: Rng
  season: number
  index: Map<Position, NpcPlayer[]>
  moved: Set<string>
  opts: TransferWindowOptions
}

function findCandidate(st: WindowState, club: Club, need: Need): { player: NpcPlayer; fee: number } | null {
  const list = st.index.get(need.pos) ?? []
  const i0 = lowerBound(list, need.minOvr)
  const i1 = lowerBound(list, need.maxOvr + 1)
  if (i1 <= i0) return null
  const samples = i1 - i0 <= 24 ? Array.from({ length: i1 - i0 }, (_, k) => i0 + k) : Array.from({ length: 24 }, () => st.rng.int(i0, i1 - 1))
  let best: { player: NpcPlayer; fee: number; score: number } | null = null
  for (const k of samples) {
    const p = list[k]!
    if (p.clubId === club.id || st.moved.has(p.id) || p.injuredWeeks > 0) continue
    if (st.opts.protectedPlayerIds?.has(p.id)) continue
    const age = ageIn(p!, st.season)
    if (age > 32) continue
    let fee = 0
    if (p.clubId) {
      const seller = st.world.clubs[p.clubId]
      if (!seller || st.opts.protectedClubIds?.has(seller.id)) continue
      if (seller.reputation > club.reputation + 6 || seller.squad.length <= SELLER_MIN_SQUAD) continue
      fee = askingFee(st.rng, p!, st.season)
      if (fee > club.budget) continue
    }
    const score = p.ovr + (p.potential - p.ovr) * (age <= 23 ? 0.4 : 0.1) - Math.max(0, age - 29) * 1.5 + st.rng.range(0, 2)
    if (!best || score > best.score) best = { player: p, fee, score }
  }
  return best
}

/** How much a club wants to keep a player: ability, plus youth upside, minus veteran decline. */
function keepScore(p: NpcPlayer, season: number): number {
  const age = ageIn(p, season)
  return p.ovr + (age <= 21 ? Math.max(0, p.potential - p.ovr) * 0.6 : 0) - Math.max(0, age - 30) * 2
}

function trimSquad(world: World, club: Club, season: number, max: number): void {
  if (club.squad.length <= max) return
  const ranked = squadPlayers(world, club.id).sort((a, b) => keepScore(a, season) - keepScore(b, season) || (a.id < b.id ? -1 : 1))
  for (const p of ranked.slice(0, club.squad.length - max)) releasePlayer(world, p.id)
}

/**
 * AI transfer window. Each active club (random order) identifies weak or thin
 * positions relative to its own level and buys/signs the best affordable
 * candidate from clubs of similar or lower reputation, or from free agency.
 * Candidate search uses a position/OVR index (binary search + sampling), so
 * cost is O(players log players + clubs × needs × 24).
 */
export function aiTransferWindow(world: World, rng: Rng, season: number, opts: TransferWindowOptions = {}): TransferRecord[] {
  const maxPerClub = opts.maxPerClub ?? 3
  const intensity = opts.intensity ?? 1
  const st: WindowState = { world, rng, season, index: buildMarketIndex(world), moved: new Set(), opts }
  const clubs = rng.shuffle(Object.values(world.clubs).filter((c) => !opts.protectedClubIds?.has(c.id)))
  const records: TransferRecord[] = []
  for (const club of clubs) {
    if (!rng.chance(intensity)) continue
    const level = teamRating(world, club).overall
    let signed = 0
    for (const need of squadNeeds(world, club, level)) {
      if (signed >= maxPerClub) break
      const cand = findCandidate(st, club, need)
      if (!cand) continue
      const from = cand.player.clubId
      transferPlayer(world, cand.player.id, club.id, cand.fee, season, rng.int(1, 4))
      st.moved.add(cand.player.id)
      records.push({ playerId: cand.player.id, fromClubId: from, toClubId: club.id, fee: cand.fee, season })
      signed++
    }
    trimSquad(world, club, season, SQUAD_MAX)
  }
  return records
}

// ───────────────────────── End of season ─────────────────────────

export interface ChampionRecord {
  compId: string
  compKey: string
  type: Competition['type']
  name: LText
  winnerId: string
}

export interface LeagueMovement {
  clubId: string
  fromLeagueId: string
  toLeagueId: string
  kind: 'promoted' | 'relegated'
}

export interface RetiredPlayer {
  id: string
  name: string
  clubId: string | null
  age: number
}

export interface EndOfSeasonSummary {
  season: number
  nextSeason: number
  champions: ChampionRecord[]
  movements: LeagueMovement[]
  awards: SeasonAwards
  /** Golden Star vote of the season (hero included when the game layer passed him). */
  goldenStar: GoldenStarResult
  /** Golden Glove, Young Player, Goal and Team of the Season. */
  awardRecord: SeasonAwardRecord
  /** Country coefficient points earned this season. */
  coefficientPoints: Record<string, number>
  retired: RetiredPlayer[]
  released: string[]
  youthIntake: string[]
  transfers: TransferRecord[]
  /** Players created to keep squads at minimum size. */
  fillers: string[]
}

function recordHonours(world: World, season: number): ChampionRecord[] {
  const out: ChampionRecord[] = []
  for (const comp of seasonCompetitions(world, season)) {
    // International champions are recorded by national.ts when their tournament ends.
    if (comp.type === 'international' || isQualifyingComp(comp)) continue
    if (comp.type === 'league' && !comp.winnerId && comp.table) comp.winnerId = sortTable(comp.table, comp.fixtures)[0]?.clubId ?? null
    if (!comp.winnerId) continue
    const compKey = honourKey(comp)
    world.honours.push({ season, compKey, name: { ...comp.name }, winnerId: comp.winnerId })
    out.push({ compId: comp.id, compKey, type: comp.type, name: comp.name, winnerId: comp.winnerId })
  }
  return out
}

function finalOrder(world: World, leagueId: string, season: number): string[] {
  const league = world.leagues[leagueId]!
  const comp = seasonCompetitions(world, season).find((c) => c.type === 'league' && c.leagueId === leagueId)
  if (!comp?.table) return [...league.clubIds]
  const order = sortTable(comp.table, comp.fixtures).map((r) => r.clubId).filter((id) => league.clubIds.includes(id))
  return [...order, ...league.clubIds.filter((id) => !order.includes(id))]
}

/**
 * The `n` clubs promoted from a league: the automatic places plus the
 * play-off winner (falls back to the table when no play-off was played).
 */
export function promotedClubs(world: World, leagueId: string, season: number, n: number): string[] {
  const order = finalOrder(world, leagueId, season)
  const auto = Math.min(n, autoPromotionPlaces(world, leagueId))
  const out = order.slice(0, auto)
  const po = world.competitions[playoffCompId(season, leagueId)]
  if (out.length < n && po?.winnerId && !out.includes(po.winnerId) && order.includes(po.winnerId)) out.push(po.winnerId)
  for (const id of order) if (out.length < n && !out.includes(id)) out.push(id)
  return out
}

/** Swap the bottom `relegate` of each tier with the promoted clubs (automatic + play-off) of the tier below. */
export function applyPromotionRelegation(world: World, season: number): LeagueMovement[] {
  const moves: LeagueMovement[] = []
  const byCountry = new Map<string, string[]>()
  for (const l of Object.values(world.leagues)) byCountry.set(l.countryId, [...(byCountry.get(l.countryId) ?? []), l.id])
  for (const leagueIds of byCountry.values()) {
    const tiers = leagueIds.map((id) => world.leagues[id]).sort((a, b) => a!.tier - b!.tier)
    for (let t = 0; t + 1 < tiers.length; t++) {
      const upper = tiers[t]!
      const lower = tiers[t + 1]!
      const n = Math.min(upper.relegate, lower.promote)
      if (n <= 0) continue
      for (const clubId of finalOrder(world, upper.id, season).slice(-n)) moves.push({ clubId, fromLeagueId: upper.id, toLeagueId: lower.id, kind: 'relegated' })
      for (const clubId of promotedClubs(world, lower.id, season, n)) moves.push({ clubId, fromLeagueId: lower.id, toLeagueId: upper.id, kind: 'promoted' })
    }
  }
  // Apply after all decisions so a club cannot move two tiers in one summer.
  for (const m of moves) {
    const from = world.leagues[m.fromLeagueId]!
    from.clubIds = from.clubIds.filter((id) => id !== m.clubId)
    world.leagues[m.toLeagueId]!.clubIds.push(m.clubId)
    world.clubs[m.clubId]!.leagueId = m.toLeagueId
  }
  return moves
}

function updateClubReputations(world: World, season: number, moves: readonly LeagueMovement[], champions: readonly ChampionRecord[]): void {
  for (const league of Object.values(world.leagues)) {
    const order = finalOrder(world, league.id, season)
    const country = world.countries[league.countryId]
    order.forEach((clubId, i) => {
      const club = world.clubs[clubId]!
      const n = Math.max(1, order.length - 1)
      const baseline = (country?.reputation ?? 60) * 0.55 + 22.5 - (league.tier - 1) * 14
      let rep = club.reputation + Math.round((0.5 - i / n) * 4)
      rep += (baseline - rep) * 0.05
      club.reputation = rep
    })
  }
  for (const m of moves) world.clubs[m.clubId]!.reputation += m.kind === 'promoted' ? 4 : -4
  for (const c of champions) {
    const club = world.clubs[c.winnerId]
    if (club) club.reputation += c.type === 'continental' ? 5 : c.type === 'league' ? 2 : 1
  }
  for (const club of Object.values(world.clubs)) club.reputation = clamp(Math.round(club.reputation), 5, 99)
}

function developmentDelta(rng: Rng, p: NpcPlayer, age: number): number {
  const gap = Math.max(0, p.potential - p.ovr)
  let d: number
  if (age <= 21) d = gap * rng.range(0.2, 0.45) + rng.normal(0, 1.5)
  else if (age <= 24) d = gap * rng.range(0.15, 0.35) + rng.normal(0, 1.2)
  else if (age <= 28) d = gap * rng.range(0, 0.3) + rng.normal(0, 1)
  else if (age <= 30) d = rng.normal(-0.5, 1.2)
  else d = -(rng.range(0.5, 2.5) + (age - 31) * 0.6)
  if (age <= 24) {
    if (p.stats.apps >= 20) d += 1
    else if (p.stats.apps < 5) d -= 1
  }
  return d
}

function retirementChance(p: NpcPlayer, nextAge: number): number {
  if (nextAge >= 39) return 1
  let c = nextAge >= 34 ? 0.25 + (nextAge - 34) * 0.18 : 0
  if (!p.clubId && nextAge >= 31) c += 0.3
  if (p.ovr < 45 && nextAge >= 30) c += 0.2
  return clamp(c, 0, 1)
}

/** Retired players at or above this ability enter the legends list (2.6#47). */
export const LEGEND_MIN_OVR = 74
export const LEGENDS_KEPT = 150

function addLegend(world: World, p: NpcPlayer, season: number): void {
  const list = (world.legends ??= [])
  list.push({ id: p.id, name: `${p.firstName} ${p.lastName}`, nationality: p.nationality, position: p.position, ovr: p.ovr, retiredSeason: season, lastClubId: p.clubId })
  list.sort((a, b) => b.ovr - a.ovr || b.retiredSeason - a.retiredSeason || (a.id < b.id ? -1 : 1))
  if (list.length > LEGENDS_KEPT) list.length = LEGENDS_KEPT
}

/** Develop/decline every player by one year and retire veterans. */
function ageAndRetire(world: World, rng: Rng, season: number): RetiredPlayer[] {
  const retired: RetiredPlayer[] = []
  const retiredIds = new Set<string>()
  for (const p of Object.values(world.players)) {
    const age = ageIn(p, season)
    const nextAge = age + 1
    if (rng.chance(retirementChance(p, nextAge))) {
      retired.push({ id: p.id, name: `${p.firstName} ${p.lastName}`, clubId: p.clubId, age: nextAge })
      retiredIds.add(p.id)
      if (p.ovr >= LEGEND_MIN_OVR) addLegend(world, p, season)
      continue
    }
    const d = developmentDelta(rng, p, age)
    const target = Math.round(p.ovr + d)
    p.ovr = clamp(d > 0 ? Math.min(target, Math.max(p.potential, p.ovr)) : target, 25, 95)
    if (nextAge <= 23 && rng.chance(0.2)) p.potential += rng.int(-3, 3)
    p.potential = clamp(Math.max(p.potential, p.ovr), p.ovr, 96)
    p.value = playerValue(p.ovr, nextAge, p.potential)
    p.form = 50
    p.morale = rng.int(55, 75)
  }
  for (const id of retiredIds) delete world.players[id]
  for (const club of Object.values(world.clubs)) {
    if (club.squad.some((id) => retiredIds.has(id))) club.squad = club.squad.filter((id) => !retiredIds.has(id))
  }
  return retired
}

/** Renew or release players whose contracts end with `season`. */
function processContracts(world: World, rng: Rng, season: number): string[] {
  const released: string[] = []
  for (const club of Object.values(world.clubs)) {
    const ranked = squadPlayers(world, club.id).sort((a, b) => b.ovr - a.ovr)
    ranked.forEach((p, rank) => {
      if (p.contractUntil > season) return
      const nextAge = ageIn(p, season) + 1
      const keep = (rank < 18 && nextAge <= 33 && rng.chance(0.8)) || (nextAge <= 21 && p.potential >= p.ovr + 8 && rng.chance(0.85))
      if (keep) {
        p.contractUntil = season + rng.int(1, 4)
        p.wage = playerWage(p.ovr, club.reputation)
      } else {
        releasePlayer(world, p.id)
        released.push(p.id)
      }
    })
  }
  return released
}

/** Position a club most lacks relative to its formation. */
function neediestPosition(world: World, club: Club): Position {
  const counts = new Map<Position, number>(POSITIONS.map((p) => [p, 0]))
  for (const p of squadPlayers(world, club.id)) counts.set(p.position, (counts.get(p.position) ?? 0) + 1)
  let best: Position = 'CM'
  let bestScore = -Infinity
  for (const pos of POSITIONS) {
    const want = pos === 'GK' ? 3 : slotCount(club.formation, pos) * 2
    const score = want - (counts.get(pos) ?? 0)
    if (score > bestScore) {
      bestScore = score
      best = pos
    }
  }
  return best
}

/** 1–3 academy graduates (16–18) per club, quality scaled by club level and reputation. */
/** Academy level 1..5 from club standing (2.6#48): better academies bring more and stronger prospects. */
export const academyLevel = (club: Club): number => clamp(1 + Math.floor(club.reputation / 20), 1, 5)

function youthIntake(world: World, rng: Rng, nextSeason: number): string[] {
  const ids: string[] = []
  let n = 0
  for (const club of Object.values(world.clubs)) {
    const level = teamRating(world, club).overall
    const level0 = academyLevel(club)
    const count = rng.int(1, 3) + (level0 >= 4 ? 1 : 0)
    for (let i = 0; i < count; i++) {
      const age = rng.int(16, 18)
      const ovr = clamp(Math.round(level - 24 + (age - 16) * 2 + rng.normal(0, 4)), 35, 72)
      const p = createNpcPlayer(rng, {
        id: `y${nextSeason}_${n++}`,
        nationality: rng.chance(0.9) ? club.countryId : rng.pick(Object.keys(world.countries)),
        position: neediestPosition(world, club), age, season: nextSeason, ovr,
        potential: rollPotential(rng, ovr, age, (club.reputation - 50) / 10),
        clubId: club.id, clubReputation: club.reputation, contractYears: 3, gender: worldGender(world),
      })
      const taken = new Set(club.squad.map((id) => { const q = world.players[id]; return q ? `${q.firstName} ${q.lastName}` : '' }))
      for (let tries = 0; taken.has(`${p.firstName} ${p.lastName}`) && tries < 12; tries++) {
        const nm = randomName(rng, nameStyleOf(p.nationality), worldGender(world))
        p.firstName = nm.firstName
        p.lastName = nm.lastName
      }
      world.players[p.id] = p
      club.squad.push(p.id)
      ids.push(p.id)
    }
  }
  return ids
}

/** Top squads up to SQUAD_MIN (free agents first, generated fillers otherwise) and trim to SQUAD_MAX. */
function balanceSquads(world: World, rng: Rng, season: number): { signed: TransferRecord[]; fillers: string[] } {
  const signed: TransferRecord[] = []
  const fillers: string[] = []
  const free = Object.values(world.players).filter((p) => p.clubId === null).sort((a, b) => b.ovr - a.ovr || (a.id < b.id ? -1 : 1))
  let n = 0
  for (const club of Object.values(world.clubs)) {
    if (club.squad.length < SQUAD_MIN) {
      const level = teamRating(world, club).overall
      while (club.squad.length < SQUAD_MIN) {
        const pos = neediestPosition(world, club)
        const idx = free.findIndex((p) => p.clubId === null && p.position === pos && p.ovr <= level + 3 && p.ovr >= level - 12)
        if (idx >= 0) {
          const p = free.splice(idx, 1)[0]!
          transferPlayer(world, p.id, club.id, 0, season, rng.int(1, 2))
          signed.push({ playerId: p.id, fromClubId: null, toClubId: club.id, fee: 0, season })
        } else {
          const age = rng.int(20, 30)
          const p = createNpcPlayer(rng, {
            id: `g${season}_${n++}`, nationality: club.countryId, position: pos, age, season,
            ovr: level - 6 + rng.normal(0, 3), clubId: club.id, clubReputation: club.reputation, gender: worldGender(world),
          })
          world.players[p.id] = p
          club.squad.push(p.id)
          fillers.push(p.id)
        }
      }
    }
    trimSquad(world, club, season, SQUAD_MAX)
  }
  return { signed, fillers }
}

function maintainFreeAgents(world: World, rng: Rng, season: number): void {
  const free = Object.values(world.players).filter((p) => p.clubId === null)
  if (free.length > MAX_FREE_AGENTS) {
    free.sort((a, b) => a.ovr - b.ovr || ageIn(b, season) - ageIn(a, season))
    for (const p of free.slice(0, free.length - MAX_FREE_AGENTS)) delete world.players[p.id]
  } else if (free.length < FREE_AGENT_COUNT) {
    generateFreeAgents(rng, world, season, FREE_AGENT_COUNT - free.length, `fa${season}_`)
  }
}

function resetClubFinances(world: World, rng: Rng): void {
  for (const club of Object.values(world.clubs)) {
    club.budget = roundMoney(budgetForReputation(club.reputation) * rng.range(0.85, 1.15))
  }
}

function recomputeWageBudgets(world: World): void {
  for (const club of Object.values(world.clubs)) {
    let total = 0
    for (const id of club.squad) total += world.players[id]?.wage ?? 0
    club.wageBudget = Math.round(total * 1.1)
  }
}

/** Remove competitions older than `keepFromSeason` (keeps save files small). */
export function pruneCompetitions(world: World, keepFromSeason: number): void {
  for (const [id, comp] of Object.entries(world.competitions)) if (comp.season < keepFromSeason) delete world.competitions[id]
}

/**
 * Close `season` and prepare `season + 1`:
 * 1. simulate any unplayed fixtures, 2. honours + awards, 3. promotion/relegation,
 * 4. club reputations, 5. development / decline / retirements, 6. contract
 * expiries, 7. youth intake, 8. budgets + summer AI transfer window,
 * 9. squad-size balancing + free-agent pool, 10. reset stats, 11. next season's
 * competitions, 12. prune competitions older than `season`.
 *
 * Mutates and returns the same `world`. Retired players are deleted from
 * `world.players` (old fixtures may still reference their ids).
 */
export interface EndOfSeasonOptions {
  /** The hero's season, so he competes for the individual awards. */
  hero?: HeroAwardInput
  /** League whose Team of the Season is built (default: the first top-tier league). */
  totsLeagueId?: string | null
}

export function endOfSeason(world: World, rng: Rng, season: number, opts: EndOfSeasonOptions = {}): { world: World; summary: EndOfSeasonSummary } {
  const next = season + 1
  recordAbilityReference(world) // before this season's development: the reference is the world as it was made
  ensureNational(world)
  // Last summer's national finals (normally already played in the off-season weeks).
  simulateRemainingFixtures(world, rng, season - 1)
  // Club football; this season's national finals are played after the season closes.
  simulateRemainingFixtures(world, rng, season, END_OF_SEASON_WEEK)
  const champions = recordHonours(world, season)
  const awards = seasonAwards(world, season)
  const goldenStar = goldenStarVote(goldenStarShortlist(world, season, opts.hero), season)
  const awardRecord = computeSeasonAwardRecord(world, season, opts.hero, opts.totsLeagueId)
  storeSeasonAwards(world, goldenStar, awardRecord)
  const coefficientPoints = updateCoefficients(world, season)
  updateClubRecords(world, season)
  reviewManagers(world, season)
  resetInternationalStats(world)
  const movements = applyPromotionRelegation(world, season)
  updateClubReputations(world, season, movements, champions)
  const retired = ageAndRetire(world, rng, season)
  const released = processContracts(world, rng, season)
  const youth = youthIntake(world, rng, next)
  resetClubFinances(world, rng)
  const transfers = aiTransferWindow(world, rng, next, { maxPerClub: 3, intensity: 1 })
  const balanced = balanceSquads(world, rng, next)
  anchorAbility(world, rng, next)
  maintainFreeAgents(world, rng, next)
  recomputeWageBudgets(world)
  for (const p of Object.values(world.players)) p.stats = emptySeasonStats()
  createSeasonCompetitions(world, rng, next)
  createNationalCompetitions(world, rng, next)
  pruneCompetitions(world, season)
  return {
    world,
    summary: {
      season, nextSeason: next, champions, movements, awards, goldenStar, awardRecord, coefficientPoints, retired, released, youthIntake: youth,
      transfers: [...transfers, ...balanced.signed], fillers: balanced.fillers,
    },
  }
}
