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
  // goalkeeping
  'reflexes', 'handling',
] as const
export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number]
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
  /** Free agents are NpcPlayers with clubId null. */
}

// ───────────────────────── Hero (the user's player) ─────────────────────────

export type Archetype = 'poacher' | 'playmaker' | 'winger' | 'wall' | 'boxToBox' | 'keeper'
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

export interface Hero {
  firstName: string
  lastName: string
  /** Optional for old saves; read through `heroGender()` (core/gender.ts). */
  gender?: Gender
  nickname: string
  nationality: string
  birthYear: number
  position: Position
  foot: Foot
  appearance: Appearance
  archetype: Archetype
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
  category: 'boots' | 'watch' | 'drink' | 'fashion' | 'gaming' | 'car'
  weekly: number
  untilSeason: number
  minReputation: number
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
  bank: { savings: number; loan: Loan | null; investments: Investment[]; creditScore: number }
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
  trainer: { name: string; group: AttributeGroup; weeklyFee: number; quality?: 1 | 2 | 3 } | null
  casino: { addiction: number; won: number; lost: number; visitsThisWeek: number }
  /** Free-form flags for event chains: 'has_tattoo', 'scandal_bet', counters… */
  flags: Record<string, number | string | boolean>
  /** event id → last week index (absolute) it fired, for cooldowns. */
  eventHistory: Record<string, number>
  log: LogEntry[]
  news: NewsItem[]
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
  }
  rng: RngState
  calendar: Calendar
  world: World
  hero: Hero
  life: Life
  pendingEvents: PendingEvent[]
  /** Fixture id of the hero's next match being played, if any. */
  activeMatchId: string | null
}
