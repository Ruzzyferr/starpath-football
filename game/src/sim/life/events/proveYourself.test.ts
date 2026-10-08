import { describe, expect, it } from 'vitest'
import { Rng } from '../../../core/rng'
import { applyEffectResult, getEventDef } from './engine'
import { makeTestState } from './testFixture'
import { objectivesView } from '../../game/objectives'

describe('night-out chain: disciplinary talk starts a "prove yourself" objective (2.4#100)', () => {
  it('photos -> talk -> objective (rating 7.5+) -> result card', () => {
    const photos = getEventDef('nightlife.paparazzi_photos')!
    for (const c of photos.choices) {
      const st = makeTestState({ seed: 3 })
      const res = c.effects({ state: st, vars: {}, absWeek: 0, tags: [] } as never, new Rng(1))
      expect(res.followUps?.some((f) => f.eventId === 'nightlife.discipline_talk')).toBe(true)
    }
    const talk = getEventDef('nightlife.discipline_talk')!
    const state = makeTestState({ seed: 4 })
    const rng = new Rng(2)
    const res = talk.choices[0]!.effects({ state, vars: {}, absWeek: 0, tags: [] } as never, rng)
    const out = applyEffectResult(state, rng, talk, {}, res)
    expect(out.deltas.some((d) => d.kind === 'objective')).toBe(true)
    expect(out.followUps.some((f) => f.eventId === 'nightlife.prove_result')).toBe(true)
    const view = objectivesView(state)
    expect(JSON.stringify(view)).toMatch(/7\.5/)
    // starting it twice does not duplicate it
    const again = applyEffectResult(state, rng, talk, {}, talk.choices[0]!.effects({ state, vars: {}, absWeek: 0, tags: [] } as never, rng))
    expect(again.deltas.some((d) => d.kind === 'objective')).toBe(false)
  })
})
