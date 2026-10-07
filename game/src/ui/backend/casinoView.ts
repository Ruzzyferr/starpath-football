/**
 * Casino view mapping shared by the real and mock backends: slot symbols,
 * the paytable/paylines exactly as the sim evaluates them, and the 18+ lock.
 */
import type { Hero } from '../../core/types'
import { ADULT_AGE, heroAge } from '../../sim/career/common'
import { SLOT_PAYLINES, SLOT_PAYTABLE, SLOT_TWO_CHERRY, type SlotSpin, type SlotSymbol } from '../../sim/life/casino'
import type { CasinoStatus, SlotRules, SlotsResult } from '../store'

/** Sim symbol → SLOT_SYMBOLS index in the UI (lemon/orange are drawn as trophy/diamond). */
export const SLOT_UI_INDEX: Readonly<Record<SlotSymbol, number>> = {
  cherry: 0, star: 1, bell: 2, seven: 3, ball: 4, lemon: 5, orange: 6,
}

/** Paylines and paytable straight from the sim (what you see is what pays). */
export function slotRulesView(): SlotRules {
  const three = (Object.keys(SLOT_PAYTABLE) as SlotSymbol[])
    .map((k) => ({ symbol: SLOT_UI_INDEX[k], count: 3 as const, multiplier: SLOT_PAYTABLE[k] }))
    .sort((a, b) => b.multiplier - a.multiplier)
  return {
    lines: SLOT_PAYLINES.map((l) => [...l]),
    pays: [...three, { symbol: SLOT_UI_INDEX.cherry, count: 2, multiplier: SLOT_TWO_CHERRY }],
  }
}

/** Map a sim spin to the UI result (full 3×3 window and every paying line). */
export function slotSpinView(spin: Pick<SlotSpin, 'window' | 'wins' | 'payout'>, stake: number): SlotsResult {
  const lineBet = stake / SLOT_PAYLINES.length
  const window = spin.window.map((col) => col.map((sym) => SLOT_UI_INDEX[sym]))
  const wins = spin.wins.map((w) => {
    const rows = SLOT_PAYLINES[w.line]
    const third = spin.window[2][rows[2]]
    return {
      line: w.line,
      symbol: SLOT_UI_INDEX[w.symbol],
      count: (third === w.symbol ? 3 : 2) as 2 | 3,
      multiplier: w.multiplier,
      amount: Math.round(w.multiplier * lineBet),
    }
  })
  return { reels: window.map((col) => col[1]), window, wins, net: Math.round(spin.payout - stake), winLine: wins.length > 0 }
}

/** Under-age lock for the casino (null once the hero is an adult). */
export function casinoAgeLock(hero: Pick<Hero, 'birthYear'> | null | undefined, season: number): CasinoStatus['ageLock'] {
  if (!hero) return null
  const age = heroAge(hero, season)
  return age >= ADULT_AGE ? null : { minAge: ADULT_AGE, yearsLeft: ADULT_AGE - age }
}
