/**
 * UI bridge for the path off the bench (sim/game/selection, weekIdeas,
 * reserve matches in sim/game/match): the selection meter, today's ideas and
 * the weekly actions. Screens import these directly (like backend/meta.ts).
 */
import { signal } from '@preact/signals'
import type { GameState, LText } from '../../core/types'
import { absWeek } from '../../sim/career/common'
import { absDayOf } from '../../sim/game/internal'
import { prepareReserveMatch, reserveMatchBlock, type ReserveKind } from '../../sim/game/match'
import { IMPRESS_BONUS, IMPRESS_TARGET, impressBlock, resolveImpress, selectionOutlook, talkToManager, type SelectionOutlook } from '../../sim/game/selection'
import { AGENDA_FLAG, agendaBlock, ensureAgenda, pendingMandatory, resolveTask, type Agenda, type AgendaTask, type ResolveMode } from '../../sim/game/agenda'
import { oneOnOne, oneOnOneBlock, weekIdeas, type OneOnOneResult, type WeekIdea } from '../../sim/game/weekIdeas'
import { commit, current, get, notify, onCommit } from './session'
import * as live from './liveMatch'

export { IMPRESS_BONUS, IMPRESS_TARGET }
export type { SelectionOutlook, WeekIdea, ReserveKind }

const reserveOpen = (s: Parameters<typeof reserveMatchBlock>[0]): boolean => !reserveMatchBlock(s, 'reserve')

/** Selection meter for the next club match (null without a club). */
export function benchOutlook(afterActive = false): SelectionOutlook | null {
  const s = current()
  return s ? selectionOutlook(s, reserveOpen, afterActive ? s.activeMatchId : null) : null
}

/** Today's 2–3 suggestions. */
export function todayIdeas(): WeekIdea[] {
  const s = current()
  if (!s) return []
  return weekIdeas(s, selectionOutlook(s, reserveOpen))
}

export const reserveBlock = (kind: ReserveKind): LText | null => {
  const s = current()
  return s ? reserveMatchBlock(s, kind) : null
}

/** Prepare a reserve / training match and start the live controller. True when the pre-match screen can open. */
export function startReserveMatch(kind: ReserveKind): boolean {
  const s = get()
  const r = prepareReserveMatch(s, kind)
  if (!r.ok) {
    notify(r.error ?? null, 'info')
    return false
  }
  commit(s, { silent: true })
  if (!live.startMatch()) {
    notify({ tr: 'Maç başlatılamadı.', en: 'Could not start the match.' })
    return false
  }
  return true
}

/** Talk to the manager (once a week). Returns the manager's lines. */
export function talkManager(): LText[] {
  const s = get()
  const r = talkToManager(s)
  if (!r.ok) {
    notify(r.lines[0] ?? null, 'info')
    return []
  }
  commit(s)
  return r.lines
}

export const talkAvailable = (): boolean => {
  const s = current()
  return !!s && selectionOutlook(s)?.levers.some((l) => l.key === 'talk') === true
}

export const impressAvailable = (): LText | null => {
  const s = current()
  return s ? impressBlock(s) : null
}

/** Record the coach's challenge result; call BEFORE applying the drill session (the session moves the clock). */
export function impressResult(performance: number, grade: string): { passed: boolean; lines: LText[] } | null {
  const s = get()
  const r = resolveImpress(s, performance, grade)
  if (!r.ok) {
    notify(r.lines[0] ?? null, 'info')
    return null
  }
  commit(s, { silent: true })
  return { passed: r.passed, lines: r.lines }
}

// ───────────────────────── Daily agenda ─────────────────────────

/** Set by "skip to matchday" while mandatory tasks are open: Home asks to quick-resolve them in one confirm. */
export const agendaSkipPrompt = signal<AgendaTask[] | null>(null)

/** Today's agenda (generated on first read of the day). */
export function todayAgenda(): Agenda | null {
  const s = current()
  if (!s || s.hero.retired || !s.hero.contract) return null
  const before = s.life.flags[AGENDA_FLAG]
  const a = ensureAgenda(s)
  if (s.life.flags[AGENDA_FLAG] !== before) commit(s, { silent: true })
  return a
}

export const agendaBlockReason = (): LText | null => {
  const s = current()
  return s && !s.hero.retired ? agendaBlock(s) : null
}

/** Resolve one task: quick, played (drill performance / choice) or skipped. */
export function resolveAgendaTask(id: string, mode: ResolveMode, opts: { performance?: number; choice?: string } = {}): LText[] {
  const s = get()
  const r = resolveTask(s, id, mode, opts)
  if (!r.ok) {
    notify(r.lines[0] ?? null, 'info')
    return []
  }
  commit(s)
  return r.lines
}

/** Quick-resolve every open mandatory task of today (the "one confirm" path; also used by autoplay tests). */
export function quickResolveAll(): number {
  const s = current()
  if (!s) return 0
  const open = pendingMandatory(s)
  for (const t of open) resolveTask(s, t.id, 'quick')
  if (open.length) commit(s, { silent: true })
  return open.length
}

/** Quick-resolve every open mandatory task, then skip to matchday. */
export function quickResolveAndSkip(advance: () => void): void {
  const s = get()
  for (const t of pendingMandatory(s)) resolveTask(s, t.id, 'quick')
  agendaSkipPrompt.value = null
  commit(s, { silent: true })
  advance()
}

// ───────────────────────── Skip nudge ─────────────────────────

export interface SkipMissed { days: number; energy: number; ideas: WeekIdea[]; gain: number }
/** Set when the player jumped 2+ days while rewarding things were on offer (Home shows it once a week). */
export const skipMissed = signal<SkipMissed | null>(null)

interface Mark { seed: number; day: number; energy: number; ideas: WeekIdea[]; chance: number; gain: number }
let mark: Mark | null = null
let nudgedWeek = -1
const dayOf = (s: GameState): number => absDayOf(s)
const SKIP_IDEAS = new Set<WeekIdea['action']>(['impress', 'reserve', 'scrimmage', 'talk', 'oneOnOne', 'training'])

function capture(s: GameState): Mark {
  const o = selectionOutlook(s, reserveOpen)
  const ideas = weekIdeas(s, o, 4).filter((i) => SKIP_IDEAS.has(i.action))
  const gain = (o?.levers ?? []).filter((l) => l.key === 'impress' || l.key === 'talk' || l.key === 'reserve').reduce((a, l) => a + l.points, 0)
  return { seed: s.meta.seed, day: dayOf(s), energy: Math.round(s.life.energy), ideas, chance: o?.chance ?? 1, gain }
}

/**
 * Opportunity cost of skipping (owner feedback 3f): compares each commit with the
 * last one. A jump of 2+ days with 2+ rewarding ideas on offer (and the shirt not
 * yet safe) raises `skipMissed` — at most once a week, never blocking.
 */
onCommit((s) => {
  if (!s || s.hero.retired) return
  const day = dayOf(s)
  if (mark && mark.seed !== s.meta.seed) mark = null // another career / a loaded save
  if (mark && day - mark.day >= 2 && day - mark.day <= 30) {
    const week = absWeek(s.calendar)
    if (mark.ideas.length >= 2 && mark.chance < 0.8 && nudgedWeek !== week) {
      nudgedWeek = week
      skipMissed.value = { days: day - mark.day, energy: mark.energy, ideas: mark.ideas.slice(0, 3), gain: mark.gain }
    }
  }
  if (!mark || day !== mark.day) mark = capture(s)
  else mark.energy = Math.round(s.life.energy)
})

export const oneOnOneAvailable = (): LText | null => {
  const s = current()
  return s ? oneOnOneBlock(s) : null
}

/** Extra 1-on-1 session with the best teammate of the hero's line. */
export function doOneOnOne(): OneOnOneResult {
  const s = get()
  const r = oneOnOne(s)
  if (!r.ok) {
    notify(r.lines[0] ?? null, 'info')
    return r
  }
  commit(s)
  return r
}
