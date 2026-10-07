/**
 * Wellbeing dynamics (GDD 4.1): happiness, stress, health, burnout, and the
 * hooks other systems read — match composure ({@link mentalMatchModifier}),
 * injury proneness ({@link injuryProneness}) and the daily energy cap.
 *
 * Philosophy: meters drift toward a *target* computed from the hero's life
 * situation (family, money, career) instead of jumping around. Activities and
 * events push them away from the target; the weekly tick pulls them back by a
 * fraction, so one bad night out is forgotten in ~2 weeks but a toxic lifestyle
 * keeps them pinned.
 */
import type { Hero, Life } from '../../core/types'
import { clamp, fill, lt, meter, type Lines } from '../career/common'
import { perkValue } from '../career/perks'
import { closeCircleMood } from './relationships'

/** Stress level that counts toward burnout. */
export const BURNOUT_STRESS = 85
/** Consecutive weeks above {@link BURNOUT_STRESS} before burnout triggers. */
export const BURNOUT_WEEKS = 3
/** Stress must fall below this to recover from burnout. */
export const BURNOUT_RECOVERY_STRESS = 45

/** Apply a stress change; positive changes are reduced by `stress_resist` perks. */
export function addStress(life: Life, hero: Pick<Hero, 'perks'> | null, delta: number): number {
  if (!Number.isFinite(delta)) return 0
  const d = delta > 0 && hero ? delta * (1 - clamp(perkValue(hero, 'stress_resist'), 0, 0.8)) : delta
  const before = life.stress
  life.stress = meter(life.stress + d, 30)
  return life.stress - before
}

/** Apply a happiness change (clamped). */
export function addHappiness(life: Life, delta: number): number {
  const before = life.happiness
  life.happiness = meter(life.happiness + (Number.isFinite(delta) ? delta : 0), 50)
  return life.happiness - before
}

/** Apply a health change (clamped). */
export function addHealth(life: Life, delta: number): number {
  const before = life.health
  life.health = meter(life.health + (Number.isFinite(delta) ? delta : 0), 80)
  return life.health - before
}

/** True while the hero is burned out. */
export const isBurnedOut = (life: Life): boolean => life.flags.burnout === true

/** Context the weekly tick needs from other systems (all optional). */
export interface WellbeingContext {
  /** Passive weekly happiness from owned assets (economy.assetHappiness). */
  assetHappiness?: number
  /** Weekly net income after tax (economy tick) — money worries vs comfort. */
  weeklyNet?: number
  /** Matches the hero played this week (load → stress). */
  matchesPlayed?: number
  /** True during the off-season (holiday mood). */
  offSeason?: boolean
}

/**
 * Happiness target 20..95 from life situation:
 *  base 55 · close circle −15..+15 · morale (career) −10..+10 · assets 0..+12
 *  · money worries (debt/negative cash) up to −15 · off-season +5.
 */
export function happinessTarget(life: Life, hero: Pick<Hero, 'morale' | 'injury'>, ctx: WellbeingContext = {}): number {
  let t = 55
  t += closeCircleMood(life)
  t += (hero.morale - 50) * 0.2
  t += clamp(ctx.assetHappiness ?? 0, 0, 12)
  if (life.money < 0) t -= 10
  if (life.bank.loan && life.bank.loan.remaining > 0 && (ctx.weeklyNet ?? 0) < 0) t -= 5
  if (hero.injury) t -= 6 + hero.injury.severity * 2
  if (ctx.offSeason) t += 5
  return clamp(t, 20, 95)
}

/**
 * Stress target 5..90. Baseline 20; injuries, debt, gambling addiction,
 * low manager trust, unhappiness and heavy match load raise it.
 */
export function stressTarget(life: Life, hero: Pick<Hero, 'managerTrust' | 'injury'>, ctx: WellbeingContext = {}): number {
  let t = 20
  if (hero.injury) t += 8 * hero.injury.severity
  if (life.money < 0) t += 15
  if (life.bank.loan && life.bank.loan.remaining > 0) t += 5
  t += life.casino.addiction * 0.25 // 100 addiction → +25
  if (hero.managerTrust < 30) t += (30 - hero.managerTrust) * 0.4
  if (life.happiness < 40) t += (40 - life.happiness) * 0.4
  t += Math.max(0, (ctx.matchesPlayed ?? 0) - 1) * 6 // two-match weeks are draining
  if (ctx.offSeason) t -= 10
  return clamp(t, 5, 90)
}

/** Fraction of the gap to target closed each week. */
const HAPPINESS_PULL = 0.3
const STRESS_PULL = 0.35

/**
 * Weekly wellbeing tick. Order: pull meters toward targets → health → burnout
 * bookkeeping. Returns warnings/feedback.
 */
export function weeklyWellbeing(life: Life, hero: Hero, ctx: WellbeingContext = {}): Lines {
  const lines: Lines = []
  const hT = happinessTarget(life, hero, ctx)
  life.happiness = meter(life.happiness + (hT - life.happiness) * HAPPINESS_PULL)
  const sT = stressTarget(life, hero, ctx)
  // Pulling *up* goes through addStress so stress-resist perks soften it.
  const gap = (sT - life.stress) * STRESS_PULL
  if (gap > 0) addStress(life, hero, gap)
  else life.stress = meter(life.stress + gap)

  // Health: recovers 4/week toward 95 when uninjured; chronic stress erodes it.
  if (!hero.injury) life.health = meter(life.health + Math.min(4, 95 - life.health))
  if (life.stress > 70) addHealth(life, -(life.stress - 70) * 0.1)

  // Burnout state machine.
  const streak = typeof life.flags.burnout_weeks === 'number' ? life.flags.burnout_weeks : 0
  if (!isBurnedOut(life)) {
    const next = life.stress >= BURNOUT_STRESS ? streak + 1 : 0
    life.flags.burnout_weeks = next
    if (next >= BURNOUT_WEEKS) {
      life.flags.burnout = true
      hero.morale = meter(hero.morale - 15)
      lines.push(lt('🔥 Tükenmişlik! Enerjin ve antrenman verimin düştü. Dinlenmen gerekiyor.', '🔥 Burnout! Your energy and training gains have dropped. You need rest.'))
    } else if (next === BURNOUT_WEEKS - 1) {
      lines.push(lt('Stresin tehlikeli seviyede. Biraz nefes almazsan tükeneceksin.', 'Your stress is dangerously high. Take a breather or you will burn out.'))
    }
  } else if (life.stress < BURNOUT_RECOVERY_STRESS) {
    life.flags.burnout = false
    life.flags.burnout_weeks = 0
    lines.push(lt('Tükenmişliği atlattın, kendini yeniden iyi hissediyorsun.', 'You have recovered from burnout and feel like yourself again.'))
  }
  if (life.happiness < 25) lines.push(fill(lt('Mutsuzsun ({v}). Bu maçlara yansıyabilir.', 'You are unhappy ({v}). It may show on the pitch.'), { v: Math.round(life.happiness) }))
  return lines
}

/**
 * Composure multiplier for the match engine / highlight scenes, 0.75..1.12.
 * Happy and calm → steadier aim (+), stressed or burned out → shaky aim (−).
 * Range is intentionally narrow: life should *colour* matches, never decide them.
 *   happiness 100 → +0.10 · stress 100 → −0.20 · burnout −0.08
 */
export function mentalMatchModifier(life: Life): number {
  let m = 1
  m += (life.happiness - 60) / 400
  m -= Math.max(0, life.stress - 50) / 250
  if (isBurnedOut(life)) m -= 0.08
  return clamp(m, 0.75, 1.12)
}

/**
 * Injury-risk multiplier 0.5..3 used by training and the match engine.
 * Fatigue is the dominant factor (1 + fatigue/100 × 1.5 → ×2.5 when exhausted),
 * low health and high stress add on top, `injury_resist` perks reduce it.
 */
export function injuryProneness(life: Life, hero: Pick<Hero, 'fatigue' | 'perks'>): number {
  let m = 1 + (clamp(hero.fatigue, 0, 100) / 100) * 1.5
  m += (100 - life.health) / 200 // health 40 → +0.3
  if (life.stress > 70) m += (life.stress - 70) / 100
  if (isBurnedOut(life)) m += 0.2
  m *= 1 - clamp(perkValue(hero, 'injury_resist'), 0, 0.6)
  return clamp(m, 0.5, 3)
}

/**
 * Daily energy cap: 100, minus 20 while burned out, minus 15 when health < 50.
 * The activity system restores energy up to this cap each morning.
 */
export function energyCap(life: Life): number {
  let cap = 100
  if (isBurnedOut(life)) cap -= 20
  if (life.health < 50) cap -= 15
  return cap
}

/** Training XP multiplier from wellbeing: burnout −30%, very unhappy −10%. */
export function wellbeingXpMultiplier(life: Life): number {
  let m = 1
  if (isBurnedOut(life)) m *= 0.7
  if (life.happiness < 25) m *= 0.9
  return m
}
