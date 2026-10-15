/** Opening the inbox marks every headline read (clears the bell's red dot). */
import { markNewsRead } from '../newsUnread'
import { commit, current } from './session'

export function markNewsSeen(): void {
  const s = current()
  if (s && markNewsRead(s.life)) commit(s, { silent: true })
}
