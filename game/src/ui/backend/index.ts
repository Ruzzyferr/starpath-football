/**
 * Real backend entry: installs GameActions/GameData over the simulation,
 * loads the save-slot cards, flushes autosaves when the tab is hidden, and
 * supports a dev shortcut:
 *
 *   ?autostart=1            create a default career and open Home
 *   ?autostart=1&dev=<id>   …then jump to a screen (planner, life, casino,
 *                           preMatch, liveMatch, postMatch, …), advancing time
 *                           to a matchday / the evening when the screen needs it
 *   &seed=<n>               deterministic career seed
 *   &storage=memory         in-memory saves (headless testing)
 */
import type { NewGameInput, ScreenId } from '../store'
import { effect } from '@preact/signals'
import { activeEvent, gameState, installBackend, match, navigate, pendingNav, screen } from '../store'
import { ADULT_AGE, isAdult } from '../../sim/career/common'
import { realActions } from './realActions'
import { realData } from './realData'
import { MemoryStorage } from '../../state/save'
import { checkSaveIntegrity, flushAutosave, refreshSlots, useStorage } from './persistence'
import { persistNow } from './liveMatch'
import * as meta from './meta'
import { flushObjectiveToasts, forceCompleteObjective, installObjectivesFeed } from './objectivesFeed'

export const DEFAULT_CAREER: NewGameInput = {
  firstName: 'Arda', lastName: 'Yıldız', nickname: 'Arda', nationality: 'TR', birthYear: 2009,
  position: 'ST', foot: 'R', archetype: 'poacher', background: 'academy',
  appearance: { skin: 2, hairStyle: 3, hairColor: 1, beard: 0, eyeColor: 1, face: 1, accessory: 0 },
  difficulty: 'normal',
}

/** Resolve pending decision cards with their first choice (dev shortcuts only). */
function clearEvents(): void {
  for (let i = 0; i < 10 && (gameState.value?.pendingEvents.length ?? 0) > 0; i++) {
    const v = realData.eventView(0)
    const pick = Math.max(0, v?.choices.findIndex((c) => !c.requirement || c.requirement.met) ?? 0)
    realActions.resolveEvent(0, pick)
  }
}

function toMatchday(): void {
  for (let i = 0; i < 12; i++) {
    clearEvents()
    const fx = realData.nextFixture()
    if (fx?.daysUntil === 0 && (gameState.value?.calendar.slot ?? 0) >= 1) break
    realActions.advanceToMatch()
  }
  clearEvents()
}

function devJump(id: ScreenId): void {
  switch (id) {
    case 'preMatch':
    case 'liveMatch':
    case 'postMatch':
      toMatchday()
      realActions.playMatch()
      if (id === 'postMatch') realActions.matchSimToEnd()
      break
    case 'casino':
    case 'blackjack':
    case 'roulette':
    case 'slots':
    case 'horses': {
      // The canned hero is 17 and the casino is 18+: age them for this dev shortcut.
      const st = gameState.value
      if (st && !isAdult(st.hero, st.calendar.season)) st.hero.birthYear = st.calendar.season - ADULT_AGE
      clearEvents()
      for (let i = 0; i < 3 && (gameState.value?.calendar.slot ?? 2) < 2; i++) realActions.advance()
      clearEvents()
      break
    }
    case 'seasonEnd':
      for (let i = 0; i < 600 && pendingNav.value !== 'seasonEnd'; i++) {
        clearEvents()
        const fx = realData.nextFixture()
        if (fx?.daysUntil === 0 && (gameState.value?.calendar.slot ?? 0) >= 1) realActions.advance()
        else realActions.advanceToMatch()
      }
      pendingNav.value = null
      break
    default:
      break
  }
  activeEvent.value = null
  navigate(id === 'title' ? 'home' : id, undefined, { tab: true })
}

/**
 * Dev-only debug API (`window.__sp`), used by the Playwright e2e suite and
 * handy in devtools. Never present in production builds.
 */
function installDebugApi(): void {
  ;(globalThis as { __sp?: unknown }).__sp = {
    state: () => gameState.value,
    match: () => match.value,
    screen: () => screen.value,
    actions: realActions,
    data: realData,
    navigate,
    clearEvents,
    toMatchday,
    /** Fast-forward to the end of the season (lands on the season review). */
    toSeasonEnd: () => devJump('seasonEnd'),
    jump: (id: ScreenId) => devJump(id),
    flushAutosave,
    refreshSlots,
    /** Career end / achievements bridge (ui/backend/meta). */
    meta,
    /** Force-complete the first active objective (fires the completion toast). */
    completeObjective: () => (gameState.value ? forceCompleteObjective(gameState.value) : false),
  }
}

export function installRealBackend(): void {
  installBackend({ actions: realActions, data: realData })
  meta.installMeta()
  installObjectivesFeed()
  effect(() => {
    void screen.value
    flushObjectiveToasts()
  })
  if (import.meta.env.DEV) installDebugApi()
  // &storage=memory: keep saves in memory (headless browsers without a working IndexedDB).
  if (globalThis.location?.search.includes('storage=memory')) useStorage(new MemoryStorage())
  void refreshSlots().then(() => checkSaveIntegrity())
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && gameState.value) {
        persistNow()
        void flushAutosave()
      }
    })
  }
  let params: URLSearchParams
  try {
    params = new URLSearchParams(globalThis.location?.search ?? '')
  } catch {
    return
  }
  if (params.get('autostart') !== '1') {
    const dev = params.get('dev') as ScreenId | null
    if (dev === 'newCareer' || dev === 'saves' || dev === 'settings' || dev === 'credits') navigate(dev, undefined, { tab: true })
    return
  }
  const seed = Number(params.get('seed')) || 20261007
  realActions.newGame({ ...DEFAULT_CAREER, seed })
  const dev = params.get('dev') as ScreenId | null
  if (dev) devJump(dev)
  else navigate('home', undefined, { tab: true })
  if (params.get('event') === '1' && (gameState.value?.pendingEvents.length ?? 0) > 0) activeEvent.value = 0
  // &moment=play: open the first highlight in the Phaser player (visual check of the bridge).
  if (params.get('moment') === 'play') {
    let done = false
    effect(() => {
      const m = match.value
      if (!done && m?.pendingMoment && !m.momentActive) {
        done = true
        queueMicrotask(() => realActions.playMoment())
      }
    })
  }
}
