import { MatchSim } from './engine'
import { makeSetup } from './testFixtures'
import { describe, expect, it } from 'vitest'
import { addPass, backgroundPasses, feedWillingness, mergePassNet, relationBand, splitPassNet, type PassNet } from './passNet'

const mates = [
  { id: 'a', relation: 90 },
  { id: 'b', relation: -80 },
  { id: 'c', relation: 0 },
]

describe('pass telemetry', () => {
  it('is deterministic and friends feed the hero more than rivals', () => {
    const run = (): PassNet => {
      const n: PassNet = {}
      for (let m = 1; m <= 90; m++) backgroundPasses(n, mates, 1234, `0:${m}:0`, true, 1)
      return n
    }
    expect(run()).toEqual(run())
    const n = run()
    expect(n.a.from).toBeGreaterThan(n.b?.from ?? 0)
    expect(Object.values(n).reduce((a, p) => a + p.to, 0)).toBe(90)
  })

  it('does not feed the hero while out of possession', () => {
    const n: PassNet = {}
    backgroundPasses(n, mates, 1, '0:1:0', false, 0)
    expect(n).toEqual({})
  })

  it('willingness and bands rise with the relation', () => {
    expect(feedWillingness(-100)).toBeLessThan(feedWillingness(100))
    expect([-60, 0, 40, 80].map(relationBand)).toEqual(['cold', 'cool', 'warm', 'close'])
  })

  it('merges and splits into fed / ignored', () => {
    const n: PassNet = {}
    addPass(n, 'a', 'from', 3)
    mergePassNet(n, { a: { from: 1, to: 2 }, c: { from: 0, to: 1 } })
    expect(n.a).toEqual({ from: 4, to: 2 })
    const rows = [
      { id: 'a', name: 'A', from: 4, to: 2, relation: 90, band: 'close' as const },
      { id: 'b', name: 'B', from: 0, to: 0, relation: -80, band: 'cold' as const },
      { id: 'c', name: 'C', from: 0, to: 1, relation: 0, band: 'cool' as const },
    ]
    const s = splitPassNet(rows)
    expect(s.fed.map((r) => r.id)).toEqual(['a'])
    expect(s.ignored.map((r) => r.id)).toEqual(['b', 'c'])
  })
})

describe('engine pass telemetry', () => {
  it('counts hero passes per team-mate deterministically over a match', () => {
    const run = () => {
      const sim = new MatchSim(makeSetup({ seed: 77, heroSide: 'home', home: { heroPosition: 'CM' } }), 'en')
      while (!sim.finished) {
        if (sim.pendingHighlight) sim.skipHighlight()
        else sim.step()
      }
      return sim.snapshot()
    }
    const a = run()
    expect(a.passNet && Object.keys(a.passNet).length).toBeGreaterThan(0)
    expect(run().passNet).toEqual(a.passNet)
  })
})
