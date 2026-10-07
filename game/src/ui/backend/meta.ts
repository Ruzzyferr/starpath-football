/**
 * Career-end & career-depth bridge (WP-7 / WP-8) between the UI and the sim:
 *
 *  - Global meta data (achievements + Hall of Fame) in {@link MetaStore}
 *    (outside the save slots), published through the {@link metaData} signal.
 *  - The EVENT-DRIVEN achievement checker: every committed state is turned
 *    into achievement events (new match feats, new career, club records,
 *    leaving the casino, plain ticks); drills / trials / retirement emit their
 *    own events. Unlocks toast and are forwarded to Steam through
 *    `platform.achievements.unlock(id)`.
 *  - Actions & views for the retirement flow, documentary, Hall of Fame,
 *    Legacy New Game+, trials, records, potential, market reference.
 */
import { effect, signal } from '@preact/signals'
import type { GameState, LText } from '../../core/types'
import { lt as render, t } from '../../i18n'
import { absDayOf, GFLAG } from '../../sim/game/internal'
import { heroOvr } from '../../sim/career/progression'
import { potentialView, type PotentialView } from '../../sim/career/scouting'
import { marketReference, type MarketReference } from '../../sim/career/market'
import { ROLE_EXPECTED_MINUTES, formGuaranteeActive, recentRatings, type ComplaintApproach } from '../../sim/career/squadRole'
import { complainAboutBench } from '../../sim/game/actions'
import { weeksUntilDecay } from '../../sim/career/decay'
import {
  ACHIEVEMENT_BY_ID, achievementProgress, processAchievementEvent, type AchEvent, type AchievementDef, type AchievementProgress,
} from '../../sim/game/achievements'
import type { HallOfFameEntry, CareerSummary, PostCareerPath } from '../../sim/game/hallOfFame'
import { legacyStartFrom, type LegacyStart } from '../../sim/game/legacy'
import {
  CLUB_RECORD_NAMES, PERSONAL_RECORD_NAMES, allClubRecords, clubRecordsFor, lastMatchFeats, personalRecords,
  type ClubRecordKey, type PersonalRecordKey, type RecordValue,
} from '../../sim/game/records'
import { careerSummaryOf, continueCareer as continueFn, retireHero, retirementStatus, type RetirementStatus } from '../../sim/game/retirement'
import { autoTrialPerformance, hasPendingTrials, pendingTrials, resolveTrial, type TrialInvite } from '../../sim/game/trials'
import { applyMatch, challengeFor, weekKey, type ChallengeDef, type ChallengeDone, type MatchMetaResult } from '../../sim/game/localMeta'
import { MetaStore, type KeyValue, type MetaData } from '../../state/metaStore'
import { toast } from '../components/Toast'
import { screen, type ScreenId } from '../store'
import { readHistory } from './history'
import { saveState, scheduleAutosave } from './persistence'
import { commit, current, get, notify, onCommit } from './session'

// ───────────────────────── Global meta store ─────────────────────────

let store = new MetaStore()
export const metaData = signal<MetaData>(store.read())

/** Use another key-value backend (tests). */
export function useMetaStorage(kv: KeyValue): void {
  store = new MetaStore(kv)
  metaData.value = store.read()
  resetTracking()
}

function publish(): void {
  const d = store.read()
  metaData.value = { ...d, achievements: { ...d.achievements }, hallOfFame: [...d.hallOfFame], local: { ...d.local } }
}

// ───────────────────────── Achievements ─────────────────────────

/** Unlock sink (Steam). Loaded lazily so the platform layer stays out of tests. */
let unlockSink: (id: string) => void = (id) => {
  void import('../../platform').then((m) => m.platform.achievements.unlock(id)).catch(() => false)
}
export function setUnlockSink(fn: (id: string) => void): void {
  unlockSink = fn
}

/** Unlocks of this session (newest last), for tests / debug. */
export const recentUnlocks = signal<string[]>([])

/**
 * Screens where an unlock toast would cover the action (match flow): unlock
 * toasts are queued there and shown once the player is back in the shell.
 */
export const TOAST_QUIET_SCREENS: ReadonlySet<ScreenId> = new Set<ScreenId>(['preMatch', 'liveMatch', 'postMatch', 'seasonEnd'])
/** Toasts waiting for a non-match screen. */
export const queuedToasts = signal<AchievementDef[]>([])

function showToast(d: AchievementDef): void {
  try {
    toast(`🏆 ${render(d.name)} — ${render(d.desc)}`, 'reward', 'trophy', 5000)
  } catch {
    /* no DOM */
  }
}

/** Show queued unlock toasts when leaving the match flow. */
export function flushQueuedToasts(): void {
  if (TOAST_QUIET_SCREENS.has(screen.value.id) || queuedToasts.value.length === 0) return
  const list = queuedToasts.value
  queuedToasts.value = []
  for (const d of list) showToast(d)
}

function announce(defs: AchievementDef[]): void {
  for (const d of defs) {
    if (TOAST_QUIET_SCREENS.has(screen.value.id)) queuedToasts.value = [...queuedToasts.value, d]
    else showToast(d)
    try {
      unlockSink(d.id)
    } catch {
      /* ignore */
    }
  }
  if (defs.length) recentUnlocks.value = [...recentUnlocks.value, ...defs.map((d) => d.id)].slice(-50)
}

/** Feed one achievement event (also used by drills / trials / retirement). */
export function achievementEvent(ev: AchEvent, s: GameState | null = current()): AchievementDef[] {
  let unlocked: AchievementDef[] = []
  store.update((d) => {
    unlocked = processAchievementEvent(d.achievements, ev, s, Date.now())
  })
  publish()
  announce(unlocked)
  return unlocked
}

// ───────────────────────── Local meta: weekly challenge + bests ─────────────────────────

/** Fold a hero match into the weekly challenge / personal bests and celebrate. */
export function recordLocalMeta(feats: Parameters<typeof applyMatch>[1]): MatchMetaResult {
  let res: MatchMetaResult = { completed: null, newBests: [] }
  store.update((d) => {
    res = applyMatch(d.local, feats)
  })
  publish()
  if (res.completed) toast(t('board.toast.done', { n: render(res.completed.title) }), 'reward', 'trophy')
  else if (res.newBests.length) toast(t('board.toast.best'), 'success', 'star')
  return res
}

export interface WeeklyChallengeView {
  def: ChallengeDef
  key: string
  done: ChallengeDone | null
  streak: number
  bestStreak: number
  total: number
}

/** The current in-game week's challenge for the active career. */
export function weeklyChallengeView(): WeeklyChallengeView | null {
  const s = current()
  if (!s) return null
  const m = metaData.value.local
  const key = weekKey(s.calendar.season, s.calendar.week)
  return {
    def: challengeFor(s.calendar.season, s.calendar.week, s.hero.position === 'GK'),
    key,
    done: m.challenges[key] ?? null,
    streak: m.streak,
    bestStreak: m.bestStreak,
    total: Object.keys(m.challenges).length,
  }
}

/** Remember that the player has read What's New for this version. */
export function markWhatsNewSeen(version: string): void {
  store.update((d) => {
    d.local.seenVersion = version
  })
  publish()
}

// Commit-diff tracking → events.
let seenCareer: string | null = null
let seenMatch: string | null = null
let heroClubRecords = -1
let casino: { day: number; base: number } | null = null

function resetTracking(): void {
  seenCareer = null
  seenMatch = null
  heroClubRecords = -1
  casino = null
}

const heroRecordCount = (s: GameState): number =>
  Object.values(allClubRecords(s)).reduce((n, r) => n + Object.values(r).filter((v) => v?.isHero).length, 0)

/** Derive achievement events from a committed state. */
export function onStateCommitted(s: GameState): void {
  const events: AchEvent[] = []
  if (seenCareer !== s.meta.id) {
    seenCareer = s.meta.id
    seenMatch = lastMatchFeats(s)?.fixtureId ?? null
    heroClubRecords = heroRecordCount(s)
    casino = null
    // Count each career once (flag lives in the save).
    if (s.life.flags['c:started'] !== true && s.hero.careerStats.apps === 0) {
      s.life.flags['c:started'] = true
      events.push({ type: 'newCareer', legacy: typeof s.life.flags['c:legacyParentId'] === 'string' })
    }
  }
  const feats = lastMatchFeats(s)
  if (feats && feats.fixtureId !== seenMatch) {
    seenMatch = feats.fixtureId
    events.push({ type: 'match', feats })
    recordLocalMeta(feats)
  }
  const rc = heroRecordCount(s)
  if (rc > heroClubRecords && heroClubRecords >= 0) events.push({ type: 'records', broken: rc - heroClubRecords })
  heroClubRecords = rc
  // Casino: net result of a visit, emitted when the day moves on.
  const day = absDayOf(s)
  const net = s.life.casino.won - s.life.casino.lost
  if (casino && casino.day !== day) {
    events.push({ type: 'casinoLeave', net: net - casino.base })
    casino = null
  }
  if (!casino && s.life.flags[GFLAG.casinoDay] === day) casino = { day, base: net }
  if (events.length === 0) events.push({ type: 'tick' })
  for (const ev of events) achievementEvent(ev, s)
}

let installed = false
/** Hook the checker into every commit (call once from the real backend). */
export function installMeta(): void {
  if (installed) return
  installed = true
  onCommit((s) => onStateCommitted(s))
  effect(() => {
    void screen.value
    flushQueuedToasts()
  })
}

export function achievementsView(): { rows: AchievementProgress[]; unlocked: number; total: number } {
  const rows = achievementProgress(metaData.value.achievements)
  return { rows, unlocked: rows.filter((r) => r.unlocked).length, total: rows.length }
}

export const achievementName = (id: string): LText | null => ACHIEVEMENT_BY_ID[id]?.name ?? null

// ───────────────────────── Retirement, documentary, Hall of Fame ─────────────────────────

export function retirementView(): RetirementStatus | null {
  const s = current()
  return s ? retirementStatus(s) : null
}

/** "One more season". */
export function continueCareer(): void {
  const s = get()
  const lines = continueFn(s)
  notify(lines[0], 'info')
  commit(s)
  scheduleAutosave()
}

/** Retire the hero: documentary + Hall of Fame entry (global) + achievements. */
export function retireNow(opts: { testimonial?: boolean; postCareer?: PostCareerPath } = {}): CareerSummary | null {
  const s = get()
  const peak = Math.max(heroOvr(s.hero), ...readHistory(s).ovr)
  const r = retireHero(s, { testimonial: opts.testimonial, postCareer: opts.postCareer, peakOvr: peak, retiredAt: Date.now() })
  if (!r.ok || !r.summary) {
    notify(r.lines[0])
    return null
  }
  store.addHallOfFame(r.summary)
  publish()
  achievementEvent({ type: 'retired', summary: r.summary }, s)
  commit(s)
  void saveState(s).catch((e: unknown) => console.warn('[StarPath] save after retirement failed', e))
  return r.summary
}

/** The documentary of `careerId` (Hall of Fame) or of the current retired hero. */
export function summaryView(careerId?: string): CareerSummary | null {
  if (careerId) {
    const e = metaData.value.hallOfFame.find((x) => x.careerId === careerId)
    if (e) return e
  }
  const s = current()
  return s ? careerSummaryOf(s) : null
}

export const hallOfFame = (): HallOfFameEntry[] => [...metaData.value.hallOfFame].sort((a, b) => b.legacyScore - a.legacyScore)

/** Legacy (New Game+) terms for a Hall of Fame entry. */
export function legacyFor(careerId: string): LegacyStart | null {
  const e = metaData.value.hallOfFame.find((x) => x.careerId === careerId)
  return e ? legacyStartFrom(e) : null
}

// ───────────────────────── Trials ─────────────────────────

export const trialInvites = (): TrialInvite[] => {
  const s = current()
  return s ? pendingTrials(s) : []
}
export const needsTrial = (): boolean => {
  const s = current()
  return !!s && hasPendingTrials(s)
}

export interface TrialResultView {
  signed: boolean
  performance: number
  clubId: string | null
  role: string | null
  text: LText | null
}

/** Finish a trial with a drill score (or the simulated estimate when omitted). */
export function finishTrial(inviteId: string, performance?: number): TrialResultView {
  const s = get()
  const inv = pendingTrials(s).find((x) => x.id === inviteId)
  const perf = performance === undefined || !Number.isFinite(performance) ? autoTrialPerformance(s, inviteId) : Math.max(0, Math.min(1, performance))
  const r = resolveTrial(s, inviteId, perf)
  if (inv) achievementEvent({ type: 'trial', kind: inv.kind, signed: r.signed }, s)
  commit(s)
  scheduleAutosave(300)
  return { signed: r.signed, performance: perf, clubId: r.clubId, role: r.role, text: r.lines[r.lines.length - 1] ?? null }
}

// ───────────────────────── Drills ─────────────────────────

/** Report a finished training drill (achievements). */
export function drillFinished(kind: string, grade: string, performance: number): void {
  achievementEvent({ type: 'drill', kind, grade, performance })
}

// ───────────────────────── Profile / contract views ─────────────────────────

export function potential(): PotentialView | null {
  const s = current()
  return s ? potentialView(s.hero, s.calendar.season, s.life) : null
}

export function market(offerWage?: number): MarketReference | null {
  const s = current()
  return s ? marketReference(s.world, s.hero, s.calendar.season, offerWage) : null
}

export interface RecordRow {
  key: string
  name: LText
  value: RecordValue
}

export function personalRecordRows(): RecordRow[] {
  const s = current()
  if (!s) return []
  const pr = personalRecords(s)
  return (Object.keys(PERSONAL_RECORD_NAMES) as PersonalRecordKey[]).filter((k) => pr[k]).map((k) => ({ key: k, name: PERSONAL_RECORD_NAMES[k], value: pr[k] as RecordValue }))
}

export function clubRecordRows(clubId: string): RecordRow[] {
  const s = current()
  if (!s || !s.world.clubs[clubId]) return []
  const cr = clubRecordsFor(s, clubId)
  return (Object.keys(CLUB_RECORD_NAMES) as ClubRecordKey[]).filter((k) => cr[k]).map((k) => ({ key: k, name: CLUB_RECORD_NAMES[k], value: cr[k] as RecordValue }))
}

export function decayWarning(): number | null {
  const s = current()
  return s ? weeksUntilDecay(s.hero) : null
}

export function formClause(): { has: boolean; active: boolean; last: number[] } {
  const s = current()
  if (!s) return { has: false, active: false, last: [] }
  return { has: !!s.hero.contract?.formGuarantee, active: formGuaranteeActive(s.hero, s.life), last: recentRatings(s.life).slice(-3) }
}

/** Bench-complaint decision is on offer (after a bench streak, see career/squadRole trackSelection). */
export function benchComplaintAvailable(): boolean {
  const s = current()
  return !!s && !s.hero.retired && s.life.flags.can_complain === true
}

/** Complain about playing time (polite / demand / public). Returns the outcome and the manager's reply. */
export function complainBench(approach: ComplaintApproach): { ok: boolean; outcome: string | null; text: string } {
  const s = get()
  const r = complainAboutBench(s, approach)
  commit(s)
  if (!r.ok) return { ok: false, outcome: null, text: r.error ? render(r.error) : '' }
  if (r.lines[0]) notify(r.lines[0], 'info')
  scheduleAutosave()
  return { ok: true, outcome: r.value ?? null, text: r.lines[0] ? render(r.lines[0]) : '' }
}

export const expectedMinutes = (role: keyof typeof ROLE_EXPECTED_MINUTES): [number, number] => ROLE_EXPECTED_MINUTES[role]
