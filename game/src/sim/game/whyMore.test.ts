import { describe, expect, it } from 'vitest'
import type { GoldenStarResult } from '../world/worldTypes'
import { makeGame } from './testHelpers'
import { topShares, whyAward, whyInterest, whySponsors } from './whyMore'

const sum = (rows: { share: number }[]) => rows.reduce((s, r) => s + r.share, 0)

describe('whyMore', () => {
  it('shares are integers that sum to 100 and keep the top three', () => {
    const rows = topShares([
      { key: 'a', label: { tr: 'a', en: 'a' }, value: 7, actionable: false },
      { key: 'b', label: { tr: 'b', en: 'b' }, value: -5, actionable: true },
      { key: 'c', label: { tr: 'c', en: 'c' }, value: 3, actionable: true },
      { key: 'd', label: { tr: 'd', en: 'd' }, value: 0.1, actionable: true },
    ])
    expect(rows.map((r) => r.key)).toEqual(['a', 'b', 'c'])
    expect(sum(rows)).toBe(100)
    expect(rows[1].tone).toBe('neg')
    expect(topShares([])).toEqual([])
  })

  it('interest and sponsor panels work on a real career', () => {
    const s = makeGame(42)
    const clubId = Object.keys(s.world.clubs).find((id) => id !== s.hero.contract?.clubId)!
    const wi = whyInterest(s, clubId)!
    expect(wi.rows.length).toBeGreaterThan(0)
    expect(wi.rows.length).toBeLessThanOrEqual(3)
    expect(sum(wi.rows)).toBe(100)
    const ws = whySponsors(s)
    expect(ws.rows.length).toBeGreaterThan(0)
    expect(sum(ws.rows)).toBe(100)
    expect(whyInterest(s, 'nope')).toBeNull()
  })

  it('award panel lists where the winner beat the hero', () => {
    const cand = (id: string, hero: boolean, l: number, c: number) => ({ playerId: id, name: id, clubId: null, nationality: 'x', position: 'ST', parts: { league: l, continental: c, international: 0, trophies: 0 }, score: l + c, points: 0, firsts: 0, ...(hero ? { isHero: true } : {}) })
    const star = { season: 2027, ranking: [cand('w', false, 30, 10), cand('h', true, 20, 10)], journalists: 100 } as unknown as GoldenStarResult
    const w = whyAward(star)!
    expect(w.rows.map((r) => r.key)).toEqual(['league'])
    expect(w.rows[0].share).toBe(100)
    expect(whyAward({ ...star, ranking: [cand('h', true, 5, 5)] } as unknown as GoldenStarResult)).toBeNull()
  })
})
