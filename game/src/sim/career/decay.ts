/**
 * Skill decay with inactivity / long injuries (GDD 2.3#14, WP-8).
 *
 * A week counts as INACTIVE when the hero is out with a muscle/serious injury
 * (severity ≥ 2) or has let match fitness slide below {@link INACTIVE_SHARPNESS}
 * (no minutes and no real training). Any active week resets the counter.
 *
 *  - After {@link DECAY_GRACE_WEEKS} − 1 inactive weeks a warning is logged:
 *    decay starts in 7 days unless the hero trains or plays.
 *  - From {@link DECAY_GRACE_WEEKS} inactive weeks on, one point is lost each
 *    week (each second week while injured: rehab keeps some fitness) from the
 *    highest physical attribute, rotating through pace/stamina/agility/strength
 *    and touching `firstTouch` every third decay week.
 *
 * Called weekly from career/condition `weeklyInjuryTick` (the weekly tick of
 * the condition layer), so no calendar code changes are needed.
 */
import type { AttributeKey, Hero } from '../../core/types'
import { lt, type Lines } from './common'

export const INACTIVE_SHARPNESS = 25
export const DECAY_GRACE_WEEKS = 3
const ROTATION: readonly AttributeKey[] = ['pace', 'stamina', 'agility', 'strength']

export function isInactiveWeek(hero: Hero): boolean {
  if (hero.retired) return false
  if (hero.injury && hero.injury.severity >= 2) return true
  return hero.sharpness < INACTIVE_SHARPNESS
}

/** Weeks until decay starts (0 = decaying now, null = active). */
export function weeksUntilDecay(hero: Hero): number | null {
  const n = hero.inactiveWeeks ?? 0
  if (n <= 0) return null
  return Math.max(0, DECAY_GRACE_WEEKS - n)
}

/** Weekly decay step. Mutates hero attributes and `inactiveWeeks`; returns log lines. */
export function weeklySkillDecay(hero: Hero): Lines {
  if (!isInactiveWeek(hero)) {
    if (hero.inactiveWeeks) hero.inactiveWeeks = 0
    return []
  }
  const n = (hero.inactiveWeeks ?? 0) + 1
  hero.inactiveWeeks = n
  if (n === DECAY_GRACE_WEEKS - 1) {
    return [lt('⚠️ Uzun süredir aktif değilsin: 7 gün içinde antrenman yapmaz ya da oynamazsan özelliklerin erimeye başlayacak.', '⚠️ You have been inactive for a while: train or play within 7 days or your attributes will start to decay.')]
  }
  if (n < DECAY_GRACE_WEEKS) return []
  const step = n - DECAY_GRACE_WEEKS
  if (hero.injury && step % 2 === 1) return []
  const key: AttributeKey = step % 3 === 2 ? 'firstTouch' : pickPhysical(hero, step)
  if (hero.attrs[key] <= 30) return []
  hero.attrs[key] -= 1
  return [{ tr: `📉 Hareketsizlik: ${trName(key)} −1`, en: `📉 Inactivity: ${enName(key)} −1` }]
}

function pickPhysical(hero: Hero, step: number): AttributeKey {
  // Highest physical attribute first (that is what fades fastest), ties broken by rotation.
  const sorted = ROTATION.map((k, i) => ({ k, v: hero.attrs[k] - ((i + step) % ROTATION.length) * 0.01 })).sort((a, b) => b.v - a.v)
  return sorted[0]!.k
}

const TR: Partial<Record<AttributeKey, string>> = { pace: 'Hız', stamina: 'Dayanıklılık', agility: 'Çeviklik', strength: 'Güç', firstTouch: 'İlk dokunuş' }
const EN: Partial<Record<AttributeKey, string>> = { pace: 'Pace', stamina: 'Stamina', agility: 'Agility', strength: 'Strength', firstTouch: 'First touch' }
const trName = (k: AttributeKey) => TR[k] ?? k
const enName = (k: AttributeKey) => EN[k] ?? k
