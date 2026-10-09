/**
 * Deep links of the bench-path cards (selection levers, today's ideas): each
 * key runs the real action or opens the screen where it happens.
 */
import { lt, t } from '../../../i18n'
import { toast } from '../../components'
import { haptic } from '../../haptics'
import { actions, navigate } from '../../store'
import { doOneOnOne, startReserveMatch, talkManager } from '../../backend/benchPath'

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
    case 'talk': {
      const lines = talkManager()
      if (lines.length) toast(lines.map((l) => lt(l)).join(' '), 'success', 'chat', 6000)
      return
    }
    case 'rest':
      actions.doActivity('rest')
      return
    case 'video':
      actions.doActivity('video')
      return
    case 'teamDinner':
      actions.doActivity('team_dinner')
      return
    case 'reserve':
    case 'scrimmage':
      if (startReserveMatch(a)) navigate('preMatch')
      return
    case 'oneOnOne': {
      const r = doOneOnOne()
      if (r.ok && r.partner) {
        const xp = (r.xp ?? []).map((x) => t('bench.oneOnOne.xp', { a: t(`data.attr.${x.key}` as never), x: x.xp })).join(' · ')
        toast(`${t('bench.oneOnOne.done', { n: r.partner })} · ${xp}`, 'success', 'handshake', 5000)
      }
      return
    }
  }
}
