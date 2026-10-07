/**
 * Personal objectives (playtest 2026-10: "the season is a loop of train → match →
 * card"; NSS fans' top late-game complaint is "boring routine").
 *
 * People in the hero's life set short goals with a deadline and a reward:
 *  - the manager (score / assist / clean sheets / rating / earn your place),
 *  - the fans (win a run of matches),
 *  - a sponsor (grow followers),
 *  - the family (come home before a birthday),
 *  - the agent during a window (put yourself in the shop window → transfer buzz),
 * plus two season goals set at week 1 (board league target, personal season
 * target) resolved at the end of the season.
 *
 * Rewards are mostly relationships, trust and small money; reputation only for
 * season goals (fame stays earned on the pitch). Failing a manager goal costs a
 * little trust; other misses are just missed. Generation uses its own hashed RNG
 * so it never shifts the career's main RNG stream.
 *
 * State lives in `life.flags['g:objectives']` (JSON). UI selector: {@link objectivesView}.
 */
import type { GameState, LText, Position } from '../../core/types'
import { Rng, hashString } from '../../core/rng'
import { absWeek, clamp, fameGain, fill, fmtMoney, heroAge, lt, meter } from '../career/common'
import { changeRelation } from '../life/relationships'
import { clubStrength } from '../world/queries'
import { END_OF_SEASON_WEEK, LAST_MATCH_WEEK } from '../world/fixtures'
import { GFLAG, heroClub, log, readJson, transferWindow, writeJson } from './internal'
import { LAST_MATCH_FLAG, type MatchFeats } from './records'
import type { SeasonDigest } from './season'

export const OBJECTIVES_FLAG = 'g:objectives'
/** Most short objectives running at once. */
export const MAX_ACTIVE = 3

export type ObjectiveSource = 'manager' | 'fans' | 'sponsor' | 'family' | 'agent' | 'board' | 'self'
export type ObjectiveKind =
  | 'goals' | 'assists' | 'cleanSheets' | 'rating' | 'apps' | 'wins' | 'followers' | 'familyVisit' | 'noCards'
  | 'leaguePos' | 'seasonGoals' | 'seasonCleanSheets' | 'seasonApps'

export interface ObjectiveReward {
  money?: number
  reputation?: number
  trust?: number
  morale?: number
  happiness?: number
  /** Relationship id → change. */
  rel?: Record<string, number>
  /** Transfer buzz (more offers). */
  buzz?: number
}

export interface Objective {
  id: string
  source: ObjectiveSource
  kind: ObjectiveKind
  title: LText
  desc: LText
  target: number
  progress: number
  /** For `rating`: sum of ratings so far (progress = matches counted). */
  sum?: number
  /** Baseline for state-derived kinds (followers). */
  base?: number
  startWeek: number
  /** Absolute week the objective expires at its start (inclusive deadline = previous week). */
  deadlineWeek: number
  season: number
  reward: ObjectiveReward
  penalty?: ObjectiveReward
  status: 'active' | 'done' | 'failed'
}

interface Store {
  active: Objective[]
  /** Finished objectives, most recent first (max 12). */
  history: Objective[]
  done: number
  failed: number
  /** Last hero match fixture counted. */
  seen?: string
  /** Absolute week of the last short objective handed out per source. */
  lastBy: Partial<Record<ObjectiveSource, number>>
  serial: number
  /** `season:reason` family reasons already used. */
  famUsed?: string[]
}

const emptyStore = (): Store => ({ active: [], history: [], done: 0, failed: 0, lastBy: {}, serial: 0 })
const load = (s: GameState): Store => ({ ...emptyStore(), ...readJson<Partial<Store>>(s.life, OBJECTIVES_FLAG, {}) })
const save = (s: GameState, st: Store): void => writeJson(s.life, OBJECTIVES_FLAG, st)

const SOURCE_NAME: Record<ObjectiveSource, LText> = {
  manager: lt('Hoca', 'Manager'), fans: lt('Taraftar', 'Fans'), sponsor: lt('Sponsor', 'Sponsor'), family: lt('Aile', 'Family'),
  agent: lt('Menajer', 'Agent'), board: lt('Yönetim', 'Board'), self: lt('Kişisel', 'Personal'),
}
const SOURCE_ICON: Record<ObjectiveSource, string> = { manager: '📋', fans: '📣', sponsor: '🤝', family: '🏠', agent: '🕴️', board: '🏛️', self: '⭐' }

const ATTACK: readonly Position[] = ['ST', 'LW', 'RW', 'AM']
const isGk = (p: Position): boolean => p === 'GK'
const isDef = (p: Position): boolean => p === 'CB' || p === 'LB' || p === 'RB'
/** Typical goals per appearance by position (used when the season sample is small). */
const GOAL_RATE: Partial<Record<Position, number>> = { ST: 0.45, LW: 0.3, RW: 0.3, AM: 0.28, CM: 0.12, DM: 0.06 }
const ASSIST_RATE: Partial<Record<Position, number>> = { AM: 0.3, LW: 0.25, RW: 0.25, CM: 0.2, ST: 0.15, LB: 0.1, RB: 0.1 }

/** Objectives currently shown to the player. */
export interface ObjectiveView {
  id: string
  source: ObjectiveSource
  sourceName: LText
  icon: string
  title: LText
  desc: LText
  progress: number
  target: number
  /** 0..1 for a progress bar. */
  ratio: number
  /** Weeks left including the current one (season goals: until the season ends). */
  weeksLeft: number
  reward: LText
  penalty: LText | null
  seasonal: boolean
}

export interface ObjectivesView {
  active: ObjectiveView[]
  recent: { title: LText; status: 'done' | 'failed'; source: ObjectiveSource; icon: string }[]
  done: number
  failed: number
}

/** Pure selector for the UI (dashboard card + objectives list). */
export function objectivesView(state: GameState): ObjectivesView {
  const st = load(state)
  const now = absWeek(state.calendar)
  const seasonEnd = absWeek({ season: state.calendar.season, week: END_OF_SEASON_WEEK })
  return {
    active: st.active.map((o) => ({
      id: o.id, source: o.source, sourceName: SOURCE_NAME[o.source], icon: SOURCE_ICON[o.source], title: o.title, desc: o.desc,
      progress: o.kind === 'rating' ? Math.round(((o.sum ?? 0) / Math.max(1, o.progress)) * 10) / 10 : o.progress,
      target: o.target, ratio: clamp(ratioOf(o), 0, 1),
      weeksLeft: Math.max(0, (seasonal(o) ? seasonEnd : o.deadlineWeek) - now),
      reward: rewardText(o.reward), penalty: o.penalty ? rewardText(o.penalty) : null, seasonal: seasonal(o),
    })),
    recent: st.history.slice(0, 5).map((o) => ({ title: o.title, status: o.status === 'done' ? 'done' as const : 'failed' as const, source: o.source, icon: SOURCE_ICON[o.source] })),
    done: st.done,
    failed: st.failed,
  }
}

const seasonal = (o: Objective): boolean => o.kind === 'leaguePos' || o.kind === 'seasonGoals' || o.kind === 'seasonCleanSheets' || o.kind === 'seasonApps'

function ratioOf(o: Objective): number {
  if (o.kind === 'rating') return o.progress === 0 ? 0 : o.progress / o.target
  if (o.kind === 'leaguePos') return 0
  return o.progress / Math.max(1, o.target)
}

function rewardText(r: ObjectiveReward): LText {
  const parts: LText[] = []
  if (r.money) parts.push(fmtMoney(r.money))
  if (r.reputation) parts.push(fill(lt('itibar {n}', 'reputation {n}'), { n: r.reputation > 0 ? `+${r.reputation}` : r.reputation }))
  if (r.trust) parts.push(fill(lt('hoca güveni {n}', 'manager trust {n}'), { n: r.trust > 0 ? `+${r.trust}` : r.trust }))
  if (r.buzz) parts.push(lt('transfer ilgisi artar', 'more transfer interest'))
  if (r.happiness) parts.push(fill(lt('mutluluk {n}', 'happiness {n}'), { n: r.happiness > 0 ? `+${r.happiness}` : r.happiness }))
  if (r.morale) parts.push(fill(lt('moral {n}', 'morale {n}'), { n: r.morale > 0 ? `+${r.morale}` : r.morale }))
  for (const [id, v] of Object.entries(r.rel ?? {})) parts.push(fill(lt('{w} {n}', '{w} {n}'), { w: REL_NAME[id] ?? lt(id, id), n: v > 0 ? `+${v}` : v }))
  return { tr: parts.map((p) => p.tr).join(', '), en: parts.map((p) => p.en).join(', ') }
}

const REL_NAME: Record<string, LText> = {
  manager: lt('hoca', 'manager'), fans: lt('taraftar', 'fans'), mother: lt('annen', 'mum'), father: lt('baban', 'dad'),
  chairman: lt('başkan', 'chairman'), agent: lt('menajer', 'agent'),
}

// ───────────────────────── Engine hooks ─────────────────────────

/**
 * Daily hook (end of each day, after the day's matches): counts the hero's
 * latest match once, updates state-derived goals, completes what is reached.
 */
export function objectivesDaily(state: GameState, out: LText[]): void {
  const st = load(state)
  if (!st.active.length && st.seen !== undefined) return
  const feats = readJson<MatchFeats | null>(state.life, LAST_MATCH_FLAG, null)
  if (feats && feats.fixtureId !== st.seen) {
    st.seen = feats.fixtureId
    if (feats.minutes > 0) for (const o of st.active) countMatch(o, feats)
  }
  for (const o of st.active) refreshState(state, o)
  settle(state, st, out, false)
  save(state, st)
}

/** Weekly hook (new week): expire overdue objectives, maybe hand out a new one. */
export function objectivesWeekly(state: GameState, out: LText[]): void {
  if (state.hero.retired) return
  const st = load(state)
  for (const o of st.active) refreshState(state, o)
  settle(state, st, out, true)
  const cal = state.calendar
  if (cal.week === 1) addSeasonObjectives(state, st, out)
  if (cal.week >= 1 && cal.week <= LAST_MATCH_WEEK - 3 && heroClub(state)) {
    const rng = new Rng(hashString(`${state.meta.id}|obj|${absWeek(cal)}`))
    const short = st.active.filter((o) => !seasonal(o)).length
    // Usually one new goal every ~2 weeks, never more than MAX_ACTIVE short ones.
    if (short < MAX_ACTIVE && rng.chance(short === 0 ? 0.75 : short === 1 ? 0.35 : 0.15)) {
      const o = pickObjective(state, st, rng)
      if (o) {
        st.active.push(o)
        st.lastBy[o.source] = absWeek(cal)
        log(state, out, fill(lt('Yeni hedef ({s}): {t}', 'New objective ({s}): {t}'), { s: SOURCE_NAME[o.source], t: o.title }), 'career', '🎯')
      }
    }
  }
  save(state, st)
}

/** Season-end hook (END_OF_SEASON_WEEK, after the season digest exists). */
export function objectivesSeasonEnd(state: GameState, out: LText[]): void {
  const st = load(state)
  const dg = readJson<SeasonDigest | null>(state.life, GFLAG.lastSeason, null)
  // Short objectives still running when the season stops are dropped quietly (no fault of the player).
  st.active = st.active.filter(seasonal)
  for (const o of st.active) {
    if (o.kind === 'leaguePos') {
      const pos = dg && dg.season === o.season ? dg.leaguePosition : null
      o.progress = pos ?? 99
      o.status = pos !== null && pos <= o.target ? 'done' : 'failed'
    } else {
      refreshState(state, o)
      o.status = o.progress >= o.target ? 'done' : 'failed'
    }
  }
  settle(state, st, out, true, true)
  save(state, st)
}

function countMatch(o: Objective, f: MatchFeats): void {
  switch (o.kind) {
    case 'goals': o.progress += f.goals; break
    case 'assists': o.progress += f.assists; break
    case 'cleanSheets': if (f.cleanSheet && f.minutes >= 60) o.progress++; break
    case 'wins': if (f.won) o.progress++; break
    case 'apps': o.progress++; break
    case 'noCards': if (f.red) o.progress = -99; else o.progress++; break
    case 'rating': o.progress++; o.sum = (o.sum ?? 0) + f.rating; break
    default: break
  }
}

function refreshState(state: GameState, o: Objective): void {
  const h = state.hero
  switch (o.kind) {
    case 'followers': o.progress = Math.max(0, state.life.followers - (o.base ?? state.life.followers)); break
    case 'familyVisit': {
      const fam = ['mother', 'father', 'sibling'].map((id) => state.life.relationships[id]?.lastContactWeek ?? -1)
      if (Math.max(...fam) >= o.startWeek) o.progress = 1
      break
    }
    case 'seasonGoals': if (h.seasonStats) o.progress = h.seasonStats.goals; break
    case 'seasonCleanSheets': if (h.seasonStats) o.progress = h.seasonStats.cleanSheets; break
    case 'seasonApps': if (h.seasonStats) o.progress = h.seasonStats.apps; break
    default: break
  }
}

/** Complete / fail objectives; `deadlines` also expires overdue ones. */
function settle(state: GameState, st: Store, out: LText[], deadlines: boolean, seasonEnd = false): void {
  const now = absWeek(state.calendar)
  const keep: Objective[] = []
  for (const o of st.active) {
    if (o.status === 'active' && !seasonal(o)) {
      if (o.kind === 'rating') {
        if (o.progress >= o.target) o.status = (o.sum ?? 0) / o.progress >= ratingGoal(o) ? 'done' : 'failed'
      } else if (o.kind === 'noCards') {
        if (o.progress < 0) o.status = 'failed'
        else if (o.progress >= o.target) o.status = 'done'
      } else if (o.progress >= o.target) o.status = 'done'
      if (o.status === 'active' && deadlines && now >= o.deadlineWeek) o.status = 'failed'
    } else if (o.status === 'active' && seasonal(o) && o.kind !== 'leaguePos' && o.progress >= o.target && !seasonEnd) {
      o.status = 'done'
    }
    if (o.status === 'active') {
      keep.push(o)
      continue
    }
    finish(state, st, o, out)
  }
  st.active = keep
}

/** The rating objective stores its threshold ×10 in `base`. */
const ratingGoal = (o: Objective): number => (o.base ?? 70) / 10

function finish(state: GameState, st: Store, o: Objective, out: LText[]): void {
  if (o.status === 'done') {
    st.done++
    applyReward(state, o.reward, o)
    log(state, out, fill(lt('Hedef tamamlandı ({s}): {t}. Ödül: {r}', 'Objective complete ({s}): {t}. Reward: {r}'), { s: SOURCE_NAME[o.source], t: o.title, r: rewardText(o.reward) }), 'career', '🎯')
  } else {
    st.failed++
    if (o.penalty) applyReward(state, o.penalty, o)
    log(state, out, fill(lt('Hedef kaçtı ({s}): {t}{p}', 'Objective missed ({s}): {t}{p}'), {
      s: SOURCE_NAME[o.source], t: o.title, p: o.penalty ? { tr: ` (${rewardText(o.penalty).tr})`, en: ` (${rewardText(o.penalty).en})` } : '',
    }), 'career', '⌛')
  }
  st.history.unshift(o)
  st.history = st.history.slice(0, 12)
}

function applyReward(state: GameState, r: ObjectiveReward, o: Objective): void {
  const { hero: h, life } = state
  const week = absWeek(state.calendar)
  if (r.money) life.money += r.money
  if (r.reputation) h.reputation = clamp(Math.round((h.reputation + fameGain(h.reputation, r.reputation)) * 100) / 100, 0, 100)
  if (r.trust) h.managerTrust = meter(h.managerTrust + r.trust)
  if (r.morale) h.morale = meter(h.morale + r.morale)
  if (r.happiness) life.happiness = meter(life.happiness + r.happiness)
  if (r.buzz) life.flags.transfer_buzz = (typeof life.flags.transfer_buzz === 'number' ? life.flags.transfer_buzz : 0) + r.buzz
  for (const [id, v] of Object.entries(r.rel ?? {})) changeRelation(life, id, v, { hero: h, week, cause: 'other', why: o.title, contact: id !== 'fans' })
}

// ───────────────────────── Generation ─────────────────────────

function mk(state: GameState, st: Store, source: ObjectiveSource, kind: ObjectiveKind, title: LText, desc: LText, target: number, weeks: number, reward: ObjectiveReward, penalty?: ObjectiveReward, extra: Partial<Objective> = {}): Objective {
  st.serial++
  const now = absWeek(state.calendar)
  return {
    id: `o${st.serial}`, source, kind, title, desc, target, progress: 0, startWeek: now, deadlineWeek: now + weeks,
    season: state.calendar.season, reward, ...(penalty ? { penalty } : {}), status: 'active', ...extra,
  }
}

function pickObjective(state: GameState, st: Store, rng: Rng): Objective | null {
  const h = state.hero
  const life = state.life
  const now = absWeek(state.calendar)
  const wage = h.contract?.wage ?? 500
  const pos = h.position
  const busy = new Set(st.active.map((o) => o.source))
  const fresh = (src: ObjectiveSource, gap: number): boolean => !busy.has(src) && now - (st.lastBy[src] ?? -99) >= gap
  const apps = h.seasonStats?.apps ?? 0
  const role = h.contract?.role ?? 'reserve'
  const benched = role === 'youth' || role === 'reserve'
  const cands: { w: number; make: () => Objective }[] = []

  if (fresh('manager', 3)) {
    if (benched) {
      cands.push({ w: 3, make: () => mk(state, st, 'manager', 'apps',
        lt('Formayı hak et: 3 hafta içinde 2 maçta süre al', 'Earn your shirt: play in 2 matches within 3 weeks'),
        lt('Hoca seni izliyor. Antrenmanda göz dol, maçlarda süre al.', 'The manager is watching. Impress in training and get minutes.'),
        2, 3, { trust: 4, morale: 4, rel: { manager: 4 } }) })
    }
    if (ATTACK.includes(pos) || (GOAL_RATE[pos] ?? 0) >= 0.1) {
      const rate = apps >= 6 ? (h.seasonStats.goals / apps) : GOAL_RATE[pos] ?? 0.1
      const target = clamp(Math.round(rate * 3 * 0.9), 1, 3)
      cands.push({ w: ATTACK.includes(pos) ? 3 : 1, make: () => mk(state, st, 'manager', 'goals',
        fill(lt('Önümüzdeki 3 haftada {n} gol at', 'Score {n} goal(s) in the next 3 weeks'), { n: target }),
        lt('Hoca: "Senden gol bekliyorum. Kendini göster."', 'The manager: "I need goals from you. Show me."'),
        target, 3, { trust: 4, rel: { manager: 5 }, money: Math.round(wage * 0.3) }, { trust: -2 }) })
    }
    if ((ASSIST_RATE[pos] ?? 0) >= 0.2) {
      const rate = apps >= 6 ? Math.max(0.1, h.seasonStats.assists / apps) : ASSIST_RATE[pos] ?? 0.2
      const target = rate * 4 >= 1.8 ? 2 : 1
      cands.push({ w: 2, make: () => mk(state, st, 'manager', 'assists',
        fill(lt('4 hafta içinde {n} asist yap', 'Make {n} assist(s) within 4 weeks'), { n: target }),
        lt('Hoca: "Oyunu kur, arkadaşlarını gole sok."', 'The manager: "Create. Put your teammates through."'),
        target, 4, { trust: 4, rel: { manager: 4 }, money: Math.round(wage * 0.25) }, { trust: -2 }) })
    }
    if (isGk(pos) || isDef(pos)) {
      cands.push({ w: 3, make: () => mk(state, st, 'manager', 'cleanSheets',
        lt('4 hafta içinde bir maçta kaleni gole kapat', 'Keep a clean sheet within 4 weeks'),
        lt('Hoca: "Arkayı kilitle. Gerisini biz hallederiz."', 'The manager: "Lock the back door. We\'ll do the rest."'),
        1, 4, { trust: 4, rel: { manager: 5 }, money: Math.round(wage * 0.3) }, { trust: -2 }) })
    }
    if (!benched) {
      const goal = h.form >= 65 ? 6.8 : 6.5
      cands.push({ w: 2, make: () => mk(state, st, 'manager', 'rating',
        fill(lt('Sıradaki 3 maçta ortalama {r}+ reyting', 'Average {r}+ rating over your next 3 matches'), { r: goal.toFixed(1) }),
        lt('Hoca istikrar istiyor: üç maç üst üste iyi oyna.', 'The manager wants consistency: three good games in a row.'),
        3, 5, { trust: 5, morale: 4, rel: { manager: 4 } }, { trust: -2 }, { base: Math.round(goal * 10), sum: 0 }) })
    }
    if (life.discipline < 60 || (h.seasonStats?.yellow ?? 0) >= 3) {
      cands.push({ w: 2, make: () => mk(state, st, 'manager', 'noCards',
        lt('Sakin kal: 4 maç kırmızı kart görme', 'Keep your head: no red card in 4 matches'),
        lt('Hoca: "Sinirlerine hâkim ol, takımı eksik bırakma."', 'The manager: "Control your temper. Don\'t leave us a man down."'),
        4, 6, { trust: 3, rel: { manager: 3 } }, undefined) })
    }
  }
  if (fresh('fans', 5) && !benched) {
    // Wins depend on the whole team: ask a favourite for two, an underdog for one.
    const club = heroClub(state)
    const league = club ? state.world.leagues[club.leagueId] : undefined
    const ids = league?.clubIds.filter((id) => state.world.clubs[id]) ?? []
    const mine = club ? clubStrength(state.world, club.id).overall : 0
    const rank = 1 + ids.filter((id) => club && id !== club.id && clubStrength(state.world, id).overall > mine).length
    const wins = ids.length && rank <= Math.ceil(ids.length / 3) ? 2 : 1
    cands.push({ w: 2, make: () => mk(state, st, 'fans', 'wins',
      wins === 2 ? lt('Taraftara söz: önümüzdeki 3 haftada 2 galibiyet', 'A promise to the fans: 2 wins in the next 3 weeks')
        : lt('Taraftara söz: önümüzdeki 3 haftada bir galibiyet', 'A promise to the fans: a win in the next 3 weeks'),
      lt('Tribünler pankart astı: "Galibiyet istiyoruz!"', 'The stands unfurled a banner: "We want wins!"'),
      wins, 3, { rel: { fans: 6 }, morale: 5 }) })
  }
  if (fresh('sponsor', 6) && life.sponsors.length > 0) {
    const gain = Math.max(150, Math.round(life.followers * 0.04))
    const brand = life.sponsors[0].brand
    cands.push({ w: 1.5, make: () => mk(state, st, 'sponsor', 'followers',
      fill(lt('{b} kampanyası: 3 haftada {n} yeni takipçi', '{b} campaign: {n} new followers in 3 weeks'), { b: brand, n: gain }),
      lt('Sponsorun kampanya dönemine girdi. Görünür ol: paylaşım, röportaj, iyi maç.', 'Your sponsor is running a campaign. Be visible: posts, interviews, big games.'),
      gain, 3, { money: Math.round(Math.max(life.sponsors[0].weekly * 1.5, wage * 0.2)) }, undefined, { base: life.followers }) })
  }
  if (fresh('family', 8) && (life.relationships.mother || life.relationships.father)) {
    // A birthday happens once a year: each family reason is used at most once per season.
    const who = life.relationships.mother ? 'mother' : 'father'
    const used = (st.famUsed ?? []).filter((k) => k.startsWith(`${state.calendar.season}:`))
    const reasons: { key: string; title: LText; rel: string }[] = [
      { key: 'mbday', rel: 'mother', title: lt('Annenin doğum günü: 2 hafta içinde ailene uğra', 'Mum\u2019s birthday: visit your family within 2 weeks') },
      { key: 'fbday', rel: 'father', title: lt('Babanın doğum günü: 2 hafta içinde ailene uğra', 'Dad\u2019s birthday: visit your family within 2 weeks') },
      { key: 'miss', rel: who, title: lt('Ailen seni özledi: 2 hafta içinde bir akşam onlara ayır', 'Your family misses you: give them an evening within 2 weeks') },
      { key: 'dinner', rel: who, title: lt('Pazar yemeği geleneği: 2 hafta içinde ailene uğra', 'Sunday dinner tradition: visit your family within 2 weeks') },
    ].filter((r) => life.relationships[r.rel] && !used.includes(`${state.calendar.season}:${r.key}`))
    if (reasons.length) {
      const r = reasons[Math.floor(rng.next() * reasons.length)]
      cands.push({ w: 1.2, make: () => {
        st.famUsed = [...(st.famUsed ?? []).slice(-8), `${state.calendar.season}:${r.key}`]
        return mk(state, st, 'family', 'familyVisit', r.title,
          lt('Takvimine not düş: bir akşamını aileye ayır.', 'Put it in your diary: give your family an evening.'),
          1, 2, { happiness: 6, rel: { [r.rel]: 8 } }, { rel: { [r.rel]: -5 } })
      } })
    }
  }
  if (fresh('agent', 10) && life.agent && transferWindow(state.calendar.week) !== null && !benched) {
    cands.push({ w: 2, make: () => mk(state, st, 'agent', 'rating',
      lt('Vitrine çık: 3 maçta ortalama 6.6+ reyting', 'Shop window: average 6.6+ over 3 matches'),
      lt('Menajerin: "Gözlemciler tribünde. Şimdi parlama zamanı."', 'Your agent: "Scouts are in the stands. Time to shine."'),
      3, 5, { buzz: 3, rel: { agent: 5 } }, undefined, { base: 66, sum: 0 }) })
  }
  if (!cands.length) return null
  return rng.weighted(cands, (c) => c.w).make()
}

function addSeasonObjectives(state: GameState, st: Store, out: LText[]): void {
  if (st.active.some((o) => seasonal(o) && o.season === state.calendar.season)) return
  const club = heroClub(state)
  const h = state.hero
  if (!club) return
  const wage = h.contract?.wage ?? 500
  const league = state.world.leagues[club.leagueId]
  const ids = league?.clubIds.filter((id) => state.world.clubs[id]) ?? []
  if (ids.length >= 6) {
    const strength = (id: string) => clubStrength(state.world, id).overall
    const rank = 1 + ids.filter((id) => id !== club.id && strength(id) > strength(club.id)).length
    const n = ids.length
    const target = rank <= 2 ? 3 : rank <= n / 2 ? Math.min(n, rank + 2) : Math.min(n - 3, rank + 2)
    const title = target <= 1 ? lt('Yönetim hedefi: şampiyonluk', 'Board target: win the league')
      : target >= n - 3 ? fill(lt('Yönetim hedefi: ligde kal ({n}. sıra veya üstü)', 'Board target: stay up ({n}th or better)'), { n: target })
        : fill(lt('Yönetim hedefi: ligi ilk {n} içinde bitir', 'Board target: finish in the top {n}'), { n: target })
    const o = mk(state, st, 'board', 'leaguePos', title,
      fill(lt('{c} yönetimi sezon başında çıtayı koydu. Başarırsan prim ve başkanın güveni seninle.', 'The {c} board set the bar. Hit it for a bonus and the chairman\'s backing.'), { c: club.name }),
      target, 60, { money: Math.round(wage * 1.2), reputation: 1, rel: { chairman: 8, fans: 4 } })
    st.active.push(o)
    log(state, out, fill(lt('Sezon hedefi ({s}): {t}', 'Season objective ({s}): {t}'), { s: SOURCE_NAME.board, t: title }), 'career', '🎯')
  }
  const last = h.history[h.history.length - 1]
  const age = heroAge(h, state.calendar.season)
  const role = h.contract?.role ?? 'reserve'
  let o: Objective
  if (role === 'youth' || role === 'reserve' || age <= 18) {
    const target = role === 'youth' || role === 'reserve' ? 10 : 18
    o = mk(state, st, 'self', 'seasonApps', fill(lt('Kişisel hedef: sezonda {n} maça çık', 'Personal goal: {n} appearances this season'), { n: target }),
      lt('İlk adım: sahada olmak.', 'Step one: be on the pitch.'), target, 60, { morale: 6, reputation: 1, rel: { manager: 3 } })
  } else if (isGk(h.position) || isDef(h.position)) {
    const prev = last && last.stats.apps >= 10 ? last.stats.cleanSheets : 6
    const target = clamp(Math.round(prev * 1.1) + 1, 5, 20)
    o = mk(state, st, 'self', 'seasonCleanSheets', fill(lt('Kişisel hedef: {n} kez gol yememek', 'Personal goal: {n} clean sheets'), { n: target }),
      lt('Geçen sezonu geride bırak.', 'Beat last season.'), target, 60, { morale: 6, reputation: 2, money: Math.round(wage * 0.8) })
  } else {
    const base = Math.round((GOAL_RATE[h.position] ?? 0.1) * 28)
    const prev = last && last.stats.apps >= 10 ? last.stats.goals : base
    const target = clamp(Math.round(prev * 1.1) + 1, 2, 45)
    o = mk(state, st, 'self', 'seasonGoals', fill(lt('Kişisel hedef: sezonu {n} golle bitir', 'Personal goal: finish the season on {n} goals'), { n: target }),
      lt('Geçen sezonu geride bırak.', 'Beat last season.'), target, 60, { morale: 6, reputation: 2, money: Math.round(wage * 0.8) })
  }
  st.active.push(o)
  log(state, out, fill(lt('Sezon hedefi ({s}): {t}', 'Season objective ({s}): {t}'), { s: SOURCE_NAME.self, t: o.title }), 'career', '🎯')
}
