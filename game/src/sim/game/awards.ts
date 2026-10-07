/**
 * Hero-side awards: the end-of-season award block (moved here from
 * season.ts), monthly Player of the Month, and the award ceremony state.
 *
 * Every award the hero wins becomes an `Award` entry (trophy cabinet), a log
 * line, a news headline and a reputation gain through `fameGain` (diminishing
 * returns, docs/BALANCE.md).
 */
import type { Award, GameState, LText } from '../../core/types'
import type { Rng } from '../../core/rng'
import { NEWS_SOURCES, fameGain, fill, heroAge, lt, meter, pushNews } from '../career/common'
import { heroOvr } from '../career/progression'
import {
  LAST_MONTH, MIN_AWARD_APPS, computeMonthAwards, ensureAwards, playerSeasonScore, seasonAwards, storeMonthAwards,
  type HeroAwardInput,
} from '../world/awards'
import type { EndOfSeasonSummary } from '../world/season'
import { squadPlayers } from '../world/queries'
import { heroAwardYearInternational } from './national'
import { heroClub, log } from './internal'

export const AWARD_NAMES: Record<string, LText> = {
  golden_star: lt('Altın Yıldız', 'Golden Star'),
  golden_star_podium: lt('Altın Yıldız Podyumu', 'Golden Star Podium'),
  player_of_season: lt('Ligin En İyi Oyuncusu', 'League Player of the Season'),
  top_scorer: lt('Gol Kralı', 'Golden Boot'),
  league_top_scorer: lt('Lig Gol Kralı', 'League Top Scorer'),
  young_player: lt('Yılın Genç Oyuncusu', 'Young Player of the Year'),
  golden_glove: lt('Altın Eldiven', 'Golden Glove'),
  goal_of_season: lt('Yılın Golü', 'Goal of the Season'),
  team_of_season: lt('Sezonun 11\'i', 'Team of the Season'),
  player_of_month: lt('Ayın Oyuncusu', 'Player of the Month'),
}

/** Reputation (before diminishing returns) per award. */
export const AWARD_FAME: Readonly<Record<string, number>> = {
  golden_star: 8, golden_star_podium: 2, player_of_season: 3, top_scorer: 3, league_top_scorer: 2, young_player: 3,
  golden_glove: 2, goal_of_season: 1.5, team_of_season: 1, player_of_month: 0.5,
}

const MONTHS: readonly LText[] = [
  lt('Ağustos', 'August'), lt('Eylül', 'September'), lt('Ekim', 'October'), lt('Kasım', 'November'), lt('Aralık', 'December'),
  lt('Ocak', 'January'), lt('Şubat', 'February'), lt('Mart', 'March'), lt('Nisan', 'April'), lt('Mayıs', 'May'),
]
export const monthName = (m: number): LText => MONTHS[Math.max(0, Math.min(MONTHS.length - 1, m))]

/** The hero as an award candidate. */
export function heroAwardInput(state: GameState): HeroAwardInput {
  const h = state.hero
  const intl = heroAwardYearInternational(state)
  return {
    name: `${h.firstName} ${h.lastName}`, clubId: h.contract?.clubId ?? null, nationality: h.nationality, position: h.position,
    ovr: heroOvr(h), age: heroAge(h, state.calendar.season), stats: { ...h.seasonStats }, intlCaps: intl.caps, intlGoals: intl.goals,
  }
}

function grant(state: GameState, rng: Rng, out: LText[], season: number, key: string, name?: LText): Award {
  const a: Award = { season, key, name: name ?? AWARD_NAMES[key] ?? lt(key, key) }
  const h = state.hero
  h.awards.push(a)
  h.reputation = meter(h.reputation + fameGain(h.reputation, AWARD_FAME[key] ?? 1))
  log(state, out, fill(lt('🏆 Ödül: {a}!', '🏆 Award: {a}!'), { a: a.name }), 'award', '🏆')
  pushNews(state.life, rng, state.calendar, fill(lt('{n} {a} ödülünü kazandı', '{n} wins the {a}'), { n: `${h.firstName} ${h.lastName}`, a: a.name }), 1, rng.pick(NEWS_SOURCES))
  return a
}

// ───────────────────────── Player of the Month ─────────────────────────

/** Weeks that open a new award month (the previous month is awarded): 5, 9 … 37 and the season close (42). */
export function isMonthAwardWeek(week: number): boolean {
  return week === 42 || (week >= 5 && week <= 37 && (week - 1) % 4 === 0)
}

/** Award month that ends when `week` starts. */
export const awardedMonth = (week: number): number => (week === 42 ? LAST_MONTH : (week - 5) / 4)

/**
 * Player of the Month for every league from the month's real fixture data.
 * The hero's league winner lands in the inbox (news); a hero win is an Award.
 */
export function monthlyAwards(state: GameState, rng: Rng, out: LText[]): void {
  const w = state.world
  const cal = state.calendar
  const month = awardedMonth(cal.week)
  const list = computeMonthAwards(w, cal.season, month, heroAwardInput(state))
  storeMonthAwards(w, list)
  const club = heroClub(state)
  const leagueId = club?.leagueId
  const mine = list.find((a) => a.leagueId === leagueId)
  if (!mine || !leagueId) return
  const lname = w.leagues[leagueId]?.name ?? ''
  const label = fill(lt('{l} · {m} Ayın Oyuncusu', '{l} · {m} Player of the Month'), { l: lname, m: monthName(month) })
  if (mine.isHero) {
    grant(state, rng, out, cal.season, 'player_of_month', fill(lt('Ayın Oyuncusu ({m})', 'Player of the Month ({m})'), { m: monthName(month) }))
  } else {
    pushNews(state.life, rng, cal, fill(lt('{l}: {n} seçildi ({g} gol, {a} asist)', '{l}: {n} ({g} goals, {a} assists)'), { l: label, n: mine.name, g: mine.goals, a: mine.assists }), 0, rng.pick(NEWS_SOURCES))
  }
}

// ───────────────────────── Season awards ─────────────────────────

/** Awards that compare the hero with NPC season stats (computed before the world resets them). */
export interface PreSeasonAwards {
  keys: string[]
}

/** League player of the season and scoring titles (needs NPC stats, so call before endOfSeason). */
export function preSeasonAwards(state: GameState): PreSeasonAwards {
  const w = state.world
  const h = state.hero
  const season = state.calendar.season
  const club = heroClub(state)
  const league = club ? w.leagues[club.leagueId] : null
  const s = h.seasonStats
  const keys: string[] = []
  const awards = seasonAwards(w, season)
  const score = playerSeasonScore(s, heroOvr(h), h.position)
  const weighted = score === null ? null : Math.round((score + (club?.reputation ?? 30) * 0.1) * 100) / 100
  if (weighted !== null && league) {
    let bestInLeague = 0
    for (const cid of league.clubIds) {
      for (const p of squadPlayers(w, cid)) {
        const sc = playerSeasonScore(p.stats, p.ovr, p.position)
        if (sc !== null) bestInLeague = Math.max(bestInLeague, sc + (w.clubs[cid]?.reputation ?? 30) * 0.1)
      }
    }
    if (weighted > bestInLeague) keys.push('player_of_season')
  }
  if (s.goals > 0 && s.apps >= MIN_AWARD_APPS / 2) {
    if (!awards.topScorer || s.goals > awards.topScorer.value) keys.push('top_scorer')
    const lts = league ? awards.leagueTopScorers[league.id] : undefined
    if (league && (!lts || s.goals > lts.value)) keys.push('league_top_scorer')
  }
  return { keys }
}

/**
 * Grant the hero's season awards after the world's award computation
 * (Golden Star vote, Golden Glove, Young Player, Goal and Team of the Season).
 */
export function grantSeasonAwards(state: GameState, rng: Rng, out: LText[], season: number, pre: PreSeasonAwards, summary: EndOfSeasonSummary): Award[] {
  const given: Award[] = []
  const star = summary.goldenStar.ranking
  const heroRank = star.findIndex((c) => c.isHero)
  if (heroRank === 0) given.push(grant(state, rng, out, season, 'golden_star'))
  else if (heroRank === 1 || heroRank === 2) {
    given.push(grant(state, rng, out, season, 'golden_star_podium', heroRank === 1 ? lt('Altın Yıldız 2.si', 'Golden Star runner-up') : lt('Altın Yıldız 3.sü', 'Golden Star third place')))
  }
  for (const k of pre.keys) given.push(grant(state, rng, out, season, k))
  const r = summary.awardRecord
  if (r.youngPlayer?.isHero) given.push(grant(state, rng, out, season, 'young_player'))
  if (r.goldenGlove?.isHero) given.push(grant(state, rng, out, season, 'golden_glove'))
  if (r.goalOfSeason?.isHero) given.push(grant(state, rng, out, season, 'goal_of_season'))
  if (r.teamOfSeason.some((p) => p.isHero)) given.push(grant(state, rng, out, season, 'team_of_season'))
  if (heroRank >= 0) log(state, out, fill(lt('Altın Yıldız oylamasında {n}. oldun.', 'You finished #{n} in the Golden Star vote.'), { n: heroRank + 1 }), 'award', '⭐')
  return given
}

/** Season whose award ceremony has not been watched yet (null if none). */
export function pendingCeremony(state: GameState): number | null {
  return state.world.awards?.ceremonyPending ?? null
}

/** Mark the ceremony as watched. */
export function markCeremonySeen(state: GameState): void {
  ensureAwards(state.world).ceremonyPending = null
}
