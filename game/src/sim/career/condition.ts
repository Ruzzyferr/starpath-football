/**
 * Physical condition helpers: fatigue, sharpness and injuries. Shared by
 * training, match outcome and daily activities so the rules stay identical
 * everywhere.
 */
import type { Hero, Injury, LText, Life } from '../../core/types'
import type { Rng } from '../../core/rng'
import { clamp, fill, lt, meter, type Lines } from './common'
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

/**
 * Combined recovery multiplier from perks (`recovery`) and facilities
 * (cryo chamber, home gym…). 1.0 = baseline, capped at 1.6.
 */
export function recoveryMultiplier(hero: Hero, life: Life): number {
  return 1 + Math.min(0.6, perkValue(hero, 'recovery') + assetEffectTotal(life, 'recovery'))
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
  weeks: [number, number]
}

/** Injury catalogue: severity 1 = knocks (1–2 w), 2 = muscle (3–6 w), 3 = serious (8–30 w). */
export const INJURY_TABLE: readonly InjuryTemplate[] = [
  { name: lt('Ayak bileği burkulması', 'Twisted ankle'), severity: 1, weeks: [1, 2] },
  { name: lt('Darbe (diz)', 'Knee knock'), severity: 1, weeks: [1, 1] },
  { name: lt('Kas yorgunluğu', 'Muscle fatigue'), severity: 1, weeks: [1, 2] },
  { name: lt('Kasık gerilmesi', 'Groin strain'), severity: 1, weeks: [1, 3] },
  { name: lt('Arka adale zorlanması', 'Hamstring strain'), severity: 2, weeks: [3, 6] },
  { name: lt('Baldır yırtığı', 'Calf tear'), severity: 2, weeks: [3, 5] },
  { name: lt('Kaburga çatlağı', 'Cracked rib'), severity: 2, weeks: [3, 5] },
  { name: lt('Ayak bileği bağ hasarı', 'Ankle ligament damage'), severity: 2, weeks: [4, 7] },
  { name: lt('Menisküs yırtığı', 'Torn meniscus'), severity: 3, weeks: [8, 14] },
  { name: lt('Kırık ayak (metatars)', 'Broken metatarsal'), severity: 3, weeks: [8, 12] },
  { name: lt('Çapraz bağ kopması', 'Cruciate ligament rupture'), severity: 3, weeks: [24, 32] },
]

/**
 * Roll an injury. `severityWeights` default [0.7, 0.25, 0.05] (most knocks are
 * minor); matches pass heavier weights than training.
 * Duration is reduced by recovery perks/facilities (up to −35%).
 */
export function rollInjury(rng: Rng, hero: Hero, life: Life, severityWeights: [number, number, number] = [0.7, 0.25, 0.05]): Injury {
  const sev = rng.weighted([1, 2, 3] as const, (s) => severityWeights[s - 1])
  const t = rng.pick(INJURY_TABLE.filter((i) => i.severity === sev))
  const base = rng.int(t.weeks[0], t.weeks[1])
  const reduce = clamp((recoveryMultiplier(hero, life) - 1) * 0.6, 0, 0.35)
  return { name: t.name, severity: t.severity, weeksLeft: Math.max(1, Math.round(base * (1 - reduce))) }
}

/** Put an injury on the hero (keeps the worse one if already injured). */
export function applyInjury(hero: Hero, life: Life, injury: Injury): Lines {
  if (hero.injury && hero.injury.weeksLeft >= injury.weeksLeft) return []
  hero.injury = injury
  hero.morale = meter(hero.morale - 4 * injury.severity)
  life.health = meter(life.health - 8 * injury.severity)
  return [fill(lt('🚑 Sakatlandın: {n} ({w} hafta)', '🚑 Injured: {n} ({w} weeks)'), { n: injury.name, w: injury.weeksLeft })]
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
