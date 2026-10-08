/**
 * Character creation (GDD 2.1): attributes from role + position templates
 * + background, hidden potential, and the starting Life (family, money).
 */
import type {
  Appearance, AttributeKey, Attributes, Background, Foot, Gender, Hero, Life, Position, Relationship, Role,
} from '../../core/types'
import { clampHeight, normalizeRole } from '../../core/roles'
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
  /** Playing role; a role that does not fit the position falls back to the position default. */
  role: Role
  /** Height in cm, clamped into the role's range (default: the role's height). */
  heightCm?: number
  background: Background
  birthYear: number
  /** Optional birth city (wizard). */
  birthCity?: string
  /** Default 'male'. A female hero plays in the (fictional) women's game. */
  gender?: Gender
}

/**
 * Baseline for every attribute of a 16–18 year old before templates.
 * Chosen so a role at its position lands at OVR ≈ 48–54: good enough for
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
 * Role templates (owner feedback: roles depend on the position). Raw shapes: the strengths and the
 * weaknesses of each role. {@link roleTemplate} scales the strengths so every role of a position starts
 * at the same weighted OVR gain ({@link ROLE_OVR_GAIN}); roles only differ in *where* the points go.
 */
export const ROLE_TEMPLATES: Readonly<Record<Role, Partial<Record<AttributeKey, number>>>> = {
  // Keepers
  reflexKeeper: { reflexes: 26, agility: 12, handling: 14, gkPositioning: 8, jumping: 6, composure: 4, gkDistribution: 2, strength: -3 },
  shotStopper: { handling: 20, reflexes: 18, jumping: 12, gkPositioning: 12, agility: 8, strength: 4, composure: 2, passing: -3 },
  sweeperKeeper: { gkDistribution: 22, passing: 14, gkPositioning: 14, composure: 10, reflexes: 12, handling: 10, pace: 6, vision: 6, jumping: -4 },
  // Full-backs
  attackingFullBack: { crossing: 18, pace: 16, stamina: 12, dribbling: 10, agility: 8, passing: 6, workRate: 6, tackling: -4, positioning: -4 },
  defensiveFullBack: { tackling: 18, positioning: 14, strength: 10, pace: 10, heading: 8, workRate: 8, stamina: 6, crossing: -4, dribbling: -4 },
  balancedFullBack: { stamina: 16, tackling: 12, pace: 12, crossing: 10, workRate: 10, positioning: 8, passing: 8, dribbling: 4 },
  // Centre-backs
  stopper: { tackling: 20, pace: 12, positioning: 10, strength: 10, workRate: 6, agility: 6, heading: 6, stamina: 4, passing: -4, vision: -3 },
  aerialDefender: { heading: 20, jumping: 16, strength: 16, tackling: 12, positioning: 8, leadership: 6, pace: -6, agility: -5 },
  ballPlayingDefender: { passing: 18, vision: 12, composure: 12, tackling: 12, positioning: 10, firstTouch: 8, heading: 6, strength: -3, workRate: -2 },
  // Midfield
  anchor: { tackling: 18, positioning: 16, strength: 10, workRate: 8, passing: 8, composure: 6, stamina: 6, heading: 6, dribbling: -4, finishing: -4, shooting: -2 },
  boxToBox: { stamina: 18, workRate: 14, passing: 10, tackling: 10, shooting: 8, strength: 6, positioning: 6, firstTouch: 6, pace: 4, setPieces: -3 },
  playmaker: { passing: 18, vision: 18, firstTouch: 12, composure: 9, dribbling: 8, setPieces: 8, shooting: 4, agility: 4, tackling: -4, strength: -4 },
  // Wingers
  touchlineWinger: { pace: 20, crossing: 18, stamina: 10, dribbling: 10, agility: 8, workRate: 6, finishing: -4, heading: -2 },
  invertedWinger: { shooting: 16, finishing: 12, dribbling: 12, passing: 8, firstTouch: 8, agility: 8, pace: 8, composure: 6, crossing: -5 },
  freeWinger: { vision: 14, passing: 12, dribbling: 12, firstTouch: 12, agility: 8, pace: 8, composure: 6, crossing: 6, workRate: -4, tackling: -2 },
  dribbler: { dribbling: 22, agility: 16, firstTouch: 12, pace: 12, composure: 4, strength: -6, heading: -4 },
  // Strikers
  runner: { pace: 18, finishing: 19, positioning: 12, composure: 9, agility: 6, firstTouch: 6, dribbling: 5, strength: -5, heading: -4 },
  targetForward: { firstTouch: 16, strength: 16, finishing: 12, passing: 10, composure: 10, positioning: 8, vision: 6, shooting: 4, pace: -6, agility: -3 },
  pivot: { heading: 20, jumping: 16, strength: 14, finishing: 12, positioning: 10, composure: 4, pace: -6, agility: -5, dribbling: -3 },
}

/**
 * Position-specific shapes where a role means something different: a box-to-box number 10 arrives in the
 * box to shoot, a deep-lying playmaker (regista) dictates from in front of the defence.
 */
export const ROLE_TEMPLATES_AT: Readonly<Partial<Record<Position, Partial<Record<Role, Partial<Record<AttributeKey, number>>>>>>> = {
  AM: { boxToBox: { stamina: 16, shooting: 14, workRate: 12, firstTouch: 10, passing: 10, dribbling: 8, vision: 6, composure: 4, setPieces: -3 } },
  DM: { playmaker: { passing: 18, vision: 14, composure: 12, positioning: 8, firstTouch: 8, setPieces: 6, tackling: 4, strength: -4, pace: -3 } },
}

/**
 * Weighted OVR gain every role of a position gets from its template (the old matched archetype's gain, so
 * BALANCE targets hold: ST ≈ poacher, AM ≈ playmaker, wingers ≈ wing engine, CB ≈ wall, GK ≈ keeper).
 */
export const ROLE_OVR_GAIN: Readonly<Record<Position, number>> = {
  GK: 13.4, CB: 10.4, LB: 9, RB: 9, DM: 9, CM: 8.6, AM: 10.8, LW: 10.8, RW: 10.8, ST: 9.6,
}

/** The role's template at a position, strengths scaled to {@link ROLE_OVR_GAIN} (weaknesses kept as they are). */
export function roleTemplate(role: Role, pos: Position): Partial<Record<AttributeKey, number>> {
  const raw = ROLE_TEMPLATES_AT[pos]?.[role] ?? ROLE_TEMPLATES[role]
  const w = POSITION_WEIGHTS[pos]
  const total = Object.values(w).reduce((a, v) => a + (v ?? 0), 0)
  let plus = 0
  let minus = 0
  for (const [k, v] of Object.entries(raw) as [AttributeKey, number][]) {
    const c = ((w[k] ?? 0) * v) / total
    if (v > 0) plus += c
    else minus += c
  }
  const scale = plus > 0 ? Math.max(0.6, Math.min(2, (ROLE_OVR_GAIN[pos] - minus) / plus)) : 1
  const out: Partial<Record<AttributeKey, number>> = {}
  for (const [k, v] of Object.entries(raw) as [AttributeKey, number][]) out[k] = v > 0 ? Math.round(v * scale * 10) / 10 : v
  return out
}

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
 * Starting value of one attribute before noise: base, keeper/outfield split, role template, position boost
 * and background. Shared by {@link createHero} and the wizard's live preview ({@link previewAttrs}).
 */
function attrBase(key: AttributeKey, pos: Position, tpl: Partial<Record<AttributeKey, number>>, bg: BackgroundDef): number {
  const posW = POSITION_WEIGHTS[pos]
  const maxW = Math.max(...Object.values(posW).map((v) => v ?? 0))
  const isKeeper = pos === 'GK'
  const gk = isGoalkeepingAttr(key)
  let v = gk && !isKeeper ? OUTFIELD_GK_ATTR : BASE_ATTR
  // Keepers are poor at outfield technique.
  if (isKeeper && !gk && (key === 'finishing' || key === 'dribbling' || key === 'tackling' || key === 'crossing' || key === 'shooting')) v -= 8
  v += tpl[key] ?? 0
  v += (POSITION_BOOST * (posW[key] ?? 0)) / maxW
  v += bg.attrs[key] ?? 0
  return v
}

/** Expected starting sheet (no noise) for the wizard's live preview. */
export function previewAttrs(pos: Position, role: Role, background: Background): Attributes {
  const tpl = roleTemplate(normalizeRole(pos, role), pos)
  const bg = BACKGROUNDS[background]
  const out = {} as Attributes
  for (const key of ATTRIBUTE_KEYS) out[key] = clamp(Math.round(attrBase(key, pos, tpl, bg)), 5, 75)
  return out
}

/**
 * Create the hero. Deterministic for a given Rng state and input.
 * Potential: N(80, 5) + background, clamped 60..99 and always ≥ start OVR + 12
 * so every hero has meaningful growth ahead.
 */
export function createHero(rng: Rng, input: HeroInput): Hero {
  const role = normalizeRole(input.position, input.role)
  const tpl = roleTemplate(role, input.position)
  const bg = BACKGROUNDS[input.background]

  const attrs = {} as Attributes
  // The v4 goalkeeping pair draws its noise from a side stream read off (not consumed from) the
  // career stream, so everything rolled after the sheet (potential, perks…) is unchanged.
  const st = rng.state
  const gkRng = new Rng((st.a ^ st.d ^ hashString('gk-attrs-v4')) >>> 0)
  for (const key of ATTRIBUTE_KEYS) {
    let v = attrBase(key, input.position, tpl, bg)
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
    role,
    heightCm: clampHeight(role, gender, input.heightCm),
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
