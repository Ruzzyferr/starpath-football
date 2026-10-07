/**
 * Formation slot layouts, positional familiarity and best-XI selection.
 * Pure functions over player lists (no World access) so the match layer and
 * tests can use them directly.
 */
import type { Formation, NpcPlayer, Position } from '../../core/types'

export const FORMATIONS: readonly Formation[] = ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '5-3-2', '4-1-4-1', '3-4-3']

/**
 * The 11 positional slots of each formation, GK first, then defence → attack,
 * left → right inside each line. Wide midfielders use LW/RW.
 */
export const FORMATION_SLOTS: Readonly<Record<Formation, readonly Position[]>> = {
  '4-4-2': ['GK', 'LB', 'CB', 'CB', 'RB', 'LW', 'CM', 'CM', 'RW', 'ST', 'ST'],
  '4-3-3': ['GK', 'LB', 'CB', 'CB', 'RB', 'CM', 'DM', 'CM', 'LW', 'ST', 'RW'],
  '4-2-3-1': ['GK', 'LB', 'CB', 'CB', 'RB', 'DM', 'DM', 'LW', 'AM', 'RW', 'ST'],
  '3-5-2': ['GK', 'CB', 'CB', 'CB', 'LB', 'CM', 'DM', 'CM', 'RB', 'ST', 'ST'],
  '5-3-2': ['GK', 'LB', 'CB', 'CB', 'CB', 'RB', 'CM', 'DM', 'CM', 'ST', 'ST'],
  '4-1-4-1': ['GK', 'LB', 'CB', 'CB', 'RB', 'DM', 'LW', 'CM', 'CM', 'RW', 'ST'],
  '3-4-3': ['GK', 'CB', 'CB', 'CB', 'LB', 'CM', 'CM', 'RB', 'LW', 'ST', 'RW'],
}

/** Number of slots for `pos` in a formation. */
export function slotCount(formation: Formation, pos: Position): number {
  let n = 0
  for (const s of FORMATION_SLOTS[formation]) if (s === pos) n++
  return n
}

const PAIR_FAMILIARITY: Readonly<Record<string, number>> = {
  'CB|DM': 0.86, 'CB|LB': 0.82, 'CB|RB': 0.82, 'LB|RB': 0.9, 'LB|LW': 0.8, 'RB|RW': 0.8, 'DM|LB': 0.75, 'DM|RB': 0.75,
  'CM|DM': 0.94, 'AM|CM': 0.9, 'AM|DM': 0.8, 'AM|LW': 0.86, 'AM|RW': 0.86, 'LW|RW': 0.92, 'AM|ST': 0.85,
  'LW|ST': 0.84, 'RW|ST': 0.84, 'CM|LW': 0.8, 'CM|RW': 0.8, 'CM|LB': 0.72, 'CM|RB': 0.72,
}

/**
 * How well a player whose natural position is `natural` performs in `slot`,
 * as a multiplier in (0, 1]. GK ↔ outfield is heavily penalised.
 */
export function positionFamiliarity(natural: Position, slot: Position): number {
  if (natural === slot) return 1
  if (natural === 'GK' || slot === 'GK') return 0.2
  const key = natural < slot ? `${natural}|${slot}` : `${slot}|${natural}`
  return PAIR_FAMILIARITY[key] ?? 0.62
}

/** A chosen team sheet. `playerIds[i]` plays `slots[i]`; index 0 is the goalkeeper slot. */
export interface Lineup {
  playerIds: string[]
  slots: Position[]
  /** Effective rating per starter (ovr × familiarity), aligned with playerIds. */
  ratings: number[]
  bench: string[]
}

export const BENCH_SIZE = 7

/**
 * Pick the best XI for a formation: a global greedy matching on effective
 * rating (ovr × familiarity), refined by a small local search (swaps and
 * bench substitutions). Injured players are only used when fewer than 11 fit
 * players exist. Deterministic for a given input order.
 */
export function selectLineupFromPlayers(
  players: readonly NpcPlayer[],
  formation: Formation,
  excludeIds?: ReadonlySet<string>,
): Lineup {
  const slots = FORMATION_SLOTS[formation]
  // Suspended players never play (WP-14); injured ones only when fewer than 11 are fit.
  const eligible = players.filter((p) => !excludeIds?.has(p.id) && !((p.suspendedMatches ?? 0) > 0))
  let pool = eligible.filter((p) => p.injuredWeeks <= 0)
  if (pool.length < slots.length) pool = eligible
  if (pool.length < slots.length) pool = players.filter((p) => !excludeIds?.has(p.id))

  const pairs: { slot: number; player: number; value: number }[] = []
  for (let s = 0; s < slots.length; s++) {
    for (let i = 0; i < pool.length; i++) {
      const natural = pool[i].position === slots[s]
      // Tiny natural-position bonus breaks ties in favour of specialists.
      pairs.push({ slot: s, player: i, value: pool[i].ovr * positionFamiliarity(pool[i].position, slots[s]) + (natural ? 0.01 : 0) })
    }
  }
  pairs.sort((a, b) => b.value - a.value || a.slot - b.slot || a.player - b.player)

  const slotTaken = new Array<number>(slots.length).fill(-1)
  const used = new Set<number>()
  let filled = 0
  for (const pr of pairs) {
    if (filled === slots.length) break
    if (slotTaken[pr.slot] >= 0 || used.has(pr.player)) continue
    slotTaken[pr.slot] = pr.player
    used.add(pr.player)
    filled++
  }

  refineAssignment(pool, slots, slotTaken, used)

  const playerIds: string[] = []
  const lineupSlots: Position[] = []
  const ratings: number[] = []
  slots.forEach((slot, s) => {
    const idx = slotTaken[s]
    if (idx < 0) return
    const p = pool[idx]
    playerIds.push(p.id)
    lineupSlots.push(slot)
    ratings.push(p.ovr * positionFamiliarity(p.position, slot))
  })

  return { playerIds, slots: lineupSlots, ratings, bench: pickBench(pool, used) }
}

const MAX_REFINE_PASSES = 6
const EPS = 1e-9

/**
 * Local search on top of the greedy matching. Moves (first improvement wins,
 * then the pass restarts):
 *  1. swap the players of two slots;
 *  2. replace a starter with the best unused player for that slot;
 *  3. move the starter of slot i to slot j, bench j's player and fill slot i
 *     with the best unused player for i.
 * Uses a precomputed value matrix, so each pass is O(slots² + pool × slots).
 * Mutates `slotTaken` / `used`.
 */
function refineAssignment(pool: readonly NpcPlayer[], slots: readonly Position[], slotTaken: number[], used: Set<number>): void {
  const S = slots.length
  const val = new Float64Array(pool.length * S)
  for (let k = 0; k < pool.length; k++) {
    for (let s = 0; s < S; s++) val[k * S + s] = pool[k].ovr * positionFamiliarity(pool[k].position, slots[s])
  }
  const v = (player: number, slot: number) => (player < 0 ? 0 : val[player * S + slot])
  const bestUnused = new Array<number>(S)

  for (let pass = 0; pass < MAX_REFINE_PASSES; pass++) {
    bestUnused.fill(-1)
    for (let k = 0; k < pool.length; k++) {
      if (used.has(k)) continue
      for (let s = 0; s < S; s++) if (bestUnused[s] < 0 || val[k * S + s] > val[bestUnused[s] * S + s]) bestUnused[s] = k
    }
    if (!improveOnce(S, slotTaken, used, bestUnused, v)) return
  }
}

function improveOnce(
  S: number, slotTaken: number[], used: Set<number>, bestUnused: readonly number[], v: (player: number, slot: number) => number,
): boolean {
  for (let i = 0; i < S; i++) {
    for (let j = i + 1; j < S; j++) {
      const pi = slotTaken[i], pj = slotTaken[j]
      if (v(pj, i) + v(pi, j) > v(pi, i) + v(pj, j) + EPS) {
        slotTaken[i] = pj
        slotTaken[j] = pi
        return true
      }
    }
  }
  for (let i = 0; i < S; i++) {
    const u = bestUnused[i]
    if (u < 0) continue
    const pi = slotTaken[i]
    if (v(u, i) > v(pi, i) + EPS) {
      slotTaken[i] = u
      used.add(u)
      if (pi >= 0) used.delete(pi)
      return true
    }
    for (let j = 0; j < S; j++) {
      const pj = slotTaken[j]
      if (j === i || pi < 0) continue
      if (v(pi, j) + v(u, i) > v(pi, i) + v(pj, j) + EPS) {
        slotTaken[j] = pi
        slotTaken[i] = u
        used.add(u)
        if (pj >= 0) used.delete(pj)
        return true
      }
    }
  }
  return false
}

/** Best remaining players, guaranteeing a reserve goalkeeper when available. */
function pickBench(pool: readonly NpcPlayer[], used: ReadonlySet<number>): string[] {
  const rest = pool.map((p, i) => ({ p, i })).filter((x) => !used.has(x.i))
  rest.sort((a, b) => b.p.ovr - a.p.ovr || a.i - b.i)
  const bench: string[] = []
  const gk = rest.find((x) => x.p.position === 'GK')
  if (gk) bench.push(gk.p.id)
  for (const x of rest) {
    if (bench.length >= BENCH_SIZE) break
    if (x !== gk) bench.push(x.p.id)
  }
  return bench
}
