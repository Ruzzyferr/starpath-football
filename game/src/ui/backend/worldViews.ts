/**
 * View models for the national team, cups and awards screens (WP-1 / WP-5).
 * Read the live `gameState` (reactive when called during render); the only
 * mutation is {@link markCeremonySeen}.
 */
import type { Competition, Fixture, GameState, LText, Position, TableRow } from '../../core/types'
import {
  CALLUP_THRESHOLD, heroCallup, markCeremonySeen as markSeen, monthName, nextAnnouncement, nextHeroNationalFixture, pendingCeremony,
  type CallupView,
} from '../../sim/game'
import { fixtureSeason } from '../../sim/game/internal'
import { coefficientRanking } from '../../sim/world/coefficients'
import {
  continentalCompId, continentalQualifyingCompId, cupCompId, finalRound, playoffCompId, tieAggregate, tieWinner,
} from '../../sim/world/competitions'
import {
  groupStandings, nationalCompetitions, nationalHonours, nationalTeamPlayers, parseTeamId, teamName,
} from '../../sim/world/national'
import { sortTable } from '../../sim/world/table'
import type { DrawRecord, GoldenStarResult, MonthAward, SeasonAwardRecord } from '../../sim/world/worldTypes'
import { gameState, type TeamView } from '../store'
import { teamViewOr } from './mapping'
import { commit } from './session'

const S = (): GameState | null => gameState.value

// ───────────────────────── National team ─────────────────────────

export interface CallupCardView {
  callup: CallupView
  threshold: number
  announceIn: number
  finals: boolean
  /** Team the hero is currently called up to. */
  calledTo: string | null
  calledToName: LText | null
  coach: string
  caps: number
  goals: number
  youthCaps: number
  youthGoals: number
}

export function callupCard(): CallupCardView | null {
  const s = S()
  if (!s || s.hero.retired) return null
  const v = heroCallup(s)
  if (!v) return null
  const nat = s.world.national
  const ann = nextAnnouncement(s)
  const calledTo = nat?.hero.teamId ?? null
  return {
    callup: v, threshold: CALLUP_THRESHOLD, announceIn: ann.weeksUntil, finals: ann.finals, calledTo,
    calledToName: calledTo ? teamName(calledTo) : null, coach: nat?.coaches[s.hero.nationality] ?? '—',
    caps: s.hero.nationalTeam.caps, goals: s.hero.nationalTeam.goals, youthCaps: nat?.hero.youthCaps ?? 0, youthGoals: nat?.hero.youthGoals ?? 0,
  }
}

export interface ResultLine {
  fixtureId: string
  week: number
  day: number
  home: TeamView
  away: TeamView
  score: string | null
  note: string | null
  round: number
  leg?: 1 | 2
  heroTeam: boolean
}

function resultLine(s: GameState, comp: Competition, f: Fixture, mine: ReadonlySet<string>): ResultLine {
  const r = f.result
  let note: string | null = null
  if (r?.penalties) note = `P ${r.penalties.home}-${r.penalties.away}`
  if (f.leg === 2 && r) {
    const agg = tieAggregate(comp, f)
    if (agg) note = `${note ? note + ' · ' : ''}Σ ${agg[1]}-${agg[0]}`
  }
  return {
    fixtureId: f.id, week: f.week, day: f.day, home: teamViewOr(s, f.homeId), away: teamViewOr(s, f.awayId),
    score: r ? `${r.home}-${r.away}${r.extraTime ? '*' : ''}` : null, note, round: f.round, ...(f.leg ? { leg: f.leg } : {}),
    heroTeam: mine.has(f.homeId) || mine.has(f.awayId),
  }
}

export interface GroupTableView {
  title: LText
  rows: (TableRow & { team: TeamView })[]
}

export interface NationalCompView {
  id: string
  name: LText
  format: string
  hostId: string | null
  groups: GroupTableView[]
  knockout: ResultLine[]
  fixtures: ResultLine[]
  winner: TeamView | null
}

function groupTables(s: GameState, comp: Competition): GroupTableView[] {
  if (!comp.table) return []
  const rows = new Map(comp.table.map((r) => [r.clubId, r]))
  const groups = comp.meta?.groups ? groupStandings(comp) : [sortTable(comp.table, comp.fixtures).map((r) => r.clubId)]
  return groups.map((g, i) => ({
    title: comp.meta?.groups ? { tr: `${String.fromCharCode(65 + i)} Grubu`, en: `Group ${String.fromCharCode(65 + i)}` } : comp.name,
    rows: g.map((id) => ({ ...(rows.get(id) as TableRow), team: teamViewOr(s, id) })),
  }))
}

export interface NationalView {
  card: CallupCardView | null
  teamId: string
  squad: { id: string; name: string; position: Position; ovr: number; age: number; club: string; isHero: boolean }[]
  next: ResultLine | null
  comps: NationalCompView[]
  honours: { season: number; name: LText; winner: TeamView }[]
  log: { season: number; week: number; opp: TeamView; gf: number; ga: number; goals: number; comp: LText }[]
}

export function nationalView(level: 'A' | 'U21' | 'U19' | null = null): NationalView | null {
  const s = S()
  if (!s) return null
  const card = callupCard()
  const nation = s.hero.nationality
  const lv = level ?? card?.callup.level ?? 'A'
  const teamId = lv === 'A' ? nation : `${nation}:${lv}`
  const season = s.calendar.season
  const nat = s.world.national
  const announced = nat?.squads[teamId]
  const players = announced ? nationalTeamPlayers(s.world, teamId, season) : []
  const squad = players.map((p) => ({
    id: p.id, name: `${p.firstName} ${p.lastName}`, position: p.position, ovr: p.ovr, age: season - p.birthYear,
    club: p.clubId ? s.world.clubs[p.clubId]?.name ?? '—' : '—', isHero: false,
  }))
  if (announced?.includes('hero')) {
    const h = s.hero
    squad.push({ id: 'hero', name: `${h.firstName} ${h.lastName}`, position: h.position, ovr: card?.callup.heroScore ? Math.round(card.callup.heroScore) : 0, age: season - h.birthYear, club: s.world.clubs[h.contract?.clubId ?? '']?.name ?? '—', isHero: true })
  }
  const order: Position[] = ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST']
  squad.sort((a, b) => order.indexOf(a.position) - order.indexOf(b.position) || b.ovr - a.ovr)
  const mine = new Set([teamId, nat?.hero.teamId ?? ''])
  const comps: NationalCompView[] = nationalCompetitions(s.world, season)
    .filter((c) => (c.meta?.level ?? 'A') === lv && c.meta?.format !== 'nt_friendly' || c.fixtures.some((f) => f.homeId === teamId || f.awayId === teamId))
    .map((c) => {
      const ko = c.meta?.koFrom ?? Infinity
      return {
        id: c.id, name: c.name, format: c.meta?.format ?? '', hostId: c.meta?.hostId ?? null,
        groups: c.meta?.format === 'nt_friendly' ? [] : groupTables(s, c),
        knockout: c.fixtures.filter((f) => f.round >= ko).map((f) => resultLine(s, c, f, mine)),
        fixtures: c.fixtures.filter((f) => f.homeId === teamId || f.awayId === teamId).map((f) => resultLine(s, c, f, mine)),
        winner: c.winnerId ? teamViewOr(s, c.winnerId) : null,
      }
    })
  const nx = nextHeroNationalFixture(s)
  return {
    card, teamId, squad, comps,
    next: nx ? resultLine(s, nx.competition, nx.fixture, mine) : null,
    honours: nationalHonours(s.world).filter((h) => /^nt:(EU|OC|WORLD)$/.test(h.key)).slice(0, 12).map((h) => ({ season: h.season, name: h.name, winner: teamViewOr(s, h.winnerId) })),
    log: (nat?.hero.log ?? []).map((e) => ({ season: e.season, week: e.week, opp: teamViewOr(s, e.oppId), gf: e.gf, ga: e.ga, goals: e.goals, comp: e.comp })),
  }
}

// ───────────────────────── Cups ─────────────────────────

export interface CupView {
  id: string
  name: LText
  rounds: { round: number; label: LText; ties: ResultLine[] }[]
  groups: GroupTableView[]
  winner: TeamView | null
  hasDraw: boolean
}

function roundLabel(comp: Competition, round: number): LText {
  const fr = finalRound(comp)
  if (round === fr) return { tr: 'Final', en: 'Final' }
  if (round === fr - 1) return { tr: 'Yarı final', en: 'Semi-finals' }
  if (round === fr - 2) return { tr: 'Çeyrek final', en: 'Quarter-finals' }
  if (comp.type === 'continental' && comp.meta?.format !== 'continental_q' && round < 6) return { tr: `${round + 1}. maç günü`, en: `Matchday ${round + 1}` }
  return { tr: `${round + 1}. tur`, en: `Round ${round + 1}` }
}

function cupView(s: GameState, comp: Competition | undefined): CupView | null {
  if (!comp) return null
  const clubId = s.hero.contract?.clubId ?? ''
  const mine = new Set([clubId])
  const koFrom = comp.type === 'continental' && comp.meta?.format !== 'continental_q' ? 6 : 0
  const rounds = new Map<number, ResultLine[]>()
  for (const f of comp.fixtures) {
    if (f.round < koFrom) continue
    const arr = rounds.get(f.round) ?? []
    arr.push(resultLine(s, comp, f, mine))
    rounds.set(f.round, arr)
  }
  return {
    id: comp.id, name: comp.name,
    rounds: [...rounds.entries()].sort((a, b) => a[0] - b[0]).map(([round, ties]) => ({ round, label: roundLabel(comp, round), ties })),
    groups: koFrom > 0 ? groupTables(s, comp) : [],
    winner: comp.winnerId ? teamViewOr(s, comp.winnerId) : null,
    hasDraw: (comp.meta?.draws?.length ?? 0) > 0,
  }
}

export interface CupsView {
  domestic: CupView | null
  continental: CupView | null
  qualifying: CupView | null
  playoff: CupView | null
  coefficients: { country: string; name: LText; flag: [string, string, string]; total: number; seasons: number[] }[]
  scorers: { id: string; name: string; club: TeamView | null; goals: number; isHero: boolean }[]
}

export function cupsView(): CupsView | null {
  const s = S()
  if (!s) return null
  const season = fixtureSeason(s)
  const club = s.hero.contract ? s.world.clubs[s.hero.contract.clubId] : null
  const country = club?.countryId ?? s.hero.nationality
  const comps = s.world.competitions
  const goals = new Map<string, { goals: number; club: string }>()
  for (const id of [cupCompId(season, country), continentalCompId(season), continentalQualifyingCompId(season)]) {
    for (const f of comps[id]?.fixtures ?? []) {
      for (const g of f.result?.scorers ?? []) {
        if (g.ownGoal) continue
        const e = goals.get(g.playerId) ?? { goals: 0, club: g.team === 'home' ? f.homeId : f.awayId }
        e.goals++
        goals.set(g.playerId, e)
      }
    }
  }
  const scorers = [...goals.entries()].sort((a, b) => b[1].goals - a[1].goals || (a[0] < b[0] ? -1 : 1)).slice(0, 10).map(([id, e]) => {
    const p = s.world.players[id]
    const name = id === 'hero' ? `${s.hero.firstName} ${s.hero.lastName}` : p ? `${p.firstName} ${p.lastName}` : '—'
    return { id, name, club: teamViewOr(s, e.club), goals: e.goals, isHero: id === 'hero' }
  })
  return {
    domestic: cupView(s, comps[cupCompId(season, country)]),
    continental: cupView(s, comps[continentalCompId(season)]),
    qualifying: cupView(s, comps[continentalQualifyingCompId(season)]),
    playoff: club ? cupView(s, comps[playoffCompId(season, club.leagueId)]) : null,
    coefficients: coefficientRanking(s.world).map((c) => ({ country: c.countryId, name: s.world.countries[c.countryId]!.name, flag: s.world.countries[c.countryId]!.flag, total: c.total, seasons: c.seasons })),
    scorers,
  }
}

export interface DrawView {
  compId: string
  compName: LText
  round: LText
  twoLegged: boolean
  seeded: TeamView[]
  pairs: { home: TeamView; away: TeamView; heroTeam: boolean }[]
}

/** The latest draw of a competition (default: the hero's domestic cup). */
export function drawView(compId?: string): DrawView | null {
  const s = S()
  if (!s) return null
  const season = fixtureSeason(s)
  const club = s.hero.contract ? s.world.clubs[s.hero.contract.clubId] : null
  const id = compId ?? cupCompId(season, club?.countryId ?? s.hero.nationality)
  const comp = s.world.competitions[id]
  const d: DrawRecord | undefined = comp?.meta?.draws?.[comp.meta.draws.length - 1]
  if (!comp || !d) return null
  const mine = new Set([club?.id ?? '', s.world.national?.hero.teamId ?? ''])
  return {
    compId: id, compName: comp.name, round: roundLabel(comp, d.round), twoLegged: !!d.twoLegged,
    seeded: (d.seeded ?? []).map((x) => teamViewOr(s, x)),
    pairs: d.pairs.map(([h, a]) => ({ home: teamViewOr(s, h), away: teamViewOr(s, a), heroTeam: mine.has(h) || mine.has(a) })),
  }
}

/** Competitions with a draw the hero may want to watch (current season). */
export function drawableComps(): { id: string; name: LText }[] {
  const s = S()
  if (!s) return []
  const season = fixtureSeason(s)
  return Object.values(s.world.competitions).filter((c) => c.season === season && (c.meta?.draws?.length ?? 0) > 0).map((c) => ({ id: c.id, name: c.name }))
}

// ───────────────────────── Awards ─────────────────────────

export interface AwardsView {
  pending: number | null
  star: GoldenStarResult | null
  record: SeasonAwardRecord | null
  months: (MonthAward & { monthName: LText; leagueName: string })[]
  history: { season: number; winner: string; club: TeamView | null; isHero: boolean }[]
  heroRank: number | null
}

export function awardsView(season?: number): AwardsView | null {
  const s = S()
  if (!s) return null
  const aw = s.world.awards
  const stars = aw?.goldenStar ?? []
  const target = season ?? pendingCeremony(s) ?? stars[stars.length - 1]?.season
  const star = stars.find((g) => g.season === target) ?? null
  const record = aw?.seasons.find((r) => r.season === target) ?? null
  const heroLeague = s.hero.contract ? s.world.clubs[s.hero.contract.clubId]?.leagueId : undefined
  const months = (aw?.months ?? []).filter((m) => !heroLeague || m.leagueId === heroLeague || m.isHero).slice(-10).reverse()
    .map((m) => ({ ...m, monthName: monthName(m.month), leagueName: s.world.leagues[m.leagueId]?.name ?? '' }))
  const rank = star ? star.ranking.findIndex((c) => c.isHero) : -1
  return {
    pending: pendingCeremony(s), star, record, months,
    history: stars.slice().reverse().map((g) => ({ season: g.season, winner: g.ranking[0]?.name ?? '—', club: g.ranking[0]?.clubId ? teamViewOr(s, g.ranking[0].clubId) : null, isHero: !!g.ranking[0]?.isHero })),
    heroRank: rank >= 0 ? rank + 1 : null,
  }
}

export function markCeremonySeen(): void {
  const s = S()
  if (!s) return
  markSeen(s)
  commit(s)
}

/** Did the hero's club just get a fresh draw it has not seen? (Home teaser.) */
export function heroTieOfLatestDraw(): { compId: string; name: LText; opp: TeamView; home: boolean } | null {
  const s = S()
  if (!s) return null
  const clubId = s.hero.contract?.clubId
  if (!clubId) return null
  const season = fixtureSeason(s)
  for (const c of Object.values(s.world.competitions)) {
    if (c.season !== season || c.type === 'league' || c.type === 'international') continue
    const d = c.meta?.draws?.[c.meta.draws.length - 1]
    const pair = d?.pairs.find(([h, a]) => h === clubId || a === clubId)
    if (!d || !pair) continue
    const f = c.fixtures.find((x) => x.round === d.round && (x.homeId === clubId || x.awayId === clubId) && (x.leg ?? 1) === 1)
    if (!f || f.result || tieWinner(c, f)) continue
    const oppId = pair[0] === clubId ? pair[1] : pair[0]
    return { compId: c.id, name: c.name, opp: teamViewOr(s, oppId), home: pair[0] === clubId }
  }
  return null
}

export { parseTeamId }
