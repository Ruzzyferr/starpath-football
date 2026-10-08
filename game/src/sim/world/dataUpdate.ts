/**
 * Data-pack updates for existing careers (2.6#127/#128). A world remembers the `DATA_VERSION`
 * it was last brought up to; on load every step newer than that runs once, in order. Steps are
 * additive and deterministic (no RNG), and never touch the hero or standings, so an update can
 * not change the outcome of a career in progress, only fill in newly introduced data.
 */
import type { World } from '../../core/types'
import { DATA_VERSION } from '../../data/world/version'
import { foundedYear } from './generate'

export interface DataUpdate {
  /** Data version this step brings the world to. */
  version: number
  note: string
  apply: (world: World) => number
}

export const DATA_UPDATES: readonly DataUpdate[] = [
  {
    version: 2,
    note: 'Club founding years, legends list',
    apply(world) {
      let n = 0
      for (const club of Object.values(world.clubs)) if (club.founded === undefined) { club.founded = foundedYear(club.id, club.reputation); n++ }
      world.legends ??= []
      return n
    },
  },
]

/** Bring `world` up to the current data version. Returns the versions applied (empty when already current). */
export function applyDataUpdates(world: World): number[] {
  const from = world.dataVersion ?? 1
  const applied: number[] = []
  for (const u of DATA_UPDATES) {
    if (u.version <= from || u.version > DATA_VERSION) continue
    u.apply(world)
    applied.push(u.version)
  }
  if (from < DATA_VERSION) world.dataVersion = DATA_VERSION
  return applied
}
