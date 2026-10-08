import { describe, expect, it } from 'vitest'
import { lt } from '../career/common'
import { applyMatchToHero, type HeroMatchInput } from '../career/matchOutcome'
import { makeHeroLife } from '../career/testFixtures'
import { makeGame } from '../game/testHelpers'
import {
  RELATION_LOG_SIZE, changeRelation, heroShone, lossBlame, matchRelationDeltas, relationCauseTotals, relationHistory,
  weeklyRelationDecay,
} from './relationships'

const LOSS: HeroMatchInput = { rating: 8.6, goals: 3, assists: 0, minutes: 90, started: true, won: false, drew: false, importance: 0.5, opponentName: 'Rival FK' }

describe('relationship ledger', () => {
  it('records every change with cause, week, amount and value after', () => {
    const { life } = makeHeroLife()
    const before = life.relationships.mother!.value
    changeRelation(life, 'mother', 6, { cause: 'activity', week: 12, why: lt('Akşam yemeği', 'Dinner') })
    const [e] = relationHistory(life.relationships.mother!)
    expect(e!.cause).toBe('activity')
    expect(e!.w).toBe(12)
    expect(e!.d).toBe(life.relationships.mother!.value - before)
    expect(e!.v).toBe(life.relationships.mother!.value)
    expect(e!.why.en).toBe('Dinner')
  })

  it('falls back to memory, then to a per-cause default line', () => {
    const { life } = makeHeroLife()
    changeRelation(life, 'father', 3, { memory: lt('Hediye', 'Gift') })
    expect(life.relationships.father!.log?.[0]!.why.en).toBe('Gift')
    changeRelation(life, 'father', -3, { cause: 'interview' })
    expect(life.relationships.father!.log?.[0]!.why.en).toMatch(/interview/i)
  })

  it('caps the ledger and merges consecutive neglect decay', () => {
    const { life } = makeHeroLife()
    for (let i = 0; i < 40; i++) changeRelation(life, 'sibling', i % 2 ? 2 : -2, { cause: 'event', week: i })
    expect(life.relationships.sibling!.log!.length).toBe(RELATION_LOG_SIZE)
    const m = life.relationships.mother!
    m.value = 60
    m.lastContactWeek = 0
    for (let w = 5; w < 12; w++) weeklyRelationDecay(life, w)
    const top = m.log![0]!
    expect(top.cause).toBe('decay')
    expect(top.n).toBeGreaterThan(1)
    expect(top.v).toBe(m.value)
    expect(relationCauseTotals(m!).decay).toBeLessThan(0)
  })
})

describe('match fairness (store review: "hat-trick and still got blamed")', () => {
  it('blame in a defeat is proportional to the hero rating', () => {
    expect(lossBlame(5.5)).toBe(1)
    expect(lossBlame(7)).toBe(0)
    expect(lossBlame(6.25)).toBeCloseTo(0.5)
    const poor = matchRelationDeltas({ rating: 4.8, goals: 0, assists: 0, won: false, drew: false })
    const ok = matchRelationDeltas({ rating: 6.6, goals: 0, assists: 0, won: false, drew: false })
    expect(poor.fans).toBeLessThan(ok.fans)
    expect(poor.manager).toBeLessThan(ok.manager)
    expect(poor.teammates).toBeLessThan(0)
    expect(ok.teammates).toBe(0)
  })

  it('a shining hero never loses fans or manager standing, whatever the score', () => {
    for (let rating = 5; rating <= 10; rating += 0.25) {
      for (const goals of [2, 3, 4]) {
        const d = matchRelationDeltas({ rating, goals, assists: 0, won: false, drew: false })
        expect(d.fans, `r${rating} g${goals}`).toBeGreaterThan(0)
        expect(d.manager, `r${rating} g${goals}`).toBeGreaterThan(0)
        expect(d.teammates).toBeGreaterThanOrEqual(0)
      }
    }
    expect(heroShone({ rating: 6, goals: 0, motm: true })).toBe(true)
  })

  it('a red card still costs, even with goals', () => {
    const d = matchRelationDeltas({ rating: 6.8, goals: 2, assists: 0, won: false, drew: false, red: true })
    expect(d.manager).toBeLessThan(0)
  })

  it('hat-trick in a 5–3 loss never lowers fans, manager or any teammate (full post-match path)', () => {
    for (const seed of [3, 17, 99]) {
      const s = makeGame(seed)
      const rels = s.life.relationships
      const fans0 = rels.fans?.value ?? 0
      const mgr0 = rels.manager?.value ?? 0
      const mates0 = Object.values(rels).filter((r) => r.kind === 'teammate').map((r) => [r.id, r.value] as const)
      for (const rating of [6.4, 7.2, 8.6]) applyMatchToHero(s, { ...LOSS, rating })
      expect(rels.fans!.value).toBeGreaterThan(fans0)
      if (rels.manager) expect(rels.manager.value).toBeGreaterThan(mgr0)
      for (const [id, v] of mates0) expect(rels[id]!.value, id).toBeGreaterThanOrEqual(v)
      const why = rels.fans!.log?.[0]
      expect(why?.cause).toBe('match')
      expect(why?.why.en).toMatch(/3 goal/)
      expect(why?.why.en).toMatch(/defeat/)
      expect(s.life.flags.last_match_shone).toBe(true)
    }
  })
})
