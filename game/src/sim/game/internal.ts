/**
 * Shared plumbing for the game façade: RNG threading, JSON blobs stored in
 * `life.flags` (so no core type changes are needed), and calendar/fixture
 * queries every façade module uses.
 *
 * Flag namespace: every key written by this layer starts with `g:`.
 */
import type { Club, Competition, Fixture, GameState, Life, LText } from '../../core/types'
import { Rng } from '../../core/rng'
import { absWeek, pushLog } from '../career/common'
import type { LogEntry } from '../../core/types'
import {
  DAYS_PER_WEEK,
} from '../../core/config'
import { END_OF_SEASON_WEEK, FIRST_MATCH_WEEK, LAST_MATCH_WEEK, SEASON_WEEKS, WINTER_WINDOW_WEEK } from '../world/fixtures'
import { clubStrength, seasonCompetitions } from '../world/queries'
import { nationalCompetitions } from '../world/national'
import type { ClubContext } from '../career/contract'
import type { ActivityContext } from '../life/activities'

/** life.flags keys owned by the game layer. */
export const GFLAG = {
  /** JSON {@link ActiveMatchBlob}: prepared/in-progress hero match. */
  match: 'g:match',
  /** JSON TransferOffer[] (transfers, loans, free-agent and renewal offers). */
  offers: 'g:offers',
  /** JSON SponsorOffer[]. */
  sponsorOffers: 'g:sponsorOffers',
  /** JSON {offerId, state: NegotiationState}. */
  negotiation: 'g:nego',
  /** JSON BlackjackRound in progress. */
  blackjack: 'g:bj',
  /** JSON RaceCard shown before a horse bet. */
  race: 'g:race',
  /** Absolute day of the last casino visit (games allowed that day). */
  casinoDay: 'g:casinoDay',
  /** JSON {@link WeekCounters}. */
  week: 'g:week',
  /** JSON {@link SeasonDigest} of the last finished season. */
  lastSeason: 'g:lastSeason',
  /** Last absolute week a renewal offer was declined. */
  renewalDeclined: 'g:renewalDeclined',
  /** Whether the events `nt_called` flag was seen last sync. */
  ntSeen: 'g:ntSeen',
  /** Absolute week of the last AI winter window run. */
  winterDone: 'g:winterDone',
  /** JSON {@link NotableTransfer}[]: biggest recent AI transfers (newest window first). */
  transfers: 'g:transfers',
  /** JSON {season, total}: after-tax income earned this season (weekly economy). */
  earned: 'g:earned',
} as const

/** A transfer worth a headline (stored for the UI's transfer news). */
export interface NotableTransfer {
  playerId: string
  name: string
  fromClubId: string | null
  toClubId: string
  fee: number
  season: number
  week: number
}

/** Keep the biggest transfers of an AI window (max 12 per window, 24 overall). */
export function recordTransfers(state: GameState, records: readonly { playerId: string; fromClubId: string | null; toClubId: string; fee: number; season: number }[]): void {
  const top = [...records].sort((a, b) => b.fee - a.fee).slice(0, 12).map((r): NotableTransfer => {
    const p = state.world.players[r.playerId]
    return { ...r, name: p ? `${p.firstName} ${p.lastName}` : r.playerId, week: state.calendar.week }
  })
  if (top.length === 0) return
  const prev = readJson<NotableTransfer[]>(state.life, GFLAG.transfers, [])
  writeJson(state.life, GFLAG.transfers, [...top, ...prev].slice(0, 24))
}

export function readJson<T>(life: Life, key: string, fallback: T): T {
  const raw = life.flags[key]
  if (typeof raw !== 'string') return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeJson(life: Life, key: string, value: unknown): void {
  if (value === null || value === undefined) delete life.flags[key]
  else life.flags[key] = JSON.stringify(value)
}

/**
 * Run `fn` with an Rng restored from `state.rng` and write the advanced state
 * back afterwards (also on throw), so every façade call is reproducible.
 */
export function withRng<T>(state: GameState, fn: (rng: Rng) => T): T {
  const rng = new Rng(state.rng)
  try {
    return fn(rng)
  } finally {
    state.rng = rng.state
  }
}

/** Per-week counters the weekly tick consumes (social growth, wellbeing, sharpness). */
export interface WeekCounters {
  minutes: number
  matches: number
  ratingSum: number
  rated: number
  contributions: number
}

export const emptyWeek = (): WeekCounters => ({ minutes: 0, matches: 0, ratingSum: 0, rated: 0, contributions: 0 })

export const weekCounters = (life: Life): WeekCounters => readJson(life, GFLAG.week, emptyWeek())

/** Push to the life log and collect the line. */
export function log(state: GameState, out: LText[], text: LText, kind?: LogEntry['kind'], icon?: string): void {
  pushLog(state.life, state.calendar, text, kind, icon)
  out.push(text)
}

/** Log several lines with the same kind. */
export function logAll(state: GameState, out: LText[], lines: readonly LText[], kind?: LogEntry['kind'], icon?: string): void {
  for (const l of lines) log(state, out, l, kind, icon)
}

// ───────────────────────── Calendar helpers ─────────────────────────

export const isInSeason = (week: number): boolean => week >= FIRST_MATCH_WEEK && week <= LAST_MATCH_WEEK
export const isOffSeason = (week: number): boolean => week >= END_OF_SEASON_WEEK
/** Absolute day index (matches life/activities `absDay`). */
export const absDayOf = (state: GameState): number => absWeek(state.calendar) * DAYS_PER_WEEK + state.calendar.day

export type WindowKind = 'summer' | 'winter' | null

/**
 * Transfer window open in a given week: summer = off-season + preseason, winter = weeks 22–25
 * (4 weeks, 2.3#70). Any league may buy in either window (no "same league only in winter").
 */
export function transferWindow(week: number): WindowKind {
  if (week >= END_OF_SEASON_WEEK || week === 0) return 'summer'
  if (week - WINTER_WINDOW_WEEK >= -1 && week - WINTER_WINDOW_WEEK <= 2) return 'winter'
  return null
}

/** Season whose competitions hold upcoming fixtures (next season during the off-season). */
export const fixtureSeason = (state: GameState): number =>
  isOffSeason(state.calendar.week) ? state.calendar.season + 1 : state.calendar.season

export function heroClub(state: GameState): Club | null {
  const id = state.hero.contract?.clubId
  return id ? state.world.clubs[id] ?? null : null
}

export interface HeroFixture {
  competition: Competition
  fixture: Fixture
  /** International fixture of the national team the hero is called up to. */
  national?: boolean
}

/**
 * The hero's fixture on (week, day) of the current season, if any: his club's
 * game, or an international of the squad he is called up to (breaks and the
 * off-season finals never overlap club games).
 */
export function heroFixtureOn(state: GameState, week: number, day: number): HeroFixture | null {
  const club = heroClub(state)
  if (club && !isOffSeason(week)) {
    for (const comp of seasonCompetitions(state.world, state.calendar.season)) {
      if (comp.type === 'international') continue
      for (const f of comp.fixtures) {
        if (f.week === week && f.day === day && (f.homeId === club.id || f.awayId === club.id)) return { competition: comp, fixture: f }
      }
    }
  }
  const teamId = state.world.national?.hero.teamId
  if (teamId && !state.hero.retired) {
    for (const comp of nationalCompetitions(state.world, state.calendar.season)) {
      for (const f of comp.fixtures) {
        if (f.week === week && f.day === day && (f.homeId === teamId || f.awayId === teamId)) return { competition: comp, fixture: f, national: true }
      }
    }
  }
  return null
}

/** Today's hero-club fixture that still has no result. */
export function unplayedHeroFixtureToday(state: GameState): HeroFixture | null {
  const f = heroFixtureOn(state, state.calendar.week, state.calendar.day)
  return f && !f.fixture.result ? f : null
}

/** Can the hero take part in a match right now? */
export function heroAvailable(state: GameState): boolean {
  const h = state.hero
  return !h.retired && !!h.contract && !h.injury && h.suspendedMatches <= 0 && !!heroClub(state)
}

/** Availability for a given fixture: club bans do not apply to internationals (no contract needed either). */
export function heroAvailableFor(state: GameState, ref: HeroFixture | null): boolean {
  if (!ref) return false
  if (ref.national) return !state.hero.retired && !state.hero.injury
  return heroAvailable(state)
}

/** Activity context for the current slot. */
export function activityContext(state: GameState): ActivityContext {
  const cal = state.calendar
  const today = heroFixtureOn(state, cal.week, cal.day)
  const nd = cal.day + 1
  const tomorrow = nd < DAYS_PER_WEEK ? heroFixtureOn(state, cal.week, nd) : cal.week + 1 < SEASON_WEEKS ? heroFixtureOn(state, cal.week + 1, 0) : null
  return {
    calendar: { ...cal },
    inSeason: isInSeason(cal.week),
    matchToday: !!today && !today.fixture.result,
    matchTomorrow: !!tomorrow,
  }
}

/** Club context for contract maths (squad strength = best-XI average). */
export function clubContextOf(state: GameState, clubId: string): ClubContext {
  const c = state.world.clubs[clubId]!
  return { clubId, clubName: c.name, reputation: c.reputation, squadAvgOvr: clubStrength(state.world, clubId).overall, wageBudget: c.wageBudget }
}
