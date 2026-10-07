/**
 * Test helpers for the game façade (not used by production code).
 */
import type { GameState } from '../../core/types'
import { newGame, type NewGameInput } from './newGame'
import { advanceToNextMatch, isHeroMatchday, type AdvanceReport } from './calendar'
import { autoPlayHeroMatch } from './match'
import { acceptOffer, firstEnabledChoice, resolveEventChoice } from './actions'
import { getOffers } from './season'

export const TEST_INPUT: NewGameInput = {
  firstName: 'Arda', lastName: 'Yıldız', nickname: 'Arda', nationality: 'TR', birthYear: 2009,
  position: 'ST', foot: 'R', archetype: 'poacher', background: 'academy',
  appearance: { skin: 1, hairStyle: 2, hairColor: 0, beard: 0, eyeColor: 1, face: 0, accessory: 0 },
  difficulty: 'normal',
}

export const makeGame = (seed = 1234, input: Partial<NewGameInput> = {}): GameState => newGame({ ...TEST_INPUT, ...input }, seed)

/** Paths of every non-finite number in a value. */
export function findNonFinite(v: unknown, path = '$', out: string[] = [], seen = new Set<object>()): string[] {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) out.push(path)
  } else if (v && typeof v === 'object') {
    if (seen.has(v)) return out
    seen.add(v)
    if (Array.isArray(v)) v.forEach((x, i) => findNonFinite(x, `${path}[${i}]`, out, seen))
    else for (const [k, x] of Object.entries(v)) findNonFinite(x, `${path}.${k}`, out, seen)
  }
  return out
}

export interface AutoStats {
  heroMatches: number
  events: number
  days: number
  signed: number
}

/**
 * Auto-play until `until(state)` is true: resolves cards with the first
 * enabled choice, plays hero matches in the sim, advances with the autopilot,
 * and optionally signs the best-paid offer on the table.
 */
export function autoRun(state: GameState, until: (s: GameState) => boolean, maxSteps = 5000, acceptOffers = false): AutoStats {
  const st: AutoStats = { heroMatches: 0, events: 0, days: 0, signed: 0 }
  for (let i = 0; i < maxSteps && !until(state); i++) {
    while (state.pendingEvents.length > 0) {
      const r = resolveEventChoice(state, 0, firstEnabledChoice(state, 0))
      if (!r.ok && state.pendingEvents.length > 0) state.pendingEvents.splice(0, 1)
      st.events++
    }
    if (acceptOffers) {
      // Prefer the biggest club; renewals otherwise.
      const offers = getOffers(state).sort((a, b) => (b.contract.terms.wage - a.contract.terms.wage))
      if (offers.length && acceptOffer(state, offers[0].id).ok) st.signed++
    }
    if (isHeroMatchday(state)) {
      if (autoPlayHeroMatch(state)) st.heroMatches++
      continue
    }
    const r: AdvanceReport = advanceToNextMatch(state, { maxDays: 14, stopAtSeasonEnd: false })
    st.days += r.days
  }
  return st
}
