/**
 * "What caused this story?" (2.7#90). Event headlines get ids `ev…` and are
 * written in the same call as the event's log entry, so the n-th event story of
 * a week pairs with the n-th event log line of that week. Other stories (match
 * reports, awards, injuries) point at that week's matching log lines.
 */
import type { Life, LogEntry, NewsItem } from '../../core/types'

export interface NewsCause {
  kind: 'event' | 'week'
  entries: LogEntry[]
}

const sameWeek = (a: { season: number; week: number }, b: { season: number; week: number }): boolean =>
  a.season === b.season && a.week === b.week

export function newsCause(life: Pick<Life, 'news' | 'log'>, item: NewsItem): NewsCause | null {
  if (item.id.startsWith('ev')) {
    const stories = life.news.filter((n) => n.id.startsWith('ev') && sameWeek(n, item))
    const events = life.log.filter((l) => l.kind === 'event' && sameWeek(l, item))
    const i = stories.findIndex((n) => n.id === item.id)
    const e = events[i] ?? (events.length === 1 ? events[0] : undefined)
    if (e) return { kind: 'event', entries: [e] }
  }
  const week = life.log.filter((l) => sameWeek(l, item) && l.kind !== 'relation').slice(-3)
  return week.length ? { kind: 'week', entries: week } : null
}
