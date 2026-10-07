/**
 * Individual awards of the world (NPCs and, through {@link HeroAwardInput},
 * the hero on equal terms):
 *
 *  - season awards (top scorer, best / young player) — moved here from season.ts
 *  - Player of the Month per league, from the month's real fixture data
 *    (goals, assists, man-of-the-match, team results)
 *  - Golden Star: transparent score (league, continental, international,
 *    trophies) → top-30 shortlist → 100 journalists vote (5-4-3-2-1 style,
 *    seeded, deterministic for a given world state)
 *  - Golden Glove (keeper clean sheets), Young Player, Goal of the Season
 *    (nominated from actual goals with stored descriptors), Team of the Season
 */
import type { Competition, Fixture, Position, SeasonStats, World } from '../../core/types'
import { Rng, clamp, hashString } from '../../core/rng'
import { positionGroup } from './attributes'
import { positionFamiliarity } from './formations'
import { ageIn } from './players'
import type {
  GoalCandidate, GoldenStarResult, MonthAward, SeasonAwardRecord, StarCandidate, WorldAwards,
} from './worldTypes'

/** Minimum appearances to be eligible for season awards. */
export const MIN_AWARD_APPS = 12
/** Maximum age (during the season) for the young player award. */
export const YOUNG_PLAYER_MAX_AGE = 21
export const GOLDEN_STAR_SHORTLIST = 30
export const GOLDEN_STAR_JOURNALISTS = 100
/** Points a journalist gives to their top 5. */
export const VOTE_POINTS: readonly number[] = [6, 4, 3, 2, 1]
/** Weeks per award month; the last month runs to the end of the league season. */
export const MONTH_WEEKS = 4
export const LAST_MONTH = 9
const MAX_GOAL_NOMINEES = 12
export const HERO_ID = 'hero'

// ───────────────────────── State ─────────────────────────

export function ensureAwards(world: World): WorldAwards {
  if (!world.awards) world.awards = { v: 1, months: [], goldenStar: [], seasons: [], goals: [], ceremonyPending: null }
  return world.awards
}

/** The hero's season, fed to world award computations. */
export interface HeroAwardInput {
  name: string
  clubId: string | null
  nationality: string
  position: Position
  ovr: number
  age: number
  stats: SeasonStats
  /** Senior caps / goals in the award year. */
  intlCaps: number
  intlGoals: number
}

// ───────────────────────── Season awards (moved from season.ts) ─────────────────────────

export interface AwardWinner {
  playerId: string
  clubId: string | null
  /** Goals (top scorer) or award score (best/young player). */
  value: number
}

export interface SeasonAwards {
  season: number
  topScorer: AwardWinner | null
  bestPlayer: AwardWinner | null
  youngPlayer: AwardWinner | null
  /** Top scorer per league id (league of the player's current club). */
  leagueTopScorers: Record<string, AwardWinner>
}

/**
 * Award score used for "player of the season" style awards. Returns null
 * below {@link MIN_AWARD_APPS}. The career layer can feed the hero's stats
 * and OVR to compare against {@link seasonAwards} winners.
 */
export function playerSeasonScore(stats: SeasonStats, ovr: number, position: Position): number | null {
  if (stats.apps < MIN_AWARD_APPS) return null
  const avg = stats.ratingSum / stats.apps
  const group = positionGroup(position)
  const defensive = group === 'GK' || group === 'DEF' ? stats.cleanSheets * 0.4 : 0
  return Math.round((avg * 8 + stats.goals * 0.8 + stats.assists * 0.5 + defensive + stats.motm * 0.5 + ovr * 0.25) * 100) / 100
}

/** Season awards among NPCs (stats cover all competitions of the season). */
export function seasonAwards(world: World, season: number): SeasonAwards {
  let topScorer: AwardWinner | null = null
  let bestPlayer: AwardWinner | null = null
  let youngPlayer: AwardWinner | null = null
  const leagueTopScorers: Record<string, AwardWinner> = {}
  const better = (cur: AwardWinner | null, v: number, id: string) => !cur || v > cur.value || (v === cur.value && id < cur.playerId)

  for (const p of Object.values(world.players)) {
    const g = p.stats.goals
    if (g > 0) {
      if (better(topScorer, g, p.id)) topScorer = { playerId: p.id, clubId: p.clubId, value: g }
      const leagueId = p.clubId ? world.clubs[p.clubId]?.leagueId : undefined
      if (leagueId && better(leagueTopScorers[leagueId] ?? null, g, p.id)) leagueTopScorers[leagueId] = { playerId: p.id, clubId: p.clubId, value: g }
    }
    const score = playerSeasonScore(p.stats, p.ovr, p.position)
    if (score === null) continue
    // Playing in a stronger league counts.
    const rep = p.clubId ? world.clubs[p.clubId]?.reputation ?? 50 : 50
    const weighted = Math.round((score + rep * 0.1) * 100) / 100
    if (better(bestPlayer, weighted, p.id)) bestPlayer = { playerId: p.id, clubId: p.clubId, value: weighted }
    if (ageIn(p, season) <= YOUNG_PLAYER_MAX_AGE && better(youngPlayer, weighted, p.id)) {
      youngPlayer = { playerId: p.id, clubId: p.clubId, value: weighted }
    }
  }
  return { season, topScorer, bestPlayer, youngPlayer, leagueTopScorers }
}

// ───────────────────────── Helpers ─────────────────────────

const nameOf = (world: World, id: string, hero?: HeroAwardInput): string => {
  if (id === HERO_ID) return hero?.name ?? 'Hero'
  const p = world.players[id]
  return p ? `${p.firstName} ${p.lastName}` : id
}

function seasonComps(world: World, season: number): Competition[] {
  return Object.values(world.competitions).filter((c) => c.season === season)
}

/** Month index (0..LAST_MONTH) of a season week (weeks 1–41). */
export function monthOfWeek(week: number): number {
  return clamp(Math.floor((week - 1) / MONTH_WEEKS), 0, LAST_MONTH)
}

/** Week range [from, to] of an award month. */
export function monthWeeks(month: number): [number, number] {
  const from = 1 + month * MONTH_WEEKS
  return [from, month >= LAST_MONTH ? 41 : from + MONTH_WEEKS - 1]
}

// ───────────────────────── Player of the Month ─────────────────────────

interface MonthLine {
  goals: number
  assists: number
  motm: number
  wins: number
  teamId: string
}

/**
 * Player of the Month for every league with games in that month. Built from
 * the month's club fixtures (league, cup, continental): 3 per goal, 2 per
 * assist, 2.5 per man-of-the-match award and 0.4 per team win. The hero
 * (scorer id 'hero') competes with his own club's fixtures.
 */
export function computeMonthAwards(world: World, season: number, month: number, hero?: HeroAwardInput): MonthAward[] {
  const [from, to] = monthWeeks(month)
  const lines = new Map<string, MonthLine>()
  const line = (id: string, teamId: string): MonthLine => {
    let l = lines.get(id)
    if (!l) { l = { goals: 0, assists: 0, motm: 0, wins: 0, teamId }; lines.set(id, l) }
    return l
  }
  for (const comp of seasonComps(world, season)) {
    if (comp.type === 'international') continue
    for (const f of comp.fixtures) {
      if (!f.result || f.week < from || f.week > to) continue
      const r = f.result
      const winner = r.home > r.away ? 'home' : r.away > r.home ? 'away' : null
      const involved = new Map<string, 'home' | 'away'>()
      r.scorers.forEach((s, i) => {
        if (s.ownGoal) return
        const teamId = s.team === 'home' ? f.homeId : f.awayId
        line(s.playerId, teamId).goals++
        involved.set(s.playerId, s.team)
        const a = r.assists?.[i]
        if (a) {
          line(a, teamId).assists++
          involved.set(a, s.team)
        }
      })
      if (r.motmId) {
        const side: 'home' | 'away' = world.players[r.motmId]?.clubId === f.awayId ? 'away' : 'home'
        line(r.motmId, side === 'home' ? f.homeId : f.awayId).motm++
        involved.set(r.motmId, side)
      }
      for (const [id, side] of involved) if (winner === side) lines.get(id)!.wins++
    }
  }
  const best = new Map<string, MonthAward>()
  for (const [id, l] of lines) {
    const clubId = id === HERO_ID ? hero?.clubId ?? null : world.players[id]?.clubId ?? null
    // League of the team the player played for in those games.
    const leagueId = world.clubs[l.teamId]?.leagueId ?? (clubId ? world.clubs[clubId]?.leagueId : undefined)
    if (!leagueId) continue
    const score = Math.round((l.goals * 3 + l.assists * 2 + l.motm * 2.5 + l.wins * 0.4) * 10) / 10
    const cur = best.get(leagueId)
    if (!cur || score > cur.score || (score === cur.score && id < cur.playerId)) {
      best.set(leagueId, {
        season, month, leagueId, playerId: id, name: nameOf(world, id, hero), clubId: world.clubs[l.teamId] ? l.teamId : clubId,
        goals: l.goals, assists: l.assists, score, ...(id === HERO_ID ? { isHero: true } : {}),
      })
    }
  }
  return [...best.values()].filter((a) => a.score >= 3).sort((a, b) => (a.leagueId < b.leagueId ? -1 : 1))
}

/** Store month awards (keeps the current and previous season). */
export function storeMonthAwards(world: World, awards: readonly MonthAward[]): void {
  const st = ensureAwards(world)
  st.months.push(...awards)
  const newest = Math.max(0, ...st.months.map((m) => m.season))
  st.months = st.months.filter((m) => m.season >= newest - 1)
}

// ───────────────────────── Goal of the Season ─────────────────────────

const GOAL_KINDS: readonly GoalCandidate['kind'][] = ['volley', 'long_range', 'solo', 'free_kick', 'header', 'chip', 'curler', 'team_move']

/** Descriptor of a goal from its stable identity (no RNG draws, so the season replays identically). */
export function describeGoal(fixtureId: string, minute: number, playerId: string, opts: { penalty?: boolean; kind?: GoalCandidate['kind']; quality?: number } = {}): { kind: GoalCandidate['kind']; distance: number; score: number } | null {
  if (opts.penalty) return null
  const h = hashString(`${fixtureId}|${minute}|${playerId}`)
  const u1 = (h & 0xffff) / 0xffff
  const u2 = ((h >>> 16) & 0xffff) / 0xffff
  const kind = opts.kind ?? GOAL_KINDS[h % GOAL_KINDS.length]
  const distance = kind === 'long_range' || kind === 'free_kick' || kind === 'curler' ? 20 + Math.round(u2 * 18) : kind === 'header' ? 6 + Math.round(u2 * 8) : 8 + Math.round(u2 * 14)
  const style = kind === 'volley' || kind === 'long_range' || kind === 'solo' ? 1 : kind === 'free_kick' || kind === 'curler' || kind === 'chip' ? 0.7 : 0.3
  const score = clamp(3 + 5.5 * Math.pow(u1, 2.2) + style + (distance >= 25 ? 0.6 : 0) + (opts.quality ?? 0), 0, 10)
  return { kind, distance, score: Math.round(score * 100) / 100 }
}

/** Nominate the goals of a played fixture (keeps the best {@link MAX_GOAL_NOMINEES} of the season). */
export function nominateGoals(world: World, comp: Competition, f: Fixture, nameFor?: (id: string) => string | null): void {
  if (!f.result) return
  const st = ensureAwards(world)
  const importance = comp.type === 'league' ? 0 : comp.type === 'international' ? 0.4 : 0.25
  f.result.scorers.forEach((s) => {
    if (s.ownGoal || s.penalty || s.playerId === HERO_ID) return
    const d = describeGoal(f.id, s.minute, s.playerId, { quality: importance })
    if (!d) return
    const worst = st.goals.length >= MAX_GOAL_NOMINEES ? st.goals[st.goals.length - 1].score : -1
    if (d.score <= worst) return
    const name = nameFor?.(s.playerId) ?? (world.players[s.playerId] ? `${world.players[s.playerId].firstName} ${world.players[s.playerId].lastName}` : null)
    if (!name) return
    addGoalCandidate(world, {
      playerId: s.playerId, name, teamId: s.team === 'home' ? f.homeId : f.awayId, oppId: s.team === 'home' ? f.awayId : f.homeId,
      compName: { ...comp.name }, season: comp.season, week: f.week, minute: s.minute, ...d,
    })
  })
}

/** Insert a goal into the running nominees (sorted best first, capped). Hero goals are kept in a separate slot. */
export function addGoalCandidate(world: World, g: GoalCandidate): void {
  const st = ensureAwards(world)
  st.goals = st.goals.filter((x) => x.season === g.season)
  st.goals.push(g)
  st.goals.sort((a, b) => b.score - a.score || a.week - b.week || (a.playerId < b.playerId ? -1 : 1))
  // Keep the best NPC goals plus the hero's best goal.
  const heroBest = st.goals.find((x) => x.isHero)
  const npc = st.goals.filter((x) => !x.isHero).slice(0, MAX_GOAL_NOMINEES)
  st.goals = heroBest ? [...npc, heroBest].sort((a, b) => b.score - a.score) : npc
}

// ───────────────────────── Golden Star ─────────────────────────

interface StarInput {
  id: string
  name: string
  clubId: string | null
  nationality: string
  position: Position
  ovr: number
  stats: SeasonStats
  caps: number
  intlGoals: number
}

function clubTrophies(world: World, season: number): Map<string, number> {
  const pts = new Map<string, number>()
  for (const comp of seasonComps(world, season)) {
    if (!comp.winnerId || comp.type === 'international' || comp.meta?.format === 'continental_q' || comp.meta?.format === 'playoff') continue
    const tier = comp.leagueId ? world.leagues[comp.leagueId]?.tier ?? 1 : 1
    const v = comp.type === 'continental' ? 6 : comp.type === 'league' ? (tier === 1 ? 4 : 4 * 0.3) : 2
    pts.set(comp.winnerId, (pts.get(comp.winnerId) ?? 0) + v)
  }
  return pts
}

/** Nations that won a senior tournament in the award year (last summer's finals). */
function tournamentWinners(world: World, season: number): Set<string> {
  return new Set(world.honours.filter((h) => (h.season === season - 1 || h.season === season) && /^nt:(WORLD|EU|OC)$/.test(h.compKey)).map((h) => h.winnerId))
}

/** Continental goals/assists/MOTM per player and knockout progress per club in a season. */
function continentalLines(world: World, season: number): { players: Map<string, number>; clubs: Map<string, number> } {
  const players = new Map<string, number>()
  const clubs = new Map<string, number>()
  for (const comp of seasonComps(world, season)) {
    if (comp.type !== 'continental') continue
    for (const f of comp.fixtures) {
      if (!f.result) continue
      f.result.scorers.forEach((s, i) => {
        if (s.ownGoal) return
        players.set(s.playerId, (players.get(s.playerId) ?? 0) + 1.2)
        const a = f.result!.assists?.[i]
        if (a) players.set(a, (players.get(a) ?? 0) + 0.8)
      })
      if (f.result.motmId) players.set(f.result.motmId, (players.get(f.result.motmId) ?? 0) + 0.8)
      if (comp.meta?.format !== 'continental_q' && f.round >= 6) {
        for (const id of [f.homeId, f.awayId]) clubs.set(id, Math.max(clubs.get(id) ?? 0, f.round - 5))
      }
    }
  }
  return { players, clubs }
}

function starScore(world: World, inp: StarInput, ctx: { trophies: Map<string, number>; cont: ReturnType<typeof continentalLines>; ntWinners: Set<string> }): StarCandidate | null {
  const base = playerSeasonScore(inp.stats, inp.ovr, inp.position)
  if (base === null) return null
  const club = inp.clubId ? world.clubs[inp.clubId] : undefined
  const tier = club ? world.leagues[club.leagueId]?.tier ?? 3 : 3
  const league = Math.round((base * 0.6 + (club?.reputation ?? 30) * 0.12 - (tier - 1) * 6) * 10) / 10
  const continental = Math.round(((ctx.cont.players.get(inp.id) ?? 0) + (club ? (ctx.cont.clubs.get(club.id) ?? 0) * 1.5 : 0)) * 10) / 10
  const international = Math.round((inp.caps * 0.35 + inp.intlGoals * 1.1 + (inp.caps > 0 && ctx.ntWinners.has(inp.nationality) ? 6 : 0)) * 10) / 10
  const trophies = Math.round((club ? ctx.trophies.get(club.id) ?? 0 : 0) * 10) / 10
  const score = Math.round((league + continental + international + trophies) * 100) / 100
  return {
    playerId: inp.id, name: inp.name, clubId: inp.clubId, nationality: inp.nationality, position: inp.position,
    parts: { league, continental, international, trophies }, score, points: 0, firsts: 0, ...(inp.id === HERO_ID ? { isHero: true } : {}),
  }
}

/** Golden Star shortlist: the 30 best transparent scores of the season (hero included when eligible). */
export function goldenStarShortlist(world: World, season: number, hero?: HeroAwardInput): StarCandidate[] {
  const ctx = { trophies: clubTrophies(world, season), cont: continentalLines(world, season), ntWinners: tournamentWinners(world, season) }
  const nat = world.national?.stats ?? {}
  const out: StarCandidate[] = []
  for (const p of Object.values(world.players)) {
    if (p.stats.apps < MIN_AWARD_APPS || !p.clubId) continue
    const c = starScore(world, {
      id: p.id, name: `${p.firstName} ${p.lastName}`, clubId: p.clubId, nationality: p.nationality, position: p.position, ovr: p.ovr,
      stats: p.stats, caps: nat[p.id]?.[0] ?? 0, intlGoals: nat[p.id]?.[1] ?? 0,
    }, ctx)
    if (c) out.push(c)
  }
  if (hero) {
    const c = starScore(world, { id: HERO_ID, name: hero.name, clubId: hero.clubId, nationality: hero.nationality, position: hero.position, ovr: hero.ovr, stats: hero.stats, caps: hero.intlCaps, intlGoals: hero.intlGoals }, ctx)
    if (c) out.push(c)
  }
  return out.sort((a, b) => b.score - a.score || (a.playerId < b.playerId ? -1 : 1)).slice(0, GOLDEN_STAR_SHORTLIST)
}

/**
 * 100 journalists vote on the shortlist. Each weighs the four score parts
 * with a personal bias (0.6–1.4), favours candidates of their own nation a
 * little and adds a small personal noise; their top 5 get 6-4-3-2-1 points.
 * Seeded by season and shortlist, so the same world state gives the same result.
 */
export function goldenStarVote(shortlist: readonly StarCandidate[], season: number, journalists = GOLDEN_STAR_JOURNALISTS): GoldenStarResult {
  const seedKey = `golden-star:${season}:${shortlist.map((c) => `${c.playerId}=${c.score}`).join(',')}`
  const rng = new Rng(hashString(seedKey))
  const nations = [...new Set(shortlist.map((c) => c.nationality))]
  const tally = new Map<string, { points: number; firsts: number }>(shortlist.map((c) => [c.playerId, { points: 0, firsts: 0 }]))
  for (let j = 0; j < journalists; j++) {
    const w = { league: rng.range(0.6, 1.4), continental: rng.range(0.6, 1.4), international: rng.range(0.6, 1.4), trophies: rng.range(0.6, 1.4) }
    const home = nations.length ? rng.pick(nations) : ''
    const ranked = shortlist
      .map((c) => ({
        id: c.playerId,
        v: c.parts.league * w.league + c.parts.continental * w.continental + c.parts.international * w.international + c.parts.trophies * w.trophies +
          (c.nationality === home ? 1.5 : 0) + rng.normal(0, 1.2),
      }))
      .sort((a, b) => b.v - a.v || (a.id < b.id ? -1 : 1))
    ranked.slice(0, VOTE_POINTS.length).forEach((r, i) => {
      const t = tally.get(r.id)!
      t.points += VOTE_POINTS[i]
      if (i === 0) t.firsts++
    })
  }
  const ranking = shortlist
    .map((c) => ({ ...c, points: tally.get(c.playerId)!.points, firsts: tally.get(c.playerId)!.firsts }))
    .sort((a, b) => b.points - a.points || b.firsts - a.firsts || b.score - a.score || (a.playerId < b.playerId ? -1 : 1))
  return { season, ranking, journalists }
}

// ───────────────────────── Other season awards ─────────────────────────

const TIER_FACTOR = (tier: number) => (tier <= 1 ? 1 : tier === 2 ? 0.75 : 0.55)

/** Golden Glove: keeper clean sheets weighted by league tier (≥ 12 apps). */
export function goldenGlove(world: World, hero?: HeroAwardInput): SeasonAwardRecord['goldenGlove'] {
  let best: SeasonAwardRecord['goldenGlove'] = null
  let bestV = 0
  const consider = (id: string, name: string, clubId: string | null, stats: SeasonStats) => {
    if (stats.apps < MIN_AWARD_APPS || stats.cleanSheets <= 0) return
    const tier = clubId ? world.leagues[world.clubs[clubId]?.leagueId ?? '']?.tier ?? 3 : 3
    const v = stats.cleanSheets * TIER_FACTOR(tier) + (stats.ratingSum / stats.apps) * 0.1
    if (v > bestV || (v === bestV && best && id < best.playerId)) {
      bestV = v
      best = { playerId: id, name, clubId, value: stats.cleanSheets, ...(id === HERO_ID ? { isHero: true } : {}) }
    }
  }
  for (const p of Object.values(world.players)) if (p.position === 'GK') consider(p.id, `${p.firstName} ${p.lastName}`, p.clubId, p.stats)
  if (hero && hero.position === 'GK') consider(HERO_ID, hero.name, hero.clubId, hero.stats)
  return best
}

const TOTS_SLOTS: readonly Position[] = ['GK', 'RB', 'CB', 'CB', 'LB', 'DM', 'CM', 'AM', 'RW', 'ST', 'LW']

/** Team of the Season (4-3-3) of a league: best average rating per slot (≥ 12 apps, goals and assists count a little). */
export function teamOfSeason(world: World, leagueId: string, hero?: HeroAwardInput): SeasonAwardRecord['teamOfSeason'] {
  const league = world.leagues[leagueId]
  if (!league) return []
  const pool: { id: string; name: string; clubId: string | null; position: Position; rating: number; value: number; isHero?: boolean }[] = []
  const add = (id: string, name: string, clubId: string | null, position: Position, stats: SeasonStats, isHero?: boolean) => {
    if (stats.apps < MIN_AWARD_APPS) return
    const rating = stats.ratingSum / stats.apps
    pool.push({ id, name, clubId, position, rating: Math.round(rating * 100) / 100, value: rating + stats.goals * 0.03 + stats.assists * 0.02 + stats.cleanSheets * 0.02, ...(isHero ? { isHero } : {}) })
  }
  for (const cid of league.clubIds) {
    for (const pid of world.clubs[cid]?.squad ?? []) {
      const p = world.players[pid]
      if (p) add(p.id, `${p.firstName} ${p.lastName}`, p.clubId, p.position, p.stats)
    }
  }
  if (hero?.clubId && league.clubIds.includes(hero.clubId)) add(HERO_ID, hero.name, hero.clubId, hero.position, hero.stats, true)
  const used = new Set<string>()
  const out: SeasonAwardRecord['teamOfSeason'] = []
  for (const slot of TOTS_SLOTS) {
    let best: (typeof pool)[number] | null = null
    let bestV = -Infinity
    for (const c of pool) {
      if (used.has(c.id)) continue
      const fam = positionFamiliarity(c.position, slot)
      if (fam < 0.85 || (slot === 'GK') !== (c.position === 'GK')) continue
      const v = c.value * fam
      if (v > bestV) { bestV = v; best = c }
    }
    if (!best) continue
    used.add(best.id)
    out.push({ slot, playerId: best.id, name: best.name, clubId: best.clubId, rating: best.rating, ...(best.isHero ? { isHero: true } : {}) })
  }
  return out
}

/** Goal of the Season: fan vote over the nominees (best 4 NPC goals + the hero's best goal). */
export function goalOfSeason(world: World, season: number): { winner: GoalCandidate | null; nominees: GoalCandidate[] } {
  const st = ensureAwards(world)
  const goals = st.goals.filter((g) => g.season === season)
  const heroBest = goals.find((g) => g.isHero)
  const nominees = [...goals.filter((g) => !g.isHero).slice(0, heroBest ? 4 : 5), ...(heroBest ? [heroBest] : [])].sort((a, b) => b.score - a.score)
  if (!nominees.length) return { winner: null, nominees: [] }
  const rng = new Rng(hashString(`goal-of-season:${season}:${nominees.map((g) => `${g.playerId}@${g.week}:${g.minute}`).join(',')}`))
  let best: GoalCandidate | null = null
  let bestV = -Infinity
  for (const g of nominees) {
    const v = g.score + rng.normal(0, 0.6)
    if (v > bestV) { bestV = v; best = g }
  }
  return { winner: best, nominees }
}

/** Young player from {@link seasonAwards}, or the hero when his weighted score is higher. */
export function youngPlayerAward(world: World, season: number, hero?: HeroAwardInput): SeasonAwardRecord['youngPlayer'] {
  const a = seasonAwards(world, season).youngPlayer
  let out: SeasonAwardRecord['youngPlayer'] = a ? { playerId: a.playerId, name: nameOf(world, a.playerId), clubId: a.clubId, value: a.value } : null
  if (hero && hero.age <= YOUNG_PLAYER_MAX_AGE) {
    const sc = playerSeasonScore(hero.stats, hero.ovr, hero.position)
    const rep = hero.clubId ? world.clubs[hero.clubId]?.reputation ?? 30 : 30
    const weighted = sc === null ? null : Math.round((sc + rep * 0.1) * 100) / 100
    if (weighted !== null && (!out || weighted > out.value)) out = { playerId: HERO_ID, name: hero.name, clubId: hero.clubId, value: weighted, isHero: true }
  }
  return out
}

/**
 * All end-of-season individual awards (call before NPC stats are reset).
 * `totsLeagueId`: league whose Team of the Season is built (the hero's league).
 */
export function computeSeasonAwardRecord(world: World, season: number, hero?: HeroAwardInput, totsLeagueId?: string | null): SeasonAwardRecord {
  const gos = goalOfSeason(world, season)
  const leagueId = totsLeagueId ?? Object.values(world.leagues).find((l) => l.tier === 1)?.id ?? null
  return {
    season,
    goldenGlove: goldenGlove(world, hero),
    youngPlayer: youngPlayerAward(world, season, hero),
    goalOfSeason: gos.winner,
    goalNominees: gos.nominees,
    teamOfSeason: leagueId ? teamOfSeason(world, leagueId, hero) : [],
    teamOfSeasonLeague: leagueId,
  }
}

/** Store a season's awards (Golden Star + others), keeping the last 10 seasons, and mark the ceremony pending. */
export function storeSeasonAwards(world: World, star: GoldenStarResult, record: SeasonAwardRecord): void {
  const st = ensureAwards(world)
  // Older votes keep only the podium (+ the hero's place) to keep saves small.
  const trimmed = st.goldenStar.filter((g) => g.season !== star.season).map((g) => ({ ...g, ranking: g.ranking.filter((c, i) => i < 3 || c.isHero) }))
  st.goldenStar = [...trimmed, { ...star, ranking: star.ranking.slice(0, GOLDEN_STAR_SHORTLIST) }].slice(-10)
  st.seasons = [...st.seasons.filter((s) => s.season !== record.season), record].slice(-10)
  st.goals = []
  st.ceremonyPending = star.season
}
