/**
 * Referees, discipline and the keepers' "book" on the hero (WP-14).
 *
 * - A referee has a strictness 1..5 (1 lenient … 5 card-happy) and an
 *   advantage tendency 0..1 (how readily he lets play run on after a foul).
 *   Strictness 3 is neutral: every multiplier is exactly 1, so a match without
 *   a referee behaves as before.
 * - Red cards carry a reason; the ban is 1..3 matches (see {@link banMatches}).
 *   Five yellows in a season cost one match.
 * - The {@link ShotBook} counts where the hero puts penalties and shots
 *   (goal-mouth thirds). Keepers read it: a clear habit makes them lean / dive
 *   that way, and the scene shows the tell-tale.
 *
 * Pure functions only: no RNG here, so callers decide which stream to use.
 */
import { hashString } from '../../core/rng'
import type { ShotBook } from '../../core/types'

export type { ShotBook } from '../../core/types'

/** 1 lenient · 2 relaxed · 3 balanced · 4 strict · 5 card-happy. */
export type Strictness = 1 | 2 | 3 | 4 | 5

export interface Referee {
  name: string
  strictness: Strictness
  /** 0..1: willingness to play advantage instead of blowing straight away. */
  advantage: number
}

/** What a highlight needs to know about the referee. */
export interface RefereeBrief {
  strictness: Strictness
  advantage: number
}

/** i18n key suffix per strictness (match.ref.style.<key>). */
export const REFEREE_STYLE: Record<Strictness, 'lenient' | 'relaxed' | 'balanced' | 'strict' | 'cardHappy'> = {
  1: 'lenient',
  2: 'relaxed',
  3: 'balanced',
  4: 'strict',
  5: 'cardHappy',
}

export const clampStrictness = (n: number): Strictness => Math.max(1, Math.min(5, Math.round(n))) as Strictness

/** Fouls given per foul-worthy challenge in the minute sim (strictness 3 → 1). */
export function refFoulMult(s: number | undefined): number {
  return s === undefined ? 1 : 0.8 + (clampStrictness(s) - 1) * 0.1
}

/** Card probability multiplier (strictness 3 → 1). */
export function refCardMult(s: number | undefined): number {
  return s === undefined ? 1 : ([0.6, 0.8, 1, 1.25, 1.55] as const)[clampStrictness(s) - 1]
}

/** Foul odds multiplier for challenges in a highlight (a strict referee whistles more 50/50s). */
export function refHighlightFoulMult(s: number | undefined): number {
  return s === undefined ? 1 : 0.75 + (clampStrictness(s) - 1) * 0.125
}

/** Why a player was sent off. */
export type RedReason = 'secondYellow' | 'dogso' | 'serious' | 'violent'

/**
 * Matches banned for a red card: second yellow / denying a goal-scoring
 * opportunity 1, serious foul play 2 (3 under a strictness-5 referee's
 * report), violent conduct 3. Always 1..3.
 */
export function banMatches(reason: RedReason, strictness?: number): 1 | 2 | 3 {
  switch (reason) {
    case 'secondYellow':
    case 'dogso':
      return 1
    case 'serious':
      return strictness !== undefined && clampStrictness(strictness) >= 5 ? 3 : 2
    case 'violent':
      return 3
  }
}

/** Yellow cards in a season that trigger a one-match ban (every 5th). */
export const YELLOW_BAN_EVERY = 5

/** True when the season's yellow count just reached a ban threshold. */
export function yellowAccumulationBan(seasonYellows: number): boolean {
  return seasonYellows > 0 && seasonYellows % YELLOW_BAN_EVERY === 0
}

/**
 * Deterministic red-card reason for a background (minute-sim) dismissal,
 * without touching the match RNG: 60% denying an opportunity, 30% serious
 * foul play, 10% violent conduct.
 */
export function backgroundRedReason(key: string): RedReason {
  const r = (hashString(key) % 1000) / 1000
  return r < 0.6 ? 'dogso' : r < 0.9 ? 'serious' : 'violent'
}

// ───────────────────────── Keeper's book ─────────────────────────

/** Goal-mouth third of a shot target: 0 = low-y post, 1 = centre, 2 = high-y post. */
export type GoalZone = 0 | 1 | 2

/** Half-width of the "down the middle" band (m). */
export const CENTRE_BAND = 1.2

export function goalZoneOf(y: number, centreY = 34): GoalZone {
  return y < centreY - CENTRE_BAND ? 0 : y > centreY + CENTRE_BAND ? 2 : 1
}

export const emptyBook = (): ShotBook => ({ pen: [0, 0, 0], shot: [0, 0, 0] })

export function copyBook(b: ShotBook | undefined): ShotBook {
  return b ? { pen: [b.pen[0], b.pen[1], b.pen[2]], shot: [b.shot[0], b.shot[1], b.shot[2]] } : emptyBook()
}

/** Records one hero attempt (mutates). */
export function noteShot(b: ShotBook, zone: GoalZone, penalty: boolean): void {
  const row = penalty ? b.pen : b.shot
  row[zone] = Math.round((row[zone] + 1) * 100) / 100
}

/** Fades old habits (call once per match). */
export function fadeBook(b: ShotBook, f = 0.92): ShotBook {
  const r = (v: number) => Math.round(v * f * 100) / 100
  return { pen: [r(b.pen[0]), r(b.pen[1]), r(b.pen[2])], shot: [r(b.shot[0]), r(b.shot[1]), r(b.shot[2])] }
}

/** Minimum attempts before a keeper trusts the book. */
export const BOOK_MIN_SAMPLES = 2
/** Minimum share of the favourite zone for a habit to count. */
export const BOOK_MIN_SHARE = 0.55

/**
 * The hero's habit in a row: the favourite zone and its share, or null when
 * the keeper has too little to go on or the hero mixes it up.
 */
export function bookHabit(b: ShotBook | undefined, penalty: boolean): { zone: GoalZone; share: number; n: number } | null {
  if (!b) return null
  const row = penalty ? b.pen : b.shot
  const n = row[0] + row[1] + row[2]
  if (n < BOOK_MIN_SAMPLES) return null
  let zone: GoalZone = 0
  for (const z of [1, 2] as const) if (row[z] > row[zone]) zone = z
  const share = row[zone] / n
  return share >= BOOK_MIN_SHARE ? { zone, share, n } : null
}
