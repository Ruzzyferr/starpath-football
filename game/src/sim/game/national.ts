/**
 * Hero-side national team: the 0–100 call-up meter (OVR vs. the squad
 * cut-off, form, reputation, club minutes, national coach relation), squad
 * announcements one week before every international break / finals
 * tournament, the hero's international fixtures (played through the same
 * live match flow as club games, see match.ts) and caps, goals, trophies.
 */
import type { Club, Competition, Fixture, GameState, KitColors, LText, NpcPlayer, Position, TacticStyle, Formation } from '../../core/types'
import { clamp } from '../../core/rng'
import type { Rng } from '../../core/rng'
import { NATION_BY_ID } from '../../data/world/nations'
import { NEWS_SOURCES, absWeek, fameGain, fill, heroAge, lt, meter, pushNews } from '../career/common'
import { addFatigue, applyInjury, rollInjury } from '../career/condition'
import { FATIGUE_PER_90, FORM_ALPHA, MATCH_XP_PER_90, NEUTRAL_RATING, formTarget } from '../career/matchOutcome'
import { POSITION_WEIGHTS, applyXpBundle, heroOvr } from '../career/progression'
import { changeRelation, ensureRelation } from '../life/relationships'
import { positionGroup } from '../world/attributes'
import { kitsClash } from '../world/colors'
import { INTERNATIONAL_BREAK_WEEKS, NATIONAL_FINALS_DATES, SEASON_WEEKS, SQUAD_ANNOUNCE_WEEKS } from '../world/fixtures'
import {
  LEVEL_MAX_AGE, NATIONAL_SQUAD_SIZE, SENIOR_MIN_AGE, SQUAD_QUOTA, announceSquads, recordBonus, ensureNational, nationalCompetitions,
  nationalTeamId, nationalTeamPlayers, nationFormation, nationStyle, nextNationalFixture, parseTeamId, selectionScore, teamName,
} from '../world/national'
import type { NationalLevel, NationalStatus } from '../world/worldTypes'
import { GFLAG, log, readJson, writeJson } from './internal'
import { rewardGear, rewardLine } from '../career/gear'

/** Relationship id of the hero's national coach (kind 'manager'). */
export const NT_COACH_REL = 'nt_coach'
/** Meter needed for a call-up ('likely'); 'borderline' is a coin flip weighted by the meter. */
export const CALLUP_THRESHOLD = 55
const STATUS_CUTS: readonly [NationalStatus, number][] = [['certain', 72], ['likely', CALLUP_THRESHOLD], ['borderline', 42], ['out', -1]]
/** Reputation from internationals is scaled by team level. */
export const LEVEL_REP_SCALE: Readonly<Record<NationalLevel, number>> = { A: 1, U21: 0.3, U19: 0.15 }
const ACHIEVED_FLAG = 'g:ntTrophies'

export const statusOf = (m: number): NationalStatus => STATUS_CUTS.find(([, cut]) => m >= cut)?.[0] ?? 'out'

export interface MeterParts {
  ovr: number
  form: number
  reputation: number
  minutes: number
  coach: number
}

export interface CallupView {
  level: NationalLevel
  teamId: string
  meter: number
  status: NationalStatus
  parts: MeterParts
  /** OVR-equivalent selection score of the last player picked in the hero's position group. */
  cutoff: number
  heroScore: number
  /** Meter points lost to a poor conduct record (butterfly link; absent when none). */
  conduct?: number
}

/** Levels the hero may play for this season (senior first). */
export function eligibleLevels(state: GameState): NationalLevel[] {
  const age = heroAge(state.hero, state.calendar.season)
  const out: NationalLevel[] = []
  if (age >= SENIOR_MIN_AGE) out.push('A')
  if (age <= LEVEL_MAX_AGE.U21) out.push('U21')
  if (age <= LEVEL_MAX_AGE.U19) out.push('U19')
  return out
}

/** Share of the club's played matches the hero was on the pitch for (0..1, 0.5 before any game). */
export function clubMinutesShare(state: GameState): number {
  const clubId = state.hero.contract?.clubId
  if (!clubId) return 0.2
  let played = 0
  for (const comp of Object.values(state.world.competitions)) {
    if (comp.season !== state.calendar.season || comp.type === 'international') continue
    for (const f of comp.fixtures) if (f.result && (f.homeId === clubId || f.awayId === clubId)) played++
  }
  if (played < 3) return 0.5
  return clamp(state.hero.seasonStats.minutes / (played * 90), 0, 1)
}

/** Per-world memo (a WeakMap, so two games never share entries even with equal ids). */
const memos = new WeakMap<object, { cutoff: Map<string, number>; elite: Map<string, number> }>()
const memoFor = (w: object) => {
  let m = memos.get(w)
  if (!m) memos.set(w, (m = { cutoff: new Map(), elite: new Map() }))
  return m
}

/** Selection score of the last player picked in a position group at a level (the bar to clear). */
export function squadCutoff(state: GameState, level: NationalLevel, position: Position): number {
  const w = state.world
  const nation = state.hero.nationality
  const group = positionGroup(position)
  const key = `${state.meta.id}|${state.calendar.season}|${state.calendar.week}|${nation}|${level}|${group}`
  const hit = memoFor(w).cutoff.get(key)
  if (hit !== undefined) return hit
  const maxAge = LEVEL_MAX_AGE[level]
  const scores: number[] = []
  for (const p of Object.values(w.players)) {
    if (p.nationality !== nation || positionGroup(p.position) !== group) continue
    const age = state.calendar.season - p.birthYear
    if (age > maxAge || p.injuredWeeks > 2) continue
    scores.push(selectionScore(w, p))
  }
  scores.sort((a, b) => b - a)
  const k = SQUAD_QUOTA[group]
  // Thin pools (youth) are filled with generated players around the level's typical OVR.
  const fallback = level === 'A' ? 70 : level === 'U21' ? 60 : 54
  const cut = scores.length >= k ? scores[k - 1] : Math.min(fallback, scores[scores.length - 1] ?? fallback)
  const cc = memoFor(w).cutoff
  if (cc.size > 200) cc.clear()
  cc.set(key, cut!)
  return cut!
}

/** Most the season's numbers can add to the hero's selection score (OVR points). */
export const PERFORMANCE_BONUS_MAX = 8

/**
 * What the national coach sees beyond OVR (playtest round 2): a 336-goal striker
 * with 95 reputation was never called up because the world's best OVRs outgrew
 * his 80. Average rating, goal involvement (or clean sheets for keepers and
 * defenders) and fame now count. Uses this season once 6 games are in, else
 * blends in last season's record. −2 … +{@link PERFORMANCE_BONUS_MAX}.
 */
export function heroPerformanceBonus(state: GameState): number {
  const h = state.hero
  const cur = h.seasonStats
  const last = h.history[h.history.length - 1]?.stats
  const st = cur.apps >= 6 || !last ? cur : {
    apps: cur.apps + last.apps, ratingSum: cur.ratingSum + last.ratingSum, goals: cur.goals + last.goals,
    assists: cur.assists + last.assists, cleanSheets: cur.cleanSheets + last.cleanSheets,
  }
  if (st.apps < 4) return 0
  // Same record scale the NPC candidates are judged on (world/national recordBonus), plus the hero's fame.
  let b = recordBonus(st, positionGroup(h.position))
  b += clamp((h.reputation - 60) / 10, 0, 3)
  return clamp(b, -2, PERFORMANCE_BONUS_MAX)
}

/** The hero's selection score on the same scale as {@link selectionScore}, plus the season's numbers. */
export function heroSelectionScore(state: GameState): number {
  const h = state.hero
  const club = h.contract ? state.world.clubs[h.contract.clubId] : undefined
  return heroOvr(h) + (h.form - 50) * 0.05 + (club ? (club.reputation - 50) * 0.03 : -2) + Math.min(h.seasonStats.apps, 20) * 0.05 + heroPerformanceBonus(state)
}

/**
 * Share of the world's senior players in a position group who out-rate the
 * hero. A strong nation's pool can sit above anything a hero reaches, so an
 * elite hero (top few percent worldwide) gets a lift on the OVR part instead
 * of being measured only against an inflated national cut-off.
 */
export function worldEliteShare(state: GameState): number {
  const w = state.world
  const group = positionGroup(state.hero.position)
  const ovr = heroOvr(state.hero)
  const key = `${state.meta.id}|${state.calendar.season}|${state.calendar.week}|${group}|${ovr}`
  const hit = memoFor(w).elite.get(key)
  if (hit !== undefined) return hit
  let total = 0
  let better = 0
  for (const p of Object.values(w.players)) {
    if (positionGroup(p.position) !== group || state.calendar.season - p.birthYear < SENIOR_MIN_AGE) continue
    total++
    if (p.ovr > ovr) better++
  }
  const share = total ? better / total : 1
  const ec = memoFor(w).elite
  if (ec.size > 100) ec.clear()
  ec.set(key, share)
  return share
}

/** Meter points the OVR part gains for being world-elite (0..16). */
export function eliteLift(share: number): number {
  return share <= 0.01 ? 16 : share <= 0.03 ? 12 : share <= 0.06 ? 9 : share <= 0.1 ? 6 : share <= 0.15 ? 3 : 0
}

/** Call-up meter for one level. */
/** Call-up meter points lost to a poor conduct record (discipline < 40, max −10). */
export const nationalConductPenalty = (discipline: number): number => (discipline < 40 ? Math.min(10, (40 - discipline) / 4) : 0)

export function callupFor(state: GameState, level: NationalLevel): CallupView {
  const h = state.hero
  const cutoff = squadCutoff(state, level, h.position)
  const heroScore = heroSelectionScore(state)
  const coachRel = state.life.relationships[NT_COACH_REL]?.value ?? 0
  const parts: MeterParts = {
    ovr: Math.round(clamp(50 + (heroScore - cutoff) * (level === 'A' ? 4.5 : 6) + (level === 'A' ? eliteLift(worldEliteShare(state)) : 0), 0, 100)),
    form: Math.round(clamp(h.form, 0, 100)),
    reputation: Math.round(clamp(h.reputation * (level === 'A' ? 1.3 : 2.5), 0, 100)),
    minutes: Math.round(clamp(clubMinutesShare(state) * 110, 0, 100)),
    coach: Math.round(clamp(50 + coachRel / 2, 0, 100)),
  }
  let m = parts.ovr * 0.5 + parts.form * 0.12 + parts.reputation * 0.1 + parts.minutes * 0.16 + parts.coach * 0.12
  if (h.injury && h.injury.weeksLeft > 2) m -= 20
  // Butterfly: the national coach reads the papers too: a poor conduct record costs up to 10 points.
  m -= nationalConductPenalty(state.life.discipline)
  if (h.retired) m = 0
  const meterV = Math.round(clamp(m, 0, 100))
  const conduct = Math.round(nationalConductPenalty(state.life.discipline))
  return {
    level, teamId: nationalTeamId(h.nationality, level), meter: meterV, status: statusOf(meterV), parts, cutoff: Math.round(cutoff * 10) / 10, heroScore: Math.round(heroScore * 10) / 10,
    ...(conduct > 0 ? { conduct } : {}),
  }
}

/** Best level the hero is in contention for (the senior team when likely, else the youngest eligible level). */
export function heroCallup(state: GameState): CallupView | null {
  if (state.hero.retired) return null
  const levels = eligibleLevels(state)
  if (!levels.length) return null
  const views = levels.map((l) => callupFor(state, l))
  return (views.find((v) => v.meter >= CALLUP_THRESHOLD) ?? views[views.length - 1])!
}

/** Weeks until the next squad announcement (0 = this week) and its week number. */
export function nextAnnouncement(state: GameState): { week: number; weeksUntil: number; finals: boolean } {
  const w = state.calendar.week
  const next = SQUAD_ANNOUNCE_WEEKS.find((x) => x >= w)
  if (next !== undefined) return { week: next, weeksUntil: next - w, finals: next === SQUAD_ANNOUNCE_WEEKS[SQUAD_ANNOUNCE_WEEKS.length - 1] }
  return { week: SQUAD_ANNOUNCE_WEEKS[0]!, weeksUntil: SEASON_WEEKS - w + SQUAD_ANNOUNCE_WEEKS[0]!, finals: false }
}

/** Refresh the stored meter (Profile/Home read it; no selection happens here). */
export function evaluateCallupMeter(state: GameState): CallupView | null {
  const v = heroCallup(state)
  const nat = ensureNational(state.world)
  if (v) {
    nat.hero.meter = v.meter
    nat.hero.level = v.level
    nat.hero.status = v.status
  }
  return v
}

/** Does the hero's nation play this window (finals: only finalists)? */
function teamPlaysInWindow(state: GameState, teamId: string, week: number): boolean {
  const season = state.calendar.season
  const from = week + 1
  const to = week === 41 ? NATIONAL_FINALS_DATES[NATIONAL_FINALS_DATES.length - 1]!.week : week + 1
  for (const comp of nationalCompetitions(state.world, season)) {
    if (comp.fixtures.some((f) => f.week >= from && f.week <= to && (f.homeId === teamId || f.awayId === teamId))) return true
  }
  return false
}

/** Put the hero into a squad: he replaces the weakest player of his position group. */
function insertHero(state: GameState, teamId: string): void {
  const nat = ensureNational(state.world)
  for (const [id, list] of Object.entries(nat.squads)) nat.squads[id] = list.filter((x) => x !== 'hero')
  const list = nat.squads[teamId] ?? []
  if (list.length >= NATIONAL_SQUAD_SIZE) {
    const group = positionGroup(state.hero.position)
    const season = state.calendar.season
    const players = nationalTeamPlayers(state.world, teamId, season)
    const inGroup = players.filter((p) => positionGroup(p.position) === group)
    const weakest = inGroup.sort((a, b) => a.ovr - b.ovr)[0] ?? players.sort((a, b) => a.ovr - b.ovr)[0]
    if (weakest) nat.squads[teamId] = list.filter((x) => x !== weakest.id)
  }
  nat.squads[teamId] = [...(nat.squads[teamId] ?? []), 'hero']
}

/**
 * Squad announcement (Monday, one week before a break or the finals): every
 * nation picks its squads; the hero is called up to the best level his meter
 * allows ('likely'/'certain', or a weighted coin flip when 'borderline').
 */
export function announceHeroSquad(state: GameState, rng: Rng, out: LText[]): void {
  const w = state.world
  const cal = state.calendar
  const h = state.hero
  announceSquads(w, cal.season, cal.week)
  const nat = ensureNational(w)
  const wasCalled = nat.hero.teamId
  const wasSenior = h.nationalTeam.called
  nat.hero.teamId = null
  h.nationalTeam.called = false
  if (h.retired) return
  const eventBoost = state.life.flags.nt_called === true && !wasSenior ? 10 : 0
  let chosen: CallupView | null = null
  for (const level of eligibleLevels(state)) {
    // Retired from international football (card national.international_retirement).
    if (level === 'A' && state.life.flags.nt_retired === true) continue
    const v = callupFor(state, level)
    const m = v.meter + (level === 'A' ? eventBoost : 0)
    if (!teamPlaysInWindow(state, v.teamId, cal.week)) continue
    const called = m >= CALLUP_THRESHOLD || (statusOf(m) === 'borderline' && rng.chance((m - 42) / 26))
    if (called && !h.injury) { chosen = { ...v, meter: Math.round(m) }; break }
  }
  evaluateCallupMeter(state)
  const country = NATION_BY_ID[h.nationality]?.name ?? lt('?', '?')
  if (!chosen) {
    // A provisional-squad phone call (card national.first_callup) gets closure instead of silence.
    const provisional = state.life.flags.nt_called === true && !wasSenior && !h.injury
    delete state.life.flags.nt_called
    state.life.flags[GFLAG.ntSeen] = false
    if (wasCalled) log(state, out, fill(lt('{c} kadrosu açıklandı: bu kez listede yoksun.', '{c} squad announced: you are not in it this time.'), { c: country }), 'career', '🎽')
    else if (provisional) log(state, out, fill(lt('{c} kadrosu açıklandı: aday listesindeydin ama son kadroya giremedin. Hoca "Kapı açık" dedi.', '{c} squad announced: you were on the provisional list but missed the final cut. The coach says "the door is open".'), { c: country }), 'career', '🎽')
    return
  }
  insertHero(state, chosen.teamId)
  nat.hero.teamId = chosen.teamId
  const senior = chosen.level === 'A'
  h.nationalTeam.called = senior
  if (senior) state.life.flags.nt_called = true
  else delete state.life.flags.nt_called
  state.life.flags[GFLAG.ntSeen] = senior
  const coach = nat.coaches[h.nationality] ?? 'Coach'
  ensureRelation(state.life, NT_COACH_REL, 'manager', coach, 10, absWeek(cal))
  const team = teamName(chosen.teamId)
  const first = senior && h.nationalTeam.caps === 0 && !wasSenior
  log(state, out, fill(first
    ? lt('🎽 İlk kez A Milli Takım\'a çağrıldın: {t}! Teknik direktör {m}.', '🎽 First senior call-up: {t}! Head coach {m}.')
    : lt('🎽 Kadro açıklandı: {t} kadrosundasın (çağrı puanı {v}).', '🎽 Squad announced: you are in the {t} squad (call-up meter {v}).'), { t: team, m: coach, v: chosen.meter }), 'career', '🎽')
  // Headline only when the call-up is news (first call or a recall), not every window (playtest round 2: ×15 identical).
  if (senior && !wasSenior) {
    const tpl = h.nationalTeam.caps === 0
      ? lt('{n}, {t} kadrosunda', '{n} named in the {t} squad')
      : rng.pick([
        lt('{n} yeniden {t} kadrosunda', '{n} recalled to the {t} squad'),
        lt('Milli takımda {n} sürprizi yok: yine listede', 'No surprise: {n} back in the {t} squad'),
        lt('{t} hocası {n} ismini yeniden yazdı', 'The {t} coach writes {n} back in'),
      ])
    pushNews(state.life, rng, cal, fill(tpl, { n: `${h.firstName} ${h.lastName}`, t: team }), 1, rng.pick(NEWS_SOURCES))
  }
}

/** True when this week is an international break or finals week and the hero is on senior duty. */
export function onSeniorDuty(state: GameState): boolean {
  const nat = state.world.national
  if (!nat?.hero.teamId || parseTeamId(nat.hero.teamId)?.level !== 'A') return false
  const wk = state.calendar.week
  return INTERNATIONAL_BREAK_WEEKS.includes(wk) || NATIONAL_FINALS_DATES.some((d) => d.week === wk)
}

// ───────────────────────── Fixtures ─────────────────────────

/** The hero's international fixture on (week, day) of the current season, if he is in that squad. */
export function heroNationalFixtureOn(state: GameState, week: number, day: number): { competition: Competition; fixture: Fixture } | null {
  const teamId = state.world.national?.hero.teamId
  if (!teamId) return null
  for (const comp of nationalCompetitions(state.world, state.calendar.season)) {
    for (const f of comp.fixtures) {
      if (f.week === week && f.day === day && (f.homeId === teamId || f.awayId === teamId)) return { competition: comp, fixture: f }
    }
  }
  return null
}

/** Next unplayed international fixture of the hero's team. */
export function nextHeroNationalFixture(state: GameState): { competition: Competition; fixture: Fixture } | null {
  const teamId = state.world.national?.hero.teamId
  if (!teamId) return null
  return nextNationalFixture(state.world, teamId, state.calendar.season, state.calendar.week, state.calendar.day)
}

/** A team as the match layer needs it (club-like shape built from a national squad). */
export interface MatchTeamSource {
  id: string
  name: string
  shortName: string
  colors: KitColors
  awayColors: KitColors
  formation: Formation
  style: TacticStyle
  players: NpcPlayer[]
  countryId: string
  reputation: number
  city: string
}

/** National team as a match side. */
export function nationalTeamSource(state: GameState, teamId: string): MatchTeamSource {
  const p = parseTeamId(teamId)
  const n = p ? NATION_BY_ID[p.nationId] : undefined
  const flag = n?.flag ?? ['#24345a', '#f2f5fa', '#1fd47a']
  // White-first flags wear their second colour.
  const primary = flag[0].toUpperCase() === '#FFFFFF' ? flag[1] : flag[0]
  const secondary = primary === flag[1] ? flag[0] : flag[1]
  const name = teamName(teamId).en
  return {
    id: teamId, name, shortName: (p?.nationId ?? teamId).slice(0, 3).toUpperCase(),
    colors: { primary, secondary, pattern: 'plain' },
    awayColors: { primary: '#FFFFFF' === primary.toUpperCase() ? '#1B1B1B' : '#F4F4F4', secondary: primary, pattern: 'plain' },
    formation: nationFormation(p?.nationId ?? ''), style: nationStyle(p?.nationId ?? ''),
    players: nationalTeamPlayers(state.world, teamId, state.calendar.season),
    countryId: p?.nationId ?? '', reputation: n?.reputation ?? 60, city: n?.name.en ?? '',
  }
}

/** Kits for an international (the away side changes on a clash). */
export function nationalKits(home: MatchTeamSource, away: MatchTeamSource): { home: KitColors; away: KitColors } {
  return { home: home.colors, away: kitsClash(home.colors, away.colors) ? away.awayColors : away.colors }
}

/** Opponent strength proxy for a team id (club reputation or nation reputation). */
export function teamReputation(state: GameState, id: string): number {
  const c: Club | undefined = state.world.clubs[id]
  if (c) return c.reputation
  const p = parseTeamId(id)
  return p ? NATION_BY_ID[p.nationId]?.reputation ?? 60 : 50
}

// ───────────────────────── After a match ─────────────────────────

export interface NationalMatchInput {
  teamId: string
  oppId: string
  comp: Competition
  rating: number
  minutes: number
  goals: number
  assists: number
  won: boolean
  drew: boolean
  gf: number
  ga: number
  motm: boolean
  injured: boolean
  importance: number
}

/**
 * Apply an international to the hero: caps/goals (senior or youth), form,
 * morale, sharpness, fatigue, reputation (scaled by level, diminishing at the
 * top), followers, fans and national-coach relations, match XP, injuries.
 * Club stats, club trust and club bonuses are not touched.
 */
export function applyNationalMatchToHero(state: GameState, rng: Rng, m: NationalMatchInput): LText[] {
  const h = state.hero
  const life = state.life
  const cal = state.calendar
  const nat = ensureNational(state.world)
  const level = parseTeamId(m.teamId)?.level ?? 'A'
  const lines: LText[] = []
  const played = m.minutes > 0
  const rating = clamp(Number.isFinite(m.rating) ? m.rating : NEUTRAL_RATING, 0, 10)
  if (!played) {
    lines.push(lt('Milli maçta yedek kulübesinde kaldın.', 'You stayed on the bench for your country.'))
    return lines
  }
  nat.hero.log = [{ season: cal.season, week: cal.week, teamId: m.teamId, oppId: m.oppId, gf: m.gf, ga: m.ga, goals: m.goals, comp: { ...m.comp.name } }, ...nat.hero.log].slice(0, 20)
  const debut = level === 'A' && h.nationalTeam.caps === 0
  if (level === 'A') {
    h.nationalTeam.caps++
    h.nationalTeam.goals += m.goals
  } else {
    nat.hero.youthCaps++
    nat.hero.youthGoals += m.goals
  }
  h.form = meter(h.form * (1 - FORM_ALPHA) + formTarget(rating) * FORM_ALPHA)
  h.morale = meter(h.morale + ((m.won ? 4 : m.drew ? 0 : -3) + (rating - NEUTRAL_RATING) * 2 + m.goals * 2) * (0.75 + m.importance * 0.5))
  h.sharpness = meter(h.sharpness + (m.minutes / 90) * 12)
  addFatigue(h, (m.minutes / 90) * FATIGUE_PER_90 * (1.2 - h.attrs.stamina / 250) + 4)
  // Reputation: same shape as club games, scaled by the team level.
  const stage = 0.5 + m.importance + clamp((teamReputation(state, m.oppId) - 50) / 100, -0.3, 0.4)
  let repD = ((rating - NEUTRAL_RATING) * 0.4 + m.goals * 0.3 + m.assists * 0.2 + (m.motm ? 0.5 : 0)) * stage * LEVEL_REP_SCALE[level]
  repD = repD > 0 ? repD * Math.pow(Math.max(0, 1 - h.reputation / 100), 1.3) : repD * 0.5
  if (debut) repD += fameGain(h.reputation, 1)
  h.reputation = clamp(Math.round((h.reputation + repD) * 100) / 100, 0, 100)
  const followers = Math.round(life.followers * Math.max(0, (rating - 6) * 0.004 + m.goals * 0.008) * LEVEL_REP_SCALE[level] + m.goals * 60 * LEVEL_REP_SCALE[level])
  life.followers = Math.max(0, life.followers + followers)
  if (life.relationships.fans) changeRelation(life, 'fans', ((rating - NEUTRAL_RATING) * 2 + m.goals * 2) * LEVEL_REP_SCALE[level], { hero: h, cause: 'match' })
  if (life.relationships[NT_COACH_REL]) changeRelation(life, NT_COACH_REL, (rating - NEUTRAL_RATING) * 2 + m.goals, { week: absWeek(cal), contact: true, cause: 'match', why: lt('Milli maçtaki performansın', 'Your international performance') })
  // Match experience (a little less than a club game: shorter camps).
  const weights = POSITION_WEIGHTS[h.position]
  const wsum = Object.values(weights).reduce((a, b) => a + (b ?? 0), 0)
  const total = MATCH_XP_PER_90 * 0.8 * (m.minutes / 90) * (0.6 + rating / 10) * (1 + m.importance * 0.3)
  const bundle: Record<string, number> = {}
  for (const k in weights) bundle[k] = (total * (weights[k as keyof typeof weights] ?? 0)) / wsum
  lines.push(...applyXpBundle(h, bundle, cal.season).lines.filter((l) => l.en.startsWith('Overall') || l.en.startsWith('🌟')))
  if (m.injured) lines.push(...applyInjury(h, life, rollInjury(rng, h, life, [0.6, 0.32, 0.08])))
  const team = teamName(m.teamId)
  lines.unshift(fill(lt('{t}: {gf}-{ga} · Puanın {r} · {g} gol', '{t}: {gf}-{ga} · Rating {r} · {g} goal(s)'), { t: team, gf: m.gf, ga: m.ga, r: rating.toFixed(1), g: m.goals }))
  if (debut) lines.push(lt('🎖️ A Milli Takım\'da ilk maçına çıktın!', '🎖️ You made your senior international debut!'))
  if (level === 'A' && m.goals > 0) {
    // Varied (playtest round 2: one template ×25 in a 38-cap career); the first goal is its own story.
    const intlGoals = h.nationalTeam.goals
    const tpl = intlGoals <= m.goals
      ? lt('{n} milli formayla ilk golünü attı', '{n} scores a first international goal')
      : m.goals >= 2
        ? rng.pick([lt('{n} milli maçta {g} gol attı', '{n} hits {g} for {t}'), lt('{t} gecesi {n} gecesiydi: {g} gol', '{t} night belonged to {n}: {g} goals')])
        : rng.pick([
          lt('{n}, {t} formasıyla yine sahnede', '{n} on target again for {t}'),
          lt('{n} milli takımda {i}. golüne ulaştı', '{n} reaches {i} international goals'),
          lt('{t} attı, {n} sevindi', '{t} score and {n} celebrates'),
          lt('Milli arada {n} farkı', 'The {n} factor in the international break'),
        ])
    pushNews(life, rng, cal, fill(tpl, { n: `${h.firstName} ${h.lastName}`, t: team, g: m.goals, i: intlGoals }), 1, rng.pick(NEWS_SOURCES))
  }
  return lines
}

/**
 * Trophies of national tournaments the hero's team won while he was in the
 * squad (checked daily; each competition is awarded once).
 */
export function checkNationalTrophies(state: GameState, rng: Rng, out: LText[]): void {
  const nat = state.world.national
  const teamId = nat?.hero.teamId
  if (!teamId) return
  const done = readJson<string[]>(state.life, ACHIEVED_FLAG, [])
  for (const comp of nationalCompetitions(state.world, state.calendar.season)) {
    if (comp.winnerId !== teamId || done.includes(comp.id)) continue
    if (comp.meta?.format !== 'nt_finals' && comp.meta?.format !== 'nt_youth') continue
    done.push(comp.id)
    const h = state.hero
    h.trophies.push({ season: comp.season, name: { ...comp.name } })
    const big = comp.meta?.format === 'nt_finals'
    h.reputation = meter(h.reputation + fameGain(h.reputation, big ? 5 : 0.5))
    log(state, out, fill(lt('🏆 {c} şampiyonu: {t}!', '🏆 {c} champions: {t}!'), { c: comp.name, t: teamName(teamId) }), 'award', '🏆')
    // Reward gear (career/gear): a senior international title gives legend boots, a youth title pro ones.
    log(state, out, rewardLine(rewardGear(state.life, h.position, big ? 'legend' : 'pro'), comp.name), 'award', '🎁')
    pushNews(state.life, rng, state.calendar, fill(lt('{t} {c} şampiyonu! {n} kupayı kaldırdı', '{t} win the {c}! {n} lifts the trophy'), { t: teamName(teamId), c: comp.name, n: `${h.firstName} ${h.lastName}` }), 1, rng.pick(NEWS_SOURCES))
  }
  writeJson(state.life, ACHIEVED_FLAG, done.slice(-12))
}

/** Senior caps/goals of the hero in the current award year (last summer's finals + this season). */
export function heroAwardYearInternational(state: GameState): { caps: number; goals: number } {
  const log0 = state.world.national?.hero.log ?? []
  const s = state.calendar.season
  let caps = 0
  let goals = 0
  for (const e of log0) {
    if (parseTeamId(e.teamId)?.level !== 'A') continue
    if ((e.season === s && e.week < 42) || (e.season === s - 1 && e.week >= 42)) {
      caps++
      goals += e.goals
    }
  }
  return { caps, goals }
}

/** Kept for compatibility: the senior OVR bar of a nation (≈ squad cut-off). */
export function nationalThreshold(countryId: string): number {
  return Math.round(45 + (NATION_BY_ID[countryId]?.reputation ?? 60) * 0.35)
}

export { nationalTeamId, teamName }
