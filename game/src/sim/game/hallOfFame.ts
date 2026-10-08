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
import { academyLevel, legacyFund, projectsLegacyPoints } from '../life/projects'
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

/** What the retired hero does next (GDD 2.6): feeds the legacy score and the documentary/Hall of Fame text. */
export type PostCareerPath = 'coach' | 'pundit' | 'ambassador'

export const POST_CAREER: Readonly<Record<PostCareerPath, { score: number; label: LText; text: LText }>> = {
  coach: {
    score: 40, label: lt('Antrenör', 'Coach'),
    text: lt('Kramponları astı ve kulüp akademisinde antrenör oldu; yeni nesli yetiştiriyor.', 'He hung up his boots and became a coach at the club academy, raising the next generation.'),
  },
  pundit: {
    score: 20, label: lt('Yorumcu', 'Pundit'),
    text: lt('Stüdyoya geçti: haftalık yorumcu olarak sahadaki sezgisini ekrana taşıyor.', 'He moved into the studio, a weekly pundit bringing his pitch-side instinct to the screen.'),
  },
  ambassador: {
    score: 30, label: lt('Kulüp elçisi', 'Club ambassador'),
    text: lt('Kulübün resmi elçisi oldu; tribünlerin ve vakfın yüzü olarak anılıyor.', 'He became the club’s official ambassador, remembered as the face of the stands and the foundation.'),
  },
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
  /** Post-retirement path chosen on the retirement card. */
  postCareer?: PostCareerPath
  /** Legacy fund balance at retirement (a share goes to the Legacy child, see legacy.ts). */
  legacyFund?: number
  /** Youth academy stage built (0..3); gives the Legacy child a reputation head start. */
  academyLevel?: number
  /** Legacy points from projects (academy, stadium, club stake, collection). */
  projectsScore?: number
}

/** A Hall of Fame row = the career summary. */
export type HallOfFameEntry = CareerSummary

const r1 = (n: number): number => Math.round(n * 10) / 10

/** Legacy score + its breakdown. */
export function legacyScore(s: Pick<CareerSummary, 'totals' | 'trophies' | 'awards' | 'caps' | 'intGoals' | 'reputation' | 'netWorth'> & { postCareer?: PostCareerPath; projectsScore?: number }): { total: number; breakdown: ScoreLine[] } {
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
  if (s.projectsScore) lines.push({ key: 'projects', label: lt('Vakıf, akademi ve koleksiyon', 'Foundation, academy and collection'), value: s.projectsScore })
  if (s.postCareer) lines.push({ key: 'postCareer', label: POST_CAREER[s.postCareer].label, value: POST_CAREER[s.postCareer].score })
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
export function buildCareerSummary(state: GameState, opts: { peakOvr?: number; testimonial?: CareerSummary['testimonial']; forced?: CareerSummary['forced']; retiredAt?: number; postCareer?: PostCareerPath } = {}): CareerSummary {
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
  const fund = Math.round(legacyFund(state.life))
  const academy = academyLevel(state.life)
  const projectsScore = projectsLegacyPoints(state.life)
  const score = legacyScore({ ...base, ...(opts.postCareer ? { postCareer: opts.postCareer } : {}), ...(projectsScore > 0 ? { projectsScore } : {}) })
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
    ...(opts.postCareer ? { postCareer: opts.postCareer } : {}),
    ...(fund > 0 ? { legacyFund: fund } : {}),
    ...(academy > 0 ? { academyLevel: academy } : {}),
    ...(projectsScore > 0 ? { projectsScore } : {}),
  }
}

/** Weight of an award key in the documentary (season awards above monthly ones). */
const MOMENT_WEIGHT: Readonly<Record<string, number>> = {
  golden_star: 90, top_scorer: 70, player_of_season: 70, golden_glove: 65, defender_of_season: 60, young_player: 60, golden_star_podium: 55,
  league_top_scorer: 50, goal_of_season: 40, team_of_season: 35, player_of_month: 10,
}

const seasonsText = (ss: number[]): string => (ss.length > 3 ? `${ss[0]}–${ss[ss.length - 1]}` : ss.join(', '))

/**
 * Up to 8 headline moments, the biggest first (playtest round 2: a 60-award,
 * 7-trophy, 47-cap legend's documentary listed eight early "Player of the
 * Month" awards and no trophy). Repeated awards and trophies are grouped
 * ("4× League Top Scorer (2028–2033)"); national caps and the best scoring
 * season always compete for a slot.
 */
export function bestMoments(state: GameState): LText[] {
  const h = state.hero
  const cands: { w: number; t: LText }[] = []
  const groups = new Map<string, { name: LText; seasons: number[]; w: number; trophy: boolean }>()
  for (const a of h.awards) {
    const g = groups.get(`a:${a.key}`) ?? { name: a.name, seasons: [], w: MOMENT_WEIGHT[a.key] ?? 30, trophy: false }
    g.seasons.push(a.season)
    groups.set(`a:${a.key}`, g)
  }
  for (const t of h.trophies) {
    const g = groups.get(`t:${t.name.en}`) ?? { name: t.name, seasons: [], w: 80, trophy: true }
    g.seasons.push(t.season)
    groups.set(`t:${t.name.en}`, g)
  }
  for (const g of groups.values()) {
    const ss = [...g.seasons].sort((x, y) => x - y)
    const icon = g.trophy ? '🏆 ' : ''
    const tr = ss.length > 1 ? `${ss.length}× ${icon}${g.name.tr} (${seasonsText(ss)})` : `${ss[0]}: ${icon}${g.name.tr}`
    const en = ss.length > 1 ? `${ss.length}× ${icon}${g.name.en} (${seasonsText(ss)})` : `${ss[0]}: ${icon}${g.name.en}`
    cands.push({ w: g.w + ss.length * 2, t: { tr, en } })
  }
  const nt = h.nationalTeam
  if (nt.caps > 0) cands.push({ w: 60 + Math.min(30, nt.caps / 2), t: { tr: `🎽 ${nt.caps} milli maç, ${nt.goals} gol`, en: `🎽 ${nt.caps} caps, ${nt.goals} international goals` } })
  const best = [...h.history].sort((a, b) => b.stats.goals - a.stats.goals)[0]
  if (best && best.stats.goals > 0) cands.push({ w: 45, t: { tr: `${best.season}: ${best.clubName} formasıyla ${best.stats.goals} gol`, en: `${best.season}: ${best.stats.goals} goals for ${best.clubName}` } })
  for (const l of state.life.log) {
    if (l.kind === 'award' || l.icon === '🏅' || l.icon === '📈') cands.push({ w: 5, t: { tr: `${l.season}: ${l.text.tr}`, en: `${l.season}: ${l.text.en}` } })
  }
  // Stable: equal weights keep insertion (chronological) order.
  return cands.map((c, i) => ({ ...c, i })).sort((a, b) => b.w - a.w || a.i - b.i).slice(0, 8).map((c) => c.t)
}
