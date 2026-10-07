/**
 * New career: world generation (save-size aware), hero creation, first club,
 * relationships, calendar, opening log/news and the first decision card.
 */
import type { Appearance, Archetype, Background, Difficulty, Foot, GameState, Gender, Position, SquadRole } from '../../core/types'
import { Rng } from '../../core/rng'
import { SAVE_VERSION, START_YEAR } from '../../core/config'
import { COUNTRY_BY_ID, COUNTRY_DEFS } from '../../data/world/countries'
import { createHero, createLife, type FamilyNames } from '../career/createHero'
import { absWeek, fill, lt, pushLog, pushNews, NEWS_SOURCES } from '../career/common'
import { MIN_WAGE, generateContractOffer, roundNice } from '../career/contract'
import { ARRIVAL_TRUST } from '../career/transfers'
import { ROLE_NAMES, roleIndex, targetRole } from '../career/squadRole'
import { applyContract } from '../career/contract'
import { heroOvr } from '../career/progression'
import { generateWorld } from '../world/generate'
import { clubStrength } from '../world/queries'
import { ensureRelation } from '../life/relationships'
import { rollEvents } from './eventsAdapter'
import { syncClubRelations, evaluateNationalTeam } from './season'
import { clubContextOf } from './internal'
import { applyLegacyStart, type LegacyStart } from './legacy'
import { generateTrialInvites, writeTrialInvites } from './trials'

/** Input from the character-creation wizard. */
export interface NewGameInput {
  firstName: string
  lastName: string
  nickname: string
  /** Country id (must exist in COUNTRY_DEFS). */
  nationality: string
  birthYear: number
  position: Position
  foot: Foot
  archetype: Archetype
  background: Background
  appearance: Appearance
  /** Hero gender (default 'male'); the generated world's players follow it. */
  gender?: Gender
  difficulty?: Difficulty
  /** Optional family names. */
  family?: FamilyNames
  /** Save slot this career lives in (meta only). */
  slot?: number
  /**
   * Countries to simulate. Default: hero country + the 5 strongest others
   * (keeps the save < 2.5 MB). Must include the hero's country.
   */
  countryIds?: readonly string[]
  /**
   * Start with 3 trial invitations instead of an automatic first contract
   * (sim/game/trials). The hero is unattached until `resolveTrial` signs one.
   */
  trials?: boolean
  /** New Game+ "Legacy": the hero is a retired legend's child (sim/game/legacy). */
  legacy?: LegacyStart
}

/** Other countries simulated next to the hero's by default. */
export const DEFAULT_EXTRA_COUNTRIES = 5

/** Default country set: hero's + the N strongest others. */
export function defaultCountryIds(heroCountry: string, extra = DEFAULT_EXTRA_COUNTRIES): string[] {
  const others = COUNTRY_DEFS.filter((d) => d.id !== heroCountry).sort((a, b) => b.reputation - a.reputation).slice(0, extra)
  return [heroCountry, ...others.map((d) => d.id)]
}

/**
 * Pick the starting club: in the lowest tier of the hero's country, the club
 * whose starters' average OVR is closest to (hero OVR + 4) — a level where a
 * kid can break through — with some randomness among the 4 best fits.
 */
export function pickStartingClub(state: GameState, rng: Rng): string {
  const w = state.world
  const leagues = Object.values(w.leagues).filter((l) => l.countryId === state.hero.nationality)
  const lowest = leagues.sort((a, b) => b.tier - a.tier)[0]
  const ovr = heroOvr(state.hero)
  const ranked = lowest.clubIds
    .map((id) => ({ id, d: Math.abs(clubStrength(w, id).overall - (ovr + 4)) }))
    .sort((a, b) => a.d - b.d || (a.id < b.id ? -1 : 1))
  return rng.pick(ranked.slice(0, 4)).id
}

/** Options of a first contract (trials scale the role and wage). */
export interface FirstClubTerms {
  /** Force a role (default: merit, capped at rotation). */
  role?: SquadRole
  /** Wage multiplier (default 1). */
  wageMul?: number
}

/**
 * Sign the hero's first professional contract at `clubId` and set up the
 * club relationships, national-team status and opening log/news. Same RNG
 * call order as the original inline code (determinism of default careers).
 */
export function signFirstClub(state: GameState, rng: Rng, clubId: string, terms: FirstClubTerms = {}): void {
  const { world, hero, life } = state
  const club = world.clubs[clubId]
  const ctx = clubContextOf(state, clubId)
  const offer = generateContractOffer(rng, hero, { club: ctx, season: state.calendar.season, kind: 'new' })
  const merit = targetRole(hero, life, { squadAvgOvr: ctx.squadAvgOvr, season: state.calendar.season })
  const role = terms.role ?? (roleIndex(merit) > roleIndex('rotation') ? 'rotation' : merit)
  offer.terms.role = role
  offer.terms.years = Math.max(2, Math.min(3, offer.terms.years))
  offer.terms.releaseClause = null
  offer.terms.signingBonus = 0
  if (terms.wageMul !== undefined) offer.terms.wage = Math.max(MIN_WAGE, roundNice(offer.terms.wage * terms.wageMul))
  applyContract(hero, life, offer, state.calendar)
  hero.managerTrust = Math.max(hero.managerTrust, ARRIVAL_TRUST[role] - 5)

  // ── Relationships: manager, chairman, teammates ──
  const week = absWeek(state.calendar)
  ensureRelation(life, 'chairman', 'chairman', `${club.city} Başkanı / Chairman`, 5, week)
  syncClubRelations(state)
  evaluateNationalTeam(state, rng, [])

  // ── Opening log & news ──
  pushLog(life, state.calendar, fill(lt('Kariyerin başlıyor! {c} ile ilk profesyonel sözleşmeni imzaladın.', 'Your career begins! You signed your first professional contract with {c}.'), { c: club.name }), 'career', '⭐')
  pushLog(life, state.calendar, fill(lt('Hazırlık haftası. Teknik direktör {m} seni izleyecek. Rolün: {r}.', 'Pre-season week. Manager {m} will be watching you. Your role: {r}.'), { m: club.managerName, r: ROLE_NAMES[role] }), 'career', '📋')
  pushNews(life, rng, state.calendar, fill(lt('{c} genç yetenek {n}\'i kadrosuna kattı', '{c} sign young talent {n}'), { c: club.name, n: `${hero.firstName} ${hero.lastName}` }), 1, rng.pick(NEWS_SOURCES))
}

/**
 * Create a complete GameState. Deterministic for (input, seed) except
 * `meta.createdAt/updatedAt`.
 */
export function newGame(input: NewGameInput, seed: number = Date.now() >>> 0): GameState {
  if (!COUNTRY_BY_ID[input.nationality]) throw new Error(`Unknown nationality "${input.nationality}"`)
  const rng = new Rng(seed)
  const season = START_YEAR
  const countryIds = input.countryIds ? [...new Set([input.nationality, ...input.countryIds])] : defaultCountryIds(input.nationality)
  const gender: Gender = input.gender === 'female' ? 'female' : 'male'
  const world = generateWorld(rng.fork('world'), { season, heroCountryId: input.nationality, countryIds, gender })

  const hero = createHero(rng, {
    firstName: input.firstName, lastName: input.lastName, nickname: input.nickname, nationality: input.nationality,
    position: input.position, foot: input.foot, appearance: input.appearance, archetype: input.archetype,
    background: input.background, birthYear: input.birthYear, gender,
  })
  const life = createLife(rng, hero, input.background, input.family)
  const now = Date.now()
  const state: GameState = {
    version: SAVE_VERSION,
    meta: { id: rng.id('car'), slot: input.slot ?? 0, createdAt: now, updatedAt: now, playTimeSec: 0, seed, difficulty: input.difficulty ?? 'normal' },
    rng: rng.state,
    calendar: { season, week: 0, day: 0, slot: 0 },
    world,
    hero,
    life,
    pendingEvents: [],
    activeMatchId: null,
  }

  if (input.legacy) applyLegacyStart(state, input.legacy)

  if (input.trials) {
    // ── Trials: the hero picks among invitations (sim/game/trials) ──
    writeTrialInvites(state, generateTrialInvites(state, rng))
    pushLog(life, state.calendar, lt('Kariyerin başlıyor! Önünde deneme davetleri var: birini seç ve kendini göster.', 'Your career begins! Trial invitations are on the table: pick one and prove yourself.'), 'career', '⭐')
  } else {
    // ── First club: youth/rotation deal at a lowest-tier club ──
    signFirstClub(state, rng, pickStartingClub(state, rng))
  }

  // ── Welcome card (pre-season) ──
  state.rng = rng.state
  const erng = new Rng(state.rng)
  rollEvents(state, erng, ['new_season', 'weekly'], 1, 1)
  state.rng = erng.state
  return state
}
