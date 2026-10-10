/**
 * First-career coach tour — a pure state machine.
 *
 * The state lives in the save (`life.flags['tut:status']`, `life.flags['tut:step']`)
 * so progress survives reloads and is per career. No DOM, no signals: the
 * overlay (CoachTour.tsx) and the binding (tour.ts) drive it with events.
 */
import type { ScreenId } from '../store'

/** Something the player does that can complete an "action" step. */
export type TourAction = 'advance'

export interface TourStep {
  id: 'welcome' | 'meters' | 'condition' | 'agenda' | 'advance' | 'decisions' | 'matchday'
  /** `data-tour` id of the element to spotlight (none = centred card). */
  target?: string
  /** Screen the step lives on (the tour navigates there when the step starts). */
  screen?: ScreenId
  /** The step also completes by itself when the player performs this action. */
  waitFor?: TourAction
}

export const TOUR_STEPS: readonly TourStep[] = [
  { id: 'welcome', screen: 'home' },
  { id: 'meters', target: 'status', screen: 'home' },
  { id: 'condition', target: 'condition', screen: 'home' },
  // The three-slot day planner was removed (TestFlight build 4): the day is the agenda on Home.
  { id: 'agenda', target: 'agenda', screen: 'home' },
  { id: 'advance', target: 'advance', screen: 'home', waitFor: 'advance' },
  { id: 'decisions', target: 'bell', screen: 'home' },
  { id: 'matchday', target: 'fixture', screen: 'home' },
]

export type TourStatus = 'none' | 'active' | 'done' | 'skipped'

export interface TourState {
  status: TourStatus
  /** Index into {@link TOUR_STEPS} (meaningful while active). */
  step: number
}

export type TourEvent =
  | { type: 'start' }
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'skip' }
  | { type: 'replay' }
  | { type: 'action'; action: TourAction }

export const INITIAL_TOUR: TourState = { status: 'none', step: 0 }

const last = TOUR_STEPS.length - 1
const clampStep = (n: number) => Math.max(0, Math.min(last, Math.floor(Number.isFinite(n) ? n : 0)))

/** Pure transition function. Unknown / inapplicable events return the same object. */
export function reduceTour(s: TourState, e: TourEvent): TourState {
  switch (e.type) {
    case 'start':
      // Only a fresh career starts the tour; finished/skipped tours stay closed.
      return s.status === 'none' ? { status: 'active', step: 0 } : s
    case 'replay':
      return { status: 'active', step: 0 }
    case 'skip':
      return s.status === 'active' ? { status: 'skipped', step: s.step } : s
    case 'next':
      if (s.status !== 'active') return s
      return s.step >= last ? { status: 'done', step: last } : { status: 'active', step: s.step + 1 }
    case 'back':
      if (s.status !== 'active' || s.step === 0) return s
      return { status: 'active', step: s.step - 1 }
    case 'action': {
      if (s.status !== 'active') return s
      const cur = TOUR_STEPS[s.step]
      if (cur?.waitFor !== e.action) return s
      return reduceTour(s, { type: 'next' })
    }
    default:
      return s
  }
}

export const currentStep = (s: TourState): TourStep | null => (s.status === 'active' ? (TOUR_STEPS[s.step] ?? null) : null)

// ───────────────────────── Persistence (save flags) ─────────────────────────

export const TOUR_FLAG = { status: 'tut:status', step: 'tut:step' } as const
type Flags = Record<string, number | string | boolean>

const STATUSES: readonly TourStatus[] = ['none', 'active', 'done', 'skipped']

/** Read the tour from a save's flags (missing / corrupt → not started). */
export function readTour(flags: Flags | null | undefined): TourState {
  if (!flags) return INITIAL_TOUR
  const raw = flags[TOUR_FLAG.status]
  const status = STATUSES.includes(raw as TourStatus) ? (raw as TourStatus) : 'none'
  if (status === 'none') return INITIAL_TOUR
  return { status, step: clampStep(Number(flags[TOUR_FLAG.step] ?? 0)) }
}

/** Write the tour into a save's flags (mutates). Returns true if anything changed. */
export function writeTour(flags: Flags, s: TourState): boolean {
  const before = `${flags[TOUR_FLAG.status]}|${flags[TOUR_FLAG.step]}`
  if (s.status === 'none') {
    delete flags[TOUR_FLAG.status]
    delete flags[TOUR_FLAG.step]
  } else {
    flags[TOUR_FLAG.status] = s.status
    flags[TOUR_FLAG.step] = s.step
  }
  return before !== `${flags[TOUR_FLAG.status]}|${flags[TOUR_FLAG.step]}`
}
