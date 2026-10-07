/**
 * Binds the pure tour machine to the loaded career: reads/writes the
 * `tut:*` save flags, re-renders via touch() and persists via actions.save().
 */
import { computed } from '@preact/signals'
import { actions, gameState, touch } from '../store'
import { INITIAL_TOUR, readTour, reduceTour, writeTour, type TourEvent, type TourState } from './machine'
import { helpPrefs, updateHelp } from './prefs'
import { markCareerStart } from './unlocks'

export const tour = computed<TourState>(() => {
  const s = gameState.value
  return s ? readTour(s.life.flags) : INITIAL_TOUR
})

let saveTimer: ReturnType<typeof setTimeout> | null = null
function persistSoon(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    if (!gameState.value) return
    try {
      void actions.save().catch(() => {})
    } catch {
      /* no backend (tests) */
    }
  }, 150)
}

/** Apply an event to the loaded career's tour. Returns the new state. */
export function dispatchTour(e: TourEvent): TourState {
  const s = gameState.value
  if (!s) return INITIAL_TOUR
  const next = reduceTour(readTour(s.life.flags), e)
  if (writeTour(s.life.flags, next)) {
    touch()
    persistSoon()
  }
  return next
}

/**
 * Called right after the new-career wizard created a career: records the
 * career start (progressive unlocks) and starts the coach tour on the first
 * career when tips are on.
 */
export function beginNewCareer(): void {
  const s = gameState.value
  if (!s) return
  markCareerStart(s.life.flags, s.calendar)
  if (helpPrefs.value.tips && !helpPrefs.value.tourOffered) {
    updateHelp({ tourOffered: true })
    dispatchTour({ type: 'start' })
  } else {
    touch()
    persistSoon()
  }
}

export const replayTour = (): TourState => dispatchTour({ type: 'replay' })
export const skipTour = (): TourState => dispatchTour({ type: 'skip' })
