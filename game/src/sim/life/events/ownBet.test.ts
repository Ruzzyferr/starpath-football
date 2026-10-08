import { describe, expect, it } from 'vitest'
import { Rng } from '../../../core/rng'
import { applyEffectResult, getEventDef } from './engine'
import { OWN_BET_BAN, OWN_BET_EXPOSURE } from './content/casinoCareer'
import { makeTestState } from './testFixture'

describe('betting on your own match (2.5#102)', () => {
  it('is a labelled severe-risk choice; exposure ends sponsors and bans; unexposed costs only the stake', () => {
    const def = getEventDef('casino.own_match_bet')!
    const choice = def.choices[2]!
    expect(choice.hint?.en).toMatch(/Severe legal risk/)
    expect(choice.risk).toBe('high')
    expect(OWN_BET_EXPOSURE).toBe(0.35)
    let caught = 0
    let missed = 0
    for (let seed = 1; seed <= 60; seed++) {
      const state = makeTestState({ seed })
      state.life.money = 1_000_000
      state.life.sponsors = [{ id: 's', brand: 'Volt', category: 'boots', weekly: 1000, untilSeason: 2099, minReputation: 5 }]
      const vars = { stake: 10_000 }
      const rng = new Rng(seed)
      const res = choice.effects({ state, vars } as never, rng)
      applyEffectResult(state, rng, def, vars, res)
      if (state.hero.suspendedMatches >= OWN_BET_BAN) {
        caught++
        expect(state.life.sponsors).toHaveLength(0)
      } else {
        missed++
        expect(state.life.sponsors).toHaveLength(1)
      }
    }
    expect(caught).toBeGreaterThan(8)
    expect(missed).toBeGreaterThan(20)
  })
})
