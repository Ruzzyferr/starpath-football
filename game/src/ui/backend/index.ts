/**
 * Real backend entry: installs GameActions/GameData over the simulation,
 * loads the save-slot cards, flushes autosaves when the tab is hidden, and
 * supports a dev shortcut:
 *
 *   ?autostart=1            create a default career and open Home
 *   ?autostart=1&dev=<id>   …then jump to a screen (activities, life, casino,
 *                           preMatch, liveMatch, postMatch, …), advancing time
 *                           to a matchday / the evening when the screen needs it
 *   &seed=<n>               deterministic career seed
 *   &storage=memory         in-memory saves (headless testing)
 */
import { installShopBridge } from './shopBridge'
import { quickResolveAll } from './benchPath'
import { commit, onCommit } from './session'
import { installPrefsSync } from './prefsSync'
import type { NewGameInput, ScreenId } from '../store'
import { effect } from '@preact/signals'
import { activeEvent, gameState, installBackend, match, navigate, pendingNav, screen, settings } from '../store'
import { CASINO_MIN_AGE, canGamble } from '../../sim/career/common'
import { realActions } from './realActions'
import { realData } from './realData'
import { MemoryStorage } from '../../state/save'
import { checkSaveIntegrity, flushAutosave, installAutosaveTriggers, markDirty, refreshSlots, setAutosaveSource, useStorage } from './persistence'
import { debugOpenDecision, persistNow } from './liveMatch'
import * as meta from './meta'
import { flushObjectiveToasts, forceCompleteObjective, installObjectivesFeed } from './objectivesFeed'
import { openManagerTalk, openOneOnOne, openTeamDinner } from './scenes'

export const DEFAULT_CAREER: NewGameInput = {
  firstName: 'Arda', lastName: 'Yıldız', nickname: 'Arda', nationality: 'TR', birthYear: 2009,
  position: 'ST', foot: 'R', role: 'runner', background: 'academy',
  appearance: { skin: 2, hairStyle: 3, hairColor: 1, beard: 0, eyeColor: 1, face: 1, accessory: 0 },
  difficulty: 'normal',
}

/** Resolve pending decision cards with their first choice (dev shortcuts only). */
/** Dev/test autopilot: answer pending cards and quick-resolve today's mandatory agenda tasks (they block Advance). */
function clearEvents(): void {
  quickResolveAll()
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
      // The canned hero is 17 and the casino is 21+: age them for this dev shortcut.
      const st = gameState.value
      if (st && !canGamble(st.hero, st.calendar.season)) st.hero.birthYear = st.calendar.season - CASINO_MIN_AGE
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
    /** Re-render after a test mutated the state in place. */
    touch: () => commit(gameState.value!, { silent: true }),
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
    /** Open an in-match decision window now (2.4#36/#52/#99). */
    openDecision: debugOpenDecision,
    refreshSlots,
    /** Career end / achievements bridge (ui/backend/meta). */
    meta,
    /** Force-complete the first active objective (fires the completion toast). */
    completeObjective: () => (gameState.value ? forceCompleteObjective(gameState.value) : false),
    /** Open a bench moment (dialogue scene / 1-on-1 drill) the way its card does (ui/backend/scenes). */
    moment: (kind: 'talk' | 'teamDinner' | 'oneOnOne') => (kind === 'talk' ? openManagerTalk() : kind === 'teamDinner' ? openTeamDinner() : openOneOnOne()),
  }
}

export function installRealBackend(): void {
  installBackend({ actions: realActions, data: realData })
  meta.installMeta()
  installObjectivesFeed()
  installPrefsSync()
  installShopBridge()
  effect(() => {
    void screen.value
    flushObjectiveToasts()
  })
  if (import.meta.env.DEV) installDebugApi()
  // &storage=memory: keep saves in memory (headless browsers without a working IndexedDB).
  if (globalThis.location?.search.includes('storage=memory')) useStorage(new MemoryStorage())
  void refreshSlots().then(() => checkSaveIntegrity())
  // Autosave (default ON, Settings toggle): every commit marks the career dirty; backgrounding the app
  // (Capacitor pause / visibilitychange) or closing the page saves at once (live match snapshot first).
  setAutosaveSource(() => settings.value.autosave !== false)
  onCommit(() => markDirty())
  installAutosaveTriggers(() => persistNow())
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
