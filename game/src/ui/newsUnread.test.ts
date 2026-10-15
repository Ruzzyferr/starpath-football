import { describe, expect, it } from 'vitest'
import type { NewsItem } from '../core/types'
import { NEWS_SEEN_FLAG, markNewsRead, unreadNews } from './newsUnread'

const item = (id: string, week: number): NewsItem => ({ id, season: 2026, week, headline: { tr: id, en: id }, source: 'x', sentiment: 0 })
const cal = { season: 2026, week: 3 }

describe('bell unread headlines', () => {
  it('counts headlines after the last one seen, and clears on read', () => {
    const life = { news: [item('a', 1), item('b', 2)], flags: {} as Record<string, string | number | boolean> }
    markNewsRead(life)
    expect(unreadNews(life, cal)).toBe(0)
    life.news.push(item('c', 3), item('d', 3))
    expect(unreadNews(life, cal)).toBe(2)
    expect(markNewsRead(life)).toBe(true)
    expect(unreadNews(life, cal)).toBe(0)
    expect(markNewsRead(life)).toBe(false)
  })
  it('old saves without the flag count only this week', () => {
    const life = { news: [item('a', 1), item('b', 3), item('c', 3)], flags: {} }
    expect(unreadNews(life, cal)).toBe(2)
  })
  it('a seen headline trimmed away means every headline is new', () => {
    const life = { news: [item('x', 3), item('y', 3)], flags: { [NEWS_SEEN_FLAG]: 'gone' } }
    expect(unreadNews(life, cal)).toBe(2)
  })
})
