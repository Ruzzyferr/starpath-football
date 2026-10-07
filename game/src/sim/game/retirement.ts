/**
 * Retirement flow (WP-7, GDD 2.6):
 *
 *  - From age {@link RETIRE_MIN_AGE} a yearly "continue or retire" decision is
 *    due once the season is over (week ≥ END_OF_SEASON_WEEK); answering it is
 *    recorded per season in `life.flags['c:retireAsked']`.
 *  - Retirement is FORCED at {@link FORCED_RETIRE_AGE}, or by a career-ending
 *    injury (serious injury with ≥ {@link CAREER_ENDING_WEEKS} weeks out for a
 *    player of {@link CAREER_ENDING_MIN_AGE}+).
 *  - The hero may also retire any time from 33 (Profile → confirm), and at any
 *    age after a serious (severity 3) injury.
 *  - Optional farewell/testimonial match (hero's club vs a Legends XI) is
 *    simulated with the match engine before the boots are hung up.
 *  - {@link retireHero} marks the hero retired and returns the documentary
 *    {@link CareerSummary}, also stored in `life.flags['c:summary']`.
 */
import type { GameState, LText } from '../../core/types'
import { clamp } from '../../core/rng'
import { fill, heroAge, lt } from '../career/common'
import { MatchSim } from '../match'
import type { MatchSetup } from '../match'
import { END_OF_SEASON_WEEK } from '../world/fixtures'
import { retire } from './actions'
import { buildCareerSummary, type CareerSummary, type PostCareerPath } from './hallOfFame'
import { heroClub, log, readJson, withRng, writeJson } from './internal'
import { buildTeam, HERO_ID } from './match'

export const RETIRE_MIN_AGE = 33
export const FORCED_RETIRE_AGE = 40
export const CAREER_ENDING_WEEKS = 24
export const CAREER_ENDING_MIN_AGE = 31

const ASKED_FLAG = 'c:retireAsked'
const SUMMARY_FLAG = 'c:summary'

export interface RetirementStatus {
  age: number
  /** May retire now (33+, or a serious injury). */
  canRetire: boolean
  /** Reason retirement is no longer optional. */
  forced: 'age' | 'injury' | null
  /** The yearly continue/retire decision card is due. */
  decisionDue: boolean
}

export function retirementStatus(state: GameState): RetirementStatus {
  const h = state.hero
  const age = heroAge(h, state.calendar.season)
  if (h.retired) return { age, canRetire: false, forced: null, decisionDue: false }
  const serious = !!h.injury && h.injury.severity === 3
  const forced: RetirementStatus['forced'] = age >= FORCED_RETIRE_AGE
    ? 'age'
    : serious && age >= CAREER_ENDING_MIN_AGE && (h.injury?.weeksLeft ?? 0) >= CAREER_ENDING_WEEKS ? 'injury' : null
  const asked = state.life.flags[ASKED_FLAG] === state.calendar.season
  const seasonOver = state.calendar.week >= END_OF_SEASON_WEEK
  return {
    age,
    canRetire: age >= RETIRE_MIN_AGE || serious,
    forced,
    decisionDue: forced !== null || (age >= RETIRE_MIN_AGE && seasonOver && !asked),
  }
}

/** "One more season": answers this season's decision card. */
export function continueCareer(state: GameState): LText[] {
  const st = retirementStatus(state)
  if (st.forced) return [lt('Bu karar artık senin elinde değil.', 'This decision is no longer yours to make.')]
  state.life.flags[ASKED_FLAG] = state.calendar.season
  const out: LText[] = []
  state.hero.morale = clamp(state.hero.morale + 4, 0, 100)
  log(state, out, fill(lt('{a} yaşında bir sezon daha! Formayı bırakmaya hazır değilsin.', 'One more season at {a}! You are not ready to stop yet.'), { a: st.age }), 'career', '💪')
  return out
}

/** Simulate a farewell match: hero's club (hero starts) vs a Legends XI. */
export function playTestimonial(state: GameState): CareerSummary['testimonial'] {
  const w = state.world
  const club = heroClub(state) ?? Object.values(w.clubs).find((c) => c.name === state.hero.history[state.hero.history.length - 1]?.clubName) ?? null
  if (!club) return null
  const legends = Object.values(w.clubs).filter((c) => c.id !== club.id).sort((a, b) => b.reputation - a.reputation || (a.id < b.id ? -1 : 1))[0]
  if (!legends) return null
  return withRng(state, (rng) => {
    const home = buildTeam(state, club, true, true, 1)
    const away = { ...buildTeam(state, legends, false, true, 1), id: 'legends', name: 'Legends XI', shortName: 'LEG' }
    if (!home.lineup.some((p) => p.id === HERO_ID)) home.lineup[home.lineup.length - 1] = { ...home.lineup[home.lineup.length - 1], id: HERO_ID, isHero: true, name: state.hero.nickname || state.hero.lastName, attrs: { ...state.hero.attrs } }
    const setup: MatchSetup = {
      home, away, seed: rng.nextUint(), competitionName: 'Testimonial', weather: 'clear', heroSide: 'home', heroOnBench: false,
      knockout: false, neutralVenue: false, importance: 1, difficulty: 0.85,
      ...(w.gender === 'female' ? { gender: 'female' as const } : {}),
    }
    const sim = new MatchSim(setup, 'en', { heroForm: 80, managerTrust: 100 })
    const snap = sim.simulateToEnd(true)
    return { score: [snap.score[0], snap.score[1]] as [number, number], goals: snap.heroStats.goals, opponent: 'Legends XI' }
  })
}

/**
 * Retire now. Returns the documentary summary (null if not allowed). With
 * `testimonial` a farewell match is simulated first.
 */
export function retireHero(state: GameState, opts: { testimonial?: boolean; peakOvr?: number; retiredAt?: number; postCareer?: PostCareerPath } = {}): { ok: boolean; summary: CareerSummary | null; lines: LText[] } {
  const st = retirementStatus(state)
  if (!st.canRetire && !st.forced) return { ok: false, summary: null, lines: [lt('Emeklilik için henüz çok gençsin (33+).', 'You are too young to retire (33+).')] }
  const lines: LText[] = []
  const testimonial = opts.testimonial ? playTestimonial(state) : null
  if (testimonial) {
    log(state, lines, fill(lt('Jübile maçı: {h}-{a}. Tribünler ayakta, {g} golle veda ettin.', 'Testimonial: {h}-{a}. A standing ovation, you said goodbye with {g} goal(s).'), { h: testimonial.score[0], a: testimonial.score[1], g: testimonial.goals }), 'career', '🎉')
  }
  // Summary first: retire() clears the contract (the current club is part of the story).
  const summary = buildCareerSummary(state, { peakOvr: opts.peakOvr, testimonial, forced: st.forced, retiredAt: opts.retiredAt ?? 0, postCareer: opts.postCareer })
  const r = retire(state, { force: true })
  if (!r.ok) return { ok: false, summary: null, lines: r.lines }
  lines.push(...r.lines)
  state.life.flags[ASKED_FLAG] = state.calendar.season
  writeJson(state.life, SUMMARY_FLAG, summary)
  return { ok: true, summary, lines }
}

/** The stored documentary of a retired hero. */
export const careerSummaryOf = (state: GameState): CareerSummary | null => readJson<CareerSummary | null>(state.life, SUMMARY_FLAG, null)
