/**
 * Character creation (GDD 2.1): attributes from role + position templates
 * + background, hidden potential, and the starting Life (family, money).
 */
import type {
  Appearance, AttributeKey, Attributes, Background, Foot, Gender, Hero, Life, Position, Relationship, Role,
} from '../../core/types'
import { START_YEAR } from '../../core/config'
import { clampHeight, normalizeRole } from '../../core/roles'
import { ATTRIBUTE_KEYS, V6_ATTRIBUTE_KEYS, isGoalkeepingAttr } from '../../core/types'
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
 * Role specs (owner feedback, defined with a football-insider friend): every role is exactly four strengths
 * ("+") and four weaknesses ("−"). The friend chose WHICH attributes; {@link roleTemplate} sets HOW MUCH, weighted
 * by each attribute's importance at the position, so every role of a position starts at the same OVR
 * ({@link ROLE_OVR_GAIN}) and the simulated impact stays within ±5 % of the position mean (docs/BALANCE.md,
 * "Rol denge yaması").
 */
export interface RoleSpec {
  plus: readonly AttributeKey[]
  minus: readonly AttributeKey[]
}
export const ROLE_SPEC: Readonly<Record<Role, RoleSpec>> = {
  // Keepers
  reflexKeeper: { plus: ['handling', 'agility', 'reflexes', 'composure'], minus: ['passing', 'gkDistribution', 'jumping', 'strength'] },
  shotStopper: { plus: ['handling', 'jumping', 'agility', 'gkDistribution'], minus: ['passing', 'strength', 'composure', 'gkPositioning'] },
  sweeperKeeper: { plus: ['passing', 'gkDistribution', 'agility', 'strength'], minus: ['reflexes', 'handling', 'jumping', 'composure'] },
  // Full-backs
  balancedFullBack: { plus: ['positioning', 'strength', 'tackling', 'crossing'], minus: ['stamina', 'dribbling', 'agility', 'pace'] },
  attackingFullBack: { plus: ['strength', 'pace', 'crossing', 'dribbling'], minus: ['stamina', 'agility', 'tackling', 'positioning'] },
  defensiveFullBack: { plus: ['tackling', 'stamina', 'agility', 'positioning'], minus: ['strength', 'pace', 'crossing', 'dribbling'] },
  // Centre-backs
  stopper: { plus: ['pace', 'strength', 'tackling', 'passing'], minus: ['jumping', 'vision', 'composure', 'balance'] },
  aerialDefender: { plus: ['balance', 'jumping', 'composure', 'strength'], minus: ['pace', 'tackling', 'passing', 'vision'] },
  ballPlayingDefender: { plus: ['vision', 'passing', 'composure', 'balance'], minus: ['jumping', 'tackling', 'strength', 'pace'] },
  // Midfield
  playmaker: { plus: ['passing', 'vision', 'setPieces', 'firstTouch'], minus: ['stamina', 'shooting', 'workRate', 'dribbling'] },
  boxToBox: { plus: ['stamina', 'passing', 'workRate', 'vision'], minus: ['dribbling', 'shooting', 'setPieces', 'firstTouch'] },
  anchor: { plus: ['workRate', 'passing', 'tackling', 'stamina'], minus: ['vision', 'shooting', 'dribbling', 'setPieces'] },
  // Wingers
  touchlineWinger: { plus: ['pace', 'shooting', 'crossing', 'dribbling'], minus: ['passing', 'vision', 'heading', 'finishing'] },
  invertedWinger: { plus: ['passing', 'finishing', 'firstTouch', 'vision'], minus: ['shooting', 'crossing', 'pace', 'dribbling'] },
  freeWinger: { plus: ['vision', 'passing', 'firstTouch', 'agility'], minus: ['dribbling', 'workRate', 'tackling', 'heading'] },
  dribbler: { plus: ['firstTouch', 'dribbling', 'pace', 'passing'], minus: ['strength', 'heading', 'jumping', 'crossing'] },
  // Strikers
  runner: { plus: ['pace', 'firstTouch', 'finishing', 'positioning'], minus: ['strength', 'jumping', 'passing', 'heading'] },
  targetForward: { plus: ['firstTouch', 'strength', 'jumping', 'positioning'], minus: ['pace', 'finishing', 'passing', 'heading'] },
  pivot: { plus: ['strength', 'jumping', 'finishing', 'heading'], minus: ['passing', 'positioning', 'pace', 'firstTouch'] },
}

/** Template magnitudes (attribute points at 17): a strength's base, a weakness's base. */
const PLUS_BASE = 12
const MINUS_BASE = 8
/**
 * Per-role fine tuning of the strengths' size, from the role balance harness (simulated impact per role within
 * ±5 % of its position): >1 for roles whose strengths matter less in their moments, <1 for the reverse.
 */
export const ROLE_IMPACT_TUNE: Readonly<Partial<Record<Role, number>>> = {}


/**
 * Weighted OVR gain every role of a position gets from its template (the old matched archetype's gain, so
 * BALANCE targets hold: ST ≈ poacher, AM ≈ playmaker, wingers ≈ wing engine, CB ≈ wall, GK ≈ keeper).
 */
export const ROLE_OVR_GAIN: Readonly<Record<Position, number>> = {
  GK: 13.4, CB: 10.4, LB: 9, RB: 9, DM: 9, CM: 8.6, AM: 10.8, LW: 10.8, RW: 10.8, ST: 9.6,
}

/**
 * The role's template at a position. A weakness costs MINUS_BASE points, less in an attribute the position
 * leans on (30 % of it at the most important one): a weakness is real but never cripples the position's core. The
 * strengths that count toward the position's OVR are then scaled so every role starts at the same OVR
 * ({@link ROLE_OVR_GAIN}); strengths outside the OVR formula keep their base size.
 */
export function roleTemplate(role: Role, pos: Position): Partial<Record<AttributeKey, number>> {
  const spec = ROLE_SPEC[role]
  const w = POSITION_WEIGHTS[pos]
  const total = Object.values(w).reduce((a, v) => a + (v ?? 0), 0)
  const maxW = Math.max(...Object.values(w).map((v) => v ?? 0))
  const out: Partial<Record<AttributeKey, number>> = {}
  let minus = 0
  for (const k of spec.minus) {
    const v = -Math.round(MINUS_BASE * (1 - 0.7 * (w[k] ?? 0) / maxW) * 10) / 10
    out[k] = v
    minus += ((w[k] ?? 0) * v) / total
  }
  const base = PLUS_BASE * (ROLE_IMPACT_TUNE[role] ?? 1)
  // A strength's companion (Pace → Acceleration) is part of the same strength: it shares the OVR budget.
  const companions = spec.plus.flatMap((k) => {
    const c = PLUS_COMPANION[k]
    return c && !spec.plus.includes(c[0]) && !spec.minus.includes(c[0]) ? [[c[0], c[1]] as const] : []
  })
  let plus = 0
  for (const k of spec.plus) plus += ((w[k] ?? 0) * base) / total
  for (const [c, f] of companions) plus += ((w[c] ?? 0) * base * f) / total
  const scale = plus > 0 ? Math.max(0.5, Math.min(ROLE_SCALE_MAX, (ROLE_OVR_GAIN[pos] - minus) / plus)) : 1
  for (const k of spec.plus) out[k] = Math.round(base * ((w[k] ?? 0) > 0 ? scale : 1) * 10) / 10
  for (const [c, f] of companions) out[c] = Math.round(base * f * ((w[c] ?? 0) > 0 ? scale : 1) * 10) / 10
  // A role whose strengths sit outside the position's core (a sweeper keeper's passing) would start below the
  // others: the rest of the gain goes evenly into the position's other attributes ("solid elsewhere").
  const rest = ROLE_OVR_GAIN[pos] - minus - plus * scale
  const others = (Object.keys(w) as AttributeKey[]).filter((k) => !(k in out))
  const share = others.reduce((a, k) => a + (w[k] ?? 0), 0) / total
  if (rest > 0.05 && share > 0) {
    const u = Math.min(ROLE_FILL_MAX, rest / share)
    for (const k of others) out[k] = Math.round(u * 10) / 10
  }
  return out
}
/**
 * Strengths that carry a companion attribute (split off in save v6): a role built on Pace ("Hız odaklı") is quick
 * over the first yards too, so Acceleration gets 0.6 of Pace's bump (the v6 migration's own 0.6 Hız share).
 * Role balance Tur 4: without it a Derinlik Forveti had slower first yards (56) than a Hedef Forvet (63) at OVR 68.
 */
export const PLUS_COMPANION: Readonly<Partial<Record<AttributeKey, readonly [AttributeKey, number]>>> = { pace: ['acceleration', 0.6] }
/** Largest strength scale (keeps a 17-year-old's best attribute in a believable range). */
const ROLE_SCALE_MAX = 2.4
/** Largest even top-up of the position's other attributes. */
const ROLE_FILL_MAX = 24

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
    attrs: { dribbling: 6, agility: 4, firstTouch: 3, composure: 3, workRate: 2, aggression: 2, positioning: -3 },
    potential: 1, money: 300, reputation: 1, followers: 250,
    relations: { mother: 60, father: 35, sibling: 50, bestFriend: 75 }, innatePerk: 'street_smart', trust: 35,
  },
  academy: {
    attrs: { positioning: 5, passing: 4, workRate: 3, vision: 2, anticipation: 2, tackling: 2, composure: 1 },
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

// ───────────────────────── Starting age ─────────────────────────

/** Youngest / oldest starting age the wizard offers, and the age the base sheet is tuned for. */
export const START_AGE_MIN = 16
export const START_AGE_MAX = 21
export const REF_START_AGE = 17
/** Age the growth curve flattens into the peak (ageXpMultiplier: 24–26), shown as "years to peak" in the wizard. */
export const PEAK_AGE = 26
/** Highest starting value of any attribute (older starters' ceiling moves up with their sheet). */
const attrStartMax = (age: number): number => 75 + Math.max(0, startAgeEffect(age).attrs)

/**
 * Starting-age trade-off (owner feedback). Younger: a lower sheet, more ceiling (potential) and more seasons in
 * the fast-growth years (ageXpMultiplier: ≤ 20 grows fastest). Older: a ready-made sheet (+OVR) but less ceiling,
 * less guaranteed headroom and fewer seasons before the peak and the decline, which come at the same real age
 * for everyone. Tuned with the BALANCE harness so 21 is not strictly better (docs/BALANCE.md, "Başlangıç yaşı").
 */
export interface StartAgeEffect {
  /** Points added to every attribute (outfield goalkeeping excluded). */
  attrs: number
  /** Shift of the rolled potential. */
  potential: number
  /** Minimum gap between starting OVR and potential. */
  headroom: number
  /** Starting reputation on top of the background's (an older starter has been seen around). */
  reputation: number
}
const START_AGE_EFFECT: Readonly<Record<number, StartAgeEffect>> = {
  16: { attrs: -2.5, potential: 2, headroom: 13, reputation: 0 },
  17: { attrs: 0, potential: 0, headroom: 12, reputation: 0 },
  18: { attrs: 4, potential: -0.5, headroom: 11, reputation: 3 },
  19: { attrs: 8, potential: -1, headroom: 10, reputation: 7 },
  20: { attrs: 12, potential: -2, headroom: 9, reputation: 11 },
  21: { attrs: 16, potential: -3, headroom: 8, reputation: 16 },
}
/** Starting age from a birth year (careers start in {@link START_YEAR}), clamped to the wizard's range. */
export const startAge = (birthYear: number): number =>
  Number.isFinite(birthYear) ? clamp(Math.round(START_YEAR - birthYear), START_AGE_MIN, START_AGE_MAX) : REF_START_AGE
export const startAgeEffect = (age: number): StartAgeEffect => START_AGE_EFFECT[clamp(Math.round(age), START_AGE_MIN, START_AGE_MAX)]!

/**
 * Starting value of one attribute before noise: base, keeper/outfield split, role template, position boost
 * and background. Shared by {@link createHero} and the wizard's live preview ({@link previewAttrs}).
 */
function attrBase(key: AttributeKey, pos: Position, tpl: Partial<Record<AttributeKey, number>>, bg: BackgroundDef, age = REF_START_AGE): number {
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
  // Older starters have more years of football behind them (outfielders do not pick up goalkeeping on the way).
  if (!(gk && !isKeeper)) v += startAgeEffect(age).attrs
  return v
}

/** Expected starting sheet (no noise) for the wizard's live preview. */
export function previewAttrs(pos: Position, role: Role, background: Background, age = REF_START_AGE): Attributes {
  return sheetFrom(pos, roleTemplate(normalizeRole(pos, role), pos), background, age)
}

/** The position's starting sheet without any role (the wizard shows each role's +/− against it). */
export function neutralAttrs(pos: Position, background: Background, age = REF_START_AGE): Attributes {
  return sheetFrom(pos, {}, background, age)
}

function sheetFrom(pos: Position, tpl: Partial<Record<AttributeKey, number>>, background: Background, age: number): Attributes {
  const bg = BACKGROUNDS[background]
  const out = {} as Attributes
  for (const key of ATTRIBUTE_KEYS) out[key] = clamp(Math.round(attrBase(key, pos, tpl, bg, age)), 5, attrStartMax(age))
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
  // The v6 attributes (acceleration, long passing, curve, anticipation, aggression, diving) likewise.
  const v6Rng = new Rng((st.a ^ st.c ^ hashString('attrs-v6')) >>> 0)
  const age = startAge(input.birthYear)
  for (const key of ATTRIBUTE_KEYS) {
    let v = attrBase(key, input.position, tpl, bg, age)
    v += (key === 'gkPositioning' || key === 'gkDistribution' ? gkRng : V6_ATTRIBUTE_KEYS.includes(key) ? v6Rng : rng).normal(0, ATTR_NOISE_SD)
    attrs[key] = clamp(Math.round(v), 5, attrStartMax(age))
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
    reputation: bg.reputation + startAgeEffect(age).reputation,
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
  const ae = startAgeEffect(age)
  const rolled = Math.round(rng.normal(80, 5)) + bg.potential + ae.potential
  hero.potential = clamp(Math.max(rolled, ovr + ae.headroom), 60, 99)

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
