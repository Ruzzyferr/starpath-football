/**
 * UI store — the ONLY bridge between screens and the game backend.
 *
 * Screens read `gameState`, the view-model queries in `data`, and call
 * `actions.*` to mutate. Nothing in ui/** imports sim/** directly. During UI
 * development a mock backend (ui/dev/mockActions.ts) is installed; the lead
 * swaps it for the real one with `installBackend({ actions, data })`.
 *
 * Contract for implementers:
 *  - Mutating actions must replace `gameState.value` with a NEW object (or
 *    call `touch()`), so signal subscribers re-render.
 *  - Query functions in `data` should read `gameState.value` so they are
 *    reactive when called during render.
 */
import { signal, computed, effect } from '@preact/signals'
import type {
  AssetDef, AttributeGroup, AttributeKey, CrestSpec, Difficulty, Foot, Formation, GameState,
  KitColors, Lang, LText, MatchResultSummary, NewsItem, NpcPlayer, Position, Settings, SponsorDeal,
  SquadRole, Appearance, Archetype, Background, Investment, Country,
} from '../core/types'
import { currentLang } from '../i18n'

// ───────────────────────── Shared view types ─────────────────────────

/** Anything a choice/activity can change. Attribute keys are allowed too. */
export type StatKey =
  | 'money' | 'energy' | 'happiness' | 'health' | 'stress' | 'discipline' | 'reputation'
  | 'followers' | 'form' | 'morale' | 'fatigue' | 'sharpness' | 'managerTrust' | 'xp'
  | 'relation' | 'addiction' | 'perkPoints'
  | AttributeKey

export interface Delta {
  key: StatKey
  value: number
  /** Override label (e.g. a relationship's name for key 'relation'). */
  label?: LText | string
  /** Shown as "?" — outcome not guaranteed. */
  uncertain?: boolean
}

export type Risk = 'safe' | 'low' | 'medium' | 'high'

export interface TeamView {
  id: string
  name: string
  shortName: string
  crest: CrestSpec
  kit: KitColors
  reputation?: number
}

export interface FixtureView {
  fixtureId: string
  compName: LText
  compType: 'league' | 'cup' | 'continental' | 'international' | 'friendly'
  home: TeamView
  away: TeamView
  week: number
  day: number
  isHome: boolean
  venue: string
  /** Days from today until kickoff (0 = today). */
  daysUntil: number
  result: MatchResultSummary | null
}

// Activities / planner ------------------------------------------------------
export type ActivityCategory =
  | 'training' | 'rest' | 'social' | 'family' | 'media' | 'business' | 'shopping'
  | 'nightlife' | 'charity' | 'casino'

export interface ActivityView {
  id: string
  category: ActivityCategory
  name: LText
  desc: LText
  icon: string // IconName from ui/icons
  slots: 1 | 2
  energy: number // energy cost (positive = spends)
  cost: number // money cost
  effects: Delta[]
  available: boolean
  lockedReason?: LText
  risk?: Risk
}

export type SlotState = 'done' | 'current' | 'upcoming' | 'match' | 'blocked'
export interface DaySlotView {
  slot: 0 | 1 | 2
  state: SlotState
  activityId: string | null
}
export interface DayPlanView {
  slots: DaySlotView[]
  energyBudget: number // energy available now
  projectedEnergy: number // after planned activities
}

// Events --------------------------------------------------------------------
export type EventCategory =
  | 'team' | 'family' | 'love' | 'press' | 'social' | 'fans' | 'nightlife' | 'charity'
  | 'business' | 'scam' | 'health' | 'legal' | 'national' | 'rival' | 'transfer' | 'awards'

export interface EventChoiceView {
  label: LText
  risk: Risk
  requirement?: { text: LText; met: boolean }
  preview: Delta[]
}
export interface EventView {
  index: number
  defId: string
  category: EventCategory
  title: LText
  body: LText
  /** Optional person shown on the card. */
  person?: { name: string; appearance?: Appearance; role?: LText }
  choices: EventChoiceView[]
}
export interface EventOutcomeView {
  text: LText
  deltas: Delta[]
  success: boolean
}

// Training / perks ----------------------------------------------------------
export interface TrainingSessionView {
  id: string
  name: LText
  desc: LText
  group: AttributeGroup | 'recovery' | 'tactical'
  icon: string
  energy: number
  focus: AttributeKey[]
  /** Expected XP per focused attribute. */
  xp: number
  injuryRisk: Risk
}
export interface PerkView {
  id: string
  name: LText
  desc: LText
  icon: string
  row: number // tier (0 = root)
  col: number
  requires: string[]
  cost: number
  owned: boolean
  available: boolean
}
export interface TrainerOffer {
  id: string
  name: string
  group: AttributeGroup
  quality: number // 1..5
  weeklyFee: number
  bonus: number // fraction, 0.25 = +25% XP
}

// Club / world --------------------------------------------------------------
export interface SquadMemberView {
  player: NpcPlayer
  /** Relationship with hero, -100..100 (null if unknown). */
  relation: number | null
  relationId: string | null
}
export interface InterestView {
  club: TeamView
  level: number // 0..100
  note: LText
  leagueName: string
}
export interface ScorerRow {
  playerId: string
  name: string
  clubId: string
  goals: number
  assists: number
  isHero: boolean
}

// Contract negotiation -----------------------------------------------------
export interface OfferTerms {
  wage: number
  years: number
  signingBonus: number
  goalBonus: number
  releaseClause: number | null
  role: SquadRole
}
export interface NegotiationView {
  club: TeamView
  kind: 'renewal' | 'transfer' | 'loan'
  clubOffer: OfferTerms
  ranges: {
    wage: [number, number]
    years: [number, number]
    signingBonus: [number, number]
    goalBonus: [number, number]
    releaseClause: [number, number]
  }
  patience: number // 0..100
  round: number
  maxRounds: number
  agentLine: LText
  /** Agent's private estimate of the club's walk-away wage. */
  agentEstimate: number | null
  status: 'open' | 'accepted' | 'rejected' | 'walkedAway'
  lastResponse: LText | null
}

// Life ----------------------------------------------------------------------
export type InteractionKind = 'call' | 'dinner' | 'gift' | 'train' | 'party' | 'holiday' | 'apologize'
export type PostKind = 'training' | 'luxury' | 'family' | 'charity' | 'provocative' | 'fans'
export interface SocialPostView {
  id: string
  author: string
  handle: string
  isHero: boolean
  text: LText
  likes: number
  comments: number
  weekAgo: number
  kind: PostKind | 'fan' | 'press' | 'hater' | 'brand'
  verified?: boolean
}
export type InvestKind = Investment['kind']

// Casino --------------------------------------------------------------------
export type Suit = 'S' | 'H' | 'D' | 'C'
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'
export interface CardView {
  rank: Rank
  suit: Suit
  faceDown?: boolean
}
export interface BlackjackView {
  bet: number
  player: CardView[]
  dealer: CardView[]
  playerTotal: number
  dealerTotal: number | null // null while hole card hidden
  phase: 'player' | 'done'
  result: 'win' | 'lose' | 'push' | 'blackjack' | 'bust' | null
  payout: number // net change to money
  canDouble: boolean
}
export type RouletteBetKind = 'number' | 'red' | 'black' | 'odd' | 'even' | 'low' | 'high' | 'dozen'
export interface RouletteBet {
  kind: RouletteBetKind
  value?: number // number 0..36, dozen 1..3
  amount: number
}
export interface RouletteResult {
  number: number
  color: 'red' | 'black' | 'green'
  net: number
}
export interface SlotsResult {
  reels: number[] // 3 symbol indices (see SLOT_SYMBOLS in screens)
  net: number
  winLine: boolean
}
export interface HorseView {
  index: number
  name: string
  odds: number // decimal odds e.g. 4.5
  color: string
  form: string // e.g. "1-3-2"
}
export interface HorseRaceResult {
  /** frames × 8 progress values in 0..1 (1 = finish line). ~60 frames. */
  timeline: number[][]
  order: number[] // finishing order (horse indices)
  net: number
}
export interface CasinoStatus {
  addiction: number
  won: number
  lost: number
  visitsThisWeek: number
  minBet: number
  maxBet: number
}

// Match ---------------------------------------------------------------------
export type Weather = 'clear' | 'rain' | 'snow' | 'wind' | 'hot'
export type MatchEventType =
  | 'kickoff' | 'goal' | 'shot' | 'save' | 'miss' | 'woodwork' | 'chance'
  | 'yellow' | 'red' | 'injury' | 'sub' | 'halftime' | 'fulltime'
  | 'corner' | 'freekick' | 'penalty' | 'offside' | 'commentary' | 'highlight'
  | 'extratime' | 'shootout'

export interface LineupPlayer {
  id: string
  name: string
  number: number
  position: Position
  ovr: number
  isHero: boolean
  /**
   * Team-relative formation coords: x 0 = own goal line → 1 = halfway line,
   * y 0 = left touchline → 1 = right (as seen attacking). Screens mirror the away side.
   */
  x: number
  y: number
}
export interface PreMatchView {
  fixture: FixtureView
  weather: Weather
  importance: number // 0..1
  homeFormation: Formation
  awayFormation: Formation
  homeLineup: LineupPlayer[]
  awayLineup: LineupPlayer[]
  opponentForm: ('W' | 'D' | 'L')[]
  opponentKeyPlayer: { name: string; position: Position; ovr: number } | null
  tacticHint: LText
  heroStarting: boolean
  odds: { home: number; draw: number; away: number }
}
export interface MatchEventView {
  minute: number
  type: MatchEventType
  side: 'home' | 'away' | null
  text: string
  score: [number, number]
  isHero?: boolean
}
export interface HeroMatchStatsView {
  minutes: number
  goals: number
  assists: number
  shots: number
  shotsOnTarget: number
  passes: number
  passesCompleted: number
  tackles: number
  dribbles: number
  saves: number
  rating: number
}
export interface MomentView {
  id: string
  minute: number
  kind: string // HighlightKind
  prompt: string
}
export interface LiveMatchView {
  fixture: FixtureView
  minute: number
  score: [number, number]
  possession: [number, number]
  shots: [number, number]
  shotsOnTarget: [number, number]
  events: MatchEventView[]
  ballX: number // 0..1 along pitch (home attacks +x)
  ballY: number // 0..1 across
  phase: 'first' | 'second' | 'extra' | 'shootout' | 'done'
  heroOnPitch: boolean
  heroSide: 'home' | 'away'
  heroStats: HeroMatchStatsView
  pendingMoment: MomentView | null
  /** True while the Phaser scene owns the screen for a moment. */
  momentActive: boolean
  speed: 1 | 2 | 4
  paused: boolean
  finished: boolean
}
export interface InterviewOption {
  id: string
  tone: 'humble' | 'bold' | 'critical' | 'deflect'
  label: LText
  preview: Delta[]
}
export interface PostMatchView {
  fixture: FixtureView
  score: [number, number]
  heroSide: 'home' | 'away'
  rating: number
  stats: HeroMatchStatsView
  team: { possession: [number, number]; shots: [number, number]; shotsOnTarget: [number, number]; corners: [number, number]; fouls: [number, number] }
  motm: { name: string; isHero: boolean; rating: number; appearance?: Appearance }
  scorers: { minute: number; name: string; side: 'home' | 'away' }[]
  interview: { question: LText; options: InterviewOption[] } | null
  deltas: Delta[]
}

// Season / saves ------------------------------------------------------------
export interface SeasonSummaryView {
  season: number
  club: TeamView
  leaguePosition: number
  leagueName: string
  stats: { apps: number; goals: number; assists: number; avgRating: number; motm: number }
  trophies: LText[]
  awards: { key: string; name: LText; won: boolean }[]
  ovrStart: number
  ovrEnd: number
  moneyEarned: number
  followersGained: number
  highlights: LText[]
}
export interface SaveSlotInfo {
  slot: number
  empty: boolean
  heroName?: string
  clubName?: string
  crest?: CrestSpec
  season?: number
  week?: number
  ovr?: number
  money?: number
  updatedAt?: number
  playTimeSec?: number
}

// New career ----------------------------------------------------------------
export interface NewGameInput {
  firstName: string
  lastName: string
  nickname: string
  nationality: string // country id
  birthYear: number
  position: Position
  foot: Foot
  archetype: Archetype
  background: Background
  appearance: Appearance
  difficulty: Difficulty
  seed?: number
}

// ───────────────────────── Backend interfaces ─────────────────────────

export interface CasinoActions {
  blackjackDeal(bet: number): BlackjackView
  blackjackHit(): BlackjackView
  blackjackStand(): BlackjackView
  blackjackDouble(): BlackjackView
  rouletteSpin(bets: RouletteBet[]): RouletteResult
  slotsSpin(bet: number): SlotsResult
  horseRace(bet: number, horse: number): HorseRaceResult
}

export interface GameActions {
  // lifecycle
  newGame(input: NewGameInput): void
  save(slot?: number): Promise<void>
  load(slot: number): Promise<boolean>
  deleteSave(slot: number): Promise<void>
  exportSave(slot: number): Promise<string>
  importSave(json: string, slot: number): Promise<boolean>
  resetAll(): Promise<void>

  // calendar & planner
  planSlot(slot: 0 | 1 | 2, activityId: string | null): void
  doActivity(id: string): Delta[]
  /** Execute the current slot (planned activity or rest) and move time forward. */
  advance(): void
  /** Auto-play planned routine until the next match day. */
  advanceToMatch(): void

  // events
  resolveEvent(index: number, choice: number): EventOutcomeView

  // training
  train(sessionId: string): Delta[]
  unlockPerk(perkId: string): boolean
  hireTrainer(offerId: string): void
  fireTrainer(): void

  // life
  interact(relationshipId: string, kind: InteractionKind): Delta[]
  buy(assetId: string): boolean
  sell(assetIndex: number): number
  bankDeposit(amount: number): void
  bankWithdraw(amount: number): void
  takeLoan(amount: number, weeks: number): boolean
  repayLoan(amount: number): void
  invest(kind: InvestKind, amount: number): void
  divest(investmentId: string): number
  post(kind: PostKind): SocialPostView
  acceptSponsor(id: string): void
  declineSponsor(id: string): void
  hireAgent(quality: number): void
  casino: CasinoActions

  // contract
  openNegotiation(clubId: string): void
  proposeTerms(terms: OfferTerms): void
  acceptOffer(): void
  walkAway(): void
  requestTransfer(): void

  // match
  playMatch(): void
  matchSetSpeed(speed: 1 | 2 | 4): void
  matchPause(paused: boolean): void
  /** Let the sim resolve the pending moment. */
  simMoment(): void
  /** Hand the pending moment to the Phaser scene (#match-canvas). */
  playMoment(): void
  matchSimToEnd(): void
  answerInterview(optionId: string): Delta[]
  finishMatch(): void

  // season
  continueSeason(): void
}

export interface GameData {
  /** Available even before a career exists (new-career wizard). */
  countries(): Country[]
  heroOvr(): number
  heroAge(): number
  ovrHistory(): number[]
  formHistory(): number[] // last 10 match ratings
  activities(): ActivityView[]
  dayPlan(): DayPlanView
  eventView(index: number): EventView | null
  nextFixture(): FixtureView | null
  fixtures(): FixtureView[] // hero club, whole season
  preMatch(): PreMatchView | null
  postMatch(): PostMatchView | null
  trainingSessions(): TrainingSessionView[]
  perks(): PerkView[]
  trainerOffers(): TrainerOffer[]
  assetCatalog(): AssetDef[]
  squad(): SquadMemberView[]
  interest(): InterestView[]
  transferNews(): NewsItem[]
  topScorers(leagueId: string): ScorerRow[]
  socialFeed(): SocialPostView[]
  followerHistory(): number[]
  sponsorOffers(): SponsorDeal[]
  investmentHistory(id: string): number[]
  netWorthHistory(): number[]
  casinoStatus(): CasinoStatus
  horses(): HorseView[]
  seasonSummary(): SeasonSummaryView | null
  saveSlots(): SaveSlotInfo[]
  team(clubId: string): TeamView | null
}

// ───────────────────────── Signals ─────────────────────────

export const gameState = signal<GameState | null>(null)
/** Bump to force re-render after in-place mutation. */
export const stateVersion = signal(0)
export function touch(): void {
  stateVersion.value++
  const s = gameState.value
  if (s) gameState.value = { ...s }
}

export const match = signal<LiveMatchView | null>(null)
export const negotiation = signal<NegotiationView | null>(null)
export const blackjack = signal<BlackjackView | null>(null)

// Routing --------------------------------------------------------------------
export type ScreenId =
  | 'title' | 'newCareer' | 'home' | 'planner' | 'training' | 'profile' | 'club' | 'world'
  | 'contract' | 'life' | 'casino' | 'blackjack' | 'roulette' | 'slots' | 'horses'
  | 'preMatch' | 'liveMatch' | 'postMatch' | 'seasonEnd' | 'trophies' | 'inbox' | 'careerLog'
  | 'settings' | 'saves' | 'credits' | 'menu'

export interface Route {
  id: ScreenId
  params?: Record<string, string | number>
}

export const screen = signal<Route>({ id: 'title' })
const history: Route[] = []
/** +1 forward, -1 back, 0 replace/tab switch (used for transitions). */
export const navDirection = signal<1 | -1 | 0>(0)

export function navigate(id: ScreenId, params?: Route['params'], opts?: { replace?: boolean; tab?: boolean }): void {
  const next: Route = { id, params }
  if (opts?.tab) {
    history.length = 0
    navDirection.value = 0
  } else if (opts?.replace) {
    navDirection.value = 0
  } else {
    history.push(screen.value)
    if (history.length > 30) history.shift()
    navDirection.value = 1
  }
  screen.value = next
}
export function back(fallback: ScreenId = 'home'): void {
  const prev = history.pop()
  navDirection.value = -1
  screen.value = prev ?? { id: fallback }
}
export function canGoBack(): boolean {
  return history.length > 0
}

/** Index of the event currently shown in the decision modal (null = closed). */
export const activeEvent = signal<number | null>(null)

// Settings --------------------------------------------------------------------
export interface UiSettings extends Settings {
  reducedMotion: boolean
  highContrast: boolean
  lowFx: boolean
}

export const DEFAULT_SETTINGS: UiSettings = {
  lang: 'tr',
  sound: 0.8,
  music: 0.6,
  vibration: true,
  aimAssist: 'half',
  slowMoAim: true,
  matchSpeed: 1,
  colorblind: false,
  textScale: 1,
  reducedMotion: false,
  highContrast: false,
  lowFx: false,
}

const SETTINGS_KEY = 'starpath.settings.v1'
function loadSettings(): UiSettings {
  try {
    const raw = globalThis.localStorage?.getItem(SETTINGS_KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<UiSettings>) }
  } catch {
    /* storage unavailable */
  }
  return { ...DEFAULT_SETTINGS }
}
export const settings = signal<UiSettings>(loadSettings())
currentLang.value = settings.value.lang
export function updateSettings(patch: Partial<UiSettings>): void {
  settings.value = { ...settings.value, ...patch }
  currentLang.value = settings.value.lang
  try {
    globalThis.localStorage?.setItem(SETTINGS_KEY, JSON.stringify(settings.value))
  } catch {
    /* ignore */
  }
}
export const lang = computed<Lang>(() => settings.value.lang)

/** Reflect settings onto <html> data attributes (browser only). */
export function bindSettingsToDocument(): () => void {
  return effect(() => {
    const s = settings.value
    currentLang.value = s.lang
    const root = globalThis.document?.documentElement
    if (!root) return
    root.lang = s.lang
    root.dataset.colorblind = String(s.colorblind)
    root.dataset.contrast = s.highContrast ? 'high' : 'normal'
    root.dataset.motion = s.reducedMotion ? 'reduced' : 'full'
    root.dataset.fx = s.lowFx ? 'low' : 'full'
    root.style.setProperty('--text-scale', String(s.textScale))
  })
}

// Backend --------------------------------------------------------------------
let _actions: GameActions | null = null
let _data: GameData | null = null

function missing(): never {
  throw new Error('StarPath UI: no backend installed. Call installBackend() before rendering.')
}

/** Screens call `actions.newGame(...)` etc. Delegates to the installed backend. */
export const actions: GameActions = new Proxy({} as GameActions, {
  get(_t, prop: string) {
    const a = _actions ?? missing()
    return (a as unknown as Record<string, unknown>)[prop]
  },
})
export const data: GameData = new Proxy({} as GameData, {
  get(_t, prop: string) {
    const d = _data ?? missing()
    return (d as unknown as Record<string, unknown>)[prop]
  },
})

export function installBackend(backend: { actions: GameActions; data: GameData }): void {
  _actions = backend.actions
  _data = backend.data
}

// Convenience selectors --------------------------------------------------------
export const hero = computed(() => gameState.value?.hero ?? null)
export const life = computed(() => gameState.value?.life ?? null)
export const heroClub = computed(() => {
  const s = gameState.value
  const id = s?.hero.contract?.clubId
  return s && id ? (s.world.clubs[id] ?? null) : null
})
export const unreadCount = computed(() => gameState.value?.pendingEvents.length ?? 0)

/** Expose for debugging in dev tools. */
export type { GameState }
