/**
 * Save-size codec. NPC players are ~85% of the state; each is stored as a
 * positional array (attribute-free, stats omitted when all zero) instead of a
 * keyed object, which cuts the save roughly in half without touching any
 * core type. `saveGame` / `loadGame` wrap SaveManager so the UI never sees
 * the packed form; `unpackState` passes unpacked (legacy) states through.
 */
import type { Appearance, GameState, NpcPlayer, SeasonStats } from '../../core/types'
import type { LoadResult, SaveManager } from '../../state/save'
import { saveSummary } from './summary'

/** Marker key placed in `world.players` of a packed state. */
export const PACK_KEY = '__packed_v1'

/** Numeric appearance fields; `gender` is not packed (it is the world's gender, restored on unpack). */
const APPEARANCE_KEYS: readonly Exclude<keyof Appearance, 'gender'>[] = ['skin', 'hairStyle', 'hairColor', 'beard', 'eyeColor', 'face', 'accessory']
const STAT_KEYS: readonly (keyof SeasonStats)[] = [
  'apps', 'starts', 'minutes', 'goals', 'assists', 'shots', 'shotsOnTarget', 'passes', 'passesCompleted',
  'tackles', 'dribbles', 'yellow', 'red', 'cleanSheets', 'saves', 'ratingSum', 'motm',
]

type PackedPlayer = [
  string, string, string, string, number, NpcPlayer['position'], NpcPlayer['foot'], number, number, number, string | null,
  number, number, number, number, number, NpcPlayer['personality'], number[], number, number[] | 0,
  /** suspendedMatches (WP-14), only when banned. */
  number?,
]

function packPlayer(p: NpcPlayer): PackedPlayer {
  const stats = STAT_KEYS.map((k) => p.stats[k])
  const out: PackedPlayer = [
    p.id, p.firstName, p.lastName, p.nationality, p.birthYear, p.position, p.foot, p.ovr, p.potential, p.styleSeed, p.clubId,
    p.value, p.wage, p.contractUntil, p.morale, p.form, p.personality, APPEARANCE_KEYS.map((k) => p.appearance[k]), p.injuredWeeks,
    stats.every((v) => v === 0) ? 0 : stats,
  ]
  if (p.suspendedMatches) out.push(p.suspendedMatches)
  return out
}

function unpackPlayer(a: PackedPlayer, female: boolean): NpcPlayer {
  const app = {} as Appearance
  APPEARANCE_KEYS.forEach((k, i) => { app[k] = a[17][i] ?? 0 })
  if (female) app.gender = 'female'
  const stats = {} as SeasonStats
  const sa = a[19]
  STAT_KEYS.forEach((k, i) => { stats[k] = sa === 0 ? 0 : sa[i] ?? 0 })
  return {
    id: a[0], firstName: a[1], lastName: a[2], nationality: a[3], birthYear: a[4], position: a[5], foot: a[6], ovr: a[7],
    potential: a[8], styleSeed: a[9], clubId: a[10], value: a[11], wage: a[12], contractUntil: a[13], morale: a[14], form: a[15],
    personality: a[16], appearance: app, injuredWeeks: a[18], stats,
    ...(a[20] ? { suspendedMatches: a[20] } : {}),
  }
}

/** Shallow copy of the state with players packed (the live state is not modified). */
export function packState(state: GameState): GameState {
  const packed = Object.values(state.world.players).map(packPlayer)
  const players = { [PACK_KEY]: packed } as unknown as GameState['world']['players']
  return { ...state, world: { ...state.world, players } }
}

/** True if a (loaded) state still has packed players. */
export const isPacked = (state: GameState): boolean => PACK_KEY in (state.world?.players ?? {})

/** Inverse of {@link packState}; returns unpacked states untouched. Mutates and returns `state`. */
export function unpackState(state: GameState): GameState {
  if (!isPacked(state)) return state
  const rows = (state.world.players as unknown as Record<string, PackedPlayer[]>)[PACK_KEY]
  const players: Record<string, NpcPlayer> = {}
  const female = state.world.gender === 'female'
  for (const r of rows) players[r[0]] = unpackPlayer(r, female)
  state.world.players = players
  return state
}

/** Serialized size (characters) of what {@link saveGame} writes for this state. */
export const packedSize = (state: GameState): number => JSON.stringify(packState(state)).length

/** Save through SaveManager with the compact codec. */
export async function saveGame(mgr: SaveManager, slot: number, state: GameState, now: number): Promise<void> {
  state.meta.updatedAt = now
  state.meta.slot = slot
  await mgr.save(slot, packState(state), saveSummary(state))
}

/** Load through SaveManager and unpack. */
export async function loadGame(mgr: SaveManager, slot: number): Promise<LoadResult> {
  const r = await mgr.load(slot)
  if (r.ok) unpackState(r.state)
  return r
}
