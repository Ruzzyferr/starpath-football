/**
 * Read-only selectors for the UI: save-slot summary and the dashboard.
 */
import type { GameState, LText, NewsItem, PendingEvent } from '../../core/types'
import type { SaveSummary } from '../../state/save'
import { DAYS_PER_WEEK } from '../../core/config'
import { heroAge } from '../career/common'
import { heroOvr } from '../career/progression'
import type { TransferOffer } from '../career/transfers'
import type { SponsorOffer } from '../life/sponsors'
import { netWorth } from '../life/economy'
import { SEASON_WEEKS } from '../world/fixtures'
import { leagueTableFor, nextFixtureFor } from '../world/queries'
import { GFLAG, fixtureSeason, heroClub, isInSeason, isOffSeason, readJson, transferWindow, type WindowKind } from './internal'
import type { SeasonDigest } from './season'
import { getOffers, getSponsorOffers } from './season'
import { isHeroMatchday } from './calendar'

/** Save-slot card info (matches state/save SaveSummary). */
export function saveSummary(state: GameState): SaveSummary {
  const h = state.hero
  const crest = heroClub(state)?.crest
  return {
    heroName: `${h.firstName} ${h.lastName}`,
    clubName: heroClub(state)?.name ?? (h.retired ? 'Retired' : 'Free agent'),
    season: state.calendar.season,
    week: state.calendar.week,
    ovr: heroOvr(h),
    money: Math.round(state.life.money),
    playTimeSec: state.meta.playTimeSec,
    ...(crest ? { crest } : {}),
  }
}

export interface NextFixtureInfo {
  fixtureId: string
  compId: string
  compName: LText
  compType: string
  opponentId: string
  opponentName: string
  isHome: boolean
  season: number
  week: number
  day: number
  /** 0 = today. */
  daysUntil: number
}

export interface Dashboard {
  calendar: GameState['calendar']
  inSeason: boolean
  transferWindow: WindowKind
  hero: { name: string; age: number; ovr: number; form: number; morale: number; fatigue: number; injured: boolean; suspended: number; role: string | null; trust: number }
  club: { id: string; name: string; shortName: string } | null
  league: { name: string; position: number; played: number; points: number; teams: number } | null
  /** Last results of the hero's club in the league, oldest first. */
  form: ('W' | 'D' | 'L')[]
  nextFixture: NextFixtureInfo | null
  matchToday: boolean
  money: number
  netWorth: number
  energy: number
  pending: { events: number; offers: number; sponsorOffers: number; negotiation: boolean }
  pendingEvents: PendingEvent[]
  offers: TransferOffer[]
  sponsorOffers: SponsorOffer[]
  latestNews: NewsItem[]
  lastSeason: SeasonDigest | null
}

/** Next unplayed fixture of the hero's club (today included), across the season boundary. */
export function nextHeroFixture(state: GameState): NextFixtureInfo | null {
  const club = heroClub(state)
  if (!club) return null
  const cal = state.calendar
  const season = fixtureSeason(state)
  const sameSeason = season === cal.season
  const ref = sameSeason ? nextFixtureFor(state.world, club.id, season, cal.week, cal.day) : nextFixtureFor(state.world, club.id, season, 0, 0)
  if (!ref) return null
  const f = ref.fixture
  const isHome = f.homeId === club.id
  const oppId = isHome ? f.awayId : f.homeId
  const daysUntil = sameSeason
    ? (f.week - cal.week) * DAYS_PER_WEEK + (f.day - cal.day)
    : (SEASON_WEEKS - cal.week + f.week) * DAYS_PER_WEEK + (f.day - cal.day)
  return {
    fixtureId: f.id, compId: ref.competition.id, compName: ref.competition.name, compType: ref.competition.type,
    opponentId: oppId, opponentName: state.world.clubs[oppId]?.name ?? oppId, isHome, season, week: f.week, day: f.day, daysUntil,
  }
}

/** Everything the home screen shows. */
export function dashboard(state: GameState): Dashboard {
  const h = state.hero
  const club = heroClub(state)
  const cal = state.calendar
  const tableSeason = isOffSeason(cal.week) ? cal.season + 1 : cal.season
  const t = club ? leagueTableFor(state.world, club.id, tableSeason) ?? leagueTableFor(state.world, club.id, cal.season) : null
  const row = t && club ? t.rows.find((r) => r.clubId === club.id) : undefined
  const offers = getOffers(state)
  const sponsorOffers = getSponsorOffers(state)
  return {
    calendar: { ...cal },
    inSeason: isInSeason(cal.week),
    transferWindow: transferWindow(cal.week),
    hero: {
      name: `${h.firstName} ${h.lastName}`, age: heroAge(h, cal.season), ovr: heroOvr(h), form: Math.round(h.form), morale: Math.round(h.morale),
      fatigue: Math.round(h.fatigue), injured: !!h.injury, suspended: h.suspendedMatches, role: h.contract?.role ?? null, trust: Math.round(h.managerTrust),
    },
    club: club ? { id: club.id, name: club.name, shortName: club.shortName } : null,
    league: t && row ? { name: state.world.leagues[club?.leagueId ?? '']?.name ?? '', position: t.position, played: row.p, points: row.pts, teams: t.rows.length } : null,
    form: row ? [...row.form] : [],
    nextFixture: nextHeroFixture(state),
    matchToday: isHeroMatchday(state),
    money: Math.round(state.life.money),
    netWorth: Math.round(netWorth(state.life, cal)),
    energy: Math.round(state.life.energy),
    pending: { events: state.pendingEvents.length, offers: offers.length, sponsorOffers: sponsorOffers.length, negotiation: state.life.flags[GFLAG.negotiation] !== undefined },
    pendingEvents: state.pendingEvents,
    offers,
    sponsorOffers,
    latestNews: state.life.news.slice(-5).reverse(),
    lastSeason: readJson<SeasonDigest | null>(state.life, GFLAG.lastSeason, null),
  }
}
