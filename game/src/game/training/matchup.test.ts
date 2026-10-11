import { describe, expect, it } from 'vitest'
import { flatAttrs } from '../setup'
import { createDrill, type FinishingDrill, type GoalkeepingDrill, type TacklingDrill } from './drills'
import { drillHasOpponent, drillMatchup, drillOpponentAttrs, trainingOpponentLevel } from './matchup'
import type { RondoDrill } from './drills/rondo'

describe('drill matchup (you vs opponent)', () => {
  it('lists the opposition for drills that have one, none for solo drills', () => {
    expect(drillHasOpponent('tackling', 'standard')).toBe(true)
    expect(drillHasOpponent('passing', 'rondo')).toBe(true)
    expect(drillHasOpponent('interception', 'press')).toBe(true)
    expect(drillHasOpponent('goalkeeping', 'diving')).toBe(true)
    expect(drillHasOpponent('passing', 'standard')).toBe(false)
    expect(drillHasOpponent('fitness', 'standard')).toBe(false)
    expect(drillHasOpponent('sprint', 'contact')).toBe(false)
    expect(drillMatchup('crossing', 'switch', flatAttrs(50), 56)).toBeNull()
  })

  it('shows the very attributes the drill builds its opponents from', () => {
    const t = createDrill('tackling', { attrs: flatAttrs(50), seed: 1, opponent: 64 }) as TacklingDrill
    expect(t.carrier.attrs).toEqual(drillOpponentAttrs('tackling', 'standard', 64))
    const f = createDrill('finishing', { attrs: flatAttrs(50), seed: 1, opponent: 70 }) as FinishingDrill
    expect(f.keeper.attrs).toEqual(drillOpponentAttrs('finishing', 'standard', 70))
    const g = createDrill('goalkeeping', { attrs: flatAttrs(50, true), seed: 1, opponent: 45 }) as GoalkeepingDrill
    expect(g.shooter.attrs).toEqual(drillOpponentAttrs('goalkeeping', 'standard', 45))
    const r = createDrill('passing', { attrs: flatAttrs(50), seed: 1, variant: 'rondo', opponent: 60 }) as RondoDrill
    expect(r.defenders[0]!.attrs).toEqual(drillOpponentAttrs('passing', 'rondo', 60))
    const mu = drillMatchup('tackling', 'standard', { ...flatAttrs(50), tackling: 80 }, 64)!
    expect(mu.role).toBe('dribbler')
    expect(mu.level).toBe(64)
    expect(mu.rows[0]).toEqual({ heroKey: 'tackling', oppKey: 'dribbling', heroV: 80, oppV: 64, edge: 1 })
    expect(mu.rows.length).toBeGreaterThanOrEqual(3)
  })

  it('opposition level: the default partner pulled toward the squad, plus the difficulty, monotonic', () => {
    expect(trainingOpponentLevel(50, 56)).toBe(56)
    expect(trainingOpponentLevel(50, 70)).toBeGreaterThan(trainingOpponentLevel(50, 50))
    expect(trainingOpponentLevel(80, null)).toBeGreaterThan(trainingOpponentLevel(50, null))
    // A hero 30 points better meets partners only 12 points better.
    expect(trainingOpponentLevel(86, null) - trainingOpponentLevel(56, null)).toBe(12)
    expect(trainingOpponentLevel(50, 56, 1.3)).toBeGreaterThan(trainingOpponentLevel(50, 56, 1))
    expect(trainingOpponentLevel(50, 56, 0.85)).toBeLessThan(trainingOpponentLevel(50, 56, 1))
  })
})
