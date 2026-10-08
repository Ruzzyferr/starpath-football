/**
 * Applies the career-side consequences of in-match decisions (GAP 2.4#36/#52/#99).
 * Chosen outcomes are parked in life.flags while the match runs and applied
 * once at full time, so the post-match deltas/relations rows show them.
 */
import type { GameState, LText } from '../../core/types'
import { clamp } from '../../core/rng'
import type { DecisionOutcome } from '../match/decisions'
import { absWeek, meter } from '../career/common'
import { changeRelation } from '../life/relationships'
import { log, readJson, writeJson } from './internal'

export const DECISION_FLAG = 'g:mdec'

export function pendingDecisions(state: GameState): DecisionOutcome[] {
  return readJson<DecisionOutcome[]>(state.life, DECISION_FLAG, [])
}

export function recordDecision(state: GameState, o: DecisionOutcome): void {
  writeJson(state.life, DECISION_FLAG, [...pendingDecisions(state), o])
}

/** Apply (and clear) every parked outcome. Returns the log lines. */
export function applyPendingDecisions(state: GameState): LText[] {
  const list = pendingDecisions(state)
  if (!list.length) return []
  const { hero: h, life: l } = state
  const week = absWeek(state.calendar)
  const lines: LText[] = []
  const why: LText = { tr: 'Maç içi karar', en: 'In-match decision' }
  for (const o of list) {
    const fx = o.effects
    if (fx.teammates) for (const r of Object.values(l.relationships)) if (r.kind === 'teammate') changeRelation(l, r.id, fx.teammates, { hero: h, week, cause: 'other', why })
    if (fx.manager) changeRelation(l, 'manager', fx.manager, { hero: h, week, cause: 'other', why })
    if (fx.press) changeRelation(l, 'press', fx.press, { hero: h, week, cause: 'other', why })
    if (fx.fans) changeRelation(l, 'fans', fx.fans, { hero: h, week, cause: 'other', why })
    if (fx.morale) h.morale = clamp(h.morale + fx.morale, 0, 100)
    if (fx.managerTrust) h.managerTrust = meter(h.managerTrust + fx.managerTrust)
    if (fx.discipline) l.discipline = meter(l.discipline + fx.discipline)
    log(state, lines, o.line, 'event', '🗣️')
  }
  writeJson(state.life, DECISION_FLAG, [])
  return lines
}
