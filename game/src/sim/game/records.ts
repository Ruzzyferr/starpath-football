/**
 * Club & personal records (WP-7, GAP 2.6#107).
 *
 * Personal records (`life.flags['c:records']`) are updated after every hero
 * match from the match feats ({@link MatchFeats}). Club records
 * (`life.flags['c:clubRecords']`, per club id) are seeded with a plausible
 * historical baseline the first time a club is seen and compared after every
 * hero match against the hero and the NPC squad's season numbers. When the
 * hero breaks a club record a news item and a log line celebrate it.
 */
import type { GameState, LText } from '../../core/types'
import { fill, heroAge, lt, pushNews } from '../career/common'
import { squadPlayers } from '../world/queries'
import { Rng, hashString } from '../../core/rng'
import { heroClub, log, readJson, writeJson } from './internal'

/** What the hero did in one match (written by sim/game/match `finishHeroMatch`). */
export interface MatchFeats {
  fixtureId: string
  season: number
  week: number
  compType: string
  final: boolean
  opponent: string
  opponentReputation: number
  minutes: number
  started: boolean
  goals: number
  assists: number
  freeKickGoals: number
  penaltyGoals: number
  headerGoals: number
  rating: number
  motm: boolean
  won: boolean
  drew: boolean
  goalsFor: number
  goalsAgainst: number
  cleanSheet: boolean
  saves: number
  isKeeper: boolean
  red: boolean
  injured: boolean
}

export const LAST_MATCH_FLAG = 'c:lastMatch'

/** Minimal match event shape (sim/match MatchEvent). */
interface FeatEvent {
  type: string
  side: 'home' | 'away' | null
  playerId?: string
}

/**
 * Classify the hero's goals from the event stream: a goal resolved from a
 * highlight that followed a hero-side free kick is a free-kick goal, one that
 * followed a corner is a header (the corner moment is a header chance).
 */
export function heroGoalKinds(events: readonly FeatEvent[], side: 'home' | 'away', heroId: string): { freeKick: number; header: number } {
  let freeKick = 0
  let header = 0
  for (let i = 0; i < events.length; i++) {
    const e = events[i]
    if (e.type !== 'goal' || e.playerId !== heroId) continue
    let j = i - 1
    while (j >= 0 && events[j].type !== 'highlight') j--
    if (j < 0 || events[j].playerId !== heroId) continue
    let k = j - 1
    while (k >= 0 && events[k].type === 'commentary') k--
    const before = events[k]
    if (!before || before.side !== side) continue
    if (before.type === 'freekick') freeKick++
    else if (before.type === 'corner') header++
  }
  return { freeKick, header }
}
export const RECORDS_FLAG = 'c:records'
/** JSON {@link ClubSeasonBase}: hero goals/assists before the first match for the current club this season. */
export const CLUB_BASE_FLAG = 'c:clubBase'
/** JSON string[]: `season|clubId|key` club records already celebrated with a headline. */
export const CLUB_NEWS_FLAG = 'c:clubRecNews'

interface ClubSeasonBase { clubId: string; season: number; goals: number; assists: number }
export const CLUB_RECORDS_FLAG = 'c:clubRecords'

export interface RecordValue {
  value: number
  season: number
  /** Holder name (club records). */
  name?: string
  isHero?: boolean
  note?: string
}

export type PersonalRecordKey =
  | 'goalsSeason' | 'assistsSeason' | 'goalsMatch' | 'assistsMatch' | 'bestRating' | 'youngestGoal'
  | 'scoringStreak' | 'highestWage' | 'mostFollowers' | 'savesMatch'
export type PersonalRecords = Partial<Record<PersonalRecordKey, RecordValue>> & { streak?: number }

export type ClubRecordKey = 'goalsSeason' | 'assistsSeason' | 'youngestScorer' | 'biggestWin'
export type ClubRecords = Partial<Record<ClubRecordKey, RecordValue>>

export const PERSONAL_RECORD_NAMES: Readonly<Record<PersonalRecordKey, LText>> = {
  goalsSeason: lt('Bir sezonda en çok gol', 'Most goals in a season'),
  assistsSeason: lt('Bir sezonda en çok asist', 'Most assists in a season'),
  goalsMatch: lt('Bir maçta en çok gol', 'Most goals in a match'),
  assistsMatch: lt('Bir maçta en çok asist', 'Most assists in a match'),
  bestRating: lt('En yüksek maç reytingi', 'Highest match rating'),
  youngestGoal: lt('İlk golündeki yaşın', 'Age at first goal'),
  scoringStreak: lt('Üst üste gol attığı maç', 'Longest scoring streak'),
  highestWage: lt('En yüksek haftalık maaş', 'Highest weekly wage'),
  mostFollowers: lt('En çok takipçi', 'Most followers'),
  savesMatch: lt('Bir maçta en çok kurtarış', 'Most saves in a match'),
}

export const CLUB_RECORD_NAMES: Readonly<Record<ClubRecordKey, LText>> = {
  goalsSeason: lt('Bir sezonda en çok gol', 'Most goals in a season'),
  assistsSeason: lt('Bir sezonda en çok asist', 'Most assists in a season'),
  youngestScorer: lt('En genç golcü', 'Youngest scorer'),
  biggestWin: lt('En farklı galibiyet', 'Biggest win'),
}

export const personalRecords = (state: GameState): PersonalRecords => readJson<PersonalRecords>(state.life, RECORDS_FLAG, {})
export const allClubRecords = (state: GameState): Record<string, ClubRecords> => readJson<Record<string, ClubRecords>>(state.life, CLUB_RECORDS_FLAG, {})
export const lastMatchFeats = (state: GameState): MatchFeats | null => readJson<MatchFeats | null>(state.life, LAST_MATCH_FLAG, null)

/** Club records, seeded with a historical baseline that scales with club reputation. */
export function clubRecordsFor(state: GameState, clubId: string): ClubRecords {
  const all = allClubRecords(state)
  if (all[clubId]) return all[clubId]
  const c = state.world.clubs[clubId]
  const rep = c?.reputation ?? 40
  const legend = lt('Kulüp efsanesi', 'Club legend')
  const base = state.calendar.season - 20
  return {
    goalsSeason: { value: Math.round(10 + rep * 0.22), season: base, name: legend.en },
    assistsSeason: { value: Math.round(7 + rep * 0.12), season: base + 3, name: legend.en },
    youngestScorer: { value: 17, season: base + 6, name: legend.en },
    biggestWin: { value: Math.round(3 + rep / 30), season: base + 9, name: '' },
  }
}

export interface BrokenRecord {
  scope: 'personal' | 'club'
  key: string
  value: number
  previous: number
}

const better = (key: string, v: number, prev: number | undefined): boolean =>
  prev === undefined ? true : key === 'youngestGoal' || key === 'youngestScorer' ? v < prev : v > prev

/** Update personal + club records after a hero match. Returns what was broken by the hero. */
export function updateRecordsAfterMatch(state: GameState, feats: MatchFeats): BrokenRecord[] {
  const h = state.hero
  const season = state.calendar.season
  const broken: BrokenRecord[] = []
  const pr = personalRecords(state)
  const setP = (key: PersonalRecordKey, value: number, note?: string): void => {
    const prev = pr[key]?.value
    if (value <= 0 && key !== 'youngestGoal') return
    if (!better(key, value, prev)) return
    pr[key] = { value, season, ...(note ? { note } : {}) }
    if (prev !== undefined) broken.push({ scope: 'personal', key, value, previous: prev })
  }
  setP('goalsSeason', h.seasonStats.goals)
  setP('assistsSeason', h.seasonStats.assists)
  setP('goalsMatch', feats.goals, feats.opponent)
  setP('assistsMatch', feats.assists, feats.opponent)
  if (feats.minutes > 0) setP('bestRating', Math.round(feats.rating * 10) / 10, feats.opponent)
  if (feats.goals > 0 && pr.youngestGoal === undefined) pr.youngestGoal = { value: heroAge(h, season), season }
  pr.streak = feats.goals > 0 ? (pr.streak ?? 0) + 1 : feats.minutes > 0 ? 0 : (pr.streak ?? 0)
  setP('scoringStreak', pr.streak ?? 0)
  if (feats.isKeeper) setP('savesMatch', feats.saves, feats.opponent)
  if (h.contract) setP('highestWage', h.contract.wage)
  setP('mostFollowers', state.life.followers)
  writeJson(state.life, RECORDS_FLAG, pr)

  // ── Club records ──
  const club = heroClub(state)
  if (club) {
    const all = allClubRecords(state)
    const cr = clubRecordsFor(state, club.id)
    const heroName = `${h.firstName} ${h.lastName}`
    // Only goals for THIS club count toward its records (a mid-season signing brings no goals with them).
    let base = readJson<ClubSeasonBase | null>(state.life, CLUB_BASE_FLAG, null)
    if (!base || base.clubId !== club.id || base.season !== season) {
      base = { clubId: club.id, season, goals: Math.max(0, h.seasonStats.goals - feats.goals), assists: Math.max(0, h.seasonStats.assists - feats.assists) }
      writeJson(state.life, CLUB_BASE_FLAG, base)
    }
    const clubGoals = Math.max(0, h.seasonStats.goals - base.goals)
    const clubAssists = Math.max(0, h.seasonStats.assists - base.assists)
    const contenders: { name: string; goals: number; assists: number; age: number; isHero: boolean }[] = [
      { name: heroName, goals: clubGoals, assists: clubAssists, age: heroAge(h, season), isHero: true },
      ...squadPlayers(state.world, club.id).map((p) => ({ name: `${p.firstName} ${p.lastName}`, goals: p.stats.goals, assists: p.stats.assists, age: season - p.birthYear, isHero: false })),
    ]
    const setC = (key: ClubRecordKey, value: number, name: string, isHero: boolean): void => {
      const prev = cr[key]
      if (!better(key, value, prev?.value) || (prev && prev.value === value)) return
      cr[key] = { value, season, name, isHero }
      if (isHero) broken.push({ scope: 'club', key, value, previous: prev?.value ?? 0 })
    }
    for (const c of contenders) {
      if (c.goals > 0) setC('goalsSeason', c.goals, c.name, c.isHero)
      if (c.assists > 0) setC('assistsSeason', c.assists, c.name, c.isHero)
    }
    if (feats.goals > 0) setC('youngestScorer', heroAge(h, season), heroName, true)
    const margin = feats.goalsFor - feats.goalsAgainst
    if (margin > 0) setC('biggestWin', margin, `${feats.goalsFor}-${feats.goalsAgainst} vs ${feats.opponent}`, feats.goals > 0)
    all[club.id] = cr
    writeJson(state.life, CLUB_RECORDS_FLAG, all)

    const celebrated = readJson<string[]>(state.life, CLUB_NEWS_FLAG, [])
    for (const b of broken.filter((x) => x.scope === 'club')) {
      const name = CLUB_RECORD_NAMES[b.key as ClubRecordKey]
      // Extending a record you already broke this season is a quiet log line, not a new headline every week.
      const tag = `${season}|${club.id}|${b.key}`
      if (celebrated.includes(tag)) {
        log(state, [], fill(lt('📈 Rekorunu geliştirdin: {r} artık {v} ({c})', '📈 You extended your record: {r} is now {v} ({c})'), { r: name, v: b.value, c: club.name }), 'award', '📈')
        continue
      }
      celebrated.push(tag)
      writeJson(state.life, CLUB_NEWS_FLAG, celebrated.slice(-40))
      log(state, [], fill(lt('Kulüp rekoru! {r}: {v} ({c})', 'Club record! {r}: {v} ({c})'), { r: name, v: b.value, c: club.name }), 'award', '📈')
      // Own RNG (seeded from the record) so records never shift the career's main RNG stream.
      const rng = new Rng(hashString(`${state.meta.id}|${season}|${state.calendar.week}|${b.key}|${b.value}`))
      pushNews(state.life, rng, state.calendar, fill(lt('{n} {c} tarihine geçti: {r}', '{n} makes {c} history: {r}'), { n: heroName, c: club.name, r: name }), 1, 'StarPath Sports')
    }
  }
  return broken
}
