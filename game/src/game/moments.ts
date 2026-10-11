/**
 * Session-only store of recorded match moments (compact replay recordings),
 * so the live-match and post-match screens can rewatch this match's moments.
 * Lives in memory only: never written to the save.
 *
 * A recording keeps the original Highlight (so the scene can rebuild the same
 * players in the same order) plus subsampled ReplayFrames.
 */
import type { KitColors, Lang } from '../core/types'
import type { Highlight, HighlightOutcome, Weather } from '../sim/match/types'
import type { ReplayFrame } from './runtime'

export interface MomentRecording {
  /** Unique per recording. */
  id: string
  /** Groups moments of one match (fixture id; demo/dev: 'demo'). */
  matchKey: string
  minute: number
  kind: Highlight['kind']
  outcome: HighlightOutcome
  /** Graded success (build 9): full / partial / fail. */
  tier?: 'full' | 'partial' | 'fail'
  /** Hero scored / assisted etc. — drives sorting in the "top moments" list. */
  score: number
  highlight: Highlight
  frames: ReplayFrame[]
  /** Runtime time of the goal (or the key action), seconds; < 0 when none. */
  keyTime: number
  view: {
    heroTeamColors: KitColors
    oppColors: KitColors
    weather: Weather
    lang: Lang
    names?: Record<string, string>
    heroName?: string
    teamNames?: { hero?: string; opp?: string }
    stadium?: { capacity: number; night?: boolean }
    gender?: 'male' | 'female'
  }
}

const MAX_PER_MATCH = 16
const MAX_MATCHES = 2
let store: MomentRecording[] = []
let version = 0

const OUTCOME_SCORE: Partial<Record<HighlightOutcome, number>> = {
  goal: 10, assist: 8, woodwork: 6, defended: 5, saved: 4, foul_won: 3, pass_complete: 3, blocked: 2, missed: 2, conceded: 1, shot_conceded: 1,
}

/** Interest of a moment for the "best moments" ordering. */
export function momentScore(outcome: HighlightOutcome, frames: number): number {
  return (OUTCOME_SCORE[outcome] ?? 0) + Math.min(1, frames / 300) * 0.5
}

/** Keep every `step`-th frame (always the last) — halves memory at 30 fps. */
export function compactFrames(frames: readonly ReplayFrame[], step = 2): ReplayFrame[] {
  const out: ReplayFrame[] = []
  for (let i = 0; i < frames.length; i += step) out.push(frames[i]!)
  const last = frames[frames.length - 1]
  if (last && out[out.length - 1] !== last) out.push(last)
  return out
}

export function recordMoment(m: Omit<MomentRecording, 'score' | 'id'> & { id?: string }): MomentRecording | null {
  if (m.frames.length < 8) return null
  const rec: MomentRecording = { ...m, id: m.id ?? `${m.matchKey}:${m.highlight.id}:${version}`, score: momentScore(m.outcome, m.frames.length) }
  // A replayed highlight (same id) replaces the old recording.
  store = store.filter((x) => !(x.matchKey === rec.matchKey && x.highlight.id === rec.highlight.id))
  store.push(rec)
  // Only the latest matches are kept.
  const keys = [...new Set(store.map((x) => x.matchKey))]
  if (keys.length > MAX_MATCHES) {
    const keep = new Set(keys.slice(-MAX_MATCHES))
    store = store.filter((x) => keep.has(x.matchKey))
  }
  const mine = store.filter((x) => x.matchKey === rec.matchKey)
  if (mine.length > MAX_PER_MATCH) {
    const drop = new Set([...mine].sort((a, b) => a.score - b.score).slice(0, mine.length - MAX_PER_MATCH))
    store = store.filter((x) => !drop.has(x))
  }
  version++
  return rec
}

/** Moments of a match in match order. */
export function listMoments(matchKey: string): MomentRecording[] {
  return store.filter((x) => x.matchKey === matchKey).sort((a, b) => a.minute - b.minute)
}

/** The best `n` moments of a match (highest interest first). */
export function topMoments(matchKey: string, n = 3): MomentRecording[] {
  return [...listMoments(matchKey)].sort((a, b) => b.score - a.score || a.minute - b.minute).slice(0, n)
}

export function getMoment(id: string): MomentRecording | null {
  return store.find((x) => x.id === id) ?? null
}

/** Bumps on every change (UI memo key). */
export const momentsVersion = (): number => version

export function clearMoments(): void {
  store = []
  version++
}
