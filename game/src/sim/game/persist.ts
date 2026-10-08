/**
 * Save-size codec. NPC players are ~85% of the state; each is stored as a
 * positional array (attribute-free, stats omitted when all zero) instead of a
 * keyed object, which cuts the save roughly in half without touching any
 * core type. `saveGame` / `loadGame` wrap SaveManager so the UI never sees
 * the packed form; `unpackState` passes unpacked (legacy) states through.
 */
import { applyDataUpdates } from '../world/dataUpdate'
import type { Appearance, Fixture, GameState, NpcPlayer, SeasonStats } from '../../core/types'
import type { LoadResult, SaveManager } from '../../state/save'
import { DATA_VERSION } from '../../data/world/version'
import { drainGoalReplays } from './saveHistory'
import { saveSummary } from './summary'

/** Versioned data pack id recorded in every save (2.9#36). */
export const dataPackId = (): string => `sp-data-${DATA_VERSION}`

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

// ── Fixtures: positional tuples, ids derived from (competition, round, index) ──
type Scorer = { minute: number; playerId: string; team: 'home' | 'away'; ownGoal?: boolean; penalty?: boolean }
type PackedScorer = [number, string, 0 | 1, number]
const SCORER_KEYS = new Set(['minute', 'playerId', 'team', 'ownGoal', 'penalty'])
const FIXTURE_KEYS = new Set(['id', 'compId', 'round', 'week', 'day', 'homeId', 'awayId', 'result'])
/** Marker on a competition's `fixtures` when they are stored as tuples. */
const FX_KEY = '__fx1'

type AnyResult = Record<string, unknown> & { scorers?: Scorer[] }

function packResult(r: AnyResult | null): AnyResult | null {
  if (!r || !Array.isArray(r.scorers)) return r
  const ok = r.scorers.every((x) => x && typeof x === 'object' && Object.keys(x).every((k) => SCORER_KEYS.has(k)) && (x.team === 'home' || x.team === 'away'))
  if (!ok) return r
  const scorers = r.scorers.map((x): PackedScorer => [x.minute, x.playerId, x.team === 'home' ? 0 : 1, (x.ownGoal ? 1 : 0) | (x.penalty ? 2 : 0)])
  return { ...r, scorers: scorers as unknown as Scorer[] }
}

function unpackResult(r: AnyResult | null): AnyResult | null {
  if (!r || !Array.isArray(r.scorers) || !r.scorers.some((x) => Array.isArray(x))) return r
  const scorers = (r.scorers as unknown as PackedScorer[]).map((a): Scorer => ({
    minute: a[0], playerId: a[1], team: a[2] === 0 ? 'home' : 'away', ...(a[3] & 1 ? { ownGoal: true } : {}), ...(a[3] & 2 ? { penalty: true } : {}),
  }))
  return { ...r, scorers }
}

/** Tuples when every fixture follows the `<comp>-r<round>-m<index>` id scheme and has only known keys; otherwise null (stay verbose). */
function packFixtures(compId: string, fixtures: Fixture[]): unknown[] | null {
  const perRound: Record<number, number> = {}
  const rows: unknown[] = []
  for (const f of fixtures) {
    if (!f || Object.keys(f).some((k) => !FIXTURE_KEYS.has(k)) || f.compId !== compId) return null
    const idx = perRound[f.round] ?? 0
    perRound[f.round] = idx + 1
    if (f.id !== `${compId}-r${f.round}-m${idx}`) return null
    rows.push([f.round, f.week, f.day, f.homeId, f.awayId, packResult(f.result as AnyResult | null)])
  }
  return rows
}

function unpackFixtures(compId: string, rows: unknown[][]): Fixture[] {
  const perRound: Record<number, number> = {}
  return rows.map((a) => {
    const round = a[0] as number
    const idx = perRound[round] ?? 0
    perRound[round] = idx + 1
    return { id: `${compId}-r${round}-m${idx}`, compId, round, week: a[1] as number, day: a[2] as number, homeId: a[3] as string, awayId: a[4] as string, result: unpackResult(a[5] as AnyResult | null) as Fixture['result'] }
  })
}

/** Shallow copy of the state with players and fixtures packed (the live state is not modified). */
export function packState(state: GameState): GameState {
  const packed = Object.values(state.world.players).map(packPlayer)
  const players = { [PACK_KEY]: packed } as unknown as GameState['world']['players']
  const competitions: GameState['world']['competitions'] = {}
  for (const [id, c] of Object.entries(state.world.competitions ?? {})) {
    const rows = Array.isArray(c.fixtures) ? packFixtures(c.id, c.fixtures) : null
    competitions[id] = rows ? { ...c, fixtures: { [FX_KEY]: rows } as unknown as Fixture[] } : c
  }
  return { ...state, world: { ...state.world, players, competitions } }
}

/** True if a (loaded) state still has packed players. */
export const isPacked = (state: GameState): boolean => PACK_KEY in (state.world?.players ?? {})

/** Inverse of {@link packState}; returns unpacked states untouched. Mutates and returns `state`. */
export function unpackState(state: GameState): GameState {
  for (const c of Object.values(state.world?.competitions ?? {})) {
    const fx = c.fixtures as unknown as Record<string, unknown[][]> | undefined
    if (fx && !Array.isArray(fx) && Array.isArray(fx[FX_KEY])) c.fixtures = unpackFixtures(c.id, fx[FX_KEY])
  }
  if (!isPacked(state)) return state
  const rows = (state.world.players as unknown as Record<string, PackedPlayer[]>)[PACK_KEY]!
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
  state.dataPack = dataPackId()
  drainGoalReplays(state)
  await mgr.save(slot, packState(state), saveSummary(state))
}

/** Load through SaveManager and unpack. */
export async function loadGame(mgr: SaveManager, slot: number): Promise<LoadResult> {
  const r = await mgr.load(slot)
  if (r.ok) {
    unpackState(r.state)
    applyDataUpdates(r.state.world) // 2.6#128: newer data pack steps, once per career
  }
  return r
}
