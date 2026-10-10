/**
 * Deep links of the bench-path cards (selection levers, today's ideas): each
 * key runs the real action or opens the screen where it happens.
 */
import { haptic } from '../../haptics'
import { actions, navigate } from '../../store'
import { startReserveMatch } from '../../backend/benchPath'
import { openManagerTalk, openOneOnOne, openTeamDinner } from '../../backend/scenes'
import { openScouting } from '../../backend/scouting'

export type BenchAction = 'impress' | 'drill' | 'training' | 'talk' | 'rest' | 'reserve' | 'scrimmage' | 'oneOnOne' | 'video' | 'teamDinner'

export function runBenchAction(a: BenchAction): void {
  haptic('select')
  switch (a) {
    case 'impress':
      navigate('training', { challenge: '1' })
      return
    case 'drill':
    case 'training':
      navigate('training')
      return
    case 'talk':
      // The manager's office is a short dialogue scene now (quick resolve inside).
      openManagerTalk()
      return
    case 'rest':
      actions.doActivity('rest')
      return
    case 'video':
      openScouting()
      return
    case 'teamDinner':
      openTeamDinner()
      return
    case 'reserve':
    case 'scrimmage':
      if (startReserveMatch(a)) navigate('preMatch')
      return
    case 'oneOnOne':
      // A short pair drill with the partner now (quick resolve inside).
      openOneOnOne()
      return
  }
}
