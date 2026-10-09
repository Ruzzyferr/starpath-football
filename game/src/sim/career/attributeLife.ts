/**
 * Attributes in the player's life (owner requirement: "every stat must be developable through
 * training and matter in the player's life like a real footballer").
 *
 * Pure helpers shared by the training screen, objectives, event cards and transfers:
 *  - which sessions train which attribute ({@link sessionsFor}, {@link trainingCoverage});
 *  - the hero's development areas: the weak stats of his role ({@link developmentAreas});
 *  - his calling-card strengths as a scout would write them up ({@link signatureStrengths});
 *  - how well his attribute profile suits a club's playing style ({@link styleFit}).
 */
import { ATTRIBUTE_KEYS, isGoalkeepingAttr, type AttributeKey, type Attributes, type Hero, type LText, type TacticStyle } from '../../core/types'
import { ROLE_SPEC } from './createHero'
import { ATTRIBUTE_NAMES, POSITION_WEIGHTS } from './progression'
import { TRAINING_TYPES, type TrainingType } from './training'

/** Sessions that train `key`, best first (share of the session's XP that goes to it). */
export function sessionsFor(key: AttributeKey): { type: TrainingType; share: number }[] {
  const out: { type: TrainingType; share: number }[] = []
  for (const type of Object.keys(TRAINING_TYPES) as TrainingType[]) {
    const attrs = TRAINING_TYPES[type].attrs
    const w = attrs[key] ?? 0
    if (w <= 0) continue
    const sum = Object.values(attrs).reduce((a, b) => a + (b ?? 0), 0)
    out.push({ type, share: w / sum })
  }
  return out.sort((a, b) => b.share - a.share)
}

/** The session that trains `key` hardest. */
export const bestSessionFor = (key: AttributeKey): TrainingType | null => sessionsFor(key)[0]?.type ?? null

/** Attribute → sessions table (every attribute must have at least one; see attributeLife.test.ts). */
export function trainingCoverage(): Record<AttributeKey, TrainingType[]> {
  const out = {} as Record<AttributeKey, TrainingType[]>
  for (const k of ATTRIBUTE_KEYS) out[k] = sessionsFor(k).map((s) => s.type)
  return out
}

/**
 * The hero's development areas: the minus stats of his role (ROLE_SPEC, the "4−" of the role
 * spec), weakest first. Outfielders never get goalkeeping stats; a hero without a role falls
 * back to the four weakest attributes that count for his position.
 */
export function developmentAreas(hero: Pick<Hero, 'attrs' | 'position' | 'role'>): AttributeKey[] {
  const spec = hero.role ? ROLE_SPEC[hero.role] : undefined
  const gk = hero.position === 'GK'
  let keys: AttributeKey[] = spec ? [...spec.minus] : []
  if (!keys.length) {
    const w = POSITION_WEIGHTS[hero.position]
    keys = (Object.keys(w) as AttributeKey[]).sort((a, b) => hero.attrs[a] - hero.attrs[b]).slice(0, 4)
  }
  return keys.filter((k) => gk || !isGoalkeepingAttr(k)).sort((a, b) => hero.attrs[a] - hero.attrs[b])
}

/** The weakest development area (the manager's favourite talking point). */
export const weakestDevArea = (hero: Pick<Hero, 'attrs' | 'position' | 'role'>): AttributeKey | null => developmentAreas(hero)[0] ?? null

/**
 * Calling-card strengths: the attributes that make the hero who he is at his position
 * (the value, plus 2 per point of positional weight; a stat the position does not use needs to
 * stand out by 6 more to make the list). Scouts, pundits and the press cite these.
 */
export function signatureStrengths(hero: Pick<Hero, 'attrs' | 'position'>, n = 3): AttributeKey[] {
  const w = POSITION_WEIGHTS[hero.position]
  const gk = hero.position === 'GK'
  return ATTRIBUTE_KEYS.filter((k) => gk || !isGoalkeepingAttr(k))
    .map((k) => ({ k, s: hero.attrs[k] + 2 * (w[k] ?? 0) - ((w[k] ?? 0) === 0 ? 6 : 0) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((x) => x.k)
}

/** "Hızlanma 84, Hız 81 ve Önsezi 77" — a natural-language list of stats with their values. */
export function statList(hero: Pick<Hero, 'attrs'>, keys: readonly AttributeKey[]): LText {
  const part = (lang: 'tr' | 'en') => keys.map((k) => `${ATTRIBUTE_NAMES[k][lang]} ${hero.attrs[k]}`)
  const join = (xs: string[], and: string) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} ${and} ${xs[xs.length - 1]}`)
  return { tr: join(part('tr'), 've'), en: join(part('en'), 'and') }
}

/** What each club playing style looks for in a player (weights; the scouts' shopping list). */
export const STYLE_WANTS: Readonly<Record<TacticStyle, Partial<Record<AttributeKey, number>>>> = {
  possession: { passing: 3, firstTouch: 2.5, vision: 2.5, composure: 2, longPassing: 1 },
  counter: { pace: 3, acceleration: 3, finishing: 1.5, longPassing: 1.5, dribbling: 1.5 },
  direct: { strength: 2.5, heading: 2.5, jumping: 2, longPassing: 2, crossing: 1.5 },
  pressing: { workRate: 3, stamina: 3, aggression: 2, anticipation: 2, acceleration: 1 },
  defensive: { positioning: 3, tackling: 2.5, anticipation: 2.5, strength: 1.5, composure: 1.5 },
  balanced: {},
}

/**
 * How well the hero's profile suits a playing style, −1..1: the style's wanted attributes
 * against the hero's own average (outfield attributes; keepers use their group). 0 for a
 * balanced side.
 */
export function styleFit(attrs: Attributes, style: TacticStyle, gk = false): number {
  const wants = STYLE_WANTS[style]
  const keys = Object.keys(wants) as AttributeKey[]
  if (!keys.length) return 0
  const pool: readonly AttributeKey[] = gk ? ATTRIBUTE_KEYS : ATTRIBUTE_KEYS.filter((k) => !isGoalkeepingAttr(k))
  const mean = pool.reduce((a, k) => a + attrs[k], 0) / pool.length
  let sum = 0
  let tw = 0
  for (const k of keys) {
    sum += (wants[k] ?? 0) * (attrs[k] - mean)
    tw += wants[k] ?? 0
  }
  return Math.max(-1, Math.min(1, sum / tw / 15))
}

/** The attribute that best explains a style fit (for "their pressing game suits your Work Rate 81"). */
export function styleKeyStat(attrs: Attributes, style: TacticStyle): AttributeKey | null {
  const wants = STYLE_WANTS[style]
  const keys = Object.keys(wants) as AttributeKey[]
  if (!keys.length) return null
  return keys.sort((a, b) => (wants[b] ?? 0) * attrs[b] - (wants[a] ?? 0) * attrs[a])[0] ?? null
}
