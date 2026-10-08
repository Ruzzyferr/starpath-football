/**
 * Ability anchor (2.6#71): keeps the world's ability distribution where it started.
 *
 * Without it the sum of development, selection (clubs cut their weakest) and youth intake
 * lifts the whole world about +0.1 OVR per season, and, worse, stretches it: in a 100-season
 * run the mean stayed put (the old mean-only anchor) while p95 went 82 -> 90, p99 86 -> 95 and
 * the top-20 average 89 -> 95 within ten seasons (playtest Tur 2 "world top tail inflation").
 *
 * Two rubber bands, applied at season end:
 *  1. Shape: the first measurement records the OVR quantiles of club players
 *     (`world.abilityShape`). Each later season every club player is ranked; one whose OVR sits
 *     more than {@link SHAPE_BAND} away from the recorded quantile at their rank is nudged
 *     towards it (1-3 points, always when far off), ceiling (potential) included, so a wonderkid cannot
 *     simply regrow past it. Ranks, and so every individual story, are untouched: a player
 *     still rises by overtaking others, the world just does not get taller.
 *  2. Mean: the old gentle mean band ({@link ANCHOR_BAND}) for prime/veteran players, which
 *     now rarely fires.
 * Deterministic: draws come from the season rng.
 */
import type { NpcPlayer, World } from '../../core/types'
import type { Rng } from '../../core/rng'
import { playerValue } from './players'

export const ANCHOR_BAND = 0.25
export const ANCHOR_MIN_AGE = 22
/** Quantile grid of the recorded shape (0, 0.5%, ..., 100%): fine enough to hold the top 1%. */
export const SHAPE_POINTS = 201
/** Dead band around the rank target (OVR points). */
export const SHAPE_BAND = 1
/** Chance per season that an out-of-band player is nudged (keeps the pull gradual and noisy). */
export const SHAPE_RATE = 0.6

const clubbed = (world: World) => Object.values(world.players).filter((p) => p.clubId)
export const meanAbility = (world: World): number => {
  const ps = clubbed(world)
  return ps.length ? ps.reduce((s, p) => s + p.ovr, 0) / ps.length : 0
}

/** Linear-interpolated value of a sorted sample at quantile u in [0,1]. */
const quantileOf = (sorted: readonly number[], u: number): number => {
  if (!sorted.length) return 0
  const x = Math.min(1, Math.max(0, u)) * (sorted.length - 1)
  const i = Math.floor(x)
  const f = x - i
  return i + 1 < sorted.length ? sorted[i]! * (1 - f) + sorted[i + 1]! * f : sorted[i]!
}

/** OVR quantiles of club players on the {@link SHAPE_POINTS} grid. */
export function abilityShape(world: World): number[] {
  const ovr = clubbed(world).map((p) => p.ovr).sort((a, b) => a - b)
  return Array.from({ length: SHAPE_POINTS }, (_, i) => Math.round(quantileOf(ovr, i / (SHAPE_POINTS - 1)) * 100) / 100)
}

/** Records the reference mean and shape if missing (new worlds and older saves). */
export function recordAbilityReference(world: World): void {
  if (world.abilityAnchor === undefined) world.abilityAnchor = meanAbility(world)
  if (!world.abilityShape || world.abilityShape.length !== SHAPE_POINTS) world.abilityShape = abilityShape(world)
}

function nudge(p: NpcPlayer, dir: number, steps: number, season: number): boolean {
  const next = Math.min(95, Math.max(25, p.ovr + dir * steps))
  if (next === p.ovr) return false
  p.ovr = next
  // Move the ceiling too, or the player simply regrows.
  p.potential = Math.max(next, Math.min(96, p.potential + dir * steps))
  p.value = playerValue(p.ovr, season - p.birthYear, p.potential)
  return true
}

/** Pulls every club player towards the recorded quantile at their rank. Returns how many moved. */
export function anchorShape(world: World, rng: Rng, season: number): number {
  const shape = world.abilityShape
  if (!shape || shape.length < 2) return 0
  const ps = clubbed(world).sort((a, b) => a.ovr - b.ovr || (a.id < b.id ? -1 : 1))
  const n = ps.length
  if (n < 2) return 0
  let moved = 0
  for (let i = 0; i < n; ) {
    // Tied OVRs share the midpoint rank.
    let j = i
    while (j + 1 < n && ps[j + 1]!.ovr === ps[i]!.ovr) j++
    const target = quantileOf(shape, (i + j) / 2 / (n - 1))
    const diff = ps[i]!.ovr - target
    if (Math.abs(diff) > SHAPE_BAND) {
      const dir = diff > 0 ? -1 : 1
      // Far off the band (the stretched tail): always pulled, by up to 3.
      const steps = Math.min(3, Math.max(1, Math.round(Math.abs(diff) - SHAPE_BAND)))
      const rate = Math.abs(diff) >= SHAPE_BAND + 1 ? 1 : SHAPE_RATE
      for (let k = i; k <= j; k++) if (rng.chance(rate) && nudge(ps[k]!, dir, steps, season)) moved++
    }
    i = j + 1
  }
  return moved
}

/** Returns the mean correction applied (mean units); 0 when inside the band or on the first measurement. */
export function anchorAbility(world: World, rng: Rng, season: number): number {
  if (world.abilityAnchor === undefined || !world.abilityShape) {
    recordAbilityReference(world)
    return 0
  }
  anchorShape(world, rng, season)
  const excess = meanAbility(world) - world.abilityAnchor
  if (Math.abs(excess) <= ANCHOR_BAND) return 0
  const share = Math.min(0.6, Math.abs(excess))
  const dir = excess > 0 ? -1 : 1
  let changed = 0
  for (const p of clubbed(world)) {
    if (season - p.birthYear < ANCHOR_MIN_AGE) continue
    if (!rng.chance(share)) continue
    if (nudge(p, dir, 1, season)) changed++
  }
  return changed ? dir * share : 0
}
