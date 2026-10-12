/**
 * Build 9 owner rule in the training drills: physics without dice, and every chance event on the one rule
 * (statChance: +1 stat point = +1 %, capped). Pins the drill-side wiring of the shared helpers.
 */
import { describe, expect, it } from 'vitest'
import type { Rng } from '../../core/rng'
import { flatAttrs } from '../setup'
import { CHANCE_MOD } from '../chanceEvents'
import { armReach, handsReach, keeperHoldChance, parryVelocity } from '../keeperPhysics'
import { BALL_RADIUS, GOAL_CENTER_Y, type BallState } from '../physics'
import { makeActor } from './base'
import { keeperReach, resolveSave } from './keeper'
import { drillTackleChances } from './drills/tackling'

const rngAlways = (v: boolean): Rng => ({ chance: (p: number) => p >= 1 || v, range: (a: number) => a, int: (a: number) => a }) as unknown as Rng
const ball = (x: number, y: number, z: number, vx: number, vy = 0, vz = 0): BallState => ({ x, y, z, vx, vy, vz, spin: { side: 0, top: 0 } })

describe('tackling drill: the match tackle rule', () => {
  const carrier = makeActor('c', 'opp', 'LW', { x: 0, y: 0 }, flatAttrs(50))
  const tackler = (t: number) => makeActor('h', 'hero', 'CB', { x: 0, y: 0 }, { ...flatAttrs(50), tackling: t }, { hero: true })

  it('+1 % per Tackling point until the cap; the carrier at 50 neither helps nor hurts', () => {
    expect(drillTackleChances(tackler(50), carrier, 0.45, false, false).win).toBeCloseTo(0.5, 10)
    for (let t = 30; t < 70; t++) {
      const d = drillTackleChances(tackler(t + 1), carrier, 0.45, false, false).win - drillTackleChances(tackler(t), carrier, 0.45, false, false).win
      expect(d).toBeCloseTo(0.01, 10)
    }
    expect(drillTackleChances(tackler(99), carrier, 1, false, false).win).toBe(0.85)
  })

  it('timing ±15, from behind −20, slide −5 (points, not multipliers)', () => {
    const h = tackler(60)
    expect(drillTackleChances(h, carrier, 0.9, false, false).win).toBeCloseTo(0.75, 10)
    expect(drillTackleChances(h, carrier, 0, false, false).win).toBeCloseTo(0.45, 10)
    expect(drillTackleChances(h, carrier, 0.45, true, false).win).toBeCloseTo(0.4, 10)
    expect(drillTackleChances(h, carrier, 0.45, false, true).win).toBeCloseTo(0.55, 10)
  })

  it('a challenge that misses is a foul on 1 − clean (Tackling + 30 standing / + 10 slide, −20 from behind)', () => {
    const h = tackler(40)
    expect(drillTackleChances(h, carrier, 0.45, false, false).foul).toBeCloseTo(1 - (40 + CHANCE_MOD.cleanStanding) / 100, 10)
    expect(drillTackleChances(h, carrier, 0.45, false, true).foul).toBeCloseTo(1 - (40 + CHANCE_MOD.cleanSlide) / 100, 10)
    expect(drillTackleChances(h, carrier, 0.45, true, true).foul).toBeCloseTo(1 - (40 + CHANCE_MOD.cleanSlide + CHANCE_MOD.behind) / 100, 10)
  })
})

describe('drill keeper: the match keeper', () => {
  const keeper = (diving = 70, reflexes = 70) => makeActor('k', 'opp', 'GK', { x: 104, y: GOAL_CENTER_Y }, { ...flatAttrs(60, true), diving, reflexes })

  it('reach is keeperPhysics: hands round the body (Reflexes), the arm at full stretch of a dive (Diving)', () => {
    const k = keeper(70, 40)
    const r = handsReach(k) + BALL_RADIUS
    expect(keeperReach(k, ball(104, GOAL_CENTER_Y + r - 0.01, 1, -20))).not.toBeNull()
    expect(keeperReach(k, ball(104, GOAL_CENTER_Y + r + 0.02, 1, -20))).toBeNull()
    k.state = 'dive'
    k.actionDir = { x: 0, y: 1 }
    expect(keeperReach(k, ball(104, GOAL_CENTER_Y + armReach(k) + 0.3, 0.5, -20))).not.toBeNull()
    expect(keeperReach(k, ball(104, GOAL_CENTER_Y + armReach(k) + 0.5, 0.5, -20))).toBeNull()
    // A better diver reaches further.
    expect(armReach(keeper(90))).toBeGreaterThan(armReach(keeper(50)))
  })

  it('no save roll: a ball he gets a hand to is saved (held or parried), never beaten', () => {
    const k = keeper()
    const b = ball(104, GOAL_CENTER_Y + 0.5, 1, 26)
    expect(resolveSave(rngAlways(false), k, b, { stretch: 1 })).toBe('parried')
    expect(resolveSave(rngAlways(true), keeper(), ball(104, GOAL_CENTER_Y, 1, 26), { stretch: 1 })).toBe('held')
  })

  it('hold vs parry is keeperHoldChance; the parry is deterministic (parryVelocity, no dice)', () => {
    const k = keeper()
    let asked = -1
    const spy = { chance: (p: number) => ((asked = p), false) } as unknown as Rng
    const b = ball(104, GOAL_CENTER_Y + 1.5, 1.2, 25, 3, 1)
    const speed = Math.hypot(25, 3, 1)
    expect(resolveSave(spy, k, b, { stretch: 0.8 })).toBe('parried')
    expect(asked).toBeCloseTo(keeperHoldChance(k, speed, 0.8), 10)
    const v = parryVelocity(GOAL_CENTER_Y + 1.5, speed, 0.8, -1)
    expect({ vx: b.vx, vy: b.vy, vz: b.vz }).toEqual(v)
    // A soft ball is simply gathered.
    expect(resolveSave(rngAlways(false), keeper(), ball(104, GOAL_CENTER_Y, 0.5, 9), { stretch: 0 })).toBe('held')
  })
})
