/** Career stats split by club (2.7#94): finished seasons from `hero.history` plus the season in progress. */
import type { Hero, SeasonStats } from '../../core/types'
import { emptyStats } from '../career/common'

export interface ClubStatsRow {
  clubId: string
  clubName: string
  seasons: number
  stats: SeasonStats
}

const SUMMED: readonly (keyof SeasonStats)[] = [
  'apps', 'starts', 'minutes', 'goals', 'assists', 'shots', 'shotsOnTarget', 'passes', 'passesCompleted', 'tackles', 'dribbles',
  'yellow', 'red', 'cleanSheets', 'saves', 'ratingSum', 'motm',
]

function add(into: SeasonStats, from: SeasonStats): void {
  for (const k of SUMMED) (into[k] as number) += (from[k] as number) ?? 0
}

/** Rows ordered by appearances (most first). `current` is the club of the season in progress. */
export function statsByClub(hero: Pick<Hero, 'history' | 'seasonStats'>, current: { clubId: string; clubName: string } | null): ClubStatsRow[] {
  const rows = new Map<string, ClubStatsRow>()
  const row = (clubId: string, clubName: string): ClubStatsRow => {
    let r = rows.get(clubId)
    if (!r) rows.set(clubId, (r = { clubId, clubName, seasons: 0, stats: emptyStats() }))
    return r
  }
  for (const rec of hero.history) {
    const r = row(rec.clubId, rec.clubName)
    r.seasons++
    add(r.stats, rec.stats)
  }
  if (current && hero.seasonStats.apps > 0) {
    const r = row(current.clubId, current.clubName)
    r.seasons++
    add(r.stats, hero.seasonStats)
  }
  return [...rows.values()].sort((a, b) => b.stats.apps - a.stats.apps || b.stats.goals - a.stats.goals)
}
