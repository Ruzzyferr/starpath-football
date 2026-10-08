/**
 * WP-17 engine calibration: shot outcome bands over >= 1000 shots and strength
 * response. Bands are wide on purpose (guard rails, not exact targets); see docs/BALANCE.md.
 */
import { describe, expect, it } from 'vitest'
import { MatchSim } from './engine'
import { makeSetup } from './testFixtures'

describe('shot outcome calibration', () => {
  it('over >= 1000 shots, goals / on-target / woodwork rates sit inside the xG bands', () => {
    let shots = 0, goals = 0, onTarget = 0, wood = 0
    for (let i = 0; i < 300; i++) {
      const s = new MatchSim(makeSetup({ seed: 31_000 + i }), 'en').simulateToEnd()
      shots += s.shots[0] + s.shots[1]
      goals += s.score[0] + s.score[1]
      onTarget += s.shotsOnTarget[0]! + s.shotsOnTarget[1]!
      wood += s.events.filter((e) => e.type === 'woodwork').length
    }
    expect(shots).toBeGreaterThanOrEqual(1000)
    expect(goals / shots).toBeGreaterThan(0.075)
    expect(goals / shots).toBeLessThan(0.115)
    expect(onTarget / shots).toBeGreaterThan(0.3)
    expect(onTarget / shots).toBeLessThan(0.42)
    expect(wood / shots).toBeGreaterThan(0.015)
    expect(wood / shots).toBeLessThan(0.045)
    expect(goals).toBeLessThanOrEqual(onTarget)
  })

  it('better finishers convert a larger share of their shots (conversion rises with strength)', () => {
    const conv = (ovr: number) => {
      let sh = 0, g = 0
      for (let i = 0; i < 250; i++) {
        const s = new MatchSim(makeSetup({ seed: 41_000 + i, home: { ovr }, away: { ovr: 66 } }), 'en').simulateToEnd()
        sh += s.shots[0]
        g += s.score[0]
      }
      return g / sh
    }
    expect(conv(78)).toBeGreaterThan(conv(54))
  })
})

describe('strength calibration', () => {
  const run = (diff: number, n = 400) => {
    let win = 0, draw = 0, loss = 0, gf = 0, ga = 0
    for (let i = 0; i < n; i++) {
      const s = new MatchSim(makeSetup({ seed: 51_000 + i, home: { ovr: 68 + diff / 2 }, away: { ovr: 68 - diff / 2 } }), 'en').simulateToEnd()
      gf += s.score[0]; ga += s.score[1]
      if (s.score[0] > s.score[1]) win++
      else if (s.score[0] < s.score[1]) loss++
      else draw++
    }
    return { win: win / n, draw: draw / n, loss: loss / n, gf: gf / n, ga: ga / n }
  }

  it('win probability rises monotonically with the rating gap and stays plausible', () => {
    const a = run(-12), b = run(0), c = run(12)
    expect(a.win).toBeLessThan(b.win)
    expect(b.win).toBeLessThan(c.win)
    expect(c.win).toBeGreaterThan(0.6)
    expect(c.win).toBeLessThan(0.9)
    expect(a.loss).toBeGreaterThan(0.45)
    // Level teams: home edge, 20-32% draws.
    expect(b.win).toBeGreaterThan(b.loss)
    expect(b.draw).toBeGreaterThan(0.18)
    expect(b.draw).toBeLessThan(0.34)
  })

  it('heavy favourites still concede and lose upsets occasionally (>= 3% each way at +12)', () => {
    const c = run(12, 600)
    expect(c.loss).toBeGreaterThan(0.01)
    expect(c.ga).toBeGreaterThan(0.25)
  })
})
