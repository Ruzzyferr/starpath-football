/**
 * Career summary ("documentary") and Hall of Fame entries (WP-7).
 *
 * Pure functions over GameState: the UI layer persists entries in global
 * storage (state/metaStore) so they survive deleting the save slot.
 *
 * Legacy score (transparent, shown with its breakdown):
 *   goals×2 + assists×1 + apps×0.3 + clean sheets×0.5
 *   + trophies×25 + awards×40 + caps×1.5 + international goals×3
 *   + peak reputation×2 + 10·log10(1 + net worth / 10 000)
 */
import type { Gender, GameState, LText, Position } from '../../core/types'
import { heroAge, lt } from '../career/common'
import { heroOvr } from '../career/progression'
import { netWorth } from '../life/economy'
import { heroClub } from './internal'

export interface TimelineSeason {
  season: number
  clubName: string
  leagueName: string
  apps: number
  goals: number
  assists: number
  avgRating: number
  leaguePosition: number | null
  trophies: string[]
}

export interface ScoreLine {
  key: string
  label: LText
  value: number
}

export interface CareerSummary {
  careerId: string
  name: string
  firstName: string
  lastName: string
  nickname: string
  gender: Gender
  nationality: string
  position: Position
  birthYear: number
  startSeason: number
  endSeason: number
  age: number
  ovr: number
  peakOvr: number
  clubs: string[]
  timeline: TimelineSeason[]
  totals: { apps: number; goals: number; assists: number; motm: number; cleanSheets: number; avgRating: number }
  caps: number
  intGoals: number
  trophies: { season: number; name: LText }[]
  awards: { season: number; name: LText }[]
  bestMoments: LText[]
  netWorth: number
  followers: number
  reputation: number
  legacyScore: number
  breakdown: ScoreLine[]
  testimonial: { score: [number, number]; goals: number; opponent: string } | null
  /** Hero was forced to retire (age / injury). */
  forced: 'age' | 'injury' | null
  /** Real-world timestamp of the retirement (for the Hall of Fame list). */
  retiredAt: number
  /** Parent's career id when this was a Legacy (New Game+) career. */
  parentCareerId?: string
  difficulty: string
}

/** A Hall of Fame row = the career summary. */
export type HallOfFameEntry = CareerSummary

const r1 = (n: number): number => Math.round(n * 10) / 10

/** Legacy score + its breakdown. */
export function legacyScore(s: Pick<CareerSummary, 'totals' | 'trophies' | 'awards' | 'caps' | 'intGoals' | 'reputation' | 'netWorth'>): { total: number; breakdown: ScoreLine[] } {
  const lines: ScoreLine[] = [
    { key: 'goals', label: lt('Goller', 'Goals'), value: s.totals.goals * 2 },
    { key: 'assists', label: lt('Asistler', 'Assists'), value: s.totals.assists },
    { key: 'apps', label: lt('Maçlar', 'Appearances'), value: r1(s.totals.apps * 0.3) },
    { key: 'cleanSheets', label: lt('Gol yememe', 'Clean sheets'), value: r1(s.totals.cleanSheets * 0.5) },
    { key: 'trophies', label: lt('Kupalar', 'Trophies'), value: s.trophies.length * 25 },
    { key: 'awards', label: lt('Bireysel ödüller', 'Individual awards'), value: s.awards.length * 40 },
    { key: 'caps', label: lt('Milli maçlar', 'Caps'), value: r1(s.caps * 1.5 + s.intGoals * 3) },
    { key: 'fame', label: lt('Şöhret', 'Fame'), value: Math.round(s.reputation * 2) },
    { key: 'wealth', label: lt('Servet', 'Wealth'), value: r1(10 * Math.log10(1 + Math.max(0, s.netWorth) / 10_000)) },
  ]
  return { total: Math.round(lines.reduce((a, b) => a + b.value, 0)), breakdown: lines }
}

/** Legacy tier label from a score. */
export function legacyTier(score: number): LText {
  if (score >= 2500) return lt('Ölümsüz Efsane', 'Immortal Legend')
  if (score >= 1500) return lt('Efsane', 'Legend')
  if (score >= 800) return lt('Yıldız', 'Star')
  if (score >= 350) return lt('Saygın Profesyonel', 'Respected Pro')
  return lt('Kulüp Emektarı', 'Club Servant')
}

/**
 * Build the documentary summary of a (finishing) career.
 * `peakOvr` comes from the UI's weekly history when available.
 */
export function buildCareerSummary(state: GameState, opts: { peakOvr?: number; testimonial?: CareerSummary['testimonial']; forced?: CareerSummary['forced']; retiredAt?: number } = {}): CareerSummary {
  const h = state.hero
  const season = state.calendar.season
  const timeline: TimelineSeason[] = h.history.map((r) => ({
    season: r.season, clubName: r.clubName, leagueName: r.leagueName, apps: r.stats.apps, goals: r.stats.goals, assists: r.stats.assists,
    avgRating: r.stats.apps > 0 ? r1(r.stats.ratingSum / r.stats.apps) : 0, leaguePosition: r.leaguePosition, trophies: r.trophies,
  }))
  const cur = h.seasonStats
  if (cur.apps > 0 && !timeline.some((t) => t.season === season)) {
    const club = heroClub(state)
    timeline.push({
      season, clubName: club?.name ?? '—', leagueName: club ? state.world.leagues[club.leagueId]?.name ?? '' : '', apps: cur.apps, goals: cur.goals,
      assists: cur.assists, avgRating: r1(cur.ratingSum / cur.apps), leaguePosition: null, trophies: [],
    })
  }
  const c = h.careerStats
  const clubs = [...new Set(timeline.map((t) => t.clubName).filter((n) => n && n !== '—'))]
  const nw = Math.round(netWorth(state.life, state.calendar))
  const base = {
    totals: { apps: c.apps, goals: c.goals, assists: c.assists, motm: c.motm, cleanSheets: c.cleanSheets, avgRating: c.apps > 0 ? r1(c.ratingSum / c.apps) : 0 },
    trophies: h.trophies.map((t) => ({ season: t.season, name: t.name })),
    awards: h.awards.map((a) => ({ season: a.season, name: a.name })),
    caps: h.nationalTeam.caps,
    intGoals: h.nationalTeam.goals,
    reputation: h.reputation,
    netWorth: nw,
  }
  const score = legacyScore(base)
  const ovr = heroOvr(h)
  return {
    careerId: state.meta.id,
    name: `${h.firstName} ${h.lastName}`,
    firstName: h.firstName,
    lastName: h.lastName,
    nickname: h.nickname,
    gender: h.gender === 'female' ? 'female' : 'male',
    nationality: h.nationality,
    position: h.position,
    birthYear: h.birthYear,
    startSeason: timeline[0]?.season ?? season,
    endSeason: season,
    age: heroAge(h, season),
    ovr,
    peakOvr: Math.max(ovr, opts.peakOvr ?? 0),
    clubs,
    timeline,
    ...base,
    followers: state.life.followers,
    bestMoments: bestMoments(state),
    legacyScore: score.total,
    breakdown: score.breakdown,
    testimonial: opts.testimonial ?? null,
    forced: opts.forced ?? null,
    retiredAt: opts.retiredAt ?? 0,
    ...(typeof state.life.flags['c:legacyParentId'] === 'string' ? { parentCareerId: state.life.flags['c:legacyParentId'] } : {}),
    difficulty: state.meta.difficulty,
  }
}

/** Up to 8 headline moments: awards, trophies, records, big log entries. */
export function bestMoments(state: GameState): LText[] {
  const out: LText[] = []
  const h = state.hero
  for (const a of h.awards) out.push({ tr: `${a.season}: ${a.name.tr}`, en: `${a.season}: ${a.name.en}` })
  for (const t of h.trophies) out.push({ tr: `${t.season}: 🏆 ${t.name.tr}`, en: `${t.season}: 🏆 ${t.name.en}` })
  for (const l of state.life.log) {
    if (out.length >= 12) break
    if (l.kind === 'award' || l.icon === '🏅' || l.icon === '📈') out.push({ tr: `${l.season}: ${l.text.tr}`, en: `${l.season}: ${l.text.en}` })
  }
  const best = [...h.history].sort((a, b) => b.stats.goals - a.stats.goals)[0]
  if (best && best.stats.goals > 0) out.push({ tr: `${best.season}: ${best.clubName} formasıyla ${best.stats.goals} gol`, en: `${best.season}: ${best.stats.goals} goals for ${best.clubName}` })
  return out.slice(0, 8)
}
