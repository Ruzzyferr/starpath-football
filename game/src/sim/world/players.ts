/**
 * NPC player factory and the economic formulas (value, wage, budgets) shared
 * by world generation, transfers and the career layer.
 */
import type { Appearance, Foot, Gender, NpcPlayer, Personality, Position, SeasonStats } from '../../core/types'
import { clamp } from '../../core/rng'
import type { Rng } from '../../core/rng'
import { COUNTRY_BY_ID, COUNTRY_DEFS } from '../../data/world/countries'
import { NAME_POOLS, isRealPersonName } from '../../data/world/names'
import type { NameStyle } from '../../data/world/names'

// ───────────────────────── Economy ─────────────────────────

/** Round money to a "nice" figure appropriate to its magnitude. */
export function roundMoney(v: number): number {
  const step = v < 10_000 ? 50 : v < 100_000 ? 500 : v < 1_000_000 ? 5_000 : v < 10_000_000 ? 50_000 : 250_000
  return Math.max(0, Math.round(v / step) * step)
}

/** Market value from ability, age and potential. */
export function playerValue(ovr: number, age: number, potential: number): number {
  let v = 40_000 * Math.exp(0.19 * (ovr - 50))
  if (age <= 23) v *= 1 + Math.max(0, potential - ovr) * 0.045
  if (age >= 30) v *= Math.max(0.15, 1 - (age - 29) * 0.14)
  return roundMoney(v)
}

/** Club wage scale: richer clubs pay more for the same ability. */
export function clubWageFactor(clubReputation: number): number {
  return 0.6 + clubReputation / 125
}

/** Weekly wage for a player of `ovr` at a club of `clubReputation` (default neutral). */
export function playerWage(ovr: number, clubReputation = 50): number {
  return roundMoney(150 * Math.exp(0.13 * (ovr - 40)) * clubWageFactor(clubReputation))
}

/** Seasonal transfer budget for a club of a given reputation (before noise). */
export function budgetForReputation(rep: number): number {
  return roundMoney(40_000 * Math.pow(Math.max(1, rep) / 10, 3.4))
}

// ───────────────────────── Appearance ─────────────────────────

/** Number of options per appearance field (indices are 0 … n-1). The avatar renderer must match. */
export const APPEARANCE_RANGES: Readonly<Record<Exclude<keyof Appearance, 'gender'>, number>> = {
  skin: 6, hairStyle: 12, hairColor: 8, beard: 6, eyeColor: 5, face: 6, accessory: 4,
}
/** Female hair styles used for generated players (avatar FEMALE_HAIR_STYLE_COUNT ≥ this). */
export const FEMALE_HAIR_STYLES = 10

/** Skin tone weights (0 = lightest … 5 = darkest) per name style. */
const SKIN_WEIGHTS: Readonly<Record<NameStyle, readonly number[]>> = {
  turkish: [1, 4, 4, 1, 0, 0], english: [5, 3, 1, 1, 1, 1], spanish: [2, 5, 3, 1, 0.5, 0.5],
  german: [6, 3, 1, 0.5, 0.5, 0.5], italian: [2, 5, 3, 0.5, 0.3, 0.3], french: [3, 3, 1, 1, 2, 2],
  portuguese: [2, 4, 3, 1, 1, 1], dutch: [6, 2, 1, 1, 1, 1], brazilian: [1, 2, 3, 3, 3, 2],
  argentine: [3, 5, 3, 1, 0.3, 0.2], american: [3, 2, 2, 2, 2, 2], japanese: [3, 6, 1, 0, 0, 0],
}

/** Hair colour weights: 0 black, 1 dark brown, 2 brown, 3 light brown, 4 blonde, 5 red, 6 grey, 7 dyed. */
const HAIR_WEIGHTS: Readonly<Record<NameStyle, readonly number[]>> = {
  turkish: [6, 4, 2, 1, 0.3, 0.1, 0, 0.2], english: [2, 3, 3, 2, 2, 1, 0, 0.3], spanish: [5, 4, 2, 1, 0.3, 0.1, 0, 0.3],
  german: [1, 2, 3, 3, 3, 0.6, 0, 0.3], italian: [5, 4, 2, 1, 0.3, 0.1, 0, 0.3], french: [4, 3, 2, 2, 1, 0.3, 0, 0.3],
  portuguese: [5, 4, 2, 1, 0.3, 0.1, 0, 0.3], dutch: [1, 2, 3, 3, 4, 0.6, 0, 0.3], brazilian: [6, 3, 1, 0.5, 0.5, 0, 0, 1],
  argentine: [5, 4, 2, 1, 0.3, 0.1, 0, 0.3], american: [3, 3, 2, 2, 1.5, 0.5, 0, 0.5], japanese: [8, 2, 0.5, 0.3, 0.2, 0, 0, 0.8],
}

function weightedIndex(rng: Rng, weights: readonly number[]): number {
  const idx = weights.map((_, i) => i)
  return rng.weighted(idx, (i) => weights[i]!)
}

/** Random appearance biased by the player's name style. */
export function randomAppearance(rng: Rng, style: NameStyle, age: number, gender: Gender = 'male'): Appearance {
  if (gender === 'female') {
    const hairColor = age >= 36 && rng.chance(0.15) ? 6 : weightedIndex(rng, HAIR_WEIGHTS[style])
    return {
      skin: weightedIndex(rng, SKIN_WEIGHTS[style]),
      hairStyle: rng.int(0, FEMALE_HAIR_STYLES - 1),
      hairColor,
      beard: 0,
      eyeColor: rng.int(0, APPEARANCE_RANGES.eyeColor - 1),
      face: rng.int(0, APPEARANCE_RANGES.face - 1),
      accessory: rng.chance(0.75) ? 0 : rng.int(1, APPEARANCE_RANGES.accessory - 1),
      gender: 'female',
    }
  }
  const hairColor = age >= 33 && rng.chance(0.25) ? 6 : weightedIndex(rng, HAIR_WEIGHTS[style])
  return {
    skin: weightedIndex(rng, SKIN_WEIGHTS[style]),
    hairStyle: rng.int(0, APPEARANCE_RANGES.hairStyle - 1),
    hairColor,
    beard: age < 19 ? (rng.chance(0.8) ? 0 : 1) : rng.int(0, APPEARANCE_RANGES.beard - 1),
    eyeColor: rng.int(0, APPEARANCE_RANGES.eyeColor - 1),
    face: rng.int(0, APPEARANCE_RANGES.face - 1),
    accessory: rng.chance(0.85) ? 0 : rng.int(1, APPEARANCE_RANGES.accessory - 1),
  }
}

// ───────────────────────── Misc picks ─────────────────────────

const PERSONALITIES: readonly { v: Personality; w: number }[] = [
  { v: 'professional', w: 22 }, { v: 'loyal', w: 12 }, { v: 'ambitious', w: 16 }, { v: 'party', w: 8 },
  { v: 'hothead', w: 8 }, { v: 'quiet', w: 16 }, { v: 'leader', w: 8 }, { v: 'joker', w: 10 },
]

function pickFoot(rng: Rng, pos: Position): Foot {
  if (rng.chance(0.05)) return 'B'
  const leftChance = pos === 'LB' || pos === 'LW' ? 0.6 : pos === 'RB' || pos === 'RW' ? 0.12 : 0.24
  return rng.chance(leftChance) ? 'L' : 'R'
}

/** Name style for a nationality (falls back to English for unknown ids). */
export function nameStyleOf(countryId: string): NameStyle {
  return COUNTRY_BY_ID[countryId]?.nameStyle ?? 'english'
}

/** Random "First Last" pair for a name style. */
export function randomName(rng: Rng, style: NameStyle, gender: Gender = 'male'): { firstName: string; lastName: string } {
  const pool = NAME_POOLS[style]
  const firstName = rng.pick(gender === 'female' ? pool.firstFemale : pool.first)
  let lastName = rng.pick(pool.last)
  // 2.6#10: never compose a real footballer/manager (re-rolls only on a hit, so the stream is untouched otherwise).
  for (let tries = 0; isRealPersonName(firstName, lastName) && tries < 8; tries++) lastName = rng.pick(pool.last)
  return { firstName, lastName }
}

/**
 * Pick a foreign nationality (≠ `exclude`) weighted by football reputation,
 * with a bonus for traditional exporters.
 */
export function pickForeignNationality(rng: Rng, exclude: string | null): string {
  const exporters: Record<string, number> = { BR: 1.8, AR: 1.6, PT: 1.3, FR: 1.3, NL: 1.1 }
  const options = COUNTRY_DEFS.filter((c) => c.id !== exclude)
  return rng.weighted(options, (c) => Math.pow(c.reputation / 50, 3) * (exporters[c.id] ?? 1)).id
}

/** Zeroed season statistics. */
export function emptySeasonStats(): SeasonStats {
  return {
    apps: 0, starts: 0, minutes: 0, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, passes: 0,
    passesCompleted: 0, tackles: 0, dribbles: 0, yellow: 0, red: 0, cleanSheets: 0, saves: 0, ratingSum: 0, motm: 0,
  }
}

/** Typical potential headroom for a player of a given age. */
export function rollPotential(rng: Rng, ovr: number, age: number, talentBonus = 0): number {
  let headroom: number
  if (age <= 18) headroom = rng.int(8, 26)
  else if (age <= 20) headroom = rng.int(5, 20)
  else if (age <= 23) headroom = rng.int(2, 12)
  else if (age <= 27) headroom = rng.int(0, 5)
  else headroom = rng.int(0, 1)
  return clamp(Math.round(ovr + headroom + talentBonus), ovr, 96)
}

export interface CreatePlayerOptions {
  id: string
  nationality: string
  position: Position
  age: number
  season: number
  ovr: number
  potential?: number
  clubId: string | null
  clubReputation?: number
  /** Contract runs until season + contractYears (default 0–4; 0 = expires this season). Ignored for free agents. */
  contractYears?: number
  /** Player gender (the world's gender; default 'male'). */
  gender?: Gender
}

/** Create a fully-populated NpcPlayer. */
export function createNpcPlayer(rng: Rng, o: CreatePlayerOptions): NpcPlayer {
  const style = nameStyleOf(o.nationality)
  const ovr = clamp(Math.round(o.ovr), 25, 95)
  const potential = o.potential ?? rollPotential(rng, ovr, o.age)
  const gender = o.gender ?? 'male'
  const { firstName, lastName } = randomName(rng, style, gender)
  return {
    id: o.id,
    firstName,
    lastName,
    nationality: o.nationality,
    birthYear: o.season - o.age,
    position: o.position,
    foot: pickFoot(rng, o.position),
    ovr,
    potential: Math.max(potential, ovr),
    styleSeed: rng.nextUint(),
    clubId: o.clubId,
    value: playerValue(ovr, o.age, potential),
    wage: playerWage(ovr, o.clubReputation ?? 45),
    contractUntil: o.clubId ? o.season + (o.contractYears ?? rng.int(0, 4)) : o.season,
    morale: rng.int(55, 80),
    form: rng.int(45, 60),
    personality: rng.weighted(PERSONALITIES, (p) => p.w).v,
    appearance: randomAppearance(rng, style, o.age, gender),
    injuredWeeks: 0,
    stats: emptySeasonStats(),
  }
}

/** Age during `season` (season start year − birth year). */
export function ageIn(p: Pick<NpcPlayer, 'birthYear'>, season: number): number {
  return season - p.birthYear
}

/** Global pool weights used when a random outfield/GK position is needed. */
export const POSITION_POOL_WEIGHTS: Readonly<Record<Position, number>> = {
  GK: 2, CB: 4, LB: 2, RB: 2, DM: 2, CM: 3.5, AM: 2, LW: 2, RW: 2, ST: 3,
}

/** Weighted random position. */
export function randomPosition(rng: Rng): Position {
  const keys = Object.keys(POSITION_POOL_WEIGHTS) as Position[]
  return rng.weighted(keys, (k) => POSITION_POOL_WEIGHTS[k])
}
