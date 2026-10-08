/**
 * Ability anchor (2.6#71): a gentle rubber band that keeps the world's mean player
 * ability where it started. Without it the sum of development, selection (clubs cut
 * their weakest) and youth intake lifts the whole world about +0.1 OVR per season, so a
 * 20-season career ends in a stronger world than it began in. The first call records the
 * mean; every later season-end call nudges a share of the prime/veteran players by +-1 so
 * the mean returns inside a dead band. Deterministic: draws come from the season rng.
 */
import type { World } from '../../core/types'
import type { Rng } from '../../core/rng'
import { playerValue } from './players'

export const ANCHOR_BAND = 0.25
export const ANCHOR_MIN_AGE = 22

const clubbed = (world: World) => Object.values(world.players).filter((p) => p.clubId)
export const meanAbility = (world: World): number => {
  const ps = clubbed(world)
  return ps.length ? ps.reduce((s, p) => s + p.ovr, 0) / ps.length : 0
}

/** Returns the correction applied (mean units); 0 when inside the band or on the first measurement. */
export function anchorAbility(world: World, rng: Rng, season: number): number {
  const mean = meanAbility(world)
  if (world.abilityAnchor === undefined) {
    world.abilityAnchor = mean
    return 0
  }
  const excess = mean - world.abilityAnchor
  if (Math.abs(excess) <= ANCHOR_BAND) return 0
  const share = Math.min(0.6, Math.abs(excess))
  const dir = excess > 0 ? -1 : 1
  let changed = 0
  for (const p of clubbed(world)) {
    if (season - p.birthYear < ANCHOR_MIN_AGE) continue
    if (!rng.chance(share)) continue
    const next = p.ovr + dir
    if (next < 25 || next > 95) continue
    p.ovr = next
    p.potential = Math.max(next, Math.min(96, p.potential + dir)) // move the ceiling too, or the player simply regrows
    p.value = playerValue(p.ovr, season - p.birthYear, p.potential)
    changed++
  }
  return changed ? dir * share : 0
}
