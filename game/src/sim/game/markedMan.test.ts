import { describe, expect, it } from 'vitest'
import type { Hero } from '../../core/types'
import { kindWeights } from '../match/highlightGen'
import { markedMan } from './match'

type H = Pick<Hero, 'seasonStats' | 'history'>
const hero = (cur: [number, number], last?: [number, number]): H => ({
  seasonStats: { apps: cur[0], goals: cur[1] } as Hero['seasonStats'],
  history: last ? [{ stats: { apps: last[0], goals: last[1] } } as Hero['history'][number]] : [],
})

describe('marked man (playtest Tur 3)', () => {
  it('is zero for a normal scoring rate and for tiny samples', () => {
    expect(markedMan(hero([20, 12]))).toBe(0)
    expect(markedMan(hero([3, 6]))).toBe(0)
    expect(markedMan(hero([0, 0], [30, 18]))).toBe(0)
  })
  it('grows with a prolific run and carries last season into the early weeks', () => {
    expect(markedMan(hero([20, 20]))).toBeCloseTo(0.4, 5)
    expect(markedMan(hero([20, 30]))).toBe(1)
    expect(markedMan(hero([2, 1], [34, 40]))).toBeGreaterThan(0.4)
    expect(markedMan(hero([30, 15], [34, 40]))).toBe(0)
  })
  it('thins out shooting chances like elite marking', () => {
    const free = kindWeights('ST', 72)
    const marked = kindWeights('ST', 72, 1)
    expect(marked.one_on_one!).toBeLessThan(free.one_on_one! * 0.6)
  })
})
