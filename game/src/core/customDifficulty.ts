/**
 * "Custom" difficulty (GAP 2.1#128, 2.3#117): bullet time, arc, magnet, AI
 * reaction and wind set one by one. Pure helpers shared by the sim (match
 * difficulty factor) and the live-moment bridge (runtime options).
 */
import type { CustomDifficulty } from './types'

export const AI_REACTION_MIN = 0.8
export const AI_REACTION_MAX = 1.3

/** Starting point of the custom sliders (= Normal). */
export const DEFAULT_CUSTOM: Readonly<CustomDifficulty> = { bulletTime: true, arc: true, magnet: true, aiReaction: 1, wind: true }

/** Clamps / fills a (possibly old or hand-edited) custom block. */
export function normalizeCustom(c: Partial<CustomDifficulty> | null | undefined): CustomDifficulty {
  const r = Number(c?.aiReaction)
  return {
    bulletTime: c?.bulletTime ?? DEFAULT_CUSTOM.bulletTime,
    arc: c?.arc ?? DEFAULT_CUSTOM.arc,
    magnet: c?.magnet ?? DEFAULT_CUSTOM.magnet,
    aiReaction: Number.isFinite(r) ? Math.min(AI_REACTION_MAX, Math.max(AI_REACTION_MIN, Math.round(r * 100) / 100)) : DEFAULT_CUSTOM.aiReaction,
    wind: c?.wind ?? DEFAULT_CUSTOM.wind,
  }
}

export type AimAssistLevel = 'full' | 'half' | 'manual'

export interface CustomMomentOverrides {
  aimAssist: AimAssistLevel
  slowMoAim: boolean
  /** Numeric opponent sharpness for the live moment. */
  difficulty: number
  weather: <W extends string>(w: W) => W | 'clear'
}

/** Arc + magnet = Full, arc only = Half, no arc = Manual (the magnet needs the arc). */
export function customAimAssist(c: CustomDifficulty): AimAssistLevel {
  return c.arc ? (c.magnet ? 'full' : 'half') : 'manual'
}

/** Live-moment options for a custom career: assist level, bullet time, AI and wind. */
export function customMomentOverrides(cIn: Partial<CustomDifficulty>): CustomMomentOverrides {
  const c = normalizeCustom(cIn)
  return {
    aimAssist: customAimAssist(c),
    slowMoAim: c.bulletTime,
    difficulty: c.aiReaction,
    weather: <W extends string>(w: W) => (!c.wind && w === 'wind' ? 'clear' : w),
  }
}
