import { describe, expect, it } from 'vitest'
import { newsCause } from './newsCause'

const L = (s: string) => ({ tr: s, en: s })
const log = (week: number, kind: string, text: string) => ({ season: 2026, week, day: 0, text: L(text), kind }) as never
const news = (id: string, week: number) => ({ id, season: 2026, week, headline: L(id), sentiment: 0, source: 's' }) as never

describe('newsCause', () => {
  it('pairs the n-th event story with the n-th event log line of the week', () => {
    const life = { log: [log(3, 'event', 'first'), log(3, 'match', 'm'), log(3, 'event', 'second')], news: [news('ev1', 3), news('ev2', 3)] } as never
    expect(newsCause(life, (life as never as { news: never[] }).news[0])!.entries[0].text.en).toBe('first')
    expect(newsCause(life, (life as never as { news: never[] }).news[1])!.entries[0].text.en).toBe('second')
  })
  it('other stories point at that week', () => {
    const life = { log: [log(5, 'match', 'won 2-0'), log(6, 'match', 'later')], news: [news('n1', 5)] } as never
    const c = newsCause(life, (life as never as { news: never[] }).news[0])!
    expect(c.kind).toBe('week')
    expect(c.entries.map((e) => e.text.en)).toEqual(['won 2-0'])
  })
  it('null when nothing matches', () => {
    expect(newsCause({ log: [], news: [] } as never, news('n9', 1))).toBeNull()
  })
})
