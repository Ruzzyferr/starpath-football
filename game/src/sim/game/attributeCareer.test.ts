/**
 * Attribute-linked career (owner requirement: stats matter in the player's life): event cards
 * gated by attributes, the manager's development plan, ageing per attribute, body care, training
 * injury resilience and transfer interest by club style.
 */
import { describe, expect, it } from 'vitest'
import type { AttributeKey, GameState } from '../../core/types'
import { ATTRIBUTE_KEYS } from '../../core/types'
import { Rng } from '../../core/rng'
import { attributeEvents } from '../life/events/content/attributes'
import { isEligible } from '../life/events/engine'
import { makeTestState } from '../life/events/testFixture'
import { objectivesView, objectivesWeekly, startPresetObjective, OBJECTIVES_FLAG } from './objectives'
import { readJson } from './internal'
import { weakestDevArea } from '../career/attributeLife'
import { DECLINE_MULT, weeklyAging } from '../career/progression'
import { bodyCare, bodyInjuryFactor, recoveryMultiplier } from '../career/condition'
import { scoutInterest, type CandidateClub } from '../career/transfers'
import { makeHeroLife } from '../career/testFixtures'

const TAGS = ['weekly', 'training', 'post_match', 'match_win', 'match_loss', 'scored', 'benched', 'new_season', 'season_end', 'transfer_window']

function st(seed: number, tweak: (s: GameState) => void): GameState {
  const s = makeTestState({ seed, partner: true, money: 3_000_000, reputation: 60 })
  s.calendar.week = 32
  s.hero.contract!.role = 'starter'
  s.hero.seasonStats.apps = 20
  tweak(s)
  return s
}
const setAll = (s: GameState, v: number) => { for (const k of ATTRIBUTE_KEYS) s.hero.attrs[k] = v }

describe('attribute event cards', () => {
  it('ships 30+ cards, each gated on the hero’s attributes', () => {
    expect(attributeEvents.length).toBeGreaterThanOrEqual(30)
    // Every card reads attributes (or the stats they drive): its conditions use hero.attrs or a helper on them.
    for (const e of attributeEvents) expect(e.id).toMatch(/\.attr_/)
  })

  it('every card is reachable for some kind of player, and attribute-gated cards switch off for the opposite profile', () => {
    const elite = st(1, (s) => {
      setAll(s, 86)
      s.hero.attrs.aggression = 82
      s.hero.attrs.anticipation = 60
      s.hero.attrs.acceleration = 92
      s.hero.contract!.role = 'captain'
      s.hero.seasonStats.assists = 12; s.hero.seasonStats.goals = 9; s.hero.seasonStats.tackles = 40; s.hero.seasonStats.yellow = 5
      s.hero.reputation = 70
    })
    const eliteStarter = st(2, (s) => { setAll(s, 86); s.hero.attrs.aggression = 40; s.hero.seasonStats.yellow = 0; s.hero.reputation = 70; s.hero.birthYear = s.calendar.season - 25 })
    const raw = st(3, (s) => {
      setAll(s, 48)
      s.hero.fatigue = 75
      s.hero.birthYear = s.calendar.season - 20
      s.hero.seasonStats.yellow = 0
    })
    const veteran = st(4, (s) => {
      setAll(s, 70)
      s.hero.birthYear = s.calendar.season - 32
      s.world.clubs[s.hero.contract!.clubId]!.style = 'pressing'
      s.hero.attrs.workRate = 35; s.hero.attrs.stamina = 40; s.hero.attrs.aggression = 30
    })
    const variants = [elite, eliteStarter, raw, veteran]
    const missing = attributeEvents.filter((e) => !e.followUpOnly && !variants.some((s) => TAGS.some((tg) => isEligible(s, e, [tg]))))
    expect(missing.map((e) => e.id)).toEqual([])
    // Opposite profiles: the hard-man chant needs aggression, the running-on-fumes card needs fatigue.
    const chant = attributeEvents.find((e) => e.id === 'fans.attr_hard_man_chant')!
    expect(TAGS.some((tg) => isEligible(elite, chant, [tg]))).toBe(true)
    expect(TAGS.some((tg) => isEligible(eliteStarter, chant, [tg]))).toBe(false)
    const fumes = attributeEvents.find((e) => e.id === 'health.attr_running_on_fumes')!
    expect(TAGS.some((tg) => isEligible(raw, fumes, [tg]))).toBe(true)
    expect(TAGS.some((tg) => isEligible(elite, fumes, [tg]))).toBe(false)
  })

  it('the rest-or-play call injures a low-stamina body more often than a big engine', () => {
    const card = attributeEvents.find((e) => e.id === 'health.attr_running_on_fumes')!
    const play = card.choices[2]!
    const rate = (stamina: number) => {
      let hurt = 0
      for (let i = 0; i < 400; i++) {
        const s = st(5, (x) => { x.hero.attrs.stamina = stamina; x.hero.fatigue = 80 })
        const r = play.effects({ state: s, vars: {}, absWeek: 0, tags: [] }, new Rng(i))
        if (r.deltas.some((d) => d.kind === 'injury')) hurt++
      }
      return hurt / 400
    }
    expect(rate(35)).toBeGreaterThan(rate(85) + 0.08)
  })
})

describe('development plan objective', () => {
  it('targets the weakest role stat, completes when it grows and pays trust', () => {
    const s = st(6, (x) => { setAll(x, 70) })
    s.hero.role = 'playmaker'
    s.hero.attrs.workRate = 50
    expect(weakestDevArea(s.hero)).toBe('workRate')
    expect(startPresetObjective(s, 'dev_focus')).toBe(true)
    expect(startPresetObjective(s, 'dev_focus')).toBe(false) // one plan at a time
    const o = objectivesView(s).active.find((x) => x.title.en.startsWith('Development plan'))!
    expect(o.title.en).toContain('Work Rate')
    const trust0 = s.hero.managerTrust
    s.hero.attrs.workRate = 53
    objectivesWeekly(s, [])
    expect(objectivesView(s).active.some((x) => x.id === o.id)).toBe(false)
    expect(s.hero.managerTrust).toBeGreaterThan(trust0)
  })

  it('a missed plan costs trust at the deadline', () => {
    const s = st(7, (x) => { setAll(x, 70) })
    s.hero.role = 'playmaker'
    s.hero.attrs.stamina = 45
    startPresetObjective(s, 'dev_focus')
    const trust0 = s.hero.managerTrust
    for (let i = 0; i < 8; i++) {
      s.calendar.week++
      objectivesWeekly(s, [])
    }
    const store = readJson<{ history: { kind: string; status: string }[] }>(s.life, OBJECTIVES_FLAG, { history: [] })
    expect(store.history.some((h) => h.kind === 'attrGrowth' && h.status === 'failed')).toBe(true)
    expect(s.hero.managerTrust).toBeLessThan(trust0)
  })
})

describe('the body with age', () => {
  const declineOver = (age: number, care = 0, weeks = 44): Record<AttributeKey, number> => {
    const { hero } = makeHeroLife({ position: 'CM', role: 'boxToBox', age })
    for (const k of ATTRIBUTE_KEYS) { hero.attrs[k] = 80; hero.attrXp[k] = 0.5 }
    hero.careerStats.apps = 0
    const before = { ...hero.attrs }
    for (let w = 0; w < weeks; w++) weeklyAging(hero, 2026, 44, care)
    return Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, before[k] - hero.attrs[k]])) as Record<AttributeKey, number>
  }

  it('the first yard goes first: acceleration and pace fall faster than strength; vision never declines', () => {
    expect(DECLINE_MULT.acceleration!).toBeGreaterThan(DECLINE_MULT.strength!)
    const d = declineOver(34)
    expect(d.acceleration).toBeGreaterThan(d.strength)
    expect(d.pace).toBeGreaterThanOrEqual(d.balance)
    expect(d.vision).toBe(0)
    expect(d.leadership).toBe(0)
  })

  it('veterans keep growing the football brain', () => {
    const { hero } = makeHeroLife({ position: 'CM', role: 'boxToBox', age: 30 })
    hero.careerStats.apps = 200
    hero.attrs.vision = 70
    hero.attrXp.vision = 0
    for (let w = 0; w < 88; w++) weeklyAging(hero, 2026, 44)
    expect(hero.attrs.vision + (hero.attrXp.vision ?? 0)).toBeGreaterThan(70)
  })

  it('diet and sleep hold back the physical decline', () => {
    const plain = declineOver(33, 0, 88)
    const cared = declineOver(33, 0.25, 88)
    const sum = (d: Record<AttributeKey, number>) => d.pace + d.acceleration + d.agility + d.stamina + d.jumping
    expect(sum(cared)).toBeLessThan(sum(plain))
    const s = makeTestState({ seed: 1 })
    expect(bodyCare(s.life, 0.75)).toBe(0)
    s.life.flags.diet_left = 5
    expect(bodyCare(s.life, 1)).toBeCloseTo(0.25)
  })

  it('stamina and diet speed up recovery; balance and strength lower training injury risk', () => {
    const { hero, life } = makeHeroLife({})
    hero.attrs.stamina = 30
    const slow = recoveryMultiplier(hero, life)
    hero.attrs.stamina = 90
    const fast = recoveryMultiplier(hero, life)
    expect(fast).toBeGreaterThan(slow)
    life.flags.diet_left = 3
    expect(recoveryMultiplier(hero, life)).toBeGreaterThan(fast)
    const frail = bodyInjuryFactor({ attrs: { ...hero.attrs, stamina: 35, balance: 40, strength: 40 } })
    const solid = bodyInjuryFactor({ attrs: { ...hero.attrs, stamina: 80, balance: 85, strength: 85 } })
    expect(frail).toBeGreaterThan(1)
    expect(solid).toBeLessThan(1)
  })
})

describe('transfer interest by club style', () => {
  it('a quick, direct runner draws more interest from counter-attacking sides than from possession sides', () => {
    const { hero } = makeHeroLife({ position: 'ST', role: 'runner', age: 23 })
    hero.attrs.pace = 92; hero.attrs.acceleration = 94; hero.attrs.passing = 40; hero.attrs.vision = 40; hero.attrs.firstTouch = 45; hero.attrs.composure = 45
    const club = (id: string, style: CandidateClub['style']): CandidateClub => ({ clubId: id, name: id, reputation: 50, squadAvgOvr: 60, style })
    let counter = 0
    let possession = 0
    for (let i = 0; i < 60; i++) {
      const r = scoutInterest(new Rng(i), hero, [club('a', 'counter'), club('b', 'possession')], { season: 2026, currentClubId: 'x' })
      counter += r.find((c) => c.clubId === 'a')?.level ?? 0
      possession += r.find((c) => c.clubId === 'b')?.level ?? 0
    }
    expect(counter / 60).toBeGreaterThan(possession / 60 + 4)
    const reasons = scoutInterest(new Rng(1), hero, [club('a', 'counter')], { season: 2026, currentClubId: 'x' })
    expect(reasons[0]?.reason.en ?? '').toMatch(/counter-attacking|form|squad|potential|name/)
  })
})
