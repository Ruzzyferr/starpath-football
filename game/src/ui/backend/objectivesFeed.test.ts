import { beforeAll, describe, expect, it } from 'vitest'
import type { ObjectivesView, ObjectiveView } from '../../sim/game'
import { MemoryStorage } from '../../state/save'
import { gameState, installBackend } from '../store'
import { toasts } from '../components/Toast'
import { DEFAULT_CAREER } from './index'
import { useStorage } from './persistence'
import { realActions as A } from './realActions'
import { realData as D } from './realData'
import { forceCompleteObjective, installObjectivesFeed, mapObjectives } from './objectivesFeed'

const L = (s: string) => ({ tr: s, en: s })
const ov = (id: string, source: ObjectiveView['source'], seasonal: boolean): ObjectiveView => ({
  id, source, sourceName: L(source), icon: 'x', title: L(id), desc: L(id), progress: 1, target: 3, ratio: 0.33,
  weeksLeft: 4, reward: L('r'), penalty: null, rewardParts: [], penaltyParts: [], seasonal,
})

describe('mapObjectives', () => {
  const view: ObjectivesView = {
    active: [ov('a', 'manager', false), ov('b', 'fans', false), ov('c', 'board', true), ov('d', 'self', true)],
    recent: [{ title: L('x'), status: 'done', source: 'agent', icon: 'i' }],
    done: 5, failed: 2,
  }
  it('splits short, board and personal goals', () => {
    const u = mapObjectives(view, { season: 1, done: 3, failed: 2 })
    expect(u.short.map((o) => o.id)).toEqual(['a', 'b'])
    expect(u.board?.id).toBe('c')
    expect(u.personal?.id).toBe('d')
  })
  it('counts this season from the baseline', () => {
    const u = mapObjectives(view, { season: 1, done: 3, failed: 1 })
    expect([u.seasonDone, u.seasonFailed]).toEqual([2, 1])
    const none = mapObjectives(view, null)
    expect([none.seasonDone, none.seasonFailed]).toEqual([0, 0])
  })
  it('handles an empty view', () => {
    const u = mapObjectives({ active: [], recent: [], done: 0, failed: 0 }, null)
    expect(u.short).toEqual([])
    expect(u.board).toBeNull()
  })
})

describe('objectives over the real backend', () => {
  beforeAll(() => {
    useStorage(new MemoryStorage())
    installBackend({ actions: A, data: D })
    installObjectivesFeed()
    A.newGame({ ...DEFAULT_CAREER, seed: 7 })
  })

  it('hands out goals as weeks pass and toasts a forced completion', () => {
    expect(D.objectives().short.length).toBeGreaterThan(0) // week-one objective issued at career start
    for (let i = 0; i < 1; i++) {
      for (let k = 0; k < 10 && (gameState.value?.pendingEvents.length ?? 0) > 0; k++) A.resolveEvent(0, 0)
      A.advanceToMatch()
    }
    const before = D.objectives()
    expect(before.short.length).toBeGreaterThan(0)
    toasts.value = []
    expect(forceCompleteObjective(gameState.value!)).toBe(true)
    expect(D.objectives().done).toBe(before.done + 1)
    expect(toasts.value.some((x) => x.kind === 'reward')).toBe(true)
  })
})
