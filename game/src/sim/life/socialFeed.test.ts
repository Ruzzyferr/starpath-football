import { describe, expect, it } from 'vitest'
import { makeGame } from '../game/testHelpers'
import { audience, fanFeed, feedTopics } from './socialFeed'

describe('generated fan feed', () => {
  it('reacts to a hero who carried a losing team, with replies and hashtags', () => {
    const s = makeGame(31)
    Object.assign(s.life.flags, { last_match_rating: 8.8, last_match_goals: 3, last_match_shone: true, last_match_result: 'L' })
    expect(feedTopics(s)[0]).toBe('carried')
    const f = fanFeed(s)
    expect(f.comments.length).toBeGreaterThanOrEqual(3)
    expect(f.comments[0].topic).toBe('carried')
    for (const c of f.comments) {
      expect(c.text.en).not.toMatch(/\{\w+\}/)
      expect(c.text.tr).not.toMatch(/\{\w+\}/)
    }
    expect(f.comments.some((c) => c.replies.length > 0)).toBe(true)
    expect(f.hashtags[0].tag.startsWith('#')).toBe(true)
    expect(f.hashtags.some((h) => /YalnızKurt/.test(h.tag))).toBe(true)
    // Deterministic per week.
    expect(fanFeed(s)).toEqual(f)
  })

  it('rumours and businesses show up; audience shares sum to 1 and widen with fame', () => {
    const s = makeGame(32)
    s.life.flags.transfer_buzz = 4
    expect(feedTopics(s)).toContain('rumour')
    s.hero.reputation = 10
    const small = audience(s)
    s.hero.reputation = 90
    const big = audience(s)
    expect(big.reduce((a, x) => a + x.share, 0)).toBeCloseTo(1)
    expect(big.find((x) => x.key === 'global')!.share).toBeGreaterThan(small.find((x) => x.key === 'global')!.share)
  })
})
