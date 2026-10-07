/**
 * Day planner state (UI-only, persisted in life.flags as JSON so it survives
 * a reload): the activity planned for each of today's three slots and what
 * was actually done. Both reset automatically when the day changes.
 */
import type { GameState } from '../../core/types'
import { absDayOf, readJson, writeJson } from '../../sim/game/internal'

export const PLAN_FLAG = 'g:plan'
export const DONE_FLAG = 'g:done'

type Slots = [string | null, string | null, string | null]
interface DayRecord {
  d: number
  s: Slots
}

function read(s: GameState, key: string): Slots {
  const r = readJson<DayRecord | null>(s.life, key, null)
  return r && r.d === absDayOf(s) && Array.isArray(r.s) ? [r.s[0] ?? null, r.s[1] ?? null, r.s[2] ?? null] : [null, null, null]
}

function write(s: GameState, key: string, slots: Slots): void {
  writeJson(s.life, key, slots.some((x) => x) ? { d: absDayOf(s), s: slots } : null)
}

export const plannedSlots = (s: GameState): Slots => read(s, PLAN_FLAG)
export const doneSlots = (s: GameState): Slots => read(s, DONE_FLAG)

export function setPlanned(s: GameState, slot: 0 | 1 | 2, id: string | null): void {
  const p = plannedSlots(s)
  p[slot] = id
  write(s, PLAN_FLAG, p)
}

/** Record an activity done starting at `slot` and spanning `span` slots. */
export function markDone(s: GameState, slot: number, span: number, id: string): void {
  const d = doneSlots(s)
  for (let i = slot; i < Math.min(3, slot + Math.max(1, span)); i++) d[i] = id
  write(s, DONE_FLAG, d)
}
