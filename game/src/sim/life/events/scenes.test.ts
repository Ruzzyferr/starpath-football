import { describe, expect, it } from 'vitest'
import { Rng } from '../../../core/rng'
import { applyEffectResult, describeEvent, getEventDef, resolveEvent } from './engine'
import { makeTestState } from './testFixture'
import { startScene, SCENE_ENERGY } from '../scenes'

describe('relationship scenes (2.4#11)', () => {
  it('a talk scene has three answers, costs a little energy and moves that exact person', () => {
    const state = makeTestState({ seed: 5 })
    const e0 = state.life.energy
    expect(startScene(state, 'mother', 'talk').ok).toBe(true)
    expect(state.life.energy).toBe(e0 - SCENE_ENERGY)
    const pending = state.pendingEvents.find((p) => p.defId === 'friends.scene_talk')!
    const view = describeEvent(state, pending, 'en')!
    expect(view.choices).toHaveLength(3)
    expect(view.title).toContain('Ayşe') // the mother's name in the fixture
    const before = state.life.relationships.mother!.value
    resolveEvent(state, new Rng(1), pending, 0)
    expect(state.life.relationships.mother!.value).toBeGreaterThan(before)
    expect(state.pendingEvents.some((p) => p.defId.startsWith('friends.scene_'))).toBe(false)
  })

  it('a shared activity scene works for a teammate id and refuses a second open scene or no energy', () => {
    const state = makeTestState({ seed: 6 })
    const mate = (Object.values(state.life.relationships).find((r) => r.kind === 'teammate') ?? state.life.relationships.mother)!
    expect(startScene(state, mate.id, 'together').ok).toBe(true)
    expect(startScene(state, mate.id, 'talk').ok).toBe(false) // one open scene at a time
    const def = getEventDef('friends.scene_together')!
    const rng = new Rng(2)
    const b = mate.value
    const res = def.choices[1]!.effects({ state, vars: { personId: mate.id, person: mate.name, personValue: mate.value }, absWeek: 0, tags: [] } as never, rng)
    applyEffectResult(state, rng, def, { person: mate.name }, res)
    expect(mate.value).toBeGreaterThan(b)
    state.pendingEvents = []
    state.life.energy = 0
    expect(startScene(state, mate.id, 'talk').ok).toBe(false)
  })
})
