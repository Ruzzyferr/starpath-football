/**
 * "Why?" panel data (GAP 2.7#83): the factors behind the hero's chance to
 * start the next match. Mirrors `startProbability` term by term so the
 * explanation can never drift from the sim; returns the strongest factors.
 */
import type { GameState, LText } from '../../core/types'
import { lt } from '../career/common'
import { heroOvr } from '../career/progression'
import { FORM_GUARANTEE_START, MINUTES_GUARANTEE_START, ROLE_START_BASE, formGuaranteeActive, formTerm, ratingTerm, roleScore, startProbability, trustTerm } from '../career/squadRole'
import { squadPlayers } from '../world/queries'
import { heroClub } from './internal'

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

export function whyPlaying(state: GameState): WhyPlaying | null {
  const h = state.hero
  if (!h.contract) return null
  const chance = startProbability(h, state.life)
  const f: WhyFactor[] = []
  const avg = squadAvgOvr(state)
  const gap = avg === null ? null : Math.round((heroOvr(h) - avg) * 10) / 10
  if (h.injury) f.push({ key: 'injury', points: -pp(chance), label: lt('Sakatsın, oynayamazsın.', 'You are injured and cannot play.'), actionable: false })
  else if (h.suspendedMatches > 0) f.push({ key: 'ban', points: -pp(chance), label: lt('Cezalısın.', 'You are suspended.'), actionable: false })
  else {
    const base = ROLE_START_BASE[h.contract.role]
    f.push({ key: 'role', points: pp(base), label: lt('Rolün temel şansı', 'Base chance of your role'), actionable: false })
    if (gap !== null) {
      const score = roleScore(h, { squadAvgOvr: avg ?? 0, season: state.calendar.season })
      f.push({
        key: 'merit', points: 0, actionable: true,
        label: gap >= 0
          ? lt(`Genel gücün ilk 11 ortalamasının ${gap} üstünde (rol puanı ${score.toFixed(1)}).`, `Your overall is ${gap} above the starters' average (role score ${score.toFixed(1)}).`)
          : lt(`Genel gücün ilk 11 ortalamasının ${-gap} altında. Rolü bu fark belirliyor.`, `Your overall is ${-gap} below the starters' average. That gap decides your role.`),
      })
    }
    const form = formTerm(h) + ratingTerm(state.life)
    if (Math.abs(form) >= 0.01) f.push({ key: 'form', points: pp(form), actionable: true, label: form > 0 ? lt('İyi formdasın.', 'You are in good form.') : lt('Form düşük.', 'Your form is low.') })
    const trust = trustTerm(h)
    if (Math.abs(trust) >= 0.01) f.push({ key: 'trust', points: pp(trust), actionable: true, label: trust > 0 ? lt('Teknik direktör sana güveniyor.', 'The manager trusts you.') : lt('Teknik direktörün güveni düşük.', 'The manager trusts you little.') })
    if (h.fatigue > 60) f.push({ key: 'fatigue', points: -pp(((h.fatigue - 60) / 40) * 0.3), actionable: true, label: lt('Yorgunsun, rotasyona kalabilirsin.', 'You are tired and may be rotated out.') })
    if (h.sharpness < 40) f.push({ key: 'sharp', points: -10, actionable: true, label: lt('Maç temposu düşük.', 'Match sharpness is low.') })
    if (state.life.flags.promised_start === true) f.push({ key: 'promise', points: 15, actionable: false, label: lt('Teknik direktör ilk 11 sözü verdi.', 'The manager promised you a start.') })
    if (formGuaranteeActive(h, state.life)) f.push({ key: 'formClause', points: 0, actionable: false, label: lt(`Form maddesi: şans en az %${pp(FORM_GUARANTEE_START)}.`, `Form clause: chance is at least ${pp(FORM_GUARANTEE_START)}%.`) })
    if (h.contract.minutesGuarantee) f.push({ key: 'minutes', points: 0, actionable: false, label: lt(`Süre garantin var: şans en az %${pp(MINUTES_GUARANTEE_START)}.`, `You hold a minutes guarantee: chance is at least ${pp(MINUTES_GUARANTEE_START)}%.`) })
  }
  const weight = (x: WhyFactor): number => (x.key === 'merit' ? 99 : Math.abs(x.points))
  const top = f.slice().sort((a, b) => weight(b) - weight(a) || Number(b.actionable) - Number(a.actionable)).slice(0, 3)
  return { chance, ovrGap: gap, factors: top }
}
