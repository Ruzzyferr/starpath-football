/**
 * Unread headlines for the top-bar bell. The newest headline the player has
 * seen is kept in a life flag (saved with the career); everything after it is
 * unread. Old saves without the flag count only this week's headlines.
 */
import type { Calendar, Life } from '../core/types'

export const NEWS_SEEN_FLAG = 'ui:newsSeen'

export function unreadNews(life: Pick<Life, 'news' | 'flags'>, cal: Pick<Calendar, 'season' | 'week'>): number {
  const news = life.news
  const seen = life.flags[NEWS_SEEN_FLAG]
  if (typeof seen !== 'string') return news.filter((n) => n.season === cal.season && n.week === cal.week).length
  const i = news.findIndex((n) => n.id === seen)
  // Not found: the seen headline was trimmed away by newer ones, so all are new.
  return i < 0 ? news.length : news.length - 1 - i
}

/** Marks every headline as read. Returns true when the flag changed. */
export function markNewsRead(life: Pick<Life, 'news' | 'flags'>): boolean {
  const last = life.news[life.news.length - 1]
  if (!last || life.flags[NEWS_SEEN_FLAG] === last.id) return false
  life.flags[NEWS_SEEN_FLAG] = last.id
  return true
}
