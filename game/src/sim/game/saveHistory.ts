/**
 * Save-resident history (WP-V): weekly attribute history, bounded goal-replay storage and the
 * procedural slot thumbnail. Everything here is optional on `GameState` (old saves get defaults via
 * the v2 → v3 migration) and strictly size-bounded so a 5-season career stays well under the budget.
 */
import { ATTRIBUTE_KEYS, type AttributeKey, type GameState } from '../../core/types'
import type { InputFrame, InputRecording } from '../../game/inputReplay'
import type { SlotThumb } from '../../state/save'
import { heroClub } from './internal'

// ───────────── Attribute history (2.7#55) ─────────────

/** Rows are `[season, week, ...values in `keys` order]`. Weekly for the current season, one row per older season. */
export interface AttrHistory {
  v: 1
  keys: AttributeKey[]
  rows: number[][]
}

/** Seasons of history kept (older rows are dropped). */
export const ATTR_HISTORY_SEASONS = 20

export const emptyAttrHistory = (): AttrHistory => ({ v: 1, keys: [...ATTRIBUTE_KEYS], rows: [] })

/**
 * Samples the hero's attributes (called once per week). A new season compacts the previous season's
 * weekly rows down to its last row, so storage grows by one row per season plus one per week elapsed.
 */
export function sampleAttrHistory(state: GameState): void {
  const h = state.hero
  if (!h?.attrs) return
  const hist = (state.attrHistory ??= emptyAttrHistory())
  const { season, week } = state.calendar
  const row = [season, week, ...hist.keys.map((k) => Math.round(h.attrs[k] ?? 0))]
  const last = hist.rows[hist.rows.length - 1]
  if (last && last[0] === season && last[1] === week) hist.rows[hist.rows.length - 1] = row
  else {
    if (last && last[0] !== season) compactAttrHistory(hist, season)
    hist.rows.push(row)
  }
  const minSeason = season - ATTR_HISTORY_SEASONS + 1
  if (hist.rows[0] && hist.rows[0][0] < minSeason) hist.rows = hist.rows.filter((r) => r[0] >= minSeason)
}

/** Keeps only the last sample of every season except the newest. */
export function compactAttrHistory(hist: AttrHistory, newest: number): void {
  const out: number[][] = []
  for (const r of hist.rows) {
    const prev = out[out.length - 1]
    if (prev && prev[0] === r[0] && r[0] !== newest) out[out.length - 1] = r
    else out.push(r)
  }
  hist.rows = out
}

/** One attribute's series as `{season, week, value}` points (UI / tests). */
export function attrSeries(hist: AttrHistory | undefined, key: AttributeKey): { season: number; week: number; value: number }[] {
  if (!hist) return []
  const i = hist.keys.indexOf(key)
  if (i < 0) return []
  return hist.rows.map((r) => ({ season: r[0], week: r[1], value: r[2 + i] }))
}

// ───────────── Goal replays (2.2#48, 2.10#34) ─────────────

/** Goal replays kept per career (oldest dropped). */
export const MAX_GOAL_REPLAYS = 12

/** Lossless run-length form of an {@link InputRecording}: no positions, only seed + options + input. */
export interface PackedRecording {
  v: 1
  highlightId: string
  opts: InputRecording['opts']
  /** `[dt, repeat]` runs. */
  dt: [number, number][]
  /** Frames carrying input: `[frameIndex, frameWithoutDt]`. */
  ev: [number, Omit<InputFrame, 'dt'>][]
}

export interface GoalReplay {
  season: number
  week: number
  minute: number
  rec: PackedRecording
}

export function packRecording(r: InputRecording): PackedRecording {
  const dt: [number, number][] = []
  const ev: PackedRecording['ev'] = []
  r.frames.forEach((f, i) => {
    const run = dt[dt.length - 1]
    if (run && run[0] === f.dt) run[1]++
    else dt.push([f.dt, 1])
    const { dt: _dt, ...rest } = f
    void _dt
    if (Object.keys(rest).length) ev.push([i, rest])
  })
  return { v: 1, highlightId: r.highlightId, opts: { ...r.opts }, dt, ev }
}

export function unpackRecording(p: PackedRecording): InputRecording {
  const frames: InputFrame[] = []
  for (const [d, n] of p.dt) for (let i = 0; i < n; i++) frames.push({ dt: d })
  for (const [i, rest] of p.ev) if (frames[i]) Object.assign(frames[i], rest)
  return { version: 1, highlightId: p.highlightId, opts: { ...p.opts }, frames }
}

interface QueuedReplay { minute: number; rec: InputRecording }
const queue: QueuedReplay[] = []

/** Called by the match scene when the hero scores; stored into the state on the next save. */
export function queueGoalReplay(minute: number, rec: InputRecording): void {
  queue.push({ minute, rec })
  if (queue.length > MAX_GOAL_REPLAYS) queue.shift()
}

/** Moves queued goal replays into the state (bounded) and returns how many were added. */
export function drainGoalReplays(state: GameState): number {
  const n = queue.length
  for (const q of queue.splice(0)) addGoalReplay(state, { season: state.calendar.season, week: state.calendar.week, minute: q.minute, rec: packRecording(q.rec) })
  return n
}

export function addGoalReplay(state: GameState, r: GoalReplay): void {
  const list = (state.replays ??= [])
  list.push(r)
  if (list.length > MAX_GOAL_REPLAYS) list.splice(0, list.length - MAX_GOAL_REPLAYS)
}

// ───────────── Slot thumbnail ─────────────

/** Procedural thumbnail spec: renderable as a tiny portrait without storing pixels. */
export function slotThumb(state: GameState): SlotThumb {
  const a = state.hero.appearance
  const crest = heroClub(state)?.crest
  return {
    v: 1,
    skin: a.skin, hairStyle: a.hairStyle, hairColor: a.hairColor, beard: a.beard, eyeColor: a.eyeColor, face: a.face,
    kit: crest ? [crest.colors[0], crest.colors[1]] : ['#3b6ea5', '#f2f2f2'],
    pos: state.hero.position,
    female: state.hero.gender === 'female',
  }
}

/** Standalone SVG for a {@link SlotThumb} (no external assets; safe because every value is validated). */
export function thumbSvg(t: SlotThumb, size = 48): string {
  const hex = (c: string, d: string) => (/^#[0-9a-fA-F]{3,8}$/.test(c) ? c : d)
  const skins = ['#f1c9a5', '#e0ac82', '#c68642', '#8d5524', '#5c3a1e']
  const hairs = ['#1c1c1c', '#4a2c17', '#a0612b', '#d8b45a', '#9a9a9a', '#b5361f']
  const num = (n: unknown) => (Number.isFinite(n) ? Math.abs(Math.trunc(n as number)) : 0)
  const skin = skins[num(t.skin) % skins.length]
  const hair = hairs[num(t.hairColor) % hairs.length]
  const [k1, k2] = [hex(t.kit[0], '#3b6ea5'), hex(t.kit[1], '#f2f2f2')]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48">` +
    `<rect width="48" height="48" rx="8" fill="${k1}"/><path d="M6 48c2-10 10-14 18-14s16 4 18 14z" fill="${k2}"/>` +
    `<circle cx="24" cy="21" r="9" fill="${skin}"/><path d="M15 20c0-8 18-8 18 0-4-4-14-4-18 0z" fill="${hair}"/></svg>`
}
