/**
 * Procedural world generation: countries → leagues → clubs → squads, free
 * agents, and the first season's competitions. Fully deterministic per Rng.
 *
 * Id scheme: league `<CC><tier>` (e.g. "TR1"), club `<CC>-<nn>`, player
 * `p<n>` (initial world). Later-created players use season-scoped prefixes
 * (see season.ts).
 */
import type {
  Club, CrestSpec, Formation, Gender, League, NpcPlayer, Position, TacticStyle, World,
} from '../../core/types'
import { worldGender } from '../../core/gender'
import { clamp } from '../../core/rng'
import type { Rng } from '../../core/rng'
import { COUNTRY_BY_ID, COUNTRY_DEFS, toCountry } from '../../data/world/countries'
import type { CountryDef } from '../../data/world/countries'
import {
  CITIES, CLUB_PATTERNS, NAME_POOLS, STADIUM_PATTERNS, formatPattern, isRealClubName, normalizeClubName,
} from '../../data/world/names'
import { generateKits } from './colors'
import { createSeasonCompetitions } from './competitions'
import { createNationalCompetitions, ensureNational } from './national'
import { ensureCoefficients } from './coefficients'
import { FORMATION_SLOTS, slotCount } from './formations'
import {
  budgetForReputation, createNpcPlayer, pickForeignNationality, randomName, randomPosition, rollPotential,
} from './players'

export interface GenerateWorldOptions {
  /** Year the first season starts. */
  season: number
  /** The hero's country gets a third tier. */
  heroCountryId: string
  /** Restrict the world to these countries (default: all). Must include the hero country. */
  countryIds?: readonly string[]
  /** Players' gender (follows the hero). Default 'male'. */
  gender?: Gender
}

export const FREE_AGENT_COUNT = 150
export const RELEGATION_SPOTS = 3
export const MIN_SQUAD = 24
export const MAX_SQUAD = 28
export const HERO_COUNTRY_TIERS = 3
export const DEFAULT_TIERS = 2

/** Number of clubs in a league of a given tier for a country of given reputation. */
export function leagueSize(countryRep: number, tier: number): number {
  if (tier === 1) return countryRep >= 80 ? 20 : countryRep >= 70 ? 18 : 16
  if (tier === 2) return countryRep >= 75 ? 18 : 16
  return 16
}

/**
 * Player-level band (club "level" = typical starter OVR) for a tier of a
 * country: strong top flights ≈ 70–84, the hero's third tier ≈ 47–60.
 */
export function tierLevelRange(countryRep: number, tier: number): { lo: number; hi: number } {
  const hi = 50 + countryRep * 0.38 - (tier - 1) * 9
  return { lo: hi - 13, hi }
}

const FORMATION_WEIGHTS: readonly { v: Formation; w: number }[] = [
  { v: '4-2-3-1', w: 25 }, { v: '4-3-3', w: 25 }, { v: '4-4-2', w: 18 }, { v: '4-1-4-1', w: 10 },
  { v: '3-5-2', w: 8 }, { v: '3-4-3', w: 8 }, { v: '5-3-2', w: 6 },
]
const STYLES: readonly TacticStyle[] = ['possession', 'counter', 'direct', 'pressing', 'defensive', 'balanced']
const EXTRA_POSITIONS: readonly Position[] = ['CB', 'CM', 'ST', 'DM', 'AM', 'LB', 'RB', 'LW', 'RW']
const CREST_SHAPES: readonly CrestSpec['shape'][] = ['shield', 'circle', 'diamond', 'hexagon', 'banner']
const CREST_SYMBOLS = 12
const GENERIC_TOKENS = new Set(['FC', 'SC', 'CF', 'AC', 'AS', 'US', 'SS', 'CD', 'UD', 'SD', 'SV', 'VV', 'FK', 'SK', 'GD', 'VFB', 'VFL', 'TSV', 'AFC', 'RKC', 'SPVGG', '1.', 'DE', 'CLUB', 'THE'])

// ───────────────────────── Shared context ─────────────────────────

interface GenContext {
  season: number
  world: World
  playerCounter: { n: number }
}

function nextPlayerId(ctx: GenContext): string {
  return `p${ctx.playerCounter.n++}`
}

interface CountryContext {
  def: CountryDef
  cityUse: Map<string, number>
  usedNames: Set<string>
  usedShort: Set<string>
  usedCrests: Set<string>
  clubCounter: number
}

// ───────────────────────── Club identity ─────────────────────────

function chooseCity(rng: Rng, cc: CountryContext, index: number): string {
  const cities = CITIES[cc.def.id] ?? ['Capital']
  // Strongest clubs take the biggest cities; once every city has a club,
  // extra clubs go to the 10 biggest cities (derbies).
  if (index < cities.length) {
    const window = cities.slice(index, Math.min(cities.length, index + 3)).filter((c) => !cc.cityUse.has(c))
    const unused = window.length ? window : cities.filter((c) => !cc.cityUse.has(c))
    if (unused.length) return rng.pick(unused)
  }
  return rng.pick(cities.slice(0, Math.min(10, cities.length)))
}

function chooseClubName(rng: Rng, cc: CountryContext, city: string): string {
  const patterns = rng.shuffle([...CLUB_PATTERNS[cc.def.nameStyle]])
  for (const p of patterns) {
    const name = formatPattern(p, { city })
    if (!cc.usedNames.has(normalizeClubName(name)) && !isRealClubName(name)) return name
  }
  for (let n = 2; ; n++) {
    const name = `${formatPattern(patterns[0], { city })} ${n}`
    if (!cc.usedNames.has(normalizeClubName(name))) return name
  }
}

function asciiUpper(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').toUpperCase().replace(/[^A-Z]/g, '')
}

function distinctiveTokens(name: string): string[] {
  return name.split(/[\s-]+/).filter((t) => t && !GENERIC_TOKENS.has(t.toUpperCase())).map(asciiUpper).filter(Boolean)
}

/** Three-letter code, unique within the country. */
function chooseShortName(cc: CountryContext, name: string, city: string): string {
  const tokens = distinctiveTokens(name)
  const c = asciiUpper(city)
  const candidates: string[] = []
  if (tokens.length >= 2) candidates.push(tokens[0][0] + tokens[1].slice(0, 2), tokens[0].slice(0, 2) + tokens[1][0])
  candidates.push(c.slice(0, 3), c[0] + c.slice(-2), c.slice(0, 2) + c.slice(-1))
  if (tokens.length) candidates.push(tokens[tokens.length - 1].slice(0, 3))
  for (const cand of candidates) if (cand.length === 3 && !cc.usedShort.has(cand)) return cand
  for (let i = 0; i < 26; i++) {
    const cand = c.slice(0, 2) + String.fromCharCode(65 + i)
    if (!cc.usedShort.has(cand)) return cand
  }
  return (c + 'XXX').slice(0, 3)
}

function crestFor(rng: Rng, cc: CountryContext, name: string, primary: string, secondary: string): CrestSpec {
  const tokens = distinctiveTokens(name)
  const initials = (tokens.length > 1 ? tokens.map((t) => t[0]).join('') : (tokens[0] ?? 'FC').slice(0, 1)).slice(0, 3)
  const accent = rng.pick(['#FFFFFF', '#111111', '#C9A227'].filter((c) => c !== primary && c !== secondary))
  const shape = rng.pick(CREST_SHAPES)
  let symbol = rng.int(0, CREST_SYMBOLS - 1)
  // 2.6#11: no two clubs of a country look alike (shape + symbol + primary colour); bump the symbol, then the shape.
  const keyOf = (sh: string, sy: number) => `${sh}|${sy}|${primary}`
  let sh = shape
  for (let i = 0; i < CREST_SYMBOLS * CREST_SHAPES.length && cc.usedCrests.has(keyOf(sh, symbol)); i++) {
    symbol = (symbol + 1) % CREST_SYMBOLS
    if (symbol === 0) sh = CREST_SHAPES[(CREST_SHAPES.indexOf(sh) + 1) % CREST_SHAPES.length]!
  }
  cc.usedCrests.add(keyOf(sh, symbol))
  return { shape: sh, symbol, colors: [primary, secondary, accent], initials }
}

function stadiumFor(rng: Rng, def: CountryDef, city: string, reputation: number): { name: string; capacity: number } {
  const surname = rng.pick(NAME_POOLS[def.nameStyle].last)
  const name = formatPattern(rng.pick(STADIUM_PATTERNS[def.nameStyle]), { city, surname })
  const capacity = Math.round((3000 + Math.pow(reputation / 100, 2.2) * 80000 * rng.range(0.8, 1.15)) / 500) * 500
  return { name, capacity }
}

function pickStyle(rng: Rng, quality: number): TacticStyle {
  // Weaker clubs lean defensive/direct, stronger ones possession/pressing.
  return rng.weighted(STYLES, (s) => {
    if (s === 'possession' || s === 'pressing') return 1 + quality * 2
    if (s === 'defensive' || s === 'direct') return 1 + (1 - quality) * 2
    return 1.5
  })
}

// ───────────────────────── Squads ─────────────────────────

/** Squad position list: two per formation slot, a third GK, then random depth. */
function squadPositions(rng: Rng, formation: Formation, size: number): Position[] {
  const out: Position[] = []
  for (const slot of FORMATION_SLOTS[formation]) out.push(slot, slot)
  out.push('GK')
  while (out.length < size) out.push(rng.pick(EXTRA_POSITIONS))
  return out
}

function rollAge(rng: Rng): number {
  return clamp(Math.round(rng.normal(25.5, 4.3)), 17, 36)
}

function squadOvr(rng: Rng, level: number, rankInPosition: number, starters: number, age: number): number {
  const roleOffset = rankInPosition < starters ? 2 : rankInPosition < starters * 2 ? -2 : -6
  let base = level + roleOffset + rng.normal(0, 3)
  if (age <= 20) base -= (21 - age) * 2.5
  if (age >= 33) base -= (age - 32) * 1.5
  return clamp(Math.round(base), 35, 94)
}

function generateSquad(rng: Rng, ctx: GenContext, club: Club, level: number, tier: number): void {
  const def = COUNTRY_BY_ID[club.countryId]
  const size = rng.int(MIN_SQUAD, MAX_SQUAD)
  const foreignChance = tier === 1 ? clamp((def.reputation - 55) / 150, 0.03, 0.3) : 0.05
  const seen = new Map<Position, number>()
  for (const position of squadPositions(rng, club.formation, size)) {
    const rank = seen.get(position) ?? 0
    seen.set(position, rank + 1)
    const age = rollAge(rng)
    const ovr = squadOvr(rng, level, rank, Math.max(1, slotCount(club.formation, position)), age)
    const talent = (club.reputation - 50) / 25
    const p = createNpcPlayer(rng, {
      id: nextPlayerId(ctx),
      nationality: rng.chance(foreignChance) ? pickForeignNationality(rng, club.countryId) : club.countryId,
      position, age, season: ctx.season, ovr,
      potential: rollPotential(rng, ovr, age, talent),
      clubId: club.id, clubReputation: club.reputation, gender: worldGender(ctx.world),
    })
    ctx.world.players[p.id] = p
    club.squad.push(p.id)
  }
}

// ───────────────────────── Leagues & clubs ─────────────────────────

function createClub(rng: Rng, cc: CountryContext, league: League, quality: number): Club {
  const def = cc.def
  const city = chooseCity(rng, cc, cc.clubCounter)
  cc.cityUse.set(city, (cc.cityUse.get(city) ?? 0) + 1)
  const name = chooseClubName(rng, cc, city)
  cc.usedNames.add(normalizeClubName(name))
  const shortName = chooseShortName(cc, name, city)
  cc.usedShort.add(shortName)
  const reputation = clamp(Math.round(def.reputation * 0.55 + quality * 35 - (league.tier - 1) * 14 + 5 + rng.normal(0, 3)), 5, 99)
  const kits = generateKits(rng)
  const id = `${def.id}-${String(++cc.clubCounter).padStart(2, '0')}`
  const manager = randomName(rng, def.nameStyle)
  return {
    id, name, shortName, city, countryId: def.id, leagueId: league.id,
    colors: kits.home, awayColors: kits.away,
    crest: crestFor(rng, cc, name, kits.home.primary, kits.home.secondary),
    reputation,
    budget: Math.round(budgetForReputation(reputation) * rng.range(0.8, 1.2) / 1000) * 1000,
    wageBudget: 0,
    stadium: stadiumFor(rng, def, city, reputation),
    formation: rng.weighted(FORMATION_WEIGHTS, (f) => f.w).v,
    style: pickStyle(rng, quality),
    managerName: `${manager.firstName} ${manager.lastName}`,
    squad: [],
  }
}

function generateLeague(rng: Rng, ctx: GenContext, cc: CountryContext, tier: number, tiers: number): League {
  const def = cc.def
  const size = leagueSize(def.reputation, tier)
  const league: League = {
    id: `${def.id}${tier}`, countryId: def.id, name: def.leagueNames[tier - 1] ?? `${def.name.en} Division ${tier}`,
    tier, clubIds: [], promote: tier > 1 ? RELEGATION_SPOTS : 0, relegate: tier < tiers ? RELEGATION_SPOTS : 0,
  }
  const { lo, hi } = tierLevelRange(def.reputation, tier)
  for (let i = 0; i < size; i++) {
    const quality = clamp(Math.pow(1 - i / (size - 1), 1.3) + rng.normal(0, 0.05), 0, 1)
    const club = createClub(rng, cc, league, quality)
    const level = lo + quality * (hi - lo)
    generateSquad(rng, ctx, club, level, tier)
    club.wageBudget = Math.round(club.squad.reduce((s, pid) => s + ctx.world.players[pid].wage, 0) * 1.1)
    ctx.world.clubs[club.id] = club
    league.clubIds.push(club.id)
  }
  return league
}

/** Generate free agents of mixed nationality and modest ability. */
export function generateFreeAgents(rng: Rng, world: World, season: number, count: number, idPrefix: string): NpcPlayer[] {
  const ids = Object.keys(world.countries)
  const out: NpcPlayer[] = []
  for (let i = 0; i < count; i++) {
    const age = rng.int(19, 35)
    const nationality = rng.chance(0.5) ? rng.pick(ids) : pickForeignNationality(rng, null)
    const p = createNpcPlayer(rng, {
      id: `${idPrefix}${i}`, nationality, position: randomPosition(rng), age, season,
      ovr: clamp(Math.round(rng.normal(57, 7)), 40, 76), clubId: null, gender: worldGender(world),
    })
    world.players[p.id] = p
    out.push(p)
  }
  return out
}

/**
 * Build a complete, deterministic world for `opts.season`, including the
 * season's competitions and fixtures. Typical size: 12 countries, ~450 clubs,
 * ~11.5k players.
 */
export function generateWorld(rng: Rng, opts: GenerateWorldOptions): World {
  const defs = opts.countryIds ? COUNTRY_DEFS.filter((d) => opts.countryIds?.includes(d.id)) : COUNTRY_DEFS
  if (!defs.some((d) => d.id === opts.heroCountryId)) throw new Error(`Unknown hero country "${opts.heroCountryId}"`)

  const world: World = { countries: {}, leagues: {}, clubs: {}, players: {}, competitions: {}, honours: [] }
  if (opts.gender === 'female') world.gender = 'female'
  const ctx: GenContext = { season: opts.season, world, playerCounter: { n: 0 } }

  for (const def of defs) {
    world.countries[def.id] = toCountry(def)
    const crng = rng.fork(def.id)
    const cc: CountryContext = { def, cityUse: new Map(), usedNames: new Set(), usedShort: new Set(), usedCrests: new Set(), clubCounter: 0 }
    const tiers = def.id === opts.heroCountryId ? HERO_COUNTRY_TIERS : DEFAULT_TIERS
    for (let tier = 1; tier <= tiers; tier++) {
      const league = generateLeague(crng, ctx, cc, tier, tiers)
      world.leagues[league.id] = league
    }
  }

  generateFreeAgents(rng.fork('free-agents'), world, opts.season, FREE_AGENT_COUNT, 'fa')
  ensureCoefficients(world)
  createSeasonCompetitions(world, rng.fork('competitions'), opts.season)
  ensureNational(world)
  createNationalCompetitions(world, rng.fork('national'), opts.season)
  return world
}
