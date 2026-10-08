/**
 * Local-first meta layer (GAP 2.10#8/#17/#18/#40): weekly challenges with a
 * seeded rotation, global personal bests, a local career leaderboard and a
 * career stats export. Pure functions; the UI persists {@link LocalMeta} inside
 * the global meta store (survives deleted saves). No backend: the
 * "leaderboard" is the player's own finished careers plus these bests.
 */
import type { LText } from '../../core/types'
import { Rng, hashString } from '../../core/rng'
import { lt } from '../career/common'
import type { MatchFeats } from './records'
import type { CareerSummary } from './hallOfFame'
import { eventForWeek } from './liveOps'
import type { InstalledMod } from './mods'
import type { FeedbackEntry, NotifyState } from './feedback'

export interface ChallengeDef {
  id: string
  icon: 'ball' | 'boot' | 'star' | 'trophy' | 'shield' | 'target' | 'stopwatch' | 'medal'
  title: LText
  desc: LText
  keeperOnly?: boolean
  outfieldOnly?: boolean
  test(f: MatchFeats): boolean
}

const played = (f: MatchFeats): boolean => f.minutes > 0

export const CHALLENGES: readonly ChallengeDef[] = [
  { id: 'scorer', icon: 'ball', outfieldOnly: true, title: lt('Gol zamanı', 'On the scoresheet'), desc: lt('Bu hafta bir maçta en az 1 gol at.', 'Score at least 1 goal in a match this week.'), test: (f) => f.goals >= 1 },
  { id: 'brace', icon: 'ball', outfieldOnly: true, title: lt('Duble', 'Brace'), desc: lt('Tek maçta 2 gol at.', 'Score 2 goals in a single match.'), test: (f) => f.goals >= 2 },
  { id: 'playmaker', icon: 'boot', outfieldOnly: true, title: lt('Oyun kurucu', 'Playmaker'), desc: lt('Bir maçta en az 1 asist yap.', 'Provide at least 1 assist in a match.'), test: (f) => f.assists >= 1 },
  { id: 'involved', icon: 'target', outfieldOnly: true, title: lt('Her işin içinde', 'In the thick of it'), desc: lt('Bir maçta gol ve asistin toplamı 2 olsun.', 'Reach 2 goal contributions in one match.'), test: (f) => f.goals + f.assists >= 2 },
  { id: 'motm', icon: 'star', title: lt('Maçın adamı', 'Man of the match'), desc: lt('Maçın adamı seçil.', 'Be named man of the match.'), test: (f) => played(f) && f.motm },
  { id: 'rating8', icon: 'medal', title: lt('Müthiş performans', 'Standout display'), desc: lt('Maçı 8.0 veya üzeri reytingle bitir.', 'Finish a match rated 8.0 or higher.'), test: (f) => played(f) && f.rating >= 8 },
  { id: 'steady', icon: 'medal', title: lt('İstikrar', 'Steady hand'), desc: lt('Maçı 7.0 veya üzeri reytingle bitir.', 'Finish a match rated 7.0 or higher.'), test: (f) => played(f) && f.rating >= 7 },
  { id: 'win', icon: 'trophy', title: lt('Kazanma alışkanlığı', 'Winning habit'), desc: lt('Takımınla bir maç kazan.', 'Win a match with your team.'), test: (f) => played(f) && f.won },
  { id: 'fullGame', icon: 'stopwatch', title: lt('Tam 90', 'Full ninety'), desc: lt('Bir maçı baştan sona oyna.', 'Play a full match.'), test: (f) => f.minutes >= 90 },
  { id: 'clean', icon: 'shield', title: lt('Kale kapalı', 'Clean sheet'), desc: lt('En az 60 dakika oynayıp kalende gol görme.', 'Keep a clean sheet playing at least 60 minutes.'), test: (f) => f.minutes >= 60 && f.cleanSheet },
  { id: 'giant', icon: 'trophy', title: lt('Devrilen dev', 'Giant killer'), desc: lt('Güçlü ve itibarlı bir rakibi yen.', 'Beat a high-reputation opponent.'), test: (f) => played(f) && f.won && f.opponentReputation >= 70 },
  { id: 'wall', icon: 'shield', keeperOnly: true, title: lt('Duvar', 'The wall'), desc: lt('Bir maçta 4 veya daha fazla kurtarış yap.', 'Make 4 or more saves in a match.'), test: (f) => f.saves >= 4 },
]

const poolFor = (keeper: boolean): ChallengeDef[] => CHALLENGES.filter((c) => (keeper ? !c.outfieldOnly : !c.keeperOnly))

/** Deterministic weekly challenge: a seeded shuffle of the pool per block of weeks, indexed by week. */
export function challengeFor(season: number, week: number, keeper: boolean): ChallengeDef {
  const pool = poolFor(keeper)
  const block = Math.floor(week / pool.length)
  const order = new Rng(hashString(`wk|${season}|${block}|${keeper ? 'k' : 'o'}`)).shuffle([...pool])
  return order[week % pool.length]!
}

export interface ChallengeDone {
  id: string
  rating: number
  opponent: string
}

export interface PersonalBests {
  bestRating: number
  goalsMatch: number
  assistsMatch: number
  biggestWin: number
  matches: number
}

/** One side of a weekly-challenge attempt (2.10#19). */
export interface AttemptSide {
  rating: number
  opponent: string
  passed: boolean
}

/** Every eligible match of a week is an attempt: the first one and the best one are kept (unlimited retries). */
export interface AttemptRecord {
  count: number
  first: AttemptSide
  best: AttemptSide
}

export interface LocalMeta {
  /** "season:week" to completion. */
  challenges: Record<string, ChallengeDone>
  streak: number
  bestStreak: number
  /** Last "season:week" a challenge was completed for (streak continuity). */
  lastKey: string
  bests: PersonalBests
  /** Hero match fixture ids already counted (idempotent evaluation). */
  seen: string[]
  /** App version whose What's New the player has seen. */
  seenVersion: string
  /** "season:week" to the attempts at that week's challenge (first-attempt and best-attempt tables). */
  attempts: Record<string, AttemptRecord>
  /** Season-event stamps, "season:eventId" to challenges completed during the event. */
  stamps: Record<string, number>
  /** Career ids retired while a data mod was active: they rank in the Modded table only. */
  moddedCareers: string[]
  /** Imported data mods (validated, data only). */
  mods: InstalledMod[]
  /** Master switch for anything that could touch the network. Off by default; nothing here needs it. */
  online: boolean
  notify: NotifyState
  /** Locally saved feedback / bug reports (never sent anywhere). */
  feedback: FeedbackEntry[]
}

export const emptyLocalMeta = (): LocalMeta => ({
  challenges: {},
  streak: 0,
  bestStreak: 0,
  lastKey: '',
  bests: { bestRating: 0, goalsMatch: 0, assistsMatch: 0, biggestWin: 0, matches: 0 },
  seen: [],
  seenVersion: '',
  attempts: {},
  stamps: {},
  moddedCareers: [],
  mods: [],
  online: false,
  notify: 'unasked',
  feedback: [],
})

export const weekKey = (season: number, week: number): string => `${season}:${week}`
const absWeek = (season: number, week: number): number => season * 100 + week

export interface MatchMetaResult {
  completed: ChallengeDef | null
  newBests: (keyof PersonalBests)[]
}

/** Fold one hero match into the local meta. Mutates `m`. Idempotent per fixture. */
export function applyMatch(m: LocalMeta, f: MatchFeats): MatchMetaResult {
  const res: MatchMetaResult = { completed: null, newBests: [] }
  if (m.seen.includes(f.fixtureId)) return res
  m.seen = [...m.seen.slice(-60), f.fixtureId]
  m.bests.matches += 1
  const b = m.bests
  const rating = Math.round(f.rating * 10) / 10
  // The very first value is a baseline, not a "new best" worth announcing.
  const first = b.matches === 1
  if (f.minutes > 0 && rating > b.bestRating) { b.bestRating = rating; if (!first) res.newBests.push('bestRating') }
  if (f.goals > b.goalsMatch) { b.goalsMatch = f.goals; if (!first) res.newBests.push('goalsMatch') }
  if (f.assists > b.assistsMatch) { b.assistsMatch = f.assists; if (!first) res.newBests.push('assistsMatch') }
  const margin = f.goalsFor - f.goalsAgainst
  if (f.won && margin > b.biggestWin) { b.biggestWin = margin; if (!first) res.newBests.push('biggestWin') }

  const key = weekKey(f.season, f.week)
  const def = challengeFor(f.season, f.week, f.isKeeper)
  if (f.minutes > 0) {
    const side: AttemptSide = { rating, opponent: f.opponent, passed: def.test(f) }
    const a = m.attempts[key]
    if (!a) m.attempts[key] = { count: 1, first: side, best: side }
    else {
      a.count += 1
      // The best attempt is a passed one first, then the higher rating.
      if (Number(side.passed) > Number(a.best.passed) || (side.passed === a.best.passed && side.rating > a.best.rating)) a.best = side
    }
  }
  if (!m.challenges[key] && def.test(f)) {
    const ev = eventForWeek(f.season, f.week)
    if (ev) m.stamps[`${f.season}:${ev.id}`] = (m.stamps[`${f.season}:${ev.id}`] ?? 0) + 1
    m.challenges[key] = { id: def.id, rating, opponent: f.opponent }
    const prev = m.lastKey ? m.lastKey.split(':').map(Number) : null
    const consecutive = prev !== null && absWeek(f.season, f.week) - absWeek(prev[0]!, prev[1]!) <= 1
    m.streak = consecutive ? m.streak + 1 : 1
    m.bestStreak = Math.max(m.bestStreak, m.streak)
    m.lastKey = key
    res.completed = def
  }
  return res
}

export const totalCompleted = (m: LocalMeta): number => Object.keys(m.challenges).length

// ───────────────────────── Local leaderboard ─────────────────────────

export type BoardMetric = 'legacy' | 'goals' | 'assists' | 'apps' | 'trophies' | 'rating'

export const boardValue = (e: CareerSummary, metric: BoardMetric): number => {
  switch (metric) {
    case 'legacy': return e.legacyScore
    case 'goals': return e.totals.goals
    case 'assists': return e.totals.assists
    case 'apps': return e.totals.apps
    case 'trophies': return e.trophies.length
    case 'rating': return e.totals.avgRating
  }
}

export type BoardTier = 'official' | 'modded'

/** Official table = careers played without data mods; modded careers get their own table (2.10#15). */
export function localBoard(entries: readonly CareerSummary[], metric: BoardMetric, tier?: BoardTier, moddedIds: readonly string[] = []): CareerSummary[] {
  const pool = tier ? entries.filter((e) => moddedIds.includes(e.careerId) === (tier === 'modded')) : entries
  return [...pool].sort((a, b) => boardValue(b, metric) - boardValue(a, metric) || b.legacyScore - a.legacyScore)
}

// ───────────────────────── Career stats export ─────────────────────────

const csvCell = (v: string | number): string => {
  const s = String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Season-by-season CSV of a career (header + one row per season). */
export function careerCsv(sum: CareerSummary, lang: 'tr' | 'en'): string {
  const head = lang === 'tr'
    ? ['Sezon', 'Kulüp', 'Lig', 'Maç', 'Gol', 'Asist', 'Ort. reyting', 'Lig sırası', 'Kupalar']
    : ['Season', 'Club', 'League', 'Apps', 'Goals', 'Assists', 'Avg rating', 'League position', 'Trophies']
  const rows = sum.timeline.map((r) => [r.season, r.clubName, r.leagueName, r.apps, r.goals, r.assists, r.avgRating.toFixed(2), r.leaguePosition ?? '', r.trophies.join(' | ')])
  return [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n'
}

/** Data for the career share card (drawn by ui/share). */
export interface CareerCardData {
  name: string
  subtitle: string
  kpis: { label: LText; value: string }[]
  score: number
}

export function careerCardData(sum: CareerSummary): CareerCardData {
  return {
    name: sum.name,
    subtitle: `${sum.position} · ${sum.startSeason}-${sum.endSeason} · ${sum.clubs.slice(0, 3).join(' → ')}`,
    kpis: [
      { label: lt('Maç', 'Apps'), value: String(sum.totals.apps) },
      { label: lt('Gol', 'Goals'), value: String(sum.totals.goals) },
      { label: lt('Asist', 'Assists'), value: String(sum.totals.assists) },
      { label: lt('Kupa', 'Trophies'), value: String(sum.trophies.length) },
    ],
    score: sum.legacyScore,
  }
}
