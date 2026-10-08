/**
 * Partner preference (2.4#24): the player picks which genders of partner
 * the dating events may introduce. Stored on the career (`life.flags`) so the
 * sim never reads UI settings; the UI writes it through {@link setPartnerPref}.
 * Changing the hero's gender never changes an existing partner.
 */
import type { GameState } from '../../core/types'
import { PARTNER_NAMES } from '../life/events/dsl'

export type PartnerPref = 'any' | 'women' | 'men'
export const PARTNER_PREF_FLAG = 'partner_pref'

/** Partner first-name pools by presentation (content refers to partners by name or "they"). */
export const PARTNER_NAMES_WOMEN = ['Deniz', 'Ece', 'Selin', 'Zeynep', 'Elif', 'Defne', 'Aylin', 'Melis', 'Sofia', 'Lena', 'Maya', 'Clara', 'Nora', 'İpek', 'Su'] as const
export const PARTNER_NAMES_MEN = ['Kerem', 'Arda', 'Can', 'Emir', 'Ozan', 'Luca', 'Marco', 'Jonas', 'Mateo', 'Noah'] as const

export function getPartnerPref(s: Pick<GameState, 'life'>): PartnerPref {
  const v = s.life.flags[PARTNER_PREF_FLAG]
  return v === 'women' || v === 'men' ? v : 'any'
}

/** Returns true when the stored value changed. */
export function setPartnerPref(s: Pick<GameState, 'life'>, pref: PartnerPref): boolean {
  if (getPartnerPref(s) === pref) return false
  if (pref === 'any') delete s.life.flags[PARTNER_PREF_FLAG]
  else s.life.flags[PARTNER_PREF_FLAG] = pref
  return true
}

/** Name pool the dating events draw from. */
export function partnerNamePool(s: Pick<GameState, 'life'>): readonly string[] {
  const p = getPartnerPref(s)
  return p === 'women' ? PARTNER_NAMES_WOMEN : p === 'men' ? PARTNER_NAMES_MEN : PARTNER_NAMES
}
