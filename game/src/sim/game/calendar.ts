/**
 * Time: slots → days → weeks → seasons.
 *
 * A day ends with (1) the hero's unplayed match auto-simulated if the UI did
 * not play it, (2) every AI fixture of that day, then the calendar moves on.
 * Crossing Sunday → Monday runs the weekly tick (economy, sponsors, social,
 * relations, trust, injury, ageing, casino, wellbeing, world upkeep, role
 * review) and then the new week's hooks (winter AI window, end of season,
 * new season, call-ups / international break, offers, weekly event roll).
 * The new day starts with startDay + the casino daily reset.
 */
import { recordEconomy } from './financeHistory'
import type { GameState, LText } from '../../core/types'
import type { Rng } from '../../core/rng'
import { DAYS_PER_WEEK, SLOTS_PER_DAY } from '../../core/config'
import { absWeek } from '../career/common'
import { weeklyInjuryTick, weeklySharpnessDecay } from '../career/condition'
import { weeklyAging } from '../career/progression'
import { evaluateRoleChange, weeklyTrustTick } from '../career/squadRole'
import { autoPlanDay, performActivity, physioSessionsThisWeek, startDay } from '../life/activities'
import { resetCasinoDay, weeklyCasinoTick } from '../life/casino'
import { assetHappiness, incomeTaxRate, weeklyEconomy } from '../life/economy'
import { weeklyRelationDecay } from '../life/relationships'
import { weeklySocialTick } from '../life/social'
import { weeklySponsorTick } from '../life/sponsors'
import { weeklyWellbeing } from '../life/wellbeing'
import {
  END_OF_SEASON_WEEK, INTERNATIONAL_BREAK_WEEKS, SEASON_WEEKS, SQUAD_ANNOUNCE_WEEKS, WINTER_WINDOW_WEEK,
} from '../world/fixtures'
import { clubStrength } from '../world/queries'
import { aiTransferWindow, playFixturesFor, weeklyTick } from '../world/season'
import { rollEvents } from './eventsAdapter'
import {
  GFLAG, activityContext, emptyWeek, recordTransfers, heroAvailableFor, heroClub, isInSeason, isOffSeason, log, logAll,
  readJson, transferWindow, unplayedHeroFixtureToday, weekCounters, withRng, writeJson,
} from './internal'
import { autoPlayHeroMatch, clearActiveMatch, HERO_ID } from './match'
import {
  endSeasonForHero, evaluateNationalTeam, generateHeroOffers, generateSponsorOffers, getOffers, newSeasonRollover,
  syncClubRelations, syncEventFlags,
} from './season'
import { announceHeroSquad, checkNationalTrophies, onSeniorDuty } from './national'
import { monthlyAwards, isMonthAwardWeek } from './awards'
import { objectivesDaily, objectivesSeasonEnd, objectivesWeekly } from './objectives'

export type StopReason = 'event' | 'offer' | 'match' | 'season_end' | 'retired' | 'limit'

/** What happened while time advanced. */
export interface AdvanceReport {
  lines: LText[]
  /** Days completed. */
  days: number
  newEvents: number
  newOffers: number
  /** The hero has an unplayed match today (after advancing). */
  matchday: boolean
  seasonEnded: boolean
  newSeason: boolean
  stoppedBy?: StopReason
}

const emptyReport = (): AdvanceReport => ({ lines: [], days: 0, newEvents: 0, newOffers: 0, matchday: false, seasonEnded: false, newSeason: false })

/** True when the hero should play a match today (unplayed fixture, available). */
export const isHeroMatchday = (state: GameState): boolean => heroAvailableFor(state, unplayedHeroFixtureToday(state))

/** Move one slot forward; after the evening slot the day ends ({@link advanceDay}). */
export function advanceSlot(state: GameState): AdvanceReport {
  if (state.calendar.slot < SLOTS_PER_DAY - 1) {
    state.calendar.slot++
    const r = emptyReport()
    r.matchday = isHeroMatchday(state)
    return r
  }
  return advanceDay(state)
}

/** Finish today and start tomorrow (see module comment for the order). */
export function advanceDay(state: GameState): AdvanceReport {
  const r = emptyReport()
  const events0 = state.pendingEvents.length
  const offers0 = getOffers(state).length

  // 1. Hero match not played by the UI → simulate it.
  if (isHeroMatchday(state)) {
    const rep = autoPlayHeroMatch(state)
    if (rep) r.lines.push(...rep.lines)
  }
  withRng(state, (rng) => {
    const cal = state.calendar
    // Hero's club plays without him (injured / suspended): serve the ban.
    const missed = unplayedHeroFixtureToday(state)
    if (missed && !missed.national && state.hero.suspendedMatches > 0) {
      state.hero.suspendedMatches--
      log(state, r.lines, { tr: 'Cezan nedeniyle maçı tribünden izledin.', en: 'You watched the match from the stands (suspended).' }, 'career', '🚫')
    }
    // 2. AI fixtures of the day.
    // A stale prepared match (hero became unavailable) must not block the fixture.
    if (state.activeMatchId) clearActiveMatch(state)
    // Off-season days only hold the national finals tournament.
    playFixturesFor(state.world, rng, cal.season, cal.week, cal.day)
    checkNationalTrophies(state, rng, r.lines)
    if (!state.hero.retired) objectivesDaily(state, r.lines)
    // 3. Next day / week.
    cal.day++
    if (cal.day >= DAYS_PER_WEEK) {
      cal.day = 0
      weeklyHeroTick(state, rng, r.lines)
      cal.week++
      onNewWeek(state, rng, r)
    }
    cal.slot = 0
    logAll(state, r.lines, startDay(state.hero, state.life, { calendar: cal }), 'event')
    resetCasinoDay(state.life)
    r.lines.push(...syncEventFlags(state))
  })
  r.days = 1
  r.newEvents = Math.max(0, state.pendingEvents.length - events0)
  r.newOffers = Math.max(0, getOffers(state).length - offers0)
  r.matchday = isHeroMatchday(state)
  return r
}

/** Weekly tick, in the order agreed with the career/life layer. */
function weeklyHeroTick(state: GameState, rng: Rng, out: LText[]): void {
  const { hero, life, calendar: cal } = state
  const wk = weekCounters(life)
  if (!hero.retired) {
    const eco = weeklyEconomy(rng, life, hero, { calendar: cal, taxRate: incomeTaxRate(heroClub(state)?.countryId) })
    logAll(state, out, eco.lines, 'money', '💶')
    const b = eco.breakdown
    recordEconomy(life, cal, b)
    const income = b.wage + b.sponsors + b.rent + b.business + b.investmentYield + b.tax + b.agentFee
    const earned = readJson<{ season: number; total: number }>(life, GFLAG.earned, { season: cal.season, total: 0 })
    writeJson(life, GFLAG.earned, { season: cal.season, total: Math.round((earned.season === cal.season ? earned.total : 0) + Math.max(0, income)) })
    logAll(state, out, weeklySponsorTick(hero, life, cal), 'money')
    logAll(state, out, weeklySocialTick(rng, hero, life, {
      calendar: cal, avgRating: wk.rated > 0 ? wk.ratingSum / wk.rated : undefined, goalContributions: wk.contributions,
    }), 'event', '📱')
    logAll(state, out, weeklyRelationDecay(life, absWeek(cal), hero), 'relation')
    weeklyTrustTick(hero, life)
    logAll(state, out, weeklyInjuryTick(hero, physioSessionsThisWeek(life, cal)), 'injury', '🩺')
    logAll(state, out, weeklyAging(hero, cal.season), 'career')
    logAll(state, out, weeklyCasinoTick(life), 'event', '🎰')
    logAll(state, out, weeklyWellbeing(life, hero, {
      assetHappiness: assetHappiness(life), weeklyNet: eco.net, matchesPlayed: wk.matches, offSeason: isOffSeason(cal.week),
    }), 'event')
    weeklySharpnessDecay(hero, wk.minutes)
    // Role review every 4 weeks in season.
    const club = heroClub(state)
    if (club && isInSeason(cal.week) && cal.week % 4 === 0) {
      logAll(state, out, evaluateRoleChange(hero, life, { squadAvgOvr: clubStrength(state.world, club.id).overall, season: cal.season }, cal), 'career', '📋')
    }
  }
  weeklyTick(state.world)
  writeJson(life, GFLAG.week, emptyWeek())
}

/** Hooks of a freshly started week (calendar.week already incremented). */
function onNewWeek(state: GameState, rng: Rng, r: AdvanceReport): void {
  const cal = state.calendar
  const tags = ['weekly']
  if (cal.week >= SEASON_WEEKS) {
    newSeasonRollover(state, rng, r.lines)
    r.newSeason = true
    tags.push('new_season')
  }
  if (isMonthAwardWeek(cal.week)) monthlyAwards(state, rng, r.lines)
  if (cal.week === END_OF_SEASON_WEEK) {
    endSeasonForHero(state, rng, r.lines)
    objectivesSeasonEnd(state, r.lines)
    r.seasonEnded = true
    tags.push('season_end')
  }
  if (cal.week === WINTER_WINDOW_WEEK) {
    const club = heroClub(state)
    recordTransfers(state, aiTransferWindow(state.world, rng, cal.season, {
      maxPerClub: 1, intensity: 0.5, protectedClubIds: club ? new Set([club.id]) : undefined,
    }))
    syncClubRelations(state)
  }
  if (SQUAD_ANNOUNCE_WEEKS.includes(cal.week)) announceHeroSquad(state, rng, r.lines)
  else if (cal.week % 2 === 0) evaluateNationalTeam(state, rng, r.lines)
  if (onSeniorDuty(state) && (INTERNATIONAL_BREAK_WEEKS.includes(cal.week) || cal.week === END_OF_SEASON_WEEK)) tags.push('national_break')
  if (transferWindow(cal.week)) tags.push('transfer_window')
  if (!state.hero.retired) {
    r.newOffers += generateHeroOffers(state, rng, r.lines)
    generateSponsorOffers(state, rng, r.lines)
    objectivesWeekly(state, r.lines)
    rollEvents(state, rng, tags, 2)
  }
}

// ───────────────────────── Autopilot ─────────────────────────

export interface AutoAdvanceOptions {
  /** Safety cap on simulated days (default 60). */
  maxDays?: number
  /** Also stop when the season ends (default true). */
  stopAtSeasonEnd?: boolean
}

/**
 * Run the autopilot routine for the rest of today (performs the planned
 * activities and advances slots). Stops the day when the hero's match is due
 * (matchday activities still run before it). Returns lines.
 */
export function autoPlayDay(state: GameState): LText[] {
  const out: LText[] = []
  withRng(state, (rng) => {
    const ctx = activityContext(state)
    const plan = autoPlanDay(state.hero, state.life, ctx)
    for (const p of plan) {
      if (state.calendar.slot >= SLOTS_PER_DAY) break
      const c = activityContext(state)
      const res = performActivity(rng, state.hero, state.life, p.activityId, c, p.options)
      if (res.ok) logAll(state, out, res.lines.slice(0, 1), 'event')
      const used = res.ok ? Math.max(1, res.slotsUsed) : 1
      if (state.calendar.slot + used >= SLOTS_PER_DAY) { state.calendar.slot = SLOTS_PER_DAY - 1; break }
      state.calendar.slot += used
    }
  })
  return out
}

/**
 * "Advance to next match": autopilot days until the hero's matchday (stops at
 * the morning of matchday, before the match), or earlier when a decision card
 * is pending, a new offer arrives, the season ends or `maxDays` is reached.
 * If called on a matchday with the match unplayed it returns immediately
 * with `stoppedBy: 'match'`.
 */
export function advanceToNextMatch(state: GameState, opts: AutoAdvanceOptions = {}): AdvanceReport {
  const total = emptyReport()
  const maxDays = opts.maxDays ?? 60
  const stopAtSeasonEnd = opts.stopAtSeasonEnd ?? true
  if (state.hero.retired) return { ...total, stoppedBy: 'retired' }
  for (let d = 0; d < maxDays; d++) {
    if (isHeroMatchday(state)) return { ...total, matchday: true, stoppedBy: 'match' }
    if (state.pendingEvents.length > 0) return { ...total, stoppedBy: 'event' }
    total.lines.push(...autoPlayDay(state))
    if (state.pendingEvents.length > 0) return { ...total, stoppedBy: 'event' }
    const r = advanceDay(state)
    total.lines.push(...r.lines)
    total.days++
    total.newEvents += r.newEvents
    total.newOffers += r.newOffers
    total.seasonEnded ||= r.seasonEnded
    total.newSeason ||= r.newSeason
    total.matchday = r.matchday
    if (r.matchday) return { ...total, stoppedBy: 'match' }
    if (r.newEvents > 0 || state.pendingEvents.length > 0) return { ...total, stoppedBy: 'event' }
    if (r.newOffers > 0) return { ...total, stoppedBy: 'offer' }
    if (stopAtSeasonEnd && (r.seasonEnded || r.newSeason)) return { ...total, stoppedBy: 'season_end' }
  }
  return { ...total, stoppedBy: 'limit' }
}

/** Hero id used inside match setups (re-exported for UI convenience). */
export { HERO_ID }
