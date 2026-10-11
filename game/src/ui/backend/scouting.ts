/**
 * UI bridge for the opponent video-scouting mini-game (sim/game/oppScouting,
 * game/training/scouting). Every "watch the opponent's video" entry point
 * (agenda suggestion, today's ideas, Activities) opens the mini-game through
 * {@link openScouting}; without a club match coming it falls back to the plain
 * 'video' activity, exactly as before.
 */
import { signal } from '@preact/signals'
import type { AttributeKey, LText } from '../../core/types'
import { applyScouting, patternText, scoutAttrs, scoutBuff, scoutReading, scoutSlowMo, scoutTakeaway, scoutingReport, type PatternId, type ScoutReport } from '../../sim/game/oppScouting'
import { commit, current, get } from './session'
import { realActions } from './realActions'
import type { Delta } from '../store'

/** The overlay is open (mounted once in App). */
export const scoutingOpen = signal(false)

/** The next opponent's tendencies (null: no club match within a week). */
export function scoutReport(): ScoutReport | null {
  const s = current()
  return s ? scoutingReport(s) : null
}

/** The hero's reading of the game for the session: the stat, the clip slow-mo and the takeaway multiplier. */
export function scoutPacing(): { reading: number; slowMo: number; takeaway: number } {
  const s = current()
  const reading = s ? scoutReading(s.hero) : 50
  return { reading, slowMo: scoutSlowMo(reading), takeaway: scoutTakeaway(reading) }
}

/** Open the mini-game, or run the plain video activity when there is nothing to scout. */
export function openScouting(): void {
  if (scoutReport()) scoutingOpen.value = true
  else realActions.doActivity('video')
}

export interface ScoutOutcome {
  ok: boolean
  deltas: Delta[]
  lines: LText[]
  xp: { key: AttributeKey; xp: number }[]
  bonus: number
  /** The final grade (played score × the hero's reading), when a session was applied. */
  grade?: string
  effective?: number
}

/**
 * Apply a played session: the 'video' activity (time, energy, preparation goal)
 * then the scouting buff + XP. `performance` null = watched quickly (activity only).
 */
export function finishScouting(performance: number | null, spotted: PatternId[] = []): ScoutOutcome {
  const deltas = realActions.doActivity('video')
  if (!deltas.length) return { ok: false, deltas, lines: [], xp: [], bonus: 0 }
  if (performance === null) return { ok: true, deltas, lines: [], xp: [], bonus: 0 }
  const s = get()
  const r = applyScouting(s, performance, spotted)
  if (!r) return { ok: true, deltas, lines: [], xp: [], bonus: 0 }
  commit(s)
  return { ok: true, deltas, lines: r.lines, xp: r.xp, bonus: r.buff.bonus, grade: r.grade, effective: r.effective }
}

export interface ScoutCardView {
  bonus: number
  grade: string
  attrs: AttributeKey[]
  notes: LText[]
}

/** The pre-match "Rakip analizi" card for a fixture (null: no scouting done). */
export function scoutCard(fixtureId: string | undefined): ScoutCardView | null {
  const s = current()
  if (!s) return null
  const b = scoutBuff(s, fixtureId)
  if (!b) return null
  return { bonus: b.bonus, grade: b.grade, attrs: scoutAttrs(s.hero.position), notes: b.notes ?? b.spotted.map((id) => patternText(id)) }
}
