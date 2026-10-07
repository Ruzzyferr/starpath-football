/**
 * Progressive feature unlock — UI messaging layer.
 *
 * Careers created through the wizard record their start week
 * (`life.flags['ux:start']`). Side systems stay hidden for the first weeks
 * (ANALIZ 2.7#123) and the casino additionally needs the legal gambling age,
 * read from the backend's casino selector (`casinoStatus().ageLock`). Older
 * saves without the flag have everything unlocked.
 */
import { computed } from '@preact/signals'
import type { Calendar } from '../../core/types'
import { data, gameState } from '../store'

export type FeatureId = 'casino' | 'investments' | 'sponsors' | 'business'
export const FEATURES: readonly FeatureId[] = ['casino', 'investments', 'sponsors', 'business']

/** Career week (1-based, as shown in the UI) from which each feature opens. */
export const UNLOCK_WEEK: Record<FeatureId, number> = { casino: 4, investments: 4, sponsors: 3, business: 4 }

/** Weeks per season used only to measure elapsed career time (monotonic). */
const WEEKS_PER_SEASON = 44
export const START_FLAG = 'ux:start'
export const seenFlag = (id: FeatureId) => `ux:seen:${id}`
export const notifiedFlag = (id: FeatureId) => `ux:new:${id}`

type Flags = Record<string, number | string | boolean>

const absWeek = (c: Pick<Calendar, 'season' | 'week'>) => c.season * WEEKS_PER_SEASON + c.week

export function markCareerStart(flags: Flags, cal: Pick<Calendar, 'season' | 'week'>): void {
  if (flags[START_FLAG] === undefined) flags[START_FLAG] = absWeek(cal)
}

/** 1-based career week, or null for careers that predate progressive unlocks. */
export function careerWeek(flags: Flags, cal: Pick<Calendar, 'season' | 'week'>): number | null {
  const st = flags[START_FLAG]
  if (typeof st !== 'number') return null
  return absWeek(cal) - st + 1
}

export type LockReason =
  | { kind: 'week'; week: number; weeksLeft: number }
  | { kind: 'age'; age: number; yearsLeft: number }

export interface FeatureState {
  id: FeatureId
  unlocked: boolean
  reason: LockReason | null
  /** Unlocked, was gated in this career and not opened yet → "New!" badge. */
  isNew: boolean
}

export interface UnlockContext {
  careerWeek: number | null
  /** From the backend casino selector; null = old enough. */
  casinoAgeLock: { minAge: number; yearsLeft: number } | null
  seen: (id: FeatureId) => boolean
}

/** Pure: the state of one feature for a given context. */
export function featureState(id: FeatureId, ctx: UnlockContext): FeatureState {
  let reason: LockReason | null = null
  if (id === 'casino' && ctx.casinoAgeLock) {
    reason = { kind: 'age', age: ctx.casinoAgeLock.minAge, yearsLeft: Math.max(1, ctx.casinoAgeLock.yearsLeft) }
  } else if (ctx.careerWeek !== null && ctx.careerWeek < UNLOCK_WEEK[id]) {
    reason = { kind: 'week', week: UNLOCK_WEEK[id], weeksLeft: UNLOCK_WEEK[id] - ctx.careerWeek }
  }
  const unlocked = reason === null
  const gated = ctx.careerWeek !== null
  return { id, unlocked, reason, isNew: unlocked && gated && !ctx.seen(id) }
}

function safeAgeLock(): UnlockContext['casinoAgeLock'] {
  try {
    return data.casinoStatus().ageLock ?? null
  } catch {
    return null
  }
}

/** Reactive state of every feature for the loaded career. */
export const features = computed<Record<FeatureId, FeatureState>>(() => {
  const s = gameState.value
  const flags: Flags = s?.life.flags ?? {}
  const ctx: UnlockContext = {
    careerWeek: s ? careerWeek(flags, s.calendar) : null,
    casinoAgeLock: s ? safeAgeLock() : null,
    seen: (id) => flags[seenFlag(id)] === true,
  }
  const out = {} as Record<FeatureId, FeatureState>
  for (const id of FEATURES) out[id] = featureState(id, ctx)
  return out
})

export function markFeatureSeen(id: FeatureId): void {
  const s = gameState.value
  if (!s || s.life.flags[seenFlag(id)] === true) return
  s.life.flags[seenFlag(id)] = true
  gameState.value = { ...s }
}

/** Features that unlocked since the player was last told (marks them as told). */
export function takeFreshUnlocks(): FeatureId[] {
  const s = gameState.value
  if (!s || typeof s.life.flags[START_FLAG] !== 'number') return []
  const st = features.value
  const out: FeatureId[] = []
  for (const id of FEATURES) {
    if (st[id].isNew && s.life.flags[notifiedFlag(id)] !== true) {
      s.life.flags[notifiedFlag(id)] = true
      out.push(id)
    }
  }
  return out
}
