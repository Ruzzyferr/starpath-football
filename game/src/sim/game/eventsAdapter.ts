/**
 * Thin adapter over the life-event engine (sim/life/events). The rest of the
 * game layer talks to events only through this file, so a change in the
 * engine's API is a one-file swap.
 */
import type { GameState, Lang, PendingEvent } from '../../core/types'
import type { Rng } from '../../core/rng'
import { describeEvent as engineDescribe, resolveEvent as engineResolve, rollEvents as engineRoll } from '../life/events/engine'
export { EventAlreadyResolvedError, findPending, isEventResolved, pendingKey } from '../life/events/engine'
import type { EventView } from '../life/events/engine'
import type { ResolvedEffect } from '../life/events/types'

export type { EventView, ResolvedEffect }

/**
 * Roll decision cards for the given situation tags; returns the newly added
 * pending events. `fireChance` overrides the first-card chance (1 = always try).
 */
export function rollEvents(state: GameState, rng: Rng, tags: string[], maxCount = 1, fireChance?: number): PendingEvent[] {
  return engineRoll(state, rng, tags, maxCount, fireChance === undefined ? {} : { fireChance })
}

/** Apply a choice of a pending card (throws on unknown/locked choice). */
export function resolveEvent(state: GameState, rng: Rng, pending: PendingEvent, choiceIndex: number): ResolvedEffect {
  return engineResolve(state, rng, pending, choiceIndex)
}

/** Localized card view (null if the definition no longer exists). */
export function describeEvent(state: GameState, pending: PendingEvent, lang: Lang): EventView | null {
  return engineDescribe(state, pending, lang)
}
