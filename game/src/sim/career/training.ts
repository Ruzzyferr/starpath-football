/**
 * Training sessions (GDD 2.3). A session maps a training type to attributes,
 * costs energy, adds fatigue, may injure, and grants XP scaled by the
 * mini-game `performance` score (0..1; 0.6 when auto-simulated).
 *
 * XP formula (per session):
 *   total = baseXp × quality(performance) × intensity × fatigueEfficiency
 *           × (1 + perks + facilities) × wellbeing
 *   per attribute = total × weight share (+25% for attributes in the hired
 *   trainer's group)
 *
 * Tuning target: an average week (5 normal sessions at 0.6, plus matches)
 * moves a 17-year-old's OVR by ≈ +0.6 and a 27-year-old's by ≈ +0.1.
 * See progression.test.ts for the full career curve.
 */
import type { AttributeKey, Hero, LText, Life } from '../../core/types'
import type { Rng } from '../../core/rng'
import { clamp, fill, lt, meter, type Lines } from './common'
import { ATTRIBUTE_GROUP, applyXpBundle } from './progression'
import { perkValue } from './perks'
import { addFatigue, applyInjury, recoverFatigue, rollInjury } from './condition'
import { assetEffectTotal } from '../life/assetEffects'
import { injuryProneness, wellbeingXpMultiplier } from '../life/wellbeing'

export type TrainingType =
  | 'shooting' | 'passing' | 'dribbling' | 'physical' | 'tactical' | 'setPiece' | 'goalkeeping' | 'recovery'

export type TrainingIntensity = 'light' | 'normal' | 'hard'

export interface TrainingDef {
  id: TrainingType
  name: LText
  icon: string
  /** Relative XP split across attributes. */
  attrs: Partial<Record<AttributeKey, number>>
  /** Total XP for a normal-intensity, performance 0.6 session (before age multiplier). */
  baseXp: number
  energy: number
  /** Fatigue added (negative = recovers). */
  fatigue: number
  /** Base injury probability per session at normal intensity, fresh body. */
  injuryRisk: number
  /** Sharpness gained (match-like drills keep you sharp). */
  sharpness: number
  /** Stress change (drills are mildly stressful, yoga relaxes). */
  stress: number
  /** Perk effect key giving extra XP for this type. */
  perkKey?: string
}

/**
 * Session catalogue. Energy 15–25 so 3–4 sessions fit a day budget of 100
 * alongside rest; fatigue 8–14 so back-to-back hard days need a recovery day.
 * Injury 0.4–0.8% per session: over ~200 sessions/season ≈ 1 training knock.
 */
export const TRAINING_TYPES: Readonly<Record<TrainingType, TrainingDef>> = {
  shooting: {
    id: 'shooting', icon: '🎯', name: lt('Şut Antrenmanı', 'Shooting Drill'),
    attrs: { shooting: 4, finishing: 4, composure: 1.5, heading: 1 }, baseXp: 30, energy: 20, fatigue: 9, injuryRisk: 0.005, sharpness: 3, stress: 1,
  },
  passing: {
    id: 'passing', icon: '🔁', name: lt('Pas Çalışması', 'Passing Drill'),
    attrs: { passing: 4, vision: 2.5, firstTouch: 2.5, crossing: 2 }, baseXp: 30, energy: 18, fatigue: 8, injuryRisk: 0.004, sharpness: 3, stress: 1,
  },
  dribbling: {
    id: 'dribbling', icon: '🌀', name: lt('Top Sürme', 'Dribbling Course'),
    attrs: { dribbling: 4, agility: 2.5, firstTouch: 2.5, pace: 1 }, baseXp: 30, energy: 20, fatigue: 10, injuryRisk: 0.006, sharpness: 3, stress: 1,
  },
  physical: {
    id: 'physical', icon: '🏋️', name: lt('Kondisyon & Güç', 'Fitness & Strength'),
    attrs: { stamina: 3, strength: 3, pace: 2, jumping: 1.5, agility: 1 }, baseXp: 32, energy: 25, fatigue: 14, injuryRisk: 0.008, sharpness: 4, stress: 2, perkKey: 'xp_physical',
  },
  tactical: {
    id: 'tactical', icon: '📋', name: lt('Taktik Çalışma', 'Tactical Session'),
    attrs: { positioning: 3.5, vision: 2.5, workRate: 2, tackling: 2, leadership: 1 }, baseXp: 28, energy: 12, fatigue: 5, injuryRisk: 0.002, sharpness: 2, stress: 1, perkKey: 'xp_tactical',
  },
  setPiece: {
    id: 'setPiece', icon: '🚩', name: lt('Duran Top', 'Set Pieces'),
    attrs: { setPieces: 4.5, crossing: 2, shooting: 1.5, heading: 1.5 }, baseXp: 28, energy: 14, fatigue: 6, injuryRisk: 0.003, sharpness: 2, stress: 0,
  },
  goalkeeping: {
    id: 'goalkeeping', icon: '🧤', name: lt('Kaleci Antrenmanı', 'Goalkeeping Drill'),
    attrs: { reflexes: 4, handling: 4, positioning: 1.5, agility: 1.5, jumping: 1 }, baseXp: 32, energy: 20, fatigue: 10, injuryRisk: 0.005, sharpness: 3, stress: 1,
  },
  recovery: {
    id: 'recovery', icon: '🧘', name: lt('Yoga & Toparlanma', 'Yoga & Recovery'),
    attrs: { agility: 1, composure: 1 }, baseXp: 6, energy: 8, fatigue: -18, injuryRisk: 0, sharpness: 0, stress: -6,
  },
}

/** Intensity multipliers: hard sessions are XP-efficient but costly and risky. */
export const INTENSITY: Readonly<Record<TrainingIntensity, { xp: number; energy: number; fatigue: number; injury: number }>> = {
  light: { xp: 0.6, energy: 0.6, fatigue: 0.5, injury: 0.4 },
  normal: { xp: 1, energy: 1, fatigue: 1, injury: 1 },
  hard: { xp: 1.35, energy: 1.4, fatigue: 1.6, injury: 1.8 },
}

/** Default performance score when the session is auto-simulated (no mini-game). */
export const AUTO_PERFORMANCE = 0.6

/** Mini-game quality → XP factor. 0 → 0.3, 0.6 (auto) → 1.02, 1.0 → 1.5. */
export const qualityFactor = (performance: number): number => 0.3 + 1.2 * clamp(performance, 0, 1)

/** A tired body learns less: fatigue 0 → 1.0, 100 → 0.6. */
export const fatigueEfficiency = (fatigue: number): number => 1 - clamp(fatigue, 0, 100) / 250

/** Trainer bonus on attributes in his group (legacy default; see {@link trainerBonus}). */
export const TRAINER_GROUP_BONUS = 0.25

/** XP bonus on the trainer's group by trainer quality (1 = club coach … 3 = elite). */
export const TRAINER_QUALITY_BONUS: Readonly<Record<1 | 2 | 3, number>> = { 1: 0.15, 2: 0.25, 3: 0.4 }

/** XP bonus a hired trainer gives on his group (0 without a trainer). */
export function trainerBonus(trainer: Life['trainer']): number {
  if (!trainer) return 0
  return TRAINER_QUALITY_BONUS[trainer.quality ?? 2] ?? TRAINER_GROUP_BONUS
}

export interface TrainingInput {
  type: TrainingType
  /** 0..1 mini-game score; omit for auto ({@link AUTO_PERFORMANCE}). */
  performance?: number
  intensity?: TrainingIntensity
  season: number
}

export interface TrainingResult {
  ok: boolean
  xp: Partial<Record<AttributeKey, number>>
  gains: Partial<Record<AttributeKey, number>>
  injured: boolean
  energySpent: number
  lines: Lines
}

/** Energy a session will cost (UI preview). */
export const trainingEnergyCost = (type: TrainingType, intensity: TrainingIntensity = 'normal'): number =>
  Math.round(TRAINING_TYPES[type].energy * INTENSITY[intensity].energy)

/** Injury probability for a session (UI can show it as a risk hint). */
export function trainingInjuryChance(hero: Hero, life: Life, type: TrainingType, intensity: TrainingIntensity = 'normal'): number {
  return TRAINING_TYPES[type].injuryRisk * INTENSITY[intensity].injury * injuryProneness(life, hero)
}

/**
 * Global scale on session XP (balance pass, docs/BALANCE.md). The autopilot
 * and most players train twice a day (~10 sessions/week, not the 5 the curve
 * was first tuned for), which doubled growth: OVR 62 → 79 in two seasons and
 * heroes blowing past their potential. 0.45 brings a 10-session week back to
 * the intended pace (+5–7 OVR per season while young).
 */
export const SESSION_XP_SCALE = 0.45

/**
 * Raw XP per attribute a session would grant (before the age multiplier),
 * with the hero's current fatigue, perks, assets, wellbeing and trainer.
 * Pure: the UI uses it for previews ("+38 XP at grade A").
 */
export function trainingXp(hero: Hero, life: Life, type: TrainingType, performance = AUTO_PERFORMANCE, intensity: TrainingIntensity = 'normal'): Partial<Record<AttributeKey, number>> {
  const def = TRAINING_TYPES[type]
  const bonus =
    perkValue(hero, 'xp_all') + (def.perkKey ? perkValue(hero, def.perkKey) : 0) + assetEffectTotal(life, 'xp_bonus')
  const total =
    SESSION_XP_SCALE * def.baseXp * qualityFactor(performance) * INTENSITY[intensity].xp * fatigueEfficiency(hero.fatigue) * (1 + bonus) * wellbeingXpMultiplier(life)
  const wsum = Object.values(def.attrs).reduce((a, b) => a + (b ?? 0), 0)
  const tb = trainerBonus(life.trainer)
  const xp: Partial<Record<AttributeKey, number>> = {}
  for (const k in def.attrs) {
    const key = k as AttributeKey
    let v = (total * (def.attrs[key] ?? 0)) / wsum
    if (life.trainer && life.trainer.group === ATTRIBUTE_GROUP[key]) v *= 1 + tb
    xp[key] = v
  }
  return xp
}

/** Sum of {@link trainingXp}. */
export const trainingXpTotal = (hero: Hero, life: Life, type: TrainingType, performance = AUTO_PERFORMANCE, intensity: TrainingIntensity = 'normal'): number =>
  Object.values(trainingXp(hero, life, type, performance, intensity)).reduce((a, b) => a + (b ?? 0), 0)

/**
 * Run one training session: spends energy, applies fatigue/sharpness/stress,
 * rolls injury, grants XP. Refuses (ok=false) if the hero is injured or lacks
 * energy — the UI should grey the option out using {@link trainingEnergyCost}.
 */
export function runTraining(rng: Rng, hero: Hero, life: Life, input: TrainingInput): TrainingResult {
  const def = TRAINING_TYPES[input.type]
  const intensity = input.intensity ?? 'normal'
  const im = INTENSITY[intensity]
  const energy = trainingEnergyCost(input.type, intensity)
  const fail = (text: LText): TrainingResult => ({ ok: false, xp: {}, gains: {}, injured: false, energySpent: 0, lines: [text] })
  if (hero.injury && input.type !== 'recovery') return fail(lt('Sakatken antrenman yapamazsın; fizyoterapiye git.', "You can't train while injured; see the physio."))
  if (life.energy < energy) return fail(lt('Bu antrenman için enerjin yetersiz.', 'Not enough energy for this session.'))

  const performance = clamp(input.performance ?? AUTO_PERFORMANCE, 0, 1)
  const lines: Lines = []
  life.energy = meter(life.energy - energy)

  // XP total — computed with the fatigue *before* the session.
  const xp = trainingXp(hero, life, input.type, performance, intensity)

  // Body & mind.
  if (def.fatigue >= 0) addFatigue(hero, def.fatigue * im.fatigue)
  else recoverFatigue(hero, life, -def.fatigue * im.fatigue)
  hero.sharpness = meter(hero.sharpness + def.sharpness * (intensity === 'hard' ? 1.5 : 1))
  life.stress = meter(life.stress + def.stress * im.fatigue)

  // Injury roll uses the *post-session* fatigue (exhaustion at the end of a drill).
  let injured = false
  const p = def.injuryRisk * im.injury * injuryProneness(life, hero)
  if (p > 0 && rng.chance(p)) {
    injured = true
    lines.push(...applyInjury(hero, life, rollInjury(rng, hero, life, [0.75, 0.22, 0.03])))
  }

  const res = applyXpBundle(hero, xp, input.season)
  lines.unshift(
    fill(lt('{i} {n} tamamlandı (performans %{p}).', '{i} {n} complete (performance {p}%).'), {
      i: def.icon, n: def.name, p: Math.round(performance * 100),
    }),
  )
  lines.push(...res.lines)
  return { ok: true, xp, gains: res.gains, injured, energySpent: energy, lines }
}
