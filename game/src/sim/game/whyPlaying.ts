/**
 * "Why?" panel data (GAP 2.7#83): the factors behind the hero's chance to
 * start the next match. Mirrors `startProbability` term by term so the
 * explanation can never drift from the sim; returns the strongest factors.
 */
import { echoSelection } from '../life/echoes'
import type { GameState, LText } from '../../core/types'
import { lt } from '../career/common'
import { heroOvr } from '../career/progression'
import { FORM_GUARANTEE_START, MINUTES_GUARANTEE_START, ROLE_START_BASE, formGuaranteeActive, formTerm, ratingTerm, roleScore, startProbability, trustTerm } from '../career/squadRole'
import { squadPlayers } from '../world/queries'
import { absDayOf, heroClub } from './internal'
import { nextClubFixture, selectionTerms, termsTotal } from './selection'
import { CASINO_SEEN_DAY_FLAG, NIGHTLIFE_ACT_FLAG, disciplineSelectionPenalty, nightName, preMatchNightPenalty } from '../life/butterfly'

export interface WhyFactor {
  key: string
  /** Effect on the start chance in percentage points (can be 0 for fixed facts). */
  points: number
  label: LText
  /** True for a factor the player can influence soon. */
  actionable: boolean
}

export interface WhyPlaying {
  chance: number
  /** Best-effort OVR gap to the club's regular starters. */
  ovrGap: number | null
  factors: WhyFactor[]
}

const pp = (n: number): number => Math.round(n * 100)

/** The squad average of the 11 best players (the "regular starters"). */
export function squadAvgOvr(state: GameState): number | null {
  const c = heroClub(state)
  if (!c) return null
  const best = squadPlayers(state.world, c.id).map((p) => p.ovr).sort((a, b) => b - a).slice(0, 11)
  return best.length ? best.reduce((a, b) => a + b, 0) / best.length : null
}

/** The hero's start chance today (same inputs as the selection roll, including last night). */
export const startChance = (state: GameState): number => startProbability(state.hero, state.life, absDayOf(state), termsTotal(selectionTerms(state, nextClubFixture(state))))

export function whyPlaying(state: GameState): WhyPlaying | null {
  const h = state.hero
  if (!h.contract) return null
  const today = absDayOf(state)
  const terms = selectionTerms(state, nextClubFixture(state))
  const chance = startProbability(h, state.life, today, termsTotal(terms))
  const f: WhyFactor[] = []
  const avg = squadAvgOvr(state)
  const gap = avg === null ? null : Math.round((heroOvr(h) - avg) * 10) / 10
  if (h.injury) f.push({ key: 'injury', points: -pp(chance), label: lt('SakatsÄ±n, oynayamazsÄ±n.', 'You are injured and cannot play.'), actionable: false })
  else if (h.suspendedMatches > 0) f.push({ key: 'ban', points: -pp(chance), label: lt('CezalÄ±sÄ±n.', 'You are suspended.'), actionable: false })
  else {
    const base = ROLE_START_BASE[h.contract.role]
    f.push({ key: 'role', points: pp(base), label: lt('RolÃ¼n temel ÅŸansÄ±', 'Base chance of your role'), actionable: false })
    if (gap !== null) {
      const score = roleScore(h, { squadAvgOvr: avg ?? 0, season: state.calendar.season })
      f.push({
        key: 'merit', points: 0, actionable: true,
        label: gap >= 0
          ? lt(`Genel gÃ¼cÃ¼n ilk 11 ortalamasÄ±nÄ±n ${gap} Ã¼stÃ¼nde (rol puanÄ± ${score.toFixed(1)}).`, `Your overall is ${gap} above the starters' average (role score ${score.toFixed(1)}).`)
          : lt(`Genel gÃ¼cÃ¼n ilk 11 ortalamasÄ±nÄ±n ${-gap} altÄ±nda. RolÃ¼ bu fark belirliyor.`, `Your overall is ${-gap} below the starters' average. That gap decides your role.`),
      })
    }
    const form = formTerm(h) + ratingTerm(state.life)
    if (Math.abs(form) >= 0.01) f.push({ key: 'form', points: pp(form), actionable: true, label: form > 0 ? lt('Ä°yi formdasÄ±n.', 'You are in good form.') : lt('Form dÃ¼ÅŸÃ¼k.', 'Your form is low.') })
    const trust = trustTerm(h)
    if (Math.abs(trust) >= 0.01) f.push({ key: 'trust', points: pp(trust), actionable: true, label: trust > 0 ? lt('Teknik direktÃ¶r sana gÃ¼veniyor.', 'The manager trusts you.') : lt('Teknik direktÃ¶rÃ¼n gÃ¼veni dÃ¼ÅŸÃ¼k.', 'The manager trusts you little.') })
    if (h.fatigue > 60) f.push({ key: 'fatigue', points: -pp(((h.fatigue - 60) / 40) * 0.3), actionable: true, label: lt('Yorgunsun, rotasyona kalabilirsin.', 'You are tired and may be rotated out.') })
    if (h.sharpness < 40) f.push({ key: 'sharp', points: -10, actionable: true, label: lt('MaÃ§ temposu dÃ¼ÅŸÃ¼k.', 'Match sharpness is low.') })
    const night = preMatchNightPenalty(state.life, today)
    if (night > 0) {
      const act = state.life.flags[NIGHTLIFE_ACT_FLAG]
      const seen = act === 'casino' && state.life.flags[CASINO_SEEN_DAY_FLAG] === today - 1
      const n = nightName(act)
      f.push({
        key: 'night', points: -pp(night), actionable: true,
        label: seen
          ? { tr: `DÃ¼n geceki ${n.tr} teknik direktÃ¶rÃ¼n kulaÄŸÄ±na gitti.`, en: `The manager heard about last night's ${n.en}.` }
          : { tr: `DÃ¼n geceki ${n.tr} Ä±sÄ±nmada belli oldu.`, en: `Last night's ${n.en} showed in the warm-up.` },
      })
    }
    const conduct = disciplineSelectionPenalty(state.life)
    if (conduct >= 0.01) f.push({ key: 'conduct', points: -pp(conduct), actionable: true, label: lt('Disiplin sicilin kÃ¶tÃ¼, teknik direktÃ¶r sana gÃ¼venmiyor.', 'Your discipline record is poor; the manager is wary of you.') })
    for (const c of echoSelection(h, state.life).causes) f.push({ key: c.key, points: 2, actionable: false, label: c.label })
    for (const x of terms) f.push({ key: x.key, points: pp(x.value), actionable: x.key === 'impress' || x.key === 'reserveForm', label: x.label })
    if (state.life.flags.promised_start === true) f.push({ key: 'promise', points: 15, actionable: false, label: lt('Teknik direktÃ¶r ilk 11 sÃ¶zÃ¼ verdi.', 'The manager promised you a start.') })
    if (formGuaranteeActive(h, state.life)) f.push({ key: 'formClause', points: 0, actionable: false, label: lt(`Form maddesi: ÅŸans en az %${pp(FORM_GUARANTEE_START)}.`, `Form clause: chance is at least ${pp(FORM_GUARANTEE_START)}%.`) })
    if (h.contract.minutesGuarantee) f.push({ key: 'minutes', points: 0, actionable: false, label: lt(`SÃ¼re garantin var: ÅŸans en az %${pp(MINUTES_GUARANTEE_START)}.`, `You hold a minutes guarantee: chance is at least ${pp(MINUTES_GUARANTEE_START)}%.`) })
  }
  const weight = (x: WhyFactor): number => (x.key === 'merit' ? 99 : Math.abs(x.points))
  const top = f.slice().sort((a, b) => weight(b) - weight(a) || Number(b.actionable) - Number(a.actionable)).slice(0, 3)
  return { chance, ovrGap: gap, factors: top }
}
