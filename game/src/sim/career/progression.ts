/**
 * Attribute progression: XP → attribute points, the age curve, physical decline
 * and the position-weighted OVR formula.
 *
 * Model
 * -----
 * Every attribute has a progress fraction (`hero.attrXp[key]`, 0..1 of the
 * next point). Training, matches and activities pour XP in, converted at
 * {@link xpCostForNextPoint}; reaching 1 gains a point. Age decline drains the
 * same fraction (in points), so diligent
 * training can partially offset ageing — exactly the "fight the clock" feel we
 * want for a 33-year-old veteran.
 *
 * Diminishing returns come from two independent factors:
 *  1. Attribute level: higher attributes need more XP per point.
 *  2. Potential headroom: once OVR approaches the hidden potential, costs
 *     ramp up steeply (×3 at potential, up to ×10 beyond it), so potential is a
 *     soft ceiling (a hero can exceed it by ~2–3 points with heroic effort).
 */
import type { AttributeGroup, AttributeKey, Attributes, Hero, Position } from '../../core/types'
import { ATTRIBUTE_KEYS } from '../../core/types'
import { PERK_BY_ID } from '../../data/perks'
import { NOMINAL_SEASON_WEEKS, clamp, fill, finite, heroAge, lt, signed, type Lines } from './common'

// ───────────────────────── OVR ─────────────────────────

/**
 * Position weight table used by {@link ovrFor}. Weights are relative (they are
 * normalised by their sum). Attributes not listed do not count toward OVR for
 * that position. Exported so the world generator / match engine can derive NPC
 * attributes and OVR with the same formula.
 */
export const POSITION_WEIGHTS: Readonly<Record<Position, Readonly<Partial<Record<AttributeKey, number>>>>> = {
  GK: { reflexes: 3.5, diving: 3, handling: 4, gkPositioning: 4, gkDistribution: 2, agility: 2, jumping: 1.5, composure: 2, passing: 1, leadership: 1 },
  CB: { tackling: 5, heading: 4, positioning: 3, anticipation: 2, strength: 2.5, balance: 1.5, jumping: 2.5, composure: 2, pace: 1.5, acceleration: 0.5, passing: 1, longPassing: 0.5, aggression: 1, leadership: 1, workRate: 1, stamina: 1 },
  LB: { tackling: 4, pace: 3, acceleration: 1.5, crossing: 3, stamina: 3, positioning: 2.5, anticipation: 1, workRate: 2, passing: 2, dribbling: 1.5, agility: 1 },
  RB: { tackling: 4, pace: 3, acceleration: 1.5, crossing: 3, stamina: 3, positioning: 2.5, anticipation: 1, workRate: 2, passing: 2, dribbling: 1.5, agility: 1 },
  DM: { tackling: 4, positioning: 3, anticipation: 2, passing: 3, longPassing: 1.5, stamina: 2.5, strength: 2, balance: 0.5, workRate: 2.5, aggression: 1, vision: 2, composure: 2 },
  CM: { passing: 4, longPassing: 1.5, vision: 3.5, firstTouch: 3, stamina: 3, workRate: 2.5, tackling: 2, composure: 2, dribbling: 2, shooting: 1.5, positioning: 1, anticipation: 1 },
  AM: { vision: 4.5, passing: 4, dribbling: 3.5, firstTouch: 3.5, shooting: 2, curve: 1, composure: 2.5, agility: 1.5, acceleration: 1, finishing: 1.5, setPieces: 0.5 },
  LW: { pace: 3, acceleration: 2, dribbling: 4.5, crossing: 3, curve: 1, agility: 2.5, firstTouch: 2.5, finishing: 2, shooting: 1.5, passing: 2, stamina: 1.5 },
  RW: { pace: 3, acceleration: 2, dribbling: 4.5, crossing: 3, curve: 1, agility: 2.5, firstTouch: 2.5, finishing: 2, shooting: 1.5, passing: 2, stamina: 1.5 },
  ST: { finishing: 5, positioning: 3, anticipation: 1, shooting: 3, composure: 3, firstTouch: 2.5, heading: 2.5, pace: 1.5, acceleration: 1.5, strength: 1.5, balance: 1, dribbling: 1.5, agility: 1, jumping: 1 },
}

/** Which group each attribute belongs to (drives age curve & trainer bonuses). */
export const ATTRIBUTE_GROUP: Readonly<Record<AttributeKey, AttributeGroup>> = {
  pace: 'physical', stamina: 'physical', strength: 'physical', agility: 'physical', jumping: 'physical',
  passing: 'technical', shooting: 'technical', finishing: 'technical', dribbling: 'technical', firstTouch: 'technical',
  crossing: 'technical', heading: 'technical', tackling: 'technical', setPieces: 'technical',
  vision: 'mental', composure: 'mental', positioning: 'mental', leadership: 'mental', workRate: 'mental',
  reflexes: 'goalkeeping', handling: 'goalkeeping', gkPositioning: 'goalkeeping', gkDistribution: 'goalkeeping',
  acceleration: 'physical', longPassing: 'technical', curve: 'technical', anticipation: 'mental', aggression: 'mental',
  diving: 'goalkeeping', balance: 'physical',
}

/** Position-weighted overall rating (1..99) for an attribute set. */
export function ovrFor(attrs: Attributes, position: Position): number {
  const w = POSITION_WEIGHTS[position]
  let sum = 0
  let total = 0
  for (const k in w) {
    const key = k as AttributeKey
    const weight = w[key] ?? 0
    sum += weight * (attrs[key] ?? 0)
    total += weight
  }
  return clamp(Math.round(total > 0 ? sum / total : 0), 1, 99)
}

/** Hero OVR at his registered position. */
export const heroOvr = (hero: Pick<Hero, 'attrs' | 'position'>): number => ovrFor(hero.attrs, hero.position)

// ───────────────────────── XP economics ─────────────────────────

/** Absolute attribute ceiling. */
export const ATTR_MAX = 99

/**
 * Save v6 added seven attributes, so every session and match spreads its XP over more of them: each point
 * costs less so a career's OVR curve (BALANCE targets) stays where it was.
 */
export const XP_COST_SCALE = 0.8

/**
 * XP needed for the next point of an attribute.
 *  - Base 60 XP at 0, ~95 at 50, ~116 at 80. A normal session pours ~30 XP
 *    split over 3–5 attributes, so the *focused* attribute gains a point every
 *    ~5–7 sessions for a teenager: steady, visible progress every week or so,
 *    while a whole season adds ~5–7 OVR early in a career.
 *  - Headroom factor: ×1 while OVR is 12+ below potential, rises linearly to
 *    ×3 at potential, then +2 per OVR above it (cap ×15): potential is a soft
 *    ceiling that dedicated players can beat by only 2–4 points.
 *  - 95+ attributes cost double: world-class peaks should be rare.
 */
export function xpCostForNextPoint(current: number, ovr: number, potential: number): number {
  const base = (60 + current * 0.7) * XP_COST_SCALE
  const headroom = potential - ovr
  let ceiling: number
  if (headroom >= 12) ceiling = 1
  else if (headroom >= 0) ceiling = 1 + ((12 - headroom) / 12) * 2
  else ceiling = Math.min(15, 3 + 2 * -headroom)
  const elite = current >= 95 ? 2 : 1
  return base * ceiling * elite
}

/**
 * Age multiplier on XP *gains* (GDD 2.2: 17–23 fast, 24–29 peak/slow, 30+ decline).
 * Mental attributes keep improving into the 30s (experience), so they get a
 * softer curve. `late_growth` (late bloomer innate perk) boosts gains before 25.
 */
export function ageXpMultiplier(age: number, group: AttributeGroup, lateGrowth = 0): number {
  let m: number
  if (age <= 20) m = 1.35
  else if (age <= 23) m = 1.15
  else if (age <= 26) m = 0.8
  else if (age <= 29) m = 0.6
  else if (age <= 32) m = 0.4
  else m = 0.2
  // Experience: mental growth decays half as fast after 26.
  if (group === 'mental' && age > 26) m = Math.min(1, m * 1.6)
  if (age < 25) m *= 1 + lateGrowth
  return m
}

/** Sum the effect values of all perks the hero owns for a key (local copy to avoid an import cycle with perks.ts). */
function ownPerkValue(hero: Hero, key: string): number {
  let v = 0
  for (const id of hero.perks) {
    const p = PERK_BY_ID[id]
    if (p && p.effect.key === key) v += p.effect.value
  }
  return v
}

/**
 * Pour raw XP into one attribute, applying age multiplier and diminishing
 * returns. Returns the number of points gained (can be 0).
 * Callers apply source-specific bonuses (training quality, trainer, facilities)
 * *before* calling this.
 */
export function addAttributeXp(hero: Hero, key: AttributeKey, rawXp: number, season: number): number {
  if (!(rawXp > 0) || !Number.isFinite(rawXp)) return 0
  const age = heroAge(hero, season)
  let xp = rawXp * ageXpMultiplier(age, ATTRIBUTE_GROUP[key], ownPerkValue(hero, 'late_growth'))
  // attrXp stores the *fraction* (0..1) of the next point, so the value stays
  // meaningful when costs change (OVR crossing potential, ageing).
  let frac = finite(hero.attrXp[key] ?? 0)
  let gained = 0
  // Loop guard: at most 5 points from a single pour (avoids runaway on huge XP).
  for (let i = 0; i < 5 && xp > 0; i++) {
    const cur = hero.attrs[key]
    if (cur >= ATTR_MAX) { frac = 0; break }
    const cost = xpCostForNextPoint(cur, heroOvr(hero), hero.potential)
    const need = (1 - frac) * cost
    if (xp < need) { frac += xp / cost; xp = 0; break }
    xp -= need
    frac = 0
    hero.attrs[key] = cur + 1
    gained++
  }
  hero.attrXp[key] = frac
  return gained
}

/** Result of applying a bundle of XP. */
export interface XpResult {
  gains: Partial<Record<AttributeKey, number>>
  ovrBefore: number
  ovrAfter: number
  lines: Lines
}

/** Localized attribute names for feedback lines. */
export const ATTRIBUTE_NAMES: Readonly<Record<AttributeKey, { tr: string; en: string }>> = {
  pace: lt('Hız', 'Pace'), stamina: lt('Dayanıklılık', 'Stamina'), strength: lt('Güç', 'Strength'),
  agility: lt('Çeviklik', 'Agility'), jumping: lt('Zıplama', 'Jumping'), passing: lt('Pas', 'Passing'),
  shooting: lt('Şut', 'Shooting'), finishing: lt('Bitiricilik', 'Finishing'), dribbling: lt('Dribbling', 'Dribbling'),
  firstTouch: lt('İlk Dokunuş', 'First Touch'), crossing: lt('Orta', 'Crossing'), heading: lt('Kafa', 'Heading'),
  tackling: lt('Top Kapma', 'Tackling'), setPieces: lt('Duran Top', 'Set Pieces'), vision: lt('Vizyon', 'Vision'),
  composure: lt('Soğukkanlılık', 'Composure'), positioning: lt('Pozisyon Alma', 'Positioning'),
  leadership: lt('Liderlik', 'Leadership'), workRate: lt('Çalışkanlık', 'Work Rate'), reflexes: lt('Refleks', 'Reflexes'),
  handling: lt('Top Tutma', 'Handling'), gkPositioning: lt('Pozisyon (Kaleci)', 'Positioning (GK)'),
  gkDistribution: lt('Oyun Kurma (Kaleci)', 'Distribution (GK)'), acceleration: lt('Hızlanma', 'Acceleration'),
  longPassing: lt('Uzun Pas', 'Long Passing'), curve: lt('Falso', 'Curve'), anticipation: lt('Önsezi', 'Anticipation'),
  aggression: lt('Agresiflik', 'Aggression'), diving: lt('Plonjon', 'Diving'), balance: lt('Denge', 'Balance'),
}

/**
 * Apply an XP bundle (e.g. from a training session or a match), then check
 * perk unlocks. Produces lines like "Şut +1 (64)" and "OVR 61 → 62".
 */
export function applyXpBundle(hero: Hero, bundle: Partial<Record<AttributeKey, number>>, season: number): XpResult {
  const ovrBefore = heroOvr(hero)
  const gains: Partial<Record<AttributeKey, number>> = {}
  const lines: Lines = []
  for (const k in bundle) {
    const key = k as AttributeKey
    const g = addAttributeXp(hero, key, bundle[key] ?? 0, season)
    if (g > 0) {
      gains[key] = g
      lines.push(fill(lt('{attr} {d} ({v})', '{attr} {d} ({v})'), { attr: ATTRIBUTE_NAMES[key], d: signed(g), v: hero.attrs[key] }))
    }
  }
  const ovrAfter = heroOvr(hero)
  if (ovrAfter !== ovrBefore) lines.push(fill(lt('Genel güç {a} → {b}', 'Overall {a} → {b}'), { a: ovrBefore, b: ovrAfter }))
  lines.push(...checkPerkUnlock(hero))
  return { gains, ovrBefore, ovrAfter, lines }
}

// ───────────────────────── Perk points ─────────────────────────

/** OVR at which perk points start being awarded. */
export const PERK_OVR_BASE = 40
/** A perk point every N OVR (GDD: "her 5 OVR'de bir perk puanı"). */
export const PERK_OVR_STEP = 5

/** Total non-innate perk points a hero at this OVR has earned. */
export const earnedPerkPoints = (ovr: number): number => Math.max(0, Math.floor((ovr - PERK_OVR_BASE) / PERK_OVR_STEP))

/** Perk points already granted (unspent + cost of owned paid perks). */
export function grantedPerkPoints(hero: Hero): number {
  let spent = 0
  for (const id of hero.perks) spent += PERK_BY_ID[id]?.cost ?? 0
  return hero.perkPoints + spent
}

/**
 * Stateless perk point check: grants points so that the total ever granted
 * equals the best milestone reached. Because the granted total never shrinks,
 * losing OVR with age and regaining it never double-awards.
 */
export function checkPerkUnlock(hero: Hero): Lines {
  const due = earnedPerkPoints(heroOvr(hero)) - grantedPerkPoints(hero)
  if (due <= 0) return []
  hero.perkPoints += due
  return [fill(lt('🌟 {n} yeni yetenek puanı kazandın!', '🌟 You earned {n} new perk point(s)!'), { n: due })]
}

// ───────────────────────── Ageing ─────────────────────────

/**
 * Per-SEASON physical decline (points/attribute) by age.
 * 30 → ~1.1, 32 → ~3.1, 34 → ~6.3, capped at 9: a 34-year-old winger loses
 * about a sixth of his pace over three years, matching real-world curves.
 */
export function physicalDeclinePerSeason(age: number): number {
  if (age < 30) return 0
  const y = age - 29
  return Math.min(9, 0.9 * y + 0.15 * y * y)
}

/** Per-season technical decline: touch and shooting fade from 31 (0.8/yr per year past 30, cap 5). */
export function technicalDeclinePerSeason(age: number): number {
  return age < 31 ? 0 : Math.min(5, 0.8 * (age - 30))
}

/** Per-season mental decline: only from 34, gentle (concentration, not wisdom). */
export function mentalDeclinePerSeason(age: number): number {
  return age < 34 ? 0 : Math.min(3, 0.6 * (age - 33))
}

/**
 * Natural (no-training) per-week XP for teenagers: bodies grow and match
 * experience accumulates regardless. Only physical attributes, only ≤ 21.
 */
export function naturalGrowthXp(age: number): number {
  if (age <= 18) return 1.6
  if (age <= 21) return 0.8
  return 0
}

/**
 * Per-attribute decline speed relative to its group, like a real footballer's body: the first
 * yard (acceleration), top speed and agility go first, strength and balance hold; technique fades
 * in the legs (dribbling, tackling) before the passing range; the football brain (vision,
 * positioning, anticipation, leadership) does not decline at all and keeps growing with
 * experience ({@link EXPERIENCE_XP}). Group means stay ≈ 1 so the OVR curve keeps its shape.
 */
export const DECLINE_MULT: Readonly<Partial<Record<AttributeKey, number>>> = {
  // physical (mean 1.0)
  acceleration: 1.35, pace: 1.15, agility: 1.15, jumping: 1, stamina: 0.95, balance: 0.85, strength: 0.55,
  // technical (mean ≈ 0.93)
  dribbling: 1.25, tackling: 1.2, shooting: 1.05, crossing: 1.05, heading: 1, finishing: 0.95, firstTouch: 0.95,
  passing: 0.8, longPassing: 0.7, curve: 0.7, setPieces: 0.6,
  // mental: experience protects the reading of the game
  vision: 0, leadership: 0, anticipation: 0.3, positioning: 0.3, composure: 0.5, aggression: 1.2, workRate: 1.6,
  // goalkeeping: reach goes before handling and angles
  diving: 1.15, reflexes: 1.1, handling: 0.8, gkPositioning: 0.4, gkDistribution: 0.6,
}

/** Weekly "experience" XP from 28 on (veterans with 60+ games): the football brain keeps growing. */
export const EXPERIENCE_XP: Readonly<Partial<Record<AttributeKey, number>>> = { vision: 2.2, positioning: 2, anticipation: 2.2, leadership: 2.5, composure: 1.5 }
export const EXPERIENCE_AGE = 28

/**
 * Weekly ageing tick: physical/technical/mental decline after 30 (drains the
 * progress fraction; a point is lost when it goes negative) and natural teenage growth.
 * `weeksPerSeason` converts the per-season curve into weekly drain.
 */
export function weeklyAging(hero: Hero, season: number, weeksPerSeason = NOMINAL_SEASON_WEEKS, care = 0): Lines {
  const age = heroAge(hero, season)
  const lines: Lines = []
  // Perks and body care (diet, sleep: condition.bodyCare) hold back the physical decline.
  const slow = clamp(ownPerkValue(hero, 'aging_slow') + clamp(care, 0, 0.25), 0, 0.9)
  const phys = (physicalDeclinePerSeason(age) * (1 - slow)) / weeksPerSeason
  const tech = technicalDeclinePerSeason(age) / weeksPerSeason
  const mental = mentalDeclinePerSeason(age) / weeksPerSeason
  const ovrBefore = heroOvr(hero)
  if (phys > 0 || tech > 0 || mental > 0) {
    for (const key of ATTRIBUTE_KEYS) {
      const g = ATTRIBUTE_GROUP[key]
      const base = g === 'physical' ? phys : g === 'technical' ? tech : g === 'mental' ? mental : phys * 0.6 // keepers' reflexes fade with the body
      // The first yard goes first: acceleration fades faster than top speed.
      const points = base * (DECLINE_MULT[key] ?? 1)
      if (points <= 0) continue
      const cur = hero.attrs[key]
      if (cur <= 20) continue // floor: veterans never become useless
      // Decline is measured in points, so it drains the 0..1 fraction directly.
      let frac = finite(hero.attrXp[key] ?? 0) - points
      if (frac < 0) {
        hero.attrs[key] = cur - 1
        frac += 1
      }
      hero.attrXp[key] = frac
    }
  }
  const grow = naturalGrowthXp(age)
  if (grow > 0) {
    for (const key of ATTRIBUTE_KEYS) if (ATTRIBUTE_GROUP[key] === 'physical') addAttributeXp(hero, key, grow, season)
  }
  if (age >= EXPERIENCE_AGE && (hero.careerStats?.apps ?? 0) >= 60) {
    for (const [k, xp] of Object.entries(EXPERIENCE_XP) as [AttributeKey, number][]) addAttributeXp(hero, k, xp, season)
  }
  const ovrAfter = heroOvr(hero)
  if (ovrAfter < ovrBefore) {
    lines.push(fill(lt('Yaş etkisini gösteriyor: genel güç {a} → {b}', 'Age is catching up: overall {a} → {b}'), { a: ovrBefore, b: ovrAfter }))
  } else if (ovrAfter > ovrBefore) {
    lines.push(fill(lt('Doğal gelişim: genel güç {a} → {b}', 'Natural development: overall {a} → {b}'), { a: ovrBefore, b: ovrAfter }))
  }
  lines.push(...checkPerkUnlock(hero))
  return lines
}

/**
 * Coarse star rating (0.5..5) of the hidden potential as a scout would report
 * it. `noise` is the scout's error in potential points; callers draw it from
 * the Rng with a spread that shrinks with agent quality / scout reports.
 */
export function potentialStars(potential: number, noise = 0): number {
  const raw = (potential + noise - 50) / 10 // 60 → 1★, 80 → 3★, 99 → 4.9★
  return clamp(Math.round(raw * 2) / 2, 0.5, 5)
}
