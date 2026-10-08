/**
 * Shared domain model. Every system (world, match, career, life, UI) codes
 * against these types. Keep them serializable (plain data, no classes) because
 * GameState is written straight to the save file.
 */
import type { RngState } from './rng'

// ───────────────────────── Basics ─────────────────────────

/** Localized text. Turkish is the source language; English is required too. */
export interface LText {
  tr: string
  en: string
}

export type Lang = 'tr' | 'en'

export type Position = 'GK' | 'CB' | 'LB' | 'RB' | 'DM' | 'CM' | 'AM' | 'LW' | 'RW' | 'ST'
export const POSITIONS: readonly Position[] = ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST']
export type Foot = 'L' | 'R' | 'B'
/** Hero (and, by extension, the generated world's players) gender. Missing = 'male' (old saves). */
export type Gender = 'male' | 'female'

export const ATTRIBUTE_KEYS = [
  // physical
  'pace', 'stamina', 'strength', 'agility', 'jumping',
  // technical
  'passing', 'shooting', 'finishing', 'dribbling', 'firstTouch', 'crossing', 'heading', 'tackling', 'setPieces',
  // mental
  'vision', 'composure', 'positioning', 'leadership', 'workRate',
  // goalkeeping (GDD: Refleks, Top Tutma, Pozisyon (kaleci), Oyun Kurma (kaleci)); new keys append at the end
  // so the per-key derivation draws of the older keys keep their order.
  'reflexes', 'handling', 'gkPositioning', 'gkDistribution',
] as const
export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number]
/** The goalkeeping group: outfielders carry them as near-floor values. */
export const GK_ATTRIBUTE_KEYS: readonly AttributeKey[] = ['reflexes', 'handling', 'gkPositioning', 'gkDistribution']
export const isGoalkeepingAttr = (k: AttributeKey): boolean => k === 'reflexes' || k === 'handling' || k === 'gkPositioning' || k === 'gkDistribution'
export type Attributes = Record<AttributeKey, number>
export type AttributeGroup = 'physical' | 'technical' | 'mental' | 'goalkeeping'

export interface Appearance {
  skin: number // index into palette
  hairStyle: number
  hairColor: number
  beard: number
  eyeColor: number
  face: number
  accessory: number
  /**
   * Which feature set the avatar uses (hair styles, beard, brows). Missing =
   * 'male', so appearances from older saves render unchanged.
   */
  gender?: Gender
}

export interface KitColors {
  primary: string // hex
  secondary: string
  pattern: 'plain' | 'stripes' | 'hoops' | 'halves' | 'sash' | 'chevron'
}

export interface CrestSpec {
  shape: 'shield' | 'circle' | 'diamond' | 'hexagon' | 'banner'
  symbol: number // index into symbol set (star, lion, eagle, ball, tower…)
  colors: [string, string, string]
  initials: string
}

// ───────────────────────── Calendar ─────────────────────────

export interface Calendar {
  season: number // year the season starts, e.g. 2026
  week: number // 0-based week of season
  day: number // 0..6 (0 = Monday)
  slot: number // 0 morning, 1 afternoon, 2 evening
}

// ───────────────────────── World ─────────────────────────

export interface Country {
  id: string // 'TR', 'EN', 'ES'...
  name: LText
  adjective: LText
  flag: [string, string, string] // simple tri-colour flag
  reputation: number // 1..100, football strength
  nameStyle: string // key into names data
}

export interface League {
  id: string
  countryId: string
  name: string
  tier: number // 1 = top
  clubIds: string[]
  promote: number
  relegate: number
}

export interface Club {
  id: string
  name: string
  shortName: string // 3 letters
  city: string
  countryId: string
  leagueId: string
  colors: KitColors
  awayColors: KitColors
  crest: CrestSpec
  reputation: number // 1..100
  /** Founding year (2.6#9); derived from the club id, absent in older saves. */
  founded?: number
  budget: number // transfer budget, in currency units
  wageBudget: number // weekly
  stadium: { name: string; capacity: number }
  formation: Formation
  style: TacticStyle
  managerName: string
  squad: string[] // NpcPlayer ids (hero is not in this list)
}

export type Formation = '4-4-2' | '4-3-3' | '4-2-3-1' | '3-5-2' | '5-3-2' | '4-1-4-1' | '3-4-3'
export type TacticStyle = 'possession' | 'counter' | 'direct' | 'pressing' | 'defensive' | 'balanced'

export type Personality = 'professional' | 'loyal' | 'ambitious' | 'party' | 'hothead' | 'quiet' | 'leader' | 'joker'

export interface SeasonStats {
  apps: number
  starts: number
  minutes: number
  goals: number
  assists: number
  shots: number
  shotsOnTarget: number
  passes: number
  passesCompleted: number
  tackles: number
  dribbles: number
  yellow: number
  red: number
  cleanSheets: number
  saves: number
  ratingSum: number // average = ratingSum / apps
  motm: number
}

export interface NpcPlayer {
  id: string
  firstName: string
  lastName: string
  nationality: string
  birthYear: number
  position: Position
  foot: Foot
  ovr: number // 1..99
  potential: number
  /** Seed for deterministic attribute derivation (see world/attributes). */
  styleSeed: number
  clubId: string | null
  value: number
  wage: number // weekly
  contractUntil: number // season year
  morale: number // 0..100
  form: number // 0..100
  personality: Personality
  appearance: Appearance
  injuredWeeks: number
  /** Matches still to sit out after a red card / yellow accumulation (WP-14). Optional for old saves. */
  suspendedMatches?: number
  stats: SeasonStats
}

export type CompetitionType = 'league' | 'cup' | 'continental' | 'international'

export interface Fixture {
  id: string
  compId: string
  round: number
  week: number
  day: number
  homeId: string // club id (or country id for international)
  awayId: string
  result: MatchResultSummary | null
}

export interface MatchResultSummary {
  home: number
  away: number
  penalties?: { home: number; away: number }
  scorers: { minute: number; playerId: string; team: 'home' | 'away'; ownGoal?: boolean; penalty?: boolean }[]
  heroRating?: number
  motmId?: string
}

export interface TableRow {
  clubId: string
  p: number
  w: number
  d: number
  l: number
  gf: number
  ga: number
  pts: number
  form: ('W' | 'D' | 'L')[]
}

export interface Competition {
  id: string
  type: CompetitionType
  name: LText
  season: number
  countryId: string | null
  leagueId: string | null
  participantIds: string[]
  fixtures: Fixture[]
  table: TableRow[] | null // leagues and group stages
  /** For knockout comps: ids still alive. */
  alive: string[] | null
  winnerId: string | null
}

export interface ClubRecords {
  titles: number
  bestFinish: { pos: number; season: number; tier: number } | null
  mostPoints: { pts: number; season: number } | null
  biggestWin: { gf: number; ga: number; opponentId: string; season: number } | null
  heaviestDefeat: { gf: number; ga: number; opponentId: string; season: number } | null
}

/** A retired star (2.6#47): kept in world.legends; some return as managers. */
export interface Legend {
  id: string
  name: string
  nationality: string
  position: Position
  /** Ability at retirement. */
  ovr: number
  retiredSeason: number
  lastClubId: string | null
  /** Club he now manages, once a legend takes a dugout job. */
  managerOf?: string
}

export interface ManagerChange { season: number; clubId: string; from: string; to: string; reason: 'sacked' | 'relegated' }

export interface World {
  countries: Record<string, Country>
  leagues: Record<string, League>
  clubs: Record<string, Club>
  players: Record<string, NpcPlayer>
  competitions: Record<string, Competition>
  /** Past champions by competition key (league id, cup key) per season. */
  honours: { season: number; compKey: string; name: LText; winnerId: string }[]
  /**
   * Gender of the generated players (follows the hero, so a female hero plays
   * in women's leagues). Missing = 'male'.
   */
  gender?: Gender
  /** Per-club all-time records (2.6#107), updated at each season end. */
  records?: Record<string, ClubRecords>
  /** Manager sackings/appointments (2.6#40), newest last. */
  managerChanges?: ManagerChange[]
  /** Retired stars, strongest first (2.6#47). */
  legends?: Legend[]
  /** Mean ability of club players when the world was first measured; keeps long careers from inflating (see sim/world/anchor.ts). */
  abilityAnchor?: number
  /** OVR quantiles of club players when first measured (0..100% in 0.5% steps); keeps the top end from stretching (sim/world/anchor.ts). */
  abilityShape?: number[]
  /** Version of the static data pack this world was made from (2.6#127). */
  dataVersion?: number
  /** Free agents are NpcPlayers with clubId null. */
}

// ───────────────────────── Hero (the user's player) ─────────────────────────

/**
 * Playing role (owner feedback after the APK play-test): every position offers its own roles, each with an
 * attribute template, a height default and a match identity (see core/roles.ts). Replaced the
 * position-agnostic archetypes in save v5.
 */
export type Role =
  // GK
  | 'reflexKeeper' | 'shotStopper' | 'sweeperKeeper'
  // LB / RB
  | 'attackingFullBack' | 'defensiveFullBack' | 'balancedFullBack'
  // CB
  | 'stopper' | 'aerialDefender' | 'ballPlayingDefender'
  // DM / CM / AM
  | 'anchor' | 'boxToBox' | 'playmaker'
  // LW / RW
  | 'touchlineWinger' | 'invertedWinger' | 'freeWinger' | 'dribbler'
  // ST
  | 'targetForward' | 'runner' | 'pivot'
export type Background = 'street' | 'academy' | 'footballFamily' | 'lateBloomer'
export type SquadRole = 'youth' | 'reserve' | 'rotation' | 'starter' | 'star' | 'captain'

export interface Contract {
  clubId: string
  wage: number // weekly
  untilSeason: number
  signingBonus: number
  goalBonus: number
  assistBonus: number
  releaseClause: number | null
  role: SquadRole
  loan?: boolean
  /** Form clause: avg rating ≥ 7.5 over the last 3 matches guarantees a start (career/squadRole). */
  formGuarantee?: boolean
  /** Injury insurance: a lump-sum payout when injured (career/condition applyInjury). */
  insurance?: boolean
  /** Playing-time guarantee: start probability floor while fit (career/squadRole). */
  minutesGuarantee?: boolean
  /** Image rights kept by the player: sponsor income +15% (life/economy). */
  imageRights?: boolean
  /** Paid per match played. */
  appearanceBonus?: number
  /** Goalkeepers: paid per save (2.3#60). */
  saveBonus?: number
  /** Paid once when the club wins promotion. */
  promotionBonus?: number
  /** Paid when the contract runs its full course at the club. */
  loyaltyBonus?: number
}

export interface Injury {
  name: LText
  weeksLeft: number
  severity: 1 | 2 | 3
}

export interface SeasonRecord {
  season: number
  clubId: string
  clubName: string
  leagueName: string
  stats: SeasonStats
  leaguePosition: number | null
  trophies: string[]
}

export interface Award {
  season: number
  key: string // 'golden_star', 'top_scorer', 'potm_month'...
  name: LText
}

/** Hero shot habits per goal-mouth third [low-y, centre, high-y] (sim/match/referee). */
export interface ShotBook {
  pen: [number, number, number]
  shot: [number, number, number]
}

export interface Hero {
  firstName: string
  lastName: string
  /** Optional for old saves; read through `heroGender()` (core/gender.ts). */
  gender?: Gender
  nickname: string
  nationality: string
  /** Birth city chosen in the wizard (optional; hometown fans and events). */
  birthCity?: string
  birthYear: number
  position: Position
  foot: Foot
  appearance: Appearance
  /** Playing role at his position (save v5; see core/roles.ts). */
  role: Role
  /** Height in cm (save v5): aerial duels and headers. Read through `heroHeight()` (core/roles.ts). */
  heightCm?: number
  background: Background
  attrs: Attributes
  /** Fractional XP accumulated toward the next point per attribute. */
  attrXp: Partial<Record<AttributeKey, number>>
  potential: number // hidden 60..99
  perkPoints: number
  perks: string[]
  form: number // 0..100 (50 neutral)
  morale: number // 0..100
  sharpness: number // match fitness 0..100
  fatigue: number // 0..100 (high = tired)
  injury: Injury | null
  suspendedMatches: number
  /**
   * Where the hero puts penalties / shots (goal-mouth thirds, faded each
   * match). Keepers study it (WP-14). Optional for old saves.
   */
  keeperBook?: ShotBook
  /** Pre-match focus for the next matches (GAP 2.1#9). Missing = balance. */
  matchFocus?: 'attack' | 'balance' | 'defend'
  contract: Contract | null
  managerTrust: number // 0..100
  reputation: number // 0..100 global fame
  shirtNumber: number
  nationalTeam: { called: boolean; caps: number; goals: number }
  seasonStats: SeasonStats
  careerStats: SeasonStats
  history: SeasonRecord[]
  trophies: { season: number; name: LText }[]
  awards: Award[]
  retired: boolean
  /** Consecutive inactive weeks (injury / no match fitness) driving skill decay (career/condition). */
  inactiveWeeks?: number
}

// ───────────────────────── Life ─────────────────────────

export type RelationKind =
  | 'mother' | 'father' | 'sibling' | 'partner' | 'bestFriend'
  | 'manager' | 'teammate' | 'agent' | 'fans' | 'press' | 'chairman'

export interface Relationship {
  id: string
  kind: RelationKind
  name: string
  /** -100..100 */
  value: number
  /** NpcPlayer id for teammates. */
  npcId?: string
  /** Recent memory lines (most recent first, max 5). */
  memory: LText[]
  lastContactWeek: number
  /** Change ledger, most recent first (see sim/life/relationships). Missing on old saves. */
  log?: RelationChange[]
  /** Hero's hand-picked "close friend" (max 3; sim/life/closeFriends). Missing on old saves. */
  closeFriend?: boolean
  /** Teammates: personality-driven resting attitude the bond drifts back to (sim/life/relationships). Missing on old saves. */
  baseline?: number
}

/** What moved a relationship: shown in the "why did this change?" panel. */
export type RelationCause =
  | 'match' | 'event' | 'activity' | 'decay' | 'interview' | 'role' | 'social' | 'casino' | 'transfer' | 'business' | 'other'

export interface RelationChange {
  /** Absolute week (career/common absWeek). */
  w: number
  /** Applied change (after clamping / diminishing returns). */
  d: number
  /** Value after the change. */
  v: number
  cause: RelationCause
  why: LText
  /** Merged entries (e.g. several weeks of neglect decay). */
  n?: number
}

export type AssetCategory =
  | 'house' | 'car' | 'watch' | 'fashion' | 'tech' | 'pet' | 'boat' | 'jet' | 'art' | 'island' | 'business' | 'facility'

export interface AssetDef {
  id: string
  category: AssetCategory
  name: LText
  price: number
  upkeep: number // weekly
  happiness: number // passive weekly happiness while owned (diminishing)
  fame: number // one-time reputation boost on purchase
  /** Optional special effect key handled by life system, e.g. 'travel_fatigue', 'recovery'. */
  effect?: { key: string; value: number }
  minReputation?: number
  /** Resale fraction after a year (art may appreciate). */
  resale: number
  icon: string
}

export interface OwnedAsset {
  defId: string
  boughtSeason: number
  boughtWeek: number
  pricePaid: number
}

/** Fixed-term deposit: locked until `maturesAt` (absolute week), pays a higher rate than savings. */
export interface TermDeposit {
  id: string
  amount: number
  /** Annual rate locked at opening. */
  rate: number
  weeks: number
  /** Absolute week (see career/common absWeek) when it pays out. */
  maturesAt: number
}

export interface Loan {
  principal: number
  remaining: number
  weeklyPayment: number
  rate: number // annual
}

export interface Investment {
  id: string
  kind: 'index' | 'startup' | 'property' | 'crypto' | 'bonds'
  name: LText
  amount: number
  value: number
}

export interface SponsorDeal {
  id: string
  brand: string
  category: 'boots' | 'watch' | 'drink' | 'fashion' | 'gaming' | 'car' | 'cosmetics' | 'food' | 'jewelry' | 'finance'
  weekly: number
  untilSeason: number
  minReputation: number
  /** Performance bonus per goal/assist contribution in a week (2.5#55); missing on old deals. */
  perfBonus?: number
}

export interface Agent {
  name: string
  quality: number // 1..5
  commission: number // fraction e.g. 0.08
}

export interface LogEntry {
  season: number
  week: number
  day: number
  text: LText
  icon?: string
  kind?: 'match' | 'event' | 'money' | 'relation' | 'career' | 'award' | 'injury'
}

export interface NewsItem {
  id: string
  season: number
  week: number
  headline: LText
  body?: LText
  source: string
  sentiment: -1 | 0 | 1
}

export interface Life {
  money: number
  bank: { savings: number; loan: Loan | null; investments: Investment[]; creditScore: number; termDeposits?: TermDeposit[] }
  assets: OwnedAsset[]
  energy: number // 0..100, daily
  happiness: number // 0..100
  health: number // 0..100
  stress: number // 0..100
  discipline: number // 0..100, how the club views your conduct
  followers: number
  relationships: Record<string, Relationship>
  agent: Agent | null
  sponsors: SponsorDeal[]
  /** Personal trainer; `quality` 1..3 (missing on old saves → treated as 2). */
  trainer: { name: string; group: AttributeGroup; weeklyFee: number; quality?: 1 | 2 | 3; /** Contract weeks remaining (2.5#11); absent on old saves = open-ended. */ weeksLeft?: number } | null
  casino: { addiction: number; won: number; lost: number; visitsThisWeek: number }
  /** Free-form flags for event chains: 'has_tattoo', 'scandal_bet', counters… */
  flags: Record<string, number | string | boolean>
  /** event id → last week index (absolute) it fired, for cooldowns. */
  eventHistory: Record<string, number>
  log: LogEntry[]
  news: NewsItem[]
  /** Businesses the hero runs (sim/life/business). Missing on old saves. */
  businesses?: Business[]
}

export type BusinessKind = 'restaurant' | 'gym' | 'clothing'

/** One week's profit & loss statement of a business. */
export interface BusinessPnl {
  /** Absolute week. */
  w: number
  revenue: number
  rent: number
  staff: number
  manager: number
  /** Stock / ingredients / production (variable cost). */
  stock: number
  /** One-off incident cost (fine, repair) or windfall (negative cost). */
  incident: number
  profit: number
  /** What happened this week, if anything. */
  note?: LText
}

export interface Business {
  id: string
  kind: BusinessKind
  name: string
  level: 1 | 2 | 3
  /** A hired general manager: steadier weeks, fewer incidents, no owner stress. */
  manager: boolean
  /** Brand reputation 0..100. */
  brand: number
  openedWeek: number
  /** Purchase + upgrades paid so far (resale basis). */
  invested: number
  totalProfit: number
  /** Last 8 weeks, most recent first. */
  history: BusinessPnl[]
  /** Temporary revenue multiplier from a decision card (marketing push, crisis); ticks down weekly. */
  boost?: { mult: number; weeks: number }
}

// ───────────────────────── Events (decision cards) ─────────────────────────

export interface PendingEvent {
  defId: string
  /** Template variables resolved when the event fired (names, amounts). */
  vars: Record<string, string | number>
  firedAt: Calendar
}

// ───────────────────────── Root state ─────────────────────────

export type Difficulty = 'easy' | 'normal' | 'hard' | 'legend'

/**
 * "Custom" difficulty (GAP 2.1#128): each assist set on its own. Stored next to
 * the base `difficulty` label (kept 'normal' for drills and other label lookups).
 */
export interface CustomDifficulty {
  /** Bullet-time aiming windows on/off. */
  bulletTime: boolean
  /** Trajectory preview arc. */
  arc: boolean
  /** Target magnet (only with the arc it maps to Full assist). */
  magnet: boolean
  /** Opponent sharpness / reaction multiplier, 0.8 (slow) … 1.3 (legend). */
  aiReaction: number
  /** Wind on/off (windy days play as calm when off). */
  wind: boolean
}

export interface Settings {
  lang: Lang
  sound: number // 0..1
  music: number
  vibration: boolean
  aimAssist: 'full' | 'half' | 'manual'
  slowMoAim: boolean
  matchSpeed: 1 | 2 | 4
  colorblind: boolean
  textScale: number
}

export interface GameState {
  version: number
  meta: {
    id: string
    slot: number
    createdAt: number
    updatedAt: number
    playTimeSec: number
    seed: number
    difficulty: Difficulty
    /** Present when the career was started on "Custom" difficulty. */
    custom?: CustomDifficulty
  }
  rng: RngState
  calendar: Calendar
  world: World
  hero: Hero
  life: Life
  pendingEvents: PendingEvent[]
  /** Fixture id of the hero's next match being played, if any. */
  activeMatchId: string | null
  /** Weekly attribute history, compacted per season (WP-V; absent before save v3). */
  attrHistory?: import('../sim/game/saveHistory').AttrHistory
  /** Last goal replays as compact input recordings (WP-V; absent before save v3). */
  replays?: import('../sim/game/saveHistory').GoalReplay[]
  /** Versioned data pack the career was last saved with (WP-V). */
  dataPack?: string
}
