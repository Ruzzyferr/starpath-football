/**
 * Life extras (WP-10) over the live GameState: businesses, responsible-gaming
 * controls, press conferences and the generated fan feed. Kept out of the
 * shared GameActions/GameData interfaces so other work packages are not
 * disturbed; each mutating call commits and schedules an autosave.
 */
import type { BusinessKind, LText } from '../../core/types'
import {
  openBusiness as simOpen, sellBusiness as simSell, setBusinessManager, upgradeBusiness as simUpgrade,
} from '../../sim/life/business'
import { selfExclude as simExclude, setLossLimit as simLossLimit } from '../../sim/life/casino'
import {
  buildAcademyStage, buildStadiumStage, buyClubStake as simBuyStake, contributeLegacyFund, sellClubStake as simSellStake,
} from '../../sim/life/projects'
import { fanFeed, type FanFeed } from '../../sim/life/socialFeed'
import {
  answerInterview, canHoldPressConference, interviewSession, pressConferenceQuestions,
  type InterviewAnswerV2, type InterviewSession,
} from '../../sim/game/interview'
import { cached, commit, current, get, notify } from './session'
import { scheduleAutosave } from './persistence'

function done(lines: readonly LText[], ok: boolean): boolean {
  const s = get()
  notify(lines[0], ok ? 'success' : 'error')
  commit(s)
  if (ok) scheduleAutosave()
  return ok
}

export const lifePlus = {
  openBusiness(kind: BusinessKind, name?: string): boolean {
    const s = get()
    const r = simOpen(s.life, s.hero, kind, s.calendar, name)
    return done(r.lines, r.ok)
  },
  upgradeBusiness(id: string): boolean {
    const r = simUpgrade(get().life, id)
    return done(r.lines, r.ok)
  },
  setManager(id: string, hire: boolean): boolean {
    const r = setBusinessManager(get().life, id, hire)
    return done(r.lines, r.ok)
  },
  sellBusiness(id: string): number {
    const r = simSell(get().life, id)
    done(r.lines, r.ok)
    return r.amount
  },
  buildAcademy(): boolean {
    const r = buildAcademyStage(get().life)
    return done(r.lines, r.ok)
  },
  buildStadium(): boolean {
    const r = buildStadiumStage(get().life)
    return done(r.lines, r.ok)
  },
  fundLegacy(amount: number): boolean {
    const r = contributeLegacyFund(get().life, amount)
    return done(r.lines, r.ok)
  },
  buyStake(clubId: string, pct: number): boolean {
    const r = simBuyStake(get().life, clubId, pct)
    return done(r.lines, r.ok)
  },
  sellStake(): number {
    const r = simSellStake(get().life)
    done(r.lines, r.ok)
    return r.amount
  },
  setLossLimit(amount: number): void {
    done(simLossLimit(get().life, amount), true)
  },
  selfExclude(weeks: number): boolean {
    const r = simExclude(get().life, weeks)
    return done(r.lines, r.ok)
  },
  /** Open (or resume) this week's press conference. Null when already held. */
  startPressConference(): InterviewSession | null {
    const s = get()
    const q = pressConferenceQuestions(s)
    commit(s)
    return q ? interviewSession(s) : null
  },
  canHoldPress(): boolean {
    const s = current()
    return !!s && canHoldPressConference(s)
  },
  /** Current press session if it is this week's press conference. */
  pressSession(): InterviewSession | null {
    const s = current()
    const ss = s ? interviewSession(s) : null
    return ss && ss.kind === 'press' ? ss : null
  },
  answer(questionId: string, optionId: string): InterviewAnswerV2 {
    const s = get()
    const r = answerInterview(s, questionId, optionId)
    commit(s)
    scheduleAutosave()
    return r
  },
  feed(): FanFeed | null {
    const s = current()
    return s ? cached(s, 'fanFeed', () => fanFeed(s)) : null
  },
}
