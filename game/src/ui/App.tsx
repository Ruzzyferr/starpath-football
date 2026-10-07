/**
 * Root component + tiny signal-based router (no router lib).
 * Screens are plain components keyed by ScreenId. Shell-less ("immersive")
 * screens: title, new career and the match flow.
 */
import type { FunctionComponent } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { activeEvent, back, gameState, heroClub, navDirection, navigate, pendingNav, screen, type ScreenId } from './store'
import { Shell, TABS } from './layout/Shell'
import { ToastHost } from './components'
import { EventModalHost } from './screens/EventModal'
import { TitleScreen } from './screens/TitleScreen'
import { NewCareerScreen } from './screens/NewCareerScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { SavesScreen } from './screens/SavesScreen'
import { CreditsScreen } from './screens/CreditsScreen'
import { MenuScreen } from './screens/MenuScreen'
import { HomeScreen } from './screens/HomeScreen'
import { PlannerScreen } from './screens/PlannerScreen'
import { InboxScreen } from './screens/InboxScreen'
import { CareerLogScreen } from './screens/CareerLogScreen'
import { TrainingScreen } from './screens/TrainingScreen'
import { ProfileScreen } from './screens/ProfileScreen'
import { ClubScreen } from './screens/ClubScreen'
import { WorldScreen } from './screens/WorldScreen'
import { ContractScreen } from './screens/ContractScreen'
import { LifeScreen } from './screens/LifeScreen'
import { CasinoScreen } from './screens/casino/CasinoScreen'
import { BlackjackScreen } from './screens/casino/BlackjackScreen'
import { RouletteScreen } from './screens/casino/RouletteScreen'
import { SlotsScreen } from './screens/casino/SlotsScreen'
import { HorsesScreen } from './screens/casino/HorsesScreen'
import { PreMatchScreen } from './screens/match/PreMatchScreen'
import { LiveMatchScreen } from './screens/match/LiveMatchScreen'
import { PostMatchScreen } from './screens/match/PostMatchScreen'
import { SeasonEndScreen } from './screens/SeasonEndScreen'
import { TrophiesScreen } from './screens/TrophiesScreen'
import { GlossaryScreen } from './screens/help/GlossaryScreen'
import { CoachTour } from './tutorial/CoachTour'
import { MatchdayConfirmHost, requestAdvance } from './tutorial/MatchdayConfirm'
import { UnlockNotifier, gated } from './tutorial/UnlockGate'
import { tour } from './tutorial/tour'

export const SCREENS: Record<ScreenId, FunctionComponent> = {
  title: TitleScreen,
  newCareer: NewCareerScreen,
  settings: SettingsScreen,
  saves: SavesScreen,
  credits: CreditsScreen,
  menu: MenuScreen,
  home: HomeScreen,
  planner: PlannerScreen,
  inbox: InboxScreen,
  careerLog: CareerLogScreen,
  training: TrainingScreen,
  profile: ProfileScreen,
  club: ClubScreen,
  world: WorldScreen,
  contract: ContractScreen,
  life: LifeScreen,
  casino: gated('casino', CasinoScreen),
  blackjack: gated('casino', BlackjackScreen),
  roulette: gated('casino', RouletteScreen),
  slots: gated('casino', SlotsScreen),
  horses: gated('casino', HorsesScreen),
  preMatch: PreMatchScreen,
  liveMatch: LiveMatchScreen,
  postMatch: PostMatchScreen,
  seasonEnd: SeasonEndScreen,
  trophies: TrophiesScreen,
  glossary: GlossaryScreen,
}

const IMMERSIVE = new Set<ScreenId>(['title', 'newCareer', 'preMatch', 'liveMatch', 'postMatch', 'seasonEnd'])
/** Screens usable without a loaded career. */
const NO_STATE = new Set<ScreenId>(['title', 'newCareer', 'settings', 'saves', 'credits', 'glossary'])

function isTyping(el: Element | null): boolean {
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement).isContentEditable
}

function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
      if (document.querySelector('.modal-root')) return
      if (isTyping(document.activeElement)) return
      const id = screen.value.id
      const inShell = !IMMERSIVE.has(id) && !!gameState.value
      if (e.key === 'Escape') {
        if (id !== 'title' && id !== 'home') {
          e.preventDefault()
          back(gameState.value ? 'home' : 'title')
        }
        return
      }
      if (!inShell) return
      const tab = TABS.find((x) => x.key === e.key)
      if (tab) {
        e.preventDefault()
        navigate(tab.screen, undefined, { tab: true })
        return
      }
      if (e.key === ' ' && (document.activeElement === document.body || document.activeElement?.id === 'main') && (id === 'home' || id === 'planner')) {
        e.preventDefault()
        requestAdvance()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
}

/** Auto-open the decision modal when NEW events arrive (not on load). */
function useEventAutoOpen() {
  const n = gameState.value?.pendingEvents.length ?? 0
  const prev = useRef<number | null>(null)
  useEffect(() => {
    const before = prev.current
    prev.current = n
    if (before === null) return
    const id = screen.value.id
    // During the coach tour new cards wait behind the bell (the tour points at it).
    if (n > before && activeEvent.value === null && !IMMERSIVE.has(id) && tour.value.status !== 'active') activeEvent.value = 0
  }, [n])
}

/** Let the hero club's colours bleed into the UI (top bar hairline, accents). */
function useClubTint() {
  const c = heroClub.value?.colors
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--club', c?.primary ?? '#1fd47a')
    root.style.setProperty('--club-2', c?.secondary ?? '#f2f5fa')
  }, [c?.primary, c?.secondary])
}

/** Show screens the backend requested (e.g. the season review), once we are back in the shell. */
function usePendingNav() {
  const want = pendingNav.value
  const id = screen.value.id
  useEffect(() => {
    if (!want || !gameState.value) return
    if (id === 'liveMatch' || id === 'preMatch' || id === 'postMatch' || id === want) return
    pendingNav.value = null
    navigate(want, undefined, { tab: true })
  }, [want, id])
}

export function App() {
  usePendingNav()
  useKeyboardShortcuts()
  useEventAutoOpen()
  useClubTint()
  let route = screen.value
  if (!gameState.value && !NO_STATE.has(route.id)) route = { id: 'title' }
  const Comp = SCREENS[route.id]
  const key = route.id + (route.params ? JSON.stringify(route.params) : '')
  const dir = navDirection.value
  const view = (
    <div class={`screen-view enter-${dir === 1 ? 'fwd' : dir === -1 ? 'back' : 'fade'}`} key={key}>
      <Comp />
    </div>
  )
  const immersive = IMMERSIVE.has(route.id) || !gameState.value
  return (
    <>
      {immersive ? <main id="main" class="immersive">{view}</main> : <Shell>{view}</Shell>}
      {gameState.value && <EventModalHost />}
      {gameState.value && <CoachTour />}
      {gameState.value && <UnlockNotifier />}
      <MatchdayConfirmHost />
      <ToastHost />
    </>
  )
}
