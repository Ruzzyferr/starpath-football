/**
 * Character creation (GDD 2.1): attributes from archetype + position templates
 * + background, hidden potential, and the starting Life (family, money).
 */
import type {
  Appearance, Archetype, AttributeKey, Attributes, Background, Foot, Gender, Hero, Life, Position, Relationship,
} from '../../core/types'
import { ATTRIBUTE_KEYS, isGoalkeepingAttr } from '../../core/types'
import { Rng, hashString } from '../../core/rng'
import { clamp, emptyStats } from './common'
import { POSITION_WEIGHTS, checkPerkUnlock, heroOvr } from './progression'
import { grantInnatePerk } from './perks'

/** Input collected by the character-creation screen. */
export interface HeroInput {
  firstName: string
  lastName: string
  nickname: string
  nationality: string
  position: Position
  foot: Foot
  appearance: Appearance
  archetype: Archetype
  background: Background
  birthYear: number
  /** Optional birth city (wizard). */
  birthCity?: string
  /** Default 'male'. A female hero plays in the (fictional) women's game. */
  gender?: Gender
}

/**
 * Baseline for every attribute of a 16–18 year old before templates.
 * Chosen so a matched archetype+position lands at OVR ≈ 48–54: good enough for
 * a youth/reserve role at a mid-table club, far from a starter.
 */
const BASE_ATTR = 31
/** Goalkeeping attributes for outfielders (and outfield ones are lower for keepers). */
const OUTFIELD_GK_ATTR = 10
/** Max position-template boost for the position's most important attribute. */
const POSITION_BOOST = 9
/** Gaussian noise on each attribute: two players with identical picks still differ. */
const ATTR_NOISE_SD = 2.5

/**
 * Archetype bonuses (GDD: Golcü, Oyun Kurucu, Kanat Motoru, Duvar, Box-to-Box, Kaleci).
 * Each sums to roughly +80–90 points so archetypes are balanced in total
 * budget; they only differ in *where* the points go.
 */
export const ARCHETYPE_TEMPLATES: Readonly<Record<Archetype, Partial<Record<AttributeKey, number>>>> = {
  poacher: { finishing: 18, shooting: 12, positioning: 13, composure: 9, pace: 8, heading: 7, firstTouch: 9, agility: 4 },
  playmaker: { passing: 18, vision: 18, firstTouch: 12, dribbling: 8, composure: 9, setPieces: 9, agility: 4, shooting: 3 },
  winger: { pace: 18, dribbling: 16, crossing: 12, agility: 12, stamina: 7, firstTouch: 8, finishing: 4, passing: 3 },
  wall: { tackling: 18, heading: 14, strength: 14, positioning: 12, jumping: 10, leadership: 7, composure: 5, workRate: 3 },
  boxToBox: { stamina: 18, workRate: 16, passing: 10, tackling: 10, strength: 8, shooting: 7, positioning: 5, vision: 6, firstTouch: 4 },
  keeper: { reflexes: 22, handling: 20, gkPositioning: 12, gkDistribution: 5, positioning: 4, jumping: 8, agility: 6, composure: 4, leadership: 2 },
}

/** Positions each archetype is built for (2.3#3). Elsewhere only half its bonus applies. */
export const ARCHETYPE_POSITIONS: Readonly<Record<Archetype, readonly Position[]>> = {
  poacher: ['ST', 'LW', 'RW', 'AM'],
  playmaker: ['AM', 'CM', 'DM', 'LW', 'RW'],
  winger: ['LW', 'RW', 'LB', 'RB', 'ST', 'AM'],
  wall: ['CB', 'DM', 'LB', 'RB'],
  boxToBox: ['CM', 'DM', 'AM'],
  keeper: ['GK'],
}
/** Share of the archetype bonus a mismatched position still gets (2.3#3: at most 50%). */
export const ARCHETYPE_MISMATCH_SHARE = 0.5

export const archetypeFits = (position: Position, archetype: Archetype): boolean => ARCHETYPE_POSITIONS[archetype].includes(position)

/** Background (GDD 2.1 "Geçmiş hikâyesi") effects. */
export interface BackgroundDef {
  attrs: Partial<Record<AttributeKey, number>>
  /** Flat potential shift. Late bloomers trade starting level for ceiling. */
  potential: number
  /** Starting cash in currency units. */
  money: number
  reputation: number
  followers: number
  /** Starting relationship values with family/friends. */
  relations: { mother: number; father: number; sibling: number; bestFriend: number }
  /** Free innate perk granted at creation (no perk points). */
  innatePerk: string
  /** Starting manager trust (academy kids are known quantities). */
  trust: number
}

/**
 * Tuning intent: every background must be viable.
 *  - Street: best dribbling/flair, poorest, strongest friendship.
 *  - Academy: best tactical base, trusted by coaches, modest savings.
 *  - Football family: rich and famous name, but high expectations
 *    (father relation starts lower than mother — pressure dynamic for events).
 *  - Late bloomer: weakest start (-4 all), highest ceiling (+7 potential).
 */
export const BACKGROUNDS: Readonly<Record<Background, BackgroundDef>> = {
  street: {
    attrs: { dribbling: 6, agility: 4, firstTouch: 3, composure: 3, workRate: 2, positioning: -3 },
    potential: 1, money: 300, reputation: 1, followers: 250,
    relations: { mother: 60, father: 35, sibling: 50, bestFriend: 75 }, innatePerk: 'street_smart', trust: 35,
  },
  academy: {
    attrs: { positioning: 5, passing: 4, workRate: 3, vision: 2, tackling: 2, composure: 1 },
    potential: 0, money: 2500, reputation: 3, followers: 600,
    relations: { mother: 60, father: 55, sibling: 40, bestFriend: 45 }, innatePerk: 'academy_discipline', trust: 45,
  },
  footballFamily: {
    attrs: { leadership: 4, composure: 4, positioning: 1, passing: 1, firstTouch: 1, vision: 1 },
    potential: 2, money: 20000, reputation: 8, followers: 4000,
    relations: { mother: 65, father: 40, sibling: 35, bestFriend: 40 }, innatePerk: 'famous_name', trust: 40,
  },
  lateBloomer: {
    attrs: Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, -4])) as Partial<Record<AttributeKey, number>>,
    potential: 7, money: 1200, reputation: 0, followers: 150,
    relations: { mother: 70, father: 60, sibling: 55, bestFriend: 60 }, innatePerk: 'late_bloomer', trust: 30,
  },
}

/** Default shirt number by position (UI may let the player pick). */
const SHIRT_BY_POSITION: Readonly<Record<Position, number>> = {
  GK: 1, RB: 2, LB: 3, CB: 4, DM: 6, CM: 8, AM: 10, LW: 11, RW: 7, ST: 9,
}

/**
 * Create the hero. Deterministic for a given Rng state and input.
 * Potential: N(80, 5) + background, clamped 60..99 and always ≥ start OVR + 12
 * so every hero has meaningful growth ahead.
 */
export function createHero(rng: Rng, input: HeroInput): Hero {
  const arch = ARCHETYPE_TEMPLATES[input.archetype]
  const bg = BACKGROUNDS[input.background]
  const posW = POSITION_WEIGHTS[input.position]
  const maxW = Math.max(...Object.values(posW).map((v) => v ?? 0))
  const isKeeper = input.position === 'GK' || input.archetype === 'keeper'
  const archShare = archetypeFits(input.position, input.archetype) ? 1 : ARCHETYPE_MISMATCH_SHARE

  const attrs = {} as Attributes
  // The v4 goalkeeping pair draws its noise from a side stream read off (not consumed from) the
  // career stream, so everything rolled after the sheet (potential, perks…) is unchanged.
  const st = rng.state
  const gkRng = new Rng((st.a ^ st.d ^ hashString('gk-attrs-v4')) >>> 0)
  for (const key of ATTRIBUTE_KEYS) {
    const gk = isGoalkeepingAttr(key)
    let v = gk && !isKeeper ? OUTFIELD_GK_ATTR : BASE_ATTR
    // Keepers are poor at outfield technique.
    if (isKeeper && !gk && (key === 'finishing' || key === 'dribbling' || key === 'tackling' || key === 'crossing' || key === 'shooting')) v -= 8
    v += (arch[key] ?? 0) * archShare
    v += (POSITION_BOOST * (posW[key] ?? 0)) / maxW
    v += bg.attrs[key] ?? 0
    v += (key === 'gkPositioning' || key === 'gkDistribution' ? gkRng : rng).normal(0, ATTR_NOISE_SD)
    attrs[key] = clamp(Math.round(v), 5, 75)
  }

  const gender: Gender = input.gender === 'female' ? 'female' : 'male'
  const hero: Hero = {
    firstName: input.firstName,
    lastName: input.lastName,
    gender,
    nickname: input.nickname || input.lastName,
    ...(input.birthCity?.trim() ? { birthCity: input.birthCity.trim().slice(0, 30) } : {}),
    nationality: input.nationality,
    birthYear: input.birthYear,
    position: input.position,
    foot: input.foot,
    appearance: { ...input.appearance, gender },
    archetype: input.archetype,
    background: input.background,
    attrs,
    attrXp: {},
    potential: 0,
    perkPoints: 0,
    perks: [],
    form: 50,
    morale: 65,
    sharpness: 60,
    fatigue: 10,
    injury: null,
    suspendedMatches: 0,
    contract: null,
    managerTrust: bg.trust,
    reputation: bg.reputation,
    shirtNumber: SHIRT_BY_POSITION[input.position],
    nationalTeam: { called: false, caps: 0, goals: 0 },
    seasonStats: emptyStats(),
    careerStats: emptyStats(),
    history: [],
    trophies: [],
    awards: [],
    retired: false,
  }
  const ovr = heroOvr(hero)
  const rolled = Math.round(rng.normal(80, 5)) + bg.potential
  hero.potential = clamp(Math.max(rolled, ovr + 12), 60, 99)

  grantInnatePerk(hero, bg.innatePerk)
  if (input.foot === 'B') grantInnatePerk(hero, 'two_footed')
  checkPerkUnlock(hero) // starting perk points (OVR 50 → 2 points to spend at creation)
  return hero
}

/** Optional names for family members (UI can let the player name them). */
export interface FamilyNames {
  mother?: string
  father?: string
  sibling?: string
  bestFriend?: string
}

/** Generic names by nationality family; falls back to an international set. */
const GENERIC_NAMES: Readonly<Record<string, { f: readonly string[]; m: readonly string[] }>> = {
  TR: { f: ['Ayşe', 'Fatma', 'Elif', 'Zeynep', 'Hatice', 'Emine'], m: ['Mehmet', 'Ahmet', 'Mustafa', 'Hasan', 'Ali', 'Murat', 'Emre', 'Burak'] },
  _: { f: ['Maria', 'Anna', 'Sofia', 'Laura', 'Clara', 'Elena'], m: ['David', 'Marco', 'Lukas', 'Daniel', 'Tom', 'Pablo', 'Leo', 'Adam'] },
}

/** Starting credit score (300..850 FICO-like scale): young, no history. */
export const START_CREDIT_SCORE = 600

/** Build a relationship record. */
export function makeRelation(id: string, kind: Relationship['kind'], name: string, value: number, week = 0, npcId?: string): Relationship {
  return { id, kind, name, value: clamp(Math.round(value), -100, 100), memory: [], lastContactWeek: week, ...(npcId ? { npcId } : {}) }
}

/** Household the hero grows up in (2.4#14). */
export type FamilyStructure = 'both' | 'single_mother' | 'single_father' | 'foster'
export interface FamilyPlan {
  structure: FamilyStructure
  /** Siblings, 0-2. */
  siblings: number
}

/**
 * Procedural starting family from the background story. Uses its own
 * deterministic generator (hero identity + background), so the main RNG stream
 * is untouched. Academy and football families keep both parents and at least
 * one sibling; the street and late-bloomer stories can start with a single
 * parent or in foster care (no parents).
 */
export function rollFamily(hero: Pick<Hero, 'firstName' | 'lastName' | 'birthYear'>, background: Background): FamilyPlan {
  const r = new Rng(hashString(`family|${hero.firstName}|${hero.lastName}|${hero.birthYear}|${background}`))
  const x = r.next()
  let structure: FamilyStructure = 'both'
  if (background === 'street') structure = x < 0.12 ? 'foster' : x < 0.42 ? 'single_mother' : x < 0.5 ? 'single_father' : 'both'
  else if (background === 'lateBloomer') structure = x < 0.18 ? 'single_mother' : x < 0.22 ? 'single_father' : 'both'
  const siblings = background === 'street' ? r.int(0, 2) : background === 'footballFamily' ? r.int(1, 2) : background === 'academy' ? r.int(1, 2) : r.int(0, 2)
  return { structure, siblings }
}

/**
 * Create the starting Life. Relationships: mother, father, sibling, best friend,
 * fans and press (fans/press start neutral: nobody knows you yet). Manager,
 * teammates, agent and partner are added later by the career layer.
 */
export function createLife(rng: Rng, hero: Hero, background: Background, names: FamilyNames = {}): Life {
  const bg = BACKGROUNDS[background]
  const pool = (GENERIC_NAMES[hero.nationality] ?? GENERIC_NAMES._)!
  const jitter = () => rng.int(-5, 5)
  const sibName = names.sibling ?? (rng.chance(0.5) ? rng.pick(pool.f) : rng.pick(pool.m))
  const plan = rollFamily(hero, background)
  const relationships: Record<string, Relationship> = {
    ...(plan.structure === 'both' || plan.structure === 'single_mother' ? { mother: makeRelation('mother', 'mother', names.mother ?? rng.pick(pool.f), bg.relations.mother + jitter()) } : {}),
    ...(plan.structure === 'both' || plan.structure === 'single_father' ? { father: makeRelation('father', 'father', names.father ?? rng.pick(pool.m), bg.relations.father + jitter()) } : {}),
    ...(plan.siblings >= 1 ? { sibling: makeRelation('sibling', 'sibling', sibName, bg.relations.sibling + jitter()) } : {}),
    ...(plan.siblings >= 2 ? { sibling2: makeRelation('sibling2', 'sibling', rng.pick([...pool.f, ...pool.m]), bg.relations.sibling + jitter()) } : {}),
    bestFriend: makeRelation('bestFriend', 'bestFriend', names.bestFriend ?? rng.pick(hero.gender === 'female' ? pool.f : pool.m), bg.relations.bestFriend + jitter()),
    fans: makeRelation('fans', 'fans', 'Taraftarlar / Fans', 0),
    press: makeRelation('press', 'press', 'Basın / Press', 0),
  }
  return {
    money: bg.money,
    bank: { savings: 0, loan: null, investments: [], creditScore: START_CREDIT_SCORE },
    assets: [],
    energy: 100,
    happiness: 65,
    health: 95,
    stress: 20,
    discipline: 70,
    followers: bg.followers,
    relationships,
    agent: null,
    sponsors: [],
    trainer: null,
    casino: { addiction: 0, won: 0, lost: 0, visitsThisWeek: 0 },
    flags: { background, family_structure: plan.structure, family_siblings: plan.siblings },
    eventHistory: {},
    log: [], // the game layer logs the opening line with the real calendar
    news: [],
  }
}
