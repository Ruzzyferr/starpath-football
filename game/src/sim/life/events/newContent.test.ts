import { describe, expect, it } from 'vitest'
import { Rng } from '../../../core/rng'
import { ALL_EVENTS } from './content'
import { applyEffectResult, careerCount, getEventDef, isEligible, rollEvents } from './engine'
import { makeTestState } from './testFixture'
import { fx, t, brand } from './dsl'
import type { EventCategory, EventDef } from './types'
import { openBusiness } from '../business'

const NEW: EventCategory[] = ['legal', 'scam', 'rumour', 'business', 'charity', 'mentor']

describe('WP-10 event content', () => {
  it('new categories each carry at least 5 events and a multi-step chain', () => {
    for (const c of NEW) {
      const list = ALL_EVENTS.filter((e) => e.category === c)
      expect(list.length, c).toBeGreaterThanOrEqual(5)
      expect(list.some((e) => e.followUpOnly), `${c} has chain steps`).toBe(true)
    }
  })

  it('4-step chains exist (contract dispute, transfer gossip, foundation, academy, abroad)', () => {
    for (const id of ['legal.verdict', 'rumour.transfer_resolution', 'charity.foundation_pitch', 'mentor.kid_transfer', 'friends.abroad_settled']) {
      expect(getEventDef(id)?.followUpOnly, id).toBe(true)
    }
  })

  it('"at most N per career" is enforced by the engine', () => {
    const def: EventDef = {
      id: 'legal.test_capped', category: 'legal', weight: 1, cooldownWeeks: 0, maxPerCareer: 2, conditions: () => true,
      title: t('a', 'a'), text: t('b', 'b'), icon: '⚖️',
      choices: [{ label: t('x', 'x'), effects: () => fx(t('ok', 'ok')) }, { label: t('y', 'y'), effects: () => fx(t('ok', 'ok')) }],
    }
    const s = makeTestState()
    const rng = new Rng(1)
    let fired = 0
    for (let w = 0; w < 20; w++) {
      s.calendar.week = w
      s.pendingEvents = []
      fired += rollEvents(s, rng, ['weekly'], 1, { events: [def], fireChance: 1 }).length
    }
    expect(fired).toBe(2)
    expect(careerCount(s, def.id)).toBe(2)
    expect(isEligible(s, def, ['weekly'])).toBe(false)
  })

  it('brand deltas change an owned business and are no-ops without one', () => {
    const s = makeTestState({ money: 5_000_000, reputation: 60 })
    const def = getEventDef('business.celebrity_visit')!
    const r0 = applyEffectResult(s, new Rng(1), def, {}, fx(t('x', 'x'), brand(5)))
    expect(r0.deltas).toEqual([])
    openBusiness(s.life, s.hero, 'restaurant', s.calendar)
    const b = s.life.businesses![0]
    const before = b.brand
    const r1 = applyEffectResult(s, new Rng(1), def, {}, fx(t('x', 'x'), brand(5)))
    expect(b.brand).toBe(before + 5)
    expect(r1.deltas[0]).toMatchObject({ kind: 'brand', amount: 5 })
  })

  it('blame cards do not fire after the hero carried the team; the ovation card does', () => {
    const s = makeTestState()
    s.life.flags.last_match_shone = true
    const tags = ['post_match', 'match_loss']
    expect(isEligible(s, getEventDef('social.trolls')!, tags)).toBe(false)
    expect(isEligible(s, getEventDef('social.miss_meme')!, tags)).toBe(false)
    expect(isEligible(s, getEventDef('fans.hero_in_defeat')!, tags)).toBe(true)
    s.life.flags.last_match_shone = false
    expect(isEligible(s, getEventDef('social.trolls')!, tags)).toBe(true)
    expect(isEligible(s, getEventDef('fans.hero_in_defeat')!, tags)).toBe(false)
  })

  it('the abroad chain only starts for heroes playing in another country', () => {
    const s = makeTestState()
    s.calendar.week = 5
    const def = getEventDef('friends.abroad_lonely')!
    expect(isEligible(s, def, ['weekly'])).toBe(false)
    s.hero.nationality = 'DE'
    expect(isEligible(s, def, ['weekly'])).toBe(true)
  })

  it('anti-spam still holds with the bigger pool: ≤3 cards a week, no category twice in a roll', () => {
    const s = makeTestState({ money: 3_000_000, reputation: 55 })
    const rng = new Rng(7)
    for (let w = 0; w < 40; w++) {
      s.calendar.week = w % 50
      s.calendar.season = 2026 + Math.floor(w / 50)
      const added = rollEvents(s, rng, ['weekly', 'post_match', 'match_loss'], 3, { fireChance: 1 })
      expect(added.length).toBeLessThanOrEqual(3)
      const cats = added.map((p) => getEventDef(p.defId)!.category)
      expect(new Set(cats).size).toBe(cats.length)
      s.pendingEvents = []
    }
  })
})
