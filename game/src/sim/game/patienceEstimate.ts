/**
 * Negotiation patience preview (2.7#88): how much of the club's patience an
 * ask would use, before the player sends it. The drain in `counterOffer` is
 * computed before any random draw, so running it with a throw-away Rng gives
 * the exact figure; it is rounded to a band so the hidden limits stay fuzzy.
 */
import { Rng } from '../../core/rng'
import type { ContractTerms, NegotiationState } from '../career/contract'
import { counterOffer } from '../career/contract'

export interface PatiencePreview {
  /** Estimated patience points the ask costs (rounded to 5; 0 = free). */
  drain: number
  /** The ask would end the talks. */
  walk: boolean
}

export function previewPatience(state: NegotiationState, ask: Partial<ContractTerms>): PatiencePreview {
  if (state.status !== 'open') return { drain: 0, walk: false }
  const step = counterOffer(new Rng(1), state, ask)
  if (step.state.status === 'walkedAway') return { drain: Math.round(state.patience), walk: true }
  const used = Math.max(0, Math.round(state.patience) - Math.round(step.state.patience))
  return { drain: used === 0 ? 0 : Math.max(5, Math.round(used / 5) * 5), walk: false }
}
