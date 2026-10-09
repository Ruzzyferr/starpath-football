/**
 * Physical condition helpers: fatigue, sharpness and injuries. Shared by
 * training, match outcome and daily activities so the rules stay identical
 * everywhere.
 */
import type { Hero, Injury, LText, Life } from '../../core/types'
import type { Rng } from '../../core/rng'
import { clamp, fill, fmtMoney, lt, meter, type Lines } from './common'
import { perkValue } from './perks'
import { assetEffectTotal } from '../life/assetEffects'
import { weeklySkillDecay } from './decay'

/** Add fatigue; positive deltas are reduced by `stamina_drain` perks (Marathon). */
export function addFatigue(hero: Hero, delta: number): number {
  const d = delta > 0 ? delta * (1 - clamp(perkValue(hero, 'stamina_drain'), 0, 0.6)) : delta
  const before = hero.fatigue
  hero.fatigue = meter(hero.fatigue + d, 30)
  return hero.fatigue - before
}

/** Days of proper nutrition left (Meal Prep activity): faster recovery and a slower physical decline. */
export const DIET_FLAG = 'diet_left'
export const dietActive = (life: Pick<Life, 'flags'>): boolean => {
  const v = life.flags[DIET_FLAG]
  return typeof v === 'number' && v > 0
}

/** A big engine recovers faster: Stamina 50 = ±0, 90 = +8 %, 10 = −8 %. */
export const staminaRecoveryBonus = (hero: Pick<Hero, 'attrs'>): number => clamp(((hero.attrs?.stamina ?? 50) - 50) / 500, -0.08, 0.08)

/**
 * Combined recovery multiplier from perks (`recovery`) and facilities
 * (cryo chamber, home gym…), capped at +0.6, plus the body itself: Stamina
 * (±0.08) and a week of proper nutrition (+0.1).
 */
export function recoveryMultiplier(hero: Hero, life: Life): number {
  return 1 + Math.min(0.6, perkValue(hero, 'recovery') + assetEffectTotal(life, 'recovery')) + staminaRecoveryBonus(hero) + (dietActive(life) ? 0.1 : 0)
}

/**
 * Body resilience on the training ground (career side; match injuries are the match engine's):
 * a small engine (Stamina < 55) tires into knocks, Balance and Strength keep you on your feet.
 * 1 = average; 0.75..1.35.
 */
export function bodyInjuryFactor(hero: Pick<Hero, 'attrs'>): number {
  const a = hero.attrs
  if (!a) return 1
  const f = 1 + (Math.max(0, 55 - a.stamina) / 100) * 0.8 - (Math.max(0, a.balance - 50) / 100) * 0.25 - (Math.max(0, a.strength - 50) / 100) * 0.15
  return clamp(f, 0.75, 1.35)
}

/**
 * How much of this week's physical decline diet and sleep hold back (0..0.25): a week of proper
 * nutrition 0.15, plus up to 0.1 from sleep quality (0.75 plain bed … 1 premium bed / smart home).
 */
export function bodyCare(life: Pick<Life, 'flags'>, sleepQuality = 0.75): number {
  return clamp((dietActive(life) ? 0.15 : 0) + ((sleepQuality - 0.75) / 0.25) * 0.1, 0, 0.25)
}

/** Recover fatigue by a base amount scaled by {@link recoveryMultiplier}. */
export function recoverFatigue(hero: Hero, life: Life, base: number): number {
  return -addFatigue(hero, -base * recoveryMultiplier(hero, life))
}

/**
 * Weekly sharpness (match fitness) drift: −6/week without minutes, so a
 * benched player loses sharpness and must earn it back on the pitch or in
 * hard training. Match/training gains are applied by those systems.
 */
export function weeklySharpnessDecay(hero: Hero, minutesThisWeek: number): void {
  if (minutesThisWeek <= 0) hero.sharpness = meter(hero.sharpness - 6)
}

// ───────────────────────── Injuries ─────────────────────────

interface InjuryTemplate {
  name: LText
  severity: 1 | 2 | 3
  /** Lay-off in days (data-driven, 2.3#55). */
  days: [number, number]
}

/**
 * Injury catalogue (2.3#55): minor 3–10 days, moderate 2–6 weeks, serious
 * 2–9 months. Lay-offs are kept in weeks with half-week steps.
 */
export const INJURY_TABLE: readonly InjuryTemplate[] = [
  { name: lt('Ayak bileği burkulması', 'Twisted ankle'), severity: 1, days: [4, 10] },
  { name: lt('Darbe (diz)', 'Knee knock'), severity: 1, days: [3, 7] },
  { name: lt('Kas yorgunluğu', 'Muscle fatigue'), severity: 1, days: [3, 8] },
  { name: lt('Kasık gerilmesi', 'Groin strain'), severity: 1, days: [5, 10] },
  { name: lt('Arka adale zorlanması', 'Hamstring strain'), severity: 2, days: [18, 42] },
  { name: lt('Baldır yırtığı', 'Calf tear'), severity: 2, days: [14, 35] },
  { name: lt('Kaburga çatlağı', 'Cracked rib'), severity: 2, days: [14, 35] },
  { name: lt('Ayak bileği bağ hasarı', 'Ankle ligament damage'), severity: 2, days: [21, 42] },
  { name: lt('Menisküs yırtığı', 'Torn meniscus'), severity: 3, days: [60, 100] },
  { name: lt('Kırık ayak (metatars)', 'Broken metatarsal'), severity: 3, days: [60, 90] },
  { name: lt('Çapraz bağ kopması', 'Cruciate ligament rupture'), severity: 3, days: [180, 270] },
]

/** Days → lay-off weeks in half-week steps (at least half a week). */
export const injuryWeeks = (days: number): number => Math.max(0.5, Math.round((days / 7) * 2) / 2)

/** Injury risk multiplier (2.3#55), shared with the match engine. */
export { injuryRiskMultiplier } from '../match/injuryRisk'

/**
 * Roll an injury. `severityWeights` default [0.6, 0.3, 0.1] (most knocks are
 * minor); matches pass heavier weights than training.
 * Duration is reduced by recovery perks/facilities (up to −35%).
 */
export function rollInjury(rng: Rng, hero: Hero, life: Life, severityWeights: [number, number, number] = [0.6, 0.3, 0.1]): Injury {
  const sev = rng.weighted([1, 2, 3] as const, (s) => severityWeights[s - 1]!)
  const t = rng.pick(INJURY_TABLE.filter((i) => i.severity === sev))
  const base = rng.int(t.days[0], t.days[1])
  const reduce = clamp((recoveryMultiplier(hero, life) - 1) * 0.6, 0, 0.35)
  return { name: t.name, severity: t.severity, weeksLeft: injuryWeeks(base * (1 - reduce)) }
}

/** Injury-insurance clause payout: wage × (severity + 1) weeks, 0 without the clause. */
export function injuryInsurancePayout(hero: Pick<Hero, 'contract'>, injury: Pick<Injury, 'severity'>): number {
  const c = hero.contract
  return c?.insurance ? Math.round(c.wage * (injury.severity + 1)) : 0
}

/** Put an injury on the hero (keeps the worse one if already injured). */
export function applyInjury(hero: Hero, life: Life, injury: Injury): Lines {
  if (hero.injury && hero.injury.weeksLeft >= injury.weeksLeft) return []
  hero.injury = injury
  hero.morale = meter(hero.morale - 4 * injury.severity)
  life.health = meter(life.health - 8 * injury.severity)
  const lines: Lines = [fill(lt('🚑 Sakatlandın: {n} ({w} hafta)', '🚑 Injured: {n} ({w} weeks)'), { n: injury.name, w: injury.weeksLeft })]
  const pay = injuryInsurancePayout(hero, injury)
  if (pay > 0) {
    life.money += pay
    lines.push(fill(lt('🛡️ Sözleşmendeki sigorta {m} ödedi.', '🛡️ Your contract insurance paid out {m}.'), { m: fmtMoney(pay) }))
  }
  return lines
}

/**
 * Weekly injury countdown. `physioSessions` (from the physio activity) each
 * shave ~1/3 week off: three physio visits ≈ one week saved.
 */
export function weeklyInjuryTick(hero: Hero, physioSessions = 0): Lines {
  // Also the weekly hook for inactivity skill decay (career/decay), checked before the countdown.
  const decay = weeklySkillDecay(hero)
  return [...decay, ...injuryCountdown(hero, physioSessions)]
}

function injuryCountdown(hero: Hero, physioSessions: number): Lines {
  if (!hero.injury) return []
  const progress = 1 + Math.min(1, physioSessions / 3)
  hero.injury.weeksLeft = Math.max(0, Math.round((hero.injury.weeksLeft - progress) * 10) / 10)
  if (hero.injury.weeksLeft <= 0) {
    const name = hero.injury.name
    hero.injury = null
    hero.sharpness = meter(hero.sharpness - 20) // rust after the lay-off
    return [fill(lt('✅ {n} tamamen iyileşti. Maç temposu için zamana ihtiyacın var.', '✅ Fully recovered from {n}. You need time to regain match sharpness.'), { n: name })]
  }
  return []
}
