/**
 * Formation position tables and player→slot assignment.
 *
 * Coordinates are pitch meters for a team attacking toward +x, with the
 * screen convention "y grows downward": facing +x, the LEFT flank is low y
 * (≈ 0) and the RIGHT flank is high y (≈ 68). Slots describe the team's
 * neutral shape (ball near the centre circle); highlight generation shifts and
 * compresses them for each situation.
 */
import type { Formation, Position } from '../../core/types'

/** One formation slot. */
export interface FormationSlot {
  role: Position
  x: number
  y: number
}

type SlotRow = readonly [Position, number, number]

const BACK4: readonly SlotRow[] = [
  ['LB', 24, 9],
  ['CB', 18, 26],
  ['CB', 18, 42],
  ['RB', 24, 59],
]
const BACK3: readonly SlotRow[] = [
  ['CB', 19, 18],
  ['CB', 17, 34],
  ['CB', 19, 50],
]
const BACK5: readonly SlotRow[] = [
  ['LB', 26, 6],
  ['CB', 18, 20],
  ['CB', 16, 34],
  ['CB', 18, 48],
  ['RB', 26, 62],
]

const TABLES: Record<Formation, readonly SlotRow[]> = {
  '4-4-2': [
    ...BACK4,
    ['LW', 40, 10],
    ['CM', 36, 27],
    ['CM', 36, 41],
    ['RW', 40, 58],
    ['ST', 52, 28],
    ['ST', 52, 40],
  ],
  '4-3-3': [
    ...BACK4,
    ['DM', 32, 34],
    ['CM', 38, 22],
    ['CM', 38, 46],
    ['LW', 52, 10],
    ['ST', 56, 34],
    ['RW', 52, 58],
  ],
  '4-2-3-1': [
    ...BACK4,
    ['DM', 31, 27],
    ['DM', 31, 41],
    ['LW', 46, 11],
    ['AM', 45, 34],
    ['RW', 46, 57],
    ['ST', 56, 34],
  ],
  '3-5-2': [
    ...BACK3,
    ['LW', 38, 6],
    ['DM', 31, 34],
    ['CM', 39, 23],
    ['CM', 39, 45],
    ['RW', 38, 62],
    ['ST', 53, 28],
    ['ST', 53, 40],
  ],
  '5-3-2': [
    ...BACK5,
    ['CM', 35, 20],
    ['DM', 32, 34],
    ['CM', 35, 48],
    ['ST', 51, 28],
    ['ST', 51, 40],
  ],
  '4-1-4-1': [
    ...BACK4,
    ['DM', 29, 34],
    ['LW', 43, 9],
    ['CM', 40, 25],
    ['CM', 40, 43],
    ['RW', 43, 59],
    ['ST', 55, 34],
  ],
  '3-4-3': [
    ...BACK3,
    ['LW', 38, 7],
    ['CM', 36, 26],
    ['CM', 36, 42],
    ['RW', 38, 61],
    ['LW', 54, 14],
    ['ST', 56, 34],
    ['RW', 54, 54],
  ],
}

/**
 * Returns the 11 slots (index 0 = GK) of a formation in pitch meters for a
 * team attacking toward +x.
 */
export function formationSlots(formation: Formation): FormationSlot[] {
  const rows = TABLES[formation] ?? TABLES['4-4-2']
  return [{ role: 'GK', x: 4, y: 34 }, ...rows.map(([role, x, y]) => ({ role, x, y }))]
}

/** Coarse positional groups used for fallback matching. */
const GROUP: Record<Position, number> = {
  GK: 0, CB: 1, LB: 1, RB: 1, DM: 2, CM: 2, AM: 2, LW: 3, RW: 3, ST: 3,
}

/** Lower = better fit of a player position into a slot role. */
function fitCost(player: Position, slot: Position): number {
  if (player === slot) return 0
  if (player === 'GK' || slot === 'GK') return 100
  const g = Math.abs(GROUP[player] - GROUP[slot])
  const sideBonus = (player === 'LB' && slot === 'LW') || (player === 'RB' && slot === 'RW') ? -1 : 0
  return 3 + g * 4 + sideBonus
}

/**
 * Assigns players to formation slots (greedy by best fit, exact matches first).
 * Returns slot index per player (same order as input). Extra players (fewer
 * slots than players) receive -1; missing players simply leave slots empty.
 */
export function assignSlots<T extends { position: Position }>(players: readonly T[], formation: Formation): number[] {
  const slots = formationSlots(formation)
  const taken = new Array<boolean>(slots.length).fill(false)
  const result = new Array<number>(players.length).fill(-1)
  const pairs: { p: number; s: number; c: number }[] = []
  players.forEach((pl, p) => slots.forEach((sl, s) => pairs.push({ p, s, c: fitCost(pl.position, sl.role) })))
  pairs.sort((a, b) => a.c - b.c || a.p - b.p || a.s - b.s)
  for (const { p, s } of pairs) {
    if (result[p] !== -1 || taken[s]) continue
    result[p] = s
    taken[s] = true
  }
  return result
}
