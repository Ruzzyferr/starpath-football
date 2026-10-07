/**
 * Career gates (WP-7/8): screens the career must pass through.
 *  - Pending trial invitations (career start) → the Trials screen.
 *  - The yearly retirement decision (33+, after the season review) or a
 *    forced retirement (age 40 / career-ending injury) → the Retire screen.
 * Never interrupts the match flow, the season review or the wizard.
 */
import { useEffect } from 'preact/hooks'
import { gameState, navigate, pendingNav, screen, type ScreenId } from '../../store'
import { needsTrial, retirementView } from '../../backend/meta'

const NEVER: ReadonlySet<ScreenId> = new Set<ScreenId>([
  'title', 'newCareer', 'settings', 'saves', 'credits', 'preMatch', 'liveMatch', 'postMatch', 'seasonEnd',
  'trials', 'retire', 'documentary', 'hallOfFame', 'achievements',
])

export function useCareerGates(): void {
  const s = gameState.value
  const id = screen.value.id
  const want = pendingNav.value
  useEffect(() => {
    if (!s || NEVER.has(id) || want) return
    if (needsTrial()) {
      navigate('trials', undefined, { tab: true })
      return
    }
    const r = retirementView()
    if (r?.decisionDue) navigate('retire', undefined, { tab: true })
  }, [s, id, want])
}
