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

describe('delayed consequences remind the player of the decision (2.4#114)', () => {
  it('a follow-up scheduled 2+ weeks out shows "N weeks ago ... you chose ..." in its text', async () => {
    const { describeEvent, resolveEvent, rollEvents, scheduledFollowUps } = await import('./engine')
    const state = makeTestState({ seed: 8, money: 5_000_000 })
    const rng = new Rng(4)
    // teammates.loan_request -> loan_payback after 4 weeks
    const def = getEventDef('teammates.loan_request')
    expect(def).toBeTruthy()
    state.pendingEvents.push({ defId: def!.id, vars: { amount: 1000, mate: 'Arda', mateId: 'x1' }, firedAt: { ...state.calendar } })
    resolveEvent(state, rng, state.pendingEvents[0]!, 0)
    const q = scheduledFollowUps(state)
    expect(q.length).toBe(1)
    expect(q[0]!.vars['recall_choice_en']).toMatch(/Lend it/)
    // fire it 4 weeks later
    state.calendar.week += 4
    rollEvents(state, new Rng(1), ['weekly'], 3, {})
    const pending = state.pendingEvents.find((p) => p.defId === 'teammates.loan_payback')
    expect(pending).toBeTruthy()
    const view = describeEvent(state, pending!, 'en')!
    expect(view.text).toMatch(/^📜 4 week\(s\) ago/)
    expect(view.text).toMatch(/you chose Lend it/)
  })
})
